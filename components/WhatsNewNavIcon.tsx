'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'

const LS_KEY = 'streamlist_last_commit_visit'

interface CommitData {
  commits: { date: string }[]
  latestTimestamp: string | null
}

export default function WhatsNewNavIcon() {
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

  const handleClick = () => {
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
    <Link
      href="/whats-new"
      onClick={handleClick}
      title="What's New"
      style={{ display: 'flex', alignItems: 'center', position: 'relative' }}
    >
      <Sparkles size={18} />
      {hasNew && (
        <span
          style={{
            position: 'absolute',
            top: '-2px',
            right: '-4px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--accent)',
          }}
        />
      )}
    </Link>
  )
}
