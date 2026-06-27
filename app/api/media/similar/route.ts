import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getTMDBConfig, getMovieRecommendations, getTVRecommendations, getMovieSimilar, getTVSimilar } from '@/lib/tmdb'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const type = searchParams.get('type')

  if (!id || !type) {
    return NextResponse.json({ error: 'id and type are required' }, { status: 400 })
  }

  const tmdbId = parseInt(id)
  if (type !== 'movie' && type !== 'tv') {
    return NextResponse.json({ error: 'type must be movie or tv' }, { status: 400 })
  }

  try {
    const { env } = await getCloudflareContext({ async: true })
    const tmdb = getTMDBConfig(env as any)
    const isMovie = type === 'movie'

    const [recs, similar] = await Promise.all([
      isMovie ? getMovieRecommendations(tmdbId, 1, tmdb) : getTVRecommendations(tmdbId, 1, tmdb),
      isMovie ? getMovieSimilar(tmdbId, 1, tmdb) : getTVSimilar(tmdbId, 1, tmdb),
    ])

    const seen = new Set<number>()
    const items: Array<{
      id: number
      title: string | undefined
      media_type: string
      poster_path: string | null
      vote_average: number
      release_date: string | undefined
    }> = []

    for (const item of [...(recs?.results || []), ...(similar?.results || [])]) {
      if (!seen.has(item.id) && items.length < 20) {
        seen.add(item.id)
        items.push({
          id: item.id,
          title: item.title || item.name,
          media_type: type,
          poster_path: item.poster_path,
          vote_average: item.vote_average,
          release_date: item.release_date || item.first_air_date,
        })
      }
    }

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Failed to fetch similar items:', error)
    return NextResponse.json({ error: 'Failed to fetch similar items' }, { status: 500 })
  }
}
