import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getUserFromSession, parseAuthCookie, getUserSessions, getLoginAttempts, getLoginStats } from '@/lib/auth'
import { getDB, schema } from '@/lib/db'
import { eq, and, gt, asc } from 'drizzle-orm'

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

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'all'
  const userId = searchParams.get('userId')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  const start = startDate ? new Date(startDate) : undefined
  const end = endDate ? new Date(endDate) : undefined

  try {
    if (type === 'stats') {
      const days = parseInt(searchParams.get('days') || '30')
      const stats = await getLoginStats(dbEnv, days)
      return NextResponse.json(stats)
    }

    if (type === 'sessions' || type === 'all') {
      let sessions: any[] = []
      if (userId) {
        sessions = await getUserSessions(dbEnv, userId, limit, offset)
      }
      return NextResponse.json({ sessions })
    }

    if (type === 'attempts' || type === 'all') {
      const attempts = await getLoginAttempts(dbEnv, {
        userId: userId || undefined,
        startDate: start,
        endDate: end,
        success: undefined,
        limit,
        offset,
      })
      return NextResponse.json({ attempts })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}