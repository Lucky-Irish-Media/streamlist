'use client'

import { useState, useEffect } from 'react'

const CURRENT_VERSION = '1.10.0'

const CHANGELOG = [
  {
    version: '1.10.0',
    date: '2026-06-18',
    items: [
      'Streaming service chips in the detail modal now link to the TMDB watch page for the show or movie',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-06-18',
    items: [
      'Table view rows now clickable to open the media detail modal',
      'Standalone detail modal component for use from table and card views',
      'Infinite scroll on Home and Watchlist pages for better browsing',
      'Eliminated redundant API calls on the Watchlist page',
      'Added database indexes for improved query performance',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-06-07',
    items: [
      'Browse: replaced the "Streamable Now" toggle with per-service streaming service filter',
      'Watchlist: added streaming service filter to find items available on your subscriptions',
      'Watchlist items now show which streaming services they\'re available on',
      'General layout improvements on the Browse page',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-06-04',
    items: [
      'New Feedback page for submitting suggestions and bug reports',
      'Admin panel for reviewing and managing user feedback',
      'Footer navigation with links to What\'s New, Getting Started, and Feedback',
      'What\'s New, Help, and Feedback moved from header/mobile nav to footer',
      'Admin tools: session management, audit log, maintenance, access codes',
      'Full-page What\'s New changelog with commit history and GitHub links',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-06-04',
    items: [
      'Dedicated What\'s New page with recent git commits and links to GitHub',
      'Sparkle icon in header with unread indicator for new changes',
      'Logout button removed from desktop nav (available in Profile)',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-06-02',
    items: [
      'Toggle between card grid and table view on Home, Browse, and Watchlist pages',
      'Sortable table columns with poster thumbnails, rating, year, and certification',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-05-30',
    items: [
      'StreamList is now installable as a PWA with app icons and manifest',
      'Install button in header on mobile for Add to Home Screen',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-05-27',
    items: [
      'Modal header buttons now stay visible at the top when scrolling through content',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-05-26',
    items: [
      'Redesigned search with inline icon button on Home and Browse pages',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-05-25',
    items: [
      'StreamableNow filter enabled by default in Browse',
      'Dismiss recommendations from Browse grid',
      'Fixed details modal showing wrong content for TV shows in streamable view',
      'Improved watchlist loading with animated film reel',
      'Optimized data fetching to wait for user session before loading',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-05-02',
    items: [
      'Initial release of StreamList',
      'Watchlist management for movies and TV shows',
      'Browse trending and popular media from TMDB',
      'User preferences and recommendations',
      'Group support for sharing watchlists',
    ],
  },
]

export default function WhatsNewChangelog() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const lastSeen = localStorage.getItem('streamlist_last_seen_version')
    if (lastSeen !== CURRENT_VERSION) {
      setShow(true)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem('streamlist_last_seen_version', CURRENT_VERSION)
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="modal-overlay" onClick={dismiss}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">What's New</h2>
          <button onClick={dismiss} className="close-btn">
            ×
          </button>
        </div>
        <div style={{ marginTop: '16px' }}>
          {CHANGELOG.filter((entry) => entry.version === CURRENT_VERSION)
            .map((entry) => (
              <div key={entry.version} style={{ marginBottom: '24px' }}>
                <h3 style={{
                  color: 'var(--text-primary)',
                  fontSize: '18px',
                  marginBottom: '8px',
                }}>
                  Version {entry.version} - {entry.date}
                </h3>
                <ul style={{
                  color: 'var(--text-secondary)',
                  paddingLeft: '20px',
                  lineHeight: '1.6',
                }}>
                  {entry.items.map((item, i) => (
                    <li key={i} style={{ marginBottom: '6px' }}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
        <button onClick={dismiss} style={{
          marginTop: '16px',
          padding: '8px 16px',
          background: 'var(--accent)',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
        }}>
          Got it
        </button>
      </div>
    </div>
  )
}
