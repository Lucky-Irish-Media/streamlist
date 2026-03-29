import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth'
import { parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }
  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }

  if (!sessionId) {
    return NextResponse.json({ watched: [] })
  }

  const userId = await getSessionUser(dbEnv, sessionId)
  if (!userId) {
    return NextResponse.json({ watched: [] })
  }

  const db = getDB(dbEnv)
  const items = await db
    .select()
    .from(schema.watched)
    .where(eq(schema.watched.userId, userId))
    .all()

  return NextResponse.json({ watched: items })
}

export async function POST(req: NextRequest) {
  try {
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

    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { tmdbId, mediaType, title } = body

    if (!tmdbId) {
      return NextResponse.json({ error: 'tmdbId is required' }, { status: 400 })
    }

    const finalMediaType = mediaType || 'movie'
    const db = getDB(dbEnv)

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

    await db.insert(schema.watched).values({
      userId,
      tmdbId,
      mediaType: finalMediaType,
      title: title || '',
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

    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { tmdbId, mediaType } = body

    if (!tmdbId) {
      return NextResponse.json({ error: 'tmdbId is required' }, { status: 400 })
    }

    const db = getDB(dbEnv)

    await db
      .delete(schema.watched)
      .where(and(eq(schema.watched.userId, userId), eq(schema.watched.tmdbId, tmdbId)))
      .run()

    return NextResponse.json({ removed: true })
  } catch (error: any) {
    console.error('Watched DELETE error:', error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}
