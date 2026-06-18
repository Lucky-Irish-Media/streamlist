'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Edit3, Check, Loader2 } from 'lucide-react'


interface WatchlistInfo {
  id: string
  name: string
  description: string | null
  createdAt: string
}

interface ManageListsModalProps {
  onClose: () => void
  onChanged: () => void
}

export default function ManageListsModal({ onClose, onChanged }: ManageListsModalProps) {
  const [lists, setLists] = useState<WatchlistInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newListName, setNewListName] = useState('')
  const [creatingList, setCreatingList] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchLists()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const fetchLists = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/lists', { credentials: 'include' })
      const data = await res.json() as { lists: WatchlistInfo[] }
      setLists(data.lists || [])
    } catch {
      setError('Failed to load lists')
    } finally {
      setLoading(false)
    }
  }

  const createList = async () => {
    const name = newListName.trim()
    if (!name) return

    setCreatingList(true)
    setError('')
    try {
      const res = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      })
      const data = await res.json() as { list?: WatchlistInfo; error?: string }
      if (data.list) {
        setLists(prev => [...prev, data.list!])
        setNewListName('')
        onChanged()
      } else {
        setError(data.error || 'Failed to create list')
      }
    } catch {
      setError('Failed to create list')
    } finally {
      setCreatingList(false)
    }
  }

  const startEditing = (list: WatchlistInfo) => {
    setEditingId(list.id)
    setEditingName(list.name)
  }

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return

    setSavingEdit(true)
    setError('')
    try {
      const res = await fetch(`/api/lists/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editingName.trim() }),
      })
      const data = await res.json() as { list?: WatchlistInfo; error?: string }
      if (data.list) {
        setLists(prev => prev.map(l => l.id === editingId ? data.list! : l))
        setEditingId(null)
        onChanged()
      } else {
        setError(data.error || 'Failed to rename list')
      }
    } catch {
      setError('Failed to rename list')
    } finally {
      setSavingEdit(false)
    }
  }

  const deleteList = async (id: string) => {
    setDeletingId(id)
    setError('')
    try {
      const res = await fetch(`/api/lists/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (data.success) {
        setLists(prev => prev.filter(l => l.id !== id))
        onChanged()
      } else {
        setError(data.error || 'Failed to delete list')
      }
    } catch {
      setError('Failed to delete list')
    } finally {
      setDeletingId(null)
    }
  }

  const isDefault = (name: string) => name === 'Default'

  return (
    <div className="modal-overlay">
      <div className="modal" ref={dialogRef} style={{ maxWidth: '450px' }}>
        <div className="modal-header-buttons">
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Manage Lists</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '16px' }}>
                {lists.map(list => (
                  <div
                    key={list.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {editingId === list.id ? (
                      <>
                        <input
                          type="text"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveEdit()}
                          className="sort-select"
                          style={{ flex: 1 }}
                          autoFocus
                        />
                        <button
                          onClick={saveEdit}
                          disabled={savingEdit || !editingName.trim()}
                          className="icon-btn"
                          title="Save"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="icon-btn"
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontWeight: isDefault(list.name) ? 600 : 400 }}>
                          {list.name}
                          {isDefault(list.name) && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                              (default)
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => startEditing(list)}
                          disabled={isDefault(list.name)}
                          className="icon-btn"
                          title="Rename"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => deleteList(list.id)}
                          disabled={isDefault(list.name) || deletingId === list.id}
                          className="icon-btn icon-btn--danger"
                          title={isDefault(list.name) ? 'Cannot delete Default list' : 'Delete'}
                        >
                          {deletingId === list.id ? (
                            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {lists.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '16px' }}>
                    No lists yet
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="New list name..."
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createList()}
                  className="sort-select"
                  style={{ flex: 1 }}
                />
                <button
                  onClick={createList}
                  disabled={!newListName.trim() || creatingList}
                  className="icon-btn"
                  title="Create list"
                >
                  {creatingList ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={16} />}
                </button>
              </div>

              {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '8px' }}>{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
