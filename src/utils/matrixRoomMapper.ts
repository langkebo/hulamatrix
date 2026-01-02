/**
 * Matrix Room 到 SessionItem 的映射工具
 * Phase 4: WebSocket 迁移使用
 */

import { matrixClientService } from '@/integrations/matrix/client'
import type { SessionItem } from '@/services/types'
import { RoomTypeEnum } from '@/enums'
import { logger } from '@/utils/logger'

/**
 * Matrix Room 扩展接口
 */
interface MatrixRoomExtended {
  roomId: string
  name: string
  topic?: string
  getJoinedMemberCount(): number
  tags?: Record<string, { order: number }>
  hasEncryptionStateEvent?(): boolean
  /** 获取房间最新事件 */
  timeline?: {
    getEvents?(): Array<{
      getType?(): string
      getContent?(): { body?: string; msgtype?: string }
      getTs?(): number
      getId?(): string
    }>
  }
  /** 获取房间成员 */
  getMember?: (userId: string) => {
    user?: { userId?: string }
    getAvatarUrl?(): string
  }
  /** 检查是否是直接聊天 (m.direct) */
  isDirectRoom?: () => boolean
}

/**
 * 客户端扩展接口
 */
interface MatrixClientExtended {
  getUserId?(): string
  getRoom?(roomId: string): MatrixRoomExtended | null | undefined
  getRooms?(): MatrixRoomExtended[]
}

/**
 * 获取房间头像
 */
function getRoomAvatar(room: MatrixRoomExtended, _baseUrl?: string): string {
  try {
    // 尝试从房间头像获取
    if ('avatar' in room && typeof room.avatar === 'string') {
      return room.avatar
    }

    // 如果是单聊，尝试获取对方用户头像
    const userId = (room as unknown as { dmUserId?: string }).dmUserId
    if (userId && room.getMember) {
      const member = room.getMember(userId)
      if (member?.getAvatarUrl) {
        const avatarUrl = member.getAvatarUrl()
        if (avatarUrl) return avatarUrl
      }
    }

    // 默认头像
    return '/avatar/default.webp'
  } catch (error) {
    logger.warn('[MatrixRoomMapper] Failed to get room avatar:', error)
    return '/avatar/default.webp'
  }
}

/**
 * 获取房间名称
 */
function getRoomName(room: MatrixRoomExtended): string {
  // Matrix SDK 会自动处理房间名称，包括：
  // 1. 房间名称事件 (m.room.name)
  // 2. 对于单聊，使用对方用户的显示名称
  // 3. 对于群聊，使用群组名称
  return room.name || '未命名房间'
}

/**
 * 判断房间类型
 */
function getRoomType(room: MatrixRoomExtended): RoomTypeEnum {
  const memberCount = room.getJoinedMemberCount()
  // 单聊通常只有2个成员，群聊有更多
  return memberCount <= 2 ? RoomTypeEnum.SINGLE : RoomTypeEnum.GROUP
}

/**
 * 判断是否置顶
 */
function isPinned(room: MatrixRoomExtended): boolean {
  // Matrix 使用 m.favourite 标签表示置顶
  return !!room.tags?.['m.favourite']
}

/**
 * 获取最新消息文本
 */
function getLastMessageText(room: MatrixRoomExtended): string {
  try {
    const events = room.timeline?.getEvents?.()
    if (!events || events.length === 0) {
      return ''
    }

    // 获取最新消息 (倒序遍历，找到第一个消息类型的事件)
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i]
      const type = event.getType?.()
      if (type === 'm.room.message') {
        const content = event.getContent?.()
        if (content) {
          // 根据消息类型返回不同的文本
          const msgtype = content.msgtype
          if (msgtype === 'm.text') {
            return content.body || ''
          } else if (msgtype === 'm.image') {
            return '[图片]'
          } else if (msgtype === 'm.video') {
            return '[视频]'
          } else if (msgtype === 'm.audio') {
            return '[语音]'
          } else if (msgtype === 'm.file') {
            return '[文件]'
          } else if (msgtype === 'm.emote') {
            return `/me ${content.body || ''}`
          }
          return content.body || '[消息]'
        }
      }
    }

    return ''
  } catch (error) {
    logger.warn('[MatrixRoomMapper] Failed to get last message:', error)
    return ''
  }
}

/**
 * 获取最后活跃时间
 */
function getLastActiveTime(room: MatrixRoomExtended): number {
  try {
    const events = room.timeline?.getEvents?.()
    if (!events || events.length === 0) {
      return Date.now()
    }

    // 获取最新事件的时间戳
    const latestEvent = events[events.length - 1]
    const ts = latestEvent?.getTs?.()
    return ts ? ts * 1000 : Date.now() // Matrix 时间戳是秒，需要转换为毫秒
  } catch (error) {
    logger.warn('[MatrixRoomMapper] Failed to get last active time:', error)
    return Date.now()
  }
}

/**
 * 检查是否是直接聊天 (单聊)
 * 通过检查 m.direct 账户数据事件
 */
function isDirectRoom(client: MatrixClientExtended, roomId: string): boolean {
  try {
    const getAccountDataMethod = (
      client as {
        getAccountData?: (eventType: string) => Record<string, string[] | undefined>
      }
    ).getAccountData

    if (!getAccountDataMethod) return false

    const directRooms = getAccountDataMethod('m.direct')
    if (!directRooms) return false

    // 检查当前用户是否在 m.direct 列表中
    const userId = client.getUserId?.()
    if (!userId) return false

    const userDirectRooms = directRooms[userId]
    return userDirectRooms?.includes(roomId) ?? false
  } catch {
    return false
  }
}

/**
 * 将 Matrix Room 映射为 SessionItem
 *
 * @param room - Matrix Room 对象
 * @param client - Matrix Client 对象
 * @returns SessionItem
 */
export function matrixRoomToSessionItem(room: MatrixRoomExtended, client: MatrixClientExtended): SessionItem {
  const roomId = room.roomId
  const memberCount = room.getJoinedMemberCount()
  const roomType = getRoomType(room)
  const isDirect = isDirectRoom(client, roomId)

  // 获取对方用户 ID (用于单聊)
  let detailId = roomId
  if (isDirect && memberCount === 2) {
    // 对于单聊，尝试获取对方用户 ID
    const userId = client.getUserId?.()
    if (userId) {
      // 获取房间中除了自己以外的成员
      const members = (room as unknown as { getJoinedMembers?: () => Array<{ userId?: string }> }).getJoinedMembers?.()
      if (members) {
        const otherMember = members.find((m) => m.userId !== userId)
        if (otherMember?.userId) {
          detailId = otherMember.userId
        }
      }
    }
  }

  // 获取房间头像
  const baseUrl = (client as { baseUrl?: string }).baseUrl
  const avatar = getRoomAvatar(room, baseUrl)

  // 构建 SessionItem
  const sessionItem: SessionItem = {
    account: '', // Matrix 不使用 account 字段
    activeTime: getLastActiveTime(room),
    avatar,
    id: roomId,
    detailId,
    hotFlag: 0, // 暂不实现
    name: getRoomName(room),
    roomId,
    text: getLastMessageText(room),
    type: roomType,
    unreadCount: 0, // 未读数需要单独通过 notification 计算
    top: isPinned(room),
    operate: 0, // SessionOperateEnum - 暂不实现
    hide: false,
    muteNotification: 0, // NotificationTypeEnum.RECEPTION - 暂不实现
    shield: false,
    allowScanEnter: true
  }

  return sessionItem
}

/**
 * 获取所有会话列表
 * 使用 Matrix SDK 的 getRooms() 方法
 *
 * @returns Promise<SessionItem[]>
 */
export async function getSessionListFromMatrix(): Promise<SessionItem[]> {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const getRoomsMethod = (client as unknown as MatrixClientExtended).getRooms
    if (!getRoomsMethod) {
      throw new Error('getRooms method not available')
    }

    const rooms = getRoomsMethod.call(client)

    // 过滤掉隐藏的房间（如：没有最新消息的房间）
    const visibleRooms = rooms.filter((room) => {
      // 可以添加更多过滤条件
      return (room.roomId && !room.roomId.startsWith('!')) || room.timeline?.getEvents
    })

    // 将所有房间映射为 SessionItem
    const sessionItems = visibleRooms.map((room) =>
      matrixRoomToSessionItem(room, client as unknown as MatrixClientExtended)
    )

    logger.info('[MatrixRoomMapper] Mapped rooms to session items:', {
      total: rooms.length,
      visible: visibleRooms.length,
      sessions: sessionItems.length
    })

    return sessionItems
  } catch (error) {
    logger.error('[MatrixRoomMapper] Failed to get session list from Matrix:', error)
    throw error
  }
}

/**
 * 获取单个会话
 * 使用 Matrix SDK 的 getRoom() 方法
 *
 * @param roomId - 房间 ID
 * @returns Promise<SessionItem | null>
 */
export async function getSessionFromMatrix(roomId: string): Promise<SessionItem | null> {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const getRoomMethod = (client as unknown as MatrixClientExtended).getRoom
    if (!getRoomMethod) {
      throw new Error('getRoom method not available')
    }

    const room = getRoomMethod.call(client, roomId)
    if (!room) {
      return null
    }

    const sessionItem = matrixRoomToSessionItem(room, client as unknown as MatrixClientExtended)

    logger.info('[MatrixRoomMapper] Mapped room to session item:', {
      roomId,
      sessionItem
    })

    return sessionItem
  } catch (error) {
    logger.error('[MatrixRoomMapper] Failed to get session from Matrix:', {
      roomId,
      error
    })
    return null
  }
}
