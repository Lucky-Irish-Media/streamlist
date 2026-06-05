import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getUserFromSession, parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq, desc, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { logger } from '@/lib/logger'

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

    const user = await getUserFromSession(dbEnv, sessionId)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    let body: { type?: string; title?: string; description?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { type, title, description } = body

    if (!type || !['feature', 'bug', 'other'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type. Must be feature, bug, or other' }, { status: 400 })
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }

    const db = getDB(dbEnv)
    const id = nanoid(32)
    const now = new Date()

    await db.insert(schema.feedback).values({
      id,
      userId: user.id,
      type,
      title: title.trim(),
      description: description.trim(),
      status: 'open',
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({ success: true, id })
  } catch (error: any) {
    logger.error('Feedback POST error', {}, error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const dbEnv = { DB: (env as any)?.DB }

    let sessionId = parseAuthCookie(req.headers.get('cookie'))
    if (!sessionId) {
      sessionId = req.headers.get('x-session-id')
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserFromSession(dbEnv, sessionId)
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const db = getDB(dbEnv)
    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get('status')
    const typeFilter = searchParams.get('type')

    const conditions: any[] = []
    if (statusFilter) {
      conditions.push(eq(schema.feedback.status, statusFilter))
    }
    if (typeFilter) {
      conditions.push(eq(schema.feedback.type, typeFilter))
    }

    const baseQuery = db
      .select()
      .from(schema.feedback)
      .orderBy(desc(schema.feedback.createdAt))

    const items = conditions.length > 0
      ? await baseQuery.where(and(...conditions)).all()
      : await baseQuery.all()

    const itemsWithUser = await Promise.all(
      items.map(async (item) => {
        const feedbackUser = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, item.userId))
          .get()

        return {
          ...item,
          username: feedbackUser?.username || 'Unknown',
        }
      })
    )

    return NextResponse.json({ feedback: itemsWithUser })
  } catch (error: any) {
    logger.error('Feedback GET error', {}, error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const dbEnv = { DB: (env as any)?.DB }

    let sessionId = parseAuthCookie(req.headers.get('cookie'))
    if (!sessionId) {
      sessionId = req.headers.get('x-session-id')
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserFromSession(dbEnv, sessionId)
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: { id?: string; status?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { id, status } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing feedback id' }, { status: 400 })
    }

    if (!status || !['open', 'acknowledged', 'planned', 'completed', 'declined'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const db = getDB(dbEnv)
    await db
      .update(schema.feedback)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.feedback.id, id))
      .run()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('Feedback PUT error', {}, error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}
