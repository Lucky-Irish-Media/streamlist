'use client'

import { useState, useEffect, useRef } from 'react'
import { useUser } from '@/components/UserContext'
import { Check, Eye, Heart, Trash2, Plus, FileText, Star, ArrowLeft, X, Play, ChevronDown, MoreHorizontal, List } from 'lucide-react'
import AddToListDialog from '@/components/AddToListDialog'
import type { MediaItem } from '@/types/media'

interface MediaDetailModalProps {
  tmdbId: number
  mediaType: string
  onClose: () => void
  onDismiss?: (tmdbId: number) => void
}

export default function MediaDetailModal({ tmdbId, mediaType: initialMediaType, onClose, onDismiss }: MediaDetailModalProps) {
  const { user, refreshUser } = useUser()
  const [details, setDetails] = useState<MediaItem | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(true)
  const [inWatchlist, setInWatchlist] = useState(false)
  const [loadingWatchlist, setLoadingWatchlist] = useState(true)
  const [isLiked, setIsLiked] = useState(false)
  const [loadingLiked, setLoadingLiked] = useState(true)
  const [isWatched, setIsWatched] = useState(false)
  const [loadingWatched, setLoadingWatched] = useState(true)
  const [seasonWatched, setSeasonWatched] = useState<number | null>(null)
  const [seasons, setSeasons] = useState<{ season_number: number; name: string; aired_date?: string }[]>([])
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null)
  const [seasonEpisodes, setSeasonEpisodes] = useState<Record<number, { id: number; name: string; episode_number: number; overview: string | null; still_path: string | null }[]>>({})
  const [loadingEpisodes, setLoadingEpisodes] = useState<number | null>(null)
  const [watchedEpisodes, setWatchedEpisodes] = useState<Record<string, boolean>>({})
  const [modalImageError, setModalImageError] = useState(false)
  const [showTrailer, setShowTrailer] = useState(false)
  const [currentMovieId, setCurrentMovieId] = useState(tmdbId)
  const [currentMediaType, setCurrentMediaType] = useState(initialMediaType)
  const [collectionHistory, setCollectionHistory] = useState<{ id: number; mediaType: string }[]>([])
  const [note, setNote] = useState('')
  const [hasNote, setHasNote] = useState(false)
  const [loadingNote, setLoadingNote] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [showActionsDropdown, setShowActionsDropdown] = useState(false)
  const [showAddToList, setShowAddToList] = useState(false)
  const [similarItems, setSimilarItems] = useState<Array<{id: number; title?: string; media_type: string; poster_path: string | null; vote_average: number; release_date?: string}>>([])
  const [loadingSimilar, setLoadingSimilar] = useState(false)
  const actionsDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(e.target as Node)) {
        setShowActionsDropdown(false)
      }
    }
    if (showActionsDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showActionsDropdown])

  const isNavigated = collectionHistory.length > 0
  const currentTitle = details?.title || details?.name || ''
  const currentReleaseDate = details?.release_date || details?.first_air_date || ''

  useEffect(() => {
    setLoadingDetails(true)
    setModalImageError(false)
    const countries = user?.countries?.join(',') || 'US'
    fetch(`/api/media?id=${currentMovieId}&type=${currentMediaType}&countries=${countries}`)
      .then(res => res.json() as Promise<MediaItem & { seasons?: { season_number: number; name: string }[] }>)
      .then(data => {
        setDetails(data)
        if (data.seasons) {
          setSeasons(data.seasons)
        }
      })
      .catch(err => console.error('Failed to fetch details:', err))
      .finally(() => setLoadingDetails(false))
  }, [currentMovieId, currentMediaType, user?.countries])

  useEffect(() => {
    fetch('/api/watchlist', { credentials: 'include' })
      .then(res => res.json() as Promise<{ watchlist?: { tmdbId: number; mediaType: string }[] }>)
      .then(data => {
        const exists = data.watchlist?.some((w) => w.tmdbId === currentMovieId && w.mediaType === currentMediaType)
        setInWatchlist(!!exists)
      })
      .catch(() => {})
      .finally(() => setLoadingWatchlist(false))
  }, [currentMovieId, currentMediaType])

  useEffect(() => {
    const liked = user?.likes?.some((l) => l.tmdbId === currentMovieId && l.mediaType === currentMediaType) ?? false
    setIsLiked(liked)
    setLoadingLiked(false)
  }, [user?.likes, currentMovieId, currentMediaType])

  useEffect(() => {
    fetch(`/api/watched?tmdbId=${currentMovieId}&type=${currentMediaType}`, { credentials: 'include' })
      .then(res => res.json() as Promise<{ watched?: { tmdbId: number; mediaType: string; seasonWatched: number | null }[]; episodes?: { seasonNumber: number; episodeNumber: number }[] }>)
      .then(data => {
        const watchedItem = data.watched?.find((w) => w.tmdbId === currentMovieId && w.mediaType === currentMediaType)
        setIsWatched(!!watchedItem)
        setSeasonWatched(watchedItem?.seasonWatched ?? null)
        const episodeMap: Record<string, boolean> = {}
        data.episodes?.forEach((ep) => {
          episodeMap[`${ep.seasonNumber}-${ep.episodeNumber}`] = true
        })
        setWatchedEpisodes(episodeMap)
      })
      .catch(() => {})
      .finally(() => setLoadingWatched(false))
  }, [currentMovieId, currentMediaType])

  const fetchNote = async () => {
    if (!user) return
    setLoadingNote(true)
    try {
      const res = await fetch(`/api/notes?tmdbId=${currentMovieId}&mediaType=${currentMediaType}`, { credentials: 'include' })
      const data = await res.json() as { note?: { note: string } }
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

  useEffect(() => {
    fetchNote()
  }, [currentMovieId, currentMediaType])

  useEffect(() => {
    setLoadingSimilar(true)
    setSimilarItems([])
    fetch(`/api/media/similar?id=${currentMovieId}&type=${currentMediaType}`)
      .then(res => res.json() as Promise<{ items: typeof similarItems }>)
      .then(data => setSimilarItems(data.items || []))
      .catch(() => setSimilarItems([]))
      .finally(() => setLoadingSimilar(false))
  }, [currentMovieId, currentMediaType])

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
      const data = await res.json() as { success?: boolean }
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
      const data = await res.json() as { success?: boolean }
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

  const navigateToMovie = (movieId: number, mediaType: string) => {
    setCollectionHistory(prev => [...prev, { id: currentMovieId, mediaType: currentMediaType }])
    setCurrentMovieId(movieId)
    setCurrentMediaType(mediaType)
    setShowTrailer(false)
    setModalImageError(false)
  }

  const goBack = () => {
    if (collectionHistory.length === 0) return
    const prev = collectionHistory[collectionHistory.length - 1]
    setCollectionHistory(collectionHistory.slice(0, -1))
    setCurrentMovieId(prev.id)
    setCurrentMediaType(prev.mediaType)
    setShowTrailer(false)
    setModalImageError(false)
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
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tmdbId: currentMovieId, mediaType: currentMediaType }),
      })
      const data = await res.json() as { error?: string }
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

  const removeFromWatchlist = async () => {
    if (!user) return
    try {
      await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tmdbId: currentMovieId, mediaType: currentMediaType }),
      })
      setInWatchlist(false)
      await refreshUser()
    } catch (err) {
      console.error('Failed to remove from watchlist:', err)
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
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json() as { error?: string }
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

  const toggleWatched = async (e: React.MouseEvent, season?: number) => {
    e.stopPropagation()
    if (!user) {
      alert('Please log in')
      return
    }
    try {
      if (isWatched) {
        await fetch('/api/watched', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ tmdbId: currentMovieId, mediaType: currentMediaType }),
        })
        setIsWatched(false)
        setSeasonWatched(null)
      } else {
        const seasonToSave = (currentMediaType === 'tv' && season) ? season : undefined
        const res = await fetch('/api/watched', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ tmdbId: currentMovieId, mediaType: currentMediaType, title: currentTitle, season: seasonToSave }),
        })
        const data = await res.json() as { error?: string }
        if (data.error) {
          alert('Error: ' + data.error)
        } else {
          setIsWatched(true)
          setSeasonWatched(seasonToSave ?? null)
          setInWatchlist(true)
        }
      }
    } catch (err) {
      console.error('Failed to toggle watched:', err)
    }
  }

  const fetchSeasonEpisodes = async (seasonNumber: number) => {
    if (seasonEpisodes[seasonNumber]) return
    setLoadingEpisodes(seasonNumber)
    try {
      const res = await fetch(`/api/media?id=${currentMovieId}&type=tv&season=${seasonNumber}`)
      const data = await res.json() as { episodes?: { id: number; name: string; episode_number: number; overview: string | null; still_path: string | null }[] }
      if (data.episodes) {
        setSeasonEpisodes((prev) => ({ ...prev, [seasonNumber]: data.episodes || [] }))
      }
    } catch (err) {
      console.error('Failed to fetch episodes:', err)
    } finally {
      setLoadingEpisodes(null)
    }
  }

  const toggleEpisodeWatched = async (seasonNumber: number, episodeNumber: number) => {
    if (!user) {
      alert('Please log in')
      return
    }
    const key = `${seasonNumber}-${episodeNumber}`
    const isEpisodeWatched = watchedEpisodes[key]
    try {
      if (isEpisodeWatched) {
        await fetch('/api/watched', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ tmdbId: currentMovieId, episodes: [{ seasonNumber, episodeNumber }] }),
        })
        setWatchedEpisodes((prev) => ({ ...prev, [key]: false }))
      } else {
        await fetch('/api/watched', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ tmdbId: currentMovieId, mediaType: 'tv', episodes: [{ seasonNumber, episodeNumber }] }),
        })
        setWatchedEpisodes((prev) => ({ ...prev, [key]: true }))
      }
    } catch (err) {
      console.error('Failed to toggle episode:', err)
    }
  }

  const markSeasonWatched = async (seasonNumber: number) => {
    if (!user) {
      alert('Please log in')
      return
    }
    const episodes = seasonEpisodes[seasonNumber]
    if (!episodes) return
    try {
      const episodesToMark = episodes.map((ep) => ({ seasonNumber, episodeNumber: ep.episode_number }))
      await fetch('/api/watched', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tmdbId: currentMovieId, mediaType: 'tv', episodes: episodesToMark }),
      })
      const newWatched = { ...watchedEpisodes }
      episodes.forEach((ep) => { newWatched[`${seasonNumber}-${ep.episode_number}`] = true })
      setWatchedEpisodes(newWatched)
    } catch (err) {
      console.error('Failed to mark season watched:', err)
    }
  }

  const markSeasonUnwatched = async (seasonNumber: number) => {
    if (!user) {
      alert('Please log in')
      return
    }
    const episodes = seasonEpisodes[seasonNumber]
    if (!episodes) return
    try {
      const episodesToUnmark = episodes.map((ep) => ({ seasonNumber, episodeNumber: ep.episode_number }))
      await fetch('/api/watched', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tmdbId: currentMovieId, episodes: episodesToUnmark }),
      })
      const newWatched = { ...watchedEpisodes }
      episodes.forEach((ep) => { delete newWatched[`${seasonNumber}-${ep.episode_number}`] })
      setWatchedEpisodes(newWatched)
    } catch (err) {
      console.error('Failed to mark season unwatched:', err)
    }
  }

  const dismissRecommendation = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await fetch('/api/recommendations/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tmdbId: currentMovieId, mediaType: currentMediaType }),
      })
      const data = await res.json() as { dismissed?: boolean }
      if (data.dismissed && onDismiss) {
        onDismiss(currentMovieId)
      }
    } catch (err) {
      console.error('Failed to dismiss:', err)
    }
  }

  const close = () => {
    setShowTrailer(false)
    setShowActionsDropdown(false)
    setDetails(null)
    setCollectionHistory([])
    setNote('')
    setHasNote(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal media-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header-buttons">
          {isNavigated && (
            <button className="back-btn" onClick={goBack}>
              <ArrowLeft size={20} /> Back
            </button>
          )}
          <div className="modal-action-icons">
            {(details as any)?.trailerKey && (
              <button
                className="icon-btn"
                onClick={() => setShowTrailer(!showTrailer)}
                title={showTrailer ? 'Close trailer' : 'Watch trailer'}
              >
                <Play size={18} />
              </button>
            )}
            <div className="actions-dropdown-wrapper" ref={actionsDropdownRef}>
              <button
                className="icon-btn"
                onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                title="Actions"
              >
                <MoreHorizontal size={18} />
              </button>
              {showActionsDropdown && (
                <div className="actions-dropdown">
                  <button
                    className="dropdown-item"
                    onClick={(e) => { toggleWatched(e); setShowActionsDropdown(false) }}
                  >
                    {isWatched ? <Check size={16} /> : <Eye size={16} />}
                    {isWatched ? 'Mark as Unwatched' : currentMediaType === 'tv' ? 'Mark Series as Watched' : 'Mark as Watched'}
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => { toggleLike({ stopPropagation: () => {} } as React.MouseEvent); setShowActionsDropdown(false) }}
                  >
                    <Heart size={16} fill={isLiked ? 'var(--danger)' : 'none'} />
                    {isLiked ? 'Unlike' : 'Like'}
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => { setShowAddToList(true); setShowActionsDropdown(false) }}
                  >
                    <Plus size={16} />
                    Add to List...
                  </button>
                  {inWatchlist && (
                    <button
                      className="dropdown-item"
                      onClick={() => { removeFromWatchlist(); setShowActionsDropdown(false) }}
                    >
                      <Trash2 size={16} />
                      Remove from Watchlist
                    </button>
                  )}
                  <button
                    className="dropdown-item"
                    onClick={() => { dismissRecommendation({ stopPropagation: () => {} } as React.MouseEvent); setShowActionsDropdown(false) }}
                  >
                    <X size={16} />
                    Dismiss Recommendation
                  </button>
                </div>
              )}
            </div>
            <button className="icon-btn" onClick={close} title="Close">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="modal-body">
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
                    src={details.poster_path && !modalImageError ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"><rect fill="%23222" width="200" height="300"/><text fill="%23666" font-family="system-ui" font-size="14" x="50%" y="50%" text-anchor="middle" dy=".3em">No Image</text></svg>')}
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
                      <span className="certification">{details.certification || 'NA'}</span>
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
              {!loadingSimilar && similarItems.length > 0 && (
                <div className="modal-similar">
                  <h3>Similar</h3>
                  <div className="similar-row" style={{
                    display: 'flex',
                    gap: '10px',
                    overflowX: 'auto',
                    paddingBottom: '8px',
                    scrollSnapType: 'x mandatory',
                  }}>
                    {similarItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => navigateToMovie(item.id, currentMediaType)}
                        style={{
                          flex: '0 0 auto',
                          scrollSnapAlign: 'start',
                          width: '110px',
                          cursor: 'pointer',
                          transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.8' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                      >
                        <img
                          src={item.poster_path ? `https://image.tmdb.org/t/p/w185${item.poster_path}` : 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="110" height="165" viewBox="0 0 110 165"><rect fill="%23222" width="110" height="165"/><text fill="%23666" font-family="system-ui" font-size="10" x="50%" y="50%" text-anchor="middle" dy=".3em">No Image</text></svg>')}
                          alt={item.title || ''}
                          style={{
                            width: '110px',
                            height: '165px',
                            borderRadius: '6px',
                            objectFit: 'cover',
                            background: 'var(--bg-secondary)',
                          }}
                        />
                        <div style={{
                          fontSize: '11px',
                          marginTop: '4px',
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textAlign: 'center',
                        }}>
                          {item.title || ''}
                        </div>
                      </div>
                    ))}
                  </div>
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
                          <a key={p.provider_id} href={(details as any).watchProviders.link || '#'} target="_blank" rel="noopener noreferrer" className={`provider-pill ${isPreferred ? 'provider-pill--preferred' : ''}`}>
                            {p.provider_name}
                            {p.type && <span className="provider-type"> ({p.type})</span>}
                            {p.regions && p.regions.length > 0 && (
                              <span className="provider-regions">
                                {' '}[{p.regions.join(', ')}]
                              </span>
                            )}
                          </a>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="provider-empty">Not available for streaming in your selected regions</p>
                  )}
                </div>
              )}
              {currentMediaType === 'tv' && seasons.length > 0 && (
                <div className="modal-seasons">
                  <h3>Seasons</h3>
                  <div className="season-accordion">
                    {seasons.map((s) => {
                      const seasonKey = s.season_number
                      const episodes = seasonEpisodes[seasonKey] || []
                      const isExpanded = expandedSeason === seasonKey
                      const watchedCount = episodes.filter((ep) => watchedEpisodes[`${seasonKey}-${ep.episode_number}`]).length
                      return (
                        <div key={seasonKey} className="season-item">
                          <div
                            className="season-header"
                            onClick={() => {
                              if (!isExpanded) {
                                setExpandedSeason(seasonKey)
                                fetchSeasonEpisodes(seasonKey)
                              } else {
                                setExpandedSeason(null)
                              }
                            }}
                          >
                            <ChevronDown size={16} className={`chevron ${isExpanded ? 'expanded' : ''}`} />
                            <span className="season-name">{s.name || `Season ${seasonKey}`}</span>
                            {seasonEpisodes[seasonKey]?.length ? (
                              <span className="season-progress">{watchedCount}/{seasonEpisodes[seasonKey].length}</span>
                            ) : null}
                          </div>
                          {isExpanded && (
                            <div className="season-episodes">
                              {loadingEpisodes === seasonKey ? (
                                <div className="loading-episodes">Loading episodes...</div>
                              ) : episodes.length > 0 ? (
                                <>
                                  <div className="season-actions">
                                    <button className="mark-all-btn" onClick={() => markSeasonWatched(seasonKey)}>Mark All Watched</button>
                                    <button className="mark-all-btn" onClick={() => markSeasonUnwatched(seasonKey)}>Mark All Unwatched</button>
                                  </div>
                                  {episodes.map((ep) => {
                                    const isEpisodeWatched = watchedEpisodes[`${seasonKey}-${ep.episode_number}`]
                                    return (
                                      <div key={ep.id} className={`episode-row ${isEpisodeWatched ? 'watched' : ''}`} onClick={() => toggleEpisodeWatched(seasonKey, ep.episode_number)}>
                                        <span className="episode-number">E{ep.episode_number}</span>
                                        <span className="episode-name">{ep.name || `Episode ${ep.episode_number}`}</span>
                                        <span className={`episode-check ${isEpisodeWatched ? 'checked' : ''}`}>
                                          {isEpisodeWatched ? <Check size={14} /> : <Eye size={14} />}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </>
                              ) : null}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
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

      {showAddToList && (
        <AddToListDialog
          tmdbId={currentMovieId}
          mediaType={currentMediaType}
          onClose={() => setShowAddToList(false)}
          onDone={() => {
            setShowAddToList(false)
            setInWatchlist(true)
            refreshUser()
          }}
        />
      )}
    </div>
  )
}
