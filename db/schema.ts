import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  country: text('country').notNull().$defaultFn(() => 'US'),
})

export const userStreamingServices = sqliteTable('user_streaming_services', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id),
  serviceId: text('service_id').notNull(),
})

export const userGenres = sqliteTable('user_genres', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id),
  genreId: integer('genre_id', { mode: 'number' }).notNull(),
})

export const userLikes = sqliteTable('user_likes', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id),
  tmdbId: integer('tmdb_id', { mode: 'number' }).notNull(),
  mediaType: text('media_type').notNull(),
  title: text('title').notNull(),
})

export const watchlist = sqliteTable('watchlist', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id),
  tmdbId: integer('tmdb_id', { mode: 'number' }).notNull(),
  mediaType: text('media_type').notNull(),
  addedAt: integer('added_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
})