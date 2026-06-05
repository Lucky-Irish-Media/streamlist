import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getSessionUser } from '@/lib/auth'
import { parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { desc, eq, sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'


export async function GET(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const dbEnv = { DB: (env as any)?.DB }
  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }

  if (!sessionId) {
    return NextResponse.json({ watchlist: [], total: 0 })
  }

  const userId = await getSessionUser(dbEnv, sessionId)
  if (!userId) {
    return NextResponse.json({ watchlist: [], total: 0 })
  }

  const { searchParams } = new URL(req.url)
  const offset = parseInt(searchParams.get('offset') || '0')
  const limit = parseInt(searchParams.get('limit') || '20')

  const db = getDB(dbEnv)

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.watchlist)
    .where(eq(schema.watchlist.userId, userId))
    .get()
  const total = totalResult?.count || 0

  const items = await db
    .select()
    .from(schema.watchlist)
    .where(eq(schema.watchlist.userId, userId))
    .orderBy(desc(schema.watchlist.addedAt))
    .limit(limit)
    .offset(offset)
    .all()

  return NextResponse.json({ watchlist: items, total })
}

export async function POST(req: NextRequest) {
  try {
    const { env } = await getCloudflareContext({ async: true })
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

    let body: { tmdbId?: number; mediaType?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { tmdbId, mediaType } = body

    logger.info('Watchlist POST request', { body: JSON.stringify(body), tmdbId, tmdbType: typeof tmdbId, mediaType, mediaTypeType: typeof mediaType })

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