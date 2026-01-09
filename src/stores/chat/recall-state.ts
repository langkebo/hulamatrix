/**
 * Chat Store - Recall State Management
 * Handles message recall/cancel functionality
 */

import { reactive } from 'vue'
import { logger } from '@/utils/logger'
import { MsgEnum } from '@/enums'
import type { MessageType, RevokedMsgType } from '@/services/types'
import type { RecalledMessage } from './types'
import { RECALL_EXPIRATION_TIME } from './types'

/**
 * Recall state manager
 */
export class RecallStateManager {
  /** Recalled messages storage */
  recalledMessages: Record<string, RecalledMessage>

  /** Expiration timers for recalled messages */
  private expirationTimers: Record<string, boolean>

  /** Message state manager reference */
  private messageState: {
    findRoomIdByMsgId: (msgId: string) => string
    updateMessage: (roomId: string, msgId: string, updates: Partial<MessageType>) => void
  }

  /** Get message map callback */
  private getMessageMap: () => Record<string, Record<string, MessageType>>

  /** Room store reference */
  private roomStore: {
    getMember: (roomId: string, userId: string) => { name?: string; avatarUrl?: string } | undefined
  }

  constructor(
    messageState: {
      findRoomIdByMsgId: (msgId: string) => string
      updateMessage: (roomId: string, msgId: string, updates: Partial<MessageType>) => void
    },
    getMessageMap: () => Record<string, Record<string, MessageType>>,
    roomStore: {
      getMember: (roomId: string, userId: string) => { name?: string; avatarUrl?: string } | undefined
    }
  ) {
    this.messageState = messageState
    this.getMessageMap = getMessageMap
    this.roomStore = roomStore
    this.recalledMessages = reactive<Record<string, RecalledMessage>>({})
    this.expirationTimers = {}
  }

  /**
   * Record a recalled message
   */
  recordRecallMsg(data: { recallUid: string; msg: MessageType }): void {
    const { recallUid, msg } = data
    const msgId = msg.message.id

    const recallTime = Date.now()
    const originalType = msg.message.type as MsgEnum

    // Store recalled message
    this.recalledMessages[msgId] = {
      messageId: msgId,
      content: JSON.stringify(msg.message.body),
      recallTime,
      originalType
    }

    // Set expiration timer
    this.setExpirationTimer(msgId, RECALL_EXPIRATION_TIME)

    logger.info('[RecallState] Recorded recalled message:', { msgId, recallUid })
  }

  /**
   * Update message to recalled state
   */
  async updateRecallMsg(data: RevokedMsgType): Promise<void> {
    const { msgId, recallUid } = data

    const resolvedRoomId = data.roomId || this.messageState.findRoomIdByMsgId(msgId)
    if (!resolvedRoomId) {
      logger.warn('[RecallState] Cannot find room for recalled message:', { msgId })
      return
    }

    // Get sender and recaller member info
    const senderUid = (data as { senderUid?: string }).senderUid || ''
    const _senderMember = this.roomStore.getMember(resolvedRoomId, senderUid)
    const recallerMember = this.roomStore.getMember(resolvedRoomId, recallUid || '')

    // Update message to recalled type
    const messageMap = this.getMessageMap()
    const msg = messageMap[resolvedRoomId]?.[msgId]
    if (msg) {
      this.messageState.updateMessage(resolvedRoomId, msgId, {
        message: {
          ...msg.message,
          type: MsgEnum.RECALL,
          body: {
            ...msg.message.body,
            content: JSON.stringify({
              operatorName: recallerMember?.name || recallUid,
              content: 'Recalled message',
              recallTime: (data as { recallTime?: number }).recallTime || Date.now()
            })
          }
        }
      })
    }

    logger.info('[RecallState] Updated message to recalled state:', { msgId, resolvedRoomId })
  }

  /**
   * Get recalled message by ID
   */
  getRecalledMessage(msgId: string): RecalledMessage | undefined {
    return this.recalledMessages[msgId]
  }

  /**
   * Set expiration timer for recalled message
   */
  private setExpirationTimer(msgId: string, delay: number): void {
    if (this.expirationTimers[msgId]) {
      return // Timer already set
    }

    this.expirationTimers[msgId] = true

    setTimeout(() => {
      delete this.recalledMessages[msgId]
      delete this.expirationTimers[msgId]
      logger.debug('[RecallState] Expired recalled message:', { msgId })
    }, delay)
  }

  /**
   * Clear all expiration timers
   */
  clearAllExpirationTimers(): void {
    // Clear all timers
    for (const msgId in this.expirationTimers) {
      delete this.expirationTimers[msgId]
    }
    // Clear all recalled messages
    for (const msgId in this.recalledMessages) {
      delete this.recalledMessages[msgId]
    }
    logger.info('[RecallState] Cleared all expiration timers and recalled messages')
  }
}
