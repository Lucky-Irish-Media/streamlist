'use client'

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import MediaCard from '@/components/MediaCard'
import MediaTable from '@/components/MediaTable'
import MediaDetailModal from '@/components/MediaDetailModal'
import ViewToggle from '@/components/ViewToggle'
import EmptyState from '@/components/EmptyState'
import { SkeletonGrid } from '@/components/Skeleton'
import { useUser } from '@/components/UserContext'
import { Search } from 'lucide-react'
import SearchInlineButton from '@/components/SearchInlineButton'
import StreamingServiceFilter from '@/components/StreamingServiceFilter'
import type { MediaItem } from '@/types/media'
import type { ViewMode } from '@/components/ViewToggle'

type Tab = 'trending' | 'movies' | 'tv' | 'new-movies' | 'new-tv'
type SortOption = 'popularity' | 'rating' | 'release-date'

const tabLabels: Record<Tab, string> = {
  trending: 'Trending',
  movies: 'Popular Movies',
  tv: 'Popular TV Shows',
  'new-movies': 'In Theaters',
  'new-tv': 'On TV Now',
}

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

function BrowsePageContent() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') as Tab | null
  const initialQuery = searchParams.get('q')
  const { user, userLoading } = useUser()
  const [tab, setTab] = useState<Tab>(initialTab || 'trending')
  const [sortBy, setSortBy] = useState<SortOption>('popularity')
  const [selectedProviderIds, setSelectedProviderIds] = useState<Set<string>>(new Set())
  const filterInitialized = useRef(false)
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
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [searchQuery, setSearchQuery] = useState(initialQuery || '')
  const [searchResults, setSearchResults] = useState<MediaItem[]>([])
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [detailItem, setDetailItem] = useState<MediaItem | null>(null)
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set())
  const searchInputRef = useRef<HTMLInputElement>(null)
  const isInitialSearch = useRef(true)

  useEffect(() => {
    if (!filterInitialized.current && !userLoading && user?.streamingServices?.length) {
      filterInitialized.current = true
      setSelectedProviderIds(new Set(user.streamingServices.map(s => s.id)))
    }
  }, [user, userLoading])

  const providerIdsForApi = useMemo(() => {
    if (selectedProviderIds.size === 0) return ''
    return Array.from(selectedProviderIds).join('|')
  }, [selectedProviderIds])

  const watchRegion = useMemo(() => {
    const countries = (user as any)?.countries
    return Array.isArray(countries) && countries.length > 0 ? countries[0] : 'US'
  }, [user])

  const hasStreamingFilter = providerIdsForApi.length > 0

  const fetchData = useCallback(async (pageNum: number, isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    let url = `/api/browse?tab=${tab}&page=${pageNum}`
    if (hasStreamingFilter) {
      url += `&streamable=true&provider_ids=${encodeURIComponent(providerIdsForApi)}&watch_region=${watchRegion}`
    }

    const res = await fetch(url)
    const data = await res.json() as { results?: MediaItem[]; hasMore?: boolean }

    if (!res.ok || !data.results) {
      setLoading(false)
      setLoadingMore(false)
      return
    }

    if (isLoadMore) {
      setItems(prev => [...prev, ...data.results!])
    } else {
      setItems(data.results!)
    }
    setHasMore(data.hasMore ?? false)
    setPage(pageNum)
    setLoading(false)
    setLoadingMore(false)
  }, [tab, hasStreamingFilter, providerIdsForApi, watchRegion])

  useEffect(() => {
    if (userLoading) return
    setItems([])
    setPage(1)
    setHasMore(true)
    fetchData(1)
  }, [tab, fetchData, userLoading])

  const performSearch = useCallback(async (query: string, currentTab: Tab) => {
    if (!query.trim()) return
    const currentSearchType = currentTab === 'movies' || currentTab === 'new-movies' ? 'movie'
      : currentTab === 'tv' || currentTab === 'new-tv' ? 'tv'
      : null
    saveSearchToHistory(query)
    setSearchHistory(getSearchHistory())
    setShowHistory(false)
    const typeParam = currentSearchType ? `&type=${currentSearchType}` : ''
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}${typeParam}`)
    const data = await res.json() as { results?: MediaItem[] }
    setSearchResults(data.results || [])
  }, [])

  useEffect(() => {
    setSearchHistory(getSearchHistory())
  }, [])

  useEffect(() => {
    if (!user) return
    fetch('/api/recommendations/dismissed', { credentials: 'include' })
      .then(res => res.json() as Promise<{ dismissed?: { tmdbId: number }[] }>)
      .then(data => {
        if (data.dismissed) {
          setDismissedIds(new Set(data.dismissed.map(d => d.tmdbId)))
        }
      })
      .catch(() => {})
  }, [user])

  useEffect(() => {
    if (isInitialSearch.current && initialQuery) {
      isInitialSearch.current = false
      performSearch(initialQuery, tab)
    }
  }, [initialQuery, tab, performSearch])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
        setShowHistory(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const searchType = tab === 'movies' || tab === 'new-movies' ? 'movie'
    : tab === 'tv' || tab === 'new-tv' ? 'tv'
    : null

  const sortedItems = useMemo(() => {
    if (searchQuery) return searchResults
    const itemsCopy = [...items]
    switch (sortBy) {
      case 'rating':
        return itemsCopy.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
      case 'release-date':
        return itemsCopy.sort((a, b) => {
          const dateA = a.release_date || a.first_air_date || ''
          const dateB = b.release_date || b.first_air_date || ''
          return dateB.localeCompare(dateA)
        })
      case 'popularity':
      default:
        return itemsCopy
    }
  }, [items, searchResults, searchQuery, sortBy])

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchData(page + 1, true)
    }
  }

  const handleDismiss = (id: number) => {
    setDismissedIds(prev => new Set(prev).add(id))
    setItems(prev => prev.filter(item => item.id !== id))
  }

  const search = async () => {
    if (!searchQuery.trim()) return
    saveSearchToHistory(searchQuery)
    setSearchHistory(getSearchHistory())
    setShowHistory(false)
    const typeParam = searchType ? `&type=${searchType}` : ''
    const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}${typeParam}`)
    const data = await res.json() as { results?: MediaItem[] }
    setSearchResults(data.results || [])
  }

  const displayItems = sortedItems.filter(item => !dismissedIds.has(item.id))

  const searchPlaceholder = searchType === 'movie' ? 'Search movies...'
    : searchType === 'tv' ? 'Search TV shows...'
    : 'Search movies and TV shows...'

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab)
    setSearchQuery('')
    setSearchResults([])
  }

  return (
    <>
    <main className="container page-content">
      <div className="browse-search">
          <div className="browse-search-input">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            onKeyDown={e => e.key === 'Enter' && search()}
            onFocus={() => { setShowHistory(true); setSearchHistory(getSearchHistory()) }}
          />
          <SearchInlineButton onClick={search} disabled={!searchQuery.trim()} />
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
                  onClick={async (e) => {
                    e.stopPropagation()
                    setSearchQuery(item)
                    setShowHistory(false)
                    const currentSearchType = tab === 'movies' || tab === 'new-movies' ? 'movie'
                      : tab === 'tv' || tab === 'new-tv' ? 'tv'
                      : null
                    saveSearchToHistory(item)
                    setSearchHistory(getSearchHistory())
                    const typeParam = currentSearchType ? `&type=${currentSearchType}` : ''
                    const res = await fetch(`/api/search?q=${encodeURIComponent(item)}${typeParam}`)
                    const data = await res.json() as { results?: MediaItem[] }
                    setSearchResults(data.results || [])
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
        {searchQuery && (
          <button onClick={() => { setSearchQuery(''); setSearchResults([]) }} className="btn-secondary">
            Clear
          </button>
        )}
        {user && user.streamingServices.length > 0 && !searchQuery && (
          <div style={{ marginBottom: '12px' }}>
            <StreamingServiceFilter
              services={user.streamingServices}
              selectedIds={selectedProviderIds}
              onChange={setSelectedProviderIds}
            />
          </div>
        )}
        <div className="browse-controls-row">
          {!searchQuery && items.length > 0 && (
            <>
              <ViewToggle viewMode={viewMode} onToggle={handleViewToggle} />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortOption)}
                className="sort-select"
              >
                <option value="popularity">Popularity</option>
                <option value="rating">Rating</option>
                <option value="release-date">Release Date</option>
              </select>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div className="browse-tabs" style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap' }}>
          {(['trending', 'movies', 'tv', 'new-movies', 'new-tv'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={tab === t ? 'btn-primary' : 'btn-secondary'}
            >
              {tabLabels[t]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <SkeletonGrid count={10} />
      ) : (
        <>
          {viewMode === 'table' ? (
            <MediaTable items={displayItems} onDismiss={handleDismiss} onOpenDetail={(item) => setDetailItem(item)} />
          ) : (
            <div className="grid grid-5">
              {displayItems.map((item: MediaItem) => (
                <MediaCard key={item.id} item={item} onDismiss={handleDismiss} />
              ))}
            </div>
          )}

          {!searchQuery && hasMore && !loadingMore && (
            <div style={{ textAlign: 'center', marginTop: '32px' }}>
              <button onClick={loadMore} className="btn-secondary" style={{ minWidth: '200px' }}>
                Load More
              </button>
            </div>
          )}

          {loadingMore && (
            <SkeletonGrid count={5} />
          )}
        </>
      )}

      {displayItems.length === 0 && !loading && (
        <EmptyState
          icon={Search}
          title="No Results Found"
          description={searchQuery ? `No results for "${searchQuery}"` : "No content available"}
          actionText={searchQuery ? "Clear Search" : undefined}
          actionHref={searchQuery ? "/browse" : undefined}
        />
      )}
    </main>

    {detailItem && (
      <MediaDetailModal
        tmdbId={detailItem.id}
        mediaType={detailItem.media_type || detailItem.mediaType || 'movie'}
        onClose={() => setDetailItem(null)}
        onDismiss={handleDismiss}
      />
    )}
    </>
  )
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<main className="container page-content"><div className="grid grid-5">{Array.from({ length: 10 }).map((_, i) => <div key={i} style={{ aspectRatio: '2/3', background: 'var(--bg-tertiary)', borderRadius: '8px' }} />)}</div></main>}>
      <BrowsePageContent />
    </Suspense>
  )
}
