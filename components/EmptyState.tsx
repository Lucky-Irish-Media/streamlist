import Link from 'next/link'
import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionText?: string
  actionHref?: string
}

export default function EmptyState({ icon: Icon, title, description, actionText, actionHref }: EmptyStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
      <div style={{ marginBottom: '16px' }}><Icon size={48} /></div>
      <h2 style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '8px' }}>{title}</h2>
      <p style={{ fontSize: '16px', marginBottom: '24px' }}>{description}</p>
      {actionText && actionHref && (
        <Link href={actionHref} style={{ 
          display: 'inline-block',
          padding: '8px 20px',
          backgroundColor: '#21262d',
          color: '#f0f6fc',
          border: '1px solid #30363d',
          borderRadius: '6px',
          textDecoration: 'none'
        }}>
          {actionText}
        </Link>
      )}
    </div>
  )
}
