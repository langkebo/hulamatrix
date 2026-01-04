/**
 * Chat Main - Selection & Clipboard Module
 *
 * Handles text selection, copy functionality, and clipboard operations
 */

import { writeImage, writeText } from '@tauri-apps/plugin-clipboard-manager'
import { isImageUrl } from '@/utils/ImageUtils'
import { imageUrlToUint8Array } from '@/utils/ImageUtils'
import { msg } from '@/utils/SafeUI'

// Selection type definition
export interface Selection {
  baseNodeId?: string
  extentNodeId?: string
}

export type UseChatSelectionState = Record<string, never>

export interface UseChatSelectionActions {
  getSelectedText: (messageId?: string) => string
  hasSelectedText: (messageId?: string) => boolean
  clearSelection: () => void
  handleCopy: (content: string | undefined, prioritizeSelection?: boolean, messageId?: string) => void
}

/**
 * Helper: Extract message ID from data key
 */
export function extractMsgIdFromDataKey(dataKey?: string | null): string {
  if (!dataKey) return ''
  // dataKey format: "message_${messageId}_${random}"
  const parts = dataKey.split('_')
  return parts[1] || ''
}

/**
 * Helper: Resolve selection to message ID
 */
export function resolveSelectionMessageId(selection: Selection): string {
  if (selection.baseNodeId) {
    return extractMsgIdFromDataKey(selection.baseNodeId)
  }
  if (selection.extentNodeId) {
    return extractMsgIdFromDataKey(selection.extentNodeId)
  }
  return ''
}

/**
 * Selection and clipboard management composable
 */
export function useChatSelection() {
  /**
   * Get currently selected text
   */
  const getSelectedText = (messageId?: string): string => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      return ''
    }

    const selectedText = selection.toString().trim()
    if (!selectedText) {
      return ''
    }

    // Check if selection is within a message bubble
    const anchorNode = selection.anchorNode
    if (anchorNode) {
      const messageBubble = (anchorNode as HTMLElement).closest?.('[data-message-id]')
      if (messageBubble) {
        const bubbleMessageId = messageBubble.getAttribute('data-message-id')
        if (!messageId || bubbleMessageId === messageId) {
          return selectedText
        }
      }
    }

    return ''
  }

  /**
   * Check if there's selected text in a specific message
   */
  const hasSelectedText = (messageId?: string): boolean => {
    return !!getSelectedText(messageId)
  }

  /**
   * Clear selection
   */
  const clearSelection = (): void => {
    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
    }
  }

  /**
   * Handle copy action
   */
  const handleCopy = async (
    content: string | undefined,
    prioritizeSelection: boolean = true,
    messageId?: string
  ): Promise<void> => {
    try {
      // Check for selected text first
      if (prioritizeSelection && hasSelectedText(messageId)) {
        const selectedText = getSelectedText(messageId)
        await writeText(selectedText)
        msg.success('复制成功')
        clearSelection()
        return
      }

      // Copy provided content
      if (!content) {
        msg.error('内容为空')
        return
      }

      // Check if content is an image URL
      if (isImageUrl(content)) {
        try {
          const imageBytes = await imageUrlToUint8Array(content)
          await writeImage(imageBytes)
          msg.success('图片复制成功')
        } catch {
          // Fallback to copying URL if image copy fails
          await writeText(content)
          msg.success('复制成功')
        }
      } else {
        await writeText(content)
        msg.success('复制成功')
      }
    } catch (_error) {
      msg.error('复制失败')
    }
  }

  return {
    // Actions
    getSelectedText,
    hasSelectedText,
    clearSelection,
    handleCopy,

    // Exported helpers for other modules
    extractMsgIdFromDataKey,
    resolveSelectionMessageId
  }
}
