import { nanoid } from 'nanoid'
import { getDB, schema } from '@/lib/db'
import { eq, and, gt, lt, or, isNull } from 'drizzle-orm'

type D1Database = any

export async function createSession(
  env: { DB?: D1Database },
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const db = getDB(env)
  const sessionId = nanoid(64)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await db.insert(schema.sessions).values({
    id: sessionId,
    userId,
    expiresAt,
    ipAddress,
    userAgent,
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

export async function getUserByApiKey(env: { DB?: D1Database }, apiKey: string) {
  const db = getDB(env)
  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.apiKey, apiKey))
    .get()
  return user
}

export async function deleteSession(env: { DB?: D1Database }, sessionId: string): Promise<void> {
  const db = getDB(env)
  await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run()
}

export async function createUser(env: { DB?: D1Database }, username: string): Promise<string> {
  const db = getDB(env)
  const normalizedUsername = username.toLowerCase()
  
  const existingUser = await db.select().from(schema.users).where(eq(schema.users.username, normalizedUsername)).get()
  if (existingUser) {
    return existingUser.id
  }
  
  const userId = nanoid(32)

  await db.insert(schema.users).values({
    id: userId,
    username: normalizedUsername,
  })

  return userId
}

export async function getUser(env: { DB?: D1Database }, username: string) {
  const db = getDB(env)
  const normalizedUsername = username.toLowerCase()
  return db.select().from(schema.users).where(eq(schema.users.username, normalizedUsername)).get()
}

export function parseAuthCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';').map(c => c.trim().split('='))
  const sessionCookie = cookies.find(([name]) => name === 'session')
  return sessionCookie ? sessionCookie[1] : null
}

export async function getUserFromSession(env: { DB?: D1Database }, sessionId: string) {
  const db = getDB(env)
  const result = await db
    .select()
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(and(eq(schema.sessions.id, sessionId), gt(schema.sessions.expiresAt, new Date())))
    .get()

  return result?.users ?? null
}

export async function validateAccessCode(env: { DB?: D1Database }, code: string): Promise<boolean> {
  const db = getDB(env)
  
  const accessCode = await db
    .select()
    .from(schema.accessCodes)
    .where(and(
      eq(schema.accessCodes.code, code),
      eq(schema.accessCodes.isActive, true),
      or(isNull(schema.accessCodes.expiresAt), gt(schema.accessCodes.expiresAt, new Date()))
    ))
    .get()

  return !!accessCode
}

export async function logLoginAttempt(
  env: { DB?: D1Database },
  username: string,
  success: boolean,
  ipAddress?: string,
  userAgent?: string,
  failureReason?: string
): Promise<void> {
  const db = getDB(env)
  const id = nanoid(32)

  await db.insert(schema.loginAttempts).values({
    id,
    username: username.toLowerCase(),
    ipAddress,
    userAgent,
    success,
    failureReason,
  })
}

export async function endSession(
  env: { DB?: D1Database },
  sessionId: string
): Promise<void> {
  const db = getDB(env)
  await db
    .update(schema.sessions)
    .set({ endedAt: new Date() })
    .where(eq(schema.sessions.id, sessionId))
    .run()
}

export async function getUserSessions(
  env: { DB?: D1Database },
  userId: string,
  limit = 50,
  offset = 0
) {
  const db = getDB(env)
  return db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.userId, userId))
    .orderBy(schema.sessions.expiresAt)
    .limit(limit)
    .offset(offset)
    .all()
}

export async function getLoginAttempts(
  env: { DB?: D1Database },
  options: {
    userId?: string
    startDate?: Date
    endDate?: Date
    success?: boolean
    limit?: number
    offset?: number
  } = {}
) {
  const db = getDB(env)
  const { userId, startDate, endDate, success, limit = 50, offset = 0 } = options

  let conditions: any[] = []

  if (userId) {
    const user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .get()
    if (user) {
      conditions.push(eq(schema.loginAttempts.username, user.username))
    }
  }

  if (startDate) {
    conditions.push(gt(schema.loginAttempts.createdAt, startDate))
  }

  if (endDate) {
    conditions.push(gt(schema.loginAttempts.createdAt, endDate))
  }

  if (success !== undefined) {
    conditions.push(eq(schema.loginAttempts.success, success))
  }

  const query = db
    .select()
    .from(schema.loginAttempts)
    .orderBy(schema.loginAttempts.createdAt)
    .limit(limit)
    .offset(offset)

  if (conditions.length > 0) {
    return query.where(and(...conditions)).all()
  }

  return query.all()
}

export async function getLoginStats(
  env: { DB?: D1Database },
  days = 30
) {
  const db = getDB(env)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const totalAttempts = await db
    .select()
    .from(schema.loginAttempts)
    .where(gt(schema.loginAttempts.createdAt, since))
    .all()

  const successfulAttempts = totalAttempts.filter((a) => a.success)
  const failedAttempts = totalAttempts.filter((a) => !a.success)

  const uniqueUsers = new Set(successfulAttempts.map((a) => a.username))

  return {
    totalLogins: successfulAttempts.length,
    uniqueUsers: uniqueUsers.size,
    failedAttempts: failedAttempts.length,
    failureRate: totalAttempts.length > 0 ? failedAttempts.length / totalAttempts.length : 0,
  }
}

export async function cleanupOldSessions(
  env: { DB?: D1Database },
  daysOld = 90
): Promise<number> {
  const db = getDB(env)
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)

  const result = await db
    .delete(schema.sessions)
    .where(lt(schema.sessions.expiresAt, cutoff))
    .run()

  return result.meta.changes || 0
}

export async function cleanupOldLoginAttempts(
  env: { DB?: D1Database },
  daysOld = 90
): Promise<number> {
  const db = getDB(env)
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)

  const result = await db
    .delete(schema.loginAttempts)
    .where(lt(schema.loginAttempts.createdAt, cutoff))
    .run()

  return result.meta.changes || 0
}