'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import MediaCard from '@/components/MediaCard'

export default function BrowsePage() {
  const [tab, setTab] = useState('trending')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

  useEffect(() => {
    fetchData()
  }, [tab])

  const fetchData = async () => {
    setLoading(true)
    const sessionId = localStorage.getItem('sessionId')
    const res = await fetch('/api/recommendations', {
      headers: sessionId ? { 'x-session-id': sessionId } : {}
    })
    const data = await res.json()

    if (tab === 'trending') {
      setItems(data.trending)
    } else if (tab === 'movies') {
      setItems(data.movies)
    } else if (tab === 'tv') {
      setItems(data.tv)
    } else if (tab === 'new-movies') {
      setItems(data.newReleases?.movies || [])
    } else if (tab === 'new-tv') {
      setItems(data.newReleases?.tv || [])
    }
    setLoading(false)
  }

  const searchType = tab === 'movies' || tab === 'new-movies' ? 'movie'
    : tab === 'tv' || tab === 'new-tv' ? 'tv'
    : null

  const search = async () => {
    if (!searchQuery.trim()) return
    const typeParam = searchType ? `&type=${searchType}` : ''
    const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}${typeParam}`)
    const data = await res.json()
    setSearchResults(data.results || [])
  }

  const displayItems = searchQuery ? searchResults : items

  const searchPlaceholder = searchType === 'movie' ? 'Search movies...'
    : searchType === 'tv' ? 'Search TV shows...'
    : 'Search movies and TV shows...'

  return (
    <main className="container" style={{ paddingTop: '32px' }}>
        <div className="browse-search" style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            style={{ maxWidth: '400px' }}
            onKeyDown={e => e.key === 'Enter' && search()}
          />
          <button onClick={search} className="btn-primary">Search</button>
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setSearchResults([]) }} className="btn-secondary">
              Clear
            </button>
          )}
        </div>

        <div className="browse-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
          {['trending', 'movies', 'tv', 'new-movies', 'new-tv'].map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setSearchQuery(''); setSearchResults([]) }}
              className={tab === t ? 'btn-primary' : 'btn-secondary'}
            >
              {t.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <div className="grid grid-5">
            {displayItems.map((item: any) => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {displayItems.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            No results found
          </div>
        )}
      </main>
  )
}