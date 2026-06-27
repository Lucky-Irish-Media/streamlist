import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getSessionUser, parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import {
  getImageUrl, fetchFromTMDB,
  getMovieRecommendations, getTVRecommendations,
  getMovieSimilar, getTVSimilar,
  getMovieKeywords, getTVKeywords,
  getMovieDetails, getTVDetails,
  getMovieWatchProviders, getTVWatchProviders,
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
} from '@/lib/tmdb-cache'


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
  providers?: number[]
  score: number
  matchReasons: string[]
  sourceSeedId?: number
}

interface SeedInfo {
  tmdbId: number
  mediaType: string
  title?: string
  source: 'like' | 'watched' | 'watchlist'
  timestamp: Date | null
}

interface SeedBasedRow {
  seedTitle: string
  seedImage: string
  seedTmdbId: number
  items: ScoredItem[]
}

function randomPage() {
  return String(Math.floor(Math.random() * 5) + 1)
}

function getSignalWeight(source: string): number {
  switch (source) {
    case 'like': return 3
    case 'watchlist': return 2
    case 'watched': return 1
    default: return 1
  }
}

function getTemporalMultiplier(timestamp: Date | null): number {
  if (!timestamp) return 1.0
  const ms = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp.getTime()
  const monthsAgo = (Date.now() - ms) / (1000 * 60 * 60 * 24 * 30.44)
  return Math.max(0.5, 1 - monthsAgo * 0.05)
}

function computeGenreSimilarity(a: ScoredItem, b: ScoredItem): number {
  const aGenres = new Set(a.genre_ids || [])
  const bGenres = new Set(b.genre_ids || [])
  if (aGenres.size === 0 && bGenres.size === 0) return 0
  const intersection = [...aGenres].filter(g => bGenres.has(g))
  const union = new Set([...aGenres, ...bGenres])
  return intersection.length / union.size
}

function maximizeMarginalRelevance(items: ScoredItem[], lambda: number = 0.7, k: number = 10): ScoredItem[] {
  if (items.length <= k) return items

  const selected: ScoredItem[] = [items[0]]
  const remaining = items.slice(1)

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = -1
    let bestScore = -Infinity

    for (let i = 0; i < remaining.length; i++) {
      const relevance = remaining[i].score
      let maxSim = 0
      for (const sel of selected) {
        const sim = computeGenreSimilarity(remaining[i], sel)
        maxSim = Math.max(maxSim, sim)
      }
      const mmrScore = lambda * relevance - (1 - lambda) * maxSim * 10
      if (mmrScore > bestScore) {
        bestScore = mmrScore
        bestIdx = i
      }
    }

    if (bestIdx >= 0) {
      selected.push(remaining[bestIdx])
      remaining.splice(bestIdx, 1)
    }
  }

  return [...selected, ...remaining]
}

