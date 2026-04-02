# Agent Guidelines for StreamList

This file provides guidance for AI agents working on this codebase.

## Commands

### Development
```bash
npm run dev          # Start development server
npm run build       # Build for production
npm run start       # Start production server
```

### Deployment
```bash
npm run build
```

To deploy to preview (use `--branch preview`):
```bash
npx wrangler pages deploy .vercel/output/static --branch preview --commit-dirty=true
```

To deploy to production (use `--branch main`):
```bash
npx wrangler pages deploy .vercel/output/static --branch main --commit-dirty=true
```

**IMPORTANT:** Deploys MUST go ONLY to Preview branch unless explicitly stated otherwise by the user. Never deploy to production without explicit permission.

Preview URL: https://preview.streamlist-40n.pages.dev
Production URL: https://streamlist-40n.pages.dev

### Database
```bash
npm run db:generate  # Generate Drizzle migrations
npm run db:push      # Push schema to local database

# For remote D1 database changes (preview only by default):
npx wrangler d1 execute streamlist-preview-db --remote --command="ALTER TABLE ..."
```

**IMPORTANT:** Database migrations MUST only run on Preview unless explicitly stated otherwise. Never run migrations on production without explicit permission.

### Type Checking
```bash
npx tsc --noEmit    # Run TypeScript type checker
```

Note: No test framework or linter is configured. Run `npx tsc --noEmit` before committing to catch type errors.

## Code Style Guidelines

### General
- Use TypeScript for all files (.ts/.tsx)
- Enable strict mode in TypeScript (already configured)
- No comments unless explaining complex logic or business rules

### Imports
- Use path aliases: `@/*` maps to project root
- Order imports: React → external libs → internal libs → components
- Example:
  ```tsx
  import { useState, useEffect } from 'react'
  import Link from 'next/link'
  import { useUser } from '@/components/UserContext'
  import MediaCard from '@/components/MediaCard'
  ```

### Naming Conventions
- **Files**: kebab-case for pages (`login/page.tsx`), PascalCase for components (`MediaCard.tsx`)
- **Functions**: camelCase, use verb prefixes (`getTrending`, `fetchFromTMDB`)
- **Types/Interfaces**: PascalCase with descriptive names (`MediaItem`, `UserContextType`)
- **Constants**: UPPER_SNAKE_CASE for config values, PascalCase for service objects

### TypeScript
- Define explicit return types for API routes and utility functions
- Use interfaces for object shapes, avoid `any` when possible
- Use `Record<string, T>` for dictionary types
- Nullable values: prefer `null` over `undefined` for optional fields

### React Components
- Use `'use client'` directive for client-side components
- Use functional components with hooks
- Destructure props in component signature
- Keep components focused and small (< 200 lines preferred)
- Use early returns for conditionals (e.g., `if (!user) return <NotLoggedIn />`)

### API Routes (Next.js App Router)
- Place in `app/api/[resource]/route.ts`
- Export named functions: `GET`, `POST`, `PUT`, `DELETE`
- Use Edge runtime for Cloudflare compatibility: `export const runtime = 'edge'`
- Handle errors with try/catch, return JSON error responses
- Access Cloudflare bindings via `getRequestContext()`:
  ```ts
  import { getRequestContext } from '@cloudflare/next-on-pages'
  export const runtime = 'edge'
  export async function POST(req: NextRequest) {
    const { env } = getRequestContext()
    const db = env.DB  // D1 database binding
  }
  ```

### Database (Drizzle ORM)
- Define schema in `db/schema.ts`
- Use `drizzle-orm/sqlite-core` for SQLite types
- Use helper functions from `lib/db.ts`: `getDB()`, `schema`
- Query with typed DSL, not raw SQL when possible

### MCP Server
- MCP endpoint at `app/api/mcp/route.ts` (Edge runtime)
- API key management at `app/api/auth/api-key/route.ts`
- Schema includes `users.apiKey` for MCP authentication
- Tools defined in `lib/mcp/server.ts` (for stdio-based usage)

### Error Handling
- API routes: Return `{ error: 'message' }` with appropriate HTTP status
- Frontend: Display user-friendly error messages, log details to console
- Use try/catch for async operations, handle promise rejections

### Styling
- Use CSS variables from `app/globals.css` (e.g., `var(--bg-primary)`)
- Prefer inline styles for one-off styling, use CSS classes for reusable patterns
- Use semantic HTML elements

### Cloudflare Pages Specific
- All API routes must use Edge runtime
- Access environment variables via `env` from `getRequestContext()`
- D1 database binding accessed as `env.DB`
- D1 credentials stored in `wrangler.toml`, not committed

### Security
- Never commit API keys or secrets
- Use `.env.local` for local dev, Cloudflare dashboard for production secrets
- Validate all user input in API routes
- Use HTTP-only cookies for session tokens (handled in `lib/auth.ts`)
- MCP server uses `x-api-key` header for authentication (stored in users table)

### File Organization
```
app/
├── api/           # API routes (Edge runtime)
│   ├── mcp/       # MCP server endpoint
│   └── auth/      # Auth endpoints (login, logout, me, api-key)
├── login/         # Page route
├── preferences/   # Page route
├── watchlist/     # Page route
├── browse/        # Page route
├── layout.tsx     # Root layout
├── page.tsx       # Home page
└── globals.css    # Global styles

components/        # Reusable React components
lib/               # Utilities (auth, db, tmdb)
lib/mcp/           # MCP server implementation (for stdio-based usage)
db/                # Database schema and migrations
```

### Using StreamList MCP with OpenCode

1. Update the URL in `opencode.json` to match your deployment
2. Generate an API key in Preferences → API Access
3. Set the `STREAMLIST_API_KEY` environment variable:

```bash
export STREAMLIST_API_KEY="your_api_key_here"
```

Then in prompts, you can say things like:
- "Use streamlist to get my recommendations"
- "Add Inception to my watchlist using streamlist"
- "What are my liked movies? use streamlist"

### Before Committing
1. Run `npx tsc --noEmit` to check for type errors
2. Ensure build succeeds: `npm run build`
3. Check for console.log statements (remove in production code)
