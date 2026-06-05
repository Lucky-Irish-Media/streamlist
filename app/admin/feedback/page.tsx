'use client'

import { useEffect, useState } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'

interface FeedbackItem {
  id: string
  userId: string
  type: string
  title: string
  description: string
  status: string
  createdAt: string
  updatedAt: string
  username: string
}

const STATUSES = ['open', 'acknowledged', 'planned', 'completed', 'declined'] as const

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  open: { bg: '#3b82f6', color: 'white' },
  acknowledged: { bg: '#8b5cf6', color: 'white' },
  planned: { bg: '#f59e0b', color: 'white' },
  completed: { bg: '#22c55e', color: 'white' },
  declined: { bg: '#ef4444', color: 'white' },
}

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  feature: { bg: '#22c55e', color: 'white' },
  bug: { bg: '#ef4444', color: 'white' },
  other: { bg: '#8b5cf6', color: 'white' },
}

function Badge({ label, colors }: { label: string; colors: { bg: string; color: string } }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 500,
      backgroundColor: colors.bg,
      color: colors.color,
      textTransform: 'capitalize',
    }}>
      {label}
    </span>
  )
}

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const isMobile = useIsMobile()

  const fetchFeedback = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (typeFilter) params.set('type', typeFilter)
      const res = await fetch(`/api/feedback?${params.toString()}`, { credentials: 'include' })
      const data = await res.json() as { feedback?: FeedbackItem[]; error?: string }
      if (data.error) {
        console.error(data.error)
        return
      }
      setFeedback(data.feedback || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchFeedback()
  }, [statusFilter, typeFilter])

  const handleStatusUpdate = async (id: string, status: string) => {
    setUpdatingId(id)
    const res = await fetch('/api/feedback', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id, status }),
    })
    const data = await res.json() as { success?: boolean; error?: string }
    if (data.success) {
      fetchFeedback()
    } else {
      alert(data.error || 'Failed to update status')
    }
    setUpdatingId(null)
  }

  const filterSection = (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
      <select
        value={statusFilter}
        onChange={e => setStatusFilter(e.target.value)}
        style={{
          padding: '8px 12px',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          fontSize: '14px',
        }}
      >
        <option value="">All Statuses</option>
        {STATUSES.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select
        value={typeFilter}
        onChange={e => setTypeFilter(e.target.value)}
        style={{
          padding: '8px 12px',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          fontSize: '14px',
        }}
      >
        <option value="">All Types</option>
        <option value="feature">Feature</option>
        <option value="bug">Bug</option>
        <option value="other">Other</option>
      </select>
    </div>
  )

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>Feedback</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
        Review and triage user feedback submissions.
      </p>

      {filterSection}

      {loading ? (
        <p>Loading feedback...</p>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {feedback.map(item => (
            <div
              key={item.id}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <Badge label={item.type} colors={TYPE_COLORS[item.type] || { bg: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
                  <Badge label={item.status} colors={STATUS_COLORS[item.status] || { bg: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>{item.title}</p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: '1.5' }}>{item.description}</p>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                by <strong>{item.username}</strong>
              </div>
              <div>
                <label style={{ fontSize: '13px', display: 'block', marginBottom: '4px', color: 'var(--text-secondary)' }}>Status:</label>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusUpdate(item.id, s)}
                      disabled={updatingId === item.id || item.status === s}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        border: `1px solid ${item.status === s ? 'transparent' : 'var(--border)'}`,
                        borderRadius: '4px',
                        backgroundColor: item.status === s ? (STATUS_COLORS[s]?.bg || 'var(--bg-tertiary)') : 'var(--bg-tertiary)',
                        color: item.status === s ? 'white' : 'var(--text-primary)',
                        cursor: item.status === s ? 'default' : 'pointer',
                        opacity: updatingId === item.id ? 0.6 : 1,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
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
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Type</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Title</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Description</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Date</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {feedback.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px', fontSize: '14px' }}>{item.username}</td>
                  <td style={{ padding: '12px' }}>
                    <Badge label={item.type} colors={TYPE_COLORS[item.type] || { bg: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', fontWeight: 500 }}>{item.title}</td>
                  <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.description}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <Badge label={item.status} colors={STATUS_COLORS[item.status] || { bg: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <select
                      value={item.status}
                      onChange={e => handleStatusUpdate(item.id, e.target.value)}
                      disabled={updatingId === item.id}
                      style={{
                        padding: '6px 8px',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                      }}
                    >
                      {STATUSES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {feedback.length === 0 && !loading && (
        <p style={{ color: 'var(--text-secondary)', marginTop: '16px' }}>No feedback submissions found.</p>
      )}
    </div>
  )
}
