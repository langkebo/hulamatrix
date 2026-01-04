/**
 * Matrix消息管理器
 * 提供消息编辑、删除、替换等高级功能
 */

import type { MatrixClient } from 'matrix-js-sdk'
import type { MatrixEvent as SDKMatrixEvent } from 'matrix-js-sdk'
import type { MatrixEventContent, MatrixRelatesTo, MatrixRoomMessageContent } from '@/types/matrix'
import { logger } from '@/utils/logger'

// Re-export SDK MatrixEvent for convenience
export type MatrixEvent = SDKMatrixEvent

export interface MessageEdit {
  eventId: string
  roomId: string
  originalContent: MatrixEventContent
  newContent: MatrixRoomMessageContent | string
  timestamp: number
  editCount: number
  isEncrypted: boolean
}

export interface MessageDelete {
  eventId: string
  roomId: string
  deletedBy: string
  timestamp: number
  isRedacted: boolean
  reason?: string
}

export interface MessageReplace {
  eventId: string
  roomId: string
  originalEventId: string
  newContent: MatrixRoomMessageContent | string
  timestamp: number
}

export interface MessageReaction {
  eventId: string
  roomId: string
  userId: string
  reaction: string
  timestamp: number
  replaced: string[]
  added: string[]
}

export interface MessageThread {
  rootEventId: string
  roomId: string
  participants: string[]
  messageCount: number
  lastEventId?: string
  isThreaded: boolean
}

export interface MessageStatus {
  eventId: string
  roomId: string
  state: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'edited'
  timestamp: number
  deliveredTo?: string[]
  readBy?: string[]
  encryptionStatus?: 'encrypted' | 'unencrypted' | 'decryption_failed'
}

export type EventListener = (...args: unknown[]) => void

/**
 * Matrix消息管理器
 */
export class MatrixMessageManager {
  private client: MatrixClient
  private messageEdits = new Map<string, MessageEdit>()
  private messageDeletes = new Map<string, MessageDelete>()
  private messageReactions = new Map<string, Map<string, MessageReaction>>()
  private messageThreads = new Map<string, MessageThread>()
  private messageStatus = new Map<string, MessageStatus>()
  private eventListeners = new Map<string, EventListener[]>()

  constructor(client: MatrixClient) {
    this.client = client
    this.setupEventListeners()
    // 异步加载持久化的数据
    this.loadPersistedData()
  }

  /**
   * 加载持久化的数据（状态和线程）
   */
  private async loadPersistedData(): Promise<void> {
    try {
      await Promise.all([this.loadMessageStatus(), this.loadMessageThreads()])
      logger.debug('[MessageManager] Persisted data loaded successfully')
    } catch (error) {
      logger.warn('[MessageManager] Some persisted data failed to load:', error)
    }
  }

  /**
   * Get current user ID
   */
  private getCurrentUserId(): string {
    return (this.client as { getUserId?: () => string }).getUserId?.() || 'unknown'
  }

  /**
   * Get event content safely
   */
  private getEventContent(event: MatrixEvent): MatrixEventContent {
    return ((event as unknown as { getContent?: () => MatrixEventContent }).getContent?.() || {}) as MatrixEventContent
  }

  /**
   * Get event ID safely
   */
  private getEventId(event: MatrixEvent): string {
    return (event as unknown as { getId?: () => string }).getId?.() || ''
  }

  /**
   * Get room ID from event safely
   */
  private getEventRoomId(event: MatrixEvent): string {
    return (event as unknown as { getRoomId?: () => string }).getRoomId?.() || ''
  }

  /**
   * Get sender from event safely
   */
  private getEventSender(event: MatrixEvent): string {
    return (
      (event as unknown as { getSender?: () => string }).getSender?.() ||
      (event as unknown as { sender?: string }).sender ||
      ''
    )
  }

