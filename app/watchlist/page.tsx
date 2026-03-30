'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useUser } from '@/components/UserContext'
import MediaCard from '@/components/MediaCard'
import EmptyState from '@/components/EmptyState'
import { SkeletonGrid } from '@/components/Skeleton'
import { Lock, ListPlus } from 'lucide-react'
import type { WatchlistItem, MediaItem } from '@/types/media'

type SortOption = 'date-added' | 'rating' | 'title' | 'release-date'
type FilterOption = 'to-watch' | 'all' | 'watched'

export default function WatchlistPage() {
  const { user } = useUser()
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [watched, setWatched] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<MediaItem[]>([])
  const [sortBy, setSortBy] = useState<SortOption>('date-added')
  const [filterBy, setFilterBy] = useState<FilterOption>('to-watch')

  useEffect(() => {
    const sessionId = localStorage.getItem('sessionId')
    Promise.all([
      fetch('/api/watchlist', { 
        credentials: 'include',
        headers: sessionId ? { 'x-session-id': sessionId } : {}
      }).then(res => res.json()),
      fetch('/api/watched', { 
        credentials: 'include',
        headers: sessionId ? { 'x-session-id': sessionId } : {}
      }).then(res => res.json())
    ]).then(([watchlistData, watchedData]) => {
      const list = watchlistData.watchlist || []
      const watchedList = watchedData.watched || []
      setWatchlist(list)
      setWatched(watchedList)
      setLoading(false)
      
      if (list.length > 0) {
        Promise.all(
          list.map(async (item: WatchlistItem) => {
            const res = await fetch(`/api/media?id=${item.tmdbId}&type=${item.mediaType}`)
            return res.json() as Promise<MediaItem & { error?: string }>
          })
        ).then(results => setItems(results.filter((r) => !(r as MediaItem & { error?: string }).error) as MediaItem[]))
      } else {
        setItems([])
      }
    })
  }, [])

  const sortedItems = useMemo(() => {
    const watchedIds = new Set(watched.map(w => `${w.tmdbId}-${w.mediaType}`))
    
    let filtered = items
    if (filterBy === 'to-watch') {
      filtered = items.filter(item => !watchedIds.has(`${item.id}-${item.media_type || item.mediaType || 'movie'}`))
    } else if (filterBy === 'watched') {
      filtered = items.filter(item => watchedIds.has(`${item.id}-${item.media_type || item.mediaType || 'movie'}`))
    }
    
    const itemsCopy = [...filtered]
    switch (sortBy) {
      case 'title':
        return itemsCopy.sort((a, b) => (a.title || a.name || '').localeCompare(b.title || b.name || ''))
      case 'rating':
        return itemsCopy.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
      case 'release-date':
        return itemsCopy.sort((a, b) => {
          const dateA = a.release_date || a.first_air_date || ''
          const dateB = b.release_date || b.first_air_date || ''
          return dateB.localeCompare(dateA)
        })
      case 'date-added':
      default:
        return itemsCopy
    }
  }, [items, sortBy, filterBy, watched])

  const removeFromWatchlist = async (tmdbId: number, mediaType: string) => {
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
      <main className="container" style={{ paddingTop: '32px' }}>
        <EmptyState
          icon={Lock}
          title="Login Required"
          description="Please log in to view your watchlist"
          actionText="Login"
          actionHref="/login"
        />
      </main>
    )
  }

  return (
    <main className="container" style={{ paddingTop: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1>Your Watchlist</h1>
        {items.length > 0 && (
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
            style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          >
            <option value="date-added">Date Added</option>
            <option value="rating">Rating</option>
            <option value="title">Title</option>
            <option value="release-date">Release Date</option>
          </select>
        )}
      </div>

      {items.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => setFilterBy('to-watch')}
            style={{
              padding: '8px 16px',
              backgroundColor: filterBy === 'to-watch' ? 'var(--bg-secondary)' : 'transparent',
              color: filterBy === 'to-watch' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              borderBottom: filterBy === 'to-watch' ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer'
            }}
          >
            To Watch
          </button>
          <button
            onClick={() => setFilterBy('all')}
            style={{
              padding: '8px 16px',
              backgroundColor: filterBy === 'all' ? 'var(--bg-secondary)' : 'transparent',
              color: filterBy === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              borderBottom: filterBy === 'all' ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer'
            }}
          >
            All
          </button>
          <button
            onClick={() => setFilterBy('watched')}
            style={{
              padding: '8px 16px',
              backgroundColor: filterBy === 'watched' ? 'var(--bg-secondary)' : 'transparent',
              color: filterBy === 'watched' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              borderBottom: filterBy === 'watched' ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer'
            }}
          >
            Watched
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonGrid count={5} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ListPlus}
          title="Your Watchlist is Empty"
          description="Start adding movies and TV shows to keep track of what you want to watch"
          actionText="Start Browsing"
          actionHref="/browse"
        />
      ) : (
        <div className="grid grid-5">
          {sortedItems.filter(Boolean).map((item: MediaItem) => (
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
