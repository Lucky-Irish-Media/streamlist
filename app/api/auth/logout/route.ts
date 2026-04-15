import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { deleteSession, endSession } from '@/lib/auth'
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
    await endSession(dbEnv, sessionId)
    await deleteSession(dbEnv, sessionId)
  }

  const response = NextResponse.json({ success: true })
  response.headers.set('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0')
  return response
}