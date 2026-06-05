import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getSessionUser, parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'


export async function POST(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const dbEnv = { DB: (env as any)?.DB }
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

  let body: { tmdbId?: number; mediaType?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tmdbId, mediaType } = body
  if (!tmdbId || !mediaType) {
    return NextResponse.json({ error: 'tmdbId and mediaType are required' }, { status: 400 })
  }

  const existing = await db
    .select()
    .from(schema.dismissedRecommendations)
    .where(
      and(
        eq(schema.dismissedRecommendations.userId, userId),
        eq(schema.dismissedRecommendations.tmdbId, tmdbId),
        eq(schema.dismissedRecommendations.mediaType, mediaType),
      )
    )
    .get()

  if (existing) {
    await db
      .delete(schema.dismissedRecommendations)
      .where(eq(schema.dismissedRecommendations.id, existing.id))
      .run()

    return NextResponse.json({ dismissed: false })
  }

  await db.insert(schema.dismissedRecommendations).values({
    userId,
    tmdbId,
    mediaType,
  }).run()

  return NextResponse.json({ dismissed: true })
}
