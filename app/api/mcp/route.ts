import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and } from 'drizzle-orm'
import * as schema from '@/db/schema'

export const runtime = 'edge'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number | null
  method: string
  params?: Record<string, unknown>
}

async function getUserByApiKey(db: ReturnType<typeof drizzle>, apiKey: string): Promise<string | null> {
  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.apiKey, apiKey))
    .get()
  return user?.id ?? null
}

async function handleTool(db: ReturnType<typeof drizzle>, userId: string, toolName: string, args?: Record<string, unknown>) {
  switch (toolName) {
    case 'get_watchlist': {
      const items = await db
        .select()
        .from(schema.watchlist)
        .where(eq(schema.watchlist.userId, userId))
        .all()
      return items
    }
    case 'add_to_watchlist': {
      const { tmdb_id, media_type } = args as { tmdb_id: number; media_type: string }
      const existing = await db
        .select()
        .from(schema.watchlist)
        .where(
          and(
            eq(schema.watchlist.userId, userId),
            eq(schema.watchlist.tmdbId, tmdb_id)
          )
        )
        .get()
      if (existing) {
        return { success: false, message: 'Already in watchlist' }
      }
      await db.insert(schema.watchlist).values({
        userId,
        tmdbId: tmdb_id,
        mediaType: media_type,
      }).run()
      return { success: true, message: 'Added to watchlist' }
    }
    case 'remove_from_watchlist': {
      const { tmdb_id } = args as { tmdb_id: number }
      await db
        .delete(schema.watchlist)
        .where(
          and(
            eq(schema.watchlist.userId, userId),
            eq(schema.watchlist.tmdbId, tmdb_id)
          )
        )
        .run()
      return { success: true, message: 'Removed from watchlist' }
    }
    case 'get_preferences': {
      const user = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .get()
      if (!user) {
        return { error: 'User not found' }
      }
      const streamingServices = await db
        .select()
        .from(schema.userStreamingServices)
        .where(eq(schema.userStreamingServices.userId, userId))
        .all()
      const genres = await db
        .select()
        .from(schema.userGenres)
        .where(eq(schema.userGenres.userId, userId))
        .all()
      const likes = await db
        .select()
        .from(schema.userLikes)
        .where(eq(schema.userLikes.userId, userId))
        .all()
      return {
        country: user.country,
        streamingServices: streamingServices.map(s => s.serviceId),
        genres: genres.map(g => g.genreId),
        likes: likes.map(l => ({
          tmdbId: l.tmdbId,
          mediaType: l.mediaType,
          title: l.title,
        })),
      }
    }
    case 'update_streaming_services': {
      const { services } = args as { services: string[] }
      await db
        .delete(schema.userStreamingServices)
        .where(eq(schema.userStreamingServices.userId, userId))
        .run()
      if (services.length > 0) {
        await db
          .insert(schema.userStreamingServices)
          .values(services.map(serviceId => ({ userId, serviceId })))
          .run()
      }
      return { success: true, message: 'Streaming services updated' }
    }
    case 'update_genres': {
      const { genres } = args as { genres: number[] }
      await db
        .delete(schema.userGenres)
        .where(eq(schema.userGenres.userId, userId))
        .run()
      if (genres.length > 0) {
        await db
          .insert(schema.userGenres)
          .values(genres.map(genreId => ({ userId, genreId })))
          .run()
      }
      return { success: true, message: 'Genres updated' }
    }
    case 'update_country': {
      const { country } = args as { country: string }
      await db
        .update(schema.users)
        .set({ country })
        .where(eq(schema.users.id, userId))
        .run()
      return { success: true, message: 'Country updated' }
    }
    case 'add_like': {
      const { tmdb_id, media_type, title } = args as { tmdb_id: number; media_type: string; title: string }
      const existing = await db
        .select()
        .from(schema.userLikes)
        .where(
          and(
            eq(schema.userLikes.userId, userId),
            eq(schema.userLikes.tmdbId, tmdb_id)
          )
        )
        .get()
      if (existing) {
        return { success: false, message: 'Already in likes' }
      }
      await db.insert(schema.userLikes).values({
        userId,
        tmdbId: tmdb_id,
        mediaType: media_type,
        title,
      }).run()
      return { success: true, message: 'Added to likes' }
    }
    case 'remove_like': {
      const { tmdb_id } = args as { tmdb_id: number }
      await db
        .delete(schema.userLikes)
        .where(
          and(
            eq(schema.userLikes.userId, userId),
            eq(schema.userLikes.tmdbId, tmdb_id)
          )
        )
        .run()
      return { success: true, message: 'Removed from likes' }
    }
    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}

export async function POST(req: NextRequest) {
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }
  const db = drizzle(dbEnv, { schema })

  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32601, message: 'Missing x-api-key header' }, id: null },
      { status: 401 }
    )
  }

  const userId = await getUserByApiKey(db, apiKey)
  if (!userId) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32601, message: 'Invalid API key' }, id: null },
      { status: 401 }
    )
  }

  let body: JsonRpcRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null },
      { status: 400 }
    )
  }

  if (body.jsonrpc !== '2.0') {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: body.id ?? null },
      { status: 400 }
    )
  }

  const { method, params, id } = body

  if (method !== 'tools/call') {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id },
      { status: 400 }
    )
  }

  const { name, arguments: args } = params as { name: string; arguments?: Record<string, unknown> }

  try {
    const result = await handleTool(db, userId, name, args)
    return NextResponse.json({
      jsonrpc: '2.0',
      result: { content: [{ type: 'text', text: JSON.stringify(result) }] },
      id,
    })
  } catch (error) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: String(error) }, id },
      { status: 500 }
    )
  }
}

export async function GET() {
  const tools = [
    { name: 'get_watchlist', description: 'Get all items in the user\'s watchlist', inputSchema: { type: 'object', properties: {} } },
    { name: 'add_to_watchlist', description: 'Add a movie or TV show to the watchlist', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' }, media_type: { type: 'string', enum: ['movie', 'tv'] } }, required: ['tmdb_id', 'media_type'] } },
    { name: 'remove_from_watchlist', description: 'Remove a movie or TV show from the watchlist', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' } }, required: ['tmdb_id'] } },
    { name: 'get_preferences', description: 'Get user preferences including streaming services, genres, likes, and country', inputSchema: { type: 'object', properties: {} } },
    { name: 'update_streaming_services', description: 'Update the user\'s preferred streaming services', inputSchema: { type: 'object', properties: { services: { type: 'array', items: { type: 'string' } } }, required: ['services'] } },
    { name: 'update_genres', description: 'Update the user\'s preferred genres', inputSchema: { type: 'object', properties: { genres: { type: 'array', items: { type: 'number' } } }, required: ['genres'] } },
    { name: 'update_country', description: 'Update the user\'s country preference', inputSchema: { type: 'object', properties: { country: { type: 'string' } }, required: ['country'] } },
    { name: 'add_like', description: 'Add a movie or TV show to user\'s liked list', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' }, media_type: { type: 'string', enum: ['movie', 'tv'] }, title: { type: 'string' } }, required: ['tmdb_id', 'media_type', 'title'] } },
    { name: 'remove_like', description: 'Remove a movie or TV show from user\'s liked list', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' } }, required: ['tmdb_id'] } },
  ]

  return NextResponse.json({
    name: 'streamlist-mcp-server',
    version: '1.0.0',
    tools,
  })
}
