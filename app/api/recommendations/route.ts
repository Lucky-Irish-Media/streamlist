import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth'
import { parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { discoverMovies, discoverTVShows, getTrending, getImageUrl, getPopularMovies, getPopularTVShows, getNowPlaying, getOnTheAir, getMovieRecommendations, getTVRecommendations, getMovieSimilar, getTVSimilar } from '@/lib/tmdb'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }
  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }

  let userPreferences: {
    streamingServices: string[]
    genres: number[]
    likes: { tmdbId: number; mediaType: string; title: string }[]
    watchlist: { tmdbId: number; mediaType: string }[]
  } = { streamingServices: [], genres: [], likes: [], watchlist: [] }

  if (sessionId && dbEnv.DB) {
    const userId = await getSessionUser(dbEnv, sessionId)
    if (userId) {
      const db = getDB(dbEnv)

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

      userPreferences = {
        streamingServices: streamingServices.map(s => s.serviceId),
        genres: genres.map(g => g.genreId),
        likes: likes.map(l => ({ tmdbId: l.tmdbId, mediaType: l.mediaType, title: l.title })),
        watchlist: watchlistItems.map(w => ({ tmdbId: w.tmdbId, mediaType: w.mediaType })),
      }
    }
  }

  const trending = await getTrending('all', 1)
  const popularMovies = await getPopularMovies(1)
  const popularTV = await getPopularTVShows(1)
  const nowPlaying = await getNowPlaying(1)
  const onTheAir = await getOnTheAir(1)

  const excludeIds = new Set([
    ...userPreferences.likes.map(l => l.tmdbId),
    ...userPreferences.watchlist.map(w => w.tmdbId),
  ])

  let recommendations: any[] = []

  if (userPreferences.likes.length > 0) {
    const likeBatches = userPreferences.likes.slice(0, 5)
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
    recommendations = shuffled.slice(0, 20)
  }

  if (recommendations.length < 20 && userPreferences.genres.length > 0) {
    const needed = 20 - recommendations.length
    const genreStr = userPreferences.genres.join(',')
    const randomPage = String(Math.floor(Math.random() * 20) + 1)

    const [movieRecs, tvRecs] = await Promise.all([
      discoverMovies({ with_genres: genreStr, sort_by: 'popularity.desc', page: randomPage }),
      discoverTVShows({ with_genres: genreStr, sort_by: 'popularity.desc', page: randomPage }),
    ])

    const existingIds = new Set(recommendations.map(r => r.id))
    for (const item of [...movieRecs.results, ...tvRecs.results]) {
      if (recommendations.length >= 20) break
      if (!excludeIds.has(item.id) && !existingIds.has(item.id)) {
        recommendations.push(item)
      }
    }
  }

  return NextResponse.json({
    trending: trending.results.slice(0, 10).map((m: any) => {
      const mediaType = m.media_type || 'movie'
      return { ...m, mediaType, image: getImageUrl(m.poster_path) }
    }),
    movies: popularMovies.results.slice(0, 10).map((m: any) => ({ ...m, mediaType: 'movie', image: getImageUrl(m.poster_path) })),
    tv: popularTV.results.slice(0, 10).map((m: any) => ({ ...m, mediaType: 'tv', image: getImageUrl(m.poster_path) })),
    newReleases: {
      movies: nowPlaying.results.slice(0, 10).map((m: any) => ({ ...m, mediaType: 'movie', image: getImageUrl(m.poster_path) })),
      tv: onTheAir.results.slice(0, 10).map((m: any) => ({ ...m, mediaType: 'tv', image: getImageUrl(m.poster_path) })),
    },
    recommendations: recommendations.map((m: any) => {
      return { ...m, image: getImageUrl(m.poster_path) }
    }),
    userPreferences,
  })
}