import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth'
import { parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }
  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }

  if (!sessionId) {
    return NextResponse.json({ watchlist: [] })
  }

  const userId = await getSessionUser(dbEnv, sessionId)
  if (!userId) {
    return NextResponse.json({ watchlist: [] })
  }

  const db = getDB(dbEnv)
  const items = await db
    .select()
    .from(schema.watchlist)
    .where(eq(schema.watchlist.userId, userId))
    .all()

  return NextResponse.json({ watchlist: items })
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

    const { tmdbId, mediaType } = body

    logger.info('Watchlist POST request', { body: JSON.stringify(body), tmdbId, tmdbType: typeof tmdbId, mediaType, mediaTypeType: typeof mediaType, keys: Object.keys(body) })

    if (!tmdbId) {
      return NextResponse.json({ error: 'Missing tmdbId' }, { status: 400 })
    }

    const finalMediaType = mediaType || 'movie'

    const db = getDB(dbEnv)

    const existing = await db
      .select()
      .from(schema.watchlist)
      .where(eq(schema.watchlist.userId, userId))
      .all()

    const alreadyExists = existing.find(item => item.tmdbId === tmdbId && item.mediaType === finalMediaType)

    if (alreadyExists) {
      await db.delete(schema.watchlist).where(eq(schema.watchlist.id, alreadyExists.id)).run()
      return NextResponse.json({ added: false })
    }

    await db.insert(schema.watchlist).values({ userId, tmdbId, mediaType: finalMediaType })
    return NextResponse.json({ added: true })
  } catch (error: any) {
    logger.error('Watchlist POST error', {}, error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}