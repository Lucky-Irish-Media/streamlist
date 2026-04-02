import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth'
import { parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq, and, desc } from 'drizzle-orm'

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

  const poll = await db
    .select()
    .from(schema.groupPolls)
    .where(eq(schema.groupPolls.groupId, groupId))
    .orderBy(desc(schema.groupPolls.createdAt))
    .limit(1)
    .get()

  if (!poll) {
    return NextResponse.json({ error: 'No active poll' }, { status: 404 })
  }

  if (poll.status === 'closed' || new Date(poll.closedAt) < new Date()) {
    return NextResponse.json({ error: 'Poll is closed' }, { status: 400 })
  }

  const body = await req.json()
  const { rankings } = body

  if (!rankings || typeof rankings !== 'object') {
    return NextResponse.json({ error: 'Rankings required' }, { status: 400 })
  }

  const existingVote = await db
    .select()
    .from(schema.groupPollVotes)
    .where(and(eq(schema.groupPollVotes.pollId, poll.id), eq(schema.groupPollVotes.userId, userId)))
    .get()

  if (existingVote) {
    await db
      .update(schema.groupPollVotes)
      .set({ rankings: JSON.stringify(rankings) })
      .where(eq(schema.groupPollVotes.id, existingVote.id))
  } else {
    const { nanoid } = await import('nanoid')
    await db
      .insert(schema.groupPollVotes)
      .values({
        id: nanoid(16),
        pollId: poll.id,
        userId,
        rankings: JSON.stringify(rankings),
      })
  }

  const votes = await db
    .select()
    .from(schema.groupPollVotes)
    .where(eq(schema.groupPollVotes.pollId, poll.id))
    .all()

  const candidates = JSON.parse(poll.candidates)
  const scores: Record<string, number> = {}
  candidates.forEach((c: any) => {
    scores[`${c.tmdbId}-${c.mediaType}`] = 0
  })

  votes.forEach(vote => {
    const voteRankings = JSON.parse(vote.rankings)
    for (let rank = 1; rank <= 5; rank++) {
      const key = `${voteRankings[rank].tmdbId}-${voteRankings[rank].mediaType}`
      if (scores[key] !== undefined) {
        scores[key] += (6 - rank)
      }
    }
  })

  const results = candidates.map((c: any) => ({
    ...c,
    score: scores[`${c.tmdbId}-${c.mediaType}`] || 0,
  })).sort((a: any, b: any) => b.score - a.score)

  return NextResponse.json({
    success: true,
    rankings,
    results,
    totalVotes: votes.length,
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

  const poll = await db
    .select()
    .from(schema.groupPolls)
    .where(eq(schema.groupPolls.groupId, groupId))
    .orderBy(desc(schema.groupPolls.createdAt))
    .limit(1)
    .get()

  if (!poll) {
    return NextResponse.json({ error: 'No poll found' }, { status: 404 })
  }

  await db
    .delete(schema.groupPollVotes)
    .where(and(eq(schema.groupPollVotes.pollId, poll.id), eq(schema.groupPollVotes.userId, userId)))

  return NextResponse.json({ success: true })
}
