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

  const group = await db.select().from(schema.userGroups).where(eq(schema.userGroups.id, groupId)).get()
  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
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

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      createdAt: group.createdAt,
      createdBy: group.createdBy,
    },
    members: membersWithUserInfo,
  })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  if (group.createdBy !== userId) {
    return NextResponse.json({ error: 'Only the group creator can delete this group' }, { status: 403 })
  }

  await db.delete(schema.userGroupMembers).where(eq(schema.userGroupMembers.groupId, groupId)).run()
  await db.delete(schema.userGroups).where(eq(schema.userGroups.id, groupId)).run()
  await db.delete(schema.groupInvites).where(eq(schema.groupInvites.groupId, groupId)).run()

  return NextResponse.json({ success: true })
}
