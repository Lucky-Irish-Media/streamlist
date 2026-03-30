'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, List, Users, Settings } from 'lucide-react'

interface User {
  id: string
  username: string
  country: string
  streamingServices: string[]
  genres: number[]
  likes: { tmdbId: number; mediaType: string; title: string }[]
  hasCompletedOnboarding: boolean
  apiKey: string | null
}

interface UserContextType {
  user: User | null
  setUser: (user: User | null) => void
  refreshUser: () => Promise<void>
  logout: () => Promise<void>
}

const UserContext = createContext<UserContextType>({
  user: null,
  setUser: () => {},
  refreshUser: async () => {},
  logout: async () => {},
})

export function useUser() {
  return useContext(UserContext)
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const refreshUser = async () => {
    const sessionId = typeof localStorage !== 'undefined' ? localStorage.getItem('sessionId') : null
    const res = await fetch('/api/auth/me', { 
      credentials: 'include',
      headers: sessionId ? { 'x-session-id': sessionId } : {}
    })
    const json = await res.json()
    setUser(json.user)
    if (json.user && !json.user.hasCompletedOnboarding) {
      setShowOnboarding(true)
    }
    setLoading(false)
  }

  const logout = async () => {
    const sessionId = typeof localStorage !== 'undefined' ? localStorage.getItem('sessionId') : null
    await fetch('/api/auth/logout', { 
      method: 'POST',
      credentials: 'include',
      headers: sessionId ? { 'x-session-id': sessionId } : {}
    })
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sessionId')
    }
    setUser(null)
  }

  useEffect(() => {
    refreshUser()
  }, [])

  return (
    <UserContext.Provider value={{ user, setUser, refreshUser, logout }}>
      {children}
      {showOnboarding && user && <OnboardingModal user={user} onClose={() => setShowOnboarding(false)} />}
    </UserContext.Provider>
  )
}

function OnboardingModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [step, setStep] = useState(1)
  const [streamingServices, setStreamingServices] = useState<string[]>([])
  const [genres, setGenres] = useState<number[]>([])
  const [likes, setLikes] = useState<{ tmdbId: number; mediaType: string; title: string }[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const sessionId = typeof localStorage !== 'undefined' ? localStorage.getItem('sessionId') : null

  const services = [
    { id: '8', name: 'Netflix' },
    { id: '119', name: 'Amazon Prime Video' },
    { id: '257', name: 'Apple TV+' },
    { id: '330', name: 'Hulu' },
    { id: '387', name: 'HBO Max' },
    { id: '337', name: 'Disney+' },
  ]

  const genreList = [
    { id: 28, name: 'Action' },
    { id: 12, name: 'Adventure' },
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
    { id: 18, name: 'Drama' },
    { id: 14, name: 'Fantasy' },
    { id: 27, name: 'Horror' },
    { id: 878, name: 'Sci-Fi' },
    { id: 10749, name: 'Romance' },
    { id: 53, name: 'Thriller' },
  ]

  const searchMedia = async () => {
    if (!searchQuery.trim()) return
    const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
    const data = await res.json()
    setSearchResults(data.results?.slice(0, 10) || [])
  }

  const addLike = (item: any) => {
    setLikes([...likes, { tmdbId: item.id, mediaType: item.media_type, title: item.title || item.name }])
    setSearchResults([])
    setSearchQuery('')
  }

  const removeLike = (tmdbId: number) => {
    setLikes(likes.filter(l => l.tmdbId !== tmdbId))
  }

  const savePreferences = async () => {
    await fetch('/api/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionId ? { 'x-session-id': sessionId } : {})
      },
      credentials: 'include',
      body: JSON.stringify({ streamingServices, genres, likes }),
    })
    onClose()
    window.location.reload()
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Setup Your Preferences</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        {step === 1 && (
          <div>
            <div className="form-group">
              <label className="form-label">Which streaming services do you have?</label>
              <div className="checkbox-group">
                {services.map(service => (
                  <label
                    key={service.id}
                    className={`checkbox-item ${streamingServices.includes(service.id) ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={streamingServices.includes(service.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setStreamingServices([...streamingServices, service.id])
                        } else {
                          setStreamingServices(streamingServices.filter(id => id !== service.id))
                        }
                      }}
                    />
                    {service.name}
                  </label>
                ))}
              </div>
            </div>
            <button className="btn-primary" onClick={() => setStep(2)} style={{ width: '100%' }}>
              Next
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="form-group">
              <label className="form-label">What genres do you like?</label>
              <div className="checkbox-group">
                {genreList.map(genre => (
                  <label
                    key={genre.id}
                    className={`checkbox-item ${genres.includes(genre.id) ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={genres.includes(genre.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setGenres([...genres, genre.id])
                        } else {
                          setGenres(genres.filter(id => id !== genre.id))
                        }
                      }}
                    />
                    {genre.name}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>Back</button>
              <button className="btn-primary" onClick={() => setStep(3)} style={{ flex: 1 }}>Next</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="form-group">
              <label className="form-label">Tell us a few movies or shows you like</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search for movies or TV shows..."
                  onKeyDown={e => e.key === 'Enter' && searchMedia()}
                />
                <button onClick={searchMedia} className="btn-primary">Search</button>
              </div>
              {searchResults.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  {searchResults.map(item => (
                    <div key={item.id} className="checkbox-item" style={{ marginBottom: '8px', width: '100%' }}>
                      <span>{item.title || item.name} ({item.media_type})</span>
                      <button
                        onClick={() => addLike(item)}
                        className="btn-primary"
                        style={{ marginLeft: 'auto', padding: '4px 12px' }}
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {likes.length > 0 && (
                <div>
                  <label className="form-label">Your likes:</label>
                  {likes.map(like => (
                    <span key={like.tmdbId} className="badge" style={{ cursor: 'pointer' }} onClick={() => removeLike(like.tmdbId)}>
                      {like.title} (×)
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" onClick={() => setStep(2)} style={{ flex: 1 }}>Back</button>
              <button className="btn-primary" onClick={savePreferences} style={{ flex: 1 }}>Save & Continue</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function Header() {
  const { user, logout } = useUser()
  const pathname = usePathname()

  if (pathname === '/login') return null

  return (
    <>
      <div className="header">
        <div className="container header-content">
          <Link href="/" className="logo">StreamList</Link>
          <nav className="nav">
            {user ? (
              <>
                <Link href="/browse">Browse</Link>
                <Link href="/watchlist">Watchlist</Link>
                <Link href="/groups">Groups</Link>
                <Link href="/preferences">Preferences</Link>
                <button onClick={logout} className="btn-secondary">Logout</button>
              </>
            ) : (
              <Link href="/login" style={{ 
          padding: '8px 20px',
          backgroundColor: '#21262d',
          color: '#f0f6fc',
          border: '1px solid #30363d',
          borderRadius: '6px',
          textDecoration: 'none'
        }}>Login</Link>
            )}
          </nav>
        </div>
      </div>
      {user && (
        <nav className="mobile-nav">
          <div className="mobile-nav-links">
            <Link href="/" className={pathname === '/' ? 'active' : ''}>
              <span className="mobile-nav-icon"><Home size={20} /></span>
              <span>Home</span>
            </Link>
            <Link href="/browse" className={pathname === '/browse' ? 'active' : ''}>
              <span className="mobile-nav-icon"><Search size={20} /></span>
              <span>Browse</span>
            </Link>
            <Link href="/watchlist" className={pathname === '/watchlist' ? 'active' : ''}>
              <span className="mobile-nav-icon"><List size={20} /></span>
              <span>Watchlist</span>
            </Link>
            <Link href="/groups" className={pathname === '/groups' || pathname.startsWith('/groups/') ? 'active' : ''}>
              <span className="mobile-nav-icon"><Users size={20} /></span>
              <span>Groups</span>
            </Link>
            <Link href="/preferences" className={pathname === '/preferences' ? 'active' : ''}>
              <span className="mobile-nav-icon"><Settings size={20} /></span>
              <span>Prefs</span>
            </Link>
          </div>
        </nav>
      )}
    </>
  )
}