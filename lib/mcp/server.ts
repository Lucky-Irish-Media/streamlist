import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, gt } from 'drizzle-orm'
import * as schema from '@/db/schema'
import { searchMulti, type TMDBConfig } from '@/lib/tmdb'

type DB = ReturnType<typeof drizzle>

interface Context {
  env: {
    DB: any
    TMDB_API_KEY?: string
  }
  userId: string
}

let db: DB | null = null
let context: Context | null = null

function getDb(env: { DB?: any }): DB {
  if (!db && env?.DB) {
    db = drizzle(env.DB, { schema })
  }
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

function setContext(ctx: Context) {
  context = ctx
}

function getContext(): Context {
  if (!context) {
    throw new Error('Context not set - authentication required')
  }
  return context
}

const tools = {
  get_watchlist: {
    name: 'get_watchlist',
    description: 'Get all items in the user\'s watchlist',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  add_to_watchlist: {
    name: 'add_to_watchlist',
    description: 'Add a movie or TV show to the watchlist by searching TMDB',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for the movie or TV show title' },
        media_type: { type: 'string', enum: ['movie', 'tv'], description: 'Optional: Filter by media type if query matches multiple items' },
      },
      required: ['query'],
    },
  },
  remove_from_watchlist: {
    name: 'remove_from_watchlist',
    description: 'Remove a movie or TV show from the watchlist',
    inputSchema: {
      type: 'object',
      properties: {
        tmdb_id: { type: 'number', description: 'The TMDB ID of the movie or TV show to remove' },
      },
      required: ['tmdb_id'],
    },
  },
  get_preferences: {
    name: 'get_preferences',
    description: 'Get user preferences including streaming services, genres, likes, and countries',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  update_streaming_services: {
    name: 'update_streaming_services',
    description: 'Update the user\'s preferred streaming services',
    inputSchema: {
      type: 'object',
      properties: {
        services: { type: 'array', items: { type: 'string' }, description: 'Array of streaming service IDs (e.g., ["8", "119"] for Netflix, Amazon)' },
      },
      required: ['services'],
    },
  },
  update_genres: {
    name: 'update_genres',
    description: 'Update the user\'s preferred genres',
    inputSchema: {
      type: 'object',
      properties: {
        genres: { type: 'array', items: { type: 'number' }, description: 'Array of genre IDs (e.g., [28, 12, 35] for Action, Comedy)' },
      },
      required: ['genres'],
    },
  },
  update_country: {
    name: 'update_country',
    description: 'Update the user\'s country preferences',
    inputSchema: {
      type: 'object',
      properties: {
        countries: { type: 'array', items: { type: 'string' }, description: 'Array of country codes (e.g., ["US", "GB", "CA"])' },
      },
      required: ['countries'],
    },
  },
  add_like: {
    name: 'add_like',
    description: 'Add a movie or TV show to user\'s liked list',
    inputSchema: {
      type: 'object',
      properties: {
        tmdb_id: { type: 'number', description: 'The TMDB ID of the movie or TV show' },
        media_type: { type: 'string', enum: ['movie', 'tv'], description: 'The type of media' },
        title: { type: 'string', description: 'The title of the movie or TV show' },
      },
      required: ['tmdb_id', 'media_type', 'title'],
    },
  },
  remove_like: {
    name: 'remove_like',
    description: 'Remove a movie or TV show from user\'s liked list',
    inputSchema: {
      type: 'object',
      properties: {
        tmdb_id: { type: 'number', description: 'The TMDB ID of the movie or TV show to remove' },
      },
      required: ['tmdb_id'],
    },
  },
  list_groups: {
    name: 'list_groups',
    description: 'Get all groups the user is a member of',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  create_group: {
    name: 'create_group',
    description: 'Create a new group for sharing watchlists',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The name of the group to create' },
      },
      required: ['name'],
    },
  },
  get_group_watchlist: {
    name: 'get_group_watchlist',
    description: 'Get the group watchlist with intersection and recommendations',
    inputSchema: {
      type: 'object',
      properties: {
        group_id: { type: 'string', description: 'The ID of the group' },
      },
      required: ['group_id'],
    },
  },
  get_user_activity: {
    name: 'get_user_activity',
    description: 'Query login history for a specific user (admin only)',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'The ID of the user to get activity for' },
        limit: { type: 'number', description: 'Number of records to return (default 50)' },
        offset: { type: 'number', description: 'Number of records to skip (default 0)' },
      },
      required: ['user_id'],
    },
  },
  get_failed_login_attempts: {
    name: 'get_failed_login_attempts',
    description: 'List failed login attempts with optional filters (admin only)',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'ISO date string to filter by start date' },
        end_date: { type: 'string', description: 'ISO date string to filter by end date' },
        limit: { type: 'number', description: 'Number of records to return (default 50)' },
        offset: { type: 'number', description: 'Number of records to skip (default 0)' },
      },
    },
  },
  get_login_stats: {
    name: 'get_login_stats',
    description: 'Get aggregate login statistics: daily logins, unique users, failure rate (admin only)',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of days to look back (default 30)' },
      },
    },
  },
}

