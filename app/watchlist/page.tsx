'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useUser } from '@/components/UserContext'
import MediaCard from '@/components/MediaCard'
import MediaTable from '@/components/MediaTable'
import ViewToggle from '@/components/ViewToggle'
import EmptyState from '@/components/EmptyState'
import LoadingImage from '@/components/LoadingImage'
import { Lock, ListPlus } from 'lucide-react'
import type { WatchlistItem, MediaItem } from '@/types/media'
import type { ViewMode } from '@/components/ViewToggle'

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
  const [viewMode, setViewMode] = useState<ViewMode>('card')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('streamlist_view_mode')
      if (stored === 'card' || stored === 'table') setViewMode(stored)
    }
  }, [])

  const handleViewToggle = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('streamlist_view_mode', mode)
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/watchlist', { 
        credentials: 'include'
      }).then(res => res.json() as Promise<{ watchlist?: WatchlistItem[] }>),
      fetch('/api/watched', { 
        credentials: 'include'
      }).then(res => res.json() as Promise<{ watched?: WatchlistItem[] }>)
    ]).then(([watchlistData, watchedData]) => {
      const list = watchlistData.watchlist || []
      const watchedList = watchedData.watched || []
      setWatchlist(list)
      setWatched(watchedList)
      
      if (list.length > 0) {
        const ids = list.map(item => `${item.tmdbId}|${item.mediaType}`).join(',')
        fetch(`/api/media/batch?ids=${ids}`)
          .then(res => res.json() as Promise<{ items: MediaItem[] }>)
          .then(data => {
            setItems(data.items || [])
            setLoading(false)
          })
      } else {
        setItems([])
        setLoading(false)
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
    await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
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
      <main className="container page-content">
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
    <main className="container page-content">
      <div className="page-header">
        <h1>Your Watchlist</h1>
        {items.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ViewToggle viewMode={viewMode} onToggle={handleViewToggle} />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              className="sort-select"
            >
              <option value="date-added">Date Added</option>
              <option value="rating">Rating</option>
              <option value="title">Title</option>
              <option value="release-date">Release Date</option>
            </select>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="filter-tabs">
          <button
            onClick={() => setFilterBy('to-watch')}
            className={`filter-tab ${filterBy === 'to-watch' ? 'active' : ''}`}
          >
            To Watch
          </button>
          <button
            onClick={() => setFilterBy('all')}
            className={`filter-tab ${filterBy === 'all' ? 'active' : ''}`}
          >
            All
          </button>
          <button
            onClick={() => setFilterBy('watched')}
            className={`filter-tab ${filterBy === 'watched' ? 'active' : ''}`}
          >
            Watched
          </button>
        </div>
      )}

      {loading ? (
        <LoadingImage />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ListPlus}
          title="Your Watchlist is Empty"
          description="Start adding movies and TV shows to keep track of what you want to watch"
          actionText="Start Browsing"
          actionHref="/browse"
        />
      ) : viewMode === 'table' ? (
        <MediaTable items={sortedItems.filter(Boolean)} />
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
