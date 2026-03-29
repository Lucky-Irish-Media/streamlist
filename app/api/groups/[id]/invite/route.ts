import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth'
import { parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export const runtime = 'edge'

async function getAuthenticatedUser(req: NextRequest, env: { DB?: any }) {
  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }
  if (!sessionId) return null
  return getSessionUser(env, sessionId)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }

  const userId = await getAuthenticatedUser(req, dbEnv)
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const db = getDB(dbEnv)

  const membership = await db
    .select()
    .from(schema.userGroupMembers)
    .where(and(eq(schema.userGroupMembers.groupId, groupId), eq(schema.userGroupMembers.userId, userId)))
    .get()

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
  }

  const group = await db.select().from(schema.userGroups).where(eq(schema.userGroups.id, groupId)).get()
  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  const token = nanoid(32)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await db.insert(schema.groupInvites).values({
    groupId,
    invitedBy: userId,
    token,
    expiresAt,
  })

  return NextResponse.json({
    inviteLink: `/groups/join?token=${token}`,
    expiresAt,
  })
}
