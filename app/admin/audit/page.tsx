'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/lib/useIsMobile'

interface AuditEntry {
  id: string
  actorId: string
  actorUsername: string
  action: string
  targetType: string | null
  targetId: string | null
  details: string | null
  createdAt: string
}

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const isMobile = useIsMobile()

  useEffect(() => {
    const load = async () => {
      try {
        const meRes = await fetch('/api/auth/me', { credentials: 'include' })
        const meData = await meRes.json() as { user?: { isAdmin: boolean } }
        if (!meData.user?.isAdmin) {
          router.push('/')
          return
        }

        const res = await fetch('/api/admin/audit', { credentials: 'include' })
        const data = await res.json() as { error?: string; entries?: AuditEntry[] }
        if (data.error) {
          console.error(data.error)
          return
        }
        setEntries(data.entries || [])
      } catch {
        router.push('/')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  if (loading) {
    return <p>Loading audit log...</p>
  }

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>Audit Log</h1>

      {entries.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No audit entries yet</p>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {entries.map(entry => (
            <div
              key={entry.id}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <p style={{ fontWeight: 600, fontSize: '14px' }}>{formatAction(entry.action)}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
              </div>
              <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <p><span style={{ color: 'var(--text-secondary)' }}>Actor: </span>{entry.actorUsername}</p>
                {entry.targetType && <p><span style={{ color: 'var(--text-secondary)' }}>Target: </span>{entry.targetType}{entry.targetId ? ` (${entry.targetId})` : ''}</p>}
                {entry.details && <p><span style={{ color: 'var(--text-secondary)' }}>Details: </span>{entry.details}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Time</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Actor</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Action</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Target</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px' }}>{entry.actorUsername}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '13px',
                    }}>
                      {formatAction(entry.action)}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px' }}>
                    {entry.targetType ? `${entry.targetType}${entry.targetId ? `:${entry.targetId.slice(0, 8)}` : ''}` : '-'}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.details || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
