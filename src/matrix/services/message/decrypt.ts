/**
 * Matrix Message Decryption Service
 *
 * Handles decryption of encrypted Matrix messages
 * Migrated from src/services/messageDecryptService.ts
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import { parseMatrixEvent } from '@/utils/messageUtils'
import type { MatrixEvent } from '@/types/matrix'
import type { MsgType } from '@/services/types'

/** Matrix 加密 API 接口 */
interface MatrixCrypto {
  hasEventKeyId?: (event: EventLike) => Promise<boolean>
  decryptEvent?: (event: EventLike) => Promise<EventLike>
  requestRoomKey?: (roomId: string) => Promise<void>
  requestKeysForUser?: (userId: string) => Promise<void>
  [key: string]: unknown
}

/** Matrix 房间成员接口 */
interface MatrixRoomMember {
  userId: string
  [key: string]: unknown
}

/** Matrix 房间扩展接口 */
interface MatrixRoomExtended {
  getJoinedMembers?: () => MatrixRoomMember[]
  [key: string]: unknown
}

/** 解密后的消息类型 */
type DecryptedMessage = MsgType | Record<string, unknown> | unknown

/** 事件类型联合（MatrixEvent 或类似对象） */
type EventLike = {
  getId?: () => string
  getRoomId?: () => string
  getSender?: () => string
  getTs?: () => number
  getContent?: () => Record<string, unknown>
  eventId?: string
  roomId?: string
  sender?: string
  timestamp?: number
  content?: Record<string, unknown>
  [key: string]: unknown
}

export interface DecryptionRequest {
  eventId: string
  roomId: string
  event: EventLike
  resolve: (decrypted: DecryptedMessage) => void
  reject: (error: Error) => void
}

export interface DecryptionStatus {
  /** Total encrypted messages */
  totalEncrypted: number
  /** Successfully decrypted */
  decrypted: number
  /** Failed to decrypt */
  failed: number
  /** Pending decryption */
  pending: number
  /** Last decryption error */
  lastError?: string
}

/**
 * Message Decryption Service
 */
export class MessageDecryptService {
  private static instance: MessageDecryptService
  private decryptionQueue = new Map<string, DecryptionRequest[]>()
  private isProcessing = false
  private status: DecryptionStatus = {
    totalEncrypted: 0,
    decrypted: 0,
    failed: 0,
    pending: 0
  }

  static getInstance(): MessageDecryptService {
    if (!MessageDecryptService.instance) {
      MessageDecryptService.instance = new MessageDecryptService()
    }
    return MessageDecryptService.instance
  }

  /**
   * Initialize the decryption service
   */
  initialize(): void {
    logger.info('[MessageDecryptService] Initializing message decryption service')
  }

