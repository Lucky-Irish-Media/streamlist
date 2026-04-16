'use client'

import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@/components/UserContext'
import { useRouter } from 'next/navigation'

const defaultServiceIds = ['8', '119', '257', '15', '387', '337']

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

const countries = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IN', name: 'India' },
  { code: 'JP', name: 'Japan' },
  { code: 'MX', name: 'Mexico' },
  { code: 'KR', name: 'South Korea' },
  { code: 'PT', name: 'Portugal' },
  { code: 'ZA', name: 'South Africa' },
]

export default function PreferencesPage() {
  const { user, refreshUser } = useUser()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [apiKeyLoading, setApiKeyLoading] = useState(false)
  const [allProviders, setAllProviders] = useState<{ provider_id: number; provider_name: string; logo_path: string }[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [providersLoading, setProvidersLoading] = useState(false)
  const [likesWithPosters, setLikesWithPosters] = useState<{ tmdbId: number; mediaType: string; title: string; posterPath: string | null }[]>([])

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
      setProvidersLoading(true)
      try {
        const regions = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'JP', 'KR', 'BR', 'IN', 'MX', 'PT', 'ZA']
        const res = await fetch(`/api/providers?regions=${regions.join(',')}`)
        const data = await res.json() as { providers?: { provider_id: number; provider_name: string; logo_path: string }[] }
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

  useEffect(() => {
    if (!user?.likes || user.likes.length === 0) {
      setLikesWithPosters([])
      return
    }
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
  }, [user?.likes])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    return allProviders.filter(p => 
      p.provider_name.toLowerCase().includes(query)
    ).slice(0, 20)
  }, [searchQuery, allProviders])

  const isSelected = (id: string) => user?.streamingServices?.some(s => (typeof s === 'string' ? s : s.id) === id)

  const getProviderInfo = (id: string) => {
    if (defaultServiceIds.includes(id)) {
      const tmdbProvider = allProviders.find(p => String(p.provider_id) === id)
      if (tmdbProvider) return { name: tmdbProvider.provider_name, logo: tmdbProvider.logo_path, isFullUrl: false }
    }
    const tmdbProvider = allProviders.find(p => String(p.provider_id) === id)
    if (tmdbProvider) return { name: tmdbProvider.provider_name, logo: tmdbProvider.logo_path, isFullUrl: false }
    return null
  }

  const getLogoUrl = (info: { logo: string; isFullUrl: boolean } | null) => {
    if (!info?.logo) return null
    return info.isFullUrl ? info.logo : `https://image.tmdb.org/t/p/w45${info.logo}`
  }

  const selectedServices = (user?.streamingServices || []).filter(s => {
    const id = typeof s === 'string' ? s : s.id
    return isSelected(id)
  }) as { id: string; name: string }[]

  const getServiceName = (id: string) => {
    const info = getProviderInfo(id)
    return info?.name || SERVICE_NAME_MAP[id] || id
  }

  if (!user) {
    return (
      <main className="container" style={{ paddingTop: '40px', textAlign: 'center' }}>
        <p>Please log in to view your preferences.</p>
      </main>
    )
  }

  const savePreferences = async (data: Record<string, any>) => {
    setSaving(true)
    try {
      await fetch('/api/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data),
      })
      await refreshUser()
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  const toggleService = (serviceId: string) => {
    const current = user.streamingServices || []
    const exists = current.some(s => (typeof s === 'string' ? s : s.id) === serviceId)
    const updated = exists
      ? current.filter(s => (typeof s === 'string' ? s : s.id) !== serviceId)
      : [...current, { id: serviceId, name: getServiceName(serviceId) }]
    savePreferences({ streamingServices: updated })
  }

  const toggleGenre = (genreId: number) => {
    const current = user.genres || []
    const updated = current.includes(genreId)
      ? current.filter(id => id !== genreId)
      : [...current, genreId]
    savePreferences({ genres: updated })
  }

  const toggleCountry = (code: string) => {
    const current = user.countries || ['US']
    const updated = current.includes(code)
      ? current.filter(c => c !== code)
      : [...current, code]
    if (updated.length === 0) return
    savePreferences({ countries: updated })
  }

  const removeLike = async (tmdbId: number, mediaType: string) => {
    setSaving(true)
    try {
      await fetch('/api/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ removeLike: { tmdbId, mediaType } }),
      })
      await refreshUser()
    } catch (err) {
      console.error('Failed to remove like:', err)
    } finally {
      setSaving(false)
    }
  }

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

  return (
    <main className="container" style={{ paddingTop: '40px' }}>
      <h1 style={{ marginBottom: '32px' }}>Your Preferences</h1>

      <div className="section">
        <h2 className="section-title" style={{ marginBottom: '16px' }}>Streaming Services</h2>
        {selectedServices.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {selectedServices.map(service => {
              const info = getProviderInfo(service.id)
              const name = service.name || info?.name || service.id
              if (!info && !service.name) return null
              return (
                <span
                  key={service.id}
                  className="selected-service-item"
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
                  {getLogoUrl(info) && (
                    <img 
                      src={getLogoUrl(info) || undefined}
                      alt="" 
                      style={{ width: '20px', height: '20px', borderRadius: '4px' }}
                    />
                  )}
                  {name}
                  <button
                    onClick={() => !saving && toggleService(service.id)}
                    disabled={saving}
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
                      cursor: saving ? 'wait' : 'pointer',
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
        ) : (
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
            No streaming services selected. Search below to add some.
          </p>
        )}
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Search for more services..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            disabled={providersLoading}
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
        {searchResults.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {searchResults.map(provider => {
              const providerId = String(provider.provider_id)
              const selected = isSelected(providerId)
              return (
                <span
                  key={provider.provider_id}
                  className="provider-item grayed"
                  onClick={() => !saving && !selected && toggleService(providerId)}
                  style={{ 
                    cursor: selected ? 'default' : (saving ? 'wait' : 'pointer'),
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
      </div>

      <div className="section">
        <h2 className="section-title" style={{ marginBottom: '16px' }}>Regions</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '14px' }}>
          Used to show streaming availability in your selected regions
        </p>
        <div className="checkbox-group">
          {countries.map(c => (
            <span
              key={c.code}
              className={`checkbox-item ${getUserCountries().includes(c.code) ? 'selected' : ''}`}
              onClick={() => !saving && toggleCountry(c.code)}
              style={{ cursor: saving ? 'wait' : 'pointer' }}
            >
              {c.name}
            </span>
          ))}
        </div>
      </div>

      <div className="section">
        <h2 className="section-title" style={{ marginBottom: '16px' }}>Genres</h2>
        <div className="checkbox-group">
          {genreList.map(genre => (
            <span
              key={genre.id}
              className={`checkbox-item ${user.genres?.includes(genre.id) ? 'selected' : ''}`}
              onClick={() => !saving && toggleGenre(genre.id)}
              style={{ cursor: saving ? 'wait' : 'pointer' }}
            >
              {genre.name}
            </span>
          ))}
        </div>
      </div>

      <div className="section">
        <h2 className="section-title" style={{ marginBottom: '16px' }}>Liked Movies & Shows</h2>
        {likesWithPosters && likesWithPosters.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {likesWithPosters.map(like => (
              <span
                key={like.tmdbId}
                className="selected-service-item"
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
                {like.posterPath && (
                  <img 
                    src={`https://image.tmdb.org/t/p/w45${like.posterPath}`}
                    alt="" 
                    style={{ width: '20px', height: '30px', borderRadius: '4px', objectFit: 'cover' }}
                  />
                )}
                <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {like.title}
                </span>
                <button
                  onClick={() => !saving && removeLike(like.tmdbId, like.mediaType)}
                  disabled={saving}
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
                    cursor: saving ? 'wait' : 'pointer',
                    lineHeight: 1,
                  }}
                  title="Remove"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>No likes added yet</p>
        )}
      </div>

      <div className="section">
        <h2 className="section-title" style={{ marginBottom: '16px' }}>API Access</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '14px' }}>
          Use your API key to access your watchlist and preferences from external applications via the MCP server.
        </p>
        {user?.apiKey ? (
          <div>
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              alignItems: 'center',
              marginBottom: '12px' 
            }}>
              <code style={{ 
                flex: 1, 
                padding: '10px 14px', 
                background: 'var(--bg-tertiary)', 
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '13px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {user.apiKey}
              </code>
              <button
                onClick={copyApiKey}
                className="btn-secondary"
                style={{ padding: '10px 14px' }}
              >
                Copy
              </button>
            </div>
            <button
              onClick={revokeApiKey}
              disabled={apiKeyLoading}
              className="btn-secondary"
              style={{ 
                padding: '8px 16px',
                borderColor: 'var(--error)',
                color: 'var(--error)',
              }}
            >
              {apiKeyLoading ? 'Revoking...' : 'Revoke Key'}
            </button>
          </div>
        ) : (
          <button
            onClick={generateApiKey}
            disabled={apiKeyLoading}
            className="btn-primary"
          >
            {apiKeyLoading ? 'Generating...' : 'Generate API Key'}
          </button>
        )}
      </div>
    </main>
  )
}