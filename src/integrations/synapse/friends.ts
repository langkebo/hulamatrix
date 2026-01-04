import { useMatrixAuthStore } from '@/stores/matrixAuth'
import { logger } from '@/utils/logger'

const buildUrl = (path: string, query?: Record<string, string>) => {
  const auth = useMatrixAuthStore()
  let base = auth.getHomeserverBaseUrl() || ''
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
  if (!isTauri) {
    const u = new URL(path, typeof location !== 'undefined' ? location.origin : 'http://localhost')
    if (query) Object.entries(query).forEach(([k, v]) => u.searchParams.set(k, v))
    return `${u.pathname}${u.search}`
  }
  if (!base) {
    try {
      const { matrixClientService } = require('@/integrations/matrix/client')
      base = (matrixClientService.getClient()?.baseUrl || '').replace(/\/$/, '')
    } catch {}
  }
  if (!base) throw new Error('未设置 homeserver 基础地址')
  const u = new URL(path, base)
  if (query) Object.entries(query).forEach(([k, v]) => u.searchParams.set(k, v))
  return u.toString()
}

const authHeaders = () => {
  const token = useMatrixAuthStore().accessToken
  return { Authorization: `Bearer ${token}` }
}

/**
 * 带超时的 fetch 包装器
 * @param url 请求 URL
 * @param options fetch 选项
 * @param timeoutMs 超时时间（毫秒），默认 5000ms
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 5000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`)
    }
    throw error
  }
}

/**
 * 获取好友列表
 * GET /_synapse/client/friends?action=list&user_id=xxx
 */
export const listFriends = async () => {
  const auth = authHeaders()
  const userId = useMatrixAuthStore().userId
  const url = buildUrl('/_synapse/client/friends', { action: 'list', user_id: userId })
  try {
    const res = await fetchWithTimeout(url, { headers: auth }, 5000)
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Synapse friends API not found (404)')
      }
      return { friends: [] }
    }
    return await res.json()
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      throw error
    }
    return { friends: [] }
  }
}

/**
 * 获取好友分类（从账户数据）
 * 注意：Synapse 不支持此 action，使用账户数据 fallback
 */
export const listCategories = async () => {
  // 返回空分类，分类通过 Matrix 账户数据管理
  return { categories: [] }
}

/**
 * 获取待处理的好友请求
 * GET /_synapse/client/friends?action=pending_requests&user_id=xxx
 */
export const listPendingRequests = async () => {
  const auth = authHeaders()
  const userId = useMatrixAuthStore().userId
  const url = buildUrl('/_synapse/client/friends', { action: 'pending_requests', user_id: userId })
  try {
    const res = await fetchWithTimeout(url, { headers: auth }, 5000)
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Synapse friends API not found (404)')
      }
      return { requests: [] }
    }
    return await res.json()
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      throw error
    }
    return { requests: [] }
  }
}

/**
 * 发送好友请求
 * POST /_synapse/client/friends with body: {action: "request", ...}
 */
export const sendRequest = async (payload: {
  requester_id: string
  target_id: string
  message?: string
  category_id?: string
}) => {
  const auth = authHeaders()
  const url = buildUrl('/_synapse/client/friends')
  const body = { action: 'request', ...payload }

  // 调试日志
  logger.debug('[sendRequest] URL:', url)
  logger.debug('[sendRequest] Payload:', JSON.stringify(body, null, 2))
  logger.debug('[sendRequest] Auth token present:', !!auth.Authorization)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify(body)
    })

    logger.debug('[sendRequest] Response status:', res.status)

    if (!res.ok) {
      const errorText = await res.text()
      logger.error('[sendRequest] Error response:', errorText)
      throw new Error(`发送好友请求失败: ${res.status} - ${errorText}`)
    }

    const data = await res.json()
    logger.debug('[sendRequest] Success response:', data)
    return data
  } catch (error) {
    logger.error('[sendRequest] Error:', error)
    throw error
  }
}

/**
 * 接受好友请求
 * POST /_synapse/client/friends with body: {action: "accept", ...}
 */
export const acceptRequest = async (payload: { request_id: string; user_id: string; category_id?: string }) => {
  const auth = authHeaders()
  const url = buildUrl('/_synapse/client/friends')
  const body = { action: 'accept', ...payload }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error('接受好友请求失败')
  return await res.json()
}

/**
 * 拒绝好友请求
 * POST /_synapse/client/friends with body: {action: "reject", ...}
 */
export const rejectRequest = async (payload: { request_id: string; user_id: string }) => {
  const auth = authHeaders()
  const url = buildUrl('/_synapse/client/friends')
  const body = { action: 'reject', ...payload }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error('拒绝好友请求失败')
  return await res.json()
}

/**
 * 搜索用户
 * GET /_synapse/client/friends?action=search&query=xxx
 */
export const searchUsers = async (query: string) => {
  if (!query || query.trim().length === 0) {
    return { status: 'ok', users: [] }
  }

  const auth = authHeaders()
  const url = buildUrl('/_synapse/client/friends', { action: 'search', query: query.trim() })

  // 调试日志
  logger.debug('[searchUsers] URL:', url)
  logger.debug('[searchUsers] Auth token present:', !!auth.Authorization)

  try {
    const res = await fetchWithTimeout(url, { headers: auth }, 5000)
    logger.debug('[searchUsers] Response status:', res.status)

    if (!res.ok) {
      const errorText = await res.text()
      logger.error('[searchUsers] Error response:', errorText)
      if (res.status === 404) {
        throw new Error('Synapse friends API not found (404)')
      }
      if (res.status === 401) {
        throw new Error('Unauthorized - token may be invalid or missing')
      }
      return { status: 'error', users: [] }
    }
    const data = await res.json()
    logger.debug('[searchUsers] Success, users count:', data.users?.length || 0)
    return data
  } catch (error) {
    logger.error('[searchUsers] Error:', error)
    if (error instanceof Error && (error.message.includes('404') || error.message.includes('Unauthorized'))) {
      throw error
    }
    return { status: 'error', users: [] }
  }
}

/**
 * 删除好友
 * POST /_synapse/client/friends with body: {action: "remove", friend_id: xxx}
 *
 * Requirement 3.3: THE Friends_Service SHALL support remove action
 */
export const removeFriend = async (friendId: string) => {
  const auth = authHeaders()
  const url = buildUrl('/_synapse/client/friends')
  const body = { action: 'remove', friend_id: friendId }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error('删除好友失败')
  return await res.json()
}

/**
 * 获取好友统计
 * GET /_synapse/client/friends?action=stats&user_id=xxx
 */
export const stats = async () => {
  const auth = authHeaders()
  const userId = useMatrixAuthStore().userId
  const url = buildUrl('/_synapse/client/friends', { action: 'stats', user_id: userId })
  try {
    const res = await fetchWithTimeout(url, { headers: auth }, 5000)
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Synapse friends API not found (404)')
      }
      return {}
    }
    return await res.json()
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      throw error
    }
    return {}
  }
}

/**
 * 获取好友扩展资料字段
 * GET /_synapse/client/friends?action=profile_ext&user_id=xxx&target_id=xxx
 */
export const getFriendProfileExt = async (targetId: string) => {
  const auth = authHeaders()
  const userId = useMatrixAuthStore().userId
  const url = buildUrl('/_synapse/client/friends', { action: 'profile_ext', user_id: userId, target_id: targetId })
  const res = await fetch(url, { headers: auth })
  if (!res.ok) throw new Error('获取好友扩展资料失败')
  return await res.json()
}

export const deletePrivateSession = async (sessionId: string) => {
  const auth = authHeaders()
  const url = buildUrl('/_synapse/client/private')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ action: 'delete', session_id: sessionId })
  })
  if (!res.ok) throw new Error('删除会话失败')
  const data = await res.json()
  return data?.status === 'ok'
}

export const hidePrivateSession = async (sessionId: string) => {
  const auth = authHeaders()
  const url = buildUrl('/_synapse/client/private')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ action: 'hide', session_id: sessionId })
  })
  if (!res.ok) throw new Error('隐藏会话失败')
  const data = await res.json()
  return data?.status === 'ok'
}

/**
 * 列出好友并合并在线状态（Presence）
 */
export const listFriendsWithPresence = async () => {
  const list = await listFriends()
  const presenceMap: Record<string, string> = {}
  try {
    const { matrixClientService } = require('@/integrations/matrix/client')
    const client = matrixClientService.getClient()
    const devices = await client?.getPresenceList?.()
    if (Array.isArray(devices)) {
      devices.forEach((p: { user_id?: string; presence?: string }) => {
        if (p?.user_id) presenceMap[p.user_id] = p?.presence || 'offline'
      })
    }
  } catch {}
  try {
    if (Array.isArray(list?.friends)) {
      list.friends = list.friends.map((f: { user_id?: string; [key: string]: unknown }) => ({
        ...f,
        presence: presenceMap[f?.user_id ?? ''] || 'offline'
      }))
    }
  } catch {}
  return list
}

/**
 * 搜索用户类型定义
 */
export interface SearchResultUser {
  user_id: string
}

export interface SearchUsersResponse {
  status: 'ok' | 'error'
  users?: SearchResultUser[]
}
