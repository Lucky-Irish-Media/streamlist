import { NextRequest, NextResponse } from 'next/server'
import { searchMulti, searchMovies, searchTVShows, getImageUrl } from '@/lib/tmdb'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')
  const type = searchParams.get('type')

  if (!query) {
    return NextResponse.json({ results: [] })
  }

  let data
  if (type === 'movie') {
    data = await searchMovies(query, 1)
  } else if (type === 'tv') {
    data = await searchTVShows(query, 1)
  } else {
    data = await searchMulti(query, 1)
  }

  let results
  if (type === 'movie' || type === 'tv') {
    results = data.results.slice(0, 20).map((item: any) => ({
      ...item,
      media_type: type,
    }))
  } else {
    results = data.results
      .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
      .slice(0, 20)
  }

  return NextResponse.json({
    results: results.map((item: any) => ({
      ...item,
      image: getImageUrl(item.poster_path, 'w185'),
    })),
  })
}