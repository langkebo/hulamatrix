import { ref, type Ref } from 'vue'
import { useMessage } from 'naive-ui'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import type { MatrixMessage } from '@/types/matrix'

export interface FormatRange {
  start: number
  end: number
  type: 'bold' | 'italic' | 'strike'
}

export interface MessageSendEvent {
  eventId: string
  type: string
  body: string
  formattedBody?: string
  [key: string]: unknown // Index signature for emit compatibility
}

interface UseMessageSenderOptions {
  roomId: Ref<string>
  editingMessage?: Ref<MatrixMessage | null>
  formatRanges?: Ref<FormatRange[]>
  onSend?: (event: MessageSendEvent) => void
  onEdit?: (messageId: string, content: string) => void
  onClearEditor?: () => void
}

interface UseMessageSenderReturn {
  // States
  sending: Ref<boolean>

  // Actions
  sendMessage: (content: string, generateFormattedBody: (content: string) => string) => Promise<void>
}

/**
 * Composable for sending and editing messages
 * Handles Matrix SDK integration for message operations
 */
export function useMessageSender(options: UseMessageSenderOptions): UseMessageSenderReturn {
  const { roomId, editingMessage, formatRanges, onSend, onEdit, onClearEditor } = options
  const message = useMessage()

  // States
  const sending = ref(false)

  /**
   * Escape HTML special characters
   */
  const escapeHtml = (text: string): string => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  /**
   * Generate Matrix formatted_body from plain text and format ranges
   * Converts formatting to HTML according to Matrix spec
   */
  const generateFormattedBodyInternal = (plainText: string): string => {
    if (!formatRanges || formatRanges.value.length === 0) {
      // No formatting, just escape HTML and convert line breaks
      return escapeHtml(plainText).replace(/\n/g, '<br>')
    }

    // Sort ranges by start position
    const sortedRanges = [...formatRanges.value].sort((a, b) => a.start - b.start)

    // Build HTML with formatting tags
    let html = ''
    let lastIndex = 0

    // Merge overlapping ranges and apply tags
    for (const range of sortedRanges) {
      // Add text before this format
      if (range.start > lastIndex) {
        html += escapeHtml(plainText.substring(lastIndex, range.start)).replace(/\n/g, '<br>')
      }

      // Get the text for this range
      const text = plainText.substring(range.start, range.end)

      // Apply format tag
      const tag = range.type === 'bold' ? 'strong' : range.type === 'italic' ? 'em' : 'del'
      html += `<${tag}>${escapeHtml(text).replace(/\n/g, '<br>')}</${tag}>`

      lastIndex = range.end
    }

    // Add remaining text
    if (lastIndex < plainText.length) {
      html += escapeHtml(plainText.substring(lastIndex)).replace(/\n/g, '<br>')
    }

    return html
  }

  /**
   * Send or edit a message
   * Handles both new message creation and message editing via Matrix SDK
   */
  const sendMessage = async (content: string, generateFormattedBody?: (content: string) => string): Promise<void> => {
    if (!content.trim()) return

    sending.value = true

    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix 客户端未初始化')
      }

      const sendEventMethod = client.sendEvent as
        | ((
            roomId: string,
            eventType: string,
            content: Record<string, unknown>
          ) => Promise<{ event_id?: string } | string>)
        | undefined

      if (!sendEventMethod) {
        throw new Error('发送功能不可用')
      }

      // Use provided formatted body generator or internal one
      const formattedBodyFn = generateFormattedBody || generateFormattedBodyInternal

      if (editingMessage && editingMessage.value) {
        // Edit existing message using Matrix SDK
        const formattedBody = formattedBodyFn(content)
        const editContent = {
          msgtype: 'm.text',
          body: content,
          format: 'org.matrix.custom.html',
          formatted_body: formattedBody,
          'm.new_content': {
            msgtype: 'm.text',
            body: content,
            format: 'org.matrix.custom.html',
            formatted_body: formattedBody
          },
          'm.relates_to': {
            event_id: editingMessage.value.eventId,
            rel_type: 'm.replace'
          }
        }

        const result = await sendEventMethod(roomId.value, 'm.room.message', editContent)
        const eventId = typeof result === 'string' ? result : result?.event_id || ''

        onEdit?.(editingMessage.value.eventId, content)
        logger.info('[useMessageSender] 消息已编辑', {
          eventId: editingMessage.value.eventId,
          newEventId: eventId
        })
      } else {
        // Send new message with formatting support
        const formattedBody = formattedBodyFn(content)
        const messageContent: Record<string, unknown> = {
          msgtype: 'm.text',
          body: content
        }

        // Only add formatted fields if there's actual formatting
        if (formatRanges && formatRanges.value.length > 0) {
          messageContent.format = 'org.matrix.custom.html'
          messageContent.formatted_body = formattedBody
        }

        const result = await sendEventMethod(roomId.value, 'm.room.message', messageContent)
        const eventId = typeof result === 'string' ? result : result?.event_id || ''

        onSend?.({
          eventId,
          type: 'm.text',
          body: content,
          formattedBody: formatRanges && formatRanges.value.length > 0 ? formattedBody : undefined
        })

        logger.info('[useMessageSender] 消息已发送', {
          eventId,
          hasFormatting: formatRanges && formatRanges.value.length > 0
        })
      }

      onClearEditor?.()
    } catch (error) {
      logger.error('[useMessageSender] 发送消息失败:', error)
      message.error(editingMessage && editingMessage.value ? '编辑消息失败' : '发送消息失败')
    } finally {
      sending.value = false
    }
  }

  return {
    // States
    sending,

    // Actions
    sendMessage
  }
}
