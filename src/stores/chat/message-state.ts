/**
 * Chat Store - Message State Management
 * Handles message map, loading, and pagination
 */

import { reactive, computed } from 'vue'
import { logger } from '@/utils/logger'
import type { MessageType } from '@/services/types'
import { sdkPageMessagesWithCursor } from '@/services/messages'
import { prefetchShallowHistory, tryBackfillWhenNoPagination } from '@/integrations/matrix/history'
import type { MessageOptions } from './types'
import { PAGE_SIZE } from './types'

/**
 * Message state manager
 */
export class MessageStateManager {
  /** All messages by room ID */
  messageMap: Record<string, Record<string, MessageType>>

  /** Message loading options by room ID */
  messageOptions: Record<string, MessageOptions>

  /** Reply mapping by room ID */
  replyMapping: Record<string, Record<string, string[]>>

  /** Current session room ID reference */
  private getCurrentRoomId: () => string

  constructor(getCurrentRoomId: () => string) {
    this.getCurrentRoomId = getCurrentRoomId
    this.messageMap = reactive<Record<string, Record<string, MessageType>>>({})
    this.messageOptions = reactive<Record<string, MessageOptions>>({})
    this.replyMapping = reactive<Record<string, Record<string, string[]>>>({})
  }

  /**
   * Get current room's message map
   */
  get currentMessageMap() {
    return computed(() => {
      const roomId = this.getCurrentRoomId()
      return this.messageMap[roomId] || {}
    })
  }

  /**
   * Get current room's message options
   */
  get currentMessageOptions() {
    return computed<MessageOptions>({
      get: () => {
        const roomId = this.getCurrentRoomId()
        const current = this.messageOptions[roomId]
        if (current === undefined) {
          this.messageOptions[roomId] = { isLast: false, isLoading: false, cursor: '' }
        }
        return this.messageOptions[roomId]
      },
      set: (val) => {
        const roomId = this.getCurrentRoomId()
        this.messageOptions[roomId] = val
      }
    })
  }

  /**
   * Get current room's reply map
   */
  get currentReplyMap() {
    return computed<Record<string, string[]>>({
      get: () => {
        const roomId = this.getCurrentRoomId()
        const current = this.replyMapping[roomId]
        if (current === undefined) {
          this.replyMapping[roomId] = {}
        }
        return this.replyMapping[roomId]
      },
      set: (val) => {
        const roomId = this.getCurrentRoomId()
        this.replyMapping[roomId] = val
      }
    })
  }

  /**
   * Check if should show "no more messages" indicator
   */
  get shouldShowNoMoreMessage() {
    return computed(() => {
      return this.currentMessageOptions.value?.isLast
    })
  }

  /**
   * Get chat message list for current room
   */
  get chatMessageList() {
    return computed(() => {
      const currentMap = this.currentMessageMap.value
      if (!currentMap || Object.keys(currentMap).length === 0) return []
      return Object.values(currentMap).sort(
        (a, b) => (a.sendTime || a.message.sendTime || 0) - (b.sendTime || b.message.sendTime || 0)
      )
    })
  }

  /**
   * Get chat message list by room ID
   */
  chatMessageListByRoomId(roomId: string): MessageType[] {
    if (!this.messageMap[roomId] || Object.keys(this.messageMap[roomId]).length === 0) return []
    return Object.values(this.messageMap[roomId]).sort(
      (a, b) => (a.sendTime || a.message.sendTime || 0) - (b.sendTime || b.message.sendTime || 0)
    )
  }

  /**
   * Find room ID by message ID
   */
  findRoomIdByMsgId(msgId: string): string {
    if (!msgId) return ''
    for (const roomId of Object.keys(this.messageMap)) {
      const roomMessages = this.messageMap[roomId]
      if (roomMessages && msgId in roomMessages) {
        return roomId
      }
    }
    return ''
  }

