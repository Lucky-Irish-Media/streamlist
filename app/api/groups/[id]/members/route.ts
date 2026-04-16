import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth'
import { parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'

export const runtime = 'edge'

async function getAuthenticatedUser(req: NextRequest, env: { DB?: any }) {
  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }
  if (!sessionId) return null
  return getSessionUser(env, sessionId)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const members = await db
    .select()
    .from(schema.userGroupMembers)
    .where(eq(schema.userGroupMembers.groupId, groupId))
    .all()

  const membersWithUserInfo = await Promise.all(
    members.map(async (m) => {
      const user = await db.select().from(schema.users).where(eq(schema.users.id, m.userId)).get()
      return {
        id: m.id,
        userId: m.userId,
        username: user?.username || 'Unknown',
        joinedAt: m.joinedAt,
      }
    })
  )

  return NextResponse.json({ members: membersWithUserInfo })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }

  const userId = await getAuthenticatedUser(req, dbEnv)
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { memberId } = await req.json() as { memberId?: number }
  if (!memberId) {
    return NextResponse.json({ error: 'Member ID required' }, { status: 400 })
  }

  const db = getDB(dbEnv)

  const requesterMembership = await db
    .select()
    .from(schema.userGroupMembers)
    .where(and(eq(schema.userGroupMembers.groupId, groupId), eq(schema.userGroupMembers.userId, userId)))
    .get()

  if (!requesterMembership) {
    return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
  }

  const targetMember = await db
    .select()
    .from(schema.userGroupMembers)
    .where(eq(schema.userGroupMembers.id, memberId))
    .get()

  if (!targetMember || targetMember.groupId !== groupId) {
    return NextResponse.json({ error: 'Member not found in this group' }, { status: 404 })
  }

  await db.delete(schema.userGroupMembers).where(eq(schema.userGroupMembers.id, memberId)).run()

  const remainingMembers = await db
    .select()
    .from(schema.userGroupMembers)
    .where(eq(schema.userGroupMembers.groupId, groupId))
    .all()

  if (remainingMembers.length === 0) {
    await db.delete(schema.userGroups).where(eq(schema.userGroups.id, groupId)).run()
    await db.delete(schema.groupInvites).where(eq(schema.groupInvites.groupId, groupId)).run()
  }

  return NextResponse.json({ success: true })
}
