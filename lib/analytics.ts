type AnalyticsEngine = any

export async function writeLoginEvent(
  env: { ANALYTICS?: AnalyticsEngine },
  username: string,
  success: boolean
): Promise<void> {
  if (!env.ANALYTICS) return

  try {
    await env.ANALYTICS.writeDataPoint({
      blobs: [username, success ? 'success' : 'failure'],
      doubles: [success ? 1 : 0],
    })
  } catch (e) {
    console.error('Failed to write login event to analytics', e)
  }
}

export async function writeLogoutEvent(
  env: { ANALYTICS?: AnalyticsEngine },
  userId: string
): Promise<void> {
  if (!env.ANALYTICS) return

  try {
    await env.ANALYTICS.writeDataPoint({
      blobs: [userId],
      doubles: [1],
    })
  } catch (e) {
    console.error('Failed to write logout event to analytics', e)
  }
}

export async function writeApiKeyUseEvent(
  env: { ANALYTICS?: AnalyticsEngine },
  userId: string,
  endpoint: string
): Promise<void> {
  if (!env.ANALYTICS) return

  try {
    await env.ANALYTICS.writeDataPoint({
      blobs: [userId, endpoint],
      doubles: [1],
    })
  } catch (e) {
    console.error('Failed to write api_key_use event to analytics', e)
  }
}

export async function writeVoteEvent(
  env: { ANALYTICS?: AnalyticsEngine },
  userId: string,
  groupId: string,
  pollId: string
): Promise<void> {
  if (!env.ANALYTICS) return

  try {
    await env.ANALYTICS.writeDataPoint({
      blobs: [userId, groupId, pollId],
      doubles: [1],
    })
  } catch (e) {
    console.error('Failed to write vote event to analytics', e)
  }
}

export async function writeWatchlistAddEvent(
  env: { ANALYTICS?: AnalyticsEngine },
  userId: string,
  mediaId: number
): Promise<void> {
  if (!env.ANALYTICS) return

  try {
    await env.ANALYTICS.writeDataPoint({
      blobs: [userId, String(mediaId)],
      doubles: [1],
    })
  } catch (e) {
    console.error('Failed to write watchlist_add event to analytics', e)
  }
}

export async function writeGroupCreateEvent(
  env: { ANALYTICS?: AnalyticsEngine },
  userId: string,
  groupId: string
): Promise<void> {
  if (!env.ANALYTICS) return

  try {
    await env.ANALYTICS.writeDataPoint({
      blobs: [userId, groupId],
      doubles: [1],
    })
  } catch (e) {
    console.error('Failed to write group_create event to analytics', e)
  }
}

export async function writeMcpRequestEvent(
  env: { ANALYTICS?: AnalyticsEngine },
  userId: string,
  tool: string
): Promise<void> {
  if (!env.ANALYTICS) return

  try {
    await env.ANALYTICS.writeDataPoint({
      blobs: [userId, tool],
      doubles: [1],
    })
  } catch (e) {
    console.error('Failed to write mcp_request event to analytics', e)
  }
}

export async function queryLoginStats(
  env: { ANALYTICS?: AnalyticsEngine; CF_API_TOKEN?: string; ANALYTICS_DATASET?: string },
  days = 30
): Promise<{ totalLogins: number; uniqueUsers: number; failedAttempts: number; failureRate: number }> {
  const apiToken = env.CF_API_TOKEN
  if (!apiToken) {
    return { totalLogins: 0, uniqueUsers: 0, failedAttempts: 0, failureRate: 0 }
  }

  const dataset = env.ANALYTICS_DATASET || 'streamlist_preview_events'
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const sql = `
    SELECT 
      blob2 AS status,
      SUM(_sample_interval) AS count
    FROM ${dataset}
    WHERE timestamp >= '${since}'
    GROUP BY blob2
  `

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/analytics_engine/sql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ sql }),
      }
    )

    if (!response.ok) {
      console.error('SQL API error:', await response.text())
      return { totalLogins: 0, uniqueUsers: 0, failedAttempts: 0, failureRate: 0 }
    }

    const result = await response.json() as any

    let totalLogins = 0
    let failedAttempts = 0

    if (result?.data) {
      for (const row of result.data) {
        const status = row[0]
        const count = row[1]
        if (status === 'success') {
          totalLogins = count
        } else if (status === 'failure') {
          failedAttempts = count
        }
      }
    }

    const totalAttempts = totalLogins + failedAttempts
    const failureRate = totalAttempts > 0 ? failedAttempts / totalAttempts : 0

    return { totalLogins, uniqueUsers: 0, failedAttempts, failureRate }
  } catch (e) {
    console.error('Failed to query login stats from analytics', e)
    return { totalLogins: 0, uniqueUsers: 0, failedAttempts: 0, failureRate: 0 }
  }
}