  /**
   * Get page of messages
   */
  async getPageMsg(pageSize: number, roomId: string, cursor: string, _async?: boolean): Promise<void> {
    try {
      const resp = await sdkPageMessagesWithCursor(roomId, pageSize, cursor, true)
      const messages = (resp.data || []) as unknown as MessageType[]

      // 更新消息选项
      this.messageOptions[roomId] = {
        isLast: !resp.hasMore,
        isLoading: false,
        cursor: resp.nextCursor || ''
      }

      // 添加消息到 map
      for (const msg of messages) {
        this.addMessageToMap(roomId, msg)
      }
    } catch (error) {
      logger.warn('[MessageState] Failed to get page messages:', error)
      this.messageOptions[roomId] = {
        isLast: false,
        isLoading: false,
        cursor: ''
      }
    }
  }

  /**
   * Load more messages
   */
  async loadMore(size = PAGE_SIZE): Promise<void> {
    const roomId = this.getCurrentRoomId()
    const options = this.messageOptions[roomId]

    if (options?.isLoading) {
      return
    }

    await this.getPageMsg(size, roomId, options?.cursor || '')
  }

  /**
   * Add message to map
   */
  addMessageToMap(roomId: string, msg: MessageType): void {
    if (!this.messageMap[roomId]) {
      this.messageMap[roomId] = {}
    }
    this.messageMap[roomId][msg.message.id] = msg
  }

  /**
   * Check if message exists in room
   */
  checkMsgExist(roomId: string, msgId: string): boolean {
    return !!this.messageMap[roomId]?.[msgId]
  }

  /**
   * Add reply mapping
   */
  addReplyMapping(roomId: string, rootMsgId: string, childMsgId: string): void {
    if (!this.replyMapping[roomId]) {
      this.replyMapping[roomId] = {}
    }
    if (!this.replyMapping[roomId][rootMsgId]) {
      this.replyMapping[roomId][rootMsgId] = []
    }
    this.replyMapping[roomId][rootMsgId].push(childMsgId)
  }

  /**
   * Update message
   */
  updateMessage(roomId: string, msgId: string, updates: Partial<MessageType>): void {
    const msg = this.messageMap[roomId]?.[msgId]
    if (msg) {
      Object.assign(msg, updates)
    }
  }

  /**
   * Delete message
   */
  deleteMessage(roomId: string, msgId: string): void {
    if (this.messageMap[roomId]) {
      delete this.messageMap[roomId][msgId]
    }
  }

  /**
   * Clear room messages
   */
  clearRoomMessages(roomId: string): void {
    if (this.messageMap[roomId]) {
      this.messageMap[roomId] = {}
    }
    this.messageOptions[roomId] = { isLast: false, isLoading: false, cursor: '' }
  }

  /**
   * Clear redundant messages (keep only recent ones)
   */
  clearRedundantMessages(roomId: string): void {
    const currentMessages = this.messageMap[roomId]
    if (!currentMessages) return

    const sortedMessages = Object.values(currentMessages).sort((a, b) => Number(b.message.id) - Number(a.message.id))

    const keptMessages = sortedMessages.slice(0, PAGE_SIZE)
    const keepMessageIds = new Set(keptMessages.map((msg) => msg.message.id))

    for (const msgId in currentMessages) {
      if (!keepMessageIds.has(msgId)) {
        delete currentMessages[msgId]
      }
    }
  }

  /**
   * Get message by ID from any room
   */
  getMessage(messageId: string): MessageType | undefined {
    for (const roomId of Object.keys(this.messageMap)) {
      const msg = this.messageMap[roomId]?.[messageId]
      if (msg) {
        return msg
      }
    }
    return undefined
  }

  /**
   * Reset and refresh current room messages
   */
  async resetAndRefreshCurrentRoomMessages(): Promise<void> {
    const roomId = this.getCurrentRoomId()
    if (!roomId) return

    // Clear existing messages
    this.clearRoomMessages(roomId)

    // Reload from server
    await this.getPageMsg(PAGE_SIZE, roomId, '')

    // Try backfill if needed
    const opts = this.messageOptions[roomId]
    const isEmpty = !this.messageMap[roomId] || Object.keys(this.messageMap[roomId]).length === 0
    if (opts?.isLast || isEmpty) {
      await tryBackfillWhenNoPagination(roomId, PAGE_SIZE)
      const desired = Math.ceil(PAGE_SIZE * 1.5)
      await prefetchShallowHistory(roomId, desired)
    }
  }
}
