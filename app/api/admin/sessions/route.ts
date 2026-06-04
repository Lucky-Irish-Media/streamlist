import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getUserFromSession, parseAuthCookie, deleteSession } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq, desc, gt, and, or, isNull } from 'drizzle-orm'

export const runtime = 'edge'

async function getAdminUser(req: NextRequest) {
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }

  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }
  if (!sessionId) return null

  const user = await getUserFromSession(dbEnv, sessionId)
  if (!user || !user.isAdmin) return null

  return { user, dbEnv }
}

export async function GET(req: NextRequest) {
  const admin = await getAdminUser(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { dbEnv } = admin
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')
  const userId = searchParams.get('userId')
  const status = searchParams.get('status')

  const db = getDB(dbEnv)

  let conditions = []
  if (userId) {
    conditions.push(eq(schema.sessions.userId, userId))
  }
  if (status === 'active') {
    conditions.push(and(gt(schema.sessions.expiresAt, new Date()), isNull(schema.sessions.endedAt)))
  } else if (status === 'expired') {
    conditions.push(or(gt(schema.sessions.expiresAt, new Date()), isNull(schema.sessions.endedAt)))
  }

  const query = db
    .select()
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .orderBy(desc(schema.sessions.expiresAt))
    .limit(limit)
    .offset(offset)

  const sessions = conditions.length > 0
    ? await query.where(and(...conditions)).all()
    : await query.all()

  const sessionsWithUser = sessions.map(s => ({
    id: s.sessions.id,
    userId: s.sessions.userId,
    username: s.users.username,
    expiresAt: s.sessions.expiresAt,
    ipAddress: s.sessions.ipAddress,
    userAgent: s.sessions.userAgent,
    endedAt: s.sessions.endedAt,
    isActive: s.sessions.expiresAt > new Date() && !s.sessions.endedAt,
  }))

  return NextResponse.json({ sessions: sessionsWithUser })
}

export async function DELETE(req: NextRequest) {
  const admin = await getAdminUser(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { dbEnv } = admin
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('id')
  const targetUserId = searchParams.get('userId')

  const db = getDB(dbEnv)

  if (sessionId) {
    await deleteSession(dbEnv, sessionId)
    return NextResponse.json({ success: true, deletedSession: sessionId })
  }

  if (targetUserId) {
    const result = await db
      .delete(schema.sessions)
      .where(eq(schema.sessions.userId, targetUserId))
      .run()
    return NextResponse.json({ success: true, deletedCount: result.meta.changes || 0 })
  }

  return NextResponse.json({ error: 'Provide id or userId parameter' }, { status: 400 })
}
