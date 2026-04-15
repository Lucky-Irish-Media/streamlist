'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/components/UserContext'
import { Check, Eye, Heart, Trash2, Plus, FileText, Star, ArrowLeft, X, Play } from 'lucide-react'

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

interface CollectionPart {
  id: number
  title: string
  poster_path: string | null
  release_date: string | null
  vote_average: number
}

interface CollectionDetails {
  id: number
  name: string
  poster_path: string | null
  parts: CollectionPart[]
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
  const [isWatched, setIsWatched] = useState(false)
  const [loadingWatched, setLoadingWatched] = useState(true)
  const [imageError, setImageError] = useState(false)
  const [modalImageError, setModalImageError] = useState(false)
  const [showTrailer, setShowTrailer] = useState(false)
  const [currentMovieId, setCurrentMovieId] = useState(item.id)
  const [currentMediaType, setCurrentMediaType] = useState(item.media_type || item.mediaType || 'movie')
  const [collectionHistory, setCollectionHistory] = useState<{ id: number; mediaType: string }[]>([])
  const [note, setNote] = useState('')
  const [hasNote, setHasNote] = useState(false)
  const [loadingNote, setLoadingNote] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  
  const mediaType = item.media_type || item.mediaType || 'movie'
  const isNavigated = collectionHistory.length > 0
  const currentTitle = details?.title || details?.name || item.title || item.name || ''
  const currentReleaseDate = details?.release_date || details?.first_air_date || item.release_date || item.first_air_date || ''

  useEffect(() => {
    fetch('/api/watchlist', {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        const exists = data.watchlist?.some((w: any) => w.tmdbId === currentMovieId && w.mediaType === currentMediaType)
        setInWatchlist(!!exists)
      })
      .catch(() => {})
      .finally(() => setLoadingWatchlist(false))
  }, [currentMovieId, currentMediaType])

  useEffect(() => {
    fetch('/api/auth/me', {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        const exists = data.user?.likes?.some((l: any) => l.tmdbId === currentMovieId && l.mediaType === currentMediaType)
        setIsLiked(!!exists)
      })
      .catch(() => {})
      .finally(() => setLoadingLiked(false))
  }, [currentMovieId, currentMediaType])

  useEffect(() => {
    fetch('/api/watched', {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        const exists = data.watched?.some((w: any) => w.tmdbId === currentMovieId && w.mediaType === currentMediaType)
        setIsWatched(!!exists)
      })
      .catch(() => {})
      .finally(() => setLoadingWatched(false))
  }, [currentMovieId, currentMediaType])

  useEffect(() => {
    const countries = user?.countries?.join(',') || 'US'
    fetch(`/api/media?id=${item.id}&type=${mediaType}&countries=${countries}`)
      .then(res => res.json())
      .then(data => {
        if (data.certification) {
          setDetails(data as any)
        }
      })
      .catch(() => {})
  }, [item.id, mediaType, user?.countries])

  const fetchNote = async () => {
    if (!user) return
    setLoadingNote(true)
    try {
      const res = await fetch(`/api/notes?tmdbId=${currentMovieId}&mediaType=${currentMediaType}`, {
        credentials: 'include'
      })
      const data = await res.json()
      if (data.note) {
        setNote(data.note.note)
        setHasNote(true)
      } else {
        setNote('')
        setHasNote(false)
      }
    } catch {
      setNote('')
      setHasNote(false)
    } finally {
      setLoadingNote(false)
    }
  }

