import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth'
import { parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq, and, gt } from 'drizzle-orm'

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

  const { token } = await req.json()
  if (!token) {
    return NextResponse.json({ error: 'Invite token required' }, { status: 400 })
  }

  const db = getDB(dbEnv)

  const invite = await db
    .select()
    .from(schema.groupInvites)
    .where(and(eq(schema.groupInvites.token, token), eq(schema.groupInvites.groupId, groupId)))
    .get()

  if (!invite) {
    return NextResponse.json({ error: 'Invalid invite token' }, { status: 400 })
  }

  if (new Date() > invite.expiresAt) {
    return NextResponse.json({ error: 'Invite token has expired' }, { status: 400 })
  }

  const existingMember = await db
    .select()
    .from(schema.userGroupMembers)
    .where(and(eq(schema.userGroupMembers.groupId, groupId), eq(schema.userGroupMembers.userId, userId)))
    .get()

  if (existingMember) {
    return NextResponse.json({ error: 'Already a member of this group' }, { status: 400 })
  }

  await db.insert(schema.userGroupMembers).values({
    groupId,
    userId,
  })

  return NextResponse.json({ success: true })
}
