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
├── lib/                   # Utilities (auth, db, tmdb)
└── public/                # Static assets
```

## License

MIT
