'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, XCircle, Filter } from 'lucide-react'
import { useIsMobile } from '@/lib/useIsMobile'

interface Session {
  id: string
  userId: string
  username: string
  expiresAt: string
  ipAddress: string | null
  userAgent: string | null
  endedAt: string | null
  isActive: boolean
}

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [userIdFilter, setUserIdFilter] = useState('')
  const router = useRouter()
  const isMobile = useIsMobile()

  const fetchSessions = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (userIdFilter) params.set('userId', userIdFilter)

      const res = await fetch(`/api/admin/sessions?${params}`, { credentials: 'include' })
      const data = await res.json() as { error?: string; sessions?: Session[] }
      if (data.error) {
        console.error(data.error)
        return
      }
      setSessions(data.sessions || [])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, userIdFilter])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const handleForceLogout = async (sessionId: string) => {
    if (!confirm('Force logout this session?')) return
    setActionLoading(sessionId)
    const res = await fetch(`/api/admin/sessions?id=${sessionId}`, { method: 'DELETE', credentials: 'include' })
    const data = await res.json() as { success?: boolean; error?: string }
    if (data.success) {
      setSessions(sessions.filter(s => s.id !== sessionId))
    } else {
      alert(data.error || 'Failed to force logout')
    }
    setActionLoading(null)
  }

  const handleForceLogoutAll = async (userId: string) => {
    if (!confirm('Force logout all sessions for this user?')) return
    setActionLoading(userId)
    const res = await fetch(`/api/admin/sessions?userId=${userId}`, { method: 'DELETE', credentials: 'include' })
    const data = await res.json() as { success?: boolean; error?: string }
    if (data.success) {
      fetchSessions()
    } else {
      alert(data.error || 'Failed to force logout')
    }
    setActionLoading(null)
  }

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>Sessions</h1>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setLoading(true) }}
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">All Sessions</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        <input
          type="text"
          placeholder="Filter by user ID..."
          value={userIdFilter}
          onChange={e => { setUserIdFilter(e.target.value); setLoading(true) }}
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            width: isMobile ? '100%' : '250px',
          }}
        />
      </div>

      {loading ? (
        <p>Loading sessions...</p>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sessions.map(session => (
            <div
              key={session.id}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <p style={{ fontWeight: 600 }}>{session.username}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {session.isActive ? (
                      <span style={{ color: '#22c55e' }}>Active</span>
                    ) : (
                      <span style={{ color: '#ef4444' }}>Expired</span>
                    )}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => handleForceLogout(session.id)}
                    disabled={actionLoading === session.id || !session.isActive}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 10px',
                      backgroundColor: 'transparent',
                      border: '1px solid #ef4444',
                      borderRadius: '4px',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    <XCircle size={12} />
                    End
                  </button>
                </div>
              </div>
              <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <p><span style={{ color: 'var(--text-secondary)' }}>Expires: </span>{new Date(session.expiresAt).toLocaleString()}</p>
                {session.ipAddress && <p><span style={{ color: 'var(--text-secondary)' }}>IP: </span>{session.ipAddress}</p>}
                {session.userAgent && (
                  <p style={{ wordBreak: 'break-all' }}><span style={{ color: 'var(--text-secondary)' }}>UA: </span>{session.userAgent}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>User</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Expires</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>IP Address</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>User Agent</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(session => (
                <tr key={session.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px' }}>
                    {session.username}
                    <button
                      onClick={() => handleForceLogoutAll(session.userId)}
                      disabled={actionLoading === session.userId}
                      style={{
                        marginLeft: '8px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        textDecoration: 'underline',
                      }}
                      title="Force logout all sessions for this user"
                    >
                      <LogOut size={14} />
                    </button>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {session.isActive ? (
                      <span style={{ color: '#22c55e' }}>Active</span>
                    ) : (
                      <span style={{ color: '#ef4444' }}>Expired</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px' }}>
                    {new Date(session.expiresAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px' }}>{session.ipAddress || '-'}</td>
                  <td style={{ padding: '12px', fontSize: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {session.userAgent || '-'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button
                      onClick={() => handleForceLogout(session.id)}
                      disabled={actionLoading === session.id || !session.isActive}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        backgroundColor: 'transparent',
                        border: '1px solid #ef4444',
                        borderRadius: '4px',
                        color: '#ef4444',
                        cursor: actionLoading === session.id || !session.isActive ? 'not-allowed' : 'pointer',
                        opacity: session.isActive ? 1 : 0.5,
                      }}
                    >
                      <XCircle size={14} />
                      Force Logout
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sessions.length === 0 && !loading && (
        <p style={{ color: 'var(--text-secondary)', marginTop: '16px' }}>No sessions found</p>
      )}
    </div>
  )
}
