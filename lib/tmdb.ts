export interface TMDBConfig {
  apiKey: string
  baseUrl?: string
}

export interface MediaItem {
  id: number
  title?: string
  name?: string
  media_type: 'movie' | 'tv'
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  vote_average: number
  release_date?: string
  first_air_date?: string
  genre_ids: number[]
}

export interface TMDBResponse {
  page: number
  results: MediaItem[]
  total_pages: number
  total_results: number
}

export interface Genre {
  id: number
  name: string
}

export interface StreamingProvider {
  provider_id: number
  provider_name: string
  logo_path: string
}

export interface Provider {
  provider_id: number
  provider_name: string
  logo_path: string
}

export interface Video {
  id: string
  key: string
  name: string
  site: string
  type: string
}

export async function fetchFromTMDB<T>(endpoint: string, params: Record<string, string> = {}, tmdbConfig?: TMDBConfig): Promise<T> {
  const apiKey = tmdbConfig?.apiKey || ''
  const baseUrl = tmdbConfig?.baseUrl || 'https://api.themoviedb.org/3'
  const url = new URL(`${baseUrl}${endpoint}`)
  url.searchParams.set('api_key', apiKey)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`TMDB API error: ${res.status}`)
  }
  return res.json()
}

export async function getTrending(mediaType: 'all' | 'movie' | 'tv' = 'all', page = 1, tmdbConfig?: TMDBConfig): Promise<TMDBResponse> {
  return fetchFromTMDB(`/trending/${mediaType}/week`, { page: String(page) }, tmdbConfig)
}

export async function getPopularMovies(page = 1, tmdbConfig?: TMDBConfig): Promise<TMDBResponse> {
  return fetchFromTMDB('/movie/popular', { page: String(page) }, tmdbConfig)
}

export async function getPopularTVShows(page = 1, tmdbConfig?: TMDBConfig): Promise<TMDBResponse> {
  return fetchFromTMDB('/tv/popular', { page: String(page) }, tmdbConfig)
}

export async function getNowPlaying(page = 1, tmdbConfig?: TMDBConfig): Promise<TMDBResponse> {
  return fetchFromTMDB('/movie/now_playing', { page: String(page) }, tmdbConfig)
}

export async function getOnTheAir(page = 1, tmdbConfig?: TMDBConfig): Promise<TMDBResponse> {
  return fetchFromTMDB('/tv/on_the_air', { page: String(page) }, tmdbConfig)
}

export async function getGenres(mediaType: 'movie' | 'tv' | 'all' = 'all', tmdbConfig?: TMDBConfig): Promise<{ genres: Genre[] }> {
  return fetchFromTMDB(`/genre/${mediaType}/list`, {}, tmdbConfig)
}

export async function discoverMovies(params: {
  with_genres?: string
  sort_by?: string
  page?: string
  language?: string
  with_watch_providers?: string
  watch_region?: string
}, tmdbConfig?: TMDBConfig): Promise<TMDBResponse> {
  return fetchFromTMDB('/discover/movie', params as Record<string, string>, tmdbConfig)
}

export async function discoverTVShows(params: {
  with_genres?: string
  sort_by?: string
  page?: string
  language?: string
  with_watch_providers?: string
  watch_region?: string
}, tmdbConfig?: TMDBConfig): Promise<TMDBResponse> {
  return fetchFromTMDB('/discover/tv', params as Record<string, string>, tmdbConfig)
}

export async function getMovieRecommendations(movieId: number, page = 1, tmdbConfig?: TMDBConfig): Promise<TMDBResponse> {
  return fetchFromTMDB(`/movie/${movieId}/recommendations`, { page: String(page) }, tmdbConfig)
}

export async function getTVRecommendations(tvId: number, page = 1, tmdbConfig?: TMDBConfig): Promise<TMDBResponse> {
  return fetchFromTMDB(`/tv/${tvId}/recommendations`, { page: String(page) }, tmdbConfig)
}

export async function getMovieSimilar(movieId: number, page = 1, tmdbConfig?: TMDBConfig): Promise<TMDBResponse> {
  return fetchFromTMDB(`/movie/${movieId}/similar`, { page: String(page) }, tmdbConfig)
}

export async function getTVSimilar(tvId: number, page = 1, tmdbConfig?: TMDBConfig): Promise<TMDBResponse> {
  return fetchFromTMDB(`/tv/${tvId}/similar`, { page: String(page) }, tmdbConfig)
}

