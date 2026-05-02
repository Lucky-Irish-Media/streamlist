'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, List, Heart, Users, HelpCircle, Play } from 'lucide-react'

const TUTORIAL_SECTIONS = [
  {
    icon: Search,
    title: 'Search',
    description: 'Use the browse page to search for movies and TV shows. Filter by genre, rating, and streaming service to find exactly what you want to watch.',
    link: '/browse',
    linkText: 'Go to Browse',
  },
  {
    icon: List,
    title: 'Watchlist',
    description: 'Add shows and movies to your watchlist to keep track of what you want to watch. Mark items as watched when you\'re done.',
    link: '/watchlist',
    linkText: 'View Watchlist',
  },
  {
    icon: Heart,
    title: 'Favorites',
    description: 'Like movies and shows you enjoy. This helps us give you better recommendations tailored to your taste.',
    link: '/preferences',
    linkText: 'Update Preferences',
  },
  {
    icon: Play,
    title: 'Media Details',
    description: 'Click any movie or show card to open the detail modal. View trailers, cast info, and streaming providers. Add notes, mark as watched, or add to your watchlist directly from the modal.',
    link: '/browse',
    linkText: 'Try it Now',
  },
  {
    icon: Users,
    title: 'Watch Groups',
    description: 'Create watch groups with friends, vote on what to watch next, and see what others are watching.',
    link: '/groups',
    linkText: 'Explore Groups',
  },
]

export default function GettingStartedPage() {
  const [hideTutorial, setHideTutorial] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('streamlist_hide_getting_started')
    if (stored === 'true') {
      setHideTutorial(true)
    }
  }, [])

  const dismissTutorial = () => {
    localStorage.setItem('streamlist_hide_getting_started', 'true')
    setHideTutorial(true)
  }

  if (hideTutorial) {
    return (
      <main className="container page-content" style={{ textAlign: 'center', paddingTop: '100px' }}>
        <HelpCircle size={48} color="var(--text-secondary)" style={{ marginBottom: '16px' }} />
        <h1 style={{ marginBottom: '16px' }}>Tutorial Hidden</h1>
        <p className="empty-message" style={{ marginBottom: '24px' }}>
          The getting started guide has been dismissed. You can access it anytime from the help icon in the header.
        </p>
        <button onClick={() => { setHideTutorial(false); localStorage.removeItem('streamlist_hide_getting_started') }} className="btn-primary">
          Show Tutorial
        </button>
      </main>
    )
  }

  return (
    <main className="container page-content">
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{ fontSize: '32px', marginBottom: '12px' }}>Getting Started</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
            Welcome to StreamList! Here's a quick guide to help you get the most out of your experience.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', marginBottom: '48px' }}>
          {TUTORIAL_SECTIONS.map((section, index) => (
            <div key={section.title} style={{
              display: 'flex',
              gap: '24px',
              padding: '24px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              alignItems: 'flex-start',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'var(--accent)',
                color: 'var(--bg-primary)',
                flexShrink: 0,
              }}>
                <section.icon size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>{section.title}</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.6' }}>
                  {section.description}
                </p>
                <Link href={section.link} className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                  {section.linkText}
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', padding: '24px', borderTop: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
            You can always access this guide from the help icon (?) in the header.
          </p>
          <button onClick={dismissTutorial} className="btn-secondary" style={{ padding: '10px 24px' }}>
            Got it — don't show again
          </button>
        </div>
      </div>
    </main>
  )
}
