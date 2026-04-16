export interface KVNamespace {
  get<T>(key: string, type?: 'text' | 'json'): Promise<T | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[]
    list_complete: boolean
    cursor?: string
  }>
}

export interface KVBinding {
  TMDB_CACHE?: KVNamespace
}

function getKV(env: KVBinding, bindingName: string = 'TMDB_CACHE'): KVNamespace | null {
  const binding = env[bindingName as keyof KVBinding]
  if (!binding) {
    console.warn(`KV binding '${bindingName}' not found in environment`)
    return null
  }
  return binding
}

export async function kvGet<T>(
  env: KVBinding,
  key: string,
  bindingName?: string
): Promise<T | null> {
  const kv = getKV(env, bindingName || 'TMDB_CACHE')
  if (!kv) return null

  try {
    return await kv.get<T>(key, 'json')
  } catch (error) {
    console.error(`KV get error for key '${key}':`, error)
    return null
  }
}

export async function kvSet(
  env: KVBinding,
  key: string,
  value: unknown,
  ttlSeconds?: number,
  bindingName?: string
): Promise<boolean> {
  const kv = getKV(env, bindingName || 'TMDB_CACHE')
  if (!kv) return false

  try {
    await kv.put(key, JSON.stringify(value), ttlSeconds ? { expirationTtl: ttlSeconds } : undefined)
    return true
  } catch (error) {
    console.error(`KV set error for key '${key}':`, error)
    return false
  }
}

export async function kvDelete(
  env: KVBinding,
  key: string,
  bindingName?: string
): Promise<boolean> {
  const kv = getKV(env, bindingName || 'TMDB_CACHE')
  if (!kv) return false

  try {
    await kv.delete(key)
    return true
  } catch (error) {
    console.error(`KV delete error for key '${key}':`, error)
    return false
  }
}

export async function kvListKeys(
  env: KVBinding,
  prefix?: string,
  bindingName?: string
): Promise<string[]> {
  const kv = getKV(env, bindingName || 'TMDB_CACHE')
  if (!kv) return []

  try {
    const result = await kv.list({ prefix })
    return result.keys.map(k => k.name)
  } catch (error) {
    console.error(`KV list error:`, error)
    return []
  }
}

export async function kvClearPrefix(
  env: KVBinding,
  prefix: string,
  bindingName?: string
): Promise<number> {
  const keys = await kvListKeys(env, prefix, bindingName)
  const kv = getKV(env, bindingName || 'TMDB_CACHE')
  if (!kv) return 0

  let deleted = 0
  for (const key of keys) {
    try {
      await kv.delete(key)
      deleted++
    } catch (error) {
      console.error(`KV delete error for key '${key}':`, error)
    }
  }
  return deleted
}

export { getKV }
