# StreamList

A personal watchlist app for discovering and tracking movies and TV shows. Built with Next.js and deployed on Cloudflare Pages.

## Features

- **Browse**: Discover trending, popular, and new release movies and TV shows with filtering and sorting
- **Watchlist**: Add and manage your personal watchlist
- **Watch History**: Track movies and shows you've watched
- **Recommendations**: Get personalized recommendations based on your preferences
- **Preferences**: Configure your favorite streaming services, genres, regions, and likes
- **Search**: Find movies and TV shows by name with search history
- **Groups**: Create groups, invite friends, share watchlists, and run polls to decide what to watch

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: SQLite (via Drizzle ORM + Cloudflare D1)
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
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   
   Add your TMDB API key:
   ```
   TMDB_API_KEY=your_tmdb_api_key_here
   ```

3. **Set up the database**:
   
   Option A - Local development with SQLite:
   ```bash
   npm run db:generate
   npm run db:push
   ```
   
   Option B - Cloudflare D1 (for production):
   ```bash
   wrangler d1 create streamlist-db
   # Update wrangler.toml with your database_id
   wrangler d1 execute streamlist-db --local=./db/migrations
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

### Cloudflare Pages Variables

When deploying, set these in your Cloudflare Pages project settings:
- `TMDB_API_KEY` - Your TMDB API key
- `ACCESS_CODE` - (optional) Your chosen access code

## Deployment

1. **Deploy to Cloudflare Pages**:
   ```bash
   npm run deploy
   ```

2. **Set up D1 database**:
   ```bash
   wrangler d1 execute streamlist-db --remote
   ```

3. **Configure environment variables** in Cloudflare Pages dashboard:
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

#### Watchlist & History
| Tool | Description |
|------|-------------|
| `get_watchlist` | List all items in your watchlist |
| `add_to_watchlist` | Add a movie or TV show (`tmdb_id`, `media_type`) |
| `remove_from_watchlist` | Remove an item from watchlist (`tmdb_id`) |
| `get_watch_history` | List all watched movies/shows |
| `mark_as_watched` | Mark as watched (`tmdb_id`, `media_type`, `title`) |
| `remove_from_watch_history` | Remove from watch history (`tmdb_id`) |

#### Groups (via MCP)
| Tool | Description |
|------|-------------|
| `list_groups` | List all your groups |
| `create_group` | Create a new group (`name`) |
| `get_group_watchlist` | Get group watchlist with intersection (`group_id`) |
| `create_group_invite` | Generate a 7-day invite token (`group_id`) |
| `join_group` | Join a group using an invite token (`token`) |
| `get_group_invites` | List active invites for a group (`group_id`, creator only) |

#### Polls (via MCP)
| Tool | Description |
|------|-------------|
| `create_poll` | Create a poll with candidates (`group_id`, `candidates` array) |
| `vote_on_poll` | Vote on a poll with ranked choices (`poll_id`, `rankings` array) |
| `get_poll_results` | Get poll results with Borda count scoring (`poll_id`) |
| `close_poll` | Manually close a poll and record winner (`poll_id`) |
| `list_group_polls` | List all polls in a group (`group_id`) |

#### Access Codes (via MCP)
| Tool | Description |
|------|-------------|
| `create_access_code` | Create a signup access code (admin only, optional `expires_days`) |
| `verify_access_code` | Verify an access code for signup (`code`) |

#### Preferences
| Tool | Description |
|------|-------------|
| `get_preferences` | Get streaming services, genres, likes, and countries |
| `update_streaming_services` | Set streaming services (`services` array) |
| `update_genres` | Set preferred genres (`genres` array) |
| `update_country` | Set country codes (`countries` array, e.g., `["US", "PT"]`) |
| `add_like` | Like a movie/show (`tmdb_id`, `media_type`, `title`) |
| `remove_like` | Unlike a movie/show (`tmdb_id`) |

#### Discovery
| Tool | Description |
|------|-------------|
| `get_recommendations` | Get personalized recommendations based on your likes |
| `get_trending` | Get trending movies/shows (`media_type`, `page`) |
| `search_media` | Search for movies/shows (`query`, `page`) |
| `get_media_details` | Get full details of a movie/show (`tmdb_id`, `media_type`) |
| `get_watch_providers` | Get streaming providers in your regions (`tmdb_id`, `media_type`) |

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
      "arguments": { "tmdb_id": 550, "media_type": "movie" }
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

**Example: Get personalized recommendations**
```bash
curl -X POST https://your-domain/api/mcp \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": { "name": "get_recommendations" },
    "id": 1
  }'
```

**Example: Search for a movie**
```bash
curl -X POST https://your-domain/api/mcp \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": { "name": "search_media", "arguments": { "query": "Inception" } },
    "id": 1
  }'
```

**Example: Get streaming providers**
```bash
curl -X POST https://your-domain/api/mcp \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": { "name": "get_watch_providers", "arguments": { "tmdb_id": 550, "media_type": "movie" } },
    "id": 1
  }'
```

### Using with Claude Desktop

You can create a custom MCP client config for Claude Desktop:

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

Or use an MCP client like `mcp-client` to make requests programmatically.

## Project Structure

```
streamlist/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication (login, logout, me, api-key)
│   │   ├── groups/        # Group management and polls
│   │   ├── mcp/           # MCP server endpoint
│   │   ├── preferences/   # User preferences
│   │   ├── watchlist/     # Watchlist management
│   │   └── ...
│   ├── groups/            # Groups pages
│   ├── login/             # Login page
│   ├── preferences/       # User preferences page
│   ├── watchlist/         # Watchlist page
│   ├── browse/            # Browse/discover page
│   └── globals.css        # Global styles
├── components/            # React components (MediaCard, UserContext, etc.)
├── db/                    # Database schema and migrations
├── lib/                   # Utilities (auth, db, tmdb, mcp)
├── types/                 # TypeScript type definitions
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
| **Polls** | Create polls to vote on what to watch next |
| **Invite Links** | Generate unique invite links that expire after 7 days |

### Group Permissions

- Only group members can view the group watchlist
- Only group members can create polls
- All members can vote on active polls

## License

MIT
