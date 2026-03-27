---
name: build
description: Build and deploy StreamList to Cloudflare Pages
---

## Build & Deploy

StreamList is a Next.js app deployed to Cloudflare Pages via `@cloudflare/next-on-pages`.

### Steps

1. Run `npm run deploy` — compiles with `@cloudflare/next-on-pages`, outputs to `.vercel/output/static`
2. Run `npx wrangler pages deploy .vercel/output/static` — deploys compiled output

Or as a single command:

```bash
npm run deploy && npx wrangler pages deploy .vercel/output/static
```

### Rules

- Always run `npm run deploy` before `wrangler pages deploy` — otherwise old code gets deployed
- Never delete `.vercel` before deploying — it breaks the deploy
- Work from `/home/qwexer/Repos/streamlist`
