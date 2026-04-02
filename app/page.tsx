'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@/components/UserContext'
import MediaCard from '@/components/MediaCard'
import { SkeletonGrid } from '@/components/Skeleton'
import type { RecommendationsData, ScoredMediaItem, MediaItem } from '@/types/media'

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
  const [sortBy, setSortBy] = useState<'popularity' | 'rating' | 'release-date'>('popularity')
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    if (user) {
      fetch('/api/recommendations')
        .then(res => res.json())
        .then(data => {
          setData(data)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [user])

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
      <main className="container" style={{ paddingTop: '32px' }}>
        <section className="section">
          <SkeletonGrid count={5} />
        </section>
        <section className="section">
          <SkeletonGrid count={5} />
        </section>
      </main>
    )
  }

  const sortItems = (items: MediaItem[]): MediaItem[] => {
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
  }

  const sortedForYou = sortItems([...(data?.forYou || [])])

  return (
    <main className="container" style={{ paddingTop: '32px' }}>
      <div className="browse-search" style={{ marginBottom: '24px', display: 'flex', gap: '12px', position: 'relative' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search movies and TV shows..."
            style={{ width: '100%' }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
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
                  onClick={() => { setSearchQuery(item); setShowHistory(false); handleSearch() }}
                >
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={handleSearch} className="btn-primary">Search</button>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'popularity' | 'rating' | 'release-date')}
          style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
        >
          <option value="popularity">Popularity</option>
          <option value="rating">Rating</option>
          <option value="release-date">Release Date</option>
        </select>
      </div>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Recommendations</h2>
        </div>
        {sortedForYou.length === 0 ? (
          <p className="empty-message">
            {data?.userPreferences?.streamingServices?.length === 0
              ? 'Like some movies or shows to get personalized recommendations.'
              : 'No recommendations available yet. Like some movies or shows to help us find content for you.'}
          </p>
        ) : (
          <div className="grid grid-5">
            {sortedForYou.slice(0, 20).map((item: ScoredMediaItem) => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default function Home() {
  return <HomeContent />
}
