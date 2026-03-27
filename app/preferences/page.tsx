'use client'

import { useState } from 'react'
import { useUser } from '@/components/UserContext'
import { useRouter } from 'next/navigation'

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
]

export default function PreferencesPage() {
  const { user, refreshUser } = useUser()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [apiKeyLoading, setApiKeyLoading] = useState(false)

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
        <div className="checkbox-group">
          {services.map(service => (
            <span
              key={service.id}
              className={`checkbox-item ${user.streamingServices?.includes(service.id) ? 'selected' : ''}`}
              onClick={() => !saving && toggleService(service.id)}
              style={{ cursor: saving ? 'wait' : 'pointer' }}
            >
              {service.name}
            </span>
          ))}
        </div>
      </div>

      <div className="section">
        <h2 className="section-title" style={{ marginBottom: '16px' }}>Region</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '14px' }}>
          Used to show streaming availability for your country
        </p>
        <select
          value={user.country || 'US'}
          onChange={e => !saving && savePreferences({ country: e.target.value })}
          disabled={saving}
          style={{
            padding: '10px 14px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            cursor: saving ? 'wait' : 'pointer',
            minWidth: '200px',
          }}
        >
          {countries.map(c => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
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