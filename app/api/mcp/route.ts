import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and } from 'drizzle-orm'
import * as schema from '@/db/schema'
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
  STREAMING_SERVICES,
  TMDB_GENRES,
} from '@/lib/tmdb'

async function getCertification(mediaType: string, id: number, country: string) {
  try {
    if (mediaType === 'movie') {
      const releaseDates = await getMovieReleaseDates(id)
      const countryData = releaseDates.results.find(r => r.iso_3166_1 === country)
      if (countryData?.release_dates?.[0]?.certification) {
        return countryData.release_dates[0].certification
      }
      const usData = releaseDates.results.find(r => r.iso_3166_1 === 'US')
      return usData?.release_dates?.[0]?.certification || null
    } else {
      const contentRatings = await getTVContentRatings(id)
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

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number | null
  method: string
  params?: Record<string, unknown>
}

async function getUserByApiKey(db: ReturnType<typeof drizzle>, apiKey: string): Promise<string | null> {
  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.apiKey, apiKey))
    .get()
  return user?.id ?? null
}

async function getUserPreferences(db: ReturnType<typeof drizzle>, userId: string) {
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

  return {
    country: user?.country || 'US',
    streamingServices: streamingServices.map(s => s.serviceId),
    genres: genres.map(g => g.genreId),
    likes: likes.map(l => ({ tmdbId: l.tmdbId, mediaType: l.mediaType, title: l.title })),
    watchlist: watchlistItems.map(w => ({ tmdbId: w.tmdbId, mediaType: w.mediaType })),
  }
}

async function handleTool(db: ReturnType<typeof drizzle>, userId: string, toolName: string, args?: Record<string, unknown>) {
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
      return {
        country: user.country,
        streamingServices: streamingServices.map(s => s.serviceId),
        genres: genres.map(g => g.genreId),
        likes: likes.map(l => ({
          tmdbId: l.tmdbId,
          mediaType: l.mediaType,
          title: l.title,
        })),
      }
    }
    case 'update_streaming_services': {
      const { services } = args as { services: string[] }
      await db
        .delete(schema.userStreamingServices)
        .where(eq(schema.userStreamingServices.userId, userId))
        .run()
      if (services.length > 0) {
        await db
          .insert(schema.userStreamingServices)
          .values(services.map(serviceId => ({ userId, serviceId })))
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
      const { country } = args as { country: string }
      await db
        .update(schema.users)
        .set({ country })
        .where(eq(schema.users.id, userId))
        .run()
      return { success: true, message: 'Country updated' }
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
      const results = await searchMulti(query, page)
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
      const certification = await getCertification(media_type, tmdb_id, prefs.country)
      if (media_type === 'movie') {
        const details = await getMovieDetails(tmdb_id)
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
        const details = await getTVDetails(tmdb_id)
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
      const results = await getTrending(media_type as 'all' | 'movie' | 'tv', page)
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
            fetchPromises.push({ promise: getMovieRecommendations(like.tmdbId), mediaType: 'movie' })
            fetchPromises.push({ promise: getMovieSimilar(like.tmdbId), mediaType: 'movie' })
          } else {
            fetchPromises.push({ promise: getTVRecommendations(like.tmdbId), mediaType: 'tv' })
            fetchPromises.push({ promise: getTVSimilar(like.tmdbId), mediaType: 'tv' })
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
          (await import('@/lib/tmdb')).discoverMovies({ with_genres: genreStr, sort_by: 'popularity.desc', page: randomPage }),
          (await import('@/lib/tmdb')).discoverTVShows({ with_genres: genreStr, sort_by: 'popularity.desc', page: randomPage }),
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
        providers = await getMovieWatchProviders(tmdb_id)
      } else {
        providers = await getTVWatchProviders(tmdb_id)
      }

      const countryProviders = providers.results?.[prefs.country]
      if (!countryProviders?.flatrate) {
        return { providers: [], message: `No streaming providers found in ${prefs.country}` }
      }

      return {
        providers: countryProviders.flatrate.map((p: any) => ({
          id: p.provider_id,
          name: p.provider_name,
          logoPath: p.logo_path,
        })),
      }
    }
    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}

