'use client'

import { useEffect, useState } from 'react'
import { Trash2, RefreshCw, Shield, ShieldOff } from 'lucide-react'

interface User {
  id: string
  username: string
  createdAt: string
  countries: string
  hasApiKey: boolean
  isAdmin: boolean
  sessionCount: number
  loginCount: number
  lastLogin: string | null
  watchlistCount: number
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchUsers = () => {
    fetch('/api/admin/users', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          console.error(data.error)
          return
        }
        setUsers(data.users || [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return
    
    setActionLoading(userId)
    const res = await fetch(`/api/admin/users?id=${userId}`, { method: 'DELETE', credentials: 'include' })
    const data = await res.json()
    
    if (data.success) {
      setUsers(users.filter(u => u.id !== userId))
    } else {
      alert(data.error || 'Failed to delete user')
    }
    setActionLoading(null)
  }

  const handleRegenerateApiKey = async (userId: string) => {
    if (!confirm('Regenerate API key? Old key will become invalid.')) return
    
    setActionLoading(userId)
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, action: 'regenerateApiKey' })
    })
    const data = await res.json()
    
    if (data.apiKey) {
      alert(`New API key: ${data.apiKey}`)
      fetchUsers()
    } else {
      alert(data.error || 'Failed to regenerate key')
    }
    setActionLoading(null)
  }

  const handleToggleAdmin = async (userId: string, currentIsAdmin: boolean) => {
    setActionLoading(userId)
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, action: 'setAdmin', value: !currentIsAdmin })
    })
    const data = await res.json()
    
    if (data.success) {
      fetchUsers()
    } else {
      alert(data.error || 'Failed to update admin status')
    }
    setActionLoading(null)
  }

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '32px' }}>Users</h1>

      {loading ? (
        <p>Loading users...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Username</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Created</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Logins</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Last Login</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Sessions</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Watchlist</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>API Key</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Admin</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px' }}>{user.username}</td>
                  <td style={{ padding: '12px' }}>
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td style={{ padding: '12px' }}>{user.loginCount}</td>
                  <td style={{ padding: '12px' }}>
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : '-'}
                  </td>
                  <td style={{ padding: '12px' }}>{user.sessionCount}</td>
                  <td style={{ padding: '12px' }}>{user.watchlistCount}</td>
                  <td style={{ padding: '12px' }}>
                    {user.hasApiKey ? (
                      <button
                        onClick={() => handleRegenerateApiKey(user.id)}
                        disabled={actionLoading === user.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          backgroundColor: 'var(--bg-tertiary)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        <RefreshCw size={14} />
                        Regenerate
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>None</span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button
                      onClick={() => handleToggleAdmin(user.id, user.isAdmin)}
                      disabled={actionLoading === user.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        backgroundColor: user.isAdmin ? 'var(--accent)' : 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        color: user.isAdmin ? 'white' : 'var(--text-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      {user.isAdmin ? <Shield size={14} /> : <ShieldOff size={14} />}
                      {user.isAdmin ? 'Admin' : 'User'}
                    </button>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button
                      onClick={() => handleDelete(user.id)}
                      disabled={actionLoading === user.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        backgroundColor: 'transparent',
                        border: '1px solid #ef4444',
                        borderRadius: '4px',
                        color: '#ef4444',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {users.length === 0 && !loading && (
        <p style={{ color: 'var(--text-secondary)', marginTop: '16px' }}>No users found</p>
      )}
    </div>
  )
}
