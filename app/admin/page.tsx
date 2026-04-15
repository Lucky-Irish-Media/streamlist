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

interface LoginStats {
  totalLogins: number
  uniqueUsers: number
  failedAttempts: number
  failureRate: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loginStats, setLoginStats] = useState<LoginStats | null>(null)
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

        Promise.all([
          fetch('/api/admin/stats', { credentials: 'include' }).then(r => r.json()),
          fetch('/api/admin/activity?type=stats', { credentials: 'include' }).then(r => r.json()),
        ])
          .then(([statsData, activityData]) => {
            if (statsData.error) console.error(statsData.error)
            else setStats(statsData)
            if (activityData.error) console.error(activityData.error)
            else setLoginStats(activityData)
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

  const loginCards = [
    { label: 'Logins (30 days)', value: loginStats?.totalLogins ?? '-', color: '#22c55e' },
    { label: 'Unique Users', value: loginStats?.uniqueUsers ?? '-', color: '#3b82f6' },
    { label: 'Failed Attempts', value: loginStats?.failedAttempts ?? '-', color: '#ef4444' },
    { label: 'Failure Rate', value: loginStats?.failureRate ? `${(loginStats.failureRate * 100).toFixed(1)}%` : '-', color: '#f59e0b' },
  ]

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '32px' }}>Dashboard</h1>

      {loading ? (
        <p>Loading stats...</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '24px', marginBottom: '32px' }}>
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

          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Login Activity (30 days)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '24px' }}>
            {loginCards.map(card => (
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
        </>
      )}
    </div>
  )
}
