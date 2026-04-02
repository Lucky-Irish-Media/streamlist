'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Stats {
  totalUsers: number
  usersWithApiKey: number
  activeSessions: number
  usersLast30Days: number
  totalGroups: number
  activeAccessCodes: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (!data.user?.isAdmin) {
          router.push('/')
          return
        }
        
        fetch('/api/admin/stats', { credentials: 'include' })
          .then(res => res.json())
          .then(data => {
            if (data.error) {
              console.error(data.error)
              return
            }
            setStats(data)
          })
          .finally(() => setLoading(false))
      })
      .catch(() => router.push('/'))
  }, [router])

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers ?? '-', color: '#3b82f6' },
    { label: 'Active Sessions', value: stats?.activeSessions ?? '-', color: '#22c55e' },
    { label: 'Users (30 days)', value: stats?.usersLast30Days ?? '-', color: '#f59e0b' },
    { label: 'API Keys', value: stats?.usersWithApiKey ?? '-', color: '#8b5cf6' },
    { label: 'Groups', value: stats?.totalGroups ?? '-', color: '#ec4899' },
    { label: 'Active Codes', value: stats?.activeAccessCodes ?? '-', color: '#06b6d4' },
  ]

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '32px' }}>Dashboard</h1>

      {loading ? (
        <p>Loading stats...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '24px' }}>
          {statCards.map(card => (
            <div
              key={card.label}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '8px',
                padding: '24px',
                border: '1px solid var(--border)',
              }}
            >
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>
                {card.label}
              </p>
              <p style={{ fontSize: '32px', fontWeight: 600, color: card.color }}>
                {card.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
