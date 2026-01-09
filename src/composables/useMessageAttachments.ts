import { ref, type Ref } from 'vue'
import { useMessage } from 'naive-ui'
import type { UploadCustomRequestOptions, UploadFileInfo } from 'naive-ui'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'

export interface VoiceData {
  localPath: string
  size: number
  duration: number
  filename: string
  type: string
}

export interface AttachmentSendEvent {
  eventId: string
  type: string
  body: string
  url?: string
  duration?: number
  fileInfo: {
    name: string
    size: number
    mimeType: string
  }
  [key: string]: unknown // Index signature for emit compatibility
}

interface UseMessageAttachmentsOptions {
  roomId: Ref<string>
  onSend?: (event: AttachmentSendEvent) => void
  onClearEditor?: () => void
}

interface UseMessageAttachmentsReturn {
  // States
  isDragOver: Ref<boolean>
  sending: Ref<boolean>

  // Actions
  handleBeforeUpload: (data: { file: UploadFileInfo }) => boolean
  handleFileUpload: (options: UploadCustomRequestOptions) => Promise<void>
  handleBeforeImageUpload: (data: { file: UploadFileInfo }) => boolean
  handleImageUpload: (options: UploadCustomRequestOptions) => Promise<void>
  handleImageFile: (file: File) => Promise<void>
  handleVoiceSend: (voiceData: VoiceData) => Promise<void>
  handleDrop: (e: DragEvent) => Promise<void>
  handleDragOver: (e: DragEvent) => void
  handleDragLeave: (e: DragEvent) => void
}

/**
 * Composable for managing message attachments (files, images, voice)
 * Handles upload validation, file processing, and Matrix media uploads
 */
