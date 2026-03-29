'use client'

export const runtime = 'edge'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { useUser } from '@/components/UserContext'
import EmptyState from '@/components/EmptyState'
import MediaCard from '@/components/MediaCard'
import { SkeletonGrid } from '@/components/Skeleton'

interface Member {
  id: number
  userId: string
  username: string
  joinedAt: string
}

interface GroupData {
  group: {
    id: string
    name: string
    createdAt: string
    createdBy: string
  }
  members: Member[]
}

interface IntersectionItem {
  tmdbId: number
  mediaType: string
}

interface Recommendation {
  id: number
  title?: string
  name?: string
  overview: string
  poster_path: string | null
  vote_average: number
  release_date?: string
  first_air_date?: string
  mediaType: string
  image: string
}

type Tab = 'members' | 'watchlist' | 'vote'

export default function GroupPage() {
  const params = useParams()
  const groupId = params.id as string
  const { user } = useUser()
  const router = useRouter()
  const [groupData, setGroupData] = useState<GroupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('members')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [groupWatchlist, setGroupWatchlist] = useState<{
    intersection: IntersectionItem[]
    recommendations: Recommendation[]
  } | null>(null)
  const [watchlistLoading, setWatchlistLoading] = useState(false)
  const [intersectionItems, setIntersectionItems] = useState<Recommendation[]>([])
  const [recommendationItems, setRecommendationItems] = useState<Recommendation[]>([])
  const [pollData, setPollData] = useState<any>(null)
  const [pollLoading, setPollLoading] = useState(false)
  const [showCreatePollModal, setShowCreatePollModal] = useState(false)
  const [pollDate, setPollDate] = useState('')
  const [userRankings, setUserRankings] = useState<Record<number, number>>({})
  const [voting, setVoting] = useState(false)

  useEffect(() => {
    if (user) {
      fetchGroup()
    }
  }, [user, groupId])

  useEffect(() => {
    if (activeTab === 'watchlist' && !groupWatchlist) {
      fetchGroupWatchlist()
    }
    if (activeTab === 'vote' && !pollData) {
      fetchPoll()
    }
  }, [activeTab])

  const fetchGroup = async () => {
    const sessionId = localStorage.getItem('sessionId')
    const res = await fetch(`/api/groups/${groupId}`, {
      credentials: 'include',
      headers: sessionId ? { 'x-session-id': sessionId } : {}
    })
    if (res.ok) {
      const data = await res.json()
      setGroupData(data)
    } else {
      router.push('/groups')
    }
    setLoading(false)
  }

  const fetchGroupWatchlist = async () => {
    setWatchlistLoading(true)
    const sessionId = localStorage.getItem('sessionId')
    const res = await fetch(`/api/groups/${groupId}/watchlist`, {
      credentials: 'include',
      headers: sessionId ? { 'x-session-id': sessionId } : {}
    })
    const data = await res.json()
    setGroupWatchlist(data)

    if (data.intersection?.length > 0) {
      const results = await Promise.all(
        data.intersection.map(async (item: IntersectionItem) => {
          const res = await fetch(`/api/media?id=${item.tmdbId}&type=${item.mediaType}`)
          return res.json() as Promise<Recommendation>
        })
      )
      setIntersectionItems(results.filter(r => r && !r.error))
    }

    setRecommendationItems(data.recommendations || [])
    setWatchlistLoading(false)
  }

  const fetchPoll = async () => {
    setPollLoading(true)
    const sessionId = localStorage.getItem('sessionId')
    const res = await fetch(`/api/groups/${groupId}/poll`, {
      credentials: 'include',
      headers: sessionId ? { 'x-session-id': sessionId } : {}
    })
    const data = await res.json()
    setPollData(data)
    if (data.userVote) {
      const ranks: Record<number, number> = {}
      for (let r = 1; r <= 5; r++) {
        if (data.userVote[r]) {
          const item = data.poll?.candidates?.find((c: any) => 
            c.tmdbId === data.userVote[r].tmdbId && c.mediaType === data.userVote[r].mediaType
          )
          if (item) {
            ranks[item.tmdbId] = r
          }
        }
      }
      setUserRankings(ranks)
    }
    setPollLoading(false)
  }

  const createPoll = async () => {
    if (!pollDate) return
    setPollLoading(true)
    const sessionId = localStorage.getItem('sessionId')
    await fetch(`/api/groups/${groupId}/poll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionId ? { 'x-session-id': sessionId } : {})
      },
      credentials: 'include',
      body: JSON.stringify({ closedAt: pollDate })
    })
    setShowCreatePollModal(false)
    setPollDate('')
    fetchPoll()
  }

  const submitVote = async () => {
    if (Object.keys(userRankings).length !== 5) {
      alert('Please rank all 5 candidates')
      return
    }
    setVoting(true)
    const sessionId = localStorage.getItem('sessionId')
    const rankings: Record<string, { tmdbId: number; mediaType: string }> = {}
    for (const [tmdbId, rank] of Object.entries(userRankings)) {
      const candidate = pollData.poll.candidates.find((c: any) => c.tmdbId === Number(tmdbId))
      if (candidate) {
        rankings[rank] = { tmdbId: candidate.tmdbId, mediaType: candidate.mediaType }
      }
    }
    await fetch(`/api/groups/${groupId}/poll/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionId ? { 'x-session-id': sessionId } : {})
      },
      credentials: 'include',
      body: JSON.stringify({ rankings })
    })
    fetchPoll()
    setVoting(false)
  }

  const handleRankClick = (tmdbId: number) => {
    const newRankings = { ...userRankings }
    if (newRankings[tmdbId]) {
      delete newRankings[tmdbId]
    } else {
      const availableRank = [1, 2, 3, 4, 5].find(r => !Object.values(newRankings).includes(r))
      if (availableRank) {
        newRankings[tmdbId] = availableRank
      }
    }
    setUserRankings(newRankings)
  }

  const setRank = (tmdbId: number, rank: number) => {
    const newRankings = { ...userRankings }
    const existingWithRank = Object.entries(newRankings).find(([, r]) => r === rank)
    if (existingWithRank) {
      delete newRankings[Number(existingWithRank[0])]
    }
    if (rank === 0) {
      delete newRankings[tmdbId]
    } else {
      newRankings[tmdbId] = rank
    }
    setUserRankings(newRankings)
  }

  const generateInvite = async () => {
    const sessionId = localStorage.getItem('sessionId')
    const res = await fetch(`/api/groups/${groupId}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionId ? { 'x-session-id': sessionId } : {})
      },
      credentials: 'include'
    })
    const data = await res.json()
    if (data.inviteLink) {
      setInviteLink(data.inviteLink)
    }
  }

  const copyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(window.location.origin + inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const removeMember = async (memberId: number) => {
    const sessionId = localStorage.getItem('sessionId')
    await fetch(`/api/groups/${groupId}/members`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionId ? { 'x-session-id': sessionId } : {})
      },
      credentials: 'include',
      body: JSON.stringify({ memberId })
    })
    fetchGroup()
  }

  const deleteGroup = async () => {
    if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) return
    const sessionId = localStorage.getItem('sessionId')
    await fetch(`/api/groups/${groupId}`, {
      method: 'DELETE',
      headers: sessionId ? { 'x-session-id': sessionId } : {},
      credentials: 'include'
    })
    router.push('/groups')
  }

  if (!user) {
    return (
      <main className="container" style={{ paddingTop: '32px' }}>
        <EmptyState
          icon="🔐"
          title="Login Required"
          description="Please log in to view this group"
          actionText="Login"
          actionHref="/login"
        />
      </main>
    )
  }

  if (loading) {
    return (
      <main className="container" style={{ paddingTop: '32px' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
      </main>
    )
  }

  return (
    <main className="container" style={{ paddingTop: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/groups" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>← Back to Groups</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1>{groupData?.group.name}</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => { setShowInviteModal(true); generateInvite() }}
            style={{
              padding: '10px 20px',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Invite
          </button>
          <button
            onClick={deleteGroup}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Delete Group
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => setActiveTab('members')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'members' ? 'var(--bg-secondary)' : 'transparent',
            color: activeTab === 'members' ? 'var(--text-primary)' : 'var(--text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'members' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer'
          }}
        >
          Members
        </button>
        <button
          onClick={() => setActiveTab('watchlist')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'watchlist' ? 'var(--bg-secondary)' : 'transparent',
            color: activeTab === 'watchlist' ? 'var(--text-primary)' : 'var(--text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'watchlist' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer'
          }}
        >
          Watchlist
        </button>
        <button
          onClick={() => setActiveTab('vote')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'vote' ? 'var(--bg-secondary)' : 'transparent',
            color: activeTab === 'vote' ? 'var(--text-primary)' : 'var(--text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'vote' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer'
          }}
        >
          Vote
        </button>
      </div>

      {activeTab === 'members' && (
        <div>
          {groupData?.members.length === 0 ? (
            <EmptyState
              icon="👤"
              title="No Members"
              description="Invite members to this group"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {groupData?.members.map(member => (
                <div
                  key={member.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{member.username}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => removeMember(member.id)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'transparent',
                      color: '#dc3545',
                      border: '1px solid #dc3545',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'watchlist' && (
        <div>
          {watchlistLoading ? (
            <SkeletonGrid count={5} />
          ) : (
            <>
              <div style={{ marginBottom: '32px' }}>
                <h2 style={{ marginBottom: '16px' }}>Everyone's Watchlist ({intersectionItems.length})</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Items that all group members have on their watchlist
                </p>
                {intersectionItems.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)' }}>No items in common yet</p>
                ) : (
                  <div className="grid grid-5">
                    {intersectionItems.map(item => (
                      <MediaCard key={item.id} item={item as any} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h2 style={{ marginBottom: '16px' }}>Recommendations ({recommendationItems.length})</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Based on shared preferences (at least 50% of group members)
                </p>
                {recommendationItems.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)' }}>No recommendations yet. Add preferences to get group recommendations.</p>
                ) : (
                  <div className="grid grid-5">
                    {recommendationItems.map(item => (
                      <MediaCard key={item.id} item={item as any} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'vote' && (
        <div>
          {pollLoading ? (
            <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
          ) : !pollData?.poll || pollData.needsNewPoll ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <h2 style={{ marginBottom: '16px' }}>Start a New Poll</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Create a poll to decide what to watch next. The top 5 recommendations will be candidates.
              </p>
              <button
                onClick={() => {
                  const tomorrow = new Date()
                  tomorrow.setDate(tomorrow.getDate() + 7)
                  setPollDate(tomorrow.toISOString().split('T')[0])
                  setShowCreatePollModal(true)
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Create Poll
              </button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ marginBottom: '8px' }}>What's Next?</h2>
                  <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                    {pollData.totalVotes} vote{pollData.totalVotes !== 1 ? 's' : ''} · Closes {new Date(pollData.poll.closedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {pollData.poll.candidates?.map((candidate: any, index: number) => {
                  const myRank = userRankings[candidate.tmdbId]
                  return (
                    <div
                      key={candidate.tmdbId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '16px',
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        border: myRank ? '2px solid var(--accent)' : '1px solid var(--border)'
                      }}
                    >
                      <div style={{ 
                        minWidth: '80px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '4px',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontSize: '24px', fontWeight: 'bold', color: candidate.score > 0 ? 'var(--accent)' : 'var(--text-secondary)' }}>
                          {candidate.score}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>points</span>
                      </div>
                      
                      {candidate.image && (
                        <img 
                          src={candidate.image} 
                          alt={candidate.title}
                          style={{ width: '60px', height: '90px', objectFit: 'cover', borderRadius: '4px' }}
                        />
                      )}
                      
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{candidate.title}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {candidate.mediaType === 'movie' ? 'Movie' : 'TV Show'} · {candidate.releaseDate?.slice(0, 4) || 'N/A'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                        {[0, 1, 2, 3, 4, 5].map(rank => (
                          <button
                            key={rank}
                            onClick={() => setRank(candidate.tmdbId, rank)}
                            style={{
                              width: '32px',
                              height: '28px',
                              backgroundColor: myRank === rank ? 'var(--accent)' : 'var(--bg-tertiary)',
                              color: myRank === rank ? 'white' : 'var(--text-primary)',
                              border: '1px solid var(--border)',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: rank === 0 ? 'normal' : 'bold'
                            }}
                          >
                            {rank === 0 ? '✕' : `#${rank}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={submitVote}
                  disabled={voting || Object.keys(userRankings).length !== 5}
                  style={{
                    padding: '12px 32px',
                    backgroundColor: Object.keys(userRankings).length === 5 ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: Object.keys(userRankings).length === 5 ? 'pointer' : 'not-allowed',
                    fontSize: '16px',
                    opacity: voting ? 0.7 : 1
                  }}
                >
                  {voting ? 'Saving...' : Object.keys(userRankings).length === 5 ? 'Submit Vote' : 'Rank all 5 to vote'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {showInviteModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowInviteModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              padding: '24px',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '500px'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Invite Members</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Share this link with friends to invite them to the group
            </p>
            {inviteLink ? (
              <>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <input
                    type="text"
                    readOnly
                    value={window.location.origin + inviteLink}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontSize: '14px'
                    }}
                  />
                  <button
                    onClick={copyInviteLink}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: 'var(--accent)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  This link expires in 7 days
                </p>
              </>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>Generating invite link...</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => { setShowInviteModal(false); setInviteLink(null) }}
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {showCreatePollModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowCreatePollModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              padding: '24px',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '400px'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Create Poll</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Select the watch date. After this date, voting will close and a winner will be chosen.
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                Watch Date
              </label>
              <input
                type="date"
                value={pollDate}
                onChange={e => setPollDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: '16px'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowCreatePollModal(false); setPollDate('') }}
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={createPoll}
                disabled={!pollDate}
                style={{
                  padding: '10px 16px',
                  backgroundColor: pollDate ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: pollDate ? 'pointer' : 'not-allowed'
                }}
              >
                Create Poll
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
