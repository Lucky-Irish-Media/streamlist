'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@/components/UserContext'
import MediaCard from '@/components/MediaCard'
import MediaTable from '@/components/MediaTable'
import MediaDetailModal from '@/components/MediaDetailModal'
import ViewToggle from '@/components/ViewToggle'
import SearchInlineButton from '@/components/SearchInlineButton'
import StreamingServiceFilter from '@/components/StreamingServiceFilter'
import { SkeletonGrid } from '@/components/Skeleton'
import type { RecommendationsData, ScoredMediaItem, MediaItem } from '@/types/media'
import type { ViewMode } from '@/components/ViewToggle'

const SEARCH_HISTORY_KEY = 'streamlist_search_history'
const MAX_SEARCH_HISTORY = 5

function getSearchHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveSearchToHistory(query: string) {
  if (typeof window === 'undefined' || !query.trim()) return
  try {
    const history = getSearchHistory()
    const filtered = history.filter(h => h.toLowerCase() !== query.toLowerCase())
    const updated = [query, ...filtered].slice(0, MAX_SEARCH_HISTORY)
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated))
  } catch {}
}

function clearSearchHistory() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SEARCH_HISTORY_KEY)
}

function HomeContent() {
  const { user } = useUser()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<RecommendationsData | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null)
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
  const [detailItem, setDetailItem] = useState<MediaItem | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set())
  const [refreshing, setRefreshing] = useState(false)
  const [visibleCount, setVisibleCount] = useState(30)
  const [selectedProviderIds, setSelectedProviderIds] = useState<Set<string>>(new Set())
  const dataFetchedRef = useRef(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hidden = localStorage.getItem('streamlist_hide_getting_started')
      if (hidden !== 'true') {
        setShowBanner(true)
      }
    }
  }, [])

  const dismissBanner = () => {
    localStorage.setItem('streamlist_hide_getting_started', 'true')
    setShowBanner(false)
  }

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return
    saveSearchToHistory(searchQuery)
    setSearchHistory(getSearchHistory())
    setShowHistory(false)
    router.push(`/browse?q=${encodeURIComponent(searchQuery)}`)
  }, [searchQuery, router])

  useEffect(() => {
    setSearchHistory(getSearchHistory())
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
        setShowHistory(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchRecommendations = useCallback(async (refresh?: boolean) => {
    const params = refresh ? '?refresh=1' : ''
    return fetch(`/api/recommendations${params}`)
      .then(res => res.json() as Promise<RecommendationsData>)
  }, [])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    if (dataFetchedRef.current) return
    dataFetchedRef.current = true

    const ids = user.streamingServices?.length
      ? new Set(user.streamingServices.map(s => s.id))
      : new Set<string>()

    setSelectedProviderIds(ids)
    fetchRecommendations(false)
      .then(data => setData(data))
      .finally(() => setLoading(false))
  }, [user, fetchRecommendations])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    fetchRecommendations(true)
      .then(data => {
        setData(data)
      })
      .catch(() => {
        // fetch error — keep existing data
      })
      .finally(() => setRefreshing(false))
  }, [fetchRecommendations])

  const handleSortChange = useCallback((key: string) => {
    if (sortKey !== key) {
      const defaultDir = (key === 'rating' || key === 'year') ? 'desc' : 'asc'
      setSortKey(key)
      setSortDir(defaultDir)
    } else if (sortDir === 'asc') {
      setSortDir('desc')
    } else {
      setSortKey(null)
      setSortDir(null)
    }
  }, [sortKey, sortDir])

  const dropdownValue = sortKey === 'rating' ? 'rating'
    : sortKey === 'year' ? 'release-date'
    : 'popularity'

  const sortedForYou = useMemo(() => {
    let itemsCopy = [...(data?.forYou || [])]

    // Filter by selected streaming services
    if (selectedProviderIds.size > 0) {
      itemsCopy = itemsCopy.filter(item => {
        if (!item.providers) return true
        return item.providers.some(pid => selectedProviderIds.has(String(pid)))
      })
    }

    // Sort
    if (sortKey && sortDir) {
      itemsCopy.sort((a, b) => {
        switch (sortKey) {
          case 'title': {
            const titleA = (a.title || a.name || '').toLowerCase()
            const titleB = (b.title || b.name || '').toLowerCase()
            const cmp = titleA.localeCompare(titleB)
            return sortDir === 'desc' ? -cmp : cmp
          }
          case 'type': {
            const typeA = (a.media_type || a.mediaType || 'movie')
            const typeB = (b.media_type || b.mediaType || 'movie')
            const cmp = typeA.localeCompare(typeB)
            return sortDir === 'desc' ? -cmp : cmp
          }
          case 'rating': {
            const diff = (b.vote_average || 0) - (a.vote_average || 0)
            return sortDir === 'asc' ? -diff : diff
          }
          case 'year': {
            const dateA = a.release_date || a.first_air_date || ''
            const dateB = b.release_date || b.first_air_date || ''
            const cmp = dateB.localeCompare(dateA)
            return sortDir === 'asc' ? -cmp : cmp
          }
          default:
            return 0
        }
      })
    }

    return itemsCopy.filter(item => !dismissedIds.has(item.id))
  }, [data?.forYou, sortKey, sortDir, dismissedIds, selectedProviderIds])

  const hasMoreItems = useMemo(() => visibleCount < sortedForYou.length, [visibleCount, sortedForYou.length])

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }

    if (node) {
      observerRef.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && visibleCount < sortedForYou.length) {
          setVisibleCount(prev => Math.min(prev + 20, sortedForYou.length))
        }
      }, { rootMargin: '400px' })
      observerRef.current.observe(node)
    }
  }, [visibleCount, sortedForYou.length])

  if (!user) {
    return (
      <div className="hero">
        <h1>Your Personal Watchlist</h1>
        <p>Discover movies and TV shows from your favorite streaming services</p>
        <Link href="/login" className="btn-hero">
          Get Started
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <main className="container page-content">
        <section className="section">
          <SkeletonGrid count={5} />
        </section>
        <section className="section">
          <SkeletonGrid count={5} />
        </section>
      </main>
    )
  }

return (
    <>
    <main className="container page-content">
      {showBanner && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '16px 20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          marginBottom: '24px',
        }}>
          <div style={{ flex: 1 }}>
            <strong style={{ marginRight: '8px' }}>New here?</strong>
            Check out our <Link href="/getting-started" style={{ textDecoration: 'underline' }}>getting started guide</Link>
          </div>
          <button onClick={dismissBanner} style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '20px',
            padding: '0 4px',
          }}>×</button>
        </div>
      )}
          <div className="browse-search">
        <div className="browse-search-input">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search movies and TV shows..."
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            onFocus={() => setShowHistory(true)}
          />
          <SearchInlineButton onClick={handleSearch} disabled={!searchQuery.trim()} />
          {showHistory && searchHistory.length > 0 && !searchQuery && (
            <div className="search-history-dropdown">
              <div className="search-history-header">
                <span>Recent Searches</span>
                <button
                  onClick={(e) => { e.stopPropagation(); clearSearchHistory(); setSearchHistory([]) }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: '12px' }}
                >
                  Clear all
                </button>
              </div>
              {searchHistory.map((item, idx) => (
                <div
                  key={idx}
                  className="search-history-item"
                  onClick={() => { setSearchQuery(item); setShowHistory(false); handleSearch() }}
                >
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
        <ViewToggle viewMode={viewMode} onToggle={handleViewToggle} />
        <select
          value={dropdownValue}
          onChange={e => {
            const val = e.target.value
            if (val === 'rating') { setSortKey('rating'); setSortDir('desc') }
            else if (val === 'release-date') { setSortKey('year'); setSortDir('desc') }
            else { setSortKey(null); setSortDir(null) }
          }}
          className="sort-select"
        >
          <option value="popularity">Popularity</option>
          <option value="rating">Rating</option>
          <option value="release-date">Release Date</option>
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <StreamingServiceFilter
          services={data?.userPreferences?.streamingServices || []}
          selectedIds={selectedProviderIds}
          onChange={(ids) => setSelectedProviderIds(ids)}
        />
      </div>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Recommendations</h2>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="refresh-btn"
            aria-label="Refresh recommendations"
            title="Refresh recommendations"
          >
            <span className={`refresh-icon${refreshing ? ' spinning' : ''}`}>↻</span>
          </button>
        </div>
        {sortedForYou.length === 0 ? (
          <p className="empty-message">
            {data?.forYou && data.forYou.length > 0
              ? 'No items match the selected streaming services. Try selecting more services.'
              : data?.userPreferences?.streamingServices?.length === 0
              ? 'Like some movies or shows to get personalized recommendations.'
              : 'No recommendations available yet. Like some movies or shows to help us find content for you.'}
          </p>
        ) : viewMode === 'table' ? (
          <div className={refreshing ? 'grid-refreshing' : ''}>
            <MediaTable
              items={sortedForYou.slice(0, visibleCount)}
              onDismiss={(id) => setDismissedIds(prev => new Set(prev).add(id))}
              onOpenDetail={(item) => setDetailItem(item)}
              sortKey={sortKey}
              sortDir={sortDir}
              onSortChange={handleSortChange}
            />
          </div>
        ) : (
          <div className={`grid grid-5${refreshing ? ' grid-refreshing' : ''}`}>
            {sortedForYou.slice(0, visibleCount).map((item: ScoredMediaItem) => (
              <MediaCard key={item.id} item={item} onDismiss={(id) => setDismissedIds(prev => new Set(prev).add(id))} />
            ))}
          </div>
        )}

        {hasMoreItems && (
          <div ref={sentinelRef} style={{ height: 1 }} />
        )}
      </section>
    </main>

    {detailItem && (
      <MediaDetailModal
        tmdbId={detailItem.id}
        mediaType={detailItem.media_type || detailItem.mediaType || 'movie'}
        onClose={() => setDetailItem(null)}
        onDismiss={(id) => setDismissedIds(prev => new Set(prev).add(id))}
      />
    )}
    </>
  )
}

export default function Home() {
  return <HomeContent />
}
