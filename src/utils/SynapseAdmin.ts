import { useMatrixAuthStore } from '@/stores/matrixAuth'
const json = async (resp: Response) => (resp.ok ? resp.json() : Promise.reject(new Error(String(resp.status))))
const auth = (): Record<string, string> => {
  try {
    const s = useMatrixAuthStore()
    if (s?.accessToken) return { Authorization: `Bearer ${s.accessToken}` }
  } catch {}
  return {}
}

export const getUser = async (userId: string) => {
  const resp = await fetch(`/_synapse/admin/v2/users/${encodeURIComponent(userId)}`, { headers: auth() })
  return json(resp)
}

export const listUsers = async (params?: { name?: string; from?: number; limit?: number }) => {
  const q = new URLSearchParams()
  if (params?.name) q.set('name', params.name)
  if (typeof params?.from === 'number') q.set('from', String(params.from))
  if (typeof params?.limit === 'number') q.set('limit', String(params.limit))
  const resp = await fetch(`/_synapse/admin/v2/users?${q.toString()}`, { headers: auth() })
  const js = await json(resp)
  return Array.isArray(js?.users) ? js.users : []
}

export const updateUserAdmin = async (userId: string, admin: boolean) => {
  await fetch(`/_synapse/admin/v2/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify({ admin })
  })
}

export const setUserDeactivated = async (userId: string, deactivated: boolean) => {
  await fetch(`/_synapse/admin/v2/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify({ deactivated })
  })
}

export const resetPassword = async (userId: string, newPassword: string, logoutDevices = true) => {
  await fetch(`/_synapse/admin/v1/reset_password/${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify({ new_password: newPassword, logout_devices: logoutDevices })
  })
}

export const listDevices = async (userId: string) => {
  const resp = await fetch(`/_synapse/admin/v2/users/${encodeURIComponent(userId)}/devices`, { headers: auth() })
  const js = await json(resp)
  return Array.isArray(js?.devices) ? js.devices : []
}

export const deleteTokens = async (userId: string) => {
  await fetch(`/_synapse/admin/v2/users/${encodeURIComponent(userId)}/delete_tokens`, {
    method: 'POST',
    headers: auth()
  })
}

export const deleteDevice = async (userId: string, deviceId: string) => {
  await fetch(`/_synapse/admin/v2/users/${encodeURIComponent(userId)}/devices/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
    headers: auth()
  })
}

export const listRooms = async (params?: { from?: number; limit?: number }) => {
  const q = new URLSearchParams()
  if (typeof params?.from === 'number') q.set('from', String(params.from))
  if (typeof params?.limit === 'number') q.set('limit', String(params.limit))
  const resp = await fetch(`/_synapse/admin/v2/rooms?${q.toString()}`, { headers: auth() })
  const js = await json(resp)
  return Array.isArray(js?.rooms) ? js.rooms : []
}

export const deleteRoom = async (roomId: string, block = true, purge = true) => {
  await fetch(`/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}?block=${block}&purge=${purge}`, {
    method: 'DELETE',
    headers: auth()
  })
}

export const purgeHistory = async (roomId: string, purgeUpToTs: number) => {
  await fetch(`/_synapse/admin/v1/purge_history/${encodeURIComponent(roomId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify({ purge_up_to_ts: purgeUpToTs })
  })
}

/**
 * @deprecated Use MatrixClient.setRoomDirectoryVisibility() instead
 * Standard Matrix Client API - should use SDK methods directly
 * Requirements 10.1: Remove standard Matrix APIs from SynapseAdmin
 */
// export const setDirectoryVisibility - REMOVED, use client.setRoomDirectoryVisibility()

/**
 * @deprecated Use room.getJoinedMembers() instead
 * Standard Matrix Client API - should use SDK methods directly
 * Requirements 10.1: Remove standard Matrix APIs from SynapseAdmin
 */
// export const listRoomMembers - REMOVED, use room.getJoinedMembers()

/**
 * @deprecated Use MatrixClient.kick() instead
 * Standard Matrix Client API - should use SDK methods directly
 * Requirements 10.1: Remove standard Matrix APIs from SynapseAdmin
 */
// export const kickUser - REMOVED, use client.kick()

/**
 * @deprecated Use MatrixClient.ban() instead
 * Standard Matrix Client API - should use SDK methods directly
 * Requirements 10.1: Remove standard Matrix APIs from SynapseAdmin
 */
// export const banUser - REMOVED, use client.ban()

/**
 * @deprecated Use MatrixClient.unban() instead
 * Standard Matrix Client API - should use SDK methods directly
 * Requirements 10.1: Remove standard Matrix APIs from SynapseAdmin
 */
// export const unbanUser - REMOVED, use client.unban()