export async function getMovieWatchProviders(movieId: number, tmdbConfig?: TMDBConfig): Promise<{
  results: Record<string, { flatrate?: StreamingProvider[]; free?: StreamingProvider[]; ads?: StreamingProvider[]; rent?: StreamingProvider[]; buy?: StreamingProvider[] }>
}> {
  return fetchFromTMDB(`/movie/${movieId}/watch/providers`, {}, tmdbConfig)
}

export async function getTVWatchProviders(tvId: number, tmdbConfig?: TMDBConfig): Promise<{
  results: Record<string, { flatrate?: StreamingProvider[]; free?: StreamingProvider[]; ads?: StreamingProvider[]; rent?: StreamingProvider[]; buy?: StreamingProvider[] }>
}> {
  return fetchFromTMDB(`/tv/${tvId}/watch/providers`, {}, tmdbConfig)
}

export async function getWatchProviders(regions: string[] = ['US'], tmdbConfig?: TMDBConfig): Promise<Provider[]> {
  const allProviders: Map<number, Provider> = new Map()

  for (const region of regions) {
    const [movieRes, tvRes] = await Promise.all([
      fetchFromTMDB<{ results: Provider[] }>('/watch/providers/movie', { region }, tmdbConfig),
      fetchFromTMDB<{ results: Provider[] }>('/watch/providers/tv', { region }, tmdbConfig),
    ])

    for (const provider of movieRes.results ?? []) {
      if (!allProviders.has(provider.provider_id)) {
        allProviders.set(provider.provider_id, provider)
      }
    }
    for (const provider of tvRes.results ?? []) {
      if (!allProviders.has(provider.provider_id)) {
        allProviders.set(provider.provider_id, provider)
      }
    }
  }

  return Array.from(allProviders.values()).sort((a, b) =>
    a.provider_name.localeCompare(b.provider_name)
  )
}

export async function searchMulti(query: string, page = 1, tmdbConfig?: TMDBConfig): Promise<TMDBResponse> {
  return fetchFromTMDB('/search/multi', { query, page: String(page) }, tmdbConfig)
}

export async function searchMovies(query: string, page = 1, tmdbConfig?: TMDBConfig): Promise<TMDBResponse> {
  return fetchFromTMDB('/search/movie', { query, page: String(page) }, tmdbConfig)
}

export async function searchTVShows(query: string, page = 1, tmdbConfig?: TMDBConfig): Promise<TMDBResponse> {
  return fetchFromTMDB('/search/tv', { query, page: String(page) }, tmdbConfig)
}

export async function getMovieDetails(movieId: number, tmdbConfig?: TMDBConfig): Promise<MediaItem & { genres: Genre[] }> {
  return fetchFromTMDB(`/movie/${movieId}`, {}, tmdbConfig)
}

export async function getTVDetails(tvId: number, tmdbConfig?: TMDBConfig): Promise<MediaItem & { genres: Genre[] }> {
  return fetchFromTMDB(`/tv/${tvId}`, {}, tmdbConfig)
}

export async function getMovieReleaseDates(movieId: number, tmdbConfig?: TMDBConfig): Promise<{
  results: Array<{ iso_3166_1: string; release_dates: Array<{ certification: string }> }>
}> {
  return fetchFromTMDB(`/movie/${movieId}/release_dates`, {}, tmdbConfig)
}

export async function getTVContentRatings(tvId: number, tmdbConfig?: TMDBConfig): Promise<{
  results: Array<{ iso_3166_1: string; rating: string }>
}> {
  return fetchFromTMDB(`/tv/${tvId}/content_ratings`, {}, tmdbConfig)
}

export async function getMovieVideos(movieId: number, tmdbConfig?: TMDBConfig): Promise<{ results: Video[] }> {
  return fetchFromTMDB(`/movie/${movieId}/videos`, {}, tmdbConfig)
}

export async function getTVSeriesVideos(tvId: number, tmdbConfig?: TMDBConfig): Promise<{ results: Video[] }> {
  return fetchFromTMDB(`/tv/${tvId}/videos`, {}, tmdbConfig)
}

export interface CollectionPart {
  id: number
  title: string
  name?: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string | null
  vote_average: number
}

