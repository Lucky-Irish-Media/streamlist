import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getUserFromSession, parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq, desc, count, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { logAuditEvent } from '@/lib/audit'


export async function GET(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
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

  const usersWithDetails = await Promise.all(users.map(async (u) => {
    const [sessionCount, loginAttemptsCount, lastLogin, watchlistCount] = await Promise.all([
      db.select({ count: count() }).from(schema.sessions).where(eq(schema.sessions.userId, u.id)).get(),
      db.select({ count: count() }).from(schema.loginAttempts).where(eq(schema.loginAttempts.username, u.username)).get(),
      db.select().from(schema.loginAttempts).where(eq(schema.loginAttempts.username, u.username)).orderBy(desc(schema.loginAttempts.createdAt)).limit(1).get(),
      db.select({ count: count() }).from(schema.watchlistItems)
        .innerJoin(schema.watchlists, eq(schema.watchlistItems.listId, schema.watchlists.id))
        .where(eq(schema.watchlists.userId, u.id)).get(),
    ])

    return {
      id: u.id,
      username: u.username,
      createdAt: u.createdAt,
      countries: u.countries,
      hasApiKey: !!u.apiKey,
      isAdmin: u.isAdmin,
      sessionCount: sessionCount?.count || 0,
      loginCount: loginAttemptsCount?.count || 0,
      lastLogin: lastLogin?.createdAt || null,
      watchlistCount: watchlistCount?.count || 0,
    }
  }))

  return NextResponse.json({ users: usersWithDetails })
}

export async function DELETE(req: NextRequest) {
  try {
    const { env } = await getCloudflareContext({ async: true })
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

    await db.delete(schema.episodesWatched).where(eq(schema.episodesWatched.userId, targetUserId)).run()
    await db.delete(schema.userNotes).where(eq(schema.userNotes.userId, targetUserId)).run()
    await db.delete(schema.dismissedRecommendations).where(eq(schema.dismissedRecommendations.userId, targetUserId)).run()
    await db.delete(schema.feedback).where(eq(schema.feedback.userId, targetUserId)).run()
    await db.delete(schema.groupPollVotes).where(eq(schema.groupPollVotes.userId, targetUserId)).run()

    const userCreatedGroups = await db.select({ id: schema.userGroups.id }).from(schema.userGroups).where(eq(schema.userGroups.createdBy, targetUserId)).all()
    if (userCreatedGroups.length > 0) {
      const groupIds = userCreatedGroups.map(g => g.id)
      const polls = await db.select({ id: schema.groupPolls.id }).from(schema.groupPolls).where(inArray(schema.groupPolls.groupId, groupIds)).all()
      if (polls.length > 0) {
        const pollIds = polls.map(p => p.id)
        await db.delete(schema.groupPollVotes).where(inArray(schema.groupPollVotes.pollId, pollIds)).run()
        await db.delete(schema.groupPolls).where(inArray(schema.groupPolls.id, pollIds)).run()
      }
      await db.delete(schema.groupInvites).where(inArray(schema.groupInvites.groupId, groupIds)).run()
      await db.delete(schema.userGroupMembers).where(inArray(schema.userGroupMembers.groupId, groupIds)).run()
      await db.delete(schema.userGroups).where(inArray(schema.userGroups.id, groupIds)).run()
    }

    await db.delete(schema.groupInvites).where(eq(schema.groupInvites.invitedBy, targetUserId)).run()

    await db.update(schema.accessCodes).set({ createdBy: null }).where(eq(schema.accessCodes.createdBy, targetUserId)).run()

    await db.delete(schema.sessions).where(eq(schema.sessions.userId, targetUserId)).run()
    await db.delete(schema.userStreamingServices).where(eq(schema.userStreamingServices.userId, targetUserId)).run()
    await db.delete(schema.userGenres).where(eq(schema.userGenres.userId, targetUserId)).run()
    await db.delete(schema.userLikes).where(eq(schema.userLikes.userId, targetUserId)).run()
    const userLists = await db
      .select({ id: schema.watchlists.id })
      .from(schema.watchlists)
      .where(eq(schema.watchlists.userId, targetUserId))
      .all()
    for (const l of userLists) {
      await db.delete(schema.watchlistItems).where(eq(schema.watchlistItems.listId, l.id)).run()
    }
    await db.delete(schema.watchlists).where(eq(schema.watchlists.userId, targetUserId)).run()
    await db.delete(schema.watchlist).where(eq(schema.watchlist.userId, targetUserId)).run()
    await db.delete(schema.watched).where(eq(schema.watched.userId, targetUserId)).run()
    await db.delete(schema.userGroupMembers).where(eq(schema.userGroupMembers.userId, targetUserId)).run()
    await db.delete(schema.users).where(eq(schema.users.id, targetUserId)).run()

    await logAuditEvent(dbEnv, user.id, 'user_deleted', 'user', targetUserId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete user' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
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
    const body = await req.json() as { userId?: string; action?: string; value?: unknown }
    const { userId, action, value } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const db = getDB(dbEnv)

    if (action === 'regenerateApiKey') {
      const newApiKey = nanoid(32)
      await db.update(schema.users).set({ apiKey: newApiKey }).where(eq(schema.users.id, userId)).run()
      await logAuditEvent(dbEnv, user.id, 'api_key_regenerated', 'user', userId)
      return NextResponse.json({ apiKey: newApiKey })
    }

    if (action === 'setAdmin') {
      await db.update(schema.users).set({ isAdmin: Boolean(value) }).where(eq(schema.users.id, userId)).run()
      await logAuditEvent(dbEnv, user.id, `admin_${value ? 'promoted' : 'demoted'}`, 'user', userId)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
