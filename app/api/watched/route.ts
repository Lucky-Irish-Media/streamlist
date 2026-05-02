import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth'
import { parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'

export const runtime = 'edge'

async function getUserId(req: NextRequest, env: any): Promise<string | null> {
  const dbEnv = { DB: (env as any)?.DB }
  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }
  if (!sessionId) {
    return null
  }
  return getSessionUser(dbEnv, sessionId)
}

export async function GET(req: NextRequest) {
  const { env } = getRequestContext()
  const { searchParams } = new URL(req.url)
  const tmdbId = searchParams.get('tmdbId')
  const type = searchParams.get('type')
  const userId = await getUserId(req, env)

  if (!userId) {
    return NextResponse.json({ watched: [], episodes: [] })
  }

  const dbEnv = { DB: (env as any)?.DB }
  const db = getDB(dbEnv)

  if (tmdbId && type === 'tv') {
    const items = await db
      .select()
      .from(schema.watched)
      .where(and(eq(schema.watched.userId, userId), eq(schema.watched.tmdbId, Number(tmdbId))))
      .all()

    const episodes = await db
      .select()
      .from(schema.episodesWatched)
      .where(and(eq(schema.episodesWatched.userId, userId), eq(schema.episodesWatched.tmdbTvId, Number(tmdbId))))
      .all()

    return NextResponse.json({ watched: items, episodes })
  }

  const items = await db
    .select()
    .from(schema.watched)
    .where(eq(schema.watched.userId, userId))
    .all()

  return NextResponse.json({ watched: items, episodes: [] })
}

export async function POST(req: NextRequest) {
  try {
    const { env } = getRequestContext()
    const userId = await getUserId(req, env)

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const dbEnv = { DB: (env as any)?.DB }
    let body: { tmdbId?: number; mediaType?: string; title?: string; season?: number; episodes?: { seasonNumber: number; episodeNumber: number }[] }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { tmdbId, mediaType, title, season, episodes } = body

    if (!tmdbId) {
      return NextResponse.json({ error: 'tmdbId is required' }, { status: 400 })
    }

    const finalMediaType = mediaType || 'movie'
    const db = getDB(dbEnv)

    if (episodes && episodes.length > 0) {
      for (const ep of episodes) {
        const existing = await db
          .select()
          .from(schema.episodesWatched)
          .where(and(
            eq(schema.episodesWatched.userId, userId),
            eq(schema.episodesWatched.tmdbTvId, tmdbId),
            eq(schema.episodesWatched.seasonNumber, ep.seasonNumber),
            eq(schema.episodesWatched.episodeNumber, ep.episodeNumber)
          ))
          .get()

        if (!existing) {
          await db.insert(schema.episodesWatched).values({
            userId,
            tmdbTvId: tmdbId,
            seasonNumber: ep.seasonNumber,
            episodeNumber: ep.episodeNumber,
          })
        }
      }
      return NextResponse.json({ added: true, episodesAdded: episodes.length })
    }

    const existingWatched = await db
      .select()
      .from(schema.watched)
      .where(and(eq(schema.watched.userId, userId), eq(schema.watched.tmdbId, tmdbId)))
      .get()

    if (existingWatched) {
      return NextResponse.json({ added: false, message: 'Already watched' })
    }

    const existingWatchlist = await db
      .select()
      .from(schema.watchlist)
      .where(and(eq(schema.watchlist.userId, userId), eq(schema.watchlist.tmdbId, tmdbId)))
      .get()

    if (!existingWatchlist) {
      await db.insert(schema.watchlist).values({
        userId,
        tmdbId,
        mediaType: finalMediaType,
      })
    }

    const seasonWatched = finalMediaType === 'tv' && season ? season : null
    await db.insert(schema.watched).values({
      userId,
      tmdbId,
      mediaType: finalMediaType,
      title: title || '',
      seasonWatched,
    })

    return NextResponse.json({ added: true })
  } catch (error: any) {
    console.error('Watched POST error:', error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { env } = getRequestContext()
    const userId = await getUserId(req, env)

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    let body: { tmdbId?: number; mediaType?: string; episodes?: { seasonNumber: number; episodeNumber: number }[] }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { tmdbId, mediaType, episodes } = body

    if (!tmdbId) {
      return NextResponse.json({ error: 'tmdbId is required' }, { status: 400 })
    }

    const dbEnv = { DB: (env as any)?.DB }
    const db = getDB(dbEnv)

    if (episodes && episodes.length > 0) {
      for (const ep of episodes) {
        await db
          .delete(schema.episodesWatched)
          .where(and(
            eq(schema.episodesWatched.userId, userId),
            eq(schema.episodesWatched.tmdbTvId, tmdbId),
            eq(schema.episodesWatched.seasonNumber, ep.seasonNumber),
            eq(schema.episodesWatched.episodeNumber, ep.episodeNumber)
          ))
          .run()
      }
      return NextResponse.json({ removed: true, episodesRemoved: episodes.length })
    }

    await db
      .delete(schema.watched)
      .where(and(eq(schema.watched.userId, userId), eq(schema.watched.tmdbId, tmdbId)))
      .run()

    await db
      .delete(schema.episodesWatched)
      .where(and(eq(schema.episodesWatched.userId, userId), eq(schema.episodesWatched.tmdbTvId, tmdbId)))
      .run()

    return NextResponse.json({ removed: true })
  } catch (error: any) {
    console.error('Watched DELETE error:', error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}
