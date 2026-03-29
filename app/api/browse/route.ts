import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getTrending, getPopularMovies, getPopularTVShows, getNowPlaying, getOnTheAir, getImageUrl, discoverMovies, discoverTVShows } from '@/lib/tmdb'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tab = searchParams.get('tab') || 'trending'
  const page = parseInt(searchParams.get('page') || '1', 10)

  let results: any[] = []
  let totalPages = 1

  if (tab === 'trending') {
    const data = await getTrending('all', page)
    results = data.results.map((m: any) => ({
      ...m,
      mediaType: m.media_type || 'movie',
      image: getImageUrl(m.poster_path || m.backdrop_path)
    }))
    totalPages = data.total_pages
  } else if (tab === 'movies') {
    const data = await getPopularMovies(page)
    results = data.results.map((m: any) => ({
      ...m,
      mediaType: 'movie',
      image: getImageUrl(m.poster_path)
    }))
    totalPages = data.total_pages
  } else if (tab === 'tv') {
    const data = await getPopularTVShows(page)
    results = data.results.map((m: any) => ({
      ...m,
      mediaType: 'tv',
      image: getImageUrl(m.poster_path)
    }))
    totalPages = data.total_pages
  } else if (tab === 'new-movies') {
    const data = await getNowPlaying(page)
    results = data.results.map((m: any) => ({
      ...m,
      mediaType: 'movie',
      image: getImageUrl(m.poster_path)
    }))
    totalPages = data.total_pages
  } else if (tab === 'new-tv') {
    const data = await getOnTheAir(page)
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
}
