import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getSessionUser, parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq, desc } from 'drizzle-orm'


async function getUserId(req: NextRequest, env: any): Promise<string | null> {
  const dbEnv = { DB: (env as any)?.DB }
  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }
  if (!sessionId) return null
  return getSessionUser(dbEnv, sessionId)
}

export async function GET(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const userId = await getUserId(req, env)
  if (!userId) {
    return NextResponse.json({ lists: [] })
  }

  const db = getDB({ DB: (env as any)?.DB })
  const lists = await db
    .select()
    .from(schema.watchlists)
    .where(eq(schema.watchlists.userId, userId))
    .orderBy(desc(schema.watchlists.createdAt))
    .all()

  return NextResponse.json({ lists })
}

export async function POST(req: NextRequest) {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const userId = await getUserId(req, env)
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    let body: { name?: string; description?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { name, description } = body
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const sanitizedName = name.trim().replace(/<[^>]*>/g, '')

    const { nanoid } = await import('nanoid')
    const db = getDB({ DB: (env as any)?.DB })
    const id = nanoid(16)

    await db.insert(schema.watchlists).values({
      id,
      userId,
      name: sanitizedName,
      description: description || null,
    }).run()

    const list = await db
      .select()
      .from(schema.watchlists)
      .where(eq(schema.watchlists.id, id))
      .get()

    return NextResponse.json({ list }, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create list:', error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}
