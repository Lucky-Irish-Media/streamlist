import { getDB, schema } from '@/lib/db'
import { nanoid } from 'nanoid'

type D1Database = any

export async function logAuditEvent(
  env: { DB?: D1Database },
  actorId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: string
) {
  const db = getDB(env)
  const id = nanoid(32)

  await db.insert(schema.auditLog).values({
    id,
    actorId,
    action,
    targetType,
    targetId,
    details,
  })
}