export interface CollectionDetails {
  id: number
  name: string
  poster_path: string | null
  backdrop_path: string | null
  parts: CollectionPart[]
}

export async function getCollectionDetails(collectionId: number, tmdbConfig?: TMDBConfig): Promise<CollectionDetails> {
  return fetchFromTMDB(`/collection/${collectionId}`, {}, tmdbConfig)
}

export interface MovieKeywords {
  id: number
  keywords: { id: number; name: string }[]
}

export interface TVKeywords {
  id: number
  results: { id: number; name: string }[]
}

export async function getMovieKeywords(movieId: number, tmdbConfig?: TMDBConfig): Promise<MovieKeywords> {
  return fetchFromTMDB(`/movie/${movieId}/keywords`, {}, tmdbConfig)
}

export async function getTVKeywords(tvId: number, tmdbConfig?: TMDBConfig): Promise<TVKeywords> {
  return fetchFromTMDB(`/tv/${tvId}/keywords`, {}, tmdbConfig)
}

export async function discoverMoviesWithKeywords(params: {
  with_keywords?: string
  with_genres?: string
  vote_average_gte?: string
  vote_count_gte?: string
  sort_by?: string
  page?: string
  with_watch_providers?: string
  watch_region?: string
}, tmdbConfig?: TMDBConfig): Promise<TMDBResponse> {
  return fetchFromTMDB('/discover/movie', params as Record<string, string>, tmdbConfig)
}

export async function discoverTVShowsWithKeywords(params: {
  with_keywords?: string
  with_genres?: string
  vote_average_gte?: string
  vote_count_gte?: string
  sort_by?: string
  page?: string
  with_watch_providers?: string
  watch_region?: string
}, tmdbConfig?: TMDBConfig): Promise<TMDBResponse> {
  return fetchFromTMDB('/discover/tv', params as Record<string, string>, tmdbConfig)
}

export function getTMDBConfig(env: Record<string, unknown>): TMDBConfig {
  return {
    apiKey: (env.TMDB_API_KEY || env.NEXT_PUBLIC_TMDB_API_KEY || '') as string,
    baseUrl: (env.TMDB_API_BASE_URL || 'https://api.themoviedb.org/3') as string,
  }
}

export function getImageUrl(path: string | null, size: 'w185' | 'w500' | 'original' = 'w500'): string {
  if (!path) return '/placeholder.jpg'
  return `https://image.tmdb.org/t/p/${size}${path}`
}

export const STREAMING_SERVICES = [
  { id: 8, name: 'Netflix' },
  { id: 119, name: 'Amazon Prime Video' },
  { id: 257, name: 'Apple TV+' },
  { id: 330, name: 'Hulu' },
  { id: 337, name: 'Disney+' },
  { id: 387, name: 'HBO Max' },
  { id: 1899, name: 'Max' },
]

export const TMDB_GENRES = {
  movie: [
    { id: 28, name: 'Action' },
    { id: 12, name: 'Adventure' },
    { id: 16, name: 'Animation' },
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
    { id: 99, name: 'Documentary' },
    { id: 18, name: 'Drama' },
    { id: 10751, name: 'Family' },
    { id: 14, name: 'Fantasy' },
    { id: 36, name: 'History' },
    { id: 27, name: 'Horror' },
    { id: 10402, name: 'Music' },
    { id: 9648, name: 'Mystery' },
    { id: 10749, name: 'Romance' },
    { id: 878, name: 'Science Fiction' },
    { id: 10770, name: 'TV Movie' },
    { id: 53, name: 'Thriller' },
    { id: 10752, name: 'War' },
    { id: 37, name: 'Western' },
  ],
  tv: [
    { id: 10759, name: 'Action & Adventure' },
    { id: 16, name: 'Animation' },
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
    { id: 99, name: 'Documentary' },
    { id: 18, name: 'Drama' },
    { id: 10751, name: 'Family' },
    { id: 10762, name: 'Kids' },
    { id: 9648, name: 'Mystery' },
    { id: 10763, name: 'News' },
    { id: 10764, name: 'Reality' },
    { id: 10765, name: 'Sci-Fi & Fantasy' },
    { id: 10766, name: 'Soap' },
    { id: 10767, name: 'Talk' },
    { id: 10768, name: 'War & Politics' },
    { id: 37, name: 'Western' },
  ],
}