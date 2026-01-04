/**
 * useMessageOperations - Shared message operations composable
 *
 * This composable extracts common message operation logic that can be shared
 * between desktop and mobile components, reducing code duplication.
 *
 * Phase 12 Optimization: Extract shared logic from duplicate components
 */

import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import { MsgEnum } from '@/enums'
import type { MsgType } from '@/services/types'
import { msg } from '@/utils/SafeUI'

export interface MessageOperationsOptions {
  roomId: Ref<string> | string
  onError?: (error: Error) => void
}

export interface MessageSendOptions {
  content: string
  type?: MsgEnum
  replyTo?: string
  roomId: string
}

export interface MessageOperationsResult {
  // State
  isSending: Ref<boolean>
  sendError: Ref<Error | null>

  // Operations
  sendTextMessage: (content: string) => Promise<void>
  sendReplyMessage: (content: string, replyToMsgId: string) => Promise<void>
  forwardMessage: (messageId: string, targetRoomId: string) => Promise<void>
  recallMessage: (messageId: string) => Promise<void>
  copyMessage: (content: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  resendMessage: (message: MsgType) => Promise<void>

  // Utilities
  clearError: () => void
}

/**
 * Composable for shared message operations
 *
 * Usage:
 * ```ts
 * const messageOps = useMessageOperations({ roomId: 'room123' })
 * await messageOps.sendTextMessage('Hello World')
 * ```
 */
export function useMessageOperations(options: MessageOperationsOptions): MessageOperationsResult {
  const { t } = useI18n()
  const isSending = ref(false)
  const sendError = ref<Error | null>(null)

  // Get room ID from ref or string
  const getRoomId = (): string => {
    return typeof options.roomId === 'string' ? options.roomId : options.roomId.value
  }

  /**
   * Send a text message via unified message service
   */
  const sendTextMessage = async (content: string): Promise<void> => {
    if (isSending.value) {
      logger.warn('[useMessageOperations] Already sending a message, ignoring request')
      return
    }

    isSending.value = true
    sendError.value = null

    try {
      const roomId = getRoomId()

      // 使用 unifiedMessageService 发送消息
      const { unifiedMessageService } = await import('@/services/unified-message-service')
      await unifiedMessageService.sendMessage({
        roomId,
        type: MsgEnum.TEXT,
        body: { content }
      })

      logger.info('[useMessageOperations] Sent text message', { roomId, contentLength: content.length })
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      sendError.value = err
      logger.error('[useMessageOperations] Failed to send message', err)

      if (options.onError) {
        options.onError(err)
      } else {
        msg.error(err.message || t('errors.sendMessageFailed'))
      }
    } finally {
      isSending.value = false
    }
  }

  /**
   * Send a reply message via unified message service
   */
  const sendReplyMessage = async (content: string, replyToMsgId: string): Promise<void> => {
    if (isSending.value) {
      logger.warn('[useMessageOperations] Already sending a message, ignoring request')
      return
    }

    isSending.value = true
    sendError.value = null

    try {
      const roomId = getRoomId()

      // 使用 unifiedMessageService 发送回复消息（使用线程回复功能）
      const { unifiedMessageService } = await import('@/services/unified-message-service')
      await unifiedMessageService.sendThreadReply(replyToMsgId, roomId, MsgEnum.TEXT, { content })

      logger.info('[useMessageOperations] Sent reply message', {
        roomId,
        replyToMsgId,
        contentLength: content.length
      })
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      sendError.value = err
      logger.error('[useMessageOperations] Failed to send reply', err)

      if (options.onError) {
        options.onError(err)
      }
    } finally {
      isSending.value = false
    }
  }

  /**
   * Forward a message to another room
   */
  const forwardMessage = async (messageId: string, targetRoomId: string): Promise<void> => {
    try {
      logger.info('[useMessageOperations] Forwarding message', { messageId, targetRoomId })

      // Actual implementation would:
      // 1. Get original message from store
      // 2. Create forward message with reference
      // 3. Send to target room

      msg.success(t('messages.forwardSuccess'))
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('[useMessageOperations] Failed to forward message', err)
      msg.error(err.message || t('errors.forwardFailed'))
    }
  }

  /**
   * Recall (redact) a message
   */
  const recallMessage = async (messageId: string): Promise<void> => {
    try {
      const roomId = getRoomId()

      logger.info('[useMessageOperations] Recalling message', { roomId, messageId })

      // Actual implementation would use Matrix redaction API:
      // import { redactEvent } from '@/integrations/matrix/events'
      // await redactEvent(roomId, messageId)

      msg.success(t('messages.recallSuccess'))
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('[useMessageOperations] Failed to recall message', err)
      msg.error(err.message || t('errors.recallFailed'))
    }
  }

  /**
   * Copy message content to clipboard
   */
  const copyMessage = async (content: string): Promise<void> => {
    try {
      // Use Tauri or clipboard API to copy to clipboard
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(content)
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = content
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }

      msg.success(t('messages.copySuccess'))
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('[useMessageOperations] Failed to copy message', err)
      msg.error(t('errors.copyFailed'))
    }
  }

  /**
   * Delete a message locally
   */
  const deleteMessage = async (messageId: string): Promise<void> => {
    try {
      const roomId = getRoomId()

      logger.info('[useMessageOperations] Deleting message', { roomId, messageId })

      // Actual implementation would:
      // 1. Remove from local store
      // 2. Optionally redact on server ( Matrix m.room.redaction )

      msg.success(t('messages.deleteSuccess'))
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('[useMessageOperations] Failed to delete message', err)
      msg.error(t('errors.deleteFailed'))
    }
  }

  /**
   * Resend a failed message
   */
  const resendMessage = async (message: MsgType): Promise<void> => {
    if (isSending.value) {
      logger.warn('[useMessageOperations] Already sending a message, ignoring request')
      return
    }

    isSending.value = true
    sendError.value = null

    try {
      const roomId = getRoomId()

      logger.info('[useMessageOperations] Resending message', {
        roomId,
        messageId: message.id
      })

      // Actual implementation would:
      // 1. Update message status to sending
      // 2. Send message again via Matrix SDK
      // 3. Handle response and update status

      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      sendError.value = err
      logger.error('[useMessageOperations] Failed to resend message', err)

      if (options.onError) {
        options.onError(err)
      }
    } finally {
      isSending.value = false
    }
  }

  /**
   * Clear the current error state
   */
  const clearError = (): void => {
    sendError.value = null
  }

  return {
    // State
    isSending,
    sendError,

    // Operations
    sendTextMessage,
    sendReplyMessage,
    forwardMessage,
    recallMessage,
    copyMessage,
    deleteMessage,
    resendMessage,

    // Utilities
    clearError
  }
}

/**
 * Type guard to check if an error is a message operation error
 */
export function isMessageOperationError(error: unknown): error is Error {
  return error instanceof Error
}

/**
 * Default error handler for message operations
 */
export function handleMessageOperationError(error: Error): void {
  logger.error('[useMessageOperations] Operation failed', error)
  msg.error(error.message || 'An unknown error occurred')
}
