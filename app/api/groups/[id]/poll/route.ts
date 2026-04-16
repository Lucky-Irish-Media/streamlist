import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth'
import { parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq, and, desc } from 'drizzle-orm'
import { discoverMovies, discoverTVShows, getImageUrl, getTMDBConfig, type TMDBConfig } from '@/lib/tmdb'

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

  const poll = await db
    .select()
    .from(schema.groupPolls)
    .where(eq(schema.groupPolls.groupId, groupId))
    .orderBy(desc(schema.groupPolls.createdAt))
    .limit(1)
    .get()

  if (!poll) {
    return NextResponse.json({ poll: null, needsNewPoll: true })
  }

  const isClosed = poll.status === 'closed' || new Date(poll.closedAt) < new Date()

  if (isClosed && poll.status !== 'closed') {
    await db
      .update(schema.groupPolls)
      .set({ status: 'closed' })
      .where(eq(schema.groupPolls.id, poll.id))
    poll.status = 'closed'
  }

  if (poll.status === 'closed') {
    return NextResponse.json({ poll, needsNewPoll: true })
  }

  const votes = await db
    .select()
    .from(schema.groupPollVotes)
    .where(eq(schema.groupPollVotes.pollId, poll.id))
    .all()

  const userVote = votes.find(v => v.userId === userId)

  const candidates = JSON.parse(poll.candidates)
  const scores: Record<string, number> = {}
  candidates.forEach((c: any) => {
    scores[`${c.tmdbId}-${c.mediaType}`] = 0
  })

  votes.forEach(vote => {
    const rankings = JSON.parse(vote.rankings)
    for (let rank = 1; rank <= 5; rank++) {
      const key = `${rankings[rank].tmdbId}-${rankings[rank].mediaType}`
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
    poll: {
      ...poll,
      candidates: results,
      closedAt: poll.closedAt,
    },
    userVote: userVote ? JSON.parse(userVote.rankings) : null,
    totalVotes: votes.length,
    needsNewPoll: false,
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }
  const tmdb = getTMDBConfig(env as any)

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

  const body = await req.json() as { closedAt?: string; customCandidates?: unknown[] }
  const { closedAt, customCandidates } = body

  let candidates = customCandidates

  if (!candidates || candidates.length === 0) {
    const members = await db
      .select()
      .from(schema.userGroupMembers)
      .where(eq(schema.userGroupMembers.groupId, groupId))
      .all()

    const userIds = members.map(m => m.userId)
    const threshold = Math.ceil(userIds.length * 0.5)

    const genreCounts: Map<number, number> = new Map()
    const serviceCounts: Map<string, number> = new Map()
    const allLikes: Set<number> = new Set()
    const allWatched: Set<number> = new Set()
    const allWatchlist: Map<string, { tmdbId: number; mediaType: string }[]> = new Map()

    for (const uid of userIds) {
      const likes = await db.select().from(schema.userLikes).where(eq(schema.userLikes.userId, uid)).all()
      likes.forEach(l => allLikes.add(l.tmdbId))

      const watched = await db.select().from(schema.watched).where(eq(schema.watched.userId, uid)).all()
      watched.forEach(w => allWatched.add(w.tmdbId))

      const genres = await db.select().from(schema.userGenres).where(eq(schema.userGenres.userId, uid)).all()
      genres.forEach(g => {
        genreCounts.set(g.genreId, (genreCounts.get(g.genreId) || 0) + 1)
      })

      const services = await db
        .select()
        .from(schema.userStreamingServices)
        .where(eq(schema.userStreamingServices.userId, uid))
        .all()
      services.forEach(s => {
        serviceCounts.set(s.serviceId, (serviceCounts.get(s.serviceId) || 0) + 1)
      })

      const watchlist = await db
        .select()
        .from(schema.watchlist)
        .where(eq(schema.watchlist.userId, uid))
        .all()
      allWatchlist.set(uid, watchlist.map(w => ({ tmdbId: w.tmdbId, mediaType: w.mediaType })))
    }

    const commonGenres: number[] = []
    genreCounts.forEach((count, genreId) => {
      if (count >= threshold) commonGenres.push(genreId)
    })

    const commonServices: string[] = []
    serviceCounts.forEach((count, serviceId) => {
      if (count >= threshold) commonServices.push(serviceId)
    })

    const excludedIds = new Set<number>()
    allLikes.forEach(id => excludedIds.add(id))
    allWatched.forEach(id => excludedIds.add(id))
    allWatchlist.forEach(list => {
      list.forEach(w => excludedIds.add(w.tmdbId))
    })

    const recommendations: any[] = []

    if (commonGenres.length > 0 || commonServices.length > 0) {
      const genreStr = commonGenres.join(',')
      const fetchPromises: Promise<any>[] = []

      if (commonGenres.length > 0) {
        fetchPromises.push(
          discoverMovies({
            with_genres: genreStr,
            sort_by: 'popularity.desc',
            page: String(Math.floor(Math.random() * 5) + 1),
          }, tmdb)
        )
        fetchPromises.push(
          discoverTVShows({
            with_genres: genreStr,
            sort_by: 'popularity.desc',
            page: String(Math.floor(Math.random() * 5) + 1),
          }, tmdb)
        )
      }

      const settled = await Promise.allSettled(fetchPromises)

      for (const result of settled) {
        if (result.status === 'fulfilled') {
          for (const item of result.value.results) {
            if (!excludedIds.has(item.id) && recommendations.length < 30) {
              const mediaType = item.title ? 'movie' : 'tv'
              recommendations.push({
                tmdbId: item.id,
                mediaType,
                title: item.title || item.name,
                overview: item.overview,
                image: getImageUrl(item.poster_path),
                voteAverage: item.vote_average,
                releaseDate: item.release_date || item.first_air_date,
              })
              excludedIds.add(item.id)
            }
          }
        }
      }
    }

    candidates = recommendations.slice(0, 5)
  }

  const closeDate = new Date(closedAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))

  const { nanoid } = await import('nanoid')

  const [poll] = await db
    .insert(schema.groupPolls)
    .values({
      id: nanoid(16),
      groupId,
      status: 'active',
      closedAt: closeDate,
      candidates: JSON.stringify(candidates),
    })
    .returning()

  return NextResponse.json({ poll, needsNewPoll: false })
}
