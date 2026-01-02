import { matrixClientService } from './client'
import { listFriendsWithPresence } from '../synapse/friends'
import type { FriendActivityRow } from '@/types/matrix'

// Type definitions for Matrix SDK objects
interface MatrixRoomLike {
  getLiveTimeline?(): { getEvents?(): MatrixEventLike[] }
  [key: string]: unknown
}

interface MatrixEventLike {
  getTs?(): number
  getType?(): string
  getSender?(): string
  event?: {
    origin_server_ts?: number
    type?: string
    sender?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

interface MatrixClientLike {
  createRoom?(options: Record<string, unknown>): Promise<MatrixRoomCreatedResponse | undefined>
  sendEvent?(roomId: string, type: string, content: Record<string, unknown>): Promise<void>
  joinRoom?(roomId: string): Promise<void>
  leave?(roomId: string): Promise<void>
  getAccountData?(type: string): MatrixEventLike | undefined
  getUserId?(): string
  getRoom?(roomId: string): MatrixRoomLike | undefined
  [key: string]: unknown
}

interface MatrixRoomCreatedResponse {
  room_id?: string
  roomId?: string
  [key: string]: unknown
}

interface SynapseFriendsResponse {
  friends?: FriendPresenceInfo[]
  [key: string]: unknown
}

interface FriendPresenceInfo {
  user_id?: string
  userId?: string
  display_name?: string
  displayName?: string
  avatar_url?: string
  presence?: 'online' | 'offline' | 'unavailable'
  [key: string]: unknown
}

/**
 * 发送好友请求（以私聊邀请建模）
 * @param userId 目标用户 MXID
 * @param reason 可选申请理由，将作为首条消息发送
 */
export async function sendFriendRequest(userId: string, reason?: string): Promise<string | undefined> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) throw new Error('Matrix 客户端未初始化')
  const created = await client.createRoom?.({ is_direct: true, preset: 'trusted_private_chat', invite: [userId] })
  const roomId = created?.room_id || created?.roomId
  if (roomId && reason) {
    await client.sendEvent?.(roomId, 'm.room.message', { msgtype: 'm.text', body: reason })
  }
  return roomId
}

/**
 * 响应好友请求（加入邀请房间）
 * @param roomId 邀请房间 ID
 * @param accept 是否接受；拒绝则执行离开
 */
export async function respondToFriendRequest(roomId: string, accept: boolean): Promise<void> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) throw new Error('Matrix 客户端未初始化')
  if (accept) {
    await client.joinRoom?.(roomId)
  } else {
    try {
      await client.leave?.(roomId)
    } catch {}
  }
}

/**
 * 列出好友（基于 m.direct 映射与房间成员）
 */
export async function listFriends(): Promise<Array<{ userId: string; roomIds: string[] }>> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) throw new Error('Matrix 客户端未初始化')
  let mapping: Record<string, unknown> = {}
  try {
    const ev = client.getAccountData?.('m.direct')
    const getContentFn = ev?.getContent as (() => Record<string, unknown>) | undefined
    mapping = getContentFn?.() || (ev as Record<string, unknown>) || {}
  } catch {}
  const res: Array<{ userId: string; roomIds: string[] }> = []
  Object.keys(mapping || {}).forEach((uid) => {
    const rooms = Array.isArray(mapping[uid]) ? (mapping[uid] as string[]) : []
    res.push({ userId: uid, roomIds: rooms })
  })
  return res
}

export async function listFriendsWithPresenceAndActivity(options?: {
  allowedTypes?: string[]
  onlyWithMe?: boolean
}): Promise<FriendActivityRow[]> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) throw new Error('Matrix 客户端未初始化')
  const allowedTypes = options?.allowedTypes || ['m.room.message', 'm.reaction']
  const onlyWithMe = options?.onlyWithMe !== false
  const me = (() => {
    try {
      return client.getUserId?.()
    } catch {
      return ''
    }
  })()
  const base = await listFriendsWithPresence().catch(() => ({ friends: [] }))
  const friends = Array.isArray((base as SynapseFriendsResponse)?.friends)
    ? ((base as SynapseFriendsResponse).friends as FriendPresenceInfo[])
    : []
  const mapping = await listFriends().catch(() => [])
  const roomMap: Record<string, string[]> = {}
  mapping.forEach((m) => {
    roomMap[m.userId] = m.roomIds || []
  })
  const getTs = (roomId: string, friendId: string): number => {
    try {
      const r = client.getRoom?.(roomId)
      const evs = r?.getLiveTimeline?.()?.getEvents?.() || []
      let ts = 0
      for (const e of evs) {
        const t = typeof e?.getTs === 'function' ? e.getTs() : e?.event?.origin_server_ts || 0
        const type = typeof e?.getType === 'function' ? e.getType() : e?.event?.type || ''
        const sender = typeof e?.getSender === 'function' ? e.getSender() : e?.event?.sender || ''
        if (!allowedTypes.includes(type)) continue
        if (onlyWithMe && !(sender === me || sender === friendId)) continue
        if (t > ts) ts = t
      }
      return ts
    } catch {
      return 0
    }
  }
  return friends.map((f: FriendPresenceInfo) => {
    const fid = f.user_id || f.userId || ''
    const rooms = roomMap[fid] || []
    let maxTs = 0
    for (const id of rooms) {
      if (!id) continue
      const t = getTs(id, fid)
      if (t > maxTs) maxTs = t
    }
    const row: FriendActivityRow = {
      userId: fid,
      displayName: f.display_name || f.displayName || '',
      presence: (f.presence || 'offline') as 'online' | 'offline' | 'unavailable',
      activeTime: maxTs
    }
    if (f.avatar_url !== undefined) row.avatarUrl = f.avatar_url
    return row
  })
}
