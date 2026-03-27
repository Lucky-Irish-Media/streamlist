import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { createUser, createSession } from '@/lib/auth'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  return NextResponse.json({ message: 'Use POST to login' })
}

export async function POST(req: NextRequest) {
  try {
    const { env } = getRequestContext()
    const dbBinding = (env as any)?.DB
    
    if (!dbBinding) {
      console.error('D1 DB binding not found. env:', JSON.stringify(env))
      return NextResponse.json({ error: 'Database not configured. Please ensure D1 binding is set up.' }, { status: 500 })
    }
    
    const dbEnv = { DB: dbBinding }

    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { username, accessCode } = body
    if (!username || username.length < 2) {
      return NextResponse.json({ error: 'Username must be at least 2 characters' }, { status: 400 })
    }

    const expectedCode = (env as any)?.ACCESS_CODE
    if (expectedCode && accessCode !== expectedCode) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 403 })
    }

    const userId = await createUser(dbEnv, username)
    const sessionId = await createSession(dbEnv, userId)

    const response = NextResponse.json({ success: true, username, sessionId })
    return response
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}