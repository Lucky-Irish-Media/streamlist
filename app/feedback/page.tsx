'use client'

import { useEffect, useState } from 'react'
import { MessageSquare, Send, AlertCircle, CheckCircle, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { useIsMobile } from '@/lib/useIsMobile'

interface FeedbackItem {
  id: string
  type: string
  title: string
  description: string
  status: string
  createdAt: string
}

export default function FeedbackPage() {
  const [type, setType] = useState<'feature' | 'bug' | 'other'>('feature')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null)
  const [previousFeedback, setPreviousFeedback] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()

  const fetchPrevious = async () => {
    try {
      const res = await fetch('/api/feedback', { credentials: 'include' })
      const data = await res.json() as { feedback?: FeedbackItem[]; error?: string }
      if (data.feedback) {
        setPreviousFeedback(data.feedback)
      }
    } catch (e) {
      console.error('Failed to fetch feedback', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrevious()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitResult(null)

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, title, description }),
      })

      const data = await res.json() as { success?: boolean; error?: string; id?: string }

      if (data.success) {
        setSubmitResult({ success: true, message: 'Feedback submitted successfully!' })
        setTitle('')
        setDescription('')
        setType('feature')
        fetchPrevious()
      } else {
        setSubmitResult({ success: false, message: data.error || 'Failed to submit feedback' })
      }
    } catch {
      setSubmitResult({ success: false, message: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      open: { bg: '#3b82f6', color: 'white' },
      acknowledged: { bg: '#8b5cf6', color: 'white' },
      planned: { bg: '#f59e0b', color: 'white' },
      completed: { bg: '#22c55e', color: 'white' },
      declined: { bg: '#ef4444', color: 'white' },
    }
    const c = colors[status] || { bg: 'var(--bg-tertiary)', color: 'var(--text-primary)' }
    return (
      <span style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 500,
        backgroundColor: c.bg,
        color: c.color,
      }}>
        {status}
      </span>
    )
  }

  const typeBadge = (t: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      feature: { bg: '#22c55e', color: 'white' },
      bug: { bg: '#ef4444', color: 'white' },
      other: { bg: '#8b5cf6', color: 'white' },
    }
    const c = colors[t] || { bg: 'var(--bg-tertiary)', color: 'var(--text-primary)' }
    return (
      <span style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 500,
        backgroundColor: c.bg,
        color: c.color,
      }}>
        {t}
      </span>
    )
  }

  const descriptionMaxLength = 2000

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: isMobile ? '16px' : '32px' }}>
      <Link
        href="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          marginBottom: '24px',
          fontSize: '14px',
        }}
      >
        <ChevronLeft size={16} />
        Back to Home
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <MessageSquare size={28} style={{ color: 'var(--accent)' }} />
        <h1 style={{ fontSize: '24px', fontWeight: 600 }}>Feedback</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '32px',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Submit Feedback</h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-secondary)' }}>
            Type
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['feature', 'bug', 'other'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: `2px solid ${type === t ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '6px',
                  backgroundColor: type === t ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: type === t ? 'white' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontWeight: type === t ? 600 : 400,
                  fontSize: '14px',
                  textTransform: 'capitalize',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="feedback-title"
            style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-secondary)' }}
          >
            Title
          </label>
          <input
            id="feedback-title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Brief summary of your feedback"
            maxLength={200}
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="feedback-description"
            style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-secondary)' }}
          >
            Description
          </label>
          <textarea
            id="feedback-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe your feedback in detail..."
            maxLength={descriptionMaxLength}
            required
            rows={5}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {description.length}/{descriptionMaxLength}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !title.trim() || !description.trim()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '12px',
            backgroundColor: submitting ? 'var(--bg-tertiary)' : 'var(--accent)',
            border: 'none',
            borderRadius: '6px',
            color: submitting ? 'var(--text-secondary)' : 'white',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          <Send size={16} />
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </button>

        {submitResult && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '12px',
            padding: '10px',
            borderRadius: '6px',
            backgroundColor: submitResult.success ? '#22c55e20' : '#ef444420',
            color: submitResult.success ? '#22c55e' : '#ef4444',
            fontSize: '14px',
          }}>
            {submitResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {submitResult.message}
          </div>
        )}
      </form>

      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Your Previous Feedback</h2>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        ) : previousFeedback.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No feedback submitted yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {previousFeedback.map(item => (
              <div
                key={item.id}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {typeBadge(item.type)}
                    {statusBadge(item.status)}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>{item.title}</p>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{item.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
