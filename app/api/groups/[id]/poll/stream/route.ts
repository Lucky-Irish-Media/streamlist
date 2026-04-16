import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth'
import { parseAuthCookie } from '@/lib/auth'

export const runtime = 'edge'

async function getAuthenticatedUser(req: Request, env: { DB?: any }) {
  let sessionId = parseAuthCookie(req.headers.get('cookie') || '')
  if (!sessionId) {
    sessionId = req.headers.get('x-session-id') || ''
  }
  if (!sessionId) return null
  return getSessionUser(env, sessionId)
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params
  const { env } = getRequestContext()
  const dbEnv = { DB: (env as any)?.DB }

  const userId = await getAuthenticatedUser(req, dbEnv)
  if (!userId) {
    return new Response('Not authenticated', { status: 401 })
  }

  const { getDB, schema } = await import('@/lib/db')
  const db = getDB(dbEnv)
  const { eq, and, desc } = await import('drizzle-orm')

  const membership = await db
    .select()
    .from(schema.userGroupMembers)
    .where(and(eq(schema.userGroupMembers.groupId, groupId), eq(schema.userGroupMembers.userId, userId)))
    .get()

  if (!membership) {
    return new Response('Not a member of this group', { status: 403 })
  }

  const poll = await db
    .select()
    .from(schema.groupPolls)
    .where(eq(schema.groupPolls.groupId, groupId))
    .orderBy(desc(schema.groupPolls.createdAt))
    .limit(1)
    .get()

  if (!poll) {
    return new Response('No active poll', { status: 404 })
  }

  const url = new URL(req.url)
  const pollId = poll.id

  let doId = await (env as any).POLL_KV?.get(`poll:${pollId}`)
  if (!doId) {
    const stub = await (env as any).POLL_DO.idFromName(`poll-${pollId}`)
    doId = stub.toString()
    await (env as any).POLL_KV?.put(`poll:${pollId}`, doId)
  }

  const doStub = (env as any).POLL_DO.get((env as any).POLL_DO.idFromName(`poll-${pollId}`))

  const pollResponse = await doStub.fetch(new Request(`http://localhost/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'init',
      pollId: poll.id,
      groupId,
      status: poll.status,
      closedAt: poll.closedAt.getTime(),
    }),
  }))

  const upgradeHeader = req.headers.get('Upgrade')
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 })
  }

  const { 0: client, 1: server } = new WebSocketPair()

  server.accept()

  const doWsResponse = await doStub.fetch(new Request(`http://localhost/ws`, {
    headers: { Upgrade: 'websocket' },
  }))

  if (doWsResponse.status !== 101) {
    server.close(1011, 'DO connection failed')
    return new Response(null, { status: 101, webSocket: client } as ResponseInit)
  }

  const doWs = doWsResponse.webSocket
  if (!doWs) {
    server.close(1011, 'No DO WebSocket')
    return new Response(null, { status: 101, webSocket: client } as ResponseInit)
  }

  server.addEventListener('message', (event: MessageEvent) => {
    try {
      doWs.send(event.data as string)
    } catch {
      server.close()
    }
  })

  server.addEventListener('close', () => {
    doWs.close()
  })

  doWs.addEventListener('message', (event: MessageEvent) => {
    try {
      server.send(event.data as string)
    } catch {
      doWs.close()
    }
  })

  doWs.addEventListener('close', () => {
    server.close()
  })

  return new Response(null, { status: 101, webSocket: client } as ResponseInit)
}
