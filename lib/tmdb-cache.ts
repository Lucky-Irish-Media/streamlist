import { kvGet, kvSet, KVBinding } from './kv'
import {
  fetchFromTMDB,
  getTrending,
  getPopularMovies,
  getPopularTVShows,
  getNowPlaying,
  getOnTheAir,
  getGenres,
  searchMulti,
  searchMovies,
  searchTVShows,
  discoverMovies,
  discoverTVShows,
  getWatchProviders,
  getTMDBConfig,
  TMDBConfig,
  TMDBResponse,
} from './tmdb'

export interface CacheConfig {
  ttl: number
  cacheable?: boolean
}

export const CACHE_TTL: Record<string, CacheConfig> = {
  trending: { ttl: 3600 },
  popularMovies: { ttl: 3600 },
  popularTVShows: { ttl: 3600 },
  nowPlaying: { ttl: 14400 },
  onTheAir: { ttl: 14400 },
  genres: { ttl: 86400 },
  watchProviders: { ttl: 86400 },
  searchMulti: { ttl: 900 },
  searchMovies: { ttl: 900 },
  searchTVShows: { ttl: 900 },
  discoverMovies: { ttl: 900 },
  discoverTVShows: { ttl: 900 },
}

function hashParams(params: Record<string, string | number | undefined>): string {
  const filtered = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(':')
  return filtered ? `:${filtered}` : ''
}

function buildCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `tmdb:${prefix}${parts.join(':')}`
}

export function getCachedTMDB<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  env: KVBinding,
  ttl: number
): Promise<T> {
  return kvGet<T>(env, cacheKey).then(cached => {
    if (cached !== null) {
      return cached
    }
    return fetcher().then(data => {
      kvSet(env, cacheKey, data, ttl)
      return data
    })
  }) as Promise<T>
}

export function cachedGetTrending(
  mediaType: 'all' | 'movie' | 'tv' = 'all',
  page = 1,
  tmdbConfig?: TMDBConfig,
  env?: KVBinding
): Promise<TMDBResponse> {
  const cacheKey = buildCacheKey('trending', mediaType, String(page))
  if (!env) {
    return getTrending(mediaType, page, tmdbConfig)
  }
  return getCachedTMDB(cacheKey, () => getTrending(mediaType, page, tmdbConfig), env, CACHE_TTL.trending.ttl)
}

export function cachedGetPopularMovies(
  page = 1,
  tmdbConfig?: TMDBConfig,
  env?: KVBinding
): Promise<TMDBResponse> {
  const cacheKey = buildCacheKey('popularMovies', String(page))
  if (!env) {
    return getPopularMovies(page, tmdbConfig)
  }
  return getCachedTMDB(cacheKey, () => getPopularMovies(page, tmdbConfig), env, CACHE_TTL.popularMovies.ttl)
}

export function cachedGetPopularTVShows(
  page = 1,
  tmdbConfig?: TMDBConfig,
  env?: KVBinding
): Promise<TMDBResponse> {
  const cacheKey = buildCacheKey('popularTVShows', String(page))
  if (!env) {
    return getPopularTVShows(page, tmdbConfig)
  }
  return getCachedTMDB(cacheKey, () => getPopularTVShows(page, tmdbConfig), env, CACHE_TTL.popularTVShows.ttl)
}

export function cachedGetNowPlaying(
  page = 1,
  tmdbConfig?: TMDBConfig,
  env?: KVBinding
): Promise<TMDBResponse> {
  const cacheKey = buildCacheKey('nowPlaying', String(page))
  if (!env) {
    return getNowPlaying(page, tmdbConfig)
  }
  return getCachedTMDB(cacheKey, () => getNowPlaying(page, tmdbConfig), env, CACHE_TTL.nowPlaying.ttl)
}

export function cachedGetOnTheAir(
  page = 1,
  tmdbConfig?: TMDBConfig,
  env?: KVBinding
): Promise<TMDBResponse> {
  const cacheKey = buildCacheKey('onTheAir', String(page))
  if (!env) {
    return getOnTheAir(page, tmdbConfig)
  }
  return getCachedTMDB(cacheKey, () => getOnTheAir(page, tmdbConfig), env, CACHE_TTL.onTheAir.ttl)
}