export async function POST(req: NextRequest) {
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }
  const db = drizzle(dbEnv, { schema })

  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32601, message: 'Missing x-api-key header' }, id: null },
      { status: 401 }
    )
  }

  const userId = await getUserByApiKey(db, apiKey)
  if (!userId) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32601, message: 'Invalid API key' }, id: null },
      { status: 401 }
    )
  }

  let body: JsonRpcRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null },
      { status: 400 }
    )
  }

  if (body.jsonrpc !== '2.0') {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: body.id ?? null },
      { status: 400 }
    )
  }

  const { method, params, id } = body

  if (method !== 'tools/call') {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id },
      { status: 400 }
    )
  }

  const { name, arguments: args } = params as { name: string; arguments?: Record<string, unknown> }

  try {
    const result = await handleTool(db, userId, name, args)
    return NextResponse.json({
      jsonrpc: '2.0',
      result: { content: [{ type: 'text', text: JSON.stringify(result) }] },
      id,
    })
  } catch (error) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: String(error) }, id },
      { status: 500 }
    )
  }
}

export async function GET() {
  const tools = [
    { name: 'get_watchlist', description: 'Get all items in the user\'s watchlist', inputSchema: { type: 'object', properties: {} } },
    { name: 'add_to_watchlist', description: 'Add a movie or TV show to the watchlist', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' }, media_type: { type: 'string', enum: ['movie', 'tv'] } }, required: ['tmdb_id', 'media_type'] } },
    { name: 'remove_from_watchlist', description: 'Remove a movie or TV show from the watchlist', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' } }, required: ['tmdb_id'] } },
    { name: 'get_preferences', description: 'Get user preferences including streaming services, genres, likes, and country', inputSchema: { type: 'object', properties: {} } },
    { name: 'update_streaming_services', description: 'Update the user\'s preferred streaming services', inputSchema: { type: 'object', properties: { services: { type: 'array', items: { type: 'string' } } }, required: ['services'] } },
    { name: 'update_genres', description: 'Update the user\'s preferred genres', inputSchema: { type: 'object', properties: { genres: { type: 'array', items: { type: 'number' } } }, required: ['genres'] } },
    { name: 'update_country', description: 'Update the user\'s country preference', inputSchema: { type: 'object', properties: { country: { type: 'string' } }, required: ['country'] } },
    { name: 'add_like', description: 'Add a movie or TV show to user\'s liked list', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' }, media_type: { type: 'string', enum: ['movie', 'tv'] }, title: { type: 'string' } }, required: ['tmdb_id', 'media_type', 'title'] } },
    { name: 'remove_like', description: 'Remove a movie or TV show from user\'s liked list', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' } }, required: ['tmdb_id'] } },
    { name: 'get_watch_history', description: 'Get user\'s watch history (movies/shows marked as watched)', inputSchema: { type: 'object', properties: {} } },
    { name: 'mark_as_watched', description: 'Mark a movie or TV show as watched', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' }, media_type: { type: 'string', enum: ['movie', 'tv'] }, title: { type: 'string' } }, required: ['tmdb_id', 'media_type', 'title'] } },
    { name: 'remove_from_watch_history', description: 'Remove a movie or TV show from watch history', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' } }, required: ['tmdb_id'] } },
    { name: 'search_media', description: 'Search for movies or TV shows by query', inputSchema: { type: 'object', properties: { query: { type: 'string' }, page: { type: 'number' } }, required: ['query'] } },
    { name: 'get_media_details', description: 'Get detailed information about a specific movie or TV show', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' }, media_type: { type: 'string', enum: ['movie', 'tv'] } }, required: ['tmdb_id', 'media_type'] } },
    { name: 'get_trending', description: 'Get trending movies or TV shows', inputSchema: { type: 'object', properties: { media_type: { type: 'string', enum: ['all', 'movie', 'tv'] }, page: { type: 'number' } } } },
    { name: 'get_recommendations', description: 'Get personalized recommendations based on user\'s likes and preferences', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_watch_providers', description: 'Get streaming providers for a movie or TV show in user\'s country', inputSchema: { type: 'object', properties: { tmdb_id: { type: 'number' }, media_type: { type: 'string', enum: ['movie', 'tv'] } }, required: ['tmdb_id', 'media_type'] } },
  ]

  return NextResponse.json({
    name: 'streamlist-mcp-server',
    version: '1.0.0',
    tools,
  })
}
