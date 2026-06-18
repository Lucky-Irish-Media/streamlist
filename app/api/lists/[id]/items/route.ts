import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getSessionUser, parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq, and, desc } from 'drizzle-orm'
import { sql } from 'drizzle-orm'


async function getUserId(req: NextRequest, env: any): Promise<string | null> {
  const dbEnv = { DB: (env as any)?.DB }
  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }
  if (!sessionId) return null
  return getSessionUser(dbEnv, sessionId)
}

async function getListOwnership(db: ReturnType<typeof getDB>, listId: string, userId: string) {
  return db
    .select()
    .from(schema.watchlists)
    .where(and(eq(schema.watchlists.id, listId), eq(schema.watchlists.userId, userId)))
    .get()
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: listId } = await params
  const { env } = await getCloudflareContext({ async: true })
  const userId = await getUserId(req, env)
  if (!userId) {
    return NextResponse.json({ items: [], total: 0 })
  }

  const db = getDB({ DB: (env as any)?.DB })
  const list = await getListOwnership(db, listId, userId)
  if (!list) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const offset = parseInt(searchParams.get('offset') || '0')
  const limit = parseInt(searchParams.get('limit') || '50')

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.watchlistItems)
    .where(eq(schema.watchlistItems.listId, listId))
    .get()
  const total = totalResult?.count || 0

  const items = await db
    .select()
    .from(schema.watchlistItems)
    .where(eq(schema.watchlistItems.listId, listId))
    .orderBy(desc(schema.watchlistItems.addedAt))
    .limit(limit)
    .offset(offset)
    .all()

  return NextResponse.json({ items, total, list })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: listId } = await params
    const { env } = await getCloudflareContext({ async: true })
    const userId = await getUserId(req, env)
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const db = getDB({ DB: (env as any)?.DB })
    const list = await getListOwnership(db, listId, userId)
    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    let body: { tmdbId?: number; mediaType?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { tmdbId, mediaType } = body
    if (!tmdbId) {
      return NextResponse.json({ error: 'Missing tmdbId' }, { status: 400 })
    }

    const finalMediaType = mediaType || 'movie'

    const existing = await db
      .select()
      .from(schema.watchlistItems)
      .where(
        and(
          eq(schema.watchlistItems.listId, listId),
          eq(schema.watchlistItems.tmdbId, tmdbId),
          eq(schema.watchlistItems.mediaType, finalMediaType),
        )
      )
      .get()

    if (existing) {
      return NextResponse.json({ added: false, message: 'Item already in list' })
    }

    await db.insert(schema.watchlistItems).values({
      listId,
      tmdbId,
      mediaType: finalMediaType,
    }).run()

    return NextResponse.json({ added: true }, { status: 201 })
  } catch (error: any) {
    console.error('Failed to add item to list:', error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: listId } = await params
    const { env } = await getCloudflareContext({ async: true })
    const userId = await getUserId(req, env)
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const db = getDB({ DB: (env as any)?.DB })
    const list = await getListOwnership(db, listId, userId)
    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    let body: { tmdbId?: number; mediaType?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { tmdbId, mediaType } = body
    if (!tmdbId) {
      return NextResponse.json({ error: 'Missing tmdbId' }, { status: 400 })
    }

    const conditions: any[] = [
      eq(schema.watchlistItems.listId, listId),
      eq(schema.watchlistItems.tmdbId, tmdbId),
    ]
    if (mediaType) {
      conditions.push(eq(schema.watchlistItems.mediaType, mediaType))
    }

    await db
      .delete(schema.watchlistItems)
      .where(and(...conditions))
      .run()

    return NextResponse.json({ removed: true })
  } catch (error: any) {
    console.error('Failed to remove item from list:', error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}
