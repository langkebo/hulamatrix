import { matrixClientService } from './client'

// Type definitions for Matrix SDK objects
interface MatrixRoomLike {
  roomId: string
  getJoinedMembers?(): MatrixMemberLike[]
  [key: string]: unknown
}

interface MatrixMemberLike {
  userId?: string
  [key: string]: unknown
}

interface MatrixClientLike {
  searchUserDirectory?(options: { term: string; limit: number }): Promise<unknown>
  getRooms?(): MatrixRoomLike[]
  getUserId?(): string
  createRoom?(options: Record<string, unknown>): Promise<MatrixRoomCreatedResponse | undefined>
  getAccountData?(type: string): MatrixEventLike | undefined
  setAccountData?(type: string, content: Record<string, unknown>): Promise<void>
  [key: string]: unknown
}

interface MatrixEventLike {
  getContent?<T = unknown>(): T
  [key: string]: unknown
}

interface MatrixRoomCreatedResponse {
  room_id?: string
  roomId?: string
  [key: string]: unknown
}

interface UserDirectoryResponse {
  results?: MatrixUserDirectoryResult[]
  [key: string]: unknown
}

interface MatrixUserDirectoryResult {
  user_id: string
  display_name?: string
  avatar_url?: string
  [key: string]: unknown
}

export async function searchDirectory(term: string, limit = 20): Promise<MatrixUserDirectoryResult[]> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) throw new Error('Matrix 客户端未初始化')
  const res = (await client
    .searchUserDirectory?.({ term, limit })
    .catch(() => ({ results: [] }))) as unknown as UserDirectoryResponse
  return Array.isArray(res?.results) ? res.results : []
}

export async function getOrCreateDirectRoom(userId: string): Promise<string | undefined> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) throw new Error('Matrix 客户端未初始化')
  const rooms = client.getRooms?.() || []
  for (const r of rooms) {
    const members = r?.getJoinedMembers?.()?.map((m: MatrixMemberLike) => m?.userId) || []
    if (members.includes(userId) && members.includes(client.getUserId?.())) {
      return r.roomId
    }
  }
  const created = await client.createRoom?.({
    is_direct: true,
    preset: 'trusted_private_chat',
    invite: [userId]
  })
  return created?.room_id || created?.roomId
}

export async function updateDirectMapping(userId: string, roomId: string): Promise<void> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) throw new Error('Matrix 客户端未初始化')
  let current: Record<string, unknown> = {}
  try {
    const ev = client.getAccountData?.('m.direct')
    current =
      (ev?.getContent?.() as Record<string, unknown> | undefined) || (ev as Record<string, unknown> | undefined) || {}
  } catch {}
  const next = { ...(current || {}) }
  const arr = Array.isArray(next[userId]) ? next[userId] : []
  if (!arr.includes(roomId)) (arr as string[]).push(roomId)
  next[userId] = arr
  await client.setAccountData?.('m.direct', next)
}
