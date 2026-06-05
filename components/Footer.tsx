'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Sparkles, HelpCircle, MessageSquare } from 'lucide-react'

const LS_KEY = 'streamlist_last_commit_visit'

interface CommitData {
  commits: { date: string }[]
  latestTimestamp: string | null
}

export default function Footer() {
  const [hasNew, setHasNew] = useState(false)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/changelog.json')
        const data = (await res.json()) as CommitData
        if (data.latestTimestamp) {
          const lastVisit = localStorage.getItem(LS_KEY)
          if (lastVisit !== data.latestTimestamp) {
            setHasNew(true)
          }
        }
      } catch {
        // changelog.json may not exist during development
      }
    }
    check()
  }, [])

  const handleWhatsNewClick = () => {
    fetch('/changelog.json')
      .then((res) => res.json() as Promise<CommitData>)
      .then((data) => {
        if (data.latestTimestamp) {
          localStorage.setItem(LS_KEY, data.latestTimestamp)
        }
      })
      .catch(() => {})
    setHasNew(false)
  }

  return (
    <footer
      className="desktop-only"
      style={{
        width: '100%',
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        padding: '16px 0',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '32px',
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/whats-new"
            onClick={handleWhatsNewClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)',
              fontSize: '14px',
              position: 'relative',
            }}
          >
            <Sparkles size={16} />
            What&apos;s New
            {hasNew && (
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'inline-block',
                }}
              />
            )}
          </Link>
          <Link
            href="/getting-started"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)',
              fontSize: '14px',
            }}
          >
            <HelpCircle size={16} />
            Getting Started
          </Link>
          <Link
            href="/feedback"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)',
              fontSize: '14px',
            }}
          >
            <MessageSquare size={16} />
            Feedback
          </Link>
        </div>
        <a
          href="https://github.com/Lucky-Irish-Media/streamlist"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--text-secondary)',
            fontSize: '13px',
          }}
        >
          GitHub
        </a>
      </div>
    </footer>
  )
}
