import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getImageUrl, getTMDBConfig } from '@/lib/tmdb'
import {
  cachedGetTrending,
  cachedGetPopularMovies,
  cachedGetPopularTVShows,
  cachedGetNowPlaying,
  cachedGetOnTheAir,
} from '@/lib/tmdb-cache'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    const { env } = getRequestContext()
    const tmdb = getTMDBConfig(env as any)

    if (!tmdb.apiKey) {
      console.error('TMDB_API_KEY is not set in environment variables')
      return NextResponse.json(
        {
          error: 'TMDB API key not configured',
          message: 'Please set TMDB_API_KEY in your Cloudflare Pages environment variables'
        },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(req.url)
    const tab = searchParams.get('tab') || 'trending'
    const page = parseInt(searchParams.get('page') || '1', 10)

    let results: any[] = []
    let totalPages = 1

    if (tab === 'trending') {
      const data = await cachedGetTrending('all', page, tmdb, env as any)
      results = data.results.map((m: any) => ({
        ...m,
        mediaType: m.media_type || 'movie',
        image: getImageUrl(m.poster_path || m.backdrop_path)
      }))
      totalPages = data.total_pages
    } else if (tab === 'movies') {
      const data = await cachedGetPopularMovies(page, tmdb, env as any)
      results = data.results.map((m: any) => ({
        ...m,
        mediaType: 'movie',
        image: getImageUrl(m.poster_path)
      }))
      totalPages = data.total_pages
    } else if (tab === 'tv') {
      const data = await cachedGetPopularTVShows(page, tmdb, env as any)
      results = data.results.map((m: any) => ({
        ...m,
        mediaType: 'tv',
        image: getImageUrl(m.poster_path)
      }))
      totalPages = data.total_pages
    } else if (tab === 'new-movies') {
      const data = await cachedGetNowPlaying(page, tmdb, env as any)
      results = data.results.map((m: any) => ({
        ...m,
        mediaType: 'movie',
        image: getImageUrl(m.poster_path)
      }))
      totalPages = data.total_pages
    } else if (tab === 'new-tv') {
      const data = await cachedGetOnTheAir(page, tmdb, env as any)
      results = data.results.map((m: any) => ({
        ...m,
        mediaType: 'tv',
        image: getImageUrl(m.poster_path)
      }))
      totalPages = data.total_pages
    }

    return NextResponse.json({
      results,
      page,
      totalPages,
      hasMore: page < totalPages
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in browse route:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', details: errorMessage },
      { status: 500 }
    )
  }
}
