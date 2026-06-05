import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getImageUrl, getTMDBConfig } from '@/lib/tmdb'
import {
  cachedGetTrending,
  cachedGetPopularMovies,
  cachedGetPopularTVShows,
  cachedGetNowPlaying,
  cachedGetOnTheAir,
  cachedDiscoverMovies,
  cachedDiscoverTVShows,
} from '@/lib/tmdb-cache'
import { getSessionUser, parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'


export async function GET(req: NextRequest) {
  try {
    const { env } = await getCloudflareContext({ async: true })
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
    const streamable = searchParams.get('streamable') === 'true'
    const providerIds = searchParams.get('provider_ids')
    const watchRegion = searchParams.get('watch_region') || 'US'

    let excludedIds = new Set<number>()
    let sessionId = parseAuthCookie(req.headers.get('cookie'))
    if (!sessionId) {
      sessionId = req.headers.get('x-session-id')
    }
    if (sessionId) {
      try {
        const userId = await getSessionUser({ DB: (env as any)?.DB }, sessionId)
        if (userId) {
          const db = getDB({ DB: (env as any)?.DB })
          const dismissed = await db
            .select({ tmdbId: schema.dismissedRecommendations.tmdbId })
            .from(schema.dismissedRecommendations)
            .where(eq(schema.dismissedRecommendations.userId, userId))
            .all()
          dismissed.forEach(d => excludedIds.add(d.tmdbId))
        }
      } catch {
        // Non-fatal: proceed without filtering
      }
    }

    let results: any[] = []
    let totalPages = 1

    if (streamable && providerIds) {
      const discoverParams: Record<string, string> = {
        with_watch_providers: providerIds,
        watch_region: watchRegion,
        page: String(page),
      }

      if (tab === 'trending') {
        const [movies, tv] = await Promise.all([
          cachedDiscoverMovies({ ...discoverParams, sort_by: 'popularity.desc' }, tmdb, env as any),
          cachedDiscoverTVShows({ ...discoverParams, sort_by: 'popularity.desc' }, tmdb, env as any),
        ])
        const movieResults = movies.results.map((m: any) => ({
          ...m,
          mediaType: 'movie',
          image: getImageUrl(m.poster_path)
        }))
        const tvResults = tv.results.map((m: any) => ({
          ...m,
          mediaType: 'tv',
          image: getImageUrl(m.poster_path)
        }))
        results = [...movieResults, ...tvResults]
        totalPages = Math.max(movies.total_pages, tv.total_pages)
      } else if (tab === 'movies' || tab === 'new-movies') {
        const sortBy = tab === 'new-movies' ? 'primary_release_date.desc' : 'popularity.desc'
        const data = await cachedDiscoverMovies({ ...discoverParams, sort_by: sortBy }, tmdb, env as any)
        results = data.results.map((m: any) => ({
          ...m,
          mediaType: 'movie',
          image: getImageUrl(m.poster_path)
        }))
        totalPages = data.total_pages
      } else if (tab === 'tv' || tab === 'new-tv') {
        const sortBy = tab === 'new-tv' ? 'first_air_date.desc' : 'popularity.desc'
        const data = await cachedDiscoverTVShows({ ...discoverParams, sort_by: sortBy }, tmdb, env as any)
        results = data.results.map((m: any) => ({
          ...m,
          mediaType: 'tv',
          image: getImageUrl(m.poster_path)
        }))
        totalPages = data.total_pages
      }
    } else {
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
    }

    const filtered = excludedIds.size > 0
      ? results.filter(r => !excludedIds.has(r.id))
      : results

    return NextResponse.json({
      results: filtered,
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
