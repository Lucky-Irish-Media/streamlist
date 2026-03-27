const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY || ''
const BASE_URL = process.env.TMDB_API_BASE_URL || 'https://api.themoviedb.org/3'

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

export async function fetchFromTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`)
  url.searchParams.set('api_key', TMDB_API_KEY)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`TMDB API error: ${res.status}`)
  }
  return res.json()
}

export async function getTrending(mediaType: 'all' | 'movie' | 'tv' = 'all', page = 1): Promise<TMDBResponse> {
  return fetchFromTMDB(`/trending/${mediaType}/week`, { page: String(page) })
}

export async function getPopularMovies(page = 1): Promise<TMDBResponse> {
  return fetchFromTMDB('/movie/popular', { page: String(page) })
}

export async function getPopularTVShows(page = 1): Promise<TMDBResponse> {
  return fetchFromTMDB('/tv/popular', { page: String(page) })
}

export async function getNowPlaying(page = 1): Promise<TMDBResponse> {
  return fetchFromTMDB('/movie/now_playing', { page: String(page) })
}

export async function getOnTheAir(page = 1): Promise<TMDBResponse> {
  return fetchFromTMDB('/tv/on_the_air', { page: String(page) })
}

export async function getGenres(mediaType: 'movie' | 'tv' | 'all' = 'all'): Promise<{ genres: Genre[] }> {
  return fetchFromTMDB(`/genre/${mediaType}/list`)
}

export async function discoverMovies(params: {
  with_genres?: string
  sort_by?: string
  page?: string
  language?: string
}): Promise<TMDBResponse> {
  return fetchFromTMDB('/discover/movie', params as Record<string, string>)
}

export async function discoverTVShows(params: {
  with_genres?: string
  sort_by?: string
  page?: string
  language?: string
}): Promise<TMDBResponse> {
  return fetchFromTMDB('/discover/tv', params as Record<string, string>)
}

export async function getMovieRecommendations(movieId: number, page = 1): Promise<TMDBResponse> {
  return fetchFromTMDB(`/movie/${movieId}/recommendations`, { page: String(page) })
}

export async function getTVRecommendations(tvId: number, page = 1): Promise<TMDBResponse> {
  return fetchFromTMDB(`/tv/${tvId}/recommendations`, { page: String(page) })
}

export async function getMovieSimilar(movieId: number, page = 1): Promise<TMDBResponse> {
  return fetchFromTMDB(`/movie/${movieId}/similar`, { page: String(page) })
}

export async function getTVSimilar(tvId: number, page = 1): Promise<TMDBResponse> {
  return fetchFromTMDB(`/tv/${tvId}/similar`, { page: String(page) })
}

export async function getMovieWatchProviders(movieId: number): Promise<{
  results: Record<string, { flatrate?: StreamingProvider[] }>
}> {
  return fetchFromTMDB(`/movie/${movieId}/watch/providers`)
}

export async function getTVWatchProviders(tvId: number): Promise<{
  results: Record<string, { flatrate?: StreamingProvider[] }>
}> {
  return fetchFromTMDB(`/tv/${tvId}/watch/providers`)
}

export async function searchMulti(query: string, page = 1): Promise<TMDBResponse> {
  return fetchFromTMDB('/search/multi', { query, page: String(page) })
}

export async function searchMovies(query: string, page = 1): Promise<TMDBResponse> {
  return fetchFromTMDB('/search/movie', { query, page: String(page) })
}

export async function searchTVShows(query: string, page = 1): Promise<TMDBResponse> {
  return fetchFromTMDB('/search/tv', { query, page: String(page) })
}

export async function getMovieDetails(movieId: number): Promise<MediaItem & { genres: Genre[] }> {
  return fetchFromTMDB(`/movie/${movieId}`)
}

export async function getTVDetails(tvId: number): Promise<MediaItem & { genres: Genre[] }> {
  return fetchFromTMDB(`/tv/${tvId}`)
}

export function getImageUrl(path: string | null, size: 'w185' | 'w500' | 'original' = 'w500'): string {
  if (!path) return '/placeholder.jpg'
  return `https://image.tmdb.org/t/p/${size}${path}`
}

export const STREAMING_SERVICES = [
  { id: 8, name: 'Netflix', logo: 'https://image.tmdb.org/t/p/original/gyKiV5zz3R1A22vh5t2t3J9J3u5.png' },
  { id: 119, name: 'Amazon Prime Video', logo: 'https://image.tmdb.org/t/p/original/68H1O16Hg2zrkcD1p1Q0f2vKk2F.png' },
  { id: 213, name: 'Netflix', logo: 'https://image.tmdb.org/t/p/original/pezA5BtCpG8u2q6b6xI3w1I7n1g.png' },
  { id: 257, name: 'Apple TV+', logo: 'https://image.tmdb.org/t/p/original/4Z7yA0n2PEX3YKD3VXt2T4J3kHH.png' },
  { id: 330, name: 'Hulu', logo: 'https://image.tmdb.org/t/p/original/yHZ2W3Ek9D2w1v2D7rT1Bj6g6aG.png' },
  { id: 387, name: 'HBO Max', logo: 'https://image.tmdb.org/t/p/original/yZBqkV464dCw4qpoXqHZIK3PTHF.png' },
  { id: 420, name: 'Apple TV+', logo: 'https://image.tmdb.org/t/p/original/4Z7yA0n2PEX3YKD3VXt2T4J3kHH.png' },
  { id: 1899, name: 'Max', logo: 'https://image.tmdb.org/t/p/original/cuC3fY3lJ7L7F1Y7X2z8Y7J3.png' },
  { id: 337, name: 'Disney+', logo: 'https://image.tmdb.org/t/p/original/7Q53I7Cl85lX95bK2xT3f4j1B2a.png' },
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