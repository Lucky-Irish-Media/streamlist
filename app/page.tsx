'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@/components/UserContext'
import MediaCard from '@/components/MediaCard'

function HomeContent() {
  const { user } = useUser()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    console.log('HomeContent user:', user)
    if (user) {
      console.log('Fetching recommendations')
      const sessionId = localStorage.getItem('sessionId')
      fetch('/api/recommendations', {
        headers: sessionId ? { 'x-session-id': sessionId } : {}
      })
        .then(res => res.json())
        .then(data => {
          console.log('recommendations data:', data)
          setData(data)
        })
        .finally(() => setLoading(false))
    } else {
      console.log('No user, not fetching recommendations')
      setLoading(false)
    }
  }, [user])

  if (!user) {
    return (
      <div className="hero">
        <h1>Your Personal Watchlist</h1>
        <p>Discover movies and TV shows from your favorite streaming services</p>
        <Link href="/login" className="btn-primary" style={{ padding: '12px 32px', fontSize: '18px' }}>
          Get Started
        </Link>
      </div>
    )
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <>
      {data?.recommendations?.length > 0 && (
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Recommended for You</h2>
          </div>
          <div className="grid grid-5">
            {data.recommendations.slice(0, 10).map((item: any) => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Trending This Week</h2>
          <Link href="/browse?tab=trending" className="btn-secondary">View All</Link>
        </div>
        <div className="grid grid-5">
          {data?.trending?.slice(0, 5).map((item: any) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Popular Movies</h2>
          <Link href="/browse?tab=movies" className="btn-secondary">View All</Link>
        </div>
        <div className="grid grid-5">
          {data?.movies?.slice(0, 5).map((item: any) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Popular TV Shows</h2>
          <Link href="/browse?tab=tv" className="btn-secondary">View All</Link>
        </div>
        <div className="grid grid-5">
          {data?.tv?.slice(0, 5).map((item: any) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">New Releases - Movies</h2>
        </div>
        <div className="grid grid-5">
          {data?.newReleases?.movies?.slice(0, 5).map((item: any) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">New Releases - TV Shows</h2>
        </div>
        <div className="grid grid-5">
          {data?.newReleases?.tv?.slice(0, 5).map((item: any) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </>
  )
}

export default function Home() {
  return (
    <main className="container" style={{ paddingTop: '32px' }}>
      <HomeContent />
    </main>
  )
}