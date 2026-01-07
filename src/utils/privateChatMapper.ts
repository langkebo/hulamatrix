/**
 * PrivateChat 会话映射工具
 * 将 PrivateChat SDK 的数据模型转换为项目统一的 SessionItem 格式
 */

import type { PrivateChatSessionWithUI } from '@/stores/privateChatSDK'
import type { SessionItem } from '@/services/types'
import { RoomTypeEnum, NotificationTypeEnum } from '@/enums'
import { IsAllUserEnum, SessionOperateEnum } from '@/services/types'
import { logger } from '@/utils/logger'

/**
 * 将 PrivateChatSession 映射为 SessionItem
 *
 * 映射规则：
 * - roomId: 使用 "pc_" + session_id 前缀，避免与 Matrix roomId 冲突
 * - type: RoomTypeEnum.SINGLE（PrivateChat 都是单聊）
 * - isPrivateChat: true 标识这是 PrivateChat 会话
 * - privateChatSessionId: 保存原始的 session_id 用于 API 调用
 */
export function mapPrivateChatSessionToSessionItem(
  session: PrivateChatSessionWithUI,
  currentUserId?: string
): SessionItem {
  const now = Date.now()
  const isActive = !session.expires_at || new Date(session.expires_at) > new Date()

  // 获取对方用户 ID（第一个非自己的参与者）
  const otherUserId = session.participants.find((id) => id !== currentUserId) || session.participants[0] || ''

  // 构造 roomId，使用 "pc_" 前缀避免与 Matrix roomId 冲突
  const roomId = `pc_${session.session_id}`

  return {
    // 基础字段
    account: currentUserId || '',
    roomId,
    id: roomId,
    detailId: otherUserId,

    // 显示字段
    name: session.display_name || session.session_name || '私聊',
    avatar: session.avatar_url || '/avatar/default.webp',
    text: session.last_message?.content || '暂无消息',

    // 状态字段
    activeTime: session.updated_at ? Date.parse(session.updated_at) : now,
    unreadCount: session.unread_count || 0,
    activeStatus: isActive ? 1 : 2, // OnlineEnum: 1=在线, 2=离线

    // 类型字段
    type: RoomTypeEnum.SINGLE,
    isPrivateChat: true,
    privateChatSessionId: session.session_id,

    // 默认值
    hotFlag: IsAllUserEnum.Not,
    top: false,
    operate: SessionOperateEnum.DELETE_FRIEND, // 默认值，实际不使用
    hide: false,
    muteNotification: NotificationTypeEnum.RECEPTION,
    shield: false,
    isCheck: false,
    allowScanEnter: true,

    // 可选字段
    memberNum: session.participants.length
  }
}

/**
 * 检查 SessionItem 是否为 PrivateChat 会话
 */
export function isPrivateChatSession(session: SessionItem): boolean {
  return !!session.isPrivateChat && session.roomId.startsWith('pc_')
}

/**
 * 从 roomId 提取 PrivateChat session_id
 */
export function extractPrivateChatSessionId(roomId: string): string | null {
  if (roomId.startsWith('pc_')) {
    return roomId.substring(3) // 移除 "pc_" 前缀
  }
  return null
}

/**
 * 批量映射 PrivateChat 会话列表
 */
export function mapPrivateChatSessionsToSessionItems(
  sessions: PrivateChatSessionWithUI[],
  currentUserId?: string
): SessionItem[] {
  return sessions.map((session) => mapPrivateChatSessionToSessionItem(session, currentUserId))
}

/**
 * 合并 Matrix 会话列表和 PrivateChat 会话列表
 * 按活跃时间降序排序
 */
export function mergeSessionLists(matrixSessions: SessionItem[], privateChatSessions: SessionItem[]): SessionItem[] {
  // 合并并去重（基于 roomId）
  const allSessions = [...matrixSessions]

  for (const pcSession of privateChatSessions) {
    // 检查是否已存在（理论上不会存在，因为 roomId 前缀不同）
    const exists = allSessions.some((s) => s.roomId === pcSession.roomId)
    if (!exists) {
      allSessions.push(pcSession)
    }
  }

  // 按活跃时间降序排序，置顶的优先
  return allSessions.sort((a, b) => {
    if (a.top && !b.top) return -1
    if (!a.top && b.top) return 1
    return b.activeTime - a.activeTime
  })
}

/**
 * 日志辅助函数 - 调试会话映射
 */
export function logSessionMapping(privateChatSession: PrivateChatSessionWithUI, mappedSession: SessionItem): void {
  logger.debug('[PrivateChatMapper] Session mapped', {
    original: {
      session_id: privateChatSession.session_id,
      participants: privateChatSession.participants,
      display_name: privateChatSession.display_name
    },
    mapped: {
      roomId: mappedSession.roomId,
      name: mappedSession.name,
      isPrivateChat: mappedSession.isPrivateChat
    }
  })
}
