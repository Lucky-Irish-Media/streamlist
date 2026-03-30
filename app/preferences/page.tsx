'use client'

import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@/components/UserContext'
import { useRouter } from 'next/navigation'

const defaultServices = [
  { id: '8', name: 'Netflix', logo: 'https://image.tmdb.org/t/p/original/gyKiV5zz3R1A22vh5t2t3J9J3u5.png' },
  { id: '119', name: 'Amazon Prime Video', logo: 'https://image.tmdb.org/t/p/original/68H1O16Hg2zrkcD1p1Q0f2vKk2F.png' },
  { id: '257', name: 'Apple TV+', logo: 'https://image.tmdb.org/t/p/original/4Z7yA0n2PEX3YKD3VXt2T4J3kHH.png' },
  { id: '330', name: 'Hulu', logo: 'https://image.tmdb.org/t/p/original/yHZ2W3Ek9D2w1v2D7rT1Bj6g6aG.png' },
  { id: '387', name: 'HBO Max', logo: 'https://image.tmdb.org/t/p/original/yZBqkV464dCw4qpoXqHZIK3PTHF.png' },
  { id: '337', name: 'Disney+', logo: 'https://image.tmdb.org/t/p/original/7Q53I7Cl85lX95bK2xT3f4j1B2a.png' },
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
]

export default function PreferencesPage() {
  const { user, refreshUser } = useUser()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [apiKeyLoading, setApiKeyLoading] = useState(false)
  const [allProviders, setAllProviders] = useState<{ provider_id: number; provider_name: string; logo_path: string }[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [providersLoading, setProvidersLoading] = useState(false)

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
        const regions = getUserCountries()
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
  }, [user?.countries])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    return allProviders.filter(p => 
      p.provider_name.toLowerCase().includes(query)
    ).slice(0, 20)
  }, [searchQuery, allProviders])

  const isSelected = (id: string) => user?.streamingServices?.includes(id)

  if (!user) {
    return (
      <main className="container" style={{ paddingTop: '40px', textAlign: 'center' }}>
        <p>Please log in to view your preferences.</p>
      </main>
    )
  }

  const savePreferences = async (data: Record<string, any>) => {
    const sessionId = localStorage.getItem('sessionId')
    setSaving(true)
    try {
      await fetch('/api/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionId ? { 'x-session-id': sessionId } : {})
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
    const updated = current.includes(serviceId)
      ? current.filter(id => id !== serviceId)
      : [...current, serviceId]
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
    const sessionId = localStorage.getItem('sessionId')
    setSaving(true)
    try {
      await fetch('/api/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionId ? { 'x-session-id': sessionId } : {})
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
    const sessionId = localStorage.getItem('sessionId')
    setApiKeyLoading(true)
    try {
      const res = await fetch('/api/auth/api-key', {
        method: 'POST',
        headers: sessionId ? { 'x-session-id': sessionId } : {},
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
    const sessionId = localStorage.getItem('sessionId')
    if (!confirm('Are you sure you want to revoke your API key? Any applications using it will lose access.')) {
      return
    }
    setApiKeyLoading(true)
    try {
      const res = await fetch('/api/auth/api-key', {
        method: 'DELETE',
        headers: sessionId ? { 'x-session-id': sessionId } : {},
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
        <div className="checkbox-group" style={{ marginBottom: '16px' }}>
          {defaultServices.map(service => (
            <span
              key={service.id}
              className={`checkbox-item ${isSelected(service.id) ? 'selected' : ''}`}
              onClick={() => !saving && toggleService(service.id)}
              style={{ cursor: saving ? 'wait' : 'pointer' }}
            >
              {service.name}
            </span>
          ))}
        </div>
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
                  className={`provider-item ${selected ? 'selected grayed' : ''}`}
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
        {user.likes && user.likes.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {user.likes.map(like => (
              <div key={like.tmdbId} style={{ display: 'inline-flex', alignItems: 'center', gap: '0' }}>
                <span className="badge" style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0, margin: 0, border: '1px solid var(--border-color)', borderRight: 'none' }}>
                  {like.title}
                </span>
                <button
                  onClick={() => !saving && removeLike(like.tmdbId, like.mediaType)}
                  disabled={saving}
                  style={{
                    padding: '4px 8px',
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    cursor: saving ? 'wait' : 'pointer',
                    border: '1px solid var(--border-color)',
                    borderLeft: 'none',
                    background: 'var(--surface)',
                    color: 'var(--text-secondary)',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    lineHeight: 1,
                  }}
                  title="Remove"
                >
                  ×
                </button>
              </div>
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