  const saveNote = async () => {
    if (!user) return
    setSavingNote(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tmdbId: currentMovieId, mediaType: currentMediaType, note }),
      })
      const data = await res.json()
      if (data.success) {
        setHasNote(note.length > 0)
      }
    } catch {
      console.error('Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  const deleteNote = async () => {
    if (!user) return
    setSavingNote(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tmdbId: currentMovieId, mediaType: currentMediaType }),
      })
      const data = await res.json()
      if (data.success) {
        setNote('')
        setHasNote(false)
      }
    } catch {
      console.error('Failed to delete note')
    } finally {
      setSavingNote(false)
    }
  }

  const openModal = async (movieId?: number, mediaTypeOverride?: string) => {
    const targetId = movieId ?? currentMovieId
    const targetMediaType = mediaTypeOverride ?? currentMediaType
    
    setLoadingDetails(true)
    setModalImageError(false)
    try {
      const countries = user?.countries?.join(',') || 'US'
      const res = await fetch(`/api/media?id=${targetId}&type=${targetMediaType}&countries=${countries}`)
      const data = await res.json()
      setDetails(data)
    } catch (err) {
      console.error('Failed to fetch details:', err)
    } finally {
      setLoadingDetails(false)
    }
    if (!showModal) {
      setShowModal(true)
      fetchNote()
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setShowTrailer(false)
    setDetails(null)
    setCurrentMovieId(item.id)
    setCurrentMediaType(item.media_type || item.mediaType || 'movie')
    setCollectionHistory([])
    setNote('')
    setHasNote(false)
  }

  const navigateToMovie = (movieId: number, mediaType: string) => {
    setCollectionHistory(prev => [...prev, { id: currentMovieId, mediaType: currentMediaType }])
    setCurrentMovieId(movieId)
    setCurrentMediaType(mediaType)
    setShowTrailer(false)
    setModalImageError(false)
    openModal(movieId, mediaType)
  }

  const goBack = async () => {
    if (collectionHistory.length === 0) return
    const prev = collectionHistory[collectionHistory.length - 1]
    setCollectionHistory(collectionHistory.slice(0, -1))
    setCurrentMovieId(prev.id)
    setCurrentMediaType(prev.mediaType)
    setShowTrailer(false)
    setModalImageError(false)
    openModal(prev.id, prev.mediaType)
  }

  const toggleWatchlist = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) {
      alert('Please log in to add to watchlist')
      return
    }
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
          body: JSON.stringify({ tmdbId: currentMovieId, mediaType: currentMediaType }),
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
    if (!user) {
      alert('Please log in to like')
      return
    }
    try {
      const body = isLiked 
        ? { removeLike: { tmdbId: currentMovieId, mediaType: currentMediaType } }
        : { addLike: { tmdbId: currentMovieId, mediaType: currentMediaType, title: currentTitle } }
      const res = await fetch('/api/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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

  const toggleWatched = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) {
      alert('Please log in')
      return
    }
    try {
      if (isWatched) {
        await fetch('/api/watched', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
        body: JSON.stringify({ tmdbId: currentMovieId, mediaType: currentMediaType }),
        })
        setIsWatched(false)
      } else {
        const res = await fetch('/api/watched', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ tmdbId: currentMovieId, mediaType: currentMediaType, title: currentTitle }),
        })
        const data = await res.json()
        if (data.error) {
          alert('Error: ' + data.error)
        } else {
          setIsWatched(true)
          setInWatchlist(true)
        }
      }
    } catch (err) {
      console.error('Failed to toggle watched:', err)
    }
  }

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation()
    openModal()
  }

  const title = item.title || item.name || ''
  const releaseDate = item.release_date || item.first_air_date || ''
  const certification = (details as any)?.certification || (item as any).certification

  const placeholderImage = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"><rect fill="%23222" width="200" height="300"/><text fill="%23666" font-family="system-ui" font-size="14" x="50%" y="50%" text-anchor="middle" dy=".3em">No Image</text></svg>')
  const imageSrc = (item.image && !imageError) ? item.image : placeholderImage

  return (
    <>
      <div className="card">
        <img 
          src={imageSrc} 
          alt={title} 
          className="card-image"
          onError={() => setImageError(true)}
        />
        <div className="card-content">
          <div className="card-title">{title}</div>
          <div className="card-meta">
            <span className="badge">{mediaType}</span>
            <span className="rating"><Star size={12} fill="currentColor" /> {item.vote_average?.toFixed(1)}</span>
            <span className="certification">{certification || 'NA'}</span>
          </div>
          <div className="card-actions">
            <button 
              onClick={toggleWatched}
              className="icon-btn" 
              title={isWatched ? 'Mark as Unwatched' : 'Mark as Watched'}
              disabled={loadingWatched}
            >
              {isWatched ? <Check size={16} /> : <Eye size={16} />}
            </button>
            <button 
              onClick={toggleLike}
              className="icon-btn" 
              title={isLiked ? 'Unlike' : 'Add to Liked'}
              disabled={loadingLiked}
            >
              {isLiked ? <Heart size={16} fill="currentColor" /> : <Heart size={16} />}
            </button>
            <button 
              onClick={toggleWatchlist}
              className="icon-btn" 
              title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
              disabled={loadingWatchlist}
            >
              {inWatchlist ? <Trash2 size={16} /> : <Plus size={16} />}
            </button>
            <button 
              onClick={handleViewDetails} 
              className="icon-btn" 
              title="View Details"
            >
              <FileText size={16} />
            </button>
            {hasNote && (
              <span className="note-indicator" title="Has note">
                <FileText size={12} />
              </span>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal media-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header-buttons">
              {isNavigated && (
                <button className="back-btn" onClick={goBack}>
                  <ArrowLeft size={20} /> Back
                </button>
              )}
              <div className="modal-action-icons">
                <button 
                  className="icon-btn" 
                  onClick={toggleWatched} 
                  title={isWatched ? 'Mark unwatched' : 'Mark as watched'}
                >
                  {isWatched ? <Check size={18} /> : <Eye size={18} />}
                </button>
                <button 
                  className="icon-btn" 
                  onClick={toggleLike} 
                  title={isLiked ? 'Unlike' : 'Like'}
                >
                  <Heart size={18} fill={isLiked ? 'var(--danger)' : 'none'} />
                </button>
                <button 
                  className="icon-btn" 
                  onClick={toggleWatchlist} 
                  title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
                >
                  {inWatchlist ? <Trash2 size={18} /> : <Plus size={18} />}
                </button>
                {(details as any).trailerKey && (
                  <button 
                    className="icon-btn" 
                    onClick={() => setShowTrailer(!showTrailer)} 
                    title={showTrailer ? 'Close trailer' : 'Watch trailer'}
                  >
                    <Play size={18} />
                  </button>
                )}
                <button className="icon-btn" onClick={closeModal} title="Close">
                  <X size={18} />
                </button>
              </div>
            </div>
            {loadingDetails ? (
              <div className="loading">Loading details...</div>
            ) : details ? (
              <div className="modal-content">
                <div className="modal-hero">
                  {showTrailer && (details as any).trailerKey ? (
                    <div className="trailer-embed">
                      <iframe
                        src={`https://www.youtube.com/embed/${(details as any).trailerKey}?autoplay=1`}
                        title="Trailer"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : details.backdrop_path && (
                    <img 
                      src={`https://image.tmdb.org/t/p/original${details.backdrop_path}`} 
                      alt={currentTitle}
                      className="modal-backdrop"
                    />
                  )}
                  <div className="modal-hero-content">
                    <img 
                      src={details.poster_path && !modalImageError ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : imageSrc} 
                      alt={currentTitle}
                      className="modal-poster"
                      onError={() => setModalImageError(true)}
                    />
                    <div className="modal-info">
                      <h2 className="modal-title">{currentTitle}</h2>
                      <div className="modal-meta">
                        <span className="badge">{currentMediaType}</span>
                        {currentReleaseDate && <span>{currentReleaseDate.slice(0, 4)}</span>}
                        <span className="rating"><Star size={14} fill="var(--accent)" /> {details.vote_average?.toFixed(1)}</span>
                        <span className="certification">{certification || 'NA'}</span>
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
                {(details as any).collection && (details as any).collection.parts && (
                  <div className="modal-collection">
                    <h3>Part of the {(details as any).collection.name}</h3>
                    <div className="collection-grid">
                      {[(details as any).collection.parts].flat().sort((a: any, b: any) => 
                        (a.release_date || '').localeCompare(b.release_date || '')
                      ).map((part: any) => (
                        <div 
                          key={part.id} 
                          className={`collection-item ${part.id === currentMovieId ? 'current' : ''}`}
                          onClick={() => navigateToMovie(part.id, 'movie')}
                        >
                          <img 
                            src={part.poster_path ? `https://image.tmdb.org/t/p/w185${part.poster_path}` : '/placeholder.jpg'} 
                            alt={part.title}
                          />
                          <div className="collection-item-title">{part.title}</div>
                          <div className="collection-item-year">{part.release_date?.slice(0, 4) || ''}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(details as any).watchProviders && (
                  <div className="modal-providers">
                    <h3>Stream on</h3>
                    {(details as any).watchProviders.flatrate.length > 0 ? (
                      <div className="provider-pills">
                        {(details as any).watchProviders.flatrate.map((p: any) => {
                          const isPreferred = user?.streamingServices?.some((s) => s.id === String(p.provider_id))
                          return (
                            <span key={p.provider_id} className={`provider-pill ${isPreferred ? 'provider-pill--preferred' : ''}`}>
                              {p.provider_name}
                              {p.type && <span className="provider-type"> ({p.type})</span>}
                              {p.regions && p.regions.length > 0 && (
                                <span className="provider-regions">
                                  {' '}[{p.regions.join(', ')}]
                                </span>
                              )}
                            </span>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="provider-empty">Not available for streaming in your selected regions</p>
                    )}
                  </div>
                )}
                <div className="modal-note">
                  <h3>My Notes</h3>
                  {loadingNote ? (
                    <p className="note-loading">Loading...</p>
                  ) : (
                    <>
                      <textarea
                        className="note-textarea"
                        placeholder="Write your thoughts about this title..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={4}
                      />
                      <div className="note-actions">
                        <button
                          className="note-save-btn"
                          onClick={saveNote}
                          disabled={savingNote}
                        >
                          {savingNote ? 'Saving...' : 'Save Note'}
                        </button>
                        {hasNote && (
                          <button
                            className="note-delete-btn"
                            onClick={deleteNote}
                            disabled={savingNote}
                          >
                            Delete Note
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
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