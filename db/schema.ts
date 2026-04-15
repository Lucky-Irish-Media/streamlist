import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  countries: text('countries').notNull().$defaultFn(() => '["US"]'),
  apiKey: text('api_key'),
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().$defaultFn(() => false),
})

export const userStreamingServices = sqliteTable('user_streaming_services', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id),
  serviceId: text('service_id').notNull(),
  serviceName: text('service_name').notNull(),
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

export const watched = sqliteTable('watched', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id),
  tmdbId: integer('tmdb_id', { mode: 'number' }).notNull(),
  mediaType: text('media_type').notNull(),
  title: text('title').notNull(),
  watchedAt: integer('watched_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
})

export const loginAttempts = sqliteTable('login_attempts', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  success: integer('success', { mode: 'boolean' }).notNull(),
  failureReason: text('failure_reason'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const userGroups = sqliteTable('user_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  createdBy: text('created_by').notNull().references(() => users.id),
})

export const userGroupMembers = sqliteTable('user_group_members', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  groupId: text('group_id').notNull().references(() => userGroups.id),
  userId: text('user_id').notNull().references(() => users.id),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const groupInvites = sqliteTable('group_invites', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  groupId: text('group_id').notNull().references(() => userGroups.id),
  invitedBy: text('invited_by').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
})

export const groupPolls = sqliteTable('group_polls', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => userGroups.id),
  status: text('status').notNull().$defaultFn(() => 'active'),
  closedAt: integer('closed_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  candidates: text('candidates').notNull(),
  winnerTmdbId: integer('winner_tmdb_id', { mode: 'number' }),
  winnerMediaType: text('winner_media_type'),
})

export const groupPollVotes = sqliteTable('group_poll_votes', {
  id: text('id').primaryKey(),
  pollId: text('poll_id').notNull().references(() => groupPolls.id),
  userId: text('user_id').notNull().references(() => users.id),
  rankings: text('rankings').notNull(),
})

export const accessCodes = sqliteTable('access_codes', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  createdBy: text('created_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().$defaultFn(() => true),
})

export const userNotes = sqliteTable('user_notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  tmdbId: integer('tmdb_id', { mode: 'number' }).notNull(),
  mediaType: text('media_type').notNull(),
  note: text('note').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})