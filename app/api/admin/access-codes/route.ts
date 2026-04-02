import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getUserFromSession, parseAuthCookie } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }

  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await getUserFromSession(dbEnv, sessionId)
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = getDB(dbEnv)
  const codes = await db.select().from(schema.accessCodes).all()

  return NextResponse.json({ codes: codes.map(c => ({
    id: c.id,
    code: c.code,
    createdBy: c.createdBy,
    createdAt: c.createdAt,
    expiresAt: c.expiresAt,
    isActive: c.isActive,
  })) })
}

export async function POST(req: NextRequest) {
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }

  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await getUserFromSession(dbEnv, sessionId)
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { code, expiresInDays } = body

    const newCode = code || nanoid(12)
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null

    const db = getDB(dbEnv)
    const id = nanoid(16)

    await db.insert(schema.accessCodes).values({
      id,
      code: newCode,
      createdBy: user.id,
      expiresAt,
    })

    return NextResponse.json({ 
      id,
      code: newCode,
      expiresAt,
      isActive: true,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }

  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await getUserFromSession(dbEnv, sessionId)
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, action, value } = body

    if (!id) {
      return NextResponse.json({ error: 'Code ID required' }, { status: 400 })
    }

    const db = getDB(dbEnv)

    if (action === 'toggleActive') {
      const existing = await db.select().from(schema.accessCodes).where(eq(schema.accessCodes.id, id)).get()
      if (!existing) {
        return NextResponse.json({ error: 'Code not found' }, { status: 404 })
      }
      await db.update(schema.accessCodes).set({ isActive: !existing.isActive }).where(eq(schema.accessCodes.id, id)).run()
      return NextResponse.json({ success: true, isActive: !existing.isActive })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }

  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await getUserFromSession(dbEnv, sessionId)
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Code ID required' }, { status: 400 })
  }

  const db = getDB(dbEnv)
  await db.delete(schema.accessCodes).where(eq(schema.accessCodes.id, id)).run()

  return NextResponse.json({ success: true })
}
