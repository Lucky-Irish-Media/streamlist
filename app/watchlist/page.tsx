'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useUser } from '@/components/UserContext'
import MediaCard from '@/components/MediaCard'
import MediaTable from '@/components/MediaTable'
import ViewToggle from '@/components/ViewToggle'
import EmptyState from '@/components/EmptyState'
import LoadingImage from '@/components/LoadingImage'
import { Lock, ListPlus, Loader2 } from 'lucide-react'
import type { WatchlistItem, MediaItem } from '@/types/media'
import type { ViewMode } from '@/components/ViewToggle'

type SortOption = 'date-added' | 'rating' | 'title' | 'release-date'
type FilterOption = 'to-watch' | 'all' | 'watched'

const PAGE_SIZE = 20

export default function WatchlistPage() {
  const { user } = useUser()
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [watched, setWatched] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [items, setItems] = useState<MediaItem[]>([])
  const [sortBy, setSortBy] = useState<SortOption>('date-added')
  const [filterBy, setFilterBy] = useState<FilterOption>('to-watch')
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [hasMore, setHasMore] = useState(false)
  const offsetRef = useRef(0)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const hasMoreRef = useRef(false)
  const loadingMoreRef = useRef(false)

  useEffect(() => { hasMoreRef.current = hasMore }, [hasMore])
  useEffect(() => { loadingMoreRef.current = loadingMore }, [loadingMore])

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
    fetch('/api/watched', {
      credentials: 'include'
    }).then(res => res.json() as Promise<{ watched?: WatchlistItem[] }>)
      .then(data => {
        setWatched(data.watched || [])
      })
  }, [])

  const loadPage = useCallback(async (pageOffset: number) => {
    const res = await fetch(`/api/watchlist?offset=${pageOffset}&limit=${PAGE_SIZE}`, {
      credentials: 'include'
    })
    const data = await res.json() as { watchlist?: WatchlistItem[]; total?: number }
    const newItems = data.watchlist || []
    const total = data.total || 0

    if (newItems.length > 0) {
      const ids = newItems.map(item => `${item.tmdbId}|${item.mediaType}`).join(',')
      const mediaRes = await fetch(`/api/media/batch?ids=${ids}`)
      const mediaData = await mediaRes.json() as { items: MediaItem[] }

      setWatchlist(prev => [...prev, ...newItems])
      setItems(prev => [...prev, ...(mediaData.items || [])])
    }

    const nextOffset = pageOffset + PAGE_SIZE
    offsetRef.current = nextOffset
    setHasMore(nextOffset < total)
  }, [])

  useEffect(() => {
    loadPage(0).then(() => setLoading(false))
  }, [loadPage])

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }

    if (node) {
      observerRef.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && hasMoreRef.current && !loadingMoreRef.current) {
          setLoadingMore(true)
          loadPage(offsetRef.current).then(() => setLoadingMore(false))
        }
      }, { rootMargin: '400px' })
      observerRef.current.observe(node)
    }
  }, [loadPage])

  const watchedIdSet = useMemo(() => new Set(watched.map(w => `${w.tmdbId}-${w.mediaType}`)), [watched])
  const watchlistIdSet = useMemo(() => new Set(watchlist.map(w => `${w.tmdbId}-${w.mediaType}`)), [watchlist])

  const sortedItems = useMemo(() => {
    const watchedIds = watchedIdSet

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
      ) : sortedItems.length === 0 ? (
        <EmptyState
          icon={ListPlus}
          title="Your Watchlist is Empty"
          description="Start adding movies and TV shows to keep track of what you want to watch"
          actionText="Start Browsing"
          actionHref="/browse"
        />
      ) : viewMode === 'table' ? (
        <MediaTable items={sortedItems.filter(Boolean)} watchlistIds={watchlistIdSet} watchedIds={watchedIdSet} />
      ) : (
        <div className="grid grid-5">
          {sortedItems.filter(Boolean).map((item: MediaItem) => {
            const mediaType = item.media_type || item.mediaType || 'movie'
            const key = `${item.id}-${mediaType}`
            return (
              <MediaCard
                key={item.id}
                item={item}
                defaultInWatchlist={true}
                defaultIsWatched={watchedIdSet.has(key)}
              />
            )
          })}
        </div>
      )}

      {!loading && hasMore && (
        <div ref={sentinelRef} style={{ height: 1 }} />
      )}

      {loadingMore && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      )}
    </main>
  )
}
