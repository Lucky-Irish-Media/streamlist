import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getMovieDetails, getTVDetails, getImageUrl, getTMDBConfig, type TMDBConfig } from '@/lib/tmdb'

interface BatchItem {
  tmdbId: number
  mediaType: 'movie' | 'tv'
}

interface BatchResult {
  id: number
  title?: string
  name?: string
  media_type: 'movie' | 'tv'
  image: string
  poster_path: string | null
  vote_average: number
  release_date?: string
  first_air_date?: string
  genres: { id: number; name: string }[]
}

export async function GET(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const tmdb = getTMDBConfig(env as any)
  const { searchParams } = new URL(req.url)
  const idsParam = searchParams.get('ids')

  if (!idsParam) {
    return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 })
  }

  const items: BatchItem[] = idsParam.split(',').map((part) => {
    const [tmdbId, mediaType] = part.split('|')
    return {
      tmdbId: Number(tmdbId),
      mediaType: (mediaType || 'movie') as 'movie' | 'tv',
    }
  })

  try {
    const results = await Promise.all(
      items.map(async ({ tmdbId, mediaType }) => {
        try {
          if (mediaType === 'tv') {
            const details = await getTVDetails(tmdbId, tmdb)
            return {
              id: details.id,
              title: details.title,
              name: details.name,
              media_type: 'tv' as const,
              image: getImageUrl(details.poster_path, 'w185'),
              poster_path: details.poster_path,
              vote_average: details.vote_average,
              release_date: details.release_date,
              first_air_date: details.first_air_date,
              genres: details.genres || [],
            }
          } else {
            const details = await getMovieDetails(tmdbId, tmdb)
            return {
              id: details.id,
              title: details.title,
              name: details.name,
              media_type: 'movie' as const,
              image: getImageUrl(details.poster_path, 'w185'),
              poster_path: details.poster_path,
              vote_average: details.vote_average,
              release_date: details.release_date,
              first_air_date: details.first_air_date,
              genres: details.genres || [],
            }
          }
        } catch {
          return null
        }
      })
    )

    const validResults = results.filter(Boolean) as BatchResult[]
    return NextResponse.json({ items: validResults })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch batch media' }, { status: 500 })
  }
}