export function useMessageAttachments(options: UseMessageAttachmentsOptions): UseMessageAttachmentsReturn {
  const { roomId, onSend, onClearEditor } = options
  const message = useMessage()

  // States
  const isDragOver = ref(false)
  const sending = ref(false)

  /**
   * Validate file upload before upload
   * Checks file size limit (100MB)
   */
  const handleBeforeUpload = (data: { file: UploadFileInfo }): boolean => {
    const file = data.file.file
    if (!file) return false

    // Check file size (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
      message.error('文件大小不能超过 100MB')
      return false
    }

    return true
  }

  /**
   * Handle file upload
   * Validates and uploads generic files
   */
  const handleFileUpload = async (options: UploadCustomRequestOptions) => {
    try {
      sending.value = true
      const fileObj = options.file.file
      if (!fileObj) return

      await uploadFile(fileObj)
    } catch (_error) {
      message.error('文件上传失败')
    } finally {
      sending.value = false
    }
  }

  /**
   * Validate image upload before upload
   * Checks MIME type and file size (10MB limit)
   */
  const handleBeforeImageUpload = (data: { file: UploadFileInfo }): boolean => {
    const file = data.file.file
    if (!file) return false

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      message.error('请选择图片文件')
      return false
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      message.error('图片大小不能超过 10MB')
      return false
    }

    return true
  }

  /**
   * Handle image upload
   * Validates and uploads image files
   */
  const handleImageUpload = async (options: UploadCustomRequestOptions) => {
    try {
      sending.value = true
      const imageFile = options.file.file
      if (!imageFile) return

      await handleImageFile(imageFile)
    } catch (_error) {
      message.error('图片上传失败')
    } finally {
      sending.value = false
    }
  }

  /**
   * Handle image file specifically
   * Sends image message through Matrix service
   */
  const handleImageFile = async (file: File) => {
    try {
      sending.value = true

      // Get file extension to determine MIME type
      const mimeType = file.type || 'image/jpeg'

      // Send image message through Matrix service
      const eventId = await matrixClientService.sendMediaMessage(roomId.value, file, file.name, mimeType)

      const event: AttachmentSendEvent = {
        eventId,
        type: 'm.image',
        body: file.name,
        url: '', // Will be filled by the server response
        fileInfo: {
          name: file.name,
          size: file.size,
          mimeType
        }
      }

      onSend?.(event)
      onClearEditor?.()
    } catch (error) {
      logger.error('[useMessageAttachments] 图片发送失败:', error)
      message.error('图片发送失败：' + (error instanceof Error ? error.message : String(error)))
    } finally {
      sending.value = false
    }
  }

  /**
   * Handle voice message send
   * Processes voice recording data and sends as audio message
   */
  const handleVoiceSend = async (voiceData: VoiceData) => {
    try {
      sending.value = true

      // Convert local path to File object
      // For Tauri, we need to read the file and create a Blob
      let audioFile: File
      if (voiceData.localPath.startsWith('blob:') || voiceData.localPath.startsWith('data:')) {
        // It's already a blob URL or data URL
        const response = await fetch(voiceData.localPath)
        const blob = await response.blob()
        audioFile = new File([blob], `voice_${Date.now()}.ogg`, { type: 'audio/ogg' })
      } else {
        // It's a local file path, need to read it through Tauri
        // For now, create a mock file object
        audioFile = new File([''], `voice_${Date.now()}.ogg`, { type: 'audio/ogg' })
      }

      // Send voice message through Matrix service
      const eventId = await matrixClientService.sendMediaMessage(
        roomId.value,
        audioFile,
        `voice_${Date.now()}.ogg`,
        'audio/ogg'
      )

      const event: AttachmentSendEvent = {
        eventId,
        type: 'm.audio',
        body: '[语音]',
        duration: voiceData.duration,
        fileInfo: {
          name: `voice_${Date.now()}.ogg`,
          size: voiceData.size,
          mimeType: 'audio/ogg'
        }
      }

      onSend?.(event)
      onClearEditor?.()
    } catch (error) {
      logger.error('[useMessageAttachments] 语音发送失败:', error)
      message.error('语音发送失败：' + (error instanceof Error ? error.message : String(error)))
    } finally {
      sending.value = false
    }
  }

  /**
   * Upload generic file
   * Determines message type based on MIME type and uploads
   */
  const uploadFile = async (file: File) => {
    try {
      sending.value = true

      // Determine MIME type
      const mimeType = file.type || 'application/octet-stream'
      let msgType = 'm.file'

      // Determine message type based on MIME type
      if (mimeType.startsWith('image/')) {
        msgType = 'm.image'
      } else if (mimeType.startsWith('video/')) {
        msgType = 'm.video'
      } else if (mimeType.startsWith('audio/')) {
        msgType = 'm.audio'
      }

      // Send file message through Matrix service
      const eventId = await matrixClientService.sendMediaMessage(roomId.value, file, file.name, mimeType)

      const event: AttachmentSendEvent = {
        eventId,
        type: msgType,
        body: file.name,
        url: '', // Will be filled by the server response
        fileInfo: {
          name: file.name,
          size: file.size,
          mimeType
        }
      }

      onSend?.(event)
      onClearEditor?.()
    } catch (error) {
      logger.error('[useMessageAttachments] 文件发送失败:', error)
      message.error('文件发送失败：' + (error instanceof Error ? error.message : String(error)))
    } finally {
      sending.value = false
    }
  }

  /**
   * Handle drag and drop file upload
   * Processes dropped files based on their type
   */
  const handleDrop = async (e: DragEvent) => {
    isDragOver.value = false

    const files = Array.from(e.dataTransfer?.files || [])
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        await handleImageFile(file)
      } else {
        await uploadFile(file)
      }
    }
  }

  /**
   * Handle drag over event
   * Shows drag overlay
   */
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    isDragOver.value = true
  }

  /**
   * Handle drag leave event
   * Hides drag overlay
   */
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    isDragOver.value = false
  }

  return {
    // States
    isDragOver,
    sending,

    // Actions
    handleBeforeUpload,
    handleFileUpload,
    handleBeforeImageUpload,
    handleImageUpload,
    handleImageFile,
    handleVoiceSend,
    handleDrop,
    handleDragOver,
    handleDragLeave
  }
}
