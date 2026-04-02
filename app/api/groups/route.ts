import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth'
import { parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
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

export async function GET(req: NextRequest) {
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }

  const userId = await getAuthenticatedUser(req, dbEnv)
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const db = getDB(dbEnv)

  const memberships = await db
    .select()
    .from(schema.userGroupMembers)
    .innerJoin(schema.userGroups, eq(schema.userGroupMembers.groupId, schema.userGroups.id))
    .where(eq(schema.userGroupMembers.userId, userId))
    .all()

  const groups = await Promise.all(
    memberships.map(async (m) => {
      const members = await db
        .select()
        .from(schema.userGroupMembers)
        .where(eq(schema.userGroupMembers.groupId, m.user_groups.id))
        .all()
      return {
        id: m.user_groups.id,
        name: m.user_groups.name,
        createdAt: m.user_groups.createdAt,
        createdBy: m.user_groups.createdBy,
        memberCount: members.length,
      }
    })
  )

  return NextResponse.json({ groups })
}

export async function POST(req: NextRequest) {
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }

  const userId = await getAuthenticatedUser(req, dbEnv)
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { name } = await req.json()
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
  }

  const trimmedName = name.trim()
  if (trimmedName.length > 50) {
    return NextResponse.json({ error: 'Group name must be 50 characters or less' }, { status: 400 })
  }

  const sanitizedName = trimmedName.replace(/<[^>]*>/g, '')

  const db = getDB(dbEnv)
  const groupId = nanoid(16)

  await db.insert(schema.userGroups).values({
    id: groupId,
    name: sanitizedName,
    createdBy: userId,
  })

  await db.insert(schema.userGroupMembers).values({
    groupId,
    userId,
  })

  return NextResponse.json({ group: { id: groupId, name: sanitizedName } })
}
