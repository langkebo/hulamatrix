import { ref, type Ref, watch } from 'vue'
import { readImage, readText } from '@tauri-apps/plugin-clipboard-manager'
import { useDebounceFn } from '@vueuse/core'
import { MsgEnum } from '@/enums'
import { fixFileMimeType, getMessageTypeByFile } from '@/utils/FileType'
import { processClipboardImage } from '@/utils/ImageUtils'
import { useInputValidation } from './useInputValidation'
import { useCursorManager } from './useCursorManager'
import { logger } from '@/utils/logger'
import DOMPurify from 'dompurify'

/** Clipboard content data */
interface ClipboardContent {
  type: 'text' | 'image' | 'file'
  text?: string
  file?: File
  imageUrl?: string
  [key: string]: unknown
}

interface UseClipboardHandlerOptions {
  messageInputDom: Ref<HTMLElement | null>
  onPasteText?: (text: string) => void
  onPasteFile?: (file: File) => void
  onPasteImage?: (file: File) => void
}

export function useClipboardHandler(options: UseClipboardHandlerOptions) {
  const { messageInputDom, onPasteText, onPasteFile, onPasteImage } = options
  const { validateFile } = useInputValidation()
  const { insertTextAtCursor } = useCursorManager()

  // 剪贴板状态
  const clipboardContent = ref<ClipboardContent | null>(null)
  const isReadingClipboard = ref(false)

  /**
   * 处理文本粘贴
   */
  const handleTextPaste = async (text: string) => {
    if (!text || text.trim().length === 0) return

    // 清理文本
    const cleanedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    // 插入到光标位置
    if (messageInputDom.value) {
      insertTextAtCursor(messageInputDom.value, cleanedText)
    }

    // 触发回调
    onPasteText?.(cleanedText)
  }

  /**
   * 处理文件粘贴
   */
  const handleFilePaste = async (file: File) => {
    // 验证文件
    const validation = validateFile(file)
    if (!validation.isValid) {
      logger.warn('[handleFilePaste] 文件验证失败:', validation.error)
      return
    }

    // 修复文件类型
    const fixedFile = await fixFileMimeType(file)

    // 获取消息类型
    const msgType = getMessageTypeByFile(fixedFile)

    // 触发相应回调
    if (msgType === MsgEnum.IMAGE || msgType === MsgEnum.EMOJI) {
      onPasteImage?.(fixedFile)
    } else {
      onPasteFile?.(fixedFile)
    }
  }

  /**
   * 处理图片粘贴（从剪贴板）- 已弃用，保留用于兼容性
   * Note: 这个函数目前不再被使用，因为 processClipboardContent 现在直接处理 Tauri 图片对象
   * 如果需要从 ArrayBuffer 处理图片，需要实现从 buffer 解析图片尺寸和数据的逻辑
   */
  const _handleImagePaste = async (_imageData: ArrayBuffer | Uint8Array) => {
    // ArrayBuffer 转 File 需要图片尺寸信息，这里暂时不做处理
    // 如果需要实现，可以使用 createImageBitmap 或其他库来解析图片
    logger.warn('[handleImagePaste] 从 ArrayBuffer 处理图片暂未实现，请使用 Tauri 剪贴板 API')
  }

  /**
   * 读取剪贴板内容
   */
  const readClipboard = async () => {
    if (isReadingClipboard.value) return

    isReadingClipboard.value = true
    clipboardContent.value = null

    try {
      // 尝试读取图片
      const imageResult = await readImage()
      if (imageResult) {
        clipboardContent.value = {
          type: 'image',
          data: imageResult
        }
        return
      }

      // 尝试读取文本
      const textResult = await readText()
      if (textResult) {
        clipboardContent.value = {
          type: 'text',
          data: textResult
        }
      }
    } catch (error) {
      logger.error('[readClipboard] 读取剪贴板失败:', error)
    } finally {
      isReadingClipboard.value = false
    }
  }

  /**
   * 防抖读取剪贴板
   */
  const debouncedReadClipboard = useDebounceFn(readClipboard, 300)

  /**
   * 处理粘贴事件
   */
  const handlePaste = async (event: ClipboardEvent) => {
    event.preventDefault()

    // 处理文件粘贴
    const files = Array.from(event.clipboardData?.files || [])
    if (files.length > 0) {
      for (const file of files) {
        await handleFilePaste(file)
      }
      return
    }

    // 处理文本粘贴
    const text = event.clipboardData?.getData('text/plain') || ''
    if (text) {
      await handleTextPaste(text)
      return
    }

    // 处理 HTML 粘贴（提取纯文本）
    const html = event.clipboardData?.getData('text/html') || ''
    if (html) {
      // 创建临时元素来解析 HTML
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = DOMPurify.sanitize(html)
      const extractedText = tempDiv.textContent || tempDiv.innerText || ''

      if (extractedText) {
        await handleTextPaste(extractedText)
      }
      return
    }

    // 如果都没有，尝试从剪贴板 API 读取
    await readClipboard()
  }

  /**
   * 处理剪贴板内容变化
   */
  const processClipboardContent = async () => {
    if (!clipboardContent.value) return

    switch (clipboardContent.value.type) {
      case 'text': {
        const textData = clipboardContent.value.data
        if (typeof textData === 'string') {
          await handleTextPaste(textData)
        }
        break
      }
      case 'image': {
        const imageData = clipboardContent.value.data
        // imageData from Tauri's readImage() is an object with size() and rgba() methods
        // Check if it has the required methods
        if (
          imageData &&
          typeof imageData === 'object' &&
          'size' in imageData &&
          'rgba' in imageData &&
          typeof imageData.size === 'function' &&
          typeof imageData.rgba === 'function'
        ) {
          // This is a Tauri clipboard image object
          const processedFile = await processClipboardImage(
            imageData as {
              size(): Promise<{ width: number; height: number }>
              rgba(): Promise<Uint8Array<ArrayBufferLike>>
            }
          )
          onPasteImage?.(processedFile)
        }
        break
      }
    }

    clipboardContent.value = null
  }

  // 监听剪贴板内容变化
  watch(clipboardContent, processClipboardContent)

  /**
   * 清理剪贴板资源
   */
  const cleanup = () => {
    clipboardContent.value = null
    isReadingClipboard.value = false
  }

  return {
    // 状态
    clipboardContent,
    isReadingClipboard,

    // 方法
    handlePaste,
    readClipboard,
    debouncedReadClipboard,
    cleanup
  }
}
