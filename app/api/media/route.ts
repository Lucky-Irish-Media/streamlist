import { NextRequest, NextResponse } from 'next/server'
import { getMovieDetails, getTVDetails, getImageUrl, getMovieWatchProviders, getTVWatchProviders, getMovieReleaseDates, getTVContentRatings } from '@/lib/tmdb'

export const runtime = 'edge'

async function getCertification(mediaType: string, id: number, country: string) {
  try {
    if (mediaType === 'movie') {
      const releaseDates = await getMovieReleaseDates(id)
      const countryData = releaseDates.results.find(r => r.iso_3166_1 === country)
      if (countryData?.release_dates?.[0]?.certification) {
        return countryData.release_dates[0].certification
      }
      const usData = releaseDates.results.find(r => r.iso_3166_1 === 'US')
      return usData?.release_dates?.[0]?.certification || null
    } else {
      const contentRatings = await getTVContentRatings(id)
      const countryData = contentRatings.results.find(r => r.iso_3166_1 === country)
      if (countryData?.rating) {
        return countryData.rating
      }
      const usData = contentRatings.results.find(r => r.iso_3166_1 === 'US')
      return usData?.rating || null
    }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tmdbId = searchParams.get('id')
  const mediaType = searchParams.get('type')
  const country = searchParams.get('country') || 'US'

  if (!tmdbId || !mediaType) {
    return NextResponse.json({ error: 'Missing id or type' }, { status: 400 })
  }

  try {
    const id = Number(tmdbId)
    let detailsPromise: ReturnType<typeof getMovieDetails> | ReturnType<typeof getTVDetails>
    let providersPromise: ReturnType<typeof getMovieWatchProviders> | ReturnType<typeof getTVWatchProviders>

    if (mediaType === 'movie') {
      detailsPromise = getMovieDetails(id)
      providersPromise = getMovieWatchProviders(id)
    } else if (mediaType === 'tv') {
      detailsPromise = getTVDetails(id)
      providersPromise = getTVWatchProviders(id)
    } else {
      return NextResponse.json({ error: 'Invalid media type' }, { status: 400 })
    }

    const [item, providers, certification] = await Promise.all([
      detailsPromise,
      providersPromise,
      getCertification(mediaType, id, country)
    ])

    const countryData = providers.results?.[country]
    const flatrate = countryData?.flatrate || []

    return NextResponse.json({
      ...item,
      media_type: mediaType,
      image: getImageUrl(item.poster_path, 'w185'),
      certification,
      watchProviders: {
        country,
        flatrate: flatrate.map(p => ({
          provider_id: p.provider_id,
          provider_name: p.provider_name,
        })),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch media details' }, { status: 500 })
  }
}
