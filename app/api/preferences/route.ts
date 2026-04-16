import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth'
import { parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }
  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const userId = await getSessionUser(dbEnv, sessionId)
  if (!userId) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const { streamingServices, genres, likes, addLike, removeLike, countries } = await req.json() as {
    streamingServices?: string[]
    genres?: number[]
    likes?: { tmdbId: number; mediaType: string; title?: string }[]
    addLike?: { tmdbId: number; mediaType: string; title?: string }
    removeLike?: { tmdbId: number; mediaType: string }
    countries?: string[]
  }
  const db = getDB(dbEnv)

  if (addLike) {
    const existing = await db.select().from(schema.userLikes)
      .where(eq(schema.userLikes.userId, userId))
      .all()
    const alreadyExists = existing.some(l => l.tmdbId === addLike.tmdbId)
    if (!alreadyExists) {
      await db.insert(schema.userLikes).values({ userId, tmdbId: addLike.tmdbId, mediaType: addLike.mediaType, title: addLike.title || '' })
    }
    return NextResponse.json({ success: true })
  }

  if (removeLike) {
    const existing = await db.select().from(schema.userLikes)
      .where(eq(schema.userLikes.userId, userId))
      .all()
    const existingLike = existing.find(l => l.tmdbId === removeLike.tmdbId)
    if (existingLike) {
      await db.delete(schema.userLikes).where(eq(schema.userLikes.id, existingLike.id)).run()
    }
    return NextResponse.json({ success: true })
  }

  if (streamingServices) {
    await db.delete(schema.userStreamingServices).where(eq(schema.userStreamingServices.userId, userId)).run()
    for (const service of streamingServices) {
      const serviceId = typeof service === 'string' ? service : (service as { id: string }).id
      const serviceName = typeof service === 'string' ? service : (service as { name?: string }).name || serviceId
      await db.insert(schema.userStreamingServices).values({ userId, serviceId, serviceName })
    }
  }

  if (genres) {
    await db.delete(schema.userGenres).where(eq(schema.userGenres.userId, userId)).run()
    for (const genreId of genres) {
      await db.insert(schema.userGenres).values({ userId, genreId })
    }
  }

  if (likes) {
    await db.delete(schema.userLikes).where(eq(schema.userLikes.userId, userId)).run()
    for (const like of likes) {
      await db.insert(schema.userLikes).values({ userId, tmdbId: like.tmdbId, mediaType: like.mediaType, title: like.title || '' })
    }
  }

  if (countries !== undefined) {
    await db.update(schema.users).set({ countries: JSON.stringify(countries) }).where(eq(schema.users.id, userId)).run()
  }

  return NextResponse.json({ success: true })
}