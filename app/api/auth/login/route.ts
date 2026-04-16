import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { createUser, createSession, validateAccessCode, logLoginAttempt } from '@/lib/auth'
import { writeLoginEvent } from '@/lib/analytics'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

function getClientIp(req: NextRequest): string | undefined {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
}

function getUserAgent(req: NextRequest): string | undefined {
  return req.headers.get('user-agent') || undefined
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ message: 'Use POST to login' })
}

export async function POST(req: NextRequest) {
  let username: string | undefined
  let accessCode: string | undefined

  const ipAddress = getClientIp(req)
  const userAgent = getUserAgent(req)

  const { env } = getRequestContext()
  const dbBinding = (env as any)?.DB

  if (!dbBinding) {
    logger.error('D1 DB binding not found', { env: JSON.stringify(env) })
    return NextResponse.json({ error: 'Database not configured. Please ensure D1 binding is set up.' }, { status: 500 })
  }

  const dbEnv = { DB: dbBinding }

  try {

    let body: { username?: string; accessCode?: string }
    try {
      body = await req.json()
      username = body.username?.toLowerCase()
      accessCode = body.accessCode
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (!username || username.length < 2) {
      return NextResponse.json({ error: 'Username must be at least 2 characters' }, { status: 400 })
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return NextResponse.json({ error: 'Username can only contain letters, numbers, dashes, and underscores' }, { status: 400 })
    }

    const expectedCode = (env as any)?.ACCESS_CODE
    let codeValid = false

    if (expectedCode && accessCode === expectedCode) {
      codeValid = true
    } else if (accessCode) {
      codeValid = await validateAccessCode(dbEnv, accessCode)
    }

    if (!codeValid) {
      await logLoginAttempt(dbEnv, username, false, ipAddress, userAgent, 'invalid_code')
      writeLoginEvent(env, username, false)
      return NextResponse.json({ error: 'Invalid access code' }, { status: 403 })
    }

    const userId = await createUser(dbEnv, username)
    const sessionId = await createSession(dbEnv, userId, ipAddress, userAgent)
    await logLoginAttempt(dbEnv, username, true, ipAddress, userAgent)
    writeLoginEvent(env, username, true)

    const response = NextResponse.json({ success: true, username })
    response.headers.set('Set-Cookie', `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 60 * 60}`)
    return response
  } catch (error: any) {
    if (username) {
      await logLoginAttempt(dbEnv, username, false, ipAddress, userAgent, 'error')
      writeLoginEvent(env, username, false)
    }
    logger.error('Login error', { username: username || 'unknown' }, error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}