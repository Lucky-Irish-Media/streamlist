'use client'

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import MediaCard from '@/components/MediaCard'
import EmptyState from '@/components/EmptyState'
import { SkeletonGrid } from '@/components/Skeleton'
import { Search } from 'lucide-react'
import type { MediaItem } from '@/types/media'

type Tab = 'trending' | 'movies' | 'tv' | 'new-movies' | 'new-tv'
type SortOption = 'popularity' | 'rating' | 'release-date'

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
  const [tab, setTab] = useState<Tab>(initialTab || 'trending')
  const [sortBy, setSortBy] = useState<SortOption>('popularity')
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MediaItem[]>([])
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async (pageNum: number, isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    const res = await fetch(`/api/browse?tab=${tab}&page=${pageNum}`)
    const data = await res.json()

    if (isLoadMore) {
      setItems(prev => [...prev, ...data.results])
    } else {
      setItems(data.results)
    }
    setHasMore(data.hasMore)
    setPage(pageNum)
    setLoading(false)
    setLoadingMore(false)
  }, [tab])

  useEffect(() => {
    setItems([])
    setPage(1)
    setHasMore(true)
    fetchData(1)
  }, [tab, fetchData])

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

  const searchType = tab === 'movies' || tab === 'new-movies' ? 'movie'
    : tab === 'tv' || tab === 'new-tv' ? 'tv'
    : null

  const search = async () => {
    if (!searchQuery.trim()) return
    saveSearchToHistory(searchQuery)
    setSearchHistory(getSearchHistory())
    setShowHistory(false)
    const typeParam = searchType ? `&type=${searchType}` : ''
    const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}${typeParam}`)
    const data = await res.json()
    setSearchResults(data.results || [])
  }

  const displayItems = sortedItems

  const searchPlaceholder = searchType === 'movie' ? 'Search movies...'
    : searchType === 'tv' ? 'Search TV shows...'
    : 'Search movies and TV shows...'

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab)
    setSearchQuery('')
    setSearchResults([])
  }

  return (
    <main className="container" style={{ paddingTop: '32px' }}>
      <div className="browse-search" style={{ marginBottom: '24px', display: 'flex', gap: '12px', position: 'relative' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            style={{ width: '100%' }}
            onKeyDown={e => e.key === 'Enter' && search()}
            onFocus={() => setShowHistory(true)}
          />
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
                  onClick={() => { setSearchQuery(item); setShowHistory(false); search() }}
                >
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={search} className="btn-primary">Search</button>
        {searchQuery && (
          <button onClick={() => { setSearchQuery(''); setSearchResults([]) }} className="btn-secondary">
            Clear
          </button>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div className="browse-tabs" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['trending', 'movies', 'tv', 'new-movies', 'new-tv'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={tab === t ? 'btn-primary' : 'btn-secondary'}
            >
              {t.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>

        {!searchQuery && items.length > 0 && (
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
            style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          >
            <option value="popularity">Popularity</option>
            <option value="rating">Rating</option>
            <option value="release-date">Release Date</option>
          </select>
        )}
      </div>

      {loading ? (
        <SkeletonGrid count={10} />
      ) : (
        <>
          <div className="grid grid-5">
            {displayItems.map((item: MediaItem) => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>

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
  )
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<main className="container" style={{ paddingTop: '32px' }}><div className="grid grid-5">{Array.from({ length: 10 }).map((_, i) => <div key={i} style={{ aspectRatio: '2/3', background: 'var(--bg-tertiary)', borderRadius: '8px' }} />)}</div></main>}>
      <BrowsePageContent />
    </Suspense>
  )
}
