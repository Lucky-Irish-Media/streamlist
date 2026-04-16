'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@/components/UserContext'
import EmptyState from '@/components/EmptyState'
import { Lock, Users } from 'lucide-react'

interface Group {
  id: string
  name: string
  createdAt: string
  createdBy: string
  memberCount: number
}

export default function GroupsPage() {
  const { user } = useUser()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (user) {
      fetchGroups()
    }
  }, [user])

  const fetchGroups = async () => {
    const res = await fetch('/api/groups', {
      credentials: 'include'
    })
    const data = await res.json() as { groups?: Group[] }
    setGroups(data.groups || [])
    setLoading(false)
  }

  const createGroup = async () => {
    if (!newGroupName.trim()) return
    setCreating(true)
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ name: newGroupName.trim() })
    })
    const data = await res.json() as { group?: Group }
    if (data.group) {
      setGroups([...groups, { ...data.group, memberCount: 1 }])
      setShowCreateModal(false)
      setNewGroupName('')
    }
    setCreating(false)
  }

  if (!user) {
    return (
      <main className="container" style={{ paddingTop: '32px' }}>
        <EmptyState
          icon={Lock}
          title="Login Required"
          description="Please log in to view your groups"
          actionText="Login"
          actionHref="/login"
        />
      </main>
    )
  }

  return (
    <main className="container" style={{ paddingTop: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1>Your Groups</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Create Group
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Groups Yet"
          description="Create a group to share watchlists and get recommendations with friends"
        />
      ) : (
        <div className="grid grid-3">
          {groups.map(group => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              style={{
                display: 'block',
                padding: '20px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                textDecoration: 'none',
                color: 'inherit'
              }}
            >
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>{group.name}</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
                {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
              </p>
            </Link>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              padding: '24px',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '400px'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Create Group</h2>
            <input
              type="text"
              placeholder="Group name"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createGroup()}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '16px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: '16px'
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={createGroup}
                disabled={creating || !newGroupName.trim()}
                style={{
                  padding: '10px 16px',
                  backgroundColor: creating ? 'var(--text-secondary)' : 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  opacity: creating ? 0.7 : 1
                }}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
