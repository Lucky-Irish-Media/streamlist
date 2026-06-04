'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Users, Key, BarChart3, Shield, LogOut, Menu, X, Activity, Wrench, ScrollText } from 'lucide-react'
import { useIsMobile } from '@/lib/useIsMobile'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        const data = await res.json() as { user?: { isAdmin: boolean } }
        if (!data.user?.isAdmin) {
          router.push('/')
        } else {
          setLoading(false)
        }
      } catch {
        router.push('/')
      }
    }
    checkAdmin()
  }, [router])

  const navItems = [
    { href: '/admin', icon: BarChart3, label: 'Dashboard' },
    { href: '/admin/users', icon: Users, label: 'Users' },
    { href: '/admin/sessions', icon: Activity, label: 'Sessions' },
    { href: '/admin/access-codes', icon: Key, label: 'Access Codes' },
    { href: '/admin/audit', icon: ScrollText, label: 'Audit Log' },
    { href: '/admin/maintenance', icon: Wrench, label: 'Maintenance' },
  ]

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/')
  }

  const isMobile = useIsMobile()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  const sidebar = (
    <aside style={{
      width: isMobile ? '100%' : '240px',
      backgroundColor: 'var(--bg-secondary)',
      borderRight: isMobile ? 'none' : '1px solid var(--border)',
      padding: '24px 0',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: '0 24px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={24} style={{ color: 'var(--accent)' }} />
          <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Admin</h1>
        </div>
        {isMobile && (
          <button
            onClick={() => setMobileMenuOpen(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={24} />
          </button>
        )}
      </div>

      <nav style={{ flex: 1 }}>
        {navItems.map(item => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 24px',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--bg-tertiary)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                textDecoration: 'none',
              }}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '0 24px' }}>
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            width: '100%',
            backgroundColor: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <LogOut size={20} />
          Logout
        </button>
      </div>
    </aside>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: isMobile ? 'column' : 'row' }}>
      {isMobile ? (
        <>
          <header style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={20} style={{ color: 'var(--accent)' }} />
              <h1 style={{ fontSize: '16px', fontWeight: 600 }}>Admin</h1>
            </div>
            <button
              onClick={() => setMobileMenuOpen(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <Menu size={24} />
            </button>
          </header>

          {mobileMenuOpen && (
            <div style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 200,
            }} onClick={() => setMobileMenuOpen(false)}>
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: '280px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRight: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {sidebar}
              </div>
            </div>
          )}

          <main style={{ flex: 1, padding: '16px', overflow: 'auto', paddingBottom: '80px' }}>
            {children}
          </main>

          <nav style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: '8px 0',
            paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
            zIndex: 150,
          }}>
            {navItems.map(item => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    textDecoration: 'none',
                    fontSize: '11px',
                    padding: '4px 12px',
                  }}
                >
                  <item.icon size={20} />
                  {item.label}
                </Link>
              )
            })}
            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                padding: '4px 12px',
                cursor: 'pointer',
              }}
            >
              <LogOut size={20} />
              Logout
            </button>
          </nav>
        </>
      ) : (
        <>
          {sidebar}
          <main style={{ flex: 1, padding: '32px', overflow: 'auto' }}>
            {children}
          </main>
        </>
      )}
    </div>
  )
}
