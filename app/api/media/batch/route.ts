import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getMovieDetails, getTVDetails, getImageUrl, getMovieReleaseDates, getTVContentRatings, getMovieWatchProviders, getTVWatchProviders, getTMDBConfig, type TMDBConfig } from '@/lib/tmdb'

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
  certification: string | null
  providers?: number[]
}

async function getCertification(mediaType: string, id: number, tmdb: TMDBConfig): Promise<string | null> {
  try {
    if (mediaType === 'movie') {
      const releaseDates = await getMovieReleaseDates(id, tmdb)
      const usData = releaseDates.results.find(r => r.iso_3166_1 === 'US')
      if (usData?.release_dates) {
        for (const rd of usData.release_dates) {
          if (rd.certification) return rd.certification
        }
      }
      return null
    } else {
      const contentRatings = await getTVContentRatings(id, tmdb)
      const usData = contentRatings.results.find(r => r.iso_3166_1 === 'US')
      return usData?.rating || null
    }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const tmdb = getTMDBConfig(env as any)
  const { searchParams } = new URL(req.url)
  const idsParam = searchParams.get('ids')
  const includeProviders = searchParams.get('includeProviders') === 'true'
  const watchRegion = searchParams.get('watchRegion') || 'US'

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
          const [details, certification, providersData] = await Promise.all([
            mediaType === 'tv' ? getTVDetails(tmdbId, tmdb) : getMovieDetails(tmdbId, tmdb),
            getCertification(mediaType, tmdbId, tmdb),
            includeProviders
              ? (mediaType === 'tv' ? getTVWatchProviders(tmdbId, tmdb) : getMovieWatchProviders(tmdbId, tmdb))
              : Promise.resolve(null),
          ])

          const flatrateProviders = includeProviders && providersData
            ? (providersData.results?.[watchRegion]?.flatrate || []).map((p: any) => p.provider_id)
            : undefined

          return {
            id: details.id,
            title: details.title,
            name: details.name,
            media_type: mediaType as 'movie' | 'tv',
            image: getImageUrl(details.poster_path, 'w185'),
            poster_path: details.poster_path,
            vote_average: details.vote_average,
            release_date: details.release_date,
            first_air_date: details.first_air_date,
            genres: details.genres || [],
            certification,
            providers: flatrateProviders,
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
