import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getMovieDetails, getTVDetails, getImageUrl, getMovieWatchProviders, getTVWatchProviders, getMovieReleaseDates, getTVContentRatings, getMovieVideos, getTVSeriesVideos, getCollectionDetails, getTVSeasons, getTMDBConfig, type TMDBConfig } from '@/lib/tmdb'

export const runtime = 'edge'

async function getCertification(mediaType: string, id: number, country: string, tmdb: TMDBConfig) {
  try {
    if (mediaType === 'movie') {
      const releaseDates = await getMovieReleaseDates(id, tmdb)
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
      const contentRatings = await getTVContentRatings(id, tmdb)
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
  const { env } = getRequestContext()
  const tmdb = getTMDBConfig(env as any)
  const { searchParams } = new URL(req.url)
  const tmdbId = searchParams.get('id')
  const mediaType = searchParams.get('type')
  const countriesParam = searchParams.get('countries') || 'US'
  const countries = countriesParam.split(',')

  if (!tmdbId || !mediaType) {
    return NextResponse.json({ error: 'Missing id or type' }, { status: 400 })
  }

  try {
    const id = Number(tmdbId)
    let detailsPromise: ReturnType<typeof getMovieDetails> | ReturnType<typeof getTVDetails>
    let providersPromise: ReturnType<typeof getMovieWatchProviders> | ReturnType<typeof getTVWatchProviders>
    let videosPromise: ReturnType<typeof getMovieVideos> | ReturnType<typeof getTVSeriesVideos>

    if (mediaType === 'movie') {
      detailsPromise = getMovieDetails(id, tmdb)
      providersPromise = getMovieWatchProviders(id, tmdb)
      videosPromise = getMovieVideos(id, tmdb)
    } else if (mediaType === 'tv') {
      detailsPromise = getTVDetails(id, tmdb)
      providersPromise = getTVWatchProviders(id, tmdb)
      videosPromise = getTVSeriesVideos(id, tmdb)
    } else {
      return NextResponse.json({ error: 'Invalid media type' }, { status: 400 })
    }

    const [item, providers, certification, videos, seasons] = await Promise.all([
      detailsPromise,
      providersPromise,
      getCertification(mediaType, id, countries[0], tmdb),
      videosPromise,
      mediaType === 'tv' ? getTVSeasons(id, tmdb) : Promise.resolve(null)
    ])

    let collection = null
    if (mediaType === 'movie' && (item as any).belongs_to_collection) {
      try {
        collection = await getCollectionDetails((item as any).belongs_to_collection.id, tmdb)
      } catch {
        collection = null
      }
    }

    const trailer = videos.results?.find(
      (v: any) => v.site === 'YouTube' && v.type === 'Trailer'
    )
    const trailerKey = trailer?.key || null

    type ProviderEntry = { provider_id: number; provider_name: string; regions: string[]; type: string }
    const providerMap = new Map<number, ProviderEntry>()

    const providerTypes = [
      { key: 'flatrate', label: 'Subscription' },
      { key: 'free', label: 'Free' },
      { key: 'ads', label: 'Ads' },
      { key: 'rent', label: 'Rent' },
      { key: 'buy', label: 'Buy' },
    ]

    for (const country of countries) {
      const countryData = providers.results?.[country]
      for (const { key, label } of providerTypes) {
        const providerList = countryData?.[key as keyof typeof countryData] as any[] | undefined
        if (!providerList) continue
        for (const p of providerList as any[]) {
          if (providerMap.has(p.provider_id)) {
            const existing = providerMap.get(p.provider_id)!
            if (!existing.regions.includes(country)) {
              existing.regions.push(country)
            }
          } else {
            providerMap.set(p.provider_id, {
              provider_id: p.provider_id,
              provider_name: p.provider_name,
              regions: [country],
              type: label,
            })
          }
        }
      }
    }

    const flatrate = Array.from(providerMap.values())

    const debug = {
      countriesRequested: countries,
      providerCount: flatrate.length,
      providers: flatrate.slice(0, 3).map(p => ({ id: p.provider_id, name: p.provider_name })),
      rawResultsKeys: providers.results ? Object.keys(providers.results) : [],
    }

    return NextResponse.json({
      ...item,
      media_type: mediaType,
      image: getImageUrl(item.poster_path, 'w185'),
      certification,
      trailerKey,
      watchProviders: {
        countries,
        flatrate,
      },
      collection,
      seasons,
      _debug: debug,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch media details' }, { status: 500 })
  }
}
