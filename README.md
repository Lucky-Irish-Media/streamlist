# StreamList

A personal watchlist app for discovering and tracking movies and TV shows. Built with Next.js and deployed on Cloudflare Pages.

## Features

- **Browse**: Discover trending, popular, and new release movies and TV shows
- **Watchlist**: Add and manage your personal watchlist
- **Recommendations**: Get personalized recommendations based on your preferences
- **Preferences**: Configure your favorite streaming services, genres, and region
- **Search**: Find movies and TV shows by name

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

#### Preferences
| Tool | Description |
|------|-------------|
| `get_preferences` | Get streaming services, genres, likes, and country |
| `update_streaming_services` | Set streaming services (`services` array) |
| `update_genres` | Set preferred genres (`genres` array) |
| `update_country` | Set country code (`country`) |
| `add_like` | Like a movie/show (`tmdb_id`, `media_type`, `title`) |
| `remove_like` | Unlike a movie/show (`tmdb_id`) |

#### Discovery
| Tool | Description |
|------|-------------|
| `get_recommendations` | Get personalized recommendations based on your likes |
| `get_trending` | Get trending movies/shows (`media_type`, `page`) |
| `search_media` | Search for movies/shows (`query`, `page`) |
| `get_media_details` | Get full details of a movie/show (`tmdb_id`, `media_type`) |
| `get_watch_providers` | Get streaming providers in your country (`tmdb_id`, `media_type`) |

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
│   ├── login/             # Login page
│   ├── preferences/       # User preferences
│   ├── watchlist/         # Watchlist page
│   └── browse/            # Browse page
├── components/            # React components
├── db/                    # Database schema
├── lib/                   # Utilities (auth, db, tmdb, mcp)
└── public/                # Static assets
```

## License

MIT