  /**
   * 初始化消息管理器
   */
  async initialize(): Promise<boolean> {
    try {
      // 加载现有的消息状态
      await this.loadMessageStatus()

      // 加载线程信息
      await this.loadMessageThreads()

      // 设置关系事件监听
      this.setupRelationEventListeners()

      this.emit('message_manager:initialized', {})
      return true
    } catch (error) {
      logger.error('Failed to initialize message manager:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.emit('message_manager:error', { error: errorMessage })
      return false
    }
  }

  /**
   * 编辑消息
   */
  async editMessage(
    roomId: string,
    eventId: string,
    newContent: MatrixRoomMessageContent | string,
    messageType: string = 'm.text'
  ): Promise<boolean> {
    try {
      const room = this.client.getRoom(roomId)
      if (!room) {
        throw new Error('Room not found')
      }

      const event = room.findEventById(eventId)
      if (!event) {
        throw new Error('Message not found')
      }

      // 检查是否可以编辑此消息
      if (!this.canEditMessage(event)) {
        throw new Error('Message cannot be edited')
      }

      // 获取原始内容
      const originalContent = this.getEventContent(event)

      // 发送编辑事件
      const newEventResponse = await (
        this.client.sendEvent as (roomId: string, type: string, content: unknown) => Promise<{ event_id: string }>
      )(roomId, 'm.room.message', {
        'm.new_content': {
          msgtype: messageType,
          body: typeof newContent === 'string' ? newContent : newContent.body || '',
          ...(typeof newContent === 'object' ? newContent : {})
        },
        'm.relates_to': {
          rel_type: 'm.replace',
          event_id: eventId
        }
      })

      // 更新编辑历史
      const edit: MessageEdit = {
        eventId: newEventResponse.event_id,
        roomId,
        originalContent,
        newContent,
        timestamp: Date.now(),
        editCount: this.getMessageEditCount(eventId) + 1,
        isEncrypted: (event as unknown as { isEncrypted?: () => boolean }).isEncrypted?.() ?? false
      }

      this.messageEdits.set(newEventResponse.event_id, edit)

      this.emit('message:edited', { roomId, eventId, newEventId: newEventResponse.event_id, edit })
      return true
    } catch (error) {
      logger.error('Failed to edit message:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.emit('message:edit_error', { roomId, eventId, error: errorMessage })
      return false
    }
  }

  /**
   * 删除消息
   */
  async deleteMessage(roomId: string, eventId: string, reason?: string): Promise<boolean> {
    try {
      await this.client.redactEvent(roomId, eventId, reason)

      // 删除成功，记录删除信息
      const deleteInfo: MessageDelete = {
        eventId,
        roomId,
        deletedBy: this.getCurrentUserId(),
        timestamp: Date.now(),
        isRedacted: true,
        reason: reason ?? ''
      }

      this.messageDeletes.set(eventId, deleteInfo)

      this.emit('message:deleted', { roomId, eventId, deleteInfo })

      return true
    } catch (error) {
      logger.error('Failed to delete message:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.emit('message:delete_error', { roomId, eventId, error: errorMessage })
      return false
    }
  }

  /**
   * 替换消息
   */
  async replaceMessage(
    roomId: string,
    originalEventId: string,
    newContent: MatrixRoomMessageContent | string,
    messageType: string = 'm.text'
  ): Promise<string | null> {
    try {
      const response = await (
        this.client.sendEvent as (roomId: string, type: string, content: unknown) => Promise<{ event_id: string }>
      )(roomId, 'm.room.message', {
        'm.new_content': {
          msgtype: messageType,
          body: typeof newContent === 'string' ? newContent : newContent.body || '',
          ...(typeof newContent === 'object' ? newContent : {})
        },
        'm.relates_to': {
          rel_type: 'm.replace',
          event_id: originalEventId
        }
      })

      const replace: MessageReplace = {
        eventId: response.event_id,
        roomId,
        originalEventId,
        newContent,
        timestamp: Date.now()
      }

      this.emit('message:replaced', { roomId, originalEventId, newEventId: response.event_id, replace })
      return response.event_id
    } catch (error) {
      logger.error('Failed to replace message:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.emit('message:replace_error', { roomId, originalEventId, error: errorMessage })
      return null
    }
  }

  /**
   * 添加消息反应
   */
  async addReaction(roomId: string, eventId: string, reaction: string, replace: string[] = []): Promise<boolean> {
    try {
      await (
        this.client.sendEvent as (roomId: string, type: string, content: unknown) => Promise<{ event_id: string }>
      )(roomId, 'm.reaction', {
        'm.relates_to': {
          rel_type: 'm.annotation',
          event_id: eventId,
          key: reaction
        }
      })

      // 更新反应记录
      const reactions = this.messageReactions.get(eventId) || new Map<string, MessageReaction>()
      this.messageReactions.set(eventId, reactions)

      const userId = this.getCurrentUserId()
      const reactionKey = `${reaction}_${userId}`
      const existingReaction = reactions.get(reactionKey)

      // 处理替换
      if (replace.length > 0) {
        replace.forEach((oldReaction) => {
          const oldKey = `${oldReaction}_${userId}`
          if (oldKey !== reactionKey) {
            reactions.delete(oldKey)
          }
        })
      }

      const reactionInfo: MessageReaction = {
        eventId,
        roomId,
        userId,
        reaction,
        timestamp: Date.now(),
        replaced: existingReaction ? existingReaction.replaced : [],
        added: [reaction]
      }

      if (existingReaction) {
        reactionInfo.replaced = [...existingReaction.replaced, ...reactionInfo.added]
      }

      reactions.set(reactionKey, reactionInfo)

      this.emit('reaction:added', { roomId, eventId, reaction, reactionInfo })

      return true
    } catch (error) {
      logger.error('Failed to add reaction:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.emit('reaction:add_error', { roomId, eventId, reaction, error: errorMessage })
      return false
    }
  }

  /**
   * 移除消息反应
   */
  async removeReaction(roomId: string, eventId: string, reaction: string): Promise<boolean> {
    try {
      await (
        this.client.sendEvent as (roomId: string, type: string, content: unknown) => Promise<{ event_id: string }>
      )(roomId, 'm.reaction', {
        'm.relates_to': {
          rel_type: 'm.annotation',
          event_id: eventId,
          key: reaction
        },
        'm.redacted': true
      })

      // 更新反应记录
      const reactions = this.messageReactions.get(eventId)
      if (reactions) {
        const userId = this.getCurrentUserId()
        const reactionKey = `${reaction}_${userId}`
        reactions.delete(reactionKey)

        this.emit('reaction:removed', { roomId, eventId, reaction })
      }

      return true
    } catch (error) {
      logger.error('Failed to remove reaction:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.emit('reaction:remove_error', { roomId, eventId, reaction, error: errorMessage })
      return false
    }
  }

  /**
   * 创建消息线程
   */
  async createThread(
    rootEventId: string,
    roomId: string,
    initialMessage?: MatrixRoomMessageContent | string,
    messageType: string = 'm.text'
  ): Promise<string | null> {
    try {
      // 发送线程回复消息
      const response = await (
        this.client.sendEvent as (roomId: string, type: string, content: unknown) => Promise<{ event_id: string }>
      )(roomId, 'm.room.message', {
        'm.relates_to': {
          rel_type: 'm.thread',
          event_id: rootEventId
        },
        msgtype: messageType,
        body: typeof initialMessage === 'string' ? initialMessage : initialMessage?.body || '',
        ...(typeof initialMessage === 'object' ? initialMessage : {})
      })

      // 更新线程信息
      const userId = this.getCurrentUserId()
      const thread: MessageThread = {
        rootEventId,
        roomId,
        participants: [userId],
        messageCount: 1,
        lastEventId: response.event_id,
        isThreaded: true
      }

      this.messageThreads.set(rootEventId, thread)

      this.emit('thread:created', { rootEventId, roomId, eventId: response.event_id, thread })
      return response.event_id
    } catch (error) {
      logger.error('Failed to create thread:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.emit('thread:create_error', { rootEventId, roomId, error: errorMessage })
      return null
    }
  }

  /**
   * 回复线程
   */
  async replyToThread(
    rootEventId: string,
    roomId: string,
    message: MatrixRoomMessageContent | string,
    messageType: string = 'm.text'
  ): Promise<string | null> {
    try {
      const response = await (
        this.client.sendEvent as (roomId: string, type: string, content: unknown) => Promise<{ event_id: string }>
      )(roomId, 'm.room.message', {
        'm.relates_to': {
          rel_type: 'm.thread',
          event_id: rootEventId
        },
        msgtype: messageType,
        body: typeof message === 'string' ? message : message?.body || '',
        ...(typeof message === 'object' ? message : {})
      })

      // 更新线程信息
      const userId = this.getCurrentUserId()
      const thread = this.messageThreads.get(rootEventId)
      if (thread) {
        thread.messageCount++
        thread.lastEventId = response.event_id

        if (!thread.participants.includes(userId)) {
          thread.participants.push(userId)
        }
      } else {
        // 创建新的线程记录
        this.messageThreads.set(rootEventId, {
          rootEventId,
          roomId,
          participants: [userId],
          messageCount: 1,
          lastEventId: response.event_id,
          isThreaded: true
        })
      }

      this.emit('thread:replied', { rootEventId, roomId, eventId: response.event_id })
      return response.event_id
    } catch (error) {
      logger.error('Failed to reply to thread:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.emit('thread:reply_error', { rootEventId, roomId, error: errorMessage })
      return null
    }
  }

  /**
   * 获取消息编辑历史
   */
  getMessageEditHistory(eventId: string): MessageEdit[] {
    const edits: MessageEdit[] = []

    for (const edit of this.messageEdits.values()) {
      if (edit.eventId === eventId) {
        edits.push(edit)
      }
    }

    return edits.sort((a, b) => a.timestamp - b.timestamp)
  }

  /**
   * 获取消息删除信息
   */
  getMessageDeleteInfo(eventId: string): MessageDelete | undefined {
    return this.messageDeletes.get(eventId)
  }

  /**
   * 获取消息反应
   */
  getMessageReactions(eventId: string): MessageReaction[] {
    const reactions = this.messageReactions.get(eventId)
    return reactions ? Array.from(reactions.values()) : []
  }

  /**
   * 获取消息统计
   */
  getMessageReactionStats(eventId: string): Record<string, number> {
    const reactions = this.getMessageReactions(eventId)
    const stats: Record<string, number> = {}

    reactions.forEach((reaction) => {
      stats[reaction.reaction] = (stats[reaction.reaction] || 0) + 1
    })

    return stats
  }

  /**
   * 获取线程信息
   */
  getThreadInfo(rootEventId: string): MessageThread | undefined {
    return this.messageThreads.get(rootEventId)
  }

  /**
   * 获取房间的所有线程
   */
  getRoomThreads(roomId: string): MessageThread[] {
    const threads: MessageThread[] = []

    for (const thread of this.messageThreads.values()) {
      if (thread.roomId === roomId) {
        threads.push(thread)
      }
    }

    return threads.sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0))
  }

  /**
   * 更新消息状态
   */
  updateMessageStatus(eventId: string, status: Partial<MessageStatus>): void {
    const currentStatus = this.messageStatus.get(eventId)
    const updatedStatus: MessageStatus = {
      eventId,
      roomId: status.roomId || currentStatus?.roomId || '',
      state: status.state || currentStatus?.state || 'sent',
      timestamp: status.timestamp || currentStatus?.timestamp || Date.now(),
      deliveredTo: status.deliveredTo || currentStatus?.deliveredTo || [],
      readBy: status.readBy || currentStatus?.readBy || [],
      encryptionStatus: status.encryptionStatus ?? currentStatus?.encryptionStatus ?? 'unencrypted'
    }
    this.messageStatus.set(eventId, updatedStatus)

    this.emit('message:status_updated', { eventId, status: updatedStatus })
  }

  /**
   * 批量获取消息状态
   */
  getMessageStatuses(eventIds: string[]): Map<string, MessageStatus> {
    const statuses = new Map<string, MessageStatus>()

    eventIds.forEach((eventId) => {
      const status = this.messageStatus.get(eventId)
      if (status) {
        statuses.set(eventId, status)
      }
    })

    return statuses
  }

  /**
   * 搜索消息
   */
  async searchMessages(
    roomId: string,
    query: string,
    filters: {
      sender?: string[]
      types?: string[]
      dateRange?: [number, number]
      threadOnly?: boolean
    } = {}
  ): Promise<unknown[]> {
    try {
      const searchParams: {
        search_terms: string
        filter: {
          room_ids: string[]
          senders?: string[]
          types?: string[]
          start_ts?: number
          end_ts?: number
        }
      } = {
        search_terms: query,
        filter: {
          room_ids: [roomId]
        }
      }

      // 添加发送者过滤
      if (filters.sender && filters.sender.length > 0) {
        searchParams.filter.senders = filters.sender
      }

      // 添加消息类型过滤
      if (filters.types && filters.types.length > 0) {
        searchParams.filter.types = filters.types
      }

      // 添加时间范围过滤
      if (filters.dateRange) {
        searchParams.filter.start_ts = filters.dateRange[0]
        searchParams.filter.end_ts = filters.dateRange[1]
      }

      // 线程过滤
      if (filters.threadOnly) {
        // 只搜索属于线程的消息
        // 在 Matrix 中，线程消息通过 m.relates_to 事件关联，rel_type 为 m.thread
        ;(searchParams.filter as unknown as { rel_types?: string[] }).rel_types = ['m.thread']
      }

      const result = await (
        this.client as { searchRoomEvents?: (params: unknown) => Promise<{ results: unknown[] }> }
      ).searchRoomEvents?.(searchParams)
      return result?.results || []
    } catch (error) {
      logger.error('Failed to search messages:', error)
      return []
    }
  }

  // ========== 私有方法 ==========

  private canEditMessage(event: MatrixEvent): boolean {
    // 检查消息类型
    const eventType = (event as unknown as { getType?: () => string }).getType?.()
    if (eventType !== 'm.room.message') {
      return false
    }

    // 检查发送者
    const sender = this.getEventSender(event)
    const myUserId = this.getCurrentUserId()
    if (sender !== myUserId) {
      return false
    }

    // 检查消息内容
    const content = this.getEventContent(event)
    if (!content || content.msgtype === undefined) {
      return false
    }

    // 检查时间限制（例如24小时内可以编辑）
    const eventTime = (event as unknown as { getTs?: () => number }).getTs?.() ?? Date.now()
    const editTimeLimit = 24 * 60 * 60 * 1000 // 24小时
    if (Date.now() - eventTime > editTimeLimit) {
      return false
    }

    return true
  }

  private getMessageEditCount(eventId: string): number {
    let count = 0

    for (const edit of this.messageEdits.values()) {
      if (edit.eventId === eventId) {
        count++
      }
    }

    return count
  }

  private async loadMessageStatus(): Promise<void> {
    try {
      const storageKey = `matrix_message_status_${this.getCurrentUserId()}`
      const stored = localStorage.getItem(storageKey)

      if (stored) {
        try {
          const data = JSON.parse(stored) as Record<string, MessageStatus>
          const now = Date.now()
          const expiryTime = 7 * 24 * 60 * 60 * 1000 // 7天

          for (const [eventId, status] of Object.entries(data)) {
            // 只加载最近7天的状态
            if (now - status.timestamp < expiryTime) {
              this.messageStatus.set(eventId, status)
            }
          }

          logger.debug('[MessageManager] Loaded message status from storage', {
            count: this.messageStatus.size
          })
        } catch (parseError) {
          logger.warn('[MessageManager] Failed to parse stored message status:', parseError)
          // 清除损坏的数据
          localStorage.removeItem(storageKey)
        }
      }
    } catch (error) {
      logger.warn('[MessageManager] Failed to load message status:', error)
    }
  }

  private async loadMessageThreads(): Promise<void> {
    try {
      const storageKey = `matrix_message_threads_${this.getCurrentUserId()}`
      const stored = localStorage.getItem(storageKey)

      if (stored) {
        try {
          const data = JSON.parse(stored) as Record<string, MessageThread>
          const now = Date.now()
          const expiryTime = 30 * 24 * 60 * 60 * 1000 // 30天

          for (const [threadId, thread] of Object.entries(data)) {
            // 只加载最近30天的线程
            if (now - (thread.lastEventId ? now : thread.messageCount) < expiryTime) {
              this.messageThreads.set(threadId, thread)
            }
          }

          logger.debug('[MessageManager] Loaded message threads from storage', {
            count: this.messageThreads.size
          })
        } catch (parseError) {
          logger.warn('[MessageManager] Failed to parse stored threads:', parseError)
          // 清除损坏的数据
          localStorage.removeItem(storageKey)
        }
      }
    } catch (error) {
      logger.warn('[MessageManager] Failed to load message threads:', error)
    }
  }

  /**
   * 保存消息状态到本地存储
   */
  private saveMessageStatus(): void {
    try {
      const storageKey = `matrix_message_status_${this.getCurrentUserId()}`
      const data = Object.fromEntries(this.messageStatus.entries())
      localStorage.setItem(storageKey, JSON.stringify(data))
    } catch (error) {
      logger.warn('[MessageManager] Failed to save message status:', error)
    }
  }

  private setupRelationEventListeners(): void {
    ;(this.client as { on?: (event: string, listener: (...args: unknown[]) => void) => void }).on?.(
      'Event',
      (...args: unknown[]) => {
        const event = args[0] as MatrixEvent
        const content = this.getEventContent(event)
        if (content && typeof content === 'object') {
          this.handleRelationEvent(event)
        }
      }
    )
  }

  private handleRelationEvent(event: MatrixEvent): void {
    const content = this.getEventContent(event)
    const relatesTo = content?.['m.relates_to'] as MatrixRelatesTo | undefined

    if (!relatesTo) {
      return
    }

    switch (relatesTo.rel_type) {
      case 'm.replace':
        this.handleMessageEdit(event)
        break

      case 'm.annotation':
        this.handleReactionEvent(event, relatesTo)
        break

      case 'm.thread':
        this.handleThreadEvent(event, relatesTo)
        break
    }
  }

  private handleMessageEdit(event: MatrixEvent): void {
    const content = this.getEventContent(event)
    const relatesTo = content?.['m.relates_to'] as MatrixRelatesTo | undefined
    const originalEventId = relatesTo?.event_id

    if (!originalEventId) return

    // 更新消息状态
    const status = this.messageStatus.get(originalEventId)
    if (status) {
      status.state = 'edited'
      this.messageStatus.set(originalEventId, status)
      // 保存状态到存储
      this.saveMessageStatus()
    }

    this.emit('message:edit_received', {
      eventId: this.getEventId(event),
      originalEventId,
      roomId: this.getEventRoomId(event)
    })
  }

  private handleReactionEvent(event: MatrixEvent, relatesTo: MatrixRelatesTo): void {
    const content = this.getEventContent(event)
    const isRedacted = content?.['m.redacted']

    if (isRedacted) {
      this.emit('reaction:removed_received', {
        eventId: this.getEventId(event),
        originalEventId: relatesTo?.event_id,
        reaction: relatesTo?.key,
        roomId: this.getEventRoomId(event)
      })
    } else {
      this.emit('reaction:added_received', {
        eventId: this.getEventId(event),
        originalEventId: relatesTo?.event_id,
        reaction: relatesTo?.key,
        roomId: this.getEventRoomId(event),
        sender: this.getEventSender(event)
      })
    }
  }

  private handleThreadEvent(event: MatrixEvent, relatesTo: MatrixRelatesTo): void {
    const rootEventId = relatesTo?.event_id

    if (!rootEventId) return

    // 更新或创建线程
    let thread = this.messageThreads.get(rootEventId)
    if (!thread) {
      thread = {
        rootEventId,
        roomId: this.getEventRoomId(event) || '',
        participants: [],
        messageCount: 0,
        isThreaded: true
      }
      this.messageThreads.set(rootEventId, thread)
    }

    thread.messageCount++
    thread.lastEventId = this.getEventId(event) || ''

    const sender = this.getEventSender(event)
    if (sender && !thread.participants.includes(sender)) {
      thread.participants.push(sender)
    }

    this.emit('thread:updated', { rootEventId, thread })
  }

  private setupEventListeners(): void {
    // Matrix客户端事件
    ;(this.client as { on?: (event: string, listener: (...args: unknown[]) => void) => void }).on?.(
      'event.redacted',
      (...args: unknown[]) => {
        const event = args[0] as MatrixEvent
        const relatedEvent = args[1] as MatrixEvent
        this.handleRedactionEvent(event, relatedEvent)
      }
    )
  }

  public async retryDecryption(roomId: string, eventId: string, maxRetries = 2) {
    const room = this.client.getRoom(roomId)
    if (!room) return false
    const ev = (room as { findEventById?: (id: string) => MatrixEvent | null }).findEventById?.(eventId)
    if (!ev) return false
    const attemptDecrypt = (ev as { attemptDecryption?: (client: unknown, opts?: unknown) => Promise<void> })
      .attemptDecryption
    if (!attemptDecrypt) return false
    let attempt = 0
    while (attempt < maxRetries) {
      try {
        await attemptDecrypt(this.client, { retry: true })
        this.updateMessageStatus(eventId, { roomId, encryptionStatus: 'encrypted' })
        return true
      } catch {
        attempt++
        await new Promise((r) => setTimeout(r, 300 * attempt))
      }
    }
    this.updateMessageStatus(eventId, { roomId, encryptionStatus: 'decryption_failed' })
    return false
  }

  private handleRedactionEvent(event: MatrixEvent, relatedEvent: MatrixEvent): void {
    if (relatedEvent) {
      const content = this.getEventContent(event)
      const eventTimestamp = (event as unknown as { getTs?: () => number }).getTs?.() || Date.now()
      const deleteInfo: MessageDelete = {
        eventId: this.getEventId(event),
        roomId: this.getEventRoomId(event),
        deletedBy: this.getEventSender(event),
        timestamp: eventTimestamp,
        isRedacted: true
      }
      if (content?.reason !== undefined) deleteInfo.reason = content.reason as string

      this.messageDeletes.set(this.getEventId(relatedEvent), deleteInfo)

      this.emit('message:redacted', {
        eventId: this.getEventId(relatedEvent),
        deleteInfo,
        roomId: this.getEventRoomId(event)
      })
    }
  }

  private emit(event: string, data: Record<string, unknown>) {
    const listeners = this.eventListeners.get(event) || []
    listeners.forEach((listener) => {
      try {
        listener(data)
      } catch (error) {
        logger.error(`Error in message manager event listener for ${event}:`, error)
      }
    })
  }

  /**
   * 事件监听器管理
   */
  public addEventListener(event: string, listener: EventListener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(listener)
  }

  public removeEventListener(event: string, listener: EventListener) {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  /**
   * 清理资源
   */
  public destroy() {
    this.messageEdits.clear()
    this.messageDeletes.clear()
    this.messageReactions.clear()
    this.messageThreads.clear()
    this.messageStatus.clear()
    this.eventListeners.clear()
  }
}

/**
 * 创建消息管理器
 */
export function createMessageManager(client: MatrixClient): MatrixMessageManager {
  return new MatrixMessageManager(client)
}
