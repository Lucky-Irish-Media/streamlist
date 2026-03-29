'use client'

import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="error-boundary">
      <div className="error-boundary-content">
        <h2>Something went wrong</h2>
        <p>{error.message || 'An unexpected error occurred'}</p>
        {error.digest && <p className="error-digest">Error ID: {error.digest}</p>}
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
      </div>
    </div>
  )
}
