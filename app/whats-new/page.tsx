import Link from 'next/link'
import changelogData from '@/data/changelog.json'
import { Sparkles, GitCommit } from 'lucide-react'

const GITHUB_URL = 'https://github.com/Lucky-Irish-Media/streamlist'

interface ChangelogEntry {
  hash: string
  shortHash: string
  message: string
  date: string
  author: string
}

interface ChangelogData {
  commits: ChangelogEntry[]
  generatedAt: string
  latestTimestamp: string | null
}

const data = changelogData as ChangelogData

export default function WhatsNewPage() {
  return (
    <main className="container page-content">
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <Sparkles size={36} color="var(--accent)" style={{ marginBottom: '12px' }} />
          <h1 style={{ fontSize: '32px', marginBottom: '12px' }}>What&apos;s New</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
            Recent changes and updates to StreamList
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {data.commits.map((commit) => (
            <div
              key={commit.hash}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '20px 24px',
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'var(--accent)',
                color: 'var(--bg-primary)',
                flexShrink: 0,
              }}>
                <GitCommit size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '15px',
                  lineHeight: '1.5',
                  marginBottom: '8px',
                  color: 'var(--text-primary)',
                  wordBreak: 'break-word',
                }}>
                  {commit.message}
                </p>
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  flexWrap: 'wrap',
                }}>
                  <span>{commit.author}</span>
                  <span>
                    {new Date(commit.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <a
                    href={`${GITHUB_URL}/commit/${commit.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--accent)',
                      textDecoration: 'none',
                      fontFamily: 'monospace',
                    }}
                  >
                    {commit.shortHash}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '48px', padding: '24px', borderTop: '1px solid var(--border)' }}>
          <Link href="/getting-started" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-block' }}>
            View Getting Started Guide
          </Link>
        </div>
      </div>
    </main>
  )
}
