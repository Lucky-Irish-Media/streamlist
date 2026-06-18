import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getSessionUser, parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { desc, eq, and, sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'


async function getDefaultListId(db: ReturnType<typeof getDB>, userId: string): Promise<string> {
  const defaultList = await db
    .select()
    .from(schema.watchlists)
    .where(and(eq(schema.watchlists.userId, userId), eq(schema.watchlists.name, 'Default')))
    .get()
  if (defaultList) return defaultList.id

  const { nanoid } = await import('nanoid')
  const id = `default_${userId}`
  await db.insert(schema.watchlists).values({
    id,
    userId,
    name: 'Default',
  }).run()
  return id
}

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
  const rawListId = searchParams.get('listId')

  const db = getDB(dbEnv)

  const activeListId = rawListId || await getDefaultListId(db, userId)

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.watchlistItems)
    .where(eq(schema.watchlistItems.listId, activeListId))
    .get()
  const total = totalResult?.count || 0

  const items = await db
    .select()
    .from(schema.watchlistItems)
    .where(eq(schema.watchlistItems.listId, activeListId))
    .orderBy(desc(schema.watchlistItems.addedAt))
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

    let body: { tmdbId?: number; mediaType?: string; listIds?: string[] }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { tmdbId, mediaType, listIds } = body

    logger.info('Watchlist POST request', { body: JSON.stringify(body), tmdbId, tmdbType: typeof tmdbId })

    if (!tmdbId) {
      return NextResponse.json({ error: 'Missing tmdbId' }, { status: 400 })
    }

    const finalMediaType = mediaType || 'movie'
    const db = getDB(dbEnv)

    const targetListIds = listIds && listIds.length > 0
      ? listIds
      : [await getDefaultListId(db, userId)]

    for (const targetListId of targetListIds) {
      const existing = await db
        .select()
        .from(schema.watchlistItems)
        .where(
          and(
            eq(schema.watchlistItems.listId, targetListId),
            eq(schema.watchlistItems.tmdbId, tmdbId),
            eq(schema.watchlistItems.mediaType, finalMediaType),
          )
        )
        .get()

      if (existing) {
        await db.delete(schema.watchlistItems).where(eq(schema.watchlistItems.id, existing.id)).run()
      } else {
        await db.insert(schema.watchlistItems).values({
          listId: targetListId,
          tmdbId,
          mediaType: finalMediaType,
        }).run()
      }
    }

    return NextResponse.json({ added: true })
  } catch (error: any) {
    logger.error('Watchlist POST error', {}, error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}
