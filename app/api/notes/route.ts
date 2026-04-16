import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth'
import { parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url)
  const tmdbId = searchParams.get('tmdbId')
  const mediaType = searchParams.get('mediaType')

  if (!tmdbId || !mediaType) {
    return NextResponse.json({ error: 'Missing tmdbId or mediaType' }, { status: 400 })
  }

  const db = getDB(dbEnv)
  const note = await db
    .select()
    .from(schema.userNotes)
    .where(
      and(
        eq(schema.userNotes.userId, userId),
        eq(schema.userNotes.tmdbId, parseInt(tmdbId)),
        eq(schema.userNotes.mediaType, mediaType)
      )
    )
    .get()

  return NextResponse.json({ note: note || null })
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

    let body: { tmdbId?: number; mediaType?: string; note?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { tmdbId, mediaType, note } = body

    if (!tmdbId || !mediaType || note === undefined) {
      return NextResponse.json({ error: 'Missing tmdbId, mediaType, or note' }, { status: 400 })
    }

    const db = getDB(dbEnv)

    const existing = await db
      .select()
      .from(schema.userNotes)
      .where(
        and(
          eq(schema.userNotes.userId, userId),
          eq(schema.userNotes.tmdbId, tmdbId),
          eq(schema.userNotes.mediaType, mediaType)
        )
      )
      .get()

    if (existing) {
      await db
        .update(schema.userNotes)
        .set({ note, updatedAt: new Date() })
        .where(eq(schema.userNotes.id, existing.id))
        .run()
    } else {
      await db.insert(schema.userNotes).values({
        id: nanoid(),
        userId,
        tmdbId,
        mediaType,
        note,
      }).run()
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
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

    let body: { tmdbId?: number; mediaType?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { tmdbId, mediaType } = body

    if (!tmdbId || !mediaType) {
      return NextResponse.json({ error: 'Missing tmdbId or mediaType' }, { status: 400 })
    }

    const db = getDB(dbEnv)

    await db
      .delete(schema.userNotes)
      .where(
        and(
          eq(schema.userNotes.userId, userId),
          eq(schema.userNotes.tmdbId, tmdbId),
          eq(schema.userNotes.mediaType, mediaType)
        )
      )
      .run()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}
