import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser, parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { getMovieDetails, getTVDetails, getImageUrl, getTMDBConfig } from '@/lib/tmdb'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }
  const tmdb = getTMDBConfig(env as any)

  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const userId = await getSessionUser(dbEnv, sessionId)
  if (!userId) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const db = getDB(dbEnv)
  const dismissedItems = await db
    .select()
    .from(schema.dismissedRecommendations)
    .where(eq(schema.dismissedRecommendations.userId, userId))
    .all()

  const mediaDetails = await Promise.all(
    dismissedItems.map(async (item) => {
      try {
        const details = item.mediaType === 'tv'
          ? await getTVDetails(item.tmdbId, tmdb)
          : await getMovieDetails(item.tmdbId, tmdb)
        return {
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          title: details?.title || details?.name || `Unknown (${item.tmdbId})`,
          posterPath: details?.poster_path ?? null,
          dismissedAt: item.dismissedAt,
        }
      } catch {
        return {
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          title: `Unknown (${item.tmdbId})`,
          posterPath: null,
          dismissedAt: item.dismissedAt,
        }
      }
    })
  )

  return NextResponse.json({ dismissed: mediaDetails })
}
