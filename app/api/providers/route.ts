import { NextRequest, NextResponse } from 'next/server'
import { getWatchProviders } from '@/lib/tmdb'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const regions = searchParams.get('regions')?.split(',').filter(Boolean) || ['US']

  try {
    const providers = await getWatchProviders(regions)
    return NextResponse.json({ providers })
  } catch (err) {
    console.error('Failed to fetch providers:', err)
    return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 })
  }
}
