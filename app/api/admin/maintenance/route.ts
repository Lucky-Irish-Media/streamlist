import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getUserFromSession, parseAuthCookie, cleanupOldSessions, cleanupOldLoginAttempts } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { count } from 'drizzle-orm'


async function getAdminUser(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
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
  const action = searchParams.get('action')

  if (action === 'health') {
    const db = getDB(dbEnv)
    const tableNames = ['users', 'sessions', 'loginAttempts', 'watchlist', 'userLikes', 'userGroups', 'accessCodes', 'auditLog']

    const counts: Record<string, number> = {}
    for (const table of tableNames) {
      const result = await db.select({ count: count() }).from((schema as any)[table]).get()
      counts[table] = result?.count || 0
    }

    return NextResponse.json({ counts })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { dbEnv } = admin
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action === 'cleanup-sessions') {
    const deleted = await cleanupOldSessions(dbEnv, 90)
    return NextResponse.json({ success: true, deletedSessions: deleted })
  }

  if (action === 'cleanup-attempts') {
    const deleted = await cleanupOldLoginAttempts(dbEnv, 90)
    return NextResponse.json({ success: true, deletedAttempts: deleted })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