async function buildHybridRecommendations(
  likes: { tmdbId: number; mediaType: string; title: string }[],
  genres: number[],
  streamingServices: { id: string; name: string }[],
  watchlist: { tmdbId: number; mediaType: string; addedAt?: Date }[],
  watched: { tmdbId: number; mediaType: string; title?: string; watchedAt?: Date }[],
  dismissed: { tmdbId: number; mediaType: string }[],
  countries: string[],
  tmdb: TMDBConfig,
  refresh?: boolean,
): Promise<{ forYou: ScoredItem[]; seedBasedRows: SeedBasedRow[] }> {
  const excludeIds = new Set([
    ...likes.map(l => l.tmdbId),
    ...watchlist.map(w => w.tmdbId),
    ...watched.map(w => w.tmdbId),
    ...dismissed.map(d => d.tmdbId),
  ])

  const region = countries?.[0] || 'US'
  const activeProviderIds = streamingServices.map(s => s.id)
  const scored = new Map<number, ScoredItem>()
  const apiCallTracker = { count: 0 }
  const MAX_CALLS = 20

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
    sourceSeedId?: number,
    providerIds?: number[],
  ) => {
    if (excludeIds.has(item.id)) return
    const existing = scored.get(item.id)
    if (existing) {
      existing.score += points
      if (!existing.matchReasons.includes(reason)) {
        existing.matchReasons.push(reason)
      }
      if (sourceSeedId !== undefined && existing.sourceSeedId === undefined) {
        existing.sourceSeedId = sourceSeedId
      }
      if (providerIds) {
        existing.providers = [...new Set([...(existing.providers || []), ...providerIds])]
      }
    } else {
      const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie')
      scored.set(item.id, {
        ...item,
        mediaType,
        image: getImageUrl(item.poster_path),
        score: points,
        matchReasons: [reason],
        sourceSeedId,
        providers: providerIds,
      })
    }
  }

  const detailCache = new Map<number, { genres: number[]; keywordIds: number[] }>()

  const fetchItemDetails = async (seed: SeedInfo) => {
    if (detailCache.has(seed.tmdbId)) return detailCache.get(seed.tmdbId)!

    const isMovie = seed.mediaType === 'movie'
    const [details, keywords] = await Promise.all([
      fetchWithBudget(() => isMovie
        ? getMovieDetails(seed.tmdbId, tmdb)
        : getTVDetails(seed.tmdbId, tmdb)),
      fetchWithBudget(async () => {
        if (isMovie) {
          return await getMovieKeywords(seed.tmdbId, tmdb)
        } else {
          return await getTVKeywords(seed.tmdbId, tmdb)
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
    detailCache.set(seed.tmdbId, result)
    return result
  }

  // ── Build seed pool from all signals ──
  const seedPool: SeedInfo[] = []

  for (const like of likes) {
    seedPool.push({ tmdbId: like.tmdbId, mediaType: like.mediaType, title: like.title, source: 'like', timestamp: null })
  }
  for (const w of watched) {
    seedPool.push({ tmdbId: w.tmdbId, mediaType: w.mediaType, title: w.title, source: 'watched', timestamp: w.watchedAt || null })
  }
  for (const w of watchlist) {
    seedPool.push({ tmdbId: w.tmdbId, mediaType: w.mediaType, source: 'watchlist', timestamp: w.addedAt || null })
  }

  // Deduplicate by tmdbId, keeping highest priority source
  const priorityOrder: Record<string, number> = { like: 3, watchlist: 2, watched: 1 }
  const seen = new Map<number, SeedInfo>()
  for (const s of seedPool) {
    const existing = seen.get(s.tmdbId)
    if (!existing || (priorityOrder[s.source] > priorityOrder[existing.source])) {
      seen.set(s.tmdbId, s)
    }
  }

  const topSeeds = Array.from(seen.values()).slice(0, 5)

  // ── Fetch details for all seeds (feeds genre/keyword vectors) ──
  const detailsResults = await Promise.all(topSeeds.map(fetchItemDetails))

  const genreCounts = new Map<number, number>()
  const allKeywordIds: number[] = []

  for (let i = 0; i < detailsResults.length; i++) {
    const detail = detailsResults[i]
    const seed = topSeeds[i]
    if (!detail) continue
    const weight = getSignalWeight(seed.source) * getTemporalMultiplier(seed.timestamp)
    for (const gid of detail.genres) {
      genreCounts.set(gid, (genreCounts.get(gid) || 0) + weight)
    }
    allKeywordIds.push(...detail.keywordIds)
  }

  for (const gid of genres) {
    genreCounts.set(gid, (genreCounts.get(gid) || 0) + 1)
  }

  const topGenreIds = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)

  const uniqueKeywordIds = Array.from(new Set(allKeywordIds)).slice(0, 10)

  // ── Phase 1: Seed-based pool (always runs) ──
  const phase1Pool: { item: MediaItem; tmdbId: number }[] = []

  for (const seed of topSeeds) {
    const signalWeight = getSignalWeight(seed.source)
    const temporalMult = getTemporalMultiplier(seed.timestamp)
    const effectiveWeight = signalWeight * temporalMult
    const isMovie = seed.mediaType === 'movie'

    const [recs, similar] = await Promise.all([
      fetchWithBudget(() => isMovie
        ? getMovieRecommendations(seed.tmdbId, 1, tmdb)
        : getTVRecommendations(seed.tmdbId, 1, tmdb)),
      fetchWithBudget(() => isMovie
        ? getMovieSimilar(seed.tmdbId, 1, tmdb)
        : getTVSimilar(seed.tmdbId, 1, tmdb)),
    ])
    if (recs) {
      for (const item of recs.results.slice(0, 10)) {
        phase1Pool.push({ item, tmdbId: seed.tmdbId })
      }
    }
    if (similar) {
      for (const item of similar.results.slice(0, 10)) {
        phase1Pool.push({ item, tmdbId: seed.tmdbId })
      }
    }
  }

  // Tag Phase 1 items with provider availability
  if (phase1Pool.length > 0) {
    const verifyBudget = { count: 0 }
    const MAX_VERIFY = 20
    const fetchWithVerify = async (fn: () => Promise<number[]>): Promise<number[] | null> => {
      if (verifyBudget.count >= MAX_VERIFY) return null
      verifyBudget.count++
      try { return await fn() } catch { return null }
    }

    // Deduplicate by item id
    const uniqueItems = new Map<number, { item: MediaItem; tmdbId: number }>()
    for (const entry of phase1Pool) {
      if (!uniqueItems.has(entry.item.id)) {
        uniqueItems.set(entry.item.id, entry)
      }
    }
    const uniquePhase1Items = Array.from(uniqueItems.values())

    const verifyResults = await Promise.all(
      uniquePhase1Items.map(entry =>
        fetchWithVerify(async () => {
          const isMovie = entry.item.media_type === 'movie' || !entry.item.first_air_date
          const data = isMovie
            ? await getMovieWatchProviders(entry.item.id, tmdb)
            : await getTVWatchProviders(entry.item.id, tmdb)
          const regionData = data?.results?.[region]
          const availableProviders = [
            ...(regionData?.flatrate || []),
            ...(regionData?.rent || []),
            ...(regionData?.buy || []),
          ].map((p: { provider_id: number }) => p.provider_id)
          return availableProviders.filter(id => activeProviderIds.includes(String(id)))
        })
      )
    )

    for (let i = 0; i < uniquePhase1Items.length; i++) {
      const matchedProviderIds = verifyResults[i]
      if (matchedProviderIds === null) continue
      const seed = topSeeds.find(s => s.tmdbId === uniquePhase1Items[i].tmdbId)
      const weight = seed
        ? getSignalWeight(seed.source) * getTemporalMultiplier(seed.timestamp)
        : 1
      addItem(uniquePhase1Items[i].item, 'seed', weight, uniquePhase1Items[i].tmdbId, matchedProviderIds)
    }
  }

  // ── Phase 2: Genre-weighted discovery with provider tagging ──
  if (topGenreIds.length > 0 && activeProviderIds.length > 0 && apiCallTracker.count < MAX_CALLS) {
    const genreStr = topGenreIds.join(',')
    const providerIds = activeProviderIds.slice(0, 3)

    const discoverPromises: Promise<void>[] = []

    for (const providerId of providerIds) {
      discoverPromises.push(
        (async () => {
          const params = {
            with_genres: genreStr,
            vote_average_gte: '6.5',
            vote_count_gte: '100',
            sort_by: 'vote_average.desc',
            page: refresh ? randomPage() : '1',
            with_watch_providers: providerId,
            watch_region: region,
          }
          const [movies, tv] = await Promise.all([
            fetchWithBudget(() => discoverMovies(params, tmdb)),
            fetchWithBudget(() => discoverTVShows(params, tmdb)),
          ])
          if (movies) {
            for (const item of movies.results.slice(0, 10)) {
              addItem(item, 'genre', 2, undefined, [Number(providerId)])
            }
          }
          if (tv) {
            for (const item of tv.results.slice(0, 10)) {
              addItem(item, 'genre', 2, undefined, [Number(providerId)])
            }
          }
        })()
      )
    }

    await Promise.all(discoverPromises)
  }

  // ── Phase 3: Keyword discovery with provider tagging ──
  if (uniqueKeywordIds.length > 0 && activeProviderIds.length > 0 && apiCallTracker.count < MAX_CALLS) {
    const keywordStr = uniqueKeywordIds.join('|')
    const providerIds = activeProviderIds.slice(0, 3)

    const keywordPromises: Promise<void>[] = []

    for (const providerId of providerIds) {
      keywordPromises.push(
        (async () => {
          const keywordParams: Record<string, string> = {
            with_keywords: keywordStr,
            vote_average_gte: '6.0',
            vote_count_gte: '50',
            sort_by: 'popularity.desc',
            page: refresh ? randomPage() : '1',
            with_watch_providers: providerId,
            watch_region: region,
          }
          const [movies, tv] = await Promise.all([
            fetchWithBudget(() => fetchFromTMDB<TMDBResponse>('/discover/movie', keywordParams, tmdb)),
            fetchWithBudget(() => fetchFromTMDB<TMDBResponse>('/discover/tv', keywordParams, tmdb)),
          ])
          if (movies) {
            for (const item of movies.results.slice(0, 10)) {
              addItem(item, 'keyword', 1, undefined, [Number(providerId)])
            }
          }
          if (tv) {
            for (const item of tv.results.slice(0, 10)) {
              addItem(item, 'keyword', 1, undefined, [Number(providerId)])
            }
          }
        })()
      )
    }

    await Promise.all(keywordPromises)
  }

  // ── Compute dismissal genre penalty ──
  const dismissedGenrePenalty = new Map<number, number>()
  if (dismissed.length > 0) {
    // Fetch genre details for up to 5 dismissed items within budget
    const dismissDetails = await Promise.all(
      dismissed.slice(0, 5).map(async (d) => {
        const isMovie = d.mediaType === 'movie'
        return fetchWithBudget(() => isMovie
          ? getMovieDetails(d.tmdbId, tmdb)
          : getTVDetails(d.tmdbId, tmdb))
      })
    )
    for (const details of dismissDetails) {
      if (details?.genres) {
        for (const g of details.genres) {
          dismissedGenrePenalty.set(g.id, (dismissedGenrePenalty.get(g.id) || 0) + 1)
        }
      }
    }
  }

  // ── Sort by score desc, then vote_average desc ──
  const sorted = Array.from(scored.values())
    .sort((a, b) => (b.score - a.score) || ((b.vote_average || 0) - (a.vote_average || 0)))

  // ── Apply dismissal genre penalty ──
  for (const item of sorted) {
    const genres = item.genre_ids || []
    let penalty = 0
    for (const gid of genres) {
      const count = dismissedGenrePenalty.get(gid) || 0
      penalty += count * 0.1
    }
    item.score = item.score * Math.max(0.2, 1 - penalty)
  }

  // Re-sort after penalty
  sorted.sort((a, b) => (b.score - a.score) || ((b.vote_average || 0) - (a.vote_average || 0)))

  // ── Diversity re-ranking (MMR) ──
  const diversified = maximizeMarginalRelevance(sorted, 0.7, 15)
  const forYou = diversified.slice(0, 50)

  // ── Build seed-based category rows ──
  const seedBasedRows: SeedBasedRow[] = []
  for (const seed of topSeeds) {
    const seedItems = forYou.filter(item => item.sourceSeedId === seed.tmdbId).slice(0, 10)
    if (seedItems.length > 0 && seed.title) {
      seedBasedRows.push({
        seedTitle: seed.title,
        seedTmdbId: seed.tmdbId,
        seedImage: getImageUrl(null),
        items: seedItems,
      })
    }
  }

  return { forYou, seedBasedRows }
}

export async function GET(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const dbEnv = { DB: (env as any)?.DB }
  const tmdb = getTMDBConfig(env as any)
  const refresh = req.nextUrl.searchParams.get('refresh') === '1'
  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }

  let userPreferences: {
    streamingServices: { id: string; name: string }[]
    genres: number[]
    likes: { tmdbId: number; mediaType: string; title: string }[]
    watchlist: { tmdbId: number; mediaType: string; addedAt?: Date }[]
    watched: { tmdbId: number; mediaType: string; title?: string; watchedAt?: Date }[]
    dismissed: { tmdbId: number; mediaType: string }[]
    countries: string[]
  } = { streamingServices: [], genres: [], likes: [], watchlist: [], watched: [], dismissed: [], countries: ['US'] }

  if (sessionId && dbEnv.DB) {
    const userId = await getSessionUser(dbEnv, sessionId)
    if (userId) {
      const db = getDB(dbEnv)

      const [streamingServices, genres, likes, watchlistItems, watchedItems, dismissedItems, users] = await Promise.all([
        db.select().from(schema.userStreamingServices).where(eq(schema.userStreamingServices.userId, userId)).all(),
        db.select().from(schema.userGenres).where(eq(schema.userGenres.userId, userId)).all(),
        db.select().from(schema.userLikes).where(eq(schema.userLikes.userId, userId)).all(),
        db.select({
          tmdbId: schema.watchlistItems.tmdbId,
          mediaType: schema.watchlistItems.mediaType,
          addedAt: schema.watchlistItems.addedAt,
        })
          .from(schema.watchlistItems)
          .innerJoin(schema.watchlists, eq(schema.watchlistItems.listId, schema.watchlists.id))
          .where(eq(schema.watchlists.userId, userId)).all(),
        db.select({
          tmdbId: schema.watched.tmdbId,
          mediaType: schema.watched.mediaType,
          title: schema.watched.title,
          watchedAt: schema.watched.watchedAt,
        })
          .from(schema.watched)
          .where(eq(schema.watched.userId, userId)).all(),
        db.select().from(schema.dismissedRecommendations).where(eq(schema.dismissedRecommendations.userId, userId)).all(),
        db.select().from(schema.users).where(eq(schema.users.id, userId)).all(),
      ])

      userPreferences = {
        streamingServices: streamingServices.map(s => ({ id: s.serviceId, name: s.serviceName })),
        genres: genres.map(g => g.genreId),
        likes: likes.map(l => ({ tmdbId: l.tmdbId, mediaType: l.mediaType, title: l.title })),
        watchlist: watchlistItems.map(w => ({ tmdbId: w.tmdbId, mediaType: w.mediaType, addedAt: w.addedAt })),
        watched: watchedItems.map(w => ({ tmdbId: w.tmdbId, mediaType: w.mediaType, title: w.title, watchedAt: w.watchedAt })),
        dismissed: dismissedItems.map(d => ({ tmdbId: d.tmdbId, mediaType: d.mediaType })),
        countries: users[0]?.countries ? JSON.parse(users[0].countries) : ['US'],
      }
    }
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
  const { forYou, seedBasedRows } = await buildHybridRecommendations(
    userPreferences.likes,
    userPreferences.genres,
    userPreferences.streamingServices,
    userPreferences.watchlist,
    userPreferences.watched,
    userPreferences.dismissed,
    userPreferences.countries,
    tmdb,
    refresh,
  )

  return NextResponse.json({
    forYou,
    seedBasedRows,
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
    userPreferences,
  })
}
