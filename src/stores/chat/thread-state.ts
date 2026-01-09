/**
 * Chat Store - Thread State Management
 * Handles thread/message relation functionality
 */

import { logger } from '@/utils/logger'
import { MsgEnum } from '@/enums'
import type { MessageType, MessageBody } from '@/services/types'
import { threadService, type MatrixRoomLike } from '@/services/matrixThreadAdapter'
import type { Ref } from 'vue'
import type { ThreadRoot } from '@/services/matrixThreadAdapter'

/**
 * Thread state manager
 */
export class ThreadStateManager {
  /** Current session room ID reference */
  private getCurrentRoomId: () => string

  /** Matrix client reference */
  private client: Ref<{ getRoom?: (roomId: string) => Record<string, unknown> | null | undefined } | null>

  constructor(
    getCurrentRoomId: () => string,
    client: Ref<{ getRoom?: (roomId: string) => Record<string, unknown> | null | undefined } | null>
  ) {
    this.getCurrentRoomId = getCurrentRoomId
    this.client = client
  }

  /**
   * Get thread info by event ID (returns thread root info)
   */
  async getThreadInfo(eventId: string): Promise<ThreadRoot | null> {
    const roomId = this.getCurrentRoomId()

    try {
      return await threadService.getThreadRoot(eventId, roomId)
    } catch (error) {
      logger.warn('[ThreadState] Failed to get thread info:', { eventId, error })
      return null
    }
  }

  /**
   * Get thread root event ID
   */
  async getThreadRoot(eventId: string): Promise<string | null> {
    const roomId = this.getCurrentRoomId()

    try {
      const threadRoot = await threadService.getThreadRoot(eventId, roomId)
      return threadRoot?.eventId || null
    } catch (error) {
      logger.warn('[ThreadState] Failed to get thread root:', { eventId, error })
      return null
    }
  }

  /**
   * Get threads for current room
   */
  async getRoomThreads(options?: { limit?: number; sortBy?: 'recent' | 'activity' }): Promise<unknown[]> {
    const roomId = this.getCurrentRoomId()

    try {
      return await threadService.getRoomThreads(roomId, options)
    } catch (error) {
      logger.warn('[ThreadState] Failed to get room threads:', { roomId, error })
      return []
    }
  }

  /**
   * Get messages for a thread
   */
  async getThreadMessages(threadRootId: string, options?: { limit?: number; from?: string }): Promise<MessageType[]> {
    const roomId = this.getCurrentRoomId()

    try {
      const messages = await threadService.getThreadMessages(threadRootId, roomId, options)
      return messages as MessageType[]
    } catch (error) {
      logger.warn('[ThreadState] Failed to get thread messages:', { threadRootId, error })
      return []
    }
  }

  /**
   * Send reply to a thread
   */
  async sendThreadReply(threadRootId: string, type: MsgEnum, body: MessageBody | unknown): Promise<MessageType | null> {
    const roomId = this.getCurrentRoomId()

    try {
      const eventId = await threadService.sendThreadReply(
        threadRootId,
        roomId,
        type,
        body as Record<string, unknown> | { text?: string; content?: string; formattedBody?: string }
      )
      logger.info('[ThreadState] Sent thread reply:', { threadRootId, roomId, eventId })
      // Return a mock MessageType since threadService only returns eventId
      return {
        message: {
          id: eventId,
          type,
          body: body as MessageBody,
          roomId,
          timestamp: Date.now()
        }
      } as unknown as MessageType
    } catch (error) {
      logger.warn('[ThreadState] Failed to send thread reply:', { threadRootId, error })
      return null
    }
  }

  /**
   * Mark thread as read
   */
  async markThreadAsRead(threadRootId: string): Promise<boolean> {
    const roomId = this.getCurrentRoomId()

    try {
      await threadService.markThreadAsRead(threadRootId, roomId)
      logger.info('[ThreadState] Marked thread as read:', { threadRootId })
      return true
    } catch (error) {
      logger.warn('[ThreadState] Failed to mark thread as read:', { threadRootId, error })
      return false
    }
  }

  /**
   * Get thread unread count
   */
  async getThreadUnreadCount(threadRootId: string): Promise<number> {
    const roomId = this.getCurrentRoomId()

    try {
      return await threadService.getThreadUnreadCount(threadRootId, roomId)
    } catch (error) {
      logger.warn('[ThreadState] Failed to get thread unread count:', { threadRootId, error })
      return 0
    }
  }

  /**
   * Handle message thread relation
   */
  async handleMessageThreadRelation(message: MessageType): Promise<void> {
    const roomId = this.getCurrentRoomId()

    const getRoomMethod = this.client.value?.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
    const room = getRoomMethod?.(roomId)

    if (!room) {
      logger.debug('[ThreadState] No room for thread relation:', { roomId })
      return
    }

    try {
      const threadRelation = threadService.getThreadRelation(message.message.id, room as unknown as MatrixRoomLike)
      if (threadRelation) {
        logger.info('[ThreadState] Got thread relation:', {
          msgId: message.message.id,
          threadRootId: threadRelation
        })
      }
    } catch (_error) {
      logger.debug('[ThreadState] No thread relation:', { msgId: message.message.id })
    }
  }

  /**
   * Add thread child message
   */
  addThreadChild(rootMsgId: string, childMsgId: string, roomId?: string): void {
    const targetRoomId = roomId || this.getCurrentRoomId()
    // This would be handled by the message state manager
    // which maintains the reply mapping
    logger.debug('[ThreadState] Adding thread child:', { rootMsgId, childMsgId, roomId: targetRoomId })
  }
}
