import { NextRequest, NextResponse } from 'next/server'
import { getMovieDetails, getTVDetails, getImageUrl, getMovieWatchProviders, getTVWatchProviders, getMovieReleaseDates, getTVContentRatings, getMovieVideos, getTVSeriesVideos } from '@/lib/tmdb'

export const runtime = 'edge'

async function getCertification(mediaType: string, id: number, country: string) {
  try {
    if (mediaType === 'movie') {
      const releaseDates = await getMovieReleaseDates(id)
      const findCertification = (isoCode: string) => {
        const data = releaseDates.results.find(r => r.iso_3166_1 === isoCode)
        if (!data?.release_dates) return null
        for (const rd of data.release_dates) {
          if (rd.certification) return rd.certification
        }
        return null
      }
      return findCertification(country) || findCertification('US') || null
    } else {
      const contentRatings = await getTVContentRatings(id)
      const findCertification = (isoCode: string) => {
        const data = contentRatings.results.find(r => r.iso_3166_1 === isoCode)
        return data?.rating || null
      }
      return findCertification(country) || findCertification('US') || null
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
    let videosPromise: ReturnType<typeof getMovieVideos> | ReturnType<typeof getTVSeriesVideos>

    if (mediaType === 'movie') {
      detailsPromise = getMovieDetails(id)
      providersPromise = getMovieWatchProviders(id)
      videosPromise = getMovieVideos(id)
    } else if (mediaType === 'tv') {
      detailsPromise = getTVDetails(id)
      providersPromise = getTVWatchProviders(id)
      videosPromise = getTVSeriesVideos(id)
    } else {
      return NextResponse.json({ error: 'Invalid media type' }, { status: 400 })
    }

    const [item, providers, certification, videos] = await Promise.all([
      detailsPromise,
      providersPromise,
      getCertification(mediaType, id, country),
      videosPromise
    ])

    const trailer = videos.results?.find(
      (v: any) => v.site === 'YouTube' && v.type === 'Trailer'
    )
    const trailerKey = trailer?.key || null

    const countryData = providers.results?.[country]
    const flatrate = countryData?.flatrate || []

    return NextResponse.json({
      ...item,
      media_type: mediaType,
      image: getImageUrl(item.poster_path, 'w185'),
      certification,
      trailerKey,
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
