'use client'

import { UserProvider, Header } from '@/components/UserContext'
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

  return (
    <>
      {pathname !== '/login' && <Header />}
      {children}
    </>
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