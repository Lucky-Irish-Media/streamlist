import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getUserFromSession, parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq, gt, count, isNotNull } from 'drizzle-orm'

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

  const totalUsers = await db.select({ count: count() }).from(schema.users).get()
  const usersWithApiKey = await db.select({ count: count() }).from(schema.users).where(isNotNull(schema.users.apiKey)).get()
  const activeSessions = await db.select({ count: count() }).from(schema.sessions).where(gt(schema.sessions.expiresAt, new Date())).get()

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const usersLast30Days = await db.select({ count: count() }).from(schema.users).where(gt(schema.users.createdAt, thirtyDaysAgo)).get()

  const totalGroups = await db.select({ count: count() }).from(schema.userGroups).get()

  const accessCodes = await db.select().from(schema.accessCodes).all()
  const activeAccessCodes = accessCodes.filter(c => c.isActive && (!c.expiresAt || c.expiresAt > now)).length

  return NextResponse.json({
    totalUsers: totalUsers?.count || 0,
    usersWithApiKey: usersWithApiKey?.count || 0,
    activeSessions: activeSessions?.count || 0,
    usersLast30Days: usersLast30Days?.count || 0,
    totalGroups: totalGroups?.count || 0,
    activeAccessCodes,
  })
}
