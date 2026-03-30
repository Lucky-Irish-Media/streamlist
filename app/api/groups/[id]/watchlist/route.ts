import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth'
import { parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { discoverMovies, discoverTVShows, getImageUrl } from '@/lib/tmdb'

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

  const userIds = members.map(m => m.userId)

  const allWatchlists: Map<string, { tmdbId: number; mediaType: string }[]> = new Map()
  const allLikes: Set<number> = new Set()
  const allWatched: Set<number> = new Set()
  const genreCounts: Map<number, number> = new Map()
  const serviceCounts: Map<string, number> = new Map()

  for (const uid of userIds) {
    const watchlist = await db
      .select()
      .from(schema.watchlist)
      .where(eq(schema.watchlist.userId, uid))
      .all()
    allWatchlists.set(uid, watchlist.map(w => ({ tmdbId: w.tmdbId, mediaType: w.mediaType })))

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
  }

  const threshold = Math.ceil(userIds.length * 0.5)

  const commonGenres: number[] = []
  genreCounts.forEach((count, genreId) => {
    if (count >= threshold) {
      commonGenres.push(genreId)
    }
  })

  const commonServices: string[] = []
  serviceCounts.forEach((count, serviceId) => {
    if (count >= threshold) {
      commonServices.push(serviceId)
    }
  })

  const watchlistArrays = Array.from(allWatchlists.values())
  const intersection: { tmdbId: number; mediaType: string }[] = []

  if (watchlistArrays.length > 0 && watchlistArrays[0].length > 0) {
    const firstList = watchlistArrays[0]
    for (const item of firstList) {
      const inAllLists = watchlistArrays.every(list =>
        list.some(w => w.tmdbId === item.tmdbId && w.mediaType === item.mediaType)
      )
      if (inAllLists && !allWatched.has(item.tmdbId)) {
        intersection.push(item)
      }
    }
  }

  const excludedIds = new Set<number>()
  allLikes.forEach(id => excludedIds.add(id))
  allWatched.forEach(id => excludedIds.add(id))
  allWatchlists.forEach(list => {
    list.forEach(w => excludedIds.add(w.tmdbId))
  })

  const recommendations: any[] = []

  if (commonGenres.length > 0 || commonServices.length > 0) {
    const genreStr = commonGenres.join(',')
    const serviceStr = commonServices.join(',')

    const fetchPromises: Promise<any>[] = []

    if (commonGenres.length > 0) {
      fetchPromises.push(
        discoverMovies({
          with_genres: genreStr,
          sort_by: 'popularity.desc',
          page: String(Math.floor(Math.random() * 5) + 1),
        })
      )
      fetchPromises.push(
        discoverTVShows({
          with_genres: genreStr,
          sort_by: 'popularity.desc',
          page: String(Math.floor(Math.random() * 5) + 1),
        })
      )
    }

    const settled = await Promise.allSettled(fetchPromises)

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        for (const item of result.value.results) {
          if (!excludedIds.has(item.id) && recommendations.length < 30) {
            const mediaType = item.title ? 'movie' : 'tv'
            recommendations.push({
              ...item,
              mediaType,
              image: getImageUrl(item.poster_path),
            })
            excludedIds.add(item.id)
          }
        }
      }
    }
  }

  return NextResponse.json({
    intersection,
    recommendations: recommendations.slice(0, 20),
    memberCount: members.length,
    threshold,
  })
}