export function cachedGetGenres(
  mediaType: 'movie' | 'tv' | 'all' = 'all',
  tmdbConfig?: TMDBConfig,
  env?: KVBinding
): Promise<{ genres: { id: number; name: string }[] }> {
  const cacheKey = buildCacheKey('genres', mediaType)
  if (!env) {
    return getGenres(mediaType, tmdbConfig)
  }
  return getCachedTMDB(cacheKey, () => getGenres(mediaType, tmdbConfig), env, CACHE_TTL.genres.ttl)
}

export function cachedSearchMulti(
  query: string,
  page = 1,
  tmdbConfig?: TMDBConfig,
  env?: KVBinding
): Promise<TMDBResponse> {
  const cacheKey = buildCacheKey('searchMulti', query, String(page))
  if (!env) {
    return searchMulti(query, page, tmdbConfig)
  }
  return getCachedTMDB(cacheKey, () => searchMulti(query, page, tmdbConfig), env, CACHE_TTL.searchMulti.ttl)
}

export function cachedSearchMovies(
  query: string,
  page = 1,
  tmdbConfig?: TMDBConfig,
  env?: KVBinding
): Promise<TMDBResponse> {
  const cacheKey = buildCacheKey('searchMovies', query, String(page))
  if (!env) {
    return searchMovies(query, page, tmdbConfig)
  }
  return getCachedTMDB(cacheKey, () => searchMovies(query, page, tmdbConfig), env, CACHE_TTL.searchMovies.ttl)
}

export function cachedSearchTVShows(
  query: string,
  page = 1,
  tmdbConfig?: TMDBConfig,
  env?: KVBinding
): Promise<TMDBResponse> {
  const cacheKey = buildCacheKey('searchTVShows', query, String(page))
  if (!env) {
    return searchTVShows(query, page, tmdbConfig)
  }
  return getCachedTMDB(cacheKey, () => searchTVShows(query, page, tmdbConfig), env, CACHE_TTL.searchTVShows.ttl)
}

export function cachedDiscoverMovies(
  params: {
    with_genres?: string
    sort_by?: string
    page?: string
    language?: string
    with_watch_providers?: string
    watch_region?: string
  },
  tmdbConfig?: TMDBConfig,
  env?: KVBinding
): Promise<TMDBResponse> {
  const cacheKey = buildCacheKey('discoverMovies', hashParams(params as Record<string, string | number | undefined>))
  if (!env) {
    return discoverMovies(params, tmdbConfig)
  }
  return getCachedTMDB(cacheKey, () => discoverMovies(params, tmdbConfig), env, CACHE_TTL.discoverMovies.ttl)
}

export function cachedDiscoverTVShows(
  params: {
    with_genres?: string
    sort_by?: string
    page?: string
    language?: string
    with_watch_providers?: string
    watch_region?: string
  },
  tmdbConfig?: TMDBConfig,
  env?: KVBinding
): Promise<TMDBResponse> {
  const cacheKey = buildCacheKey('discoverTVShows', hashParams(params as Record<string, string | number | undefined>))
  if (!env) {
    return discoverTVShows(params, tmdbConfig)
  }
  return getCachedTMDB(cacheKey, () => discoverTVShows(params, tmdbConfig), env, CACHE_TTL.discoverTVShows.ttl)
}

export async function cachedGetWatchProviders(
  regions: string[] = ['US'],
  tmdbConfig?: TMDBConfig,
  env?: KVBinding
): Promise<{ provider_id: number; provider_name: string; logo_path: string }[]> {
  const cacheKey = buildCacheKey('watchProviders', regions.sort().join('-'))
  if (!env) {
    return getWatchProviders(regions, tmdbConfig)
  }
  return getCachedTMDB(cacheKey, () => getWatchProviders(regions, tmdbConfig), env, CACHE_TTL.watchProviders.ttl)
}

export { fetchFromTMDB, getTMDBConfig }
export type { TMDBConfig, TMDBResponse }
export { kvSet, kvGet } from './kv'
export { kvClearPrefix } from './kv'
