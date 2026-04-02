'use client'

import { useState, useEffect, useMemo, createContext, useContext } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, List, Users, Settings } from 'lucide-react'

interface User {
  id: string
  username: string
  countries: string[]
  streamingServices: { id: string; name: string }[]
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
    const res = await fetch('/api/auth/me', { 
      credentials: 'include'
    })
    const json = await res.json()
    setUser(json.user)
    if (json.user && !json.user.hasCompletedOnboarding) {
      setShowOnboarding(true)
    }
    setLoading(false)
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { 
      method: 'POST',
      credentials: 'include'
    })
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
  const [streamingServices, setStreamingServices] = useState<{ id: string; name: string }[]>([])
  const [genres, setGenres] = useState<number[]>([])
  const [likes, setLikes] = useState<{ tmdbId: number; mediaType: string; title: string }[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [providerSearchQuery, setProviderSearchQuery] = useState('')
  const [allProviders, setAllProviders] = useState<{ provider_id: number; provider_name: string; logo_path: string }[]>([])
  const [providersLoading, setProvidersLoading] = useState(true)

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const regions = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'JP', 'KR', 'BR', 'IN', 'MX', 'PT', 'ZA']
        const res = await fetch(`/api/providers?regions=${regions.join(',')}`)
        const data = await res.json()
        if (data.providers) {
          setAllProviders(data.providers)
        }
      } catch (err) {
        console.error('Failed to fetch providers:', err)
      } finally {
        setProvidersLoading(false)
      }
    }
    fetchProviders()
  }, [])

  const defaultServices = [
    { id: '8', name: 'Netflix' },
    { id: '119', name: 'Amazon Prime Video' },
    { id: '257', name: 'Apple TV+' },
    { id: '15', name: 'Hulu' },
    { id: '387', name: 'HBO Max' },
    { id: '337', name: 'Disney+' },
  ]

  const services = defaultServices.map(s => {
    const provider = allProviders.find(p => String(p.provider_id) === s.id)
    return {
      id: s.id,
      name: provider?.provider_name || s.name,
      logo: provider?.logo_path
    }
  })

  const getLogoUrl = (logo: string | undefined) => logo ? `https://image.tmdb.org/t/p/w45${logo}` : null

  const providerSearchResults = useMemo(() => {
    if (!providerSearchQuery.trim()) return []
    const query = providerSearchQuery.toLowerCase()
    return allProviders.filter(p => 
      p.provider_name.toLowerCase().includes(query)
    ).slice(0, 20)
  }, [providerSearchQuery, allProviders])

  const isProviderSelected = (id: string) => streamingServices.some(s => s.id === id)

  const addProvider = (provider: { provider_id: number; provider_name: string; logo_path: string }) => {
    const id = String(provider.provider_id)
    if (!isProviderSelected(id)) {
      setStreamingServices([...streamingServices, { id, name: provider.provider_name }])
    }
    setProviderSearchQuery('')
  }

  const removeProvider = (id: string) => {
    setStreamingServices(streamingServices.filter(s => s.id !== id))
  }

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
        'Content-Type': 'application/json'
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
              {providersLoading ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading services...</p>
              ) : (
                <>
                  {streamingServices.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                      {streamingServices.map(service => {
                        const provider = allProviders.find(p => String(p.provider_id) === service.id)
                        const logo = provider?.logo_path
                        return (
                          <span
                            key={service.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '6px 8px 6px 12px',
                              borderRadius: '20px',
                              border: '1px solid var(--accent)',
                              background: 'var(--accent)',
                              color: 'var(--bg-primary)',
                              fontSize: '13px',
                            }}
                          >
                            {logo && (
                              <img 
                                src={getLogoUrl(logo) || undefined}
                                alt=""
                                style={{ width: '20px', height: '20px', borderRadius: '4px' }}
                              />
                            )}
                            {service.name}
                            <button
                              onClick={() => removeProvider(service.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '18px',
                                height: '18px',
                                padding: 0,
                                border: 'none',
                                borderRadius: '50%',
                                background: 'rgba(0,0,0,0.2)',
                                color: 'inherit',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                lineHeight: 1,
                              }}
                              title="Remove"
                            >
                              ×
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                  <div className="checkbox-group">
                    {services.map(service => (
                      <label
                        key={service.id}
                        className={`checkbox-item ${streamingServices.some(s => s.id === service.id) ? 'selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={streamingServices.some(s => s.id === service.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setStreamingServices([...streamingServices, { id: service.id, name: service.name }])
                            } else {
                              setStreamingServices(streamingServices.filter(s => s.id !== service.id))
                            }
                          }}
                        />
                        {service.logo && (
                          <img 
                            src={getLogoUrl(service.logo) || undefined}
                            alt=""
                            style={{ width: '24px', height: '24px', borderRadius: '4px', marginRight: '8px' }}
                          />
                        )}
                        {service.name}
                      </label>
                    ))}
                  </div>
                  <div style={{ marginTop: '16px' }}>
                    <input
                      type="text"
                      placeholder="Search for more services..."
                      value={providerSearchQuery}
                      onChange={e => setProviderSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        outline: 'none',
                      }}
                    />
                  </div>
                  {providerSearchResults.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                      {providerSearchResults.map(provider => {
                        const selected = isProviderSelected(String(provider.provider_id))
                        return (
                          <span
                            key={provider.provider_id}
                            onClick={() => !selected && addProvider(provider)}
                            style={{ 
                              cursor: selected ? 'default' : 'pointer',
                              opacity: selected ? 0.5 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '6px 12px',
                              borderRadius: '20px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--surface)',
                              color: 'var(--text-primary)',
                              fontSize: '13px',
                            }}
                          >
                            {provider.logo_path && (
                              <img 
                                src={`https://image.tmdb.org/t/p/w45${provider.logo_path}`}
                                alt=""
                                style={{ width: '24px', height: '24px', borderRadius: '4px' }}
                              />
                            )}
                            {provider.provider_name}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
            <button className="btn-primary" onClick={() => setStep(2)} style={{ width: '100%', marginTop: '16px' }}>
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