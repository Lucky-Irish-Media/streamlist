'use client'

import { useEffect, useState } from 'react'
import { Trash2, Plus, ToggleLeft, ToggleRight } from 'lucide-react'

interface AccessCode {
  id: string
  code: string
  createdBy: string | null
  createdAt: string
  expiresAt: string | null
  isActive: boolean
}

export default function AdminAccessCodesPage() {
  const [codes, setCodes] = useState<AccessCode[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [expiresDays, setExpiresDays] = useState('')

  const fetchCodes = async () => {
    try {
      const res = await fetch('/api/admin/access-codes', { credentials: 'include' })
      const data = await res.json() as { error?: string; codes?: AccessCode[] }
      if (data.error) {
        console.error(data.error)
        return
      }
      setCodes(data.codes || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCodes()
  }, [])

  const handleCreateCode = async () => {
    const expiresInDays = expiresDays ? parseInt(expiresDays, 10) : null
    
    const res = await fetch('/api/admin/access-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        code: newCode || undefined,
        expiresInDays
      })
    })
    const data = await res.json() as { id?: string; code?: string; error?: string }
    
    if (data.id) {
      alert(`Access code created: ${data.code}`)
      setShowModal(false)
      setNewCode('')
      setExpiresDays('')
      fetchCodes()
    } else {
      alert(data.error || 'Failed to create code')
    }
  }

  const handleToggleActive = async (codeId: string) => {
    setActionLoading(codeId)
    const res = await fetch('/api/admin/access-codes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id: codeId, action: 'toggleActive' })
    })
    const data = await res.json() as { success?: boolean; error?: string }
    
    if (data.success) {
      fetchCodes()
    } else {
      alert(data.error || 'Failed to toggle code')
    }
    setActionLoading(null)
  }

  const handleDelete = async (codeId: string) => {
    if (!confirm('Delete this access code?')) return
    
    setActionLoading(codeId)
    const res = await fetch(`/api/admin/access-codes?id=${codeId}`, { method: 'DELETE', credentials: 'include' })
    const data = await res.json() as { success?: boolean; error?: string }
    
    if (data.success) {
      setCodes(codes.filter(c => c.id !== codeId))
    } else {
      alert(data.error || 'Failed to delete code')
    }
    setActionLoading(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600 }}>Access Codes</h1>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            backgroundColor: 'var(--accent)',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          <Plus size={18} />
          Generate Code
        </button>
      </div>

      {loading ? (
        <p>Loading codes...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Code</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Created</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Expires</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map(code => (
                <tr key={code.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '14px' }}>
                    {code.code}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {code.createdAt ? new Date(code.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button
                      onClick={() => handleToggleActive(code.id)}
                      disabled={actionLoading === code.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        backgroundColor: code.isActive ? '#22c55e20' : '#ef444420',
                        border: '1px solid',
                        borderColor: code.isActive ? '#22c55e' : '#ef4444',
                        borderRadius: '4px',
                        color: code.isActive ? '#22c55e' : '#ef4444',
                        cursor: 'pointer',
                      }}
                    >
                      {code.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      {code.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button
                      onClick={() => handleDelete(code.id)}
                      disabled={actionLoading === code.id}
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

      {codes.length === 0 && !loading && (
        <p style={{ color: 'var(--text-secondary)', marginTop: '16px' }}>No access codes found</p>
      )}

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            padding: '24px',
            width: '400px',
            border: '1px solid var(--border)',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px' }}>Generate Access Code</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                Custom Code (optional)
              </label>
              <input
                type="text"
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                placeholder="Leave empty for auto-generated"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                Expires in (days, optional)
              </label>
              <input
                type="number"
                value={expiresDays}
                onChange={e => setExpiresDays(e.target.value)}
                placeholder="Never expires"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCode}
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'var(--accent)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
