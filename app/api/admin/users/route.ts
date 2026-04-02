import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getUserFromSession, parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await getUserFromSession(dbEnv, sessionId)
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = getDB(dbEnv)
  const users = await db.select().from(schema.users).all()

  return NextResponse.json({ users: users.map(u => ({
    id: u.id,
    username: u.username,
    createdAt: u.createdAt,
    countries: u.countries,
    hasApiKey: !!u.apiKey,
    isAdmin: u.isAdmin,
  })) })
}

export async function DELETE(req: NextRequest) {
  const { env } = getRequestContext()
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

  const { searchParams } = new URL(req.url)
  const targetUserId = searchParams.get('id')

  if (!targetUserId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 })
  }

  if (targetUserId === user.id) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
  }

  const db = getDB(dbEnv)

  await db.delete(schema.sessions).where(eq(schema.sessions.userId, targetUserId)).run()
  await db.delete(schema.userStreamingServices).where(eq(schema.userStreamingServices.userId, targetUserId)).run()
  await db.delete(schema.userGenres).where(eq(schema.userGenres.userId, targetUserId)).run()
  await db.delete(schema.userLikes).where(eq(schema.userLikes.userId, targetUserId)).run()
  await db.delete(schema.watchlist).where(eq(schema.watchlist.userId, targetUserId)).run()
  await db.delete(schema.watched).where(eq(schema.watched.userId, targetUserId)).run()
  await db.delete(schema.userGroupMembers).where(eq(schema.userGroupMembers.userId, targetUserId)).run()
  await db.delete(schema.users).where(eq(schema.users.id, targetUserId)).run()

  return NextResponse.json({ success: true })
}

export async function PUT(req: NextRequest) {
  const { env } = getRequestContext()
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

  try {
    const body = await req.json()
    const { userId, action, value } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const db = getDB(dbEnv)

    if (action === 'regenerateApiKey') {
      const newApiKey = nanoid(32)
      await db.update(schema.users).set({ apiKey: newApiKey }).where(eq(schema.users.id, userId)).run()
      return NextResponse.json({ apiKey: newApiKey })
    }

    if (action === 'setAdmin') {
      await db.update(schema.users).set({ isAdmin: value }).where(eq(schema.users.id, userId)).run()
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
