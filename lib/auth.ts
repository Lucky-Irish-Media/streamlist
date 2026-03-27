import { nanoid } from 'nanoid'
import { getDB, schema } from '@/lib/db'
import { eq, and, gt } from 'drizzle-orm'

type D1Database = any

export async function createSession(env: { DB?: D1Database }, userId: string): Promise<string> {
  const db = getDB(env)
  const sessionId = nanoid(64)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await db.insert(schema.sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  })

  return sessionId
}

export async function getSessionUser(env: { DB?: D1Database }, sessionId: string): Promise<string | null> {
  const db = getDB(env)
  const result = await db
    .select()
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(and(eq(schema.sessions.id, sessionId), gt(schema.sessions.expiresAt, new Date())))
    .get()

  return result?.users.id ?? null
}

export async function deleteSession(env: { DB?: D1Database }, sessionId: string): Promise<void> {
  const db = getDB(env)
  await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run()
}

export async function createUser(env: { DB?: D1Database }, username: string): Promise<string> {
  const db = getDB(env)
  
  const existingUser = await db.select().from(schema.users).where(eq(schema.users.username, username)).get()
  if (existingUser) {
    return existingUser.id
  }
  
  const userId = nanoid(32)

  await db.insert(schema.users).values({
    id: userId,
    username,
  })

  return userId
}

export async function getUser(env: { DB?: D1Database }, username: string) {
  const db = getDB(env)
  return db.select().from(schema.users).where(eq(schema.users.username, username)).get()
}

export function parseAuthCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';').map(c => c.trim().split('='))
  const sessionCookie = cookies.find(([name]) => name === 'session')
  return sessionCookie ? sessionCookie[1] : null
}