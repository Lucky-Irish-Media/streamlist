export interface PollVote {
  userId: string
  rankings: Record<string, { tmdbId: number; mediaType: string }>
}

export interface BroadcastMessage {
  type: 'vote_update' | 'poll_closed' | 'initial_state'
  pollId: string
  results?: Array<{ tmdbId: number; mediaType: string; score: number }>
  totalVotes?: number
}

export class PollDurableObject {
  private state: DurableObjectState
  private votes: Map<string, PollVote> = new Map()
  private pollId: string = ''
  private groupId: string = ''
  private status: 'active' | 'closed' = 'active'
  private closedAt: number = 0
  private clients: Set<WebSocket> = new Set()

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.state.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS votes (
        user_id TEXT PRIMARY KEY,
        rankings TEXT NOT NULL
      )
    `)
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request)
    }

    if (request.method === 'GET') {
      return this.getState()
    }

    if (request.method === 'POST') {
      const body = await request.json() as Record<string, unknown>
      if (body.type === 'vote') {
        return this.recordVote(body as { userId: string; rankings: Record<string, { tmdbId: number; mediaType: string }> })
      }
      if (body.type === 'init') {
        this.pollId = body.pollId as string
        this.groupId = body.groupId as string
        this.status = (body.status as 'active' | 'closed') || 'active'
        this.closedAt = (body.closedAt as number) || 0
        return new Response(JSON.stringify({ success: true }))
      }
    }

    return new Response('Not found', { status: 404 })
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]

    server.accept()
    this.clients.add(server)

    server.addEventListener('close', () => {
      this.clients.delete(server)
    })

    server.addEventListener('message', (event: MessageEvent) => {
      this.handleMessage(server, event.data as string)
    })

    const initialState = this.getStateMessage()
    server.send(JSON.stringify(initialState))

    return new Response(null, {
      status: 101,
      webSocket: client,
    } as ResponseInit)
  }

  private handleMessage(ws: WebSocket, message: string) {
    try {
      const data = JSON.parse(message)
      if (data.type === 'vote') {
        this.recordVoteAndBroadcast(data)
      } else if (data.type === 'close') {
        this.closePoll()
      }
    } catch {
    }
  }

  private recordVote(data: { userId: string; rankings: Record<string, { tmdbId: number; mediaType: string }> }): Response {
    this.votes.set(data.userId, {
      userId: data.userId,
      rankings: data.rankings,
    })

    this.state.storage.sql.exec(
      `INSERT OR REPLACE INTO votes (user_id, rankings) VALUES (?, ?)`,
      data.userId,
      JSON.stringify(data.rankings)
    )

    return new Response(JSON.stringify({ success: true, totalVotes: this.votes.size }))
  }

  private recordVoteAndBroadcast(data: { userId: string; rankings: Record<string, { tmdbId: number; mediaType: string }> }) {
    this.votes.set(data.userId, {
      userId: data.userId,
      rankings: data.rankings,
    })
    this.broadcast()
  }

  private closePoll() {
    this.status = 'closed'
    const broadcast: BroadcastMessage = {
      type: 'poll_closed',
      pollId: this.pollId,
    }
    this.broadcastToClients(JSON.stringify(broadcast))
  }

  private getState(): Response {
    const results = this.calculateResults()
    return new Response(JSON.stringify({
      pollId: this.pollId,
      groupId: this.groupId,
      status: this.status,
      votes: Object.fromEntries(this.votes),
      totalVotes: this.votes.size,
      results,
    }))
  }

  private getStateMessage(): BroadcastMessage {
    return {
      type: 'initial_state',
      pollId: this.pollId,
      results: this.calculateResults(),
      totalVotes: this.votes.size,
    }
  }

  private calculateResults(): Array<{ tmdbId: number; mediaType: string; score: number }> {
    const scoreMap = new Map<string, number>()

    this.votes.forEach((vote) => {
      Object.entries(vote.rankings).forEach(([rank, candidate]) => {
        const key = `${candidate.tmdbId}-${candidate.mediaType}`
        const points = 6 - parseInt(rank)
        scoreMap.set(key, (scoreMap.get(key) || 0) + points)
      })
    })

    return Array.from(scoreMap.entries())
      .map(([key, score]) => {
        const [tmdbId, mediaType] = key.split('-')
        return {
          tmdbId: parseInt(tmdbId),
          mediaType,
          score,
        }
      })
      .sort((a, b) => b.score - a.score)
  }

  private broadcast() {
    const broadcast: BroadcastMessage = {
      type: 'vote_update',
      pollId: this.pollId,
      results: this.calculateResults(),
      totalVotes: this.votes.size,
    }
    this.broadcastToClients(JSON.stringify(broadcast))
  }

  private broadcastToClients(message: string) {
    this.clients.forEach((client) => {
      try {
        client.send(message)
      } catch {
        this.clients.delete(client)
      }
    })
  }
}

interface Env {
  DB: any
  TMDB_CACHE: any
  POLL_DO: DurableObjectNamespace<any>
}
