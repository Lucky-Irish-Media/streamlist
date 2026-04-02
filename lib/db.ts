import { drizzle } from 'drizzle-orm/d1'
import * as schema from '@/db/schema'

type D1Database = any

function getDB(env?: { DB?: D1Database }): ReturnType<typeof drizzle> {
  if (!env?.DB) {
    throw new Error('D1 database binding not found')
  }
  if (typeof env.DB.prepare !== 'function') {
    throw new Error('D1 database binding is invalid - not a valid D1 database instance')
  }
  return drizzle(env.DB, { schema })
}

export { schema, getDB }
export type DB = ReturnType<typeof getDB>