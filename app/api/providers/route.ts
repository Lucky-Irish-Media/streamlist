import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getWatchProviders, getTMDBConfig } from '@/lib/tmdb'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { env } = getRequestContext()
  const tmdb = getTMDBConfig(env as any)
  const { searchParams } = new URL(req.url)
  const regions = searchParams.get('regions')?.split(',').filter(Boolean) || ['US']

  try {
    const providers = await getWatchProviders(regions, tmdb)
    return NextResponse.json({ providers })
  } catch (err) {
    console.error('Failed to fetch providers:', err)
    return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 })
  }
}
