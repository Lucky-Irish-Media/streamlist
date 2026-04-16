import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getImageUrl, getTMDBConfig } from '@/lib/tmdb'
import { cachedSearchMulti, cachedSearchMovies, cachedSearchTVShows } from '@/lib/tmdb-cache'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { env } = getRequestContext()
  const tmdb = getTMDBConfig(env as any)
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')
  const type = searchParams.get('type')

  if (!query) {
    return NextResponse.json({ results: [] })
  }

  let data
  if (type === 'movie') {
    data = await cachedSearchMovies(query, 1, tmdb, env as any)
  } else if (type === 'tv') {
    data = await cachedSearchTVShows(query, 1, tmdb, env as any)
  } else {
    data = await cachedSearchMulti(query, 1, tmdb, env as any)
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
