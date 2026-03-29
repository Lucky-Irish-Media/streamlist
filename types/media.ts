export interface MediaItem {
  id: number
  title?: string
  name?: string
  media_type?: string
  mediaType?: string
  image: string
  vote_average?: number
  overview?: string
  poster_path?: string
  backdrop_path?: string
  release_date?: string
  first_air_date?: string
  genres?: Genre[]
  certification?: string | null
}

export interface Genre {
  id: number
  name: string
}

export interface WatchlistItem {
  tmdbId: number
  mediaType: string
  addedAt?: string
}

export interface User {
  id: string
  username: string
  country: string
  streamingServices: string[]
  genres: number[]
  likes: LikeItem[]
  hasCompletedOnboarding: boolean
  apiKey: string | null
}

export interface LikeItem {
  tmdbId: number
  mediaType: string
  title: string
}

export interface MediaDetails extends MediaItem {
  runtime?: number
  episode_run_time?: number[]
  number_of_seasons?: number
  number_of_episodes?: number
  watchProviders?: WatchProviders
}

export interface WatchProviders {
  flatrate?: Provider[]
  rent?: Provider[]
  buy?: Provider[]
  country: string
}

export interface Provider {
  provider_id: number
  provider_name: string
  logo_path: string
}

export interface RecommendationsData {
  recommendations?: MediaItem[]
  trending?: MediaItem[]
  movies?: MediaItem[]
  tv?: MediaItem[]
  newReleases?: {
    movies?: MediaItem[]
    tv?: MediaItem[]
  }
}
