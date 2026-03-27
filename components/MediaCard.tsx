'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/components/UserContext'

interface MediaItem {
  id: number
  title?: string
  name?: string
  media_type?: string
  mediaType?: string
  image: string
  vote_average?: number
  overview?: string
  poster_path?: string
  backdrop_path?: string
  release_date?: string
  first_air_date?: string
  genres?: { id: number; name: string }[]
  certification?: string | null
}

interface MediaCardProps {
  item: MediaItem
}

export default function MediaCard({ item }: MediaCardProps) {
  const { user, refreshUser } = useUser()
  const [showModal, setShowModal] = useState(false)
  const [details, setDetails] = useState<MediaItem | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [inWatchlist, setInWatchlist] = useState(false)
  const [loadingWatchlist, setLoadingWatchlist] = useState(true)
  const [isLiked, setIsLiked] = useState(false)
  const [loadingLiked, setLoadingLiked] = useState(true)
  const mediaType = item.media_type || item.mediaType || 'movie'

  useEffect(() => {
    const sessionId = localStorage.getItem('sessionId')
    fetch('/api/watchlist', {
      credentials: 'include',
      headers: sessionId ? { 'x-session-id': sessionId } : {}
    })
      .then(res => res.json())
      .then(data => {
        const exists = data.watchlist?.some((w: any) => w.tmdbId === item.id && w.mediaType === mediaType)
        setInWatchlist(!!exists)
      })
      .catch(() => {})
      .finally(() => setLoadingWatchlist(false))
  }, [item.id, mediaType])

  useEffect(() => {
    const sessionId = localStorage.getItem('sessionId')
    fetch('/api/auth/me', {
      credentials: 'include',
      headers: sessionId ? { 'x-session-id': sessionId } : {}
    })
      .then(res => res.json())
      .then(data => {
        const exists = data.user?.likes?.some((l: any) => l.tmdbId === item.id && l.mediaType === mediaType)
        setIsLiked(!!exists)
      })
      .catch(() => {})
      .finally(() => setLoadingLiked(false))
  }, [item.id, mediaType])

  const openModal = async () => {
    if (showModal) return
    setLoadingDetails(true)
    try {
      const country = user?.country || 'US'
      const res = await fetch(`/api/media?id=${item.id}&type=${mediaType}&country=${country}`)
      const data = await res.json()
      setDetails(data)
    } catch (err) {
      console.error('Failed to fetch details:', err)
    } finally {
      setLoadingDetails(false)
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setDetails(null)
  }

  const toggleWatchlist = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const sessionId = localStorage.getItem('sessionId')
    if (!sessionId) {
      alert('Please log in to add to watchlist')
      return
    }
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionId ? { 'x-session-id': sessionId } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ tmdbId: item.id, mediaType }),
      })
      const data = await res.json()
      if (data.error) {
        alert('Error: ' + data.error)
      } else {
        setInWatchlist(!inWatchlist)
        await refreshUser()
      }
    } catch (err) {
      console.error('Failed to toggle watchlist:', err)
      alert('Error: ' + err)
    }
  }

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const sessionId = localStorage.getItem('sessionId')
    if (!sessionId) {
      alert('Please log in to like')
      return
    }
    try {
      const body = isLiked 
        ? { removeLike: { tmdbId: item.id, mediaType } }
        : { addLike: { tmdbId: item.id, mediaType, title: item.title || item.name } }
      const res = await fetch('/api/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionId ? { 'x-session-id': sessionId } : {})
        },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) {
        alert('Error: ' + data.error)
      } else {
        setIsLiked(!isLiked)
        await refreshUser()
      }
    } catch (err) {
      console.error('Failed to toggle like:', err)
    }
  }

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation()
    openModal()
  }

  const title = item.title || item.name || ''
  const releaseDate = item.release_date || item.first_air_date || ''
  const certification = (details as any)?.certification || (item as any).certification

  return (
    <>
      <div className="card">
        <img src={item.image} alt={title} className="card-image" />
        <div className="card-content">
          <div className="card-title">{title}</div>
          <div className="card-meta">
            {certification && <span className="certification">{certification}</span>}
            <span className="badge">{mediaType}</span>
            <span className="rating">★ {item.vote_average?.toFixed(1)}</span>
          </div>
          <div className="card-actions">
            <button 
              onClick={toggleLike}
              className="icon-btn" 
              title={isLiked ? 'Unlike' : 'Add to Liked'}
              disabled={loadingLiked}
            >
              {isLiked ? '❤️' : '🤍'}
            </button>
            <button 
              onClick={toggleWatchlist}
              className="icon-btn" 
              title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
              disabled={loadingWatchlist}
            >
              {inWatchlist ? '🗑️' : '➕'}
            </button>
            <button 
              onClick={handleViewDetails} 
              className="icon-btn" 
              title="View Details"
            >
              📄
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal media-modal" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={closeModal}>×</button>
            {loadingDetails ? (
              <div className="loading">Loading details...</div>
            ) : details ? (
              <div className="modal-content">
                <div className="modal-hero">
                  {details.backdrop_path && (
                    <img 
                      src={`https://image.tmdb.org/t/p/original${details.backdrop_path}`} 
                      alt={title}
                      className="modal-backdrop"
                    />
                  )}
                  <div className="modal-hero-content">
                    <img 
                      src={details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : item.image} 
                      alt={title}
                      className="modal-poster"
                    />
                    <div className="modal-info">
                      <h2 className="modal-title">{title}</h2>
                      <div className="modal-meta">
                        {releaseDate && <span>{releaseDate.slice(0, 4)}</span>}
                        {certification && <span className="certification">{certification}</span>}
                        <span className="rating">★ {details.vote_average?.toFixed(1)}</span>
                        <span className="badge">{mediaType}</span>
                      </div>
                      {details.genres && details.genres.length > 0 && (
                        <div className="modal-genres">
                          {details.genres.slice(0, 3).map((g: any) => (
                            <span key={g.id} className="badge">{g.name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {details.overview && (
                  <div className="modal-overview">
                    <h3>Overview</h3>
                    <p>{details.overview}</p>
                  </div>
                )}
                {(details as any).watchProviders && (
                  <div className="modal-providers">
                    <h3>Stream on</h3>
                    {(details as any).watchProviders.flatrate.length > 0 ? (
                      <div className="provider-pills">
                        {(details as any).watchProviders.flatrate.map((p: any) => (
                          <span key={p.provider_id} className="provider-pill">{p.provider_name}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="provider-empty">Not available for streaming in {(details as any).watchProviders.country}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>Failed to load details</div>
            )}
          </div>
        </div>
      )}
    </>
  )
}