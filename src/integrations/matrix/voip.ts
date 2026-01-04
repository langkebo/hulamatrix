import { useMatrixAuthStore } from '@/stores/matrixAuth'

export type TurnServer = { uris: string[]; username: string; password: string; ttl?: number }

let cachedTurn: TurnServer | null = null
let expireAt = 0
let refreshTimer: number | null = null

const scheduleRefresh = (ttl?: number) => {
  try {
    if (!ttl || ttl <= 0) return
    const lead = Math.max(5, Math.floor(ttl * 0.8)) // 80% 到期前刷新，至少 5 秒
    const delayMs = lead * 1000
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
    refreshTimer = window.setTimeout(async () => {
      try {
        await refreshTurnServer()
      } catch {}
    }, delayMs)
  } catch {}
}

export const refreshTurnServer = async (): Promise<TurnServer> => {
  const auth = useMatrixAuthStore()
  const base = auth.getHomeserverBaseUrl() || ''
  if (!auth.accessToken) {
    throw new Error('Matrix access token 缺失，请先登录或完成注册')
  }
  try {
    // Validate base URL format
    new URL(base)
  } catch {}
  const url = `${base}/_matrix/client/v3/voip/turnServer`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${auth.accessToken}` } })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`获取 TURN 凭证失败 [${res.status} ${res.statusText}] ${text || ''}`.trim())
  }
  const js = (await res.json()) as TurnServer
  cachedTurn = js
  expireAt = Date.now() + Math.max(0, (js.ttl || 0) * 1000)
  scheduleRefresh(js.ttl)
  return js
}

export const getTurnServer = async (): Promise<TurnServer> => {
  const now = Date.now()
  if (cachedTurn && expireAt > now + 3000) return cachedTurn
  return await refreshTurnServer()
}
