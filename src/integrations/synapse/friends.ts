import { useMatrixAuthStore } from '@/stores/matrixAuth'
import { logger } from '@/utils/logger'

/**
 * 检查是否为开发环境
 */
const isDev = () => import.meta.env.DEV

/**
 * 构建API URL
 * - 开发环境：使用相对路径，通过Vite代理转发
 * - 生产环境：使用完整的homeserver URL
 */
const buildUrl = (path: string, query?: Record<string, string>) => {
  const auth = useMatrixAuthStore()

  // 开发环境：使用相对路径，通过Vite代理
  if (isDev()) {
    // Vite代理配置：/_synapse 和 /_matrix 会代理到真实的Matrix服务器
    let url = path
    if (query) {
      const searchParams = new URLSearchParams(query)
      url += `?${searchParams.toString()}`
    }
    return url
  }

  // 生产环境：使用完整的homeserver URL
  let base = auth.getHomeserverBaseUrl() || ''

  // 尝试从 Matrix 客户端服务获取 homeserver URL
  if (!base) {
    try {
      const { matrixClientService } = require('@/integrations/matrix/client')
      base = (matrixClientService.getClient()?.baseUrl || '').replace(/\/$/, '')
    } catch {}
  }

  // 如果仍然没有 base URL，抛出错误
  if (!base) {
    throw new Error('未设置 homeserver 基础地址，请确保已完成 Matrix 服务发现')
  }

  // 构建完整的 URL
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
        // Synapse Friends API 不可用，这是正常的，使用降级方案
        logger.warn('[Synapse Friends] API not available (404), using Matrix SDK fallback')
        return { friends: [] }
      }
      logger.warn('[Synapse Friends] API returned error:', res.status, res.statusText)
      return { friends: [] }
    }
    return await res.json()
  } catch (error) {
    if (error instanceof Error) {
      // 网络错误或超时，记录但返回空列表
      logger.warn('[Synapse Friends] Request failed:', error.message)
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
        // Synapse Friends API 不可用，这是正常的
        logger.debug('[Synapse Friends] Pending requests API not available (404)')
        return { requests: [] }
      }
      // 401 是未登录时的正常情况，使用 debug 级别
      if (res.status === 401) {
        logger.debug('[Synapse Friends] Not authenticated for pending requests')
        return { requests: [] }
      }
      logger.warn('[Synapse Friends] Pending requests API error:', res.status)
      return { requests: [] }
    }
    return await res.json()
  } catch (error) {
    if (error instanceof Error) {
      logger.debug('[Synapse Friends] Pending requests failed:', error.message)
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
      if (res.status === 404) {
        // Synapse Friends API 不可用，这是正常的，使用Matrix SDK fallback
        logger.warn('[Synapse Friends] Search API not available (404), should use Matrix SDK fallback')
        throw new Error('Synapse friends API not found (404)')
      }
      if (res.status === 401) {
        throw new Error('Unauthorized - token may be invalid or missing')
      }
      logger.warn('[searchUsers] Error response:', errorText)
      return { status: 'error', users: [] }
    }
    const data = await res.json()
    logger.debug('[searchUsers] Success, users count:', data.users?.length || 0)
    return data
  } catch (error) {
    if (error instanceof Error) {
      // 对于404和401错误，向上抛出让上层使用Matrix SDK fallback
      if (error.message.includes('404') || error.message.includes('Unauthorized')) {
        throw error
      }
      logger.warn('[searchUsers] Request failed:', error.message)
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
        // Synapse Friends API 不可用，这是正常的
        logger.debug('[Synapse Friends] Stats API not available (404)')
        return {}
      }
      // 401 是未登录时的正常情况，使用 debug 级别
      if (res.status === 401) {
        logger.debug('[Synapse Friends] Not authenticated for stats')
        return {}
      }
      logger.warn('[Synapse Friends] Stats API error:', res.status)
      return {}
    }
    return await res.json()
  } catch (error) {
    if (error instanceof Error) {
      logger.debug('[Synapse Friends] Stats request failed:', error.message)
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
