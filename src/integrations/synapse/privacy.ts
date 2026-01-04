import { useMatrixAuthStore } from '@/stores/matrixAuth'

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

export const reportUser = async (mxid: string, reason: string) => {
  const auth = authHeaders()
  const url = buildUrl('/_synapse/client/privacy')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ action: 'report_user', target_id: mxid, reason })
  })
  if (!res.ok) throw new Error('举报失败')
  return await res.json()
}

export const reportRoom = async (roomId: string, reason: string) => {
  const auth = authHeaders()
  const url = buildUrl('/_synapse/client/privacy')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ action: 'report_room', target_id: roomId, reason })
  })
  if (!res.ok) throw new Error('举报失败')
  return await res.json()
}

export const blockUser = async (mxid: string) => {
  const auth = authHeaders()
  const url = buildUrl('/_synapse/client/privacy')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ action: 'block_user', target_id: mxid })
  })
  if (!res.ok) throw new Error('屏蔽失败')
  return await res.json()
}

export const unblockUser = async (mxid: string) => {
  const auth = authHeaders()
  const url = buildUrl('/_synapse/client/privacy')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ action: 'unblock_user', target_id: mxid })
  })
  if (!res.ok) throw new Error('取消屏蔽失败')
  return await res.json()
}

export const blockRoom = async (roomId: string) => {
  const auth = authHeaders()
  const url = buildUrl('/_synapse/client/privacy')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ action: 'block_room', target_id: roomId })
  })
  if (!res.ok) throw new Error('屏蔽失败')
  return await res.json()
}

export const unblockRoom = async (roomId: string) => {
  const auth = authHeaders()
  const url = buildUrl('/_synapse/client/privacy')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ action: 'unblock_room', target_id: roomId })
  })
  if (!res.ok) throw new Error('取消屏蔽失败')
  return await res.json()
}

export const submitFeedback = async (subject: string, content: string) => {
  const auth = authHeaders()
  const url = buildUrl('/_synapse/client/feedback')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ subject, content })
  })
  if (!res.ok) throw new Error('提交失败')
  return await res.json()
}

export const submitFeedbackWithAttachment = async (subject: string, content: string, file: File) => {
  const auth = authHeaders()
  const url = buildUrl('/_synapse/client/feedback')
  const form = new FormData()
  form.append('subject', subject)
  form.append('content', content)
  form.append('file', file)
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...auth },
    body: form
  })
  if (!res.ok) throw new Error('提交失败')
  return await res.json()
}

export const submitFeedbackWithMxc = async (subject: string, content: string, file: File) => {
  const auth = authHeaders()
  const { uploadContent } = await import('@/integrations/matrix/media')
  const mxc = await uploadContent(file, { name: file.name, type: file.type })
  const url = buildUrl('/_synapse/client/feedback')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ subject, content, attachment: mxc })
  })
  if (!res.ok) throw new Error('提交失败')
  return await res.json()
}

export const listBlockedUsers = async () => {
  const auth = authHeaders()
  const url = buildUrl('/_synapse/client/privacy', { action: 'list_blocked_users' })
  const res = await fetch(url, { headers: auth })
  if (!res.ok) throw new Error('获取屏蔽用户失败')
  const data = await res.json()
  return Array.isArray(data?.users) ? data.users : []
}

export const listBlockedRooms = async () => {
  const auth = authHeaders()
  const url = buildUrl('/_synapse/client/privacy', { action: 'list_blocked_rooms' })
  const res = await fetch(url, { headers: auth })
  if (!res.ok) throw new Error('获取屏蔽房间失败')
  const data = await res.json()
  return Array.isArray(data?.rooms) ? data.rooms : []
}

export const listReports = async () => {
  const auth = authHeaders()
  const url = buildUrl('/_synapse/client/privacy', { action: 'list_reports' })
  const res = await fetch(url, { headers: auth })
  if (!res.ok) throw new Error('获取举报记录失败')
  const data = await res.json()
  return Array.isArray(data?.reports) ? data.reports : []
}