  /**
   * Decrypt a message if it's encrypted
   */
  async decryptMessage(event: EventLike): Promise<DecryptedMessage> {
    try {
      // Check if message is encrypted
      if (!this.isEncryptedMessage(event)) {
        return parseMatrixEvent(event as unknown as MatrixEvent) as DecryptedMessage
      }

      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not available')
      }

      const getCryptoMethod = client.getCrypto as (() => MatrixCrypto | null) | undefined
      const crypto = getCryptoMethod?.() as MatrixCrypto | null | undefined
      if (!crypto) {
        logger.warn('[MessageDecryptService] E2EE not available, returning encrypted message')
        return parseMatrixEvent(event as unknown as MatrixEvent) as DecryptedMessage
      }

      const eventId = event.getId ? event.getId() : ((event as Record<string, unknown>).eventId as string | undefined)
      const roomId = event.getRoomId
        ? event.getRoomId()
        : ((event as Record<string, unknown>).roomId as string | undefined)

      logger.debug('[MessageDecryptService] Attempting to decrypt message', { eventId, roomId })

      // Check if we have the keys for this message
      const hasKeys = await crypto.hasEventKeyId?.(event)
      if (!hasKeys) {
        logger.warn('[MessageDecryptService] No keys available for encrypted message', { eventId })
        return this.createUndecryptableMessage(event, 'Keys not available')
      }

      // Attempt decryption
      try {
        const decryptedEvent = await crypto.decryptEvent?.(event)
        logger.debug('[MessageDecryptService] Message decrypted successfully', { eventId })

        // Update status
        this.status.decrypted++

        return parseMatrixEvent(decryptedEvent as unknown as MatrixEvent) as DecryptedMessage
      } catch (error) {
        logger.error('[MessageDecryptService] Failed to decrypt message', {
          eventId,
          error: error instanceof Error ? error.message : String(error)
        })

        // Update status
        this.status.failed++
        this.status.lastError = error instanceof Error ? error.message : String(error)

        return this.createUndecryptableMessage(event, 'Decryption failed')
      }
    } catch (error) {
      logger.error('[MessageDecryptService] Error during message decryption', error)
      return this.createUndecryptableMessage(event, 'Decryption error')
    }
  }

  /**
   * Queue message for decryption
   */
  queueForDecryption(event: EventLike): Promise<DecryptedMessage> {
    return new Promise((resolve, reject) => {
      const eventId = event.getId ? event.getId() : ((event as Record<string, unknown>).eventId as string | undefined)
      const roomId = event.getRoomId
        ? event.getRoomId()
        : ((event as Record<string, unknown>).roomId as string | undefined)

      const request: DecryptionRequest = {
        eventId: eventId!,
        roomId: roomId!,
        event,
        resolve,
        reject
      }

      // Add to queue
      if (!this.decryptionQueue.has(roomId!)) {
        this.decryptionQueue.set(roomId!, [])
      }
      this.decryptionQueue.get(roomId!)!.push(request)

      // Update status
      this.status.totalEncrypted++
      this.status.pending++

      // Start processing if not already processing
      this.processQueue()
    })
  }

  /**
   * Process decryption queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return
    }

    this.isProcessing = true

    try {
      while (this.hasPendingMessages()) {
        const request = this.getNextRequest()
        if (!request) break

        try {
          const decrypted = await this.decryptMessage(request.event)
          request.resolve(decrypted)
          this.status.pending--
        } catch (error) {
          logger.error('[MessageDecryptService] Failed to decrypt queued message', error)
          request.reject(error as Error)
          this.status.pending--
        }
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Check if there are pending messages
   */
  private hasPendingMessages(): boolean {
    for (const requests of this.decryptionQueue.values()) {
      if (requests.length > 0) {
        return true
      }
    }
    return false
  }

  /**
   * Get next request from queue
   */
  private getNextRequest(): DecryptionRequest | null {
    for (const requests of this.decryptionQueue.values()) {
      if (requests.length > 0) {
        return requests.shift()!
      }
    }
    return null
  }

  /**
   * Check if a message is encrypted
   */
  private isEncryptedMessage(event: EventLike): boolean {
    const content = event.getContent ? event.getContent() : (event as Record<string, unknown>).content
    if (typeof content !== 'object' || content === null) {
      return false
    }
    const contentRecord = content as Record<string, unknown>
    return !!(contentRecord.algorithm && contentRecord.ciphertext)
  }

  /**
   * Create a placeholder message for undecryptable content
   */
  private createUndecryptableMessage(event: EventLike, reason: string): DecryptedMessage {
    const eventRecord = event as Record<string, unknown>
    const content = event.getContent ? event.getContent() : eventRecord.content
    const sender = event.getSender ? event.getSender() : eventRecord.sender
    const roomId = event.getRoomId ? event.getRoomId() : eventRecord.roomId
    const eventId = event.getId ? event.getId() : eventRecord.eventId
    const timestamp = event.getTs ? event.getTs() : eventRecord.timestamp

    const contentRecord = typeof content === 'object' && content !== null ? (content as Record<string, unknown>) : {}

    const eventIdStr = String(eventId ?? 'unknown')
    const senderStr = String(sender ?? 'unknown')
    const roomIdStr = String(roomId ?? 'unknown')
    const timestampNum = Number(timestamp ?? Date.now())

    return {
      id: eventIdStr,
      localId: `matrix_${eventIdStr}_undecryptable`,
      type: 'undecryptable',
      body: {
        text: '[无法解密的加密消息]',
        reason,
        algorithm: contentRecord.algorithm
      },
      sendTime: timestampNum,
      fromUser: { uid: senderStr },
      roomId: roomIdStr,
      message: {
        id: eventIdStr,
        type: 'undecryptable',
        body: {
          text: '[无法解密的加密消息]',
          reason,
          algorithm: contentRecord.algorithm
        },
        sendTime: timestampNum,
        fromUser: { uid: senderStr },
        status: 'sent',
        roomId: roomIdStr
      },
      encrypted: true,
      undecryptable: true
    }
  }

  /**
   * Request keys for a room
   */
  async requestRoomKeys(roomId: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        logger.warn('[MessageDecryptService] No client available to request keys')
        return
      }

      const getCryptoMethod = client.getCrypto as (() => MatrixCrypto | null) | undefined
      const crypto = getCryptoMethod?.() as MatrixCrypto | null | undefined
      if (!crypto) {
        logger.warn('[MessageDecryptService] No crypto available to request keys')
        return
      }

      logger.info('[MessageDecryptService] Requesting keys for room', { roomId })

      // Request keys for this room
      await crypto.requestRoomKey?.(roomId)

      // Also request keys for any devices in the room
      const getRoomMethod = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const room = getRoomMethod?.(roomId)
      if (room) {
        const roomLike = room as unknown as MatrixRoomExtended
        const members = roomLike.getJoinedMembers?.() || []
        const userIds = members.map((m: MatrixRoomMember) => m.userId)

        for (const userId of userIds) {
          await crypto.requestKeysForUser?.(userId)
        }
      }

      logger.info('[MessageDecryptService] Room keys requested successfully', { roomId })
    } catch (error) {
      logger.error('[MessageDecryptService] Failed to request room keys', error)
    }
  }

  /**
   * Retry decryption for undecryptable messages
   */
  async retryDecryption(roomId: string): Promise<void> {
    try {
      logger.info('[MessageDecryptService] Retrying decryption for room', { roomId })

      // Request fresh keys
      await this.requestRoomKeys(roomId)

      // Process any pending messages for this room
      const requests = this.decryptionQueue.get(roomId)
      if (requests && requests.length > 0) {
        await this.processQueue()
      }
    } catch (error) {
      logger.error('[MessageDecryptService] Failed to retry decryption', error)
    }
  }

  /**
   * Get decryption status
   */
  getDecryptionStatus(): DecryptionStatus {
    return { ...this.status }
  }

  /**
   * Clear decryption queue
   */
  clearQueue(roomId?: string): void {
    if (roomId) {
      const requests = this.decryptionQueue.get(roomId)
      if (requests) {
        // Reject all pending requests
        requests.forEach((request) => {
          request.reject(new Error('Decryption queue cleared'))
          this.status.pending--
        })
        this.decryptionQueue.delete(roomId)
      }
    } else {
      // Clear all queues
      for (const [_roomId, requests] of this.decryptionQueue.entries()) {
        requests.forEach((request) => {
          request.reject(new Error('All decryption queues cleared'))
        })
        this.status.pending = 0
      }
      this.decryptionQueue.clear()
    }
  }

  /**
   * Reset status
   */
  resetStatus(): void {
    this.status = {
      totalEncrypted: 0,
      decrypted: 0,
      failed: 0,
      pending: 0
    }
  }
}

// Export singleton instance
export const messageDecryptService = MessageDecryptService.getInstance()
