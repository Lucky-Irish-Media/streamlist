import type { Config } from 'drizzle-kit'

export default {
  schema: './db/schema.ts',
  out: './db/migrations',
  driver: 'libsql',
  dbCredentials: {
    url: 'file:local.db',
  },
  schemaFilter: ['public'],
} satisfies Config