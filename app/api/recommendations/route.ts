import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser, parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import {
  getImageUrl, fetchFromTMDB,
  getMovieRecommendations, getTVRecommendations,
  getMovieSimilar, getTVSimilar,
  getMovieKeywords, getTVKeywords,
  getMovieDetails, getTVDetails,
  discoverMovies, discoverTVShows,
  getTMDBConfig,
  type TMDBConfig, type MediaItem, type TMDBResponse,
} from '@/lib/tmdb'
import {
  cachedGetTrending,
  cachedGetPopularMovies,
  cachedGetPopularTVShows,
  cachedGetNowPlaying,
  cachedGetOnTheAir,
  cachedDiscoverMovies,
  cachedDiscoverTVShows,
} from '@/lib/tmdb-cache'

export const runtime = 'edge'

interface ScoredItem {
  id: number
  title?: string
  name?: string
  media_type?: string
  mediaType: string
  image: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  vote_average?: number
  release_date?: string
  first_air_date?: string
  genre_ids?: number[]
  score: number
  matchReasons: string[]
}

async function buildHybridRecommendations(
  likes: { tmdbId: number; mediaType: string; title: string }[],
  genres: number[],
  streamingServices: { id: string; name: string }[],
  watchlist: { tmdbId: number; mediaType: string }[],
  watched: { tmdbId: number; mediaType: string }[],
  countries: string[],
  tmdb: TMDBConfig,
): Promise<ScoredItem[]> {
  if (likes.length === 0) return []

  const excludeIds = new Set([
    ...likes.map(l => l.tmdbId),
    ...watchlist.map(w => w.tmdbId),
    ...watched.map(w => w.tmdbId),
  ])

  const region = countries?.[0] || 'US'
  const scored = new Map<number, ScoredItem>()
  const apiCallTracker = { count: 0 }
  const MAX_CALLS = 20

  const topLikes = likes.slice(0, 5)

  const fetchWithBudget = async <T>(fn: () => Promise<T>): Promise<T | null> => {
    if (apiCallTracker.count >= MAX_CALLS) return null
    apiCallTracker.count++
    try {
      return await fn()
    } catch {
      return null
    }
  }

  const addItem = (
    item: MediaItem,
    reason: string,
    points: number,
  ) => {
    if (excludeIds.has(item.id)) return
    const existing = scored.get(item.id)
    if (existing) {
      existing.score += points
      if (!existing.matchReasons.includes(reason)) {
        existing.matchReasons.push(reason)
      }
    } else {
      const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie')
      scored.set(item.id, {
        ...item,
        mediaType,
        image: getImageUrl(item.poster_path),
        score: points,
        matchReasons: [reason],
      })
    }
  }

  const detailCache = new Map<number, { genres: number[]; keywordIds: number[] }>()

  const fetchItemDetails = async (like: { tmdbId: number; mediaType: string }) => {
    if (detailCache.has(like.tmdbId)) return detailCache.get(like.tmdbId)!

    const isMovie = like.mediaType === 'movie'
    const [details, keywords] = await Promise.all([
      fetchWithBudget(() => isMovie
        ? getMovieDetails(like.tmdbId, tmdb)
        : getTVDetails(like.tmdbId, tmdb)),
      fetchWithBudget(async () => {
        if (isMovie) {
          return await getMovieKeywords(like.tmdbId, tmdb)
        } else {
          return await getTVKeywords(like.tmdbId, tmdb)
        }
      }),
    ])

    const genreIds = details?.genres?.map(g => g.id) || []
    let keywordIds: number[] = []
    if (keywords) {
      if (isMovie && 'keywords' in keywords) {
        keywordIds = keywords.keywords.map(k => k.id)
      } else if ('results' in keywords) {
        keywordIds = keywords.results.map(k => k.id)
      }
    }

    const result = { genres: genreIds, keywordIds }
    detailCache.set(like.tmdbId, result)
    return result
  }

  const detailsResults = await Promise.all(topLikes.map(fetchItemDetails))

  const genreCounts = new Map<number, number>()
  const allKeywordIds: number[] = []

  for (const detail of detailsResults) {
    if (!detail) continue
    for (const gid of detail.genres) {
      genreCounts.set(gid, (genreCounts.get(gid) || 0) + 1)
    }
    allKeywordIds.push(...detail.keywordIds)
  }

  // Also add user's explicit genre preferences
  for (const gid of genres) {
    genreCounts.set(gid, (genreCounts.get(gid) || 0) + 1)
  }

  const topGenreIds = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)

  const uniqueKeywordIds = Array.from(new Set(allKeywordIds)).slice(0, 10)

  // Phase 1: Seed-based pool (no provider filter available on TMDB recs/similar endpoints)
  // These are lower-confidence since we can't verify streaming availability
  if (streamingServices.length === 0) {
    // Only use seed-based if user has no streaming services selected
    const seedPromises: Promise<void>[] = []

    for (const like of topLikes) {
      const isMovie = like.mediaType === 'movie'

      seedPromises.push(
        (async () => {
          const [recs, similar] = await Promise.all([
            fetchWithBudget(() => isMovie
              ? getMovieRecommendations(like.tmdbId, 1, tmdb)
              : getTVRecommendations(like.tmdbId, 1, tmdb)),
            fetchWithBudget(() => isMovie
              ? getMovieSimilar(like.tmdbId, 1, tmdb)
              : getTVSimilar(like.tmdbId, 1, tmdb)),
          ])
          if (recs) {
            for (const item of recs.results.slice(0, 10)) {
              addItem(item, 'seed', 1)
            }
          }
          if (similar) {
            for (const item of similar.results.slice(0, 10)) {
              addItem(item, 'seed', 1)
            }
          }
        })()
      )
    }

    await Promise.all(seedPromises)
  }

  // Phase 2: Genre-weighted discovery with provider filtering
  if (topGenreIds.length > 0 && streamingServices.length > 0 && apiCallTracker.count < MAX_CALLS) {
    const genreStr = topGenreIds.join(',')
    const providerIds = streamingServices.map(s => s.id).slice(0, 3)

    const discoverPromises: Promise<void>[] = []

    for (const providerId of providerIds) {
      discoverPromises.push(
        (async () => {
          const params = {
            with_genres: genreStr,
            vote_average_gte: '6.5',
            vote_count_gte: '100',
            sort_by: 'vote_average.desc',
            page: '1',
            with_watch_providers: providerId,
            watch_region: region,
          }
          const [movies, tv] = await Promise.all([
            fetchWithBudget(() => discoverMovies(params, tmdb)),
            fetchWithBudget(() => discoverTVShows(params, tmdb)),
          ])
          if (movies) {
            for (const item of movies.results.slice(0, 10)) {
              addItem(item, 'genre', 2)
            }
          }
          if (tv) {
            for (const item of tv.results.slice(0, 10)) {
              addItem(item, 'genre', 2)
            }
          }
        })()
      )
    }

    await Promise.all(discoverPromises)
  }

  // Phase 3: Keyword discovery with provider filtering
  if (uniqueKeywordIds.length > 0 && streamingServices.length > 0 && apiCallTracker.count < MAX_CALLS) {
    const keywordStr = uniqueKeywordIds.join('|')
    const providerIds = streamingServices.map(s => s.id).slice(0, 3)

    const keywordPromises: Promise<void>[] = []

    for (const providerId of providerIds) {
      keywordPromises.push(
        (async () => {
          const keywordParams: Record<string, string> = {
            with_keywords: keywordStr,
            vote_average_gte: '6.0',
            vote_count_gte: '50',
            sort_by: 'popularity.desc',
            page: '1',
            with_watch_providers: providerId,
            watch_region: region,
          }
          const [movies, tv] = await Promise.all([
            fetchWithBudget(() => fetchFromTMDB<TMDBResponse>('/discover/movie', keywordParams, tmdb)),
            fetchWithBudget(() => fetchFromTMDB<TMDBResponse>('/discover/tv', keywordParams, tmdb)),
          ])
          if (movies) {
            for (const item of movies.results.slice(0, 10)) {
              addItem(item, 'keyword', 1)
            }
          }
          if (tv) {
            for (const item of tv.results.slice(0, 10)) {
              addItem(item, 'keyword', 1)
            }
          }
        })()
      )
    }

    await Promise.all(keywordPromises)
  }

  // Sort by score desc, then vote_average desc
  return Array.from(scored.values())
    .sort((a, b) => (b.score - a.score) || ((b.vote_average || 0) - (a.vote_average || 0)))
    .slice(0, 50)
}