async function handleGetWatchlist(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const ctx = getContext()
  const database = getDb(ctx.env)

  const items = await database
    .select()
    .from(schema.watchlist)
    .where(eq(schema.watchlist.userId, ctx.userId))
    .all()

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(items, null, 2),
    }],
  }
}

async function handleAddToWatchlist(query: string, mediaType?: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const ctx = getContext()
  const database = getDb(ctx.env)

  const tmdbConfig: TMDBConfig | undefined = ctx.env.TMDB_API_KEY ? { apiKey: ctx.env.TMDB_API_KEY } : undefined
  
  if (!tmdbConfig) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'TMDB API key not configured' }) }],
    }
  }

  const searchResults = await searchMulti(query, 1, tmdbConfig)
  const candidates = searchResults.results.filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
  
  if (candidates.length === 0) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: `No results found for "${query}"` }) }],
    }
  }

  let match: any = candidates[0]
  if (mediaType) {
    const typedMatch = candidates.find((c: any) => c.media_type === mediaType)
    if (typedMatch) {
      match = typedMatch
    } else {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            message: `No ${mediaType} found for "${query}". Found: ${candidates.map((c: any) => `${c.title || c.name} (${c.media_type})`).join(', ')}`
          })
        }],
      }
    }
  }

  const tmdbId = match.id
  const resolvedMediaType = match.media_type

  const existing = await database
    .select()
    .from(schema.watchlist)
    .where(
      and(
        eq(schema.watchlist.userId, ctx.userId),
        eq(schema.watchlist.tmdbId, tmdbId)
      )
    )
    .get()

  if (existing) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: `${match.title || match.name} already in watchlist` }) }],
    }
  }

  await database.insert(schema.watchlist).values({
    userId: ctx.userId,
    tmdbId,
    mediaType: resolvedMediaType,
  }).run()

  return {
    content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Added "${match.title || match.name}" to watchlist` }) }],
  }
}

async function handleRemoveFromWatchlist(tmdbId: number): Promise<{ content: Array<{ type: string; text: string }> }> {
  const ctx = getContext()
  const database = getDb(ctx.env)

  await database
    .delete(schema.watchlist)
    .where(
      and(
        eq(schema.watchlist.userId, ctx.userId),
        eq(schema.watchlist.tmdbId, tmdbId)
      )
    )
    .run()

  return {
    content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Removed from watchlist' }) }],
  }
}

async function handleGetPreferences(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const ctx = getContext()
  const database = getDb(ctx.env)

  const user = await database
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, ctx.userId))
    .get()

  if (!user) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'User not found' }) }],
    }
  }

  const streamingServices = await database
    .select()
    .from(schema.userStreamingServices)
    .where(eq(schema.userStreamingServices.userId, ctx.userId))
    .all()

  const genres = await database
    .select()
    .from(schema.userGenres)
    .where(eq(schema.userGenres.userId, ctx.userId))
    .all()

  const likes = await database
    .select()
    .from(schema.userLikes)
    .where(eq(schema.userLikes.userId, ctx.userId))
    .all()

  const countries = user?.countries ? JSON.parse(user.countries) : ['US']

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        countries,
        streamingServices: streamingServices.map(s => s.serviceId),
        genres: genres.map(g => g.genreId),
        likes: likes.map(l => ({
          tmdbId: l.tmdbId,
          mediaType: l.mediaType,
          title: l.title,
        })),
      }, null, 2),
    }],
  }
}

async function handleUpdateStreamingServices(services: { id: string; name: string }[]): Promise<{ content: Array<{ type: string; text: string }> }> {
  const ctx = getContext()
  const database = getDb(ctx.env)

  await database
    .delete(schema.userStreamingServices)
    .where(eq(schema.userStreamingServices.userId, ctx.userId))
    .run()

  if (services.length > 0) {
    await database
      .insert(schema.userStreamingServices)
      .values(services.map(service => ({ userId: ctx.userId, serviceId: service.id, serviceName: service.name })))
      .run()
  }

  return {
    content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Streaming services updated' }) }],
  }
}

async function handleUpdateGenres(genres: number[]): Promise<{ content: Array<{ type: string; text: string }> }> {
  const ctx = getContext()
  const database = getDb(ctx.env)

  await database
    .delete(schema.userGenres)
    .where(eq(schema.userGenres.userId, ctx.userId))
    .run()

  if (genres.length > 0) {
    await database
      .insert(schema.userGenres)
      .values(genres.map(genreId => ({ userId: ctx.userId, genreId })))
      .run()
  }

  return {
    content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Genres updated' }) }],
  }
}

async function handleUpdateCountry(countries: string[]): Promise<{ content: Array<{ type: string; text: string }> }> {
  const ctx = getContext()
  const database = getDb(ctx.env)

  await database
    .update(schema.users)
    .set({ countries: JSON.stringify(countries) })
    .where(eq(schema.users.id, ctx.userId))
    .run()

  return {
    content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Countries updated' }) }],
  }
}

async function handleAddLike(tmdbId: number, mediaType: string, title: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const ctx = getContext()
  const database = getDb(ctx.env)

  const existing = await database
    .select()
    .from(schema.userLikes)
    .where(
      and(
        eq(schema.userLikes.userId, ctx.userId),
        eq(schema.userLikes.tmdbId, tmdbId)
      )
    )
    .get()

  if (existing) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Already in likes' }) }],
    }
  }

  await database.insert(schema.userLikes).values({
    userId: ctx.userId,
    tmdbId,
    mediaType,
    title,
  }).run()

  return {
    content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Added to likes' }) }],
  }
}

async function handleRemoveLike(tmdbId: number): Promise<{ content: Array<{ type: string; text: string }> }> {
  const ctx = getContext()
  const database = getDb(ctx.env)

  await database
    .delete(schema.userLikes)
    .where(
      and(
        eq(schema.userLikes.userId, ctx.userId),
        eq(schema.userLikes.tmdbId, tmdbId)
      )
    )
    .run()

  return {
    content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Removed from likes' }) }],
  }
}

async function handleListGroups(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const ctx = getContext()
  const database = getDb(ctx.env)

  const memberships = await database
    .select()
    .from(schema.userGroupMembers)
    .innerJoin(schema.userGroups, eq(schema.userGroupMembers.groupId, schema.userGroups.id))
    .where(eq(schema.userGroupMembers.userId, ctx.userId))
    .all()

  const groups = await Promise.all(
    memberships.map(async (m) => {
      const members = await database
        .select()
        .from(schema.userGroupMembers)
        .where(eq(schema.userGroupMembers.groupId, m.user_groups.id))
        .all()
      return {
        id: m.user_groups.id,
        name: m.user_groups.name,
        createdAt: m.user_groups.createdAt,
        createdBy: m.user_groups.createdBy,
        memberCount: members.length,
      }
    })
  )

  return {
    content: [{ type: 'text', text: JSON.stringify({ groups }) }],
  }
}

async function handleCreateGroup(name: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const ctx = getContext()
  const database = getDb(ctx.env)
  const { nanoid } = await import('nanoid')

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: 'Group name is required' }) }] }
  }

  const trimmedName = name.trim()
  if (trimmedName.length > 50) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: 'Group name must be 50 characters or less' }) }] }
  }

  const sanitizedName = trimmedName.replace(/<[^>]*>/g, '')

  const groupId = nanoid(16)

  await database.insert(schema.userGroups).values({
    id: groupId,
    name: sanitizedName,
    createdBy: ctx.userId,
  }).run()

  await database.insert(schema.userGroupMembers).values({
    groupId,
    userId: ctx.userId,
  }).run()

  return {
    content: [{ type: 'text', text: JSON.stringify({ success: true, group: { id: groupId, name: sanitizedName } }) }],
  }
}

async function handleGetGroupWatchlist(groupId: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const ctx = getContext()
  const database = getDb(ctx.env)

  const membership = await database
    .select()
    .from(schema.userGroupMembers)
    .where(and(eq(schema.userGroupMembers.groupId, groupId), eq(schema.userGroupMembers.userId, ctx.userId)))
    .get()

  if (!membership) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'Not a member of this group' }) }],
    }
  }

  const members = await database
    .select()
    .from(schema.userGroupMembers)
    .where(eq(schema.userGroupMembers.groupId, groupId))
    .all()

  const userIds = members.map(m => m.userId)
  const threshold = Math.ceil(userIds.length * 0.5)

  const allWatchlists: Map<string, { tmdbId: number; mediaType: string }[]> = new Map()
  const excludedIds: Set<number> = new Set()
  const genreCounts: Map<number, number> = new Map()
  const serviceCounts: Map<string, number> = new Map()

  for (const uid of userIds) {
    const watchlist = await database
      .select()
      .from(schema.watchlist)
      .where(eq(schema.watchlist.userId, uid))
      .all()
    allWatchlists.set(uid, watchlist.map(w => ({ tmdbId: w.tmdbId, mediaType: w.mediaType })))

    const likes = await database.select().from(schema.userLikes).where(eq(schema.userLikes.userId, uid)).all()
    likes.forEach(l => excludedIds.add(l.tmdbId))

    const watched = await database.select().from(schema.watched).where(eq(schema.watched.userId, uid)).all()
    watched.forEach(w => excludedIds.add(w.tmdbId))

    const genres = await database.select().from(schema.userGenres).where(eq(schema.userGenres.userId, uid)).all()
    genres.forEach(g => {
      genreCounts.set(g.genreId, (genreCounts.get(g.genreId) || 0) + 1)
    })

    const services = await database
      .select()
      .from(schema.userStreamingServices)
      .where(eq(schema.userStreamingServices.userId, uid))
      .all()
    services.forEach(s => {
      serviceCounts.set(s.serviceId, (serviceCounts.get(s.serviceId) || 0) + 1)
    })
  }

  const commonGenres: number[] = []
  genreCounts.forEach((count, genreId) => {
    if (count >= threshold) commonGenres.push(genreId)
  })

  const watchlistArrays = Array.from(allWatchlists.values())
  const intersection: { tmdbId: number; mediaType: string }[] = []

  if (watchlistArrays.length > 0 && watchlistArrays[0].length > 0) {
    for (const item of watchlistArrays[0]) {
      const inAllLists = watchlistArrays.every(list =>
        list.some(w => w.tmdbId === item.tmdbId && w.mediaType === item.mediaType)
      )
      if (inAllLists) {
        intersection.push(item)
        excludedIds.add(item.tmdbId)
      }
    }
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        intersection,
        commonGenres,
        memberCount: members.length,
        threshold,
      }),
    }],
  }
}

async function handleGetUserActivity(userId: string, limit = 50, offset = 0): Promise<{ content: Array<{ type: string; text: string }> }> {
  const ctx = getContext()
  const database = getDb(ctx.env)

  const user = await database
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get()

  if (!user) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: 'User not found' }) }] }
  }

  const sessions = await database
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.userId, userId))
    .orderBy(schema.sessions.expiresAt)
    .limit(limit)
    .offset(offset)
    .all()

  const attempts = await database
    .select()
    .from(schema.loginAttempts)
    .where(eq(schema.loginAttempts.username, user.username))
    .orderBy(schema.loginAttempts.createdAt)
    .limit(limit)
    .offset(offset)
    .all()

  return {
    content: [{ type: 'text', text: JSON.stringify({ sessions, attempts }) }],
  }
}

async function handleGetFailedLoginAttempts(startDate?: string, endDate?: string, limit = 50, offset = 0): Promise<{ content: Array<{ type: string; text: string }> }> {
  const ctx = getContext()
  const database = getDb(ctx.env)

  const start = startDate ? new Date(startDate) : undefined
  const end = endDate ? new Date(endDate) : undefined

  const attempts = await database
    .select()
    .from(schema.loginAttempts)
    .where(eq(schema.loginAttempts.success, false))
    .orderBy(schema.loginAttempts.createdAt)
    .limit(limit)
    .offset(offset)
    .all()

  return {
    content: [{ type: 'text', text: JSON.stringify({ attempts }) }],
  }
}

async function handleGetLoginStats(days = 30): Promise<{ content: Array<{ type: string; text: string }> }> {
  const ctx = getContext()
  const database = getDb(ctx.env)

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const attempts = await database
    .select()
    .from(schema.loginAttempts)
    .where(gt(schema.loginAttempts.createdAt, since))
    .all()

  const successful = attempts.filter(a => a.success)
  const failed = attempts.filter(a => !a.success)
  const uniqueUsers = new Set(successful.map(a => a.username))

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        totalLogins: successful.length,
        uniqueUsers: uniqueUsers.size,
        failedAttempts: failed.length,
        failureRate: attempts.length > 0 ? failed.length / attempts.length : 0,
      }),
    }],
  }
}

export const server = new Server(
  {
    name: 'streamlist-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Object.values(tools),
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params as { name: string; arguments: Record<string, unknown> }

  try {
    switch (name) {
      case 'get_watchlist':
        return await handleGetWatchlist()
      case 'add_to_watchlist':
        return await handleAddToWatchlist(args.query as string, args.media_type as string | undefined)
      case 'remove_from_watchlist':
        return await handleRemoveFromWatchlist(args.tmdb_id as number)
      case 'get_preferences':
        return await handleGetPreferences()
      case 'update_streaming_services':
        return await handleUpdateStreamingServices(args.services as { id: string; name: string }[])
      case 'update_genres':
        return await handleUpdateGenres(args.genres as number[])
      case 'update_country':
        return await handleUpdateCountry(args.countries as string[])
      case 'add_like':
        return await handleAddLike(args.tmdb_id as number, args.media_type as string, args.title as string)
      case 'remove_like':
        return await handleRemoveLike(args.tmdb_id as number)
      case 'list_groups':
        return await handleListGroups()
      case 'create_group':
        const groupResult = await handleCreateGroup(args.name as string)
        if (groupResult.content[0].text.includes('"error"')) {
          return { ...groupResult, isError: true }
        }
        return groupResult
      case 'get_group_watchlist':
        return await handleGetGroupWatchlist(args.group_id as string)
      case 'get_user_activity':
        return await handleGetUserActivity(args.user_id as string, args.limit as number, args.offset as number)
      case 'get_failed_login_attempts':
        return await handleGetFailedLoginAttempts(args.start_date as string, args.end_date as string, args.limit as number, args.offset as number)
      case 'get_login_stats':
        return await handleGetLoginStats(args.days as number)
      default:
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
          isError: true,
        }
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }],
      isError: true,
    }
  }
})

export async function runServer() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

export { setContext }
