'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Plus, Check, Loader2 } from 'lucide-react'


interface WatchlistInfo {
  id: string
  name: string
}

interface AddToListDialogProps {
  tmdbId: number
  mediaType: string
  onClose: () => void
  onDone: () => void
}

export default function AddToListDialog({ tmdbId, mediaType, onClose, onDone }: AddToListDialogProps) {
  const [lists, setLists] = useState<WatchlistInfo[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [creatingList, setCreatingList] = useState(false)
  const [error, setError] = useState('')
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
      const defaultList = (data.lists || []).find(l => l.name === 'Default')
      if (defaultList) {
        setSelectedIds(new Set([defaultList.id]))
      }
    } catch {
      setError('Failed to load lists')
    } finally {
      setLoading(false)
    }
  }

  const toggleList = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const createList = async () => {
    const name = newListName.trim()
    if (!name) return

    setCreatingList(true)
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
        setSelectedIds(prev => new Set(prev).add(data.list!.id))
        setNewListName('')
      } else {
        setError(data.error || 'Failed to create list')
      }
    } catch {
      setError('Failed to create list')
    } finally {
      setCreatingList(false)
    }
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const promises = Array.from(selectedIds).map(listId =>
        fetch(`/api/lists/${listId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ tmdbId, mediaType }),
        })
      )
      await Promise.all(promises)
      onDone()
    } catch {
      setError('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" ref={dialogRef} style={{ maxWidth: '400px' }}>
        <div className="modal-header-buttons">
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Add to List</h2>
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
              <div style={{ marginBottom: '12px' }}>
                {lists.map(list => (
                  <label
                    key={list.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 0',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(list.id)}
                      onChange={() => toggleList(list.id)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span>{list.name}</span>
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
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

              {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={onClose} className="icon-btn" style={{ padding: '8px 16px' }}>
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving || selectedIds.size === 0}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {saving ? (
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Check size={16} />
                  )}
                  {saving ? 'Saving...' : `Save (${selectedIds.size})`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
