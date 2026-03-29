'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useUser } from '@/components/UserContext'

export default function JoinGroupPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useUser()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'joining' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMessage('Invalid invite link')
      return
    }

    if (user) {
      joinGroup()
    }
  }, [user, token])

  const joinGroup = async () => {
    if (!token || !user) return

    setStatus('joining')
    const sessionId = localStorage.getItem('sessionId')

    try {
      const res = await fetch(`/api/groups/join?token=${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionId ? { 'x-session-id': sessionId } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ token })
      })

      const data = await res.json()

      if (res.ok) {
        setStatus('success')
        setTimeout(() => router.push('/groups'), 1500)
      } else {
        setStatus('error')
        setErrorMessage(data.error || 'Failed to join group')
      }
    } catch {
      setStatus('error')
      setErrorMessage('Failed to join group')
    }
  }

  if (!user) {
    return (
      <main className="container" style={{ paddingTop: '32px' }}>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔐</div>
          <h2 style={{ marginBottom: '8px' }}>Login Required</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Please log in to join this group
          </p>
          <a
            href={`/login?redirect=/groups/join?token=${token}`}
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: 'var(--accent)',
              color: 'white',
              borderRadius: '6px',
              textDecoration: 'none'
            }}
          >
            Login
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="container" style={{ paddingTop: '32px' }}>
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        {status === 'loading' || status === 'joining' ? (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <h2 style={{ marginBottom: '8px' }}>{status === 'loading' ? 'Loading...' : 'Joining Group...'}</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              {status === 'loading' ? 'Please wait...' : 'You are being added to the group'}
            </p>
          </>
        ) : status === 'success' ? (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ marginBottom: '8px' }}>Joined Successfully!</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Redirecting to your groups...
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
            <h2 style={{ marginBottom: '8px' }}>Could Not Join Group</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              {errorMessage}
            </p>
            <a
              href="/groups"
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                textDecoration: 'none'
              }}
            >
              Back to Groups
            </a>
          </>
        )}
      </div>
    </main>
  )
}
