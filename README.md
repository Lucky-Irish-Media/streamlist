# StreamList

A personal watchlist app for discovering and tracking movies and TV shows. Built with Next.js and deployed on Cloudflare Pages.

## Features

- **Browse**: Discover trending, popular, and new release movies and TV shows with filtering and sorting by popularity, rating, or release date
- **Watchlist**: Add and manage your personal watchlist
- **Watch History**: Track movies and shows you've watched
- **Recommendations**: Get personalized recommendations based on your preferences and liked content
- **Preferences**: Configure your favorite streaming services, genres, regions, and likes
- **Search**: Find movies and TV shows by name with search history (saved locally)
- **Groups**: Create groups, invite friends, share watchlists, and run polls to decide what to watch
- **Notes**: Add personal notes to any movie or TV show
- **Admin Dashboard**: View platform statistics, user activity, and login analytics

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: SQLite (via Drizzle ORM + Cloudflare D1)
- **Cache**: Cloudflare KV (TMDB API caching)
- **Workers**: Durable Objects for real-time poll management
- **API**: The Movie Database (TMDB) API
- **Runtime**: Edge Runtime (Cloudflare Pages)
- **Deployment**: Cloudflare Pages

## Prerequisites

- Node.js 18+
- Cloudflare account
- TMDB API key (free at https://www.themoviedb.org/settings/api)

## Setup

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Create a `.env.local` file:
   ```bash
   touch .env.local
   ```
   
   Add your TMDB API key:
   ```
   TMDB_API_KEY=your_tmdb_api_key_here
   ```

3. **Set up the database**:
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **Run locally**:
   ```bash
   npm run dev
   ```

## Configuration

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `TMDB_API_KEY` | Your TMDB API key (get from themoviedb.org) |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCESS_CODE` | Access code required to create an account (recommended for production) | None |
| `TMDB_API_BASE_URL` | TMDB API base URL | `https://api.themoviedb.org/3` |

### Cloudflare Bindings

The app uses several Cloudflare bindings (configured in `wrangler.toml`):

- `DB` - D1 database for persistent storage
- `TMDB_CACHE` - KV namespace for caching TMDB API responses
- `POLL_DO` - Durable Object for poll management
- `POLL_KV` - KV namespace for poll data

## Deployment

1. **Deploy to Preview**:
   ```bash
   npm run deploy
   ```

2. **Deploy to Production** (requires explicit permission):
   ```bash
   npm run deploy:prod
   ```

3. **Database migrations**:
   ```bash
   # Preview
   npx wrangler d1 execute streamlist-preview-db --remote --command="SELECT 1"
   
   # Production (requires explicit permission)
   npx wrangler d1 execute streamlist-db --remote --command="SELECT 1"
   ```

4. **Configure environment variables** in Cloudflare Pages dashboard:
   - Add `TMDB_API_KEY` with your TMDB API key
   - Optionally add `ACCESS_CODE` for account protection

## MCP Server

StreamList includes an MCP (Model Context Protocol) server that allows external applications to interact with your watchlist and preferences programmatically.

### Generating an API Key

1. Log in to your account
2. Go to **Preferences**
3. Scroll to **API Access** section
4. Click **Generate API Key**
5. Copy your API key (or regenerate if needed)

### Available Tools

#### Watchlist
| Tool | Description |
|------|-------------|
| `get_watchlist` | List all items in your watchlist |
| `add_to_watchlist` | Add a movie or TV show by search query |
| `remove_from_watchlist` | Remove an item from watchlist |

#### Preferences
| Tool | Description |
|------|-------------|
| `get_preferences` | Get streaming services, genres, likes, and countries |
| `update_streaming_services` | Set streaming services (requires `{id, name}` objects) |
| `update_genres` | Set preferred genres (array of genre IDs) |
| `update_country` | Set country codes (e.g., `["US", "PT"]`) |
| `add_like` | Like a movie/show |
| `remove_like` | Unlike a movie/show |

#### Groups
| Tool | Description |
|------|-------------|
| `list_groups` | List all your groups |
| `create_group` | Create a new group |
| `get_group_watchlist` | Get group watchlist with intersection analysis |

#### Admin Tools (admin only)
| Tool | Description |
|------|-------------|
| `get_user_activity` | Get user login/session history |
| `get_failed_login_attempts` | List failed login attempts |
| `get_login_stats` | Get aggregate login statistics |

### API Usage

Make JSON-RPC 2.0 requests to `/api/mcp`:

```bash
curl -X POST https://your-domain/api/mcp \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": { "name": "get_watchlist" },
    "id": 1
  }'
```

**Example: Add to watchlist**
```bash
curl -X POST https://your-domain/api/mcp \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "add_to_watchlist",
      "arguments": { "query": "Inception", "media_type": "movie" }
    },
    "id": 1
  }'
```

**Example: Get preferences**
```bash
curl -X POST https://your-domain/api/mcp \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": { "name": "get_preferences" },
    "id": 1
  }'
```

### Using with OpenCode

1. Generate an API key in Preferences → API Access
2. Set the `STREAMLIST_API_KEY` environment variable:
   ```bash
   export STREAMLIST_API_KEY="your_api_key_here"
   ```
3. Update the URL in `opencode.json` to match your deployment

### Using with Claude Desktop

```json
{
  "mcpServers": {
    "streamlist": {
      "command": "npx",
      "args": ["-y", "https://your-domain/api/mcp"]
    }
  }
}
```

## Project Structure

```
streamlist/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── admin/         # Admin stats, activity, users, access-codes
│   │   ├── auth/          # Authentication (login, logout, me, api-key)
│   │   ├── browse/        # Browse/discover endpoints
│   │   ├── groups/        # Group management and polls
│   │   ├── media/         # Media details
│   │   ├── mcp/           # MCP server endpoint
│   │   ├── notes/         # User notes for movies/shows
│   │   ├── preferences/  # User preferences
│   │   ├── providers/    # Watch providers
│   │   ├── recommendations/ # Personalized recommendations
│   │   ├── search/        # Search endpoints
│   │   ├── watched/      # Watch history
│   │   └── watchlist/    # Watchlist management
│   ├── admin/             # Admin dashboard
│   ├── browse/            # Browse/discover page
│   ├── groups/            # Groups pages
│   ├── login/             # Login page
│   ├── preferences/       # User preferences page
│   ├── watchlist/         # Watchlist page
│   └── user/              # User account page
├── components/            # React components (MediaCard, UserContext, etc.)
├── db/                    # Database schema and migrations
├── lib/                   # Utilities (auth, db, tmdb, mcp, kv)
│   └── durable/           # Durable Object classes
├── types/                 # TypeScript type definitions
├── workers/                # Cloudflare Workers
│   └── poll-do/           # Poll Durable Object worker
└── public/                # Static assets
```

## Groups

StreamList supports collaborative groups where members can share watchlists and run polls.

### Creating a Group

1. Log in to your account
2. Navigate to **Groups**
3. Click **Create Group** and enter a name
4. Share the invite link with friends

### Group Features

| Feature | Description |
|---------|-------------|
| **Shared Watchlist** | Group members can add/remove items from the group watchlist |
| **Watchlist Intersection** | See what movies/shows everyone in the group wants to watch |
| **Polls** | Create polls with ranked choices to vote on what to watch |
| **Invite Links** | Generate unique invite links that expire after 7 days |

### Group Permissions

- Only group members can view the group watchlist
- Only group members can create polls
- All members can vote on active polls
- Poll winners are recorded automatically or manually

## Notes

You can add personal notes to any movie or TV show. Notes are stored privately and accessible only to you. Notes are useful for:
- Recording your thoughts or reviews
- Tracking where you left off in a series
- Saving recommendations for later

Notes are managed via the `/api/notes` endpoint (GET to retrieve, POST to save, DELETE to remove).

## Admin Dashboard

Admin users have access to a dashboard at `/admin` that displays:
- **User Statistics**: Total users, active sessions, users in last 30 days, API key usage
- **Group Statistics**: Total groups created
- **Access Code Statistics**: Number of active access codes
- **Login Activity**: Logins in the last 30 days, unique users, failed attempts, failure rate

Access code management is available at `/admin/access-codes` for creating and managing signup codes.

## License

MIT
