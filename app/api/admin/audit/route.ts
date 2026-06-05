import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getUserFromSession, parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'


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
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')

  const db = getDB(dbEnv)
  const entries = await db
    .select()
    .from(schema.auditLog)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(limit)
    .offset(offset)
    .all()

  const entriesWithActor = await Promise.all(
    entries.map(async (entry) => {
      if (entry.actorId) {
        const actor = await db
          .select({ username: schema.users.username })
          .from(schema.users)
          .where(eq(schema.users.id, entry.actorId))
          .get()
        return { ...entry, actorUsername: actor?.username || 'Unknown' }
      }
      return { ...entry, actorUsername: 'System' }
    })
  )

  return NextResponse.json({ entries: entriesWithActor })
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { dbEnv, user } = admin
  const body = await req.json() as {
    action: string
    targetType?: string
    targetId?: string
    details?: string
  }

  if (!body.action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 })
  }

  const db = getDB(dbEnv)
  const id = nanoid(32)

  await db.insert(schema.auditLog).values({
    id,
    actorId: user.id,
    action: body.action,
    targetType: body.targetType,
    targetId: body.targetId,
    details: body.details,
  })

  return NextResponse.json({ success: true, id })
}
