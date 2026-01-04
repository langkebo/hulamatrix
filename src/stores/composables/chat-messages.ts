/**
 * 聊天Store - 消息管理模块
 *
 * 负责管理消息列表、消息加载、消息状态等功能
 */

import { reactive, computed, type Ref, type ComputedRef, type WritableComputedRef } from 'vue'
import { logger } from '@/utils/logger'
import type { MessageType } from '@/services/types'

/** 消息选项类型 */
export interface MessageOptions {
  isLast: boolean
  isLoading: boolean
  cursor: string
}

/** 新消息计数类型 */
export interface NewMessageCount {
  count: number
  isStart: boolean
}

/** 会话更新数据类型 */
export interface SessionUpdateData {
  unreadCount?: number
  lastMessage?: string
  lastMessageTime?: number
  [key: string]: unknown
}

/** 当前房间消息类型 */
export type CurrentMessageMap = ComputedRef<Record<string, MessageType>>

/** 当前消息选项类型 */
export type CurrentMessageOptions = WritableComputedRef<MessageOptions>

/** 当前回复映射类型 */
export type CurrentReplyMap = WritableComputedRef<Record<string, string[]>>

/** 当前新消息计数类型 */
export type CurrentNewMsgCount = ComputedRef<NewMessageCount>

/** 是否显示没有更多消息类型 */
export type ShouldShowNoMoreMessage = ComputedRef<boolean | undefined>

/** 聊天消息列表类型 */
export type ChatMessageList = ComputedRef<MessageType[]>

/** 按房间ID获取消息列表的函数类型 */
export type ChatMessageListByRoomId = ComputedRef<(roomId: string) => MessageType[]>

export interface ChatMessagesComposables {
  // 状态
  messageMap: Record<string, Record<string, MessageType>>
  messageOptions: Record<string, MessageOptions>
  replyMapping: Record<string, Record<string, string[]>>
  newMsgCount: Record<string, NewMessageCount>

  // 当前房间消息
  currentMessageMap: CurrentMessageMap
  currentMessageOptions: CurrentMessageOptions
  currentReplyMap: CurrentReplyMap
  currentNewMsgCount: CurrentNewMsgCount
  shouldShowNoMoreMessage: ShouldShowNoMoreMessage

  // 方法
  getMsgList: (size?: number, async?: boolean) => Promise<void>
  getPageMsg: (pageSize: number, roomId: string, cursor?: string, async?: boolean) => Promise<void>
  pushMsg: (msg: MessageType, options?: { isActiveChatView?: boolean; activeRoomId?: string }) => Promise<void>
  updateMsg: (params: { roomId: string; msgId: string; updates: Partial<MessageType> }) => void
  deleteMsg: (msgId: string) => void
  clearRoomMessages: (roomId: string) => void
  clearNewMsgCount: () => void
  getMsgIndex: (msgId: string) => number
  getMessage: (messageId: string) => MessageType | undefined
  chatMessageList: ChatMessageList
  chatMessageListByRoomId: ChatMessageListByRoomId
  findRoomIdByMsgId: (msgId: string) => string | undefined
  clearRedundantMessages: (roomId: string) => void
  resetAndRefreshCurrentRoomMessages: () => Promise<void>
}

export interface ChatMessagesDeps {
  currentSessionRoomId: Ref<string>
  updateSession?: (roomId: string, data: SessionUpdateData) => void
}

export const pageSize = 20

/**
 * 消息管理 Composable
 */