export async function GET(req: NextRequest) {
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }
  const tmdb = getTMDBConfig(env as any)
  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }

  let userPreferences: {
    streamingServices: { id: string; name: string }[]
    genres: number[]
    likes: { tmdbId: number; mediaType: string; title: string }[]
    watchlist: { tmdbId: number; mediaType: string }[]
    watched: { tmdbId: number; mediaType: string }[]
    countries: string[]
  } = { streamingServices: [], genres: [], likes: [], watchlist: [], watched: [], countries: ['US'] }

  if (sessionId && dbEnv.DB) {
    const userId = await getSessionUser(dbEnv, sessionId)
    if (userId) {
      const db = getDB(dbEnv)

      const [streamingServices, genres, likes, watchlistItems, watchedItems, users] = await Promise.all([
        db.select().from(schema.userStreamingServices).where(eq(schema.userStreamingServices.userId, userId)).all(),
        db.select().from(schema.userGenres).where(eq(schema.userGenres.userId, userId)).all(),
        db.select().from(schema.userLikes).where(eq(schema.userLikes.userId, userId)).all(),
        db.select().from(schema.watchlist).where(eq(schema.watchlist.userId, userId)).all(),
        db.select().from(schema.watched).where(eq(schema.watched.userId, userId)).all(),
        db.select().from(schema.users).where(eq(schema.users.id, userId)).all(),
      ])

      userPreferences = {
        streamingServices: streamingServices.map(s => ({ id: s.serviceId, name: s.serviceName })),
        genres: genres.map(g => g.genreId),
        likes: likes.map(l => ({ tmdbId: l.tmdbId, mediaType: l.mediaType, title: l.title })),
        watchlist: watchlistItems.map(w => ({ tmdbId: w.tmdbId, mediaType: w.mediaType })),
        watched: watchedItems.map(w => ({ tmdbId: w.tmdbId, mediaType: w.mediaType })),
        countries: users[0]?.countries ? JSON.parse(users[0].countries) : ['US'],
      }
    }
  }

  const serviceNamesMap: Record<string, string> = {}
  for (const s of userPreferences.streamingServices) {
    serviceNamesMap[s.id] = s.name
  }

  // Fetch catalog data in parallel
  const [trending, popularMovies, popularTV, nowPlaying, onTheAir] = await Promise.all([
    cachedGetTrending('all', 1, tmdb, env as any),
    cachedGetPopularMovies(1, tmdb, env as any),
    cachedGetPopularTVShows(1, tmdb, env as any),
    cachedGetNowPlaying(1, tmdb, env as any),
    cachedGetOnTheAir(1, tmdb, env as any),
  ])

  // Build hybrid recommendations
  const forYou = await buildHybridRecommendations(
    userPreferences.likes,
    userPreferences.genres,
    userPreferences.streamingServices,
    userPreferences.watchlist,
    userPreferences.watched,
    userPreferences.countries,
    tmdb,
  )

  // Service-based recommendations (for per-service browsing)
  const excludeIds = new Set([
    ...userPreferences.likes.map(l => l.tmdbId),
    ...userPreferences.watchlist.map(w => w.tmdbId),
    ...userPreferences.watched.map(w => w.tmdbId),
  ])

  const region = userPreferences.countries?.[0] || 'US'
  const randomPage = String(Math.floor(Math.random() * 20) + 1)
  const serviceRecommendations: Record<string, any[]> = {}

  for (const service of userPreferences.streamingServices) {
    const discoverParams = {
      with_watch_providers: service.id,
      watch_region: region,
      sort_by: 'popularity.desc',
      page: randomPage,
    }

    const [movies, tv] = await Promise.all([
      cachedDiscoverMovies(discoverParams, tmdb, env as any),
      cachedDiscoverTVShows(discoverParams, tmdb, env as any),
    ])

    const allItems = [...movies.results, ...tv.results]
    const filtered: any[] = []
    const existingIds = new Set<number>()

    for (const item of allItems) {
      if (filtered.length >= 10) break
      const id = item.id
      if (!existingIds.has(id)) {
        existingIds.add(id)
        filtered.push({
          ...item,
          mediaType: (item as any).media_type === 'tv' ? 'tv' : 'movie',
          image: getImageUrl(item.poster_path),
        })
      }
    }

    if (filtered.length > 0) {
      serviceRecommendations[service.id] = filtered
    }
  }

  return NextResponse.json({
    forYou,
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
    serviceRecommendations,
    serviceNames: serviceNamesMap,
    userPreferences,
  })
}
