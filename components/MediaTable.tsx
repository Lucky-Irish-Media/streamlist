'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/components/UserContext'
import { useIsMobile } from '@/lib/useIsMobile'
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Eye, Heart, Plus, Trash2, Star, X } from 'lucide-react'
import type { MediaItem } from '@/types/media'

interface MediaTableProps {
  items: MediaItem[]
  onDismiss?: (id: number) => void
  onOpenDetail?: (item: MediaItem) => void
  watchlistIds?: Set<string>
  watchedIds?: Set<string>
  sortKey?: string | null
  sortDir?: 'asc' | 'desc' | null
  onSortChange?: (key: string) => void
}

function MediaTableRow({ item, onDismiss, onOpenDetail, isMobile, defaultInWatchlist, defaultIsWatched }: { item: MediaItem; onDismiss?: (id: number) => void; onOpenDetail?: (item: MediaItem) => void; isMobile?: boolean; defaultInWatchlist?: boolean; defaultIsWatched?: boolean }) {
  const { user, refreshUser } = useUser()
  const [inWatchlist, setInWatchlist] = useState(defaultInWatchlist ?? false)
  const [loadingWatchlist, setLoadingWatchlist] = useState(defaultInWatchlist === undefined)
  const [isLiked, setIsLiked] = useState(false)
  const [loadingLiked, setLoadingLiked] = useState(true)
  const [isWatched, setIsWatched] = useState(defaultIsWatched ?? false)
  const [loadingWatched, setLoadingWatched] = useState(defaultIsWatched === undefined)
  const [imageError, setImageError] = useState(false)

  const mediaType = item.media_type || item.mediaType || 'movie'
  const title = item.title || item.name || ''
  const year = (item.release_date || item.first_air_date || '').slice(0, 4)
  const certification = item.certification || null
  const placeholderImage = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="45" height="68" viewBox="0 0 45 68"><rect fill="%23222" width="45" height="68"/><text fill="%23666" font-family="system-ui" font-size="8" x="50%" y="50%" text-anchor="middle" dy=".3em">N/A</text></svg>')
  const imageSrc = (item.image && !imageError) ? item.image : placeholderImage

  useEffect(() => {
    if (defaultInWatchlist !== undefined) return
    fetch('/api/watchlist', { credentials: 'include' })
      .then(res => res.json() as Promise<{ watchlist?: { tmdbId: number; mediaType: string }[] }>)
      .then(data => {
        const exists = data.watchlist?.some(w => w.tmdbId === item.id && w.mediaType === mediaType)
        setInWatchlist(!!exists)
      })
      .catch(() => {})
      .finally(() => setLoadingWatchlist(false))
  }, [item.id, mediaType, defaultInWatchlist])

  useEffect(() => {
    const liked = user?.likes?.some((l) => l.tmdbId === item.id && l.mediaType === mediaType) ?? false
    setIsLiked(liked)
    setLoadingLiked(false)
  }, [user?.likes, item.id, mediaType])

  useEffect(() => {
    if (defaultIsWatched !== undefined) {
      setLoadingWatched(false)
      return
    }
    fetch(`/api/watched?tmdbId=${item.id}&type=${mediaType}`, { credentials: 'include' })
      .then(res => res.json() as Promise<{ watched?: { tmdbId: number; mediaType: string }[] }>)
      .then(data => {
        const watchedItem = data.watched?.find(w => w.tmdbId === item.id && w.mediaType === mediaType)
        setIsWatched(!!watchedItem)
      })
      .catch(() => {})
      .finally(() => setLoadingWatched(false))
  }, [item.id, mediaType, defaultIsWatched])

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

  if (isMobile) {
    return (
      <div className={`mobile-media-card${isWatched ? ' watched' : ''}`} onClick={() => onOpenDetail?.(item)} style={{ cursor: 'pointer' }}>
        <div className="mobile-media-card-main">
          <img
            src={imageSrc}
            alt={title}
            className="table-thumb"
            onError={() => setImageError(true)}
          />
          <div className="mobile-media-card-info">
            <div className="mobile-media-card-title">{title}</div>
            <div className="mobile-media-card-meta">
              <span className="badge">{mediaType}</span>
              <span className="rating">
                <Star size={12} fill="currentColor" /> {item.vote_average?.toFixed(1)}
              </span>
              <span className="mobile-media-card-year">{year || '-'}</span>
              {certification ? (
                <span className="certification">{certification}</span>
              ) : (
                <span className="certification">NA</span>
              )}
            </div>
          </div>
        </div>
        <div className="mobile-media-card-actions">
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
      </div>
    )
  }

  return (
    <tr className={`media-table-row${isWatched ? ' watched' : ''}`} onClick={() => onOpenDetail?.(item)} style={{ cursor: 'pointer' }}>
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

function SortIndicator({ sortDir }: { sortDir: 'asc' | 'desc' | null | undefined }) {
  if (sortDir === 'asc') return <ArrowUp size={12} style={{ marginLeft: 4 }} />
  if (sortDir === 'desc') return <ArrowDown size={12} style={{ marginLeft: 4 }} />
  return <ArrowUpDown size={12} style={{ marginLeft: 4, opacity: 0.4 }} />
}

const SORTABLE_COLUMNS = [
  { key: 'title', label: 'Title' },
  { key: 'type', label: 'Type' },
  { key: 'rating', label: 'Rating' },
  { key: 'year', label: 'Year' },
]

export default function MediaTable({ items, onDismiss, onOpenDetail, watchlistIds, watchedIds, sortKey, sortDir, onSortChange }: MediaTableProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <div className="mobile-media-list">
        {items.map(item => {
          const mediaType = item.media_type || item.mediaType || 'movie'
          const key = `${item.id}-${mediaType}`
          return (
            <MediaTableRow
              key={item.id}
              item={item}
              onDismiss={onDismiss}
              onOpenDetail={onOpenDetail}
              isMobile
              defaultInWatchlist={watchlistIds ? watchlistIds.has(key) : undefined}
              defaultIsWatched={watchedIds ? watchedIds.has(key) : undefined}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <table className="media-table">
        <thead>
          <tr>
            {SORTABLE_COLUMNS.map(col => (
              <th
                key={col.key}
                className={`sortable${sortKey === col.key ? ' sorted' : ''}`}
                onClick={() => onSortChange?.(col.key)}
              >
                {col.label}
                <SortIndicator sortDir={sortKey === col.key ? sortDir : null} />
              </th>
            ))}
            <th>Cert</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const mediaType = item.media_type || item.mediaType || 'movie'
            const key = `${item.id}-${mediaType}`
            return (
              <MediaTableRow
                key={item.id}
                item={item}
                onDismiss={onDismiss}
                onOpenDetail={onOpenDetail}
                defaultInWatchlist={watchlistIds ? watchlistIds.has(key) : undefined}
                defaultIsWatched={watchedIds ? watchedIds.has(key) : undefined}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
