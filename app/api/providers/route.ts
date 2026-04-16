import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getTMDBConfig } from '@/lib/tmdb'
import { cachedGetWatchProviders } from '@/lib/tmdb-cache'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { env } = getRequestContext()
  const tmdb = getTMDBConfig(env as any)
  const { searchParams } = new URL(req.url)
  const regions = searchParams.get('regions')?.split(',').filter(Boolean) || ['US']

  try {
    const providers = await cachedGetWatchProviders(regions, tmdb, env as any)
    return NextResponse.json({ providers })
  } catch (err) {
    console.error('Failed to fetch providers:', err)
    return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 })
  }
}
