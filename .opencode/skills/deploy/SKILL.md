---
name: deploy
description: Deployment details and troubleshooting for StreamList on Cloudflare Pages
---

## Deployment Guide

StreamList deploys to Cloudflare Pages using `@cloudflare/next-on-pages`.

### Prerequisites

- `package.json` must have `"type": "module"`
- `wrangler.toml` must have `pages_build_output_dir = ".vercel/output/static"`

### How it works

- `npm run deploy` runs `npx @cloudflare/next-on-pages` which:
  - Runs `next build`
  - Generates `.vercel/output/static` with prerendered HTML
  - Creates edge functions in `.vercel/output/static/_worker.js`
- `npx wrangler pages deploy .vercel/output/static` uploads to Cloudflare

### Common Mistakes

1. Deploying from `.next/server/app` — HTML gets served as JS (MIME errors, chunk load failures)
2. Running `wrangler pages deploy` without `npm run deploy` first — missing edge functions, API routes break
3. Missing `"type": "module"` in package.json — ES module warnings during build

### Quick Deploy

```bash
npm run deploy && npx wrangler pages deploy .vercel/output/static
```
