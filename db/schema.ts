import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  country: text('country').notNull().$defaultFn(() => 'US'),
  apiKey: text('api_key'),
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
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  groupId: text('group_id').notNull().references(() => userGroups.id),
  status: text('status').notNull().$defaultFn(() => 'active'),
  closedAt: integer('closed_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  candidates: text('candidates').notNull(),
  winnerTmdbId: integer('winner_tmdb_id', { mode: 'number' }),
  winnerMediaType: text('winner_media_type'),
})

export const groupPollVotes = sqliteTable('group_poll_votes', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  pollId: integer('poll_id', { mode: 'number' }).notNull().references(() => groupPolls.id),
  userId: text('user_id').notNull().references(() => users.id),
  rankings: text('rankings').notNull(),
})