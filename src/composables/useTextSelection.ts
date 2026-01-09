import { msg } from '@/utils/SafeUI'
import { detectImageFormat, imageUrlToUint8Array, isImageUrl } from '@/utils/ImageUtils'
import { removeTag } from '@/utils/formatUtils'
import { writeImage, writeText } from '@tauri-apps/plugin-clipboard-manager'

/**
 * Extract message ID from data-key attribute
 * @param dataKey - The data-key attribute value (e.g., "m123456")
 * @returns The extracted message ID (e.g., "123456")
 */
const extractMsgIdFromDataKey = (dataKey?: string | null): string => {
  if (!dataKey) return ''
  return dataKey.replace(/^[A-Za-z]/, '')
}

/**
 * Resolve message ID from browser Selection object
 * @param selection - The browser Selection object
 * @returns The resolved message ID or empty string if invalid
 */
const resolveSelectionMessageId = (selection: Selection): string => {
  const resolveElement = (node: Node | null) => {
    if (!node) return null
    return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  }

  const anchorElement = resolveElement(selection.anchorNode)
  const focusElement = resolveElement(selection.focusNode)

  if (!anchorElement || !focusElement) return ''

  const anchorKey = anchorElement.closest('[data-key]')?.getAttribute('data-key')
  const focusKey = focusElement.closest('[data-key]')?.getAttribute('data-key')

  if (!anchorKey || !focusKey || anchorKey !== focusKey) {
    return ''
  }

  const chatMainElement = document.getElementById('image-chat-main')
  if (chatMainElement && (!chatMainElement.contains(anchorElement) || !chatMainElement.contains(focusElement))) {
    return ''
  }

  return extractMsgIdFromDataKey(anchorKey)
}

interface UseTextSelectionReturn {
  // Actions
  getSelectedText: (messageId?: string) => string
  hasSelectedText: (messageId?: string) => boolean
  clearSelection: () => void
  handleCopy: (content: string | undefined, prioritizeSelection?: boolean, messageId?: string) => Promise<void>
}

/**
 * Composable for managing text selection in chat messages
 * Handles browser Selection API, clipboard operations, and image copying
 */
export function useTextSelection(): UseTextSelectionReturn {
  /**
   * Get user selected text (only returns selection within chat bubbles, with optional message ID validation)
   * @param messageId - Optional message ID to validate the selection belongs to
   * @returns The selected text or empty string if no valid selection
   */
  const getSelectedText = (messageId?: string): string => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      return ''
    }

    const text = selection.toString().trim()
    if (!text) {
      return ''
    }

    const selectedMessageId = resolveSelectionMessageId(selection)
    if (!selectedMessageId) {
      return ''
    }

    if (messageId && selectedMessageId !== messageId) {
      return ''
    }

    return text
  }

  /**
   * Check if there is text selected
   * @param messageId - Optional message ID to validate the selection belongs to
   * @returns true if text is selected, false otherwise
   */
  const hasSelectedText = (messageId?: string): boolean => {
    return getSelectedText(messageId).length > 0
  }

  /**
   * Clear text selection
   */
  const clearSelection = (): void => {
    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
    }
  }

  /**
   * Handle copy event
   * @param content - Content to copy (as fallback)
   * @param prioritizeSelection - Whether to prioritize copying selected text
   * @param messageId - Optional message ID for selection validation
   */
  const handleCopy = async (content: string | undefined, prioritizeSelection: boolean = true, messageId?: string) => {
    try {
      let textToCopy = content || ''
      let isSelectedText = false

      // If prioritize selection mode is enabled, check for selected text
      if (prioritizeSelection) {
        const selectedText = getSelectedText(messageId)
        if (selectedText) {
          textToCopy = selectedText
          isSelectedText = true
        }
      }

      // Check if content is empty
      if (!textToCopy) {
        msg.warning('没有可复制的内容')
        return
      }

      // If it's an image
      if (isImageUrl(textToCopy)) {
        try {
          const imageFormat = detectImageFormat(textToCopy)

          // Inform user about image format conversion
          if (imageFormat === 'GIF' || imageFormat === 'WEBP') {
            msg.info(`正在将 ${imageFormat} 格式图片转换为 PNG 并复制...`)
          }

          // Use Tauri's clipboard API to copy image (auto-converts to PNG)
          const imageBytes = await imageUrlToUint8Array(textToCopy)
          await writeImage(imageBytes)

          const successMessage = imageFormat === 'PNG' ? '图片已复制到剪贴板' : '图片已转换为 PNG 格式并复制到剪贴板'
          msg.success(successMessage)
        } catch (_imageError) {
          // Image copy failed, silently handle error
        }
      } else {
        // If it's plain text
        await writeText(removeTag(textToCopy))
        const message = isSelectedText ? '选中文本已复制' : '消息内容已复制'
        msg.success(message)
      }
    } catch (_error) {
      // Copy failed, silently handle error
    }
  }

  return {
    getSelectedText,
    hasSelectedText,
    clearSelection,
    handleCopy
  }
}
