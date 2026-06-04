'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Activity } from 'lucide-react'
import { useIsMobile } from '@/lib/useIsMobile'

interface HealthCounts {
  users: number
  sessions: number
  loginAttempts: number
  watchlist: number
  userLikes: number
  userGroups: number
  accessCodes: number
  auditLog: number
}

export default function AdminMaintenancePage() {
  const [health, setHealth] = useState<HealthCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()
  const isMobile = useIsMobile()

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/admin/maintenance?action=health', { credentials: 'include' })
      const data = await res.json() as { error?: string; counts?: HealthCounts }
      if (data.error) {
        console.error(data.error)
        return
      }
      setHealth(data.counts || null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
  }, [])

  const handleCleanup = async (action: string, label: string) => {
    if (!confirm(`Run ${label}? This will delete records older than 90 days.`)) return
    setActionLoading(action)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/maintenance?action=${action}`, { method: 'POST', credentials: 'include' })
      const data = await res.json() as { success?: boolean; error?: string; deletedSessions?: number; deletedAttempts?: number }
      if (data.success) {
        const count = data.deletedSessions ?? data.deletedAttempts ?? 0
        setMessage(`${label} complete: ${count} records deleted`)
        fetchHealth()
      } else {
        setMessage(`Error: ${data.error || 'Unknown error'}`)
      }
    } catch {
      setMessage('Error running cleanup')
    }
    setActionLoading(null)
  }

  const healthCards = health ? [
    { label: 'Users', value: health.users },
    { label: 'Sessions', value: health.sessions },
    { label: 'Login Attempts', value: health.loginAttempts },
    { label: 'Watchlist Items', value: health.watchlist },
    { label: 'Likes', value: health.userLikes },
    { label: 'Groups', value: health.userGroups },
    { label: 'Access Codes', value: health.accessCodes },
    { label: 'Audit Log Entries', value: health.auditLog },
  ] : []

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>Maintenance</h1>

      {message && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: message.startsWith('Error') ? '#7f1d1d' : '#14532d',
          borderRadius: '8px',
          marginBottom: '24px',
          color: 'white',
          fontSize: '14px',
        }}>
          {message}
        </div>
      )}

      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={20} />
          Database Health
        </h2>
        {loading ? (
          <p>Loading health data...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '120px' : '160px'}, 1fr))`, gap: isMobile ? '8px' : '16px' }}>
            {healthCards.map(card => (
              <div
                key={card.label}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: isMobile ? '12px' : '16px',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 600, color: 'var(--accent)' }}>
                  {card.value}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {card.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trash2 size={20} />
          Cleanup Operations
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '500px' }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <p style={{ fontWeight: 600, marginBottom: '4px' }}>Old Sessions</p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Delete sessions expired &gt; 90 days ago</p>
            </div>
            <button
              onClick={() => handleCleanup('cleanup-sessions', 'Old Session Cleanup')}
              disabled={actionLoading === 'cleanup-sessions'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: '#ef4444',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer',
                opacity: actionLoading === 'cleanup-sessions' ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              <Trash2 size={16} />
              {actionLoading === 'cleanup-sessions' ? 'Running...' : 'Cleanup'}
            </button>
          </div>

          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <p style={{ fontWeight: 600, marginBottom: '4px' }}>Old Login Attempts</p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Delete login attempts older than 90 days</p>
            </div>
            <button
              onClick={() => handleCleanup('cleanup-attempts', 'Old Login Attempt Cleanup')}
              disabled={actionLoading === 'cleanup-attempts'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: '#ef4444',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer',
                opacity: actionLoading === 'cleanup-attempts' ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              <Trash2 size={16} />
              {actionLoading === 'cleanup-attempts' ? 'Running...' : 'Cleanup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
