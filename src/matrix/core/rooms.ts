import { matrixClientService } from '@/matrix/core/client'
import { useChatStore } from '@/stores/chat'
import { RoomTypeEnum, NotificationTypeEnum } from '@/enums'
import { IsAllUserEnum } from '@/services/types'
import { listJoinedMembers } from './members'
import { uploadContent } from '@/matrix/services/media/upload'
import { withRetry } from '@/utils/retry'
import { createRoomService, type RoomService } from '@/services/roomService'
import type {
  RoomCreateOptions,
  RoomVisibility,
  HistoryVisibility,
  JoinRule,
  CreateRoomDetailedResult
} from '@/types/matrix'

// Type definitions for Matrix SDK client and room objects
interface MatrixClientServiceLike {
  client?: MatrixClientLike | null
  getClient(): MatrixClientLike | null
}

interface MatrixClientLike {
  getUserId(): string
  getDeviceId?(): string
  on(event: string, handler: (...args: unknown[]) => void): void
  uploadContent?(file: Blob, options?: UploadOptionsLike): Promise<string>
  [key: string]: unknown
}

interface RoomLike {
  roomId: string
  name?: string
  getDefaultRoomName?(userId: string): string
  getAliases?(): string[]
}

interface UploadOptionsLike {
  name?: string
  type?: string
  [key: string]: unknown
}

interface SessionLike {
  account: string
  activeTime: number
  avatar: string
  id: string
  detailId: string
  hotFlag: IsAllUserEnum
  name: string
  roomId: string
  text: string
  type: RoomTypeEnum
  unreadCount: number
  top: boolean
  operate: number
  shield: boolean
  hide: boolean
  muteNotification: NotificationTypeEnum
  allowScanEnter: boolean
}

import type { MatrixClient } from 'matrix-js-sdk'

/**
 * Phase 12 优化: 缓存 Matrix client 引用
 * 避免重复调用 matrixClientService.getClient()
 */
let _cachedClient: MatrixClientLike | null = null
function getCachedClient(): MatrixClientLike | null {
  if (!_cachedClient) {
    _cachedClient = (matrixClientService as unknown as MatrixClientServiceLike).client as MatrixClientLike | null
    if (!_cachedClient) {
      _cachedClient = matrixClientService.getClient() as MatrixClientLike | null
    }
  }
  return _cachedClient
}

let _roomService: RoomService | null = null
function getRoomService(): RoomService {
  if (!_roomService) {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('Matrix client not initialized')
    _roomService = createRoomService(client as unknown as MatrixClient)
  }
  return _roomService
}

export function setupMatrixRoomBridge() {
  const client = getCachedClient()
  if (!client) return
  if (typeof client.on !== 'function') return
  const chatStore = useChatStore()

  const ensureSessionExists = (room: RoomLike) => {
    const roomId = room?.roomId
    if (!roomId) return
    const existed = chatStore.getSession(roomId)
    if (existed) return
    const name = room?.name || room?.getDefaultRoomName?.((client as MatrixClientLike).getUserId()) || roomId
    const placeholder: SessionLike = {
      account: '',
      activeTime: Date.now(),
      avatar: '',
      id: roomId,
      detailId: '',
      hotFlag: IsAllUserEnum.Not,
      name,
      roomId,
      text: '',
      type: RoomTypeEnum.GROUP,
      unreadCount: 0,
      top: false,
      operate: 0,
      shield: false,
      hide: false,
      muteNotification: NotificationTypeEnum.RECEPTION,
      allowScanEnter: true
    }
    // 直接插入占位会话
    chatStore.sessionList.push(placeholder as SessionLike)
  }

  ;(client as MatrixClientLike).on('Room', (...args: unknown[]) => {
    const room = args[0] as RoomLike
    ensureSessionExists(room)
    const roomId = room?.roomId
    const name = room?.name || room?.getDefaultRoomName?.((client as MatrixClientLike).getUserId())
    if (roomId && name) {
      chatStore.updateSession(roomId, { name })
    }
  })

  ;(client as MatrixClientLike).on('Room.name', (...args: unknown[]) => {
    const room = args[1] as RoomLike
    const roomId = room?.roomId
    const name = room?.name
    if (roomId && name) chatStore.updateSession(roomId, { name })
  })
}

export async function createRoom(options: RoomCreateOptions): Promise<string> {
  const { name, topic, isPublic } = options || {}
  const roomId = await getRoomService().createRoom({
    name: name ?? '',
    topic,
    isPrivate: !isPublic
  })
  return roomId
}

export async function createRoomDetailed(options: RoomCreateOptions): Promise<CreateRoomDetailedResult> {
  const { name, topic, isPublic } = options || {}
  const roomId = await getRoomService().createRoom({
    name: name ?? '',
    topic,
    isPrivate: !isPublic
  })

  const preset: 'public_chat' | 'private_chat' = isPublic ? 'public_chat' : 'private_chat'
  const visibility: RoomVisibility = isPublic ? 'public' : 'private'
  return { roomId, preset, visibility, name: name ?? '', topic: topic ?? '' }
}

export async function setRoomName(roomId: string, name: string): Promise<void> {
  await getRoomService().setRoomName(roomId, name)
}

export async function setRoomTopic(roomId: string, topic: string): Promise<void> {
  await getRoomService().setRoomTopic(roomId, topic)
}

export async function setJoinRule(roomId: string, rule: JoinRule): Promise<void> {
  await getRoomService().setJoinRule(roomId, rule)
}

export async function setHistoryVisibility(roomId: string, visibility: HistoryVisibility): Promise<void> {
  await getRoomService().setHistoryVisibility(roomId, visibility)
}

export async function setEncryption(roomId: string, enabled: boolean): Promise<void> {
  await getRoomService().setEncryption(roomId, enabled)
}

export async function setRoomAvatar(roomId: string, file: Blob): Promise<string> {
  const client = getCachedClient()
  if (!client) throw new Error('Matrix client not initialized')

  // Get file extension
  let ext = 'png'
  const fileName = (file as { name?: string }).name
  if (fileName) {
    const parts = fileName.split('.')
    if (parts.length > 1) {
      ext = parts[parts.length - 1] || 'png'
    }
  } else if (file.type) {
    const typeParts = file.type.split('/')
    if (typeParts.length > 1) {
      ext = typeParts[typeParts.length - 1] || 'png'
    }
  }

  let mxc: string = ''
  if (typeof client.uploadContent === 'function') {
    mxc = await (client.uploadContent as (file: Blob, options: UploadOptionsLike) => Promise<string>)(file, {
      name: `room-avatar.${ext}`,
      type: file.type || 'image/png'
    })
  } else {
    mxc = await uploadContent(file, { name: `room-avatar.${ext}`, type: file.type || 'image/png' })
  }

  // Use RoomService to set the avatar state event
  await getRoomService().setRoomAvatar(roomId, mxc)
  return mxc
}

export async function createAlias(roomId: string, alias: string): Promise<void> {
  const client = getCachedClient()
  if (!client) throw new Error('Matrix client not initialized')
  try {
    await (client.createAlias as (alias: string, roomId: string) => Promise<unknown>)?.(alias, roomId)
  } catch {}
}

export async function deleteAlias(alias: string): Promise<void> {
  const client = getCachedClient()
  if (!client) throw new Error('Matrix client not initialized')
  try {
    await (client.deleteAlias as (alias: string) => Promise<unknown>)?.(alias)
  } catch {}
}

export async function getAliases(roomId: string): Promise<string[]> {
  const client = getCachedClient()
  if (!client) return []
  const room = (client.getRoom as (roomId: string) => RoomLike | undefined)(roomId)
  const aliases = (room?.getAliases?.() || []) as string[]
  return aliases
}

export async function setDirectoryVisibility(roomId: string, visibility: RoomVisibility): Promise<void> {
  const client = (matrixClientService.getClient() ||
    (matrixClientService as unknown as MatrixClientServiceLike).client) as MatrixClientLike | null
  if (!client) throw new Error('Matrix client not initialized')
  try {
    await (client.setRoomDirectoryVisibility as (roomId: string, visibility: RoomVisibility) => Promise<unknown>)?.(
      roomId,
      visibility
    )
  } catch {}
}

export async function getDirectoryVisibility(roomId: string): Promise<'public' | 'private' | null> {
  const client = (matrixClientService.getClient() ||
    (matrixClientService as unknown as MatrixClientServiceLike).client) as MatrixClientLike | null
  if (!client) return null
  try {
    const fn = client.getRoomDirectoryVisibility as
      | ((roomId: string) => Promise<{ visibility: RoomVisibility } | null>)
      | undefined
    const v = typeof fn === 'function' ? await fn(roomId) : null
    return v?.visibility || (v as RoomVisibility | null)
  } catch {
    return null
  }
}

/**
 * Join a room
 * Implementation of document requirement: join room with optional reason
 * @param roomIdOrAlias Room ID or alias to join
 * @param reason Optional reason for joining
 */
export async function joinRoom(roomIdOrAlias: string, reason?: string): Promise<void> {
  const client = (matrixClientService.getClient() ||
    (matrixClientService as unknown as MatrixClientServiceLike).client) as MatrixClientLike | null
  if (!client) throw new Error('Matrix client not initialized')

  // Try with reason if supported
  const joinRoomWithReason = (client as { joinRoom?: (roomId: string, opts: { reason?: string }) => Promise<unknown> })
    .joinRoom
  if (reason && typeof joinRoomWithReason === 'function') {
    await withRetry(() => joinRoomWithReason(roomIdOrAlias, { reason }))
  } else {
    const joinRoomBasic = client.joinRoom as (roomId: string) => Promise<unknown>
    await withRetry(() => joinRoomBasic(roomIdOrAlias))
  }
}

/**
 * Join room with third-party signed authorization
 * Implementation of document requirement: third-party signed join
 * @param roomId Room ID to join
 * @param thirdPartySigned Third-party signed authorization data
 */
export async function joinRoomWithThirdPartySigned(
  roomId: string,
  thirdPartySigned: {
    sender: string
    mxid: string
    token: string
    signatures: Record<string, Record<string, string>>
  }
): Promise<void> {
  const client = (matrixClientService.getClient() ||
    (matrixClientService as unknown as MatrixClientServiceLike).client) as MatrixClientLike | null
  if (!client) throw new Error('Matrix client not initialized')

  const joinRoomMethod = client.joinRoom as
    | ((roomId: string, opts?: { third_party_signed: typeof thirdPartySigned }) => Promise<unknown>)
    | undefined

  if (typeof joinRoomMethod === 'function') {
    await withRetry(() => joinRoomMethod(roomId, { third_party_signed: thirdPartySigned }))
  } else {
    throw new Error('Third-party signed join is not supported by the client')
  }
}

export async function inviteUser(roomId: string, userId: string): Promise<void> {
  const client = (matrixClientService.getClient() ||
    (matrixClientService as unknown as MatrixClientServiceLike).client) as MatrixClientLike | null
  if (!client) throw new Error('Matrix client not initialized')
  await withRetry(() => (client.invite as (roomId: string, userId: string) => Promise<unknown>)(roomId, userId))
}

export async function kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
  const client = (matrixClientService.getClient() ||
    (matrixClientService as unknown as MatrixClientServiceLike).client) as MatrixClientLike | null
  if (!client) throw new Error('Matrix client not initialized')
  await withRetry(() =>
    (client.kick as (roomId: string, userId: string, reason?: string) => Promise<unknown>)(roomId, userId, reason)
  )
}

export async function banUser(roomId: string, userId: string, reason?: string): Promise<void> {
  const client = (matrixClientService.getClient() ||
    (matrixClientService as unknown as MatrixClientServiceLike).client) as MatrixClientLike | null
  if (!client) throw new Error('Matrix client not initialized')
  await withRetry(() =>
    (client.ban as (roomId: string, userId: string, reason?: string) => Promise<unknown>)(roomId, userId, reason)
  )
}

export async function unbanUser(roomId: string, userId: string): Promise<void> {
  const client = (matrixClientService.getClient() ||
    (matrixClientService as unknown as MatrixClientServiceLike).client) as MatrixClientLike | null
  if (!client) throw new Error('Matrix client not initialized')
  await withRetry(() => (client.unban as (roomId: string, userId: string) => Promise<unknown>)(roomId, userId))
}

export async function leaveRoom(roomId: string, reason?: string): Promise<void> {
  const client = (matrixClientService.getClient() ||
    (matrixClientService as unknown as MatrixClientServiceLike).client) as MatrixClientLike | null
  if (!client) throw new Error('Matrix client not initialized')

  // Try with reason if supported
  if (
    reason &&
    typeof (client as { leave?: (roomId: string, opts: { reason?: string }) => Promise<unknown> }).leave === 'function'
  ) {
    await (client as { leave?: (roomId: string, opts: { reason?: string }) => Promise<unknown> }).leave?.(roomId, {
      reason
    })
  } else {
    await (client.leave as (roomId: string) => Promise<unknown>)(roomId)
  }
}

/**
 * Batch join multiple rooms
 * Implementation of document requirement: batch join rooms
 * @param roomIds Array of room IDs or aliases to join
 * @returns Object containing successful and failed joins
 */
export async function joinMultipleRooms(
  roomIds: string[]
): Promise<{ success: string[]; failed: Array<{ roomId: string; error: string }> }> {
  const client = (matrixClientService.getClient() ||
    (matrixClientService as unknown as MatrixClientServiceLike).client) as MatrixClientLike | null
  if (!client) throw new Error('Matrix client not initialized')

  const results = await Promise.allSettled(
    roomIds.map((roomId) => {
      const joinRoomMethod = client!.joinRoom as ((roomId: string) => Promise<unknown>) | undefined
      return joinRoomMethod?.(roomId)
    })
  )

  const success: string[] = []
  const failed: Array<{ roomId: string; error: string }> = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      success.push(roomIds[index])
    } else {
      failed.push({ roomId: roomIds[index], error: String(result.reason) })
    }
  })

  return { success, failed }
}

/**
 * Leave all rooms
 * Implementation of document requirement: leave all rooms
 * @returns Object containing successful and failed leaves
 */
export async function leaveAllRooms(): Promise<{
  success: string[]
  failed: Array<{ roomId: string; error: string }>
}> {
  const client = (matrixClientService.getClient() ||
    (matrixClientService as unknown as MatrixClientServiceLike).client) as MatrixClientLike | null
  if (!client) throw new Error('Matrix client not initialized')

  const getRoomsMethod = client.getRooms as (() => Array<{ roomId?: string }>) | undefined
  const rooms = getRoomsMethod?.() || []

  const results = await Promise.allSettled(
    rooms.map((room) => {
      const roomId = room.roomId || ''
      if (!roomId) return Promise.reject(new Error('Invalid room ID'))
      const leaveMethod = client!.leave as ((roomId: string) => Promise<unknown>) | undefined
      return leaveMethod?.(roomId)
    })
  )

  const success: string[] = []
  const failed: Array<{ roomId: string; error: string }> = []

  results.forEach((result, index) => {
    const roomId = rooms[index]?.roomId || ''
    if (result.status === 'fulfilled') {
      success.push(roomId)
    } else {
      failed.push({ roomId, error: String(result.reason) })
    }
  })

  return { success, failed }
}

export async function forgetRoom(roomId: string): Promise<void> {
  const client = (matrixClientService.getClient() ||
    (matrixClientService as unknown as MatrixClientServiceLike).client) as MatrixClientLike | null
  if (!client) throw new Error('Matrix client not initialized')
  await (client.forget as (roomId: string) => Promise<unknown>)(roomId)
}

export async function getJoinedMembers(roomId: string): Promise<string[]> {
  const members = await listJoinedMembers(roomId)
  return members.map((member) => member.userId)
}
