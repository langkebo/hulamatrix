import { matrixClientService } from '@/matrix/core/client'
import { useChatStore } from '@/stores/chat'
import { flags } from '@/utils/envFlags'
import { useSettingStore } from '@/stores/setting'
import { useGlobalStore } from '@/stores/global'
import { useDebounceFn } from '@vueuse/core'
import { computeNotificationPolicy } from '@/utils/notificationPolicy'
import { IsAllUserEnum } from '@/services/types'
import type { MessageType } from '@/services/types'
import { EventType } from 'matrix-js-sdk'
import type { MatrixEventLike, MatrixRoomLike } from '@/types/matrix'
import { notificationService } from '@/services/notificationService'

import { logger } from '@/utils/logger'

/**
 * 推送动作类型
 */
type PushAction = string | { notify?: boolean; set_tweak?: string | { sound?: string } }

/**
 * 通知负载
 */
interface NotificationPayload {
  title: string
  body: string
  roomId?: string
  silent?: boolean
  [key: string]: unknown
}

/**
 * Matrix 关系事件
 */
interface MatrixRelationEvent {
  getContent?: () => Record<string, unknown> & { 'm.relates_to'?: { rel_type?: string; key?: string } }
  getSender?: () => string
  getId?: () => string
  [key: string]: unknown
}

export function setupMatrixNotificationBridge() {
  const client = matrixClientService.getClient()
  if (!client) return
  const chatStore = useChatStore()
  const _settingStore = useSettingStore()
  const globalStore = useGlobalStore()

  const _isTauri = typeof window !== 'undefined' && '__TAURI__' in window
  let _lastSoundAt = 0
  const _SOUND_WINDOW_MS = 800
  const previewOf = (ev: MatrixEventLike): string => {
    const t = ev.getType?.() || ''
    const c = ev.getContent?.() || {}
    if (t === 'm.room.message') {
      const mt = c.msgtype
      if (mt === 'm.text') return typeof c.body === 'string' ? c.body : '[消息]'
      if (mt === 'm.image') return '[图片]'
      if (mt === 'm.video') return '[视频]'
      if (mt === 'm.audio') return '[语音]'
      if (mt === 'm.file') return '[文件]'
      return typeof c.body === 'string' ? c.body : '[消息]'
    }
    if (t === 'm.call.invite') return '来电邀请'
    if (t === 'm.call.answer') return '通话接通'
    if (t === 'm.call.hangup') return '通话结束'
    if (t === 'm.call.candidates') return 'ICE 候选交换'
    return '[事件]'
  }

  const notify = async (title: string, body: string, icon?: string, silent?: boolean) => {
    // 使用统一通知服务
    await notificationService.send({
      title,
      body,
      options: {
        icon,
        silent
      }
    })

    // 更新最后播放声音时间（通知服务内部也会处理，这里保留以兼容现有逻辑）
    if (!silent) {
      _lastSoundAt = Date.now()
    }
  }

  let myUserId = ''
  try {
    const getUserIdMethod = client.getUserId as (() => string) | undefined
    myUserId = getUserIdMethod?.() || ''
  } catch (error) {
    logger.warn('[MatrixNotificationBridge] Could not get user ID, using empty string', { error })
    myUserId = ''
  }

  const shouldNotify = (ev: MatrixEventLike): boolean => {
    try {
      const clientLike = client as { getPushActionsForEvent?: (ev: MatrixEventLike) => PushAction[] }
      const actions = clientLike.getPushActionsForEvent?.(ev)
      if (Array.isArray(actions)) {
        return actions.some((a: PushAction) => {
          if (typeof a === 'string') return a === 'notify'
          return a.set_tweak === 'sound' || (typeof a.set_tweak === 'object' && a.set_tweak?.sound !== undefined)
        })
      }
    } catch {}
    return true
  }

  const clientLike = client as { on: (event: string, handler: (...args: unknown[]) => void) => void }
  clientLike.on('event', (...args: unknown[]) => {
    const ev = args[0] as MatrixEventLike
    const type = ev.getType?.() || ''
    if (type === 'm.reaction') {
      const rel = (ev.getRelation?.() || ev.getContent?.()?.['m.relates_to'] || {}) as Record<string, unknown>
      const key = (rel.key || rel['key']) as string | undefined
      const targetId = (rel.event_id || rel['event_id']) as string | undefined
      if (targetId && key) {
        const msg = chatStore.getMessage(targetId)
        if (msg) {
          const marks = msg.message.messageMarks || {}
          const current = marks[key] || { count: 0, userMarked: false }
          current.count = (current.count || 0) + 1
          marks[key] = current
          msg.message.messageMarks = marks
          chatStore.updateMsg({
            msgId: targetId,
            status: msg.message.status,
            message: { body: msg.message.body } as Partial<MessageType>
          })
        }
      }
    }
  })

  if (flags.matrixPushEnabled) {
    clientLike.on('Room.timeline', (...args: unknown[]) => {
      const ev = args[0] as MatrixEventLike
      const room = args[1] as MatrixRoomLike
      const toStartOfTimeline = args[2] as boolean
      if (toStartOfTimeline) return
      const type = ev.getType?.() || ''
      if (type !== 'm.room.message') return
      const sender = ev.getSender?.() || ''
      if (!sender || sender === myUserId) return
      const title = room?.name || room?.getDefaultRoomName?.(myUserId) || '新消息'
      const body = previewOf(ev)
      const roomId = room?.roomId
      const session = roomId ? chatStore.getSession(roomId) : undefined
      const isForeground = typeof document !== 'undefined' && document.visibilityState === 'visible'
      const isActiveChat = globalStore.currentSessionRoomId === roomId
      if (!session) return
      const policy = computeNotificationPolicy({ session, isForeground, isActiveChat })
      if (policy.skip) return
      if (shouldNotify(ev)) {
        const payload: NotificationPayload = { title, body, silent: policy.silent }
        if (roomId !== undefined) payload.roomId = roomId
        enqueueNotify(payload)
      }
    })
  }

  const queue: Array<{ title: string; body: string; roomId?: string; silent?: boolean }> = []
  const flush = () => {
    if (!queue.length) return
    const count = queue.length
    const rooms = Array.from(new Set(queue.map((q) => q.roomId).filter(Boolean)))
    let pick = queue[queue.length - 1] ?? { title: '新消息', body: '[消息]' }
    let maxScore = -1
    for (const q of queue) {
      const s = q.roomId ? chatStore.getSession(q.roomId) : undefined
      const score = (s?.top ? 2 : 0) + (s?.hotFlag === IsAllUserEnum.Yes ? 1 : 0)
      if (score > maxScore) {
        maxScore = score
        pick = q
      }
    }
    const aggregatedTitle = count > 1 ? `有 ${count} 条新消息` : (pick.title ?? '新消息')
    const aggregatedBody = count > 1 ? `来自 ${rooms.length} 个会话` : (pick.body ?? '[消息]')
    const allSilent = queue.every((q) => q.silent)
    notify(aggregatedTitle, aggregatedBody, undefined, allSilent)
    queue.length = 0
  }
  const debouncedFlush = useDebounceFn(flush, 300)
  const enqueueNotify = (n: { title: string; body: string; roomId?: string; silent?: boolean }) => {
    queue.push(n)
    debouncedFlush()
  }
}

// 反应管理工具函数
export interface MessageReaction {
  key: string
  count: number
  userMarked: boolean
  users?: string[]
}

export interface ReactionSummary {
  eventId: string
  reactions: { [key: string]: MessageReaction }
  totalCount: number
  hasCurrentUserReaction: boolean
}

/**
 * 添加消息反应
 */
export async function addMessageReaction(roomId: string, eventId: string, reaction: string): Promise<boolean> {
  try {
    const client = matrixClientService.getClient()
    if (!client) return false

    // 验证反应是否有效
    if (!isValidReaction(reaction)) {
      logger.warn('Invalid reaction:', reaction)
      return false
    }

    const reactionContent = {
      'm.relates_to': {
        rel_type: 'm.annotation',
        event_id: eventId,
        key: reaction
      }
    }

    const clientLike = client as {
      sendEvent: (roomId: string, type: string, content: Record<string, unknown>) => Promise<unknown>
    }
    await clientLike.sendEvent(roomId, EventType.Reaction, reactionContent)
    return true
  } catch (error) {
    logger.error('Failed to add reaction:', error)
    return false
  }
}

/**
 * 移除消息反应
 */
export async function removeMessageReaction(roomId: string, eventId: string, reaction: string): Promise<boolean> {
  try {
    const client = matrixClientService.getClient()
    if (!client) return false

    // 查找用户的反应事件
    const clientLike = client as {
      getUserId?: () => string
      relations?: (
        roomId: string,
        eventId: string,
        relType: string,
        eventType: string,
        opts: { limit: number }
      ) => Promise<{ events: unknown[] } | null>
      redactEvent: (roomId: string, eventId: string) => Promise<unknown>
    }
    const currentUserId = clientLike.getUserId?.()
    if (!currentUserId) return false

    // 通过关系API查找反应事件
    const relations = await clientLike.relations?.(roomId, eventId, 'm.annotation', 'm.reaction', { limit: 100 })
    if (!relations?.events) return false

    const userReaction = relations.events.find((relEvent: unknown) => {
      const event = relEvent as MatrixRelationEvent
      const content = event.getContent?.()
      const relatesTo = content?.['m.relates_to'] as { rel_type?: string; key?: string } | undefined
      return (
        event.getSender?.() === currentUserId && relatesTo?.rel_type === 'm.annotation' && relatesTo?.key === reaction
      )
    }) as MatrixRelationEvent | undefined

    if (userReaction && userReaction.getId) {
      await clientLike.redactEvent(roomId, userReaction.getId())
      return true
    }

    return false
  } catch (error) {
    logger.error('Failed to remove reaction:', error)
    return false
  }
}

/**
 * 切换消息反应
 */
export async function toggleMessageReaction(roomId: string, eventId: string, reaction: string): Promise<boolean> {
  try {
    const hasReaction = await hasUserReaction(roomId, eventId, reaction)

    if (hasReaction) {
      await removeMessageReaction(roomId, eventId, reaction)
      return false
    } else {
      await addMessageReaction(roomId, eventId, reaction)
      return true
    }
  } catch (error) {
    logger.error('Failed to toggle reaction:', error)
    return false
  }
}

/**
 * 检查用户是否已添加反应
 */
export async function hasUserReaction(roomId: string, eventId: string, reaction: string): Promise<boolean> {
  try {
    const client = matrixClientService.getClient()
    if (!client) return false

    const getUserIdMethod = client.getUserId as (() => string) | undefined
    const currentUserId = getUserIdMethod?.()
    if (!currentUserId) return false

    const relationsMethod = client.relations as
      | ((
          roomId: string,
          eventId: string,
          relType: string,
          eventType: string,
          opts: { limit?: number }
        ) => Promise<{ events: unknown[] }>)
      | undefined
    const relations = await relationsMethod?.(roomId, eventId, 'm.annotation', 'm.reaction', { limit: 100 })
    if (!relations?.events) return false

    return relations.events.some((relEvent: unknown) => {
      const event = relEvent as MatrixRelationEvent
      const content = event.getContent?.()
      const relatesTo = content?.['m.relates_to'] as { rel_type?: string; key?: string } | undefined
      return (
        event.getSender?.() === currentUserId && relatesTo?.rel_type === 'm.annotation' && relatesTo?.key === reaction
      )
    })
  } catch (error) {
    logger.error('Failed to check user reaction:', error)
    return false
  }
}

/**
 * 获取消息的所有反应
 */
export async function getMessageReactions(roomId: string, eventId: string): Promise<ReactionSummary> {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      return {
        eventId,
        reactions: {},
        totalCount: 0,
        hasCurrentUserReaction: false
      }
    }

    const getUserIdMethod = client.getUserId as (() => string) | undefined
    const currentUserId = getUserIdMethod?.()
    const relationsMethod = client.relations as
      | ((
          roomId: string,
          eventId: string,
          relType: string,
          eventType: string,
          opts: { limit?: number }
        ) => Promise<{ events: unknown[] }>)
      | undefined
    const relations = await relationsMethod?.(roomId, eventId, 'm.annotation', 'm.reaction', { limit: 100 })
    if (!relations?.events) {
      return {
        eventId,
        reactions: {},
        totalCount: 0,
        hasCurrentUserReaction: false
      }
    }

    const reactions: { [key: string]: MessageReaction } = {}
    let hasCurrentUserReaction = false

    relations.events.forEach((relEvent: unknown) => {
      const event = relEvent as MatrixRelationEvent
      const content = event.getContent?.()
      const relatesTo = content?.['m.relates_to'] as { rel_type?: string; key?: string } | undefined

      if (relatesTo?.rel_type === 'm.annotation' && relatesTo?.key) {
        const key = relatesTo.key
        const sender = event.getSender?.()

        if (!reactions[key]) {
          reactions[key] = {
            key,
            count: 0,
            userMarked: false,
            users: []
          }
        }

        reactions[key].count++
        if (sender && reactions[key].users) {
          reactions[key].users!.push(sender)
        }

        if (sender === currentUserId) {
          reactions[key].userMarked = true
          hasCurrentUserReaction = true
        }
      }
    })

    const totalCount = Object.values(reactions).reduce((sum, r) => sum + r.count, 0)

    return {
      eventId,
      reactions,
      totalCount,
      hasCurrentUserReaction
    }
  } catch (error) {
    logger.error('Failed to get message reactions:', error)
    return {
      eventId,
      reactions: {},
      totalCount: 0,
      hasCurrentUserReaction: false
    }
  }
}

/**
 * 验证反应是否有效
 */
function isValidReaction(reaction: string): boolean {
  return typeof reaction === 'string' && reaction.length > 0 && reaction.length <= 10
}

/**
 * 获取热门反应表情
 */
export function getPopularReactions(): string[] {
  return [
    '👍',
    '👎',
    '❤️',
    '😄',
    '😮',
    '😢',
    '😡',
    '🎉',
    '🔥',
    '👏',
    '🤔',
    '😍',
    '🙄',
    '😭',
    '🤣',
    '✅',
    '❌',
    '⚠️',
    '💯',
    '🚀'
  ]
}

/**
 * 获取反应分类
 */
export interface ReactionCategory {
  name: string
  reactions: string[]
}

export function getReactionCategories(): ReactionCategory[] {
  return [
    {
      name: '表情',
      reactions: ['😄', '😍', '😮', '😢', '😡', '🤔', '🙄', '😭', '🤣']
    },
    {
      name: '手势',
      reactions: ['👍', '👎', '👏', '✊', '✋', '👌', '🤝', '🙏']
    },
    {
      name: '符号',
      reactions: ['❤️', '💔', '✅', '❌', '⚠️', '💯', '🔥', '🎉']
    },
    {
      name: '其他',
      reactions: ['🚀', '💡', '🎯', '⭐', '🌟', '💎', '🎈', '🎁']
    }
  ]
}
