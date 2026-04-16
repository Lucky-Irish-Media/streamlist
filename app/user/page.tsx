'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useUser } from '@/components/UserContext'
import { useRouter } from 'next/navigation'
import { Users, Film, Heart, LogOut, Edit2, Copy, ExternalLink, List } from 'lucide-react'

const SERVICE_NAME_MAP: Record<string, string> = {
  '8': 'Netflix',
  '15': 'Hulu',
  '119': 'Amazon Prime Video',
  '257': 'Apple TV+',
  '337': 'Disney+',
  '387': 'HBO Max',
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

const countryNames: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  DE: 'Germany',
  FR: 'France',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  BR: 'Brazil',
  IN: 'India',
  JP: 'Japan',
  MX: 'Mexico',
  KR: 'South Korea',
  PT: 'Portugal',
  ZA: 'South Africa',
}

interface Group {
  id: string
  name: string
  createdAt: string
  createdBy: string
  memberCount: number
}

type Tab = 'overview' | 'likes' | 'watchlist' | 'history' | 'groups' | 'account'

export default function UserPage() {
  const { user, refreshUser, logout } = useUser()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [apiKeyLoading, setApiKeyLoading] = useState(false)
  const [allProviders, setAllProviders] = useState<{ provider_id: number; provider_name: string; logo_path: string }[]>([])
  const [likesWithPosters, setLikesWithPosters] = useState<{ tmdbId: number; mediaType: string; title: string; posterPath: string | null }[]>([])
  const [watchlistItems, setWatchlistItems] = useState<{ tmdbId: number; mediaType: string; title: string; posterPath: string | null }[]>([])
  const [watchedItems, setWatchedItems] = useState<{ tmdbId: number; mediaType: string; title: string; posterPath: string | null }[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  const getUserCountries = () => {
    if (!user?.countries) return ['US']
    if (Array.isArray(user.countries)) return user.countries
    try {
      const parsed = JSON.parse(user.countries)
      return Array.isArray(parsed) ? parsed : ['US']
    } catch {
      return ['US']
    }
  }

  useEffect(() => {
    if (!user) return
    const fetchProviders = async () => {
      try {
        const regions = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'JP', 'KR', 'BR', 'IN', 'MX', 'PT', 'ZA']
        const res = await fetch(`/api/providers?regions=${regions.join(',')}`)
        const data = await res.json() as { providers?: { provider_id: number; provider_name: string; logo_path: string }[] }
        if (data.providers) {
          setAllProviders(data.providers)
        }
      } catch (err) {
        console.error('Failed to fetch providers:', err)
      }
    }
    fetchProviders()
  }, [])

  useEffect(() => {
    if (!user) return
    if (!user.likes || user.likes.length === 0) {
      setLikesWithPosters([])
    } else {
      const fetchLikesWithPosters = async () => {
        try {
        const results = await Promise.all(
          user.likes.map(async (like) => {
            const type = like.mediaType === 'tv' ? 'tv' : 'movie'
            const res = await fetch(`/api/media?id=${like.tmdbId}&type=${type}`)
            if (!res.ok) return { ...like, posterPath: null }
            const data = await res.json() as { poster_path?: string | null }
            return { ...like, posterPath: data.poster_path ?? null }
          })
        )
          setLikesWithPosters(results)
        } catch (err) {
          console.error('Failed to fetch posters:', err)
          setLikesWithPosters(user.likes.map(l => ({ ...l, posterPath: null })))
        }
      }
      fetchLikesWithPosters()
    }
  }, [user?.likes])

  useEffect(() => {
    if (!user) return
    Promise.all([
      fetch('/api/watchlist', { credentials: 'include' }).then(res => res.json() as Promise<{ watchlist?: { tmdbId: number; mediaType: string }[] }>),
      fetch('/api/watched', { credentials: 'include' }).then(res => res.json() as Promise<{ watched?: { tmdbId: number; mediaType: string }[] }>),
      fetch('/api/groups', { credentials: 'include' }).then(res => res.json() as Promise<{ groups?: Group[] }>)
    ]).then(async ([watchlistData, watchedData, groupsData]) => {
      const watchlist = watchlistData.watchlist || []
      const watched = watchedData.watched || []
      
      const fetchPosters = async (items: { tmdbId: number; mediaType: string }[]) => {
        return Promise.all(
          items.map(async (item) => {
            const type = item.mediaType === 'tv' ? 'tv' : 'movie'
            const res = await fetch(`/api/media?id=${item.tmdbId}&type=${type}`)
            if (!res.ok) return { ...item, title: '', posterPath: null }
            const data = await res.json() as { title?: string; name?: string; poster_path?: string | null }
            return { ...item, title: data.title || data.name || '', posterPath: data.poster_path ?? null }
          })
        )
      }

      const [watchlistWithPosters, watchedWithPosters] = await Promise.all([
        fetchPosters(watchlist),
        fetchPosters(watched)
      ])

      setWatchlistItems(watchlistWithPosters)
      setWatchedItems(watchedWithPosters)
      setGroups((groupsData.groups || []).slice(0, 4))
      setLoading(false)
    })
  }, [user])

  const getProviderInfo = (id: string) => {
    const tmdbProvider = allProviders.find(p => String(p.provider_id) === id)
    if (tmdbProvider) return { name: tmdbProvider.provider_name, logo: tmdbProvider.logo_path }
    return { name: SERVICE_NAME_MAP[id] || id, logo: null }
  }

  const getLogoUrl = (logo: string | null) => {
    if (!logo) return null
    return `https://image.tmdb.org/t/p/w45${logo}`
  }

  const selectedServices = useMemo(() => {
    return (user?.streamingServices || []).map(s => {
      const id = typeof s === 'string' ? s : s.id
      const info = getProviderInfo(id)
      return { id, name: info.name, logo: info.logo }
    })
  }, [user?.streamingServices, allProviders])

  const userGenres = useMemo(() => {
    return (user?.genres || []).map(id => {
      const genre = genreList.find(g => g.id === id)
      return genre?.name || id
    })
  }, [user?.genres])

  const userCountries = useMemo(() => {
    return getUserCountries().map(code => countryNames[code] || code)
  }, [user?.countries])

  const generateApiKey = async () => {
    setApiKeyLoading(true)
    try {
      const res = await fetch('/api/auth/api-key', {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        await refreshUser()
      }
    } catch (err) {
      console.error('Failed to generate API key:', err)
    } finally {
      setApiKeyLoading(false)
    }
  }

  const revokeApiKey = async () => {
    if (!confirm('Are you sure you want to revoke your API key? Any applications using it will lose access.')) {
      return
    }
    setApiKeyLoading(true)
    try {
      const res = await fetch('/api/auth/api-key', {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        await refreshUser()
      }
    } catch (err) {
      console.error('Failed to revoke API key:', err)
    } finally {
      setApiKeyLoading(false)
    }
  }

  const copyApiKey = () => {
    if (user?.apiKey) {
      navigator.clipboard.writeText(user.apiKey)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  if (!user) {
    return (
      <main className="container" style={{ paddingTop: '40px', textAlign: 'center' }}>
        <p>Please log in to view your profile.</p>
      </main>
    )
  }

  const initials = user.username.slice(0, 2).toUpperCase()

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'likes', label: 'Likes', count: user.likes?.length || 0 },
    { id: 'groups', label: 'Groups', count: groups.length },
    { id: 'account', label: 'Account' },
  ]

  return (
    <main className="container" style={{ paddingTop: '40px', maxWidth: '900px' }}>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            fontWeight: 600,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '28px' }}>{user.username}</h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
              Member since {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <Link
            href="/preferences"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '14px',
            }}
          >
            <Edit2 size={16} />
            Edit
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '32px', borderBottom: '1px solid var(--border)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              backgroundColor: activeTab === tab.id ? 'var(--bg-secondary)' : 'transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span style={{
                padding: '2px 8px',
                backgroundColor: activeTab === tab.id ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
                borderRadius: '12px',
                fontSize: '12px',
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="section" style={{ marginBottom: '32px' }}>
            <h2 className="section-title" style={{ marginBottom: '16px' }}>Streaming Services</h2>
            {selectedServices.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {selectedServices.map(service => (
                  <span
                    key={service.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--surface)',
                      fontSize: '13px',
                    }}
                  >
                    {service.logo && (
                      <img
                        src={getLogoUrl(service.logo) || undefined}
                        alt=""
                        style={{ width: '20px', height: '20px', borderRadius: '4px' }}
                      />
                    )}
                    {service.name}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No streaming services selected</p>
            )}
          </div>

          <div className="section" style={{ marginBottom: '32px' }}>
            <h2 className="section-title" style={{ marginBottom: '16px' }}>Regions</h2>
            {userCountries.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {userCountries.map(country => (
                  <span
                    key={country}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--surface)',
                      fontSize: '13px',
                    }}
                  >
                    {country}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No regions selected</p>
            )}
          </div>

          <div className="section" style={{ marginBottom: '32px' }}>
            <h2 className="section-title" style={{ marginBottom: '16px' }}>Genres</h2>
            {userGenres.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {userGenres.map(genre => (
                  <span
                    key={genre}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      border: '1px solid var(--accent)',
                      backgroundColor: 'var(--accent)',
                      color: 'white',
                      fontSize: '13px',
                    }}
                  >
                    {genre}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No genres selected</p>
            )}
          </div>

          <div className="section" style={{ marginBottom: '32px' }}>
            <h2 className="section-title" style={{ marginBottom: '16px' }}>Your Activity</h2>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <Link
                href="/watchlist"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px 20px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  textDecoration: 'none',
                  color: 'inherit',
                  minWidth: '140px',
                }}
              >
                <List size={24} style={{ color: 'var(--accent)' }} />
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 600 }}>{watchlistItems.length}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Watchlist</div>
                </div>
              </Link>
              <Link
                href="/watchlist?filter=watched"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px 20px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  textDecoration: 'none',
                  color: 'inherit',
                  minWidth: '140px',
                }}
              >
                <Film size={24} style={{ color: 'var(--accent)' }} />
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 600 }}>{watchedItems.length}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Watched</div>
                </div>
              </Link>
            </div>
          </div>
        </>
      )}

      {activeTab === 'likes' && (
        <div className="section">
          <h2 className="section-title" style={{ marginBottom: '24px' }}>Liked Movies & Shows</h2>
          {likesWithPosters.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '20px' }}>
              {likesWithPosters.map(like => (
                <div key={like.tmdbId}>
                  {like.posterPath ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w185${like.posterPath}`}
                      alt={like.title}
                      style={{
                        width: '100%',
                        borderRadius: '8px',
                        aspectRatio: '2/3',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      aspectRatio: '2/3',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Film size={24} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                  )}
                  <p style={{
                    margin: '8px 0 0 0',
                    fontSize: '13px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {like.title}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>No likes added yet</p>
          )}
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 className="section-title" style={{ margin: 0 }}>My Groups</h2>
            <Link href="/groups" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent)', fontSize: '14px', textDecoration: 'none' }}>
              View All <ExternalLink size={14} />
            </Link>
          </div>
          {groups.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {groups.map(group => (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  style={{
                    display: 'block',
                    padding: '16px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>{group.name}</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>You haven't joined any groups yet</p>
          )}
        </div>
      )}

      {activeTab === 'account' && (
        <div className="section">
          <h2 className="section-title" style={{ marginBottom: '24px' }}>Account</h2>
          
          <div style={{ marginBottom: '24px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Username</p>
            <p style={{ fontSize: '16px', fontWeight: 500 }}>{user.username}</p>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>API Key</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
              Use your API key to access your watchlist and preferences from external applications.
            </p>
            {user?.apiKey ? (
              <div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                  <code style={{ flex: 1, padding: '10px 14px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.apiKey}
                  </code>
                  <button onClick={copyApiKey} style={{ padding: '10px 14px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Copy size={16} /> Copy
                  </button>
                </div>
                <button onClick={revokeApiKey} disabled={apiKeyLoading} style={{ padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid var(--error)', borderRadius: '6px', color: 'var(--error)', cursor: apiKeyLoading ? 'wait' : 'pointer' }}>
                  {apiKeyLoading ? 'Revoking...' : 'Revoke Key'}
                </button>
              </div>
            ) : (
              <button onClick={generateApiKey} disabled={apiKeyLoading} style={{ padding: '10px 20px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: apiKeyLoading ? 'wait' : 'pointer', fontWeight: 600 }}>
                {apiKeyLoading ? 'Generating...' : 'Generate API Key'}
              </button>
            )}
          </div>

          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '14px' }}>
            <LogOut size={16} />
            Logout
          </button>
        </div>
      )}
    </main>
  )
}
