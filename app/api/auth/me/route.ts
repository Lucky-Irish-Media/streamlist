import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth'
import { parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }
  
  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }

  if (!sessionId) {
    return NextResponse.json({ user: null })
  }

  const userId = await getSessionUser(dbEnv, sessionId)
  if (!userId) {
    return NextResponse.json({ user: null })
  }

  const db = getDB(dbEnv)
  const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get()

  const streamingServices = await db
    .select()
    .from(schema.userStreamingServices)
    .where(eq(schema.userStreamingServices.userId, userId))
    .all()

  const genres = await db
    .select()
    .from(schema.userGenres)
    .where(eq(schema.userGenres.userId, userId))
    .all()

  const likes = await db
    .select()
    .from(schema.userLikes)
    .where(eq(schema.userLikes.userId, userId))
    .all()

  const hasCompletedOnboarding = streamingServices.length > 0 || genres.length > 0

  const countries = user?.countries ? JSON.parse(user.countries) : ['US']

  return NextResponse.json({
    user: user ? {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      countries,
      streamingServices: streamingServices.map(s => s.serviceId),
      genres: genres.map(g => g.genreId),
      likes: likes.map(l => ({ tmdbId: l.tmdbId, mediaType: l.mediaType, title: l.title })),
      hasCompletedOnboarding,
      apiKey: user.apiKey,
    } : null,
  })
}