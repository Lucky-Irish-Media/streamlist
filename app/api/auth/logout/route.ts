import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { deleteSession } from '@/lib/auth'
import { parseAuthCookie } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }
  let sessionId = parseAuthCookie(req.headers.get('cookie'))
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id')
  }

  if (sessionId) {
    await deleteSession(dbEnv, sessionId)
  }

  return NextResponse.json({ success: true })
}