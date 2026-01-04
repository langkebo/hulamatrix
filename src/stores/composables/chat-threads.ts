/**
 * 聊天Store - 线程管理模块
 *
 * 负责管理Matrix线程相关功能
 */

import { logger } from '@/utils/logger'
import { MsgEnum } from '@/enums'
import type { MessageType } from '@/services/types'
import { threadService, type ThreadRoot as AdapterThreadRoot } from '@/services/matrixThreadAdapter'
import { matrixClientService } from '@/integrations/matrix/client'

/** 线程信息类型 */
export interface ThreadInfo {
  id: string
  rootEventId: string
  roomId: string
  participantCount: number
  lastEventId?: string
  [key: string]: unknown
}

/** 线程根消息类型 */
export interface ThreadRoot {
  eventId: string
  roomId: string
  content: unknown
  senderId?: string
  timestamp?: number
  [key: string]: unknown
}

/** 线程消息类型 */
export interface ThreadMessage {
  eventId: string
  roomId: string
  sender: string
  content: unknown
  timestamp: number
  [key: string]: unknown
}

/** 线程消息关系类型 */
export interface MessageRelatesTo {
  rel_type: string
  event_id: string
  [key: string]: unknown
}

export interface ChatThreadsComposables {
  // 方法
  getThreadInfo: (eventId: string) => Promise<ThreadInfo | null>
  getThreadRoot: (eventId: string) => Promise<ThreadRoot | null>
  getRoomThreads: (options?: { limit?: number; sortBy?: 'recent' | 'activity' }) => Promise<ThreadInfo[]>
  getThreadMessages: (
    threadRootId: string,
    roomId: string,
    options?: { from?: string; limit?: number; dir?: 'b' | 'f' }
  ) => Promise<ThreadMessage[]>
  sendThreadReply: (threadRootId: string, type: MsgEnum, body: unknown) => Promise<void>
  markThreadAsRead: (threadRootId: string) => Promise<void>
  getThreadUnreadCount: (threadRootId: string) => Promise<number>
  handleMessageThreadRelation: (message: MessageType) => Promise<void>
  addThreadChild: (rootMsgId: string, childMsgId: string, roomId?: string) => void
}

export interface ChatThreadsDeps {
  currentSessionRoomId?: { value: string }
  replyMapping?: Record<string, Record<string, string[]>>
}

/**
 * 线程管理 Composable
 */
export function useChatThreads(deps?: ChatThreadsDeps): ChatThreadsComposables {
  const { currentSessionRoomId, replyMapping } = deps || {}

  /**
   * 获取线程信息
   */
  const getThreadInfo = async (eventId: string) => {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        logger.warn('[ChatThreads] Matrix client not available')
        return null
      }

      const roomId = currentSessionRoomId?.value || ''
      if (!roomId) {
        logger.warn('[ChatThreads] No active room')
        return null
      }

      // 使用 threadService 获取线程根消息
      const threadRoot = await threadService.getThreadRoot(eventId, roomId)
      if (!threadRoot) {
        return null
      }

      // 构建线程信息
      return {
        id: threadRoot.eventId,
        rootEventId: threadRoot.eventId,
        roomId: threadRoot.roomId,
        participantCount: threadRoot.participants?.length || 0,
        lastEventId: threadRoot.latestEventId
      }
    } catch (error) {
      logger.error('[ChatThreads] 获取线程信息失败:', error)
      return null
    }
  }

  /**
   * 获取线程根消息
   */
  const getThreadRoot = async (eventId: string): Promise<ThreadRoot | null> => {
    try {
      const roomId = currentSessionRoomId?.value || ''
      if (!roomId) {
        logger.warn('[ChatThreads] No active room')
        return null
      }

      // 使用 threadService 获取线程根消息
      const adapterThreadRoot = await threadService.getThreadRoot(eventId, roomId)
      if (!adapterThreadRoot) {
        return null
      }

      // 转换为本地 ThreadRoot 类型
      return {
        eventId: adapterThreadRoot.eventId,
        roomId: adapterThreadRoot.roomId,
        content: adapterThreadRoot.body,
        senderId: adapterThreadRoot.senderId,
        timestamp: adapterThreadRoot.timestamp
      }
    } catch (error) {
      logger.error('[ChatThreads] 获取线程根消息失败:', error)
      return null
    }
  }

  /**
   * 获取房间的所有线程
   */
  const getRoomThreads = async (options?: { limit?: number; sortBy?: 'recent' | 'activity' }) => {
    try {
      const roomId = currentSessionRoomId?.value || ''
      if (!roomId) {
        logger.warn('[ChatThreads] No active room')
        return []
      }

      // 使用 threadService 获取房间线程 (第一个参数是 roomId 字符串)
      const threads = await threadService.getRoomThreads(roomId, options)
      return threads.map((t: AdapterThreadRoot) => ({
        id: t.eventId,
        rootEventId: t.eventId,
        roomId: t.roomId,
        participantCount: t.participants?.length || 0,
        lastEventId: t.latestEventId
      }))
    } catch (error) {
      logger.error('[ChatThreads] 获取房间线程失败:', error)
      return []
    }
  }

  /**
   * 获取线程消息
   */
  const getThreadMessages = async (
    threadRootId: string,
    roomId: string,
    options?: { from?: string; limit?: number; dir?: 'b' | 'f' }
  ) => {
    try {
      // 使用 threadService 获取线程消息 (返回 unknown[])
      const messages = await threadService.getThreadMessages(threadRootId, roomId, options)
      return messages.map((m: unknown) => {
        // 类型断言处理未知类型
        const msg = m as Record<string, unknown>
        return {
          eventId: (msg.eventId as string) || '',
          roomId: (msg.roomId as string) || roomId,
          sender: (msg.sender as string) || '',
          content: msg.content,
          timestamp: (msg.timestamp as number) || 0
        }
      })
    } catch (error) {
      logger.error('[ChatThreads] 获取线程消息失败:', error)
      return []
    }
  }

  /**
   * 发送线程回复
   */
  const sendThreadReply = async (threadRootId: string, type: MsgEnum, body: unknown) => {
    const roomId = currentSessionRoomId?.value || ''
    try {
      // 使用 threadService 发送线程回复
      await threadService.sendThreadReply(threadRootId, roomId, type, body as Record<string, unknown>)
      logger.info('[ChatThreads] 发送线程回复成功:', { threadRootId, roomId, type })
    } catch (error) {
      logger.error('[ChatThreads] 发送线程回复失败:', error)
      throw error
    }
  }

  /**
   * 标记线程为已读
   */
  const markThreadAsRead = async (threadRootId: string) => {
    const roomId = currentSessionRoomId?.value || ''
    try {
      // 使用 threadService 标记线程已读
      await threadService.markThreadAsRead(threadRootId, roomId)
      logger.info('[ChatThreads] 标记线程已读成功:', { threadRootId, roomId })
    } catch (error) {
      logger.error('[ChatThreads] 标记线程已读失败:', error)
      throw error
    }
  }

  /**
   * 获取线程未读数
   */
  const getThreadUnreadCount = async (threadRootId: string) => {
    try {
      const roomId = currentSessionRoomId?.value || ''
      if (!roomId) {
        return 0
      }

      // 使用 threadService 获取线程未读数
      const count = await threadService.getThreadUnreadCount(threadRootId, roomId)
      return count
    } catch (error) {
      logger.error('[ChatThreads] 获取线程未读数失败:', error)
      return 0
    }
  }

  /**
   * 添加线程子消息
   */
  const addThreadChild = (rootMsgId: string, childMsgId: string, roomId?: string) => {
    if (replyMapping) {
      const targetRoomId = roomId || currentSessionRoomId?.value || ''
      if (!targetRoomId) return
      if (!replyMapping[targetRoomId]) {
        replyMapping[targetRoomId] = {}
      }
      if (!replyMapping[targetRoomId][rootMsgId]) {
        replyMapping[targetRoomId][rootMsgId] = []
      }
      if (!replyMapping[targetRoomId][rootMsgId].includes(childMsgId)) {
        replyMapping[targetRoomId][rootMsgId].push(childMsgId)
      }
    }
  }

  /**
   * 处理消息线程关系
   */
  const handleMessageThreadRelation = async (message: MessageType) => {
    try {
      // 检查消息是否属于线程
      const messageWithRelates = message.message as MessageType['message'] & { relates_to?: MessageRelatesTo }
      const relatesTo = messageWithRelates.relates_to
      if (!relatesTo || relatesTo.rel_type !== 'm.thread') {
        return
      }

      const threadRootId = relatesTo.event_id
      if (!threadRootId) {
        return
      }

      // 添加到回复映射
      if (replyMapping && currentSessionRoomId) {
        const roomId = currentSessionRoomId.value
        if (!replyMapping[roomId]) {
          replyMapping[roomId] = {}
        }
        if (!replyMapping[roomId][threadRootId]) {
          replyMapping[roomId][threadRootId] = []
        }
        if (!replyMapping[roomId][threadRootId].includes(message.message.id)) {
          replyMapping[roomId][threadRootId].push(message.message.id)
        }
      }

      logger.debug('[ChatThreads] 处理消息线程关系:', { threadRootId, messageId: message.message.id })
    } catch (error) {
      logger.error('[ChatThreads] 处理消息线程关系失败:', error)
    }
  }

  return {
    getThreadInfo,
    getThreadRoot,
    getRoomThreads,
    getThreadMessages,
    sendThreadReply,
    markThreadAsRead,
    getThreadUnreadCount,
    handleMessageThreadRelation,
    addThreadChild
  }
}