export function useChatMessages(deps: ChatMessagesDeps): ChatMessagesComposables {
  const { currentSessionRoomId } = deps

  // 存储所有消息的Record
  const messageMap = reactive<Record<string, Record<string, MessageType>>>({})
  // 消息加载状态
  const messageOptions = reactive<Record<string, { isLast: boolean; isLoading: boolean; cursor: string }>>({})

  // 回复消息的映射关系
  const replyMapping = reactive<Record<string, Record<string, string[]>>>({})

  // 新消息计数
  const newMsgCount = reactive<Record<string, { count: number; isStart: boolean }>>({})

  /**
   * 获取消息列表
   */
  const getMsgList = async (size = pageSize, async = false) => {
    const roomId = currentSessionRoomId.value
    if (!roomId) return

    const current = messageOptions[roomId]
    const cursor = current?.cursor || ''

    await getPageMsg(size, roomId, cursor, async)
  }

  /**
   * 分页获取消息
   * 使用 unifiedMessageService.pageMessages() 获取历史消息
   */
  const getPageMsg = async (pageSize: number, roomId: string, cursor = '', _async = false) => {
    try {
      // 初始化加载状态
      if (!messageOptions[roomId]) {
        messageOptions[roomId] = { isLast: false, isLoading: false, cursor: '' }
      }

      messageOptions[roomId].isLoading = true

      // 使用 unifiedMessageService 获取分页消息
      const { pageMessages } = await import('@/services/unified-message-service')
      const messages = await pageMessages(roomId, {
        limit: pageSize,
        cursor: cursor || undefined
      })

      // 如果没有更多消息，标记为已到达最后
      if (messages.length === 0 || messages.length < pageSize) {
        messageOptions[roomId].isLast = true
      }

      // 更新游标（使用最后一条消息的 ID 作为下一次分页的起始点）
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1]
        messageOptions[roomId].cursor =
          ((lastMessage as unknown as Record<string, unknown>)?.eventId as string) || lastMessage.id
      }

      // 处理消息并添加到 messageMap
      if (!messageMap[roomId]) {
        messageMap[roomId] = {}
      }

      for (const msg of messages) {
        const messageType = msg as unknown as MessageType
        if (messageType.message?.id) {
          messageMap[roomId][messageType.message.id] = messageType
        }
      }

      logger.debug('[ChatMessages] 获取消息成功:', { roomId, pageSize, count: messages.length, cursor })
    } catch (error) {
      logger.error('[ChatMessages] 获取消息失败:', error)
    } finally {
      if (messageOptions[roomId]) {
        messageOptions[roomId].isLoading = false
      }
    }
  }

  /**
   * 推送消息
   */
  const pushMsg = async (msg: MessageType, _options: { isActiveChatView?: boolean; activeRoomId?: string } = {}) => {
    const { roomId } = msg.message
    if (!roomId) return

    // 初始化房间消息Map
    if (!messageMap[roomId]) {
      messageMap[roomId] = {}
    }

    // 添加消息
    messageMap[roomId][msg.message.id] = msg

    // 更新新消息计数
    if (!newMsgCount[roomId]) {
      newMsgCount[roomId] = { count: 0, isStart: false }
    }
    newMsgCount[roomId].count++

    logger.debug('[ChatMessages] 添加消息:', msg.message.id)
  }

  /**
   * 更新消息
   */
  const updateMsg = ({ roomId, msgId, updates }: { roomId: string; msgId: string; updates: Partial<MessageType> }) => {
    const roomMessages = messageMap[roomId]
    if (roomMessages && roomMessages[msgId]) {
      const msg = roomMessages[msgId]
      if (msg) {
        Object.assign(msg, updates)
      }
    }
  }

  /**
   * 删除消息
   */
  const deleteMsg = (msgId: string) => {
    for (const roomId in messageMap) {
      if (messageMap[roomId] && messageMap[roomId][msgId]) {
        delete messageMap[roomId][msgId]
        break
      }
    }
  }

  /**
   * 清空新消息计数
   */
  const clearNewMsgCount = () => {
    const roomId = currentSessionRoomId.value
    if (roomId && newMsgCount[roomId]) {
      newMsgCount[roomId] = { count: 0, isStart: false }
    }
  }

  /**
   * 获取消息索引
   */
  const getMsgIndex = (msgId: string): number => {
    const roomId = currentSessionRoomId.value
    const messages = Object.values(messageMap[roomId] || {})
    return messages.findIndex((msg) => msg.message.id === msgId)
  }

  /**
   * 获取消息
   */
  const getMessage = (messageId: string): MessageType | undefined => {
    for (const roomId in messageMap) {
      if (messageMap[roomId] && messageMap[roomId][messageId]) {
        return messageMap[roomId][messageId]
      }
    }
    return undefined
  }

  /**
   * 根据消息ID查找房间ID
   */
  const findRoomIdByMsgId = (msgId: string): string | undefined => {
    for (const roomId in messageMap) {
      if (messageMap[roomId] && messageMap[roomId][msgId]) {
        return roomId
      }
    }
    return undefined
  }

  /**
   * 清理冗余消息
   */
  const clearRedundantMessages = (roomId: string) => {
    const roomMessages = messageMap[roomId]
    if (!roomMessages) return

    const messages = Object.values(roomMessages)
    const MESSAGE_THRESHOLD = 120
    const KEEP_MESSAGE_COUNT = 60

    if (messages.length > MESSAGE_THRESHOLD) {
      // 按时间排序
      const sorted = messages.sort((a, b) => (a.message.sendTime || 0) - (b.message.sendTime || 0))
      // 保留最新的消息
      const toKeep = sorted.slice(-KEEP_MESSAGE_COUNT)
      // 清空并重新填充
      messageMap[roomId] = {}
      toKeep.forEach((msg) => {
        if (messageMap[roomId]) {
          messageMap[roomId][msg.message.id] = msg
        }
      })
    }
  }

  /**
   * 重置并刷新当前房间消息
   */
  const resetAndRefreshCurrentRoomMessages = async () => {
    const roomId = currentSessionRoomId.value
    if (!roomId) return

    if (messageMap[roomId]) {
      messageMap[roomId] = {}
    }
    if (messageOptions[roomId]) {
      messageOptions[roomId] = { isLast: false, isLoading: false, cursor: '' }
    }
    if (newMsgCount[roomId]) {
      newMsgCount[roomId] = { count: 0, isStart: false }
    }
    await getMsgList()
  }

  /**
   * 清空房间消息
   */
  const clearRoomMessages = (roomId: string) => {
    if (messageMap[roomId]) {
      messageMap[roomId] = {}
    }
    if (messageOptions[roomId]) {
      messageOptions[roomId] = { isLast: false, isLoading: false, cursor: '' }
    }
    if (newMsgCount[roomId]) {
      newMsgCount[roomId] = { count: 0, isStart: false }
    }
  }

  // 计算属性
  const currentMessageMap = computed(() => {
    return messageMap[currentSessionRoomId.value] || {}
  })

  const currentMessageOptions = computed<MessageOptions>({
    get: () => {
      const roomId = currentSessionRoomId.value
      if (!messageOptions[roomId]) {
        messageOptions[roomId] = { isLast: false, isLoading: false, cursor: '' }
      }
      return messageOptions[roomId]
    },
    set: (val) => {
      const roomId = currentSessionRoomId.value
      messageOptions[roomId] = val
    }
  })

  const currentReplyMap = computed<Record<string, string[]>>({
    get: () => {
      const roomId = currentSessionRoomId.value
      if (!replyMapping[roomId]) {
        replyMapping[roomId] = {}
      }
      return replyMapping[roomId]
    },
    set: (val) => {
      const roomId = currentSessionRoomId.value
      replyMapping[roomId] = val
    }
  })

  const currentNewMsgCount = computed(() => {
    const roomId = currentSessionRoomId.value
    return newMsgCount[roomId] || { count: 0, isStart: false }
  })

  const shouldShowNoMoreMessage = computed(() => {
    return currentMessageOptions.value?.isLast
  })

  const chatMessageList = computed(() => {
    return Object.values(currentMessageMap.value).sort((a, b) => (a.message.sendTime || 0) - (b.message.sendTime || 0))
  })

  const chatMessageListByRoomId = computed(() => {
    return (roomId: string) => {
      const messages = messageMap[roomId] || {}
      return Object.values(messages).sort((a, b) => (a.message.sendTime || 0) - (b.message.sendTime || 0))
    }
  })

  return {
    // 状态
    messageMap,
    messageOptions,
    replyMapping,
    newMsgCount,

    // 当前房间
    currentMessageMap,
    currentMessageOptions,
    currentReplyMap,
    currentNewMsgCount,
    shouldShowNoMoreMessage,

    // 方法
    getMsgList,
    getPageMsg,
    pushMsg,
    updateMsg,
    deleteMsg,
    clearRoomMessages,
    clearNewMsgCount,
    getMsgIndex,
    getMessage,
    chatMessageList,
    chatMessageListByRoomId,
    findRoomIdByMsgId,
    clearRedundantMessages,
    resetAndRefreshCurrentRoomMessages
  }
}
