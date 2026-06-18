import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getSessionUser, parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'


async function getUserId(req: NextRequest, env: any): Promise<string | null> {
  const dbEnv = { DB: (env as any)?.DB }
  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }
  if (!sessionId) return null
  return getSessionUser(dbEnv, sessionId)
}

async function getListOwnership(db: ReturnType<typeof getDB>, listId: string, userId: string) {
  return db
    .select()
    .from(schema.watchlists)
    .where(and(eq(schema.watchlists.id, listId), eq(schema.watchlists.userId, userId)))
    .get()
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { env } = await getCloudflareContext({ async: true })
    const userId = await getUserId(req, env)
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const db = getDB({ DB: (env as any)?.DB })
    const list = await getListOwnership(db, id, userId)
    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    if (list.name === 'Default') {
      return NextResponse.json({ error: 'Cannot rename the Default list' }, { status: 403 })
    }

    let body: { name?: string; description?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const updates: Record<string, string> = {}
    if (body.name !== undefined) {
      const sanitizedName = String(body.name).trim().replace(/<[^>]*>/g, '')
      if (sanitizedName.length === 0) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      }
      updates.name = sanitizedName
    }
    if (body.description !== undefined) {
      updates.description = String(body.description).trim().replace(/<[^>]*>/g, '') || null as any
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    await db
      .update(schema.watchlists)
      .set(updates as any)
      .where(eq(schema.watchlists.id, id))
      .run()

    const updated = await db
      .select()
      .from(schema.watchlists)
      .where(eq(schema.watchlists.id, id))
      .get()

    return NextResponse.json({ list: updated })
  } catch (error: any) {
    console.error('Failed to update list:', error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { env } = await getCloudflareContext({ async: true })
    const userId = await getUserId(req, env)
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const db = getDB({ DB: (env as any)?.DB })
    const list = await getListOwnership(db, id, userId)
    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    if (list.name === 'Default') {
      return NextResponse.json({ error: 'Cannot delete the Default list' }, { status: 403 })
    }

    await db
      .delete(schema.watchlistItems)
      .where(eq(schema.watchlistItems.listId, id))
      .run()

    await db
      .delete(schema.watchlists)
      .where(eq(schema.watchlists.id, id))
      .run()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete list:', error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}
