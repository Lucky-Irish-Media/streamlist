'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@/components/UserContext'
import MediaCard from '@/components/MediaCard'

export default function WatchlistPage() {
  const { user } = useUser()
  const [watchlist, setWatchlist] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    const sessionId = localStorage.getItem('sessionId')
    fetch('/api/watchlist', { 
      credentials: 'include',
      headers: sessionId ? { 'x-session-id': sessionId } : {}
    })
      .then(res => res.json())
      .then(data => {
        const list = data.watchlist || []
        setWatchlist(list)
        setLoading(false)
        
        if (list.length > 0) {
          Promise.all(
            list.map(async (item: any) => {
              const res = await fetch(`/api/media?id=${item.tmdbId}&type=${item.mediaType}`)
              return res.json()
            })
          ).then(results => setItems(results.filter((r: any) => !r.error)))
        } else {
          setItems([])
        }
      })
  }, [])

  const removeFromWatchlist = async (tmdbId: number, mediaType: string) => {
    console.log('Removing from watchlist:', { tmdbId, mediaType })
    const sessionId = localStorage.getItem('sessionId')
    await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(sessionId ? { 'x-session-id': sessionId } : {})
      },
      credentials: 'include',
      body: JSON.stringify({ tmdbId, mediaType }),
    })
    const newWatchlist = watchlist.filter(w => !(w.tmdbId === tmdbId && w.mediaType === mediaType))
    setWatchlist(newWatchlist)
    const newItems = items.filter(item => !(item.id === tmdbId && item.media_type === mediaType))
    setItems(newItems)
    if (newWatchlist.length === 0) {
      setItems([])
    }
  }

  if (!user) {
    return (
      <main className="container" style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Please log in to view your watchlist</h2>
        <Link href="/login" className="btn-primary" style={{ display: 'inline-block', marginTop: '16px' }}>
          Login
        </Link>
      </main>
    )
  }

  return (
    <main className="container" style={{ paddingTop: '32px' }}>
      <h1 style={{ marginBottom: '32px' }}>Your Watchlist</h1>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: '18px', marginBottom: '16px' }}>Your watchlist is empty</p>
          <Link href="/browse" className="btn-primary">Browse Movies & TV Shows</Link>
        </div>
      ) : (
        <div className="grid grid-5">
          {items.filter(Boolean).map((item: any) => (
            <MediaCard 
              key={item.id} 
              item={item} 
            />
          ))}
        </div>
      )}
    </main>
  )
}