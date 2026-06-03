'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/components/UserContext'
import { Check, Eye, Heart, Plus, Trash2, Star, X } from 'lucide-react'
import type { MediaItem } from '@/types/media'

interface MediaTableProps {
  items: MediaItem[]
  onDismiss?: (id: number) => void
}

function MediaTableRow({ item, onDismiss }: { item: MediaItem; onDismiss?: (id: number) => void }) {
  const { user, refreshUser } = useUser()
  const [inWatchlist, setInWatchlist] = useState(false)
  const [loadingWatchlist, setLoadingWatchlist] = useState(true)
  const [isLiked, setIsLiked] = useState(false)
  const [loadingLiked, setLoadingLiked] = useState(true)
  const [isWatched, setIsWatched] = useState(false)
  const [loadingWatched, setLoadingWatched] = useState(true)
  const [imageError, setImageError] = useState(false)

  const mediaType = item.media_type || item.mediaType || 'movie'
  const title = item.title || item.name || ''
  const year = (item.release_date || item.first_air_date || '').slice(0, 4)
  const certification = item.certification || null
  const placeholderImage = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="45" height="68" viewBox="0 0 45 68"><rect fill="%23222" width="45" height="68"/><text fill="%23666" font-family="system-ui" font-size="8" x="50%" y="50%" text-anchor="middle" dy=".3em">N/A</text></svg>')
  const imageSrc = (item.image && !imageError) ? item.image : placeholderImage

  useEffect(() => {
    fetch('/api/watchlist', { credentials: 'include' })
      .then(res => res.json() as Promise<{ watchlist?: { tmdbId: number; mediaType: string }[] }>)
      .then(data => {
        const exists = data.watchlist?.some(w => w.tmdbId === item.id && w.mediaType === mediaType)
        setInWatchlist(!!exists)
      })
      .catch(() => {})
      .finally(() => setLoadingWatchlist(false))
  }, [item.id, mediaType])

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => res.json() as Promise<{ user?: { likes?: { tmdbId: number; mediaType: string }[] } }>)
      .then(data => {
        const exists = data.user?.likes?.some(l => l.tmdbId === item.id && l.mediaType === mediaType)
        setIsLiked(!!exists)
      })
      .catch(() => {})
      .finally(() => setLoadingLiked(false))
  }, [item.id, mediaType])

  useEffect(() => {
    fetch(`/api/watched?tmdbId=${item.id}&type=${mediaType}`, { credentials: 'include' })
      .then(res => res.json() as Promise<{ watched?: { tmdbId: number; mediaType: string }[] }>)
      .then(data => {
        const watchedItem = data.watched?.find(w => w.tmdbId === item.id && w.mediaType === mediaType)
        setIsWatched(!!watchedItem)
      })
      .catch(() => {})
      .finally(() => setLoadingWatched(false))
  }, [item.id, mediaType])

  const toggleWatchlist = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) { alert('Please log in to add to watchlist'); return }
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tmdbId: item.id, mediaType }),
      })
      const data = await res.json() as { error?: string }
      if (data.error) { alert('Error: ' + data.error) }
      else { setInWatchlist(!inWatchlist); await refreshUser() }
    } catch (err) { console.error('Failed to toggle watchlist:', err) }
  }

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) { alert('Please log in to like'); return }
    try {
      const body = isLiked
        ? { removeLike: { tmdbId: item.id, mediaType } }
        : { addLike: { tmdbId: item.id, mediaType, title } }
      const res = await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json() as { error?: string }
      if (data.error) { alert('Error: ' + data.error) }
      else { setIsLiked(!isLiked); await refreshUser() }
    } catch (err) { console.error('Failed to toggle like:', err) }
  }

  const toggleWatched = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) { alert('Please log in'); return }
    try {
      if (isWatched) {
        await fetch('/api/watched', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ tmdbId: item.id, mediaType }),
        })
        setIsWatched(false)
      } else {
        await fetch('/api/watched', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ tmdbId: item.id, mediaType, title }),
        })
        setIsWatched(true)
      }
    } catch (err) { console.error('Failed to toggle watched:', err) }
  }

  const dismiss = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch('/api/recommendations/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tmdbId: item.id, mediaType }),
      })
      if (onDismiss) onDismiss(item.id)
    } catch (err) { console.error('Failed to dismiss:', err) }
  }

  return (
    <tr className={`media-table-row${isWatched ? ' watched' : ''}`}>
      <td className="table-cell-title">
        <img
          src={imageSrc}
          alt={title}
          className="table-thumb"
          onError={() => setImageError(true)}
        />
        <span className="table-title-text">{title}</span>
      </td>
      <td>
        <span className="badge">{mediaType}</span>
      </td>
      <td>
        <span className="rating">
          <Star size={12} fill="currentColor" /> {item.vote_average?.toFixed(1)}
        </span>
      </td>
      <td className="table-cell-year">{year || '-'}</td>
      <td>
        {certification ? (
          <span className="certification">{certification}</span>
        ) : (
          <span className="certification">NA</span>
        )}
      </td>
      <td>
        <div className="table-actions">
          <button
            onClick={toggleWatched}
            className="icon-btn"
            title={isWatched ? 'Mark as Unwatched' : 'Mark as Watched'}
            disabled={loadingWatched}
          >
            {isWatched ? <Check size={14} /> : <Eye size={14} />}
          </button>
          <button
            onClick={toggleLike}
            className="icon-btn"
            title={isLiked ? 'Unlike' : 'Add to Liked'}
            disabled={loadingLiked}
          >
            <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={toggleWatchlist}
            className="icon-btn"
            title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
            disabled={loadingWatchlist}
          >
            {inWatchlist ? <Trash2 size={14} /> : <Plus size={14} />}
          </button>
          {onDismiss && (
            <button onClick={dismiss} className="icon-btn icon-btn--danger" title="Dismiss">
              <X size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function MediaTable({ items, onDismiss }: MediaTableProps) {
  return (
    <div className="table-wrapper">
      <table className="media-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Rating</th>
            <th>Year</th>
            <th>Cert</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <MediaTableRow key={item.id} item={item} onDismiss={onDismiss} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
