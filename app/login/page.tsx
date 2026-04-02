'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [error, setError] = useState('')
  const pathname = usePathname()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, accessCode }),
    })

    const data = await res.json()

    if (data.error) {
      setError(data.error)
    } else {
      window.location.href = '/'
    }
  }

  return (
    <main className="container" style={{ paddingTop: '60px' }}>
      <form onSubmit={handleLogin} className="auth-form">
        <h2>Welcome to StreamList</h2>
        {error && <div className="error">{error}</div>}
        <div className="form-group">
          <label className="form-label">Username</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Enter your username"
            required
            minLength={2}
            pattern="[a-zA-Z0-9_-]+"
            title="Only letters, numbers, dashes, and underscores are allowed"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Access Code</label>
          <input
            type="password"
            value={accessCode}
            onChange={e => setAccessCode(e.target.value)}
            placeholder="Enter access code"
            required
          />
        </div>
        <button type="submit" className="btn-primary" style={{ width: '100%' }}>
          Continue
        </button>
      </form>
    </main>
  )
}