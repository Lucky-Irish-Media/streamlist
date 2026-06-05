'use client'

import { UserProvider, Header } from '@/components/UserContext'
import Footer from '@/components/Footer'
import { usePathname } from 'next/navigation'
import { useEffect, useState, createContext, useContext } from 'react'
import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'StreamList - Your Personal Watchlist',
  description: 'Discover and track movies and TV shows from your favorite streaming services',
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <>{children}</>
  }

  const isLogin = pathname === '/login'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {!isLogin && <Header />}
      <main style={{ flex: 1 }}>{children}</main>
      {!isLogin && <Footer />}
    </div>
  )
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UserProvider>
      <LayoutContent>{children}</LayoutContent>
    </UserProvider>
  )
}