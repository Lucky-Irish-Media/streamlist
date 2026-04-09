import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { eq, and } from 'drizzle-orm'
import { getDB, schema, type DB } from '@/lib/db'
import {
  searchMulti,
  getMovieDetails,
  getTVDetails,
  getTrending,
  getMovieWatchProviders,
  getTVWatchProviders,
  getMovieRecommendations,
  getTVRecommendations,
  getMovieSimilar,
  getTVSimilar,
  getMovieReleaseDates,
  getTVContentRatings,
  getImageUrl,
  getTMDBConfig,
  type TMDBConfig,
  STREAMING_SERVICES,
  TMDB_GENRES,
} from '@/lib/tmdb'

async function getCertification(mediaType: string, id: number, country: string, tmdb: TMDBConfig) {
  try {
    if (mediaType === 'movie') {
      const releaseDates = await getMovieReleaseDates(id, tmdb)
      const countryData = releaseDates.results.find(r => r.iso_3166_1 === country)
      if (countryData?.release_dates?.[0]?.certification) {
        return countryData.release_dates[0].certification
      }
      const usData = releaseDates.results.find(r => r.iso_3166_1 === 'US')
      return usData?.release_dates?.[0]?.certification || null
    } else {
      const contentRatings = await getTVContentRatings(id, tmdb)
      const countryData = contentRatings.results.find(r => r.iso_3166_1 === country)
      if (countryData?.rating) {
        return countryData.rating
      }
      const usData = contentRatings.results.find(r => r.iso_3166_1 === 'US')
      return usData?.rating || null
    }
  } catch {
    return null
  }
}

export const runtime = 'edge'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-api-key',
}

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number | null
  method: string
  params?: Record<string, unknown>
}

function createSSEStream(data: string, event: string = 'message'): ReadableStream {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`))
      controller.close()
    },
  })
}

async function getUserByApiKey(db: DB, apiKey: string): Promise<string | null> {
  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.apiKey, apiKey))
    .get()
  return user?.id ?? null
}

async function getUserPreferences(db: DB, userId: string) {
  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get()

  const streamingServices = await db
    .select()
    .from(schema.userStreamingServices)
    .where(eq(schema.userStreamingServices.userId, userId))
    .all()

  const genres = await db
    .select()
    .from(schema.userGenres)
    .where(eq(schema.userGenres.userId, userId))
    .all()

  const likes = await db
    .select()
    .from(schema.userLikes)
    .where(eq(schema.userLikes.userId, userId))
    .all()

  const watchlistItems = await db
    .select()
    .from(schema.watchlist)
    .where(eq(schema.watchlist.userId, userId))
    .all()

  const countries = user?.countries ? JSON.parse(user.countries) : ['US']

  return {
    countries,
    streamingServices: streamingServices.map(s => s.serviceId),
    genres: genres.map(g => g.genreId),
    likes: likes.map(l => ({ tmdbId: l.tmdbId, mediaType: l.mediaType, title: l.title })),
    watchlist: watchlistItems.map(w => ({ tmdbId: w.tmdbId, mediaType: w.mediaType })),
  }
}

async function handleTool(db: DB, userId: string, toolName: string, args?: Record<string, unknown>, tmdb?: TMDBConfig) {
  switch (toolName) {
    case 'get_watchlist': {
      const items = await db
        .select()
        .from(schema.watchlist)
        .where(eq(schema.watchlist.userId, userId))
        .all()
      return items
    }
    case 'add_to_watchlist': {
      const { tmdb_id, media_type } = args as { tmdb_id: number; media_type: string }
      const existing = await db
        .select()
        .from(schema.watchlist)
        .where(
          and(
            eq(schema.watchlist.userId, userId),
            eq(schema.watchlist.tmdbId, tmdb_id)
          )
        )
        .get()
      if (existing) {
        return { success: false, message: 'Already in watchlist' }
      }
      await db.insert(schema.watchlist).values({
        userId,
        tmdbId: tmdb_id,
        mediaType: media_type,
      }).run()
      return { success: true, message: 'Added to watchlist' }
    }
    case 'remove_from_watchlist': {
      const { tmdb_id } = args as { tmdb_id: number }
      await db
        .delete(schema.watchlist)
        .where(
          and(
            eq(schema.watchlist.userId, userId),
            eq(schema.watchlist.tmdbId, tmdb_id)
          )
        )
        .run()
      return { success: true, message: 'Removed from watchlist' }
    }
    case 'get_preferences': {
      const user = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .get()
      if (!user) {
        return { error: 'User not found' }
      }
      const streamingServices = await db
        .select()
        .from(schema.userStreamingServices)
        .where(eq(schema.userStreamingServices.userId, userId))
        .all()
      const genres = await db
        .select()
        .from(schema.userGenres)
        .where(eq(schema.userGenres.userId, userId))
        .all()
      const likes = await db
        .select()
        .from(schema.userLikes)
        .where(eq(schema.userLikes.userId, userId))
        .all()
      const watchlist = await db
        .select()
        .from(schema.watchlist)
        .where(eq(schema.watchlist.userId, userId))
        .all()
      return {
        streamingServices: streamingServices.map(s => ({ id: s.serviceId, name: s.serviceName })),
        genres: genres.map(g => g.genreId),
        likes: likes.map(l => ({ tmdbId: l.tmdbId, mediaType: l.mediaType, title: l.title })),
        watchlist: watchlist.map(w => ({ tmdbId: w.tmdbId, mediaType: w.mediaType })),
        countries: user.countries ? JSON.parse(user.countries) : ['US'],
      }
    }
    case 'update_streaming_services': {
      const { services } = args as { services: { id: string; name: string }[] }
      await db
        .delete(schema.userStreamingServices)
        .where(eq(schema.userStreamingServices.userId, userId))
        .run()
      if (services.length > 0) {
        await db
          .insert(schema.userStreamingServices)
          .values(services.map(service => ({ userId, serviceId: service.id, serviceName: service.name })))
          .run()
      }
      return { success: true, message: 'Streaming services updated' }
    }
    case 'update_genres': {
      const { genres } = args as { genres: number[] }
      await db
        .delete(schema.userGenres)
        .where(eq(schema.userGenres.userId, userId))
        .run()
      if (genres.length > 0) {
        await db
          .insert(schema.userGenres)
          .values(genres.map(genreId => ({ userId, genreId })))
          .run()
      }
      return { success: true, message: 'Genres updated' }
    }
    case 'update_country': {
      const { countries } = args as { countries: string[] }
      await db
        .update(schema.users)
        .set({ countries: JSON.stringify(countries) })
        .where(eq(schema.users.id, userId))
        .run()
      return { success: true, message: 'Countries updated' }
    }
    case 'add_like': {
      const { tmdb_id, media_type, title } = args as { tmdb_id: number; media_type: string; title: string }
      const existing = await db
        .select()
        .from(schema.userLikes)
        .where(
          and(
            eq(schema.userLikes.userId, userId),
            eq(schema.userLikes.tmdbId, tmdb_id)
          )
        )
        .get()
      if (existing) {
        return { success: false, message: 'Already in likes' }
      }
      await db.insert(schema.userLikes).values({
        userId,
        tmdbId: tmdb_id,
        mediaType: media_type,
        title,
      }).run()
      return { success: true, message: 'Added to likes' }
    }
    case 'remove_like': {
      const { tmdb_id } = args as { tmdb_id: number }
      await db
        .delete(schema.userLikes)
        .where(
          and(
            eq(schema.userLikes.userId, userId),
            eq(schema.userLikes.tmdbId, tmdb_id)
          )
        )
        .run()
      return { success: true, message: 'Removed from likes' }
    }
    case 'get_watch_history': {
      const items = await db
        .select()
        .from(schema.watched)
        .where(eq(schema.watched.userId, userId))
        .all()
      return items
    }
    case 'mark_as_watched': {
      const { tmdb_id, media_type, title } = args as { tmdb_id: number; media_type: string; title: string }
      const existing = await db
        .select()
        .from(schema.watched)
        .where(
          and(
            eq(schema.watched.userId, userId),
            eq(schema.watched.tmdbId, tmdb_id)
          )
        )
        .get()
      if (existing) {
        return { success: false, message: 'Already in watch history' }
      }
      await db.insert(schema.watched).values({
        userId,
        tmdbId: tmdb_id,
        mediaType: media_type,
        title,
      }).run()
      return { success: true, message: 'Marked as watched' }
    }
    case 'remove_from_watch_history': {
      const { tmdb_id } = args as { tmdb_id: number }
      await db
        .delete(schema.watched)
        .where(
          and(
            eq(schema.watched.userId, userId),
            eq(schema.watched.tmdbId, tmdb_id)
          )
        )
        .run()
      return { success: true, message: 'Removed from watch history' }
    }
    case 'search_media': {
      const { query, page = 1 } = args as { query: string; page?: number }
      const results = await searchMulti(query, page, tmdb)
      return results.results
        .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
        .slice(0, 20)
        .map((r: any) => ({
          id: r.id,
          title: r.title || r.name,
          mediaType: r.media_type,
          overview: r.overview,
          posterPath: r.poster_path,
          backdropPath: r.backdrop_path,
          voteAverage: r.vote_average,
          releaseDate: r.release_date || r.first_air_date,
        }))
    }
    case 'get_media_details': {
      const { tmdb_id, media_type } = args as { tmdb_id: number; media_type: string }
      const prefs = await getUserPreferences(db, userId)
      const certification = await getCertification(media_type, tmdb_id, prefs.countries[0], tmdb!)
      if (media_type === 'movie') {
        const details = await getMovieDetails(tmdb_id, tmdb)
        return {
          id: details.id,
          title: details.title,
          mediaType: 'movie',
          overview: details.overview,
          posterPath: details.poster_path,
          backdropPath: details.backdrop_path,
          voteAverage: details.vote_average,
          releaseDate: details.release_date,
          genres: details.genres,
          certification: certification || 'NA',
        }
      } else {
        const details = await getTVDetails(tmdb_id, tmdb)
        return {
          id: details.id,
          title: details.name,
          mediaType: 'tv',
          overview: details.overview,
          posterPath: details.poster_path,
          backdropPath: details.backdrop_path,
          voteAverage: details.vote_average,
          releaseDate: details.first_air_date,
          genres: details.genres,
          certification: certification || 'NA',
        }
      }
    }
    case 'get_trending': {
      const { media_type = 'all', page = 1 } = args as { media_type?: string; page?: number }
      const results = await getTrending(media_type as 'all' | 'movie' | 'tv', page, tmdb)
      return results.results.map((r: any) => ({
        id: r.id,
        title: r.title || r.name,
        mediaType: r.media_type || media_type,
        overview: r.overview,
        posterPath: r.poster_path,
        backdropPath: r.backdrop_path,
        voteAverage: r.vote_average,
        releaseDate: r.release_date || r.first_air_date,
      }))
    }
    case 'get_recommendations': {
      const prefs = await getUserPreferences(db, userId)
      const excludeIds = new Set([
        ...prefs.likes.map((l: any) => l.tmdbId),
        ...prefs.watchlist.map((w: any) => w.tmdbId),
      ])

      let recommendations: any[] = []

      if (prefs.likes.length > 0) {
        const likeBatches = prefs.likes.slice(0, 3)
        const fetchPromises: Array<{ promise: Promise<any>; mediaType: string }> = []

        for (const like of likeBatches) {
          if (like.mediaType === 'movie') {
            fetchPromises.push({ promise: getMovieRecommendations(like.tmdbId, 1, tmdb), mediaType: 'movie' })
            fetchPromises.push({ promise: getMovieSimilar(like.tmdbId, 1, tmdb), mediaType: 'movie' })
          } else {
            fetchPromises.push({ promise: getTVRecommendations(like.tmdbId, 1, tmdb), mediaType: 'tv' })
            fetchPromises.push({ promise: getTVSimilar(like.tmdbId, 1, tmdb), mediaType: 'tv' })
          }
        }

        const settled = await Promise.allSettled(fetchPromises.map(fp => fp.promise))
        const pool: any[] = []

        for (let i = 0; i < settled.length; i++) {
          const result = settled[i]
          const mediaType = fetchPromises[i].mediaType
          if (result.status === 'fulfilled') {
            for (const item of result.value.results) {
              if (!excludeIds.has(item.id)) {
                pool.push({ ...item, mediaType })
              }
            }
          }
        }

        const deduped = new Map<number, any>()
        for (const item of pool) {
          if (!deduped.has(item.id)) {
            deduped.set(item.id, item)
          }
        }
        const shuffled = Array.from(deduped.values()).sort(() => Math.random() - 0.5)
        recommendations = shuffled.slice(0, 10)
      }

      if (recommendations.length < 10 && prefs.genres.length > 0) {
        const genreStr = prefs.genres.join(',')
        const randomPage = String(Math.floor(Math.random() * 5) + 1)

        const [movieRecs, tvRecs] = await Promise.all([
          (await import('@/lib/tmdb')).discoverMovies({ with_genres: genreStr, sort_by: 'popularity.desc', page: randomPage }, tmdb),
          (await import('@/lib/tmdb')).discoverTVShows({ with_genres: genreStr, sort_by: 'popularity.desc', page: randomPage }, tmdb),
        ])

        const existingIds = new Set(recommendations.map((r: any) => r.id))
        for (const item of movieRecs.results) {
          if (recommendations.length >= 20) break
          if (!excludeIds.has(item.id) && !existingIds.has(item.id)) {
            recommendations.push({ ...item, mediaType: 'movie' })
          }
        }
        for (const item of tvRecs.results) {
          if (recommendations.length >= 20) break
          if (!excludeIds.has(item.id) && !existingIds.has(item.id)) {
            recommendations.push({ ...item, mediaType: 'tv' })
          }
        }
      }

      return recommendations.map((r: any) => ({
        id: r.id,
        title: r.title || r.name,
        mediaType: r.mediaType,
        overview: r.overview,
        posterPath: r.poster_path,
        voteAverage: r.vote_average,
        releaseDate: r.release_date || r.first_air_date,
      }))
    }
    case 'get_watch_providers': {
      const { tmdb_id, media_type } = args as { tmdb_id: number; media_type: string }
      const prefs = await getUserPreferences(db, userId)
      
      let providers: any
      if (media_type === 'movie') {
        providers = await getMovieWatchProviders(tmdb_id, tmdb)
      } else {
        providers = await getTVWatchProviders(tmdb_id, tmdb)
      }

      const providerMap = new Map<number, { id: number; name: string; logoPath: string; regions: string[] }>()

      for (const country of prefs.countries) {
        const countryProviders = providers.results?.[country]
        if (countryProviders?.flatrate) {
          for (const p of countryProviders.flatrate) {
            if (providerMap.has(p.provider_id)) {
              providerMap.get(p.provider_id)!.regions.push(country)
            } else {
              providerMap.set(p.provider_id, {
                id: p.provider_id,
                name: p.provider_name,
                logoPath: p.logo_path,
                regions: [country],
              })
            }
          }
        }
      }

      const providerList = Array.from(providerMap.values())

      if (providerList.length === 0) {
        return { providers: [], message: `No streaming providers found in your selected regions: ${prefs.countries.join(', ')}` }
      }

      return {
        providers: providerList,
      }
    }
    case 'list_groups': {
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

      return { groups }
    }
    case 'create_group': {
      const { name } = args as { name: string }
      const { nanoid } = await import('nanoid')

      const groupId = nanoid(16)

      await db.insert(schema.userGroups).values({
        id: groupId,
        name,
        createdBy: userId,
      }).run()

      await db.insert(schema.userGroupMembers).values({
        groupId,
        userId,
      }).run()

      return { success: true, group: { id: groupId, name } }
    }
    case 'get_group_watchlist': {
      const { group_id } = args as { group_id: string }

      const membership = await db
        .select()
        .from(schema.userGroupMembers)
        .where(and(eq(schema.userGroupMembers.groupId, group_id), eq(schema.userGroupMembers.userId, userId)))
        .get()

      if (!membership) {
        return { error: 'Not a member of this group' }
      }

      const members = await db
        .select()
        .from(schema.userGroupMembers)
        .where(eq(schema.userGroupMembers.groupId, group_id))
        .all()

      const userIds = members.map(m => m.userId)
      const threshold = Math.ceil(userIds.length * 0.5)

      const allWatchlists: Map<string, { tmdbId: number; mediaType: string }[]> = new Map()
      const excludedIds: Set<number> = new Set()
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
        likes.forEach(l => excludedIds.add(l.tmdbId))

        const watched = await db.select().from(schema.watched).where(eq(schema.watched.userId, uid)).all()
        watched.forEach(w => excludedIds.add(w.tmdbId))

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

      const commonGenres: number[] = []
      genreCounts.forEach((count, genreId) => {
        if (count >= threshold) commonGenres.push(genreId)
      })

      const watchlistArrays = Array.from(allWatchlists.values())
      const intersection: { tmdbId: number; mediaType: string }[] = []

      if (watchlistArrays.length > 0 && watchlistArrays[0].length > 0) {
        for (const item of watchlistArrays[0]) {
          const inAllLists = watchlistArrays.every(list =>
            list.some(w => w.tmdbId === item.tmdbId && w.mediaType === item.mediaType)
          )
          if (inAllLists) {
            intersection.push(item)
            excludedIds.add(item.tmdbId)
          }
        }
      }

      return {
        intersection,
        commonGenres,
        memberCount: members.length,
        threshold,
      }
    }
    case 'create_group_invite': {
      const { group_id } = args as { group_id: string }

      const group = await db
        .select()
        .from(schema.userGroups)
        .where(eq(schema.userGroups.id, group_id))
        .get()

      if (!group) {
        return { error: 'Group not found' }
      }

      const membership = await db
        .select()
        .from(schema.userGroupMembers)
        .where(and(eq(schema.userGroupMembers.groupId, group_id), eq(schema.userGroupMembers.userId, userId)))
        .get()

      if (!membership) {
        return { error: 'Not a member of this group' }
      }

      const { nanoid } = await import('nanoid')
      const token = nanoid(32)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      await db.insert(schema.groupInvites).values({
        groupId: group_id,
        invitedBy: userId,
        token,
        expiresAt,
      }).run()

      return { success: true, token, expiresAt: expiresAt.toISOString() }
    }
    case 'join_group': {
      const { token } = args as { token: string }

      const invite = await db
        .select()
        .from(schema.groupInvites)
        .where(eq(schema.groupInvites.token, token))
        .get()

      if (!invite) {
        return { error: 'Invalid invite token' }
      }

      if (invite.expiresAt < new Date()) {
        return { error: 'Invite token has expired' }
      }

      const existingMember = await db
        .select()
        .from(schema.userGroupMembers)
        .where(and(eq(schema.userGroupMembers.groupId, invite.groupId), eq(schema.userGroupMembers.userId, userId)))
        .get()

      if (existingMember) {
        return { error: 'Already a member of this group' }
      }

      await db.insert(schema.userGroupMembers).values({
        groupId: invite.groupId,
        userId,
      }).run()

      return { success: true, message: 'Joined group successfully' }
    }
    case 'get_group_invites': {
      const { group_id } = args as { group_id: string }

      const group = await db
        .select()
        .from(schema.userGroups)
        .where(eq(schema.userGroups.id, group_id))
        .get()

      if (!group) {
        return { error: 'Group not found' }
      }

      if (group.createdBy !== userId) {
        return { error: 'Only group creator can view invites' }
      }

      const invites = await db
        .select()
        .from(schema.groupInvites)
        .where(eq(schema.groupInvites.groupId, group_id))
        .all()

      const now = new Date()
      const activeInvites = invites
        .filter(i => i.expiresAt > now)
        .map(i => ({
          id: i.id,
          token: i.token,
          expiresAt: i.expiresAt,
        }))

      return { invites: activeInvites }
    }
    case 'create_poll': {
      const { group_id, candidates } = args as { group_id: string; candidates: { tmdb_id: number; media_type: string; title: string }[] }

      const membership = await db
        .select()
        .from(schema.userGroupMembers)
        .where(and(eq(schema.userGroupMembers.groupId, group_id), eq(schema.userGroupMembers.userId, userId)))
        .get()

      if (!membership) {
        return { error: 'Not a member of this group' }
      }

      const { nanoid } = await import('nanoid')
      const pollId = nanoid(16)

      await db.insert(schema.groupPolls).values({
        id: pollId,
        groupId: group_id,
        candidates: JSON.stringify(candidates),
        closedAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }).run()

      return { success: true, poll_id: pollId }
    }
    case 'vote_on_poll': {
      const { poll_id, rankings } = args as { poll_id: string; rankings: number[] }
      const { nanoid: nanoid2 } = await import('nanoid')

      const poll = await db
        .select()
        .from(schema.groupPolls)
        .where(eq(schema.groupPolls.id, poll_id))
        .get()

      if (!poll) {
        return { error: 'Poll not found' }
      }

      if (poll.status !== 'active') {
        return { error: 'Poll is closed' }
      }

      const membership = await db
        .select()
        .from(schema.userGroupMembers)
        .where(and(eq(schema.userGroupMembers.groupId, poll.groupId), eq(schema.userGroupMembers.userId, userId)))
        .get()

      if (!membership) {
        return { error: 'Not a member of this group' }
      }

      const existingVote = await db
        .select()
        .from(schema.groupPollVotes)
        .where(and(eq(schema.groupPollVotes.pollId, poll.id), eq(schema.groupPollVotes.userId, userId)))
        .get()

      if (existingVote) {
        return { error: 'Already voted on this poll' }
      }

      await db.insert(schema.groupPollVotes).values({
        id: nanoid2(16),
        pollId: poll.id,
        userId,
        rankings: JSON.stringify(rankings),
      }).run()

      return { success: true, message: 'Vote recorded' }
    }
    case 'get_poll_results': {
      const { poll_id } = args as { poll_id: string }

      const poll = await db
        .select()
        .from(schema.groupPolls)
        .where(eq(schema.groupPolls.id, poll_id))
        .get()

      if (!poll) {
        return { error: 'Poll not found' }
      }

      const membership = await db
        .select()
        .from(schema.userGroupMembers)
        .where(and(eq(schema.userGroupMembers.groupId, poll.groupId), eq(schema.userGroupMembers.userId, userId)))
        .get()

      if (!membership) {
        return { error: 'Not a member of this group' }
      }

      const votes = await db
        .select()
        .from(schema.groupPollVotes)
        .where(eq(schema.groupPollVotes.pollId, poll.id))
        .all()

      const candidates: { tmdb_id: number; media_type: string; title: string }[] = JSON.parse(poll.candidates)
      const points: Map<number, number> = new Map()

      for (const vote of votes) {
        const rankings: number[] = JSON.parse(vote.rankings)
        for (let i = 0; i < rankings.length; i++) {
          const tmdbId = rankings[i]
          const pointsAwarded = rankings.length - i
          points.set(tmdbId, (points.get(tmdbId) || 0) + pointsAwarded)
        }
      }

      const results = candidates.map(c => ({
        tmdb_id: c.tmdb_id,
        media_type: c.media_type,
        title: c.title,
        points: points.get(c.tmdb_id) || 0,
      })).sort((a, b) => b.points - a.points)

      return { results, totalVotes: votes.length, winner: results[0] || null }
    }
    case 'close_poll': {
      const { poll_id } = args as { poll_id: string }

      const poll = await db
        .select()
        .from(schema.groupPolls)
        .where(eq(schema.groupPolls.id, poll_id))
        .get()

      if (!poll) {
        return { error: 'Poll not found' }
      }

      const membership = await db
        .select()
        .from(schema.userGroupMembers)
        .where(and(eq(schema.userGroupMembers.groupId, poll.groupId), eq(schema.userGroupMembers.userId, userId)))
        .get()

      if (!membership) {
        return { error: 'Not a member of this group' }
      }

      const votes = await db
        .select()
        .from(schema.groupPollVotes)
        .where(eq(schema.groupPollVotes.pollId, poll.id))
        .all()

      const candidates: { tmdb_id: number; media_type: string; title: string }[] = JSON.parse(poll.candidates)
      const points: Map<number, number> = new Map()

      for (const vote of votes) {
        const rankings: number[] = JSON.parse(vote.rankings)
        for (let i = 0; i < rankings.length; i++) {
          const tmdbId = rankings[i]
          const pointsAwarded = rankings.length - i
          points.set(tmdbId, (points.get(tmdbId) || 0) + pointsAwarded)
        }
      }

      const sortedResults = candidates
        .map(c => ({ tmdbId: c.tmdb_id, mediaType: c.media_type, title: c.title, points: points.get(c.tmdb_id) || 0 }))
        .sort((a, b) => b.points - a.points)

      const winner = sortedResults[0]

      await db
        .update(schema.groupPolls)
        .set({ status: 'closed', closedAt: new Date(), winnerTmdbId: winner?.tmdbId, winnerMediaType: winner?.mediaType })
        .where(eq(schema.groupPolls.id, poll_id))
        .run()

      return { success: true, winner }
    }
    case 'list_group_polls': {
      const { group_id } = args as { group_id: string }

      const membership = await db
        .select()
        .from(schema.userGroupMembers)
        .where(and(eq(schema.userGroupMembers.groupId, group_id), eq(schema.userGroupMembers.userId, userId)))
        .get()

      if (!membership) {
        return { error: 'Not a member of this group' }
      }

      const polls = await db
        .select()
        .from(schema.groupPolls)
        .where(eq(schema.groupPolls.groupId, group_id))
        .all()

      return {
        polls: polls.map(p => ({
          id: p.id,
          status: p.status,
          createdAt: p.createdAt,
          closedAt: p.closedAt,
          candidates: JSON.parse(p.candidates),
          winner: p.winnerTmdbId ? { tmdbId: p.winnerTmdbId, mediaType: p.winnerMediaType } : null,
        })),
      }
    }
    case 'create_access_code': {
      const user = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .get()

      if (!user?.isAdmin) {
        return { error: 'Admin only' }
      }

      const { code, expires_days } = args as { code?: string; expires_days?: number }

      const accessCode = code || (await import('nanoid')).nanoid(16)
      let expiresAt: Date | null = null

      if (expires_days) {
        expiresAt = new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000)
      }

      await db.insert(schema.accessCodes).values({
        id: (await import('nanoid')).nanoid(16),
        code: accessCode,
        createdBy: userId,
        expiresAt,
      }).run()

      return { success: true, code: accessCode, expiresAt: expiresAt?.toISOString() || null }
    }
    case 'verify_access_code': {
      const { code } = args as { code: string }

      const accessCode = await db
        .select()
        .from(schema.accessCodes)
        .where(eq(schema.accessCodes.code, code))
        .get()

      if (!accessCode) {
        return { valid: false, message: 'Invalid code' }
      }

      if (!accessCode.isActive) {
        return { valid: false, message: 'Code is inactive' }
      }

      if (accessCode.expiresAt && accessCode.expiresAt < new Date()) {
        return { valid: false, message: 'Code has expired' }
      }

      return { valid: true, message: 'Code is valid' }
    }
    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}

async function authenticateRequest(req: NextRequest, db: DB): Promise<{ userId: string } | NextResponse> {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32601, message: 'Missing x-api-key header' }, id: null },
      { status: 401, headers: CORS_HEADERS }
    )
  }

  const userId = await getUserByApiKey(db, apiKey)
  if (!userId) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32601, message: 'Invalid API key' }, id: null },
      { status: 401, headers: CORS_HEADERS }
    )
  }

  return { userId }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }
  const db = getDB(dbEnv)

  const authResult = await authenticateRequest(req, db)
  if (authResult instanceof NextResponse) {
    return authResult
  }
  const { userId } = authResult

  let body: JsonRpcRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  if (body.jsonrpc !== '2.0') {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: body.id ?? null },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const { method, params, id } = body

  if (method !== 'tools/call') {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const { name, arguments: args } = params as { name: string; arguments?: Record<string, unknown> }

  const acceptHeader = req.headers.get('accept')
  const wantsSSE = acceptHeader?.includes('text/event-stream')

  const tmdb = getTMDBConfig(env as any)

  try {
    const result = await handleTool(db, userId, name, args, tmdb)
    const responseBody = {
      jsonrpc: '2.0',
      result: { content: [{ type: 'text', text: JSON.stringify(result) }] },
      id,
    }

    if (wantsSSE) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(responseBody)}\n\n`))
          controller.close()
        },
      })

      return new Response(stream, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    return NextResponse.json(responseBody, { headers: CORS_HEADERS })
  } catch (error) {
    const errorResponse = {
      jsonrpc: '2.0',
      error: { code: -32603, message: String(error) },
      id,
    }

    if (wantsSSE) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(errorResponse)}\n\n`))
          controller.close()
        },
      })

      return new Response(stream, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    return NextResponse.json(errorResponse, { status: 500, headers: CORS_HEADERS })
  }
}

export async function GET(req: NextRequest) {
  const acceptHeader = req.headers.get('accept')

  if (acceptHeader?.includes('text/event-stream')) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const sessionId = crypto.randomUUID()
        controller.enqueue(encoder.encode(`event: connect\ndata: {"sessionId":"${sessionId}"}\n\n`))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }

  const tools = [
    { name: 'get_watchlist', description: 'Get all items in the user\'s watchlist', inputSchema: { type: 'object', properties: {} } },
    { name: 'add_to_watchlist', description: 'Add a movie or TV show to the watchlist', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' }, media_type: { type: 'string', enum: ['movie', 'tv'] } }, required: ['tmdb_id', 'media_type'] } },
    { name: 'remove_from_watchlist', description: 'Remove a movie or TV show from the watchlist', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' } }, required: ['tmdb_id'] } },
    { name: 'get_preferences', description: 'Get user preferences including streaming services, genres, likes, and countries', inputSchema: { type: 'object', properties: {} } },
    { name: 'update_streaming_services', description: 'Update the user\'s preferred streaming services', inputSchema: { type: 'object', properties: { services: { type: 'array', items: { type: 'string' } } }, required: ['services'] } },
    { name: 'update_genres', description: 'Update the user\'s preferred genres', inputSchema: { type: 'object', properties: { genres: { type: 'array', items: { type: 'number' } } }, required: ['genres'] } },
    { name: 'update_country', description: 'Update the user\'s country preferences', inputSchema: { type: 'object', properties: { countries: { type: 'array', items: { type: 'string' } } }, required: ['countries'] } },
    { name: 'add_like', description: 'Add a movie or TV show to user\'s liked list', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' }, media_type: { type: 'string', enum: ['movie', 'tv'] }, title: { type: 'string' } }, required: ['tmdb_id', 'media_type', 'title'] } },
    { name: 'remove_like', description: 'Remove a movie or TV show from user\'s liked list', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' } }, required: ['tmdb_id'] } },
    { name: 'get_watch_history', description: 'Get user\'s watch history (movies/shows marked as watched)', inputSchema: { type: 'object', properties: {} } },
    { name: 'mark_as_watched', description: 'Mark a movie or TV show as watched', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' }, media_type: { type: 'string', enum: ['movie', 'tv'] }, title: { type: 'string' } }, required: ['tmdb_id', 'media_type', 'title'] } },
    { name: 'remove_from_watch_history', description: 'Remove a movie or TV show from watch history', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' } }, required: ['tmdb_id'] } },
    { name: 'search_media', description: 'Search for movies or TV shows by query', inputSchema: { type: 'object', properties: { query: { type: 'string' }, page: { type: 'number' } }, required: ['query'] } },
    { name: 'get_media_details', description: 'Get detailed information about a specific movie or TV show', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' }, media_type: { type: 'string', enum: ['movie', 'tv'] } }, required: ['tmdb_id', 'media_type'] } },
    { name: 'get_trending', description: 'Get trending movies or TV shows', inputSchema: { type: 'object', properties: { media_type: { type: 'string', enum: ['all', 'movie', 'tv'] }, page: { type: 'number' } } } },
    { name: 'get_recommendations', description: 'Get personalized recommendations based on user\'s likes and preferences', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_watch_providers', description: 'Get streaming providers for a movie or TV show in user\'s countries', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' }, media_type: { type: 'string', enum: ['movie', 'tv'] } }, required: ['tmdb_id', 'media_type'] } },
    { name: 'list_groups', description: 'Get all groups the user is a member of', inputSchema: { type: 'object', properties: {} } },
    { name: 'create_group', description: 'Create a new group for sharing watchlists', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
    { name: 'get_group_watchlist', description: 'Get the group watchlist with intersection and recommendations', inputSchema: { type: 'object', properties: { group_id: { type: 'string' } }, required: ['group_id'] } },
    { name: 'create_group_invite', description: 'Create a 7-day invite token for a group', inputSchema: { type: 'object', properties: { group_id: { type: 'string' } }, required: ['group_id'] } },
    { name: 'join_group', description: 'Join a group using an invite token', inputSchema: { type: 'object', properties: { token: { type: 'string' } }, required: ['token'] } },
    { name: 'get_group_invites', description: 'List active invites for a group (creator only)', inputSchema: { type: 'object', properties: { group_id: { type: 'string' } }, required: ['group_id'] } },
    { name: 'create_poll', description: 'Create a poll with candidates, auto-closes in 7 days', inputSchema: { type: 'object', properties: { group_id: { type: 'string' }, candidates: { type: 'array', items: { type: 'object', properties: { tmdb_id: { type: 'number' }, media_type: { type: 'string' }, title: { type: 'string' } } } } }, required: ['group_id', 'candidates'] } },
    { name: 'vote_on_poll', description: 'Vote on a poll with ranked choices', inputSchema: { type: 'object', properties: { poll_id: { type: 'string' }, rankings: { type: 'array', items: { type: 'number' } } }, required: ['poll_id', 'rankings'] } },
    { name: 'get_poll_results', description: 'Get poll results with Borda count scoring', inputSchema: { type: 'object', properties: { poll_id: { type: 'string' } }, required: ['poll_id'] } },
    { name: 'close_poll', description: 'Manually close a poll and record winner', inputSchema: { type: 'object', properties: { poll_id: { type: 'string' } }, required: ['poll_id'] } },
    { name: 'list_group_polls', description: 'List all polls in a group', inputSchema: { type: 'object', properties: { group_id: { type: 'string' } }, required: ['group_id'] } },
    { name: 'create_access_code', description: 'Create a signup access code (admin only)', inputSchema: { type: 'object', properties: { code: { type: 'string' }, expires_days: { type: 'number' } } } },
    { name: 'verify_access_code', description: 'Verify an access code for signup', inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } },
  ]

  return NextResponse.json({
    name: 'streamlist-mcp-server',
    version: '1.0.0',
    tools,
  }, { headers: CORS_HEADERS })
}
