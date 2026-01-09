/**
 * Core Store - Media File State Management
 * Handles file upload, download, and media operations
 */

import { ref, type Ref } from 'vue'
import { logger } from '@/utils/logger'
import { ERROR_MESSAGES } from '@/constants'
import { readFileAsArrayBuffer, getVideoInfo } from '@/utils/fileHelpers'
import type { MediaFile, DownloadQueue, MatrixUploadResponse, MatrixFileProgress, MatrixContentInfo } from './types'

/**
 * Media file state manager
 */
export class MediaStateManager {
  /** All media files map */
  mediaFiles: Ref<Map<string, MediaFile>>

  /** Download queue */
  downloadQueue: Ref<DownloadQueue>

  /** Matrix client reference - use any to accommodate extended Matrix SDK types */
  private getClient: () => any

  /** Send message function reference */
  private sendMessageFn: (roomId: string, content: Record<string, unknown>, type: string) => Promise<void>

  constructor(
    getClient: () => any,
    sendMessageFn: (roomId: string, content: Record<string, unknown>, type: string) => Promise<void>
  ) {
    this.getClient = getClient
    this.sendMessageFn = sendMessageFn
    this.mediaFiles = ref<Map<string, MediaFile>>(new Map())
    this.downloadQueue = ref<DownloadQueue>({
      pending: [],
      active: [],
      completed: [],
      failed: [],
      paused: false
    })
  }

  /**
   * Upload file to Matrix and send as message
   */
  async uploadFile(file: File, roomId: string): Promise<MediaFile> {
    const client = this.getClient()
    if (!client) {
      throw new Error('Matrix客户端未初始化')
    }

    const fileId = 'file-' + Date.now()
    const mediaFile: MediaFile = {
      id: fileId,
      name: file.name,
      type: file.type,
      size: file.size,
      uploadProgress: 0
    }

    this.mediaFiles.value.set(fileId, mediaFile)

    try {
      // Validate file type and size
      const { FILE_SIZE_LIMITS, FILE_TYPES } = await import('@/constants')

      if (file.type.startsWith('image/')) {
        if (file.size > FILE_SIZE_LIMITS.IMAGE_MAX_SIZE) {
          throw new Error(ERROR_MESSAGES.FILE_TOO_LARGE)
        }
        if (!FILE_TYPES.IMAGE.includes(file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif')) {
          throw new Error('不支持的图片格式')
        }
      } else if (file.type.startsWith('video/')) {
        if (file.size > FILE_SIZE_LIMITS.VIDEO_MAX_SIZE) {
          throw new Error('视频大小不能超过100MB')
        }
        if (!FILE_TYPES.VIDEO.includes(file.type as 'video/mp4' | 'video/webm' | 'video/ogg')) {
          throw new Error('不支持的视频格式')
        }
      } else {
        if (file.size > FILE_SIZE_LIMITS.FILE_MAX_SIZE) {
          throw new Error('文件大小不能超过100MB')
        }
      }

      // Progress callback
      const progressCallback = (progress: MatrixFileProgress) => {
        const percentComplete = Math.round((progress.loaded / progress.total) * 100)
        mediaFile.uploadProgress = percentComplete
      }

      // Read file content
      const fileContent = await readFileAsArrayBuffer(file)

      // Upload to Matrix Media Repository
      const uploadContentFn = (
        client as {
          uploadContent?(
            content: Uint8Array | Blob,
            options: { type: string; name: string },
            progressCallback?: (progress: MatrixFileProgress) => void,
            extraInfo?: Record<string, unknown>
          ): Promise<MatrixUploadResponse>
        }
      ).uploadContent

      const uploadUrl = (await uploadContentFn?.(
        new Uint8Array(fileContent),
        {
          type: file.type,
          name: file.name
        },
        progressCallback,
        {}
      )) ?? { content_uri: '' }

      // Get MXC URI
      const mxcUri = uploadUrl.content_uri

      // Update media file info
      mediaFile.url = mxcUri
      mediaFile.uploadProgress = 100

      // Get file info (thumbnail, duration, etc.)
      const fileInfo: MatrixContentInfo = {
        size: file.size,
        mimetype: file.type
      }

      // If image, get dimensions
      if (file.type.startsWith('image/')) {
        const { getImageDimensions } = await import('@/utils/ImageUtils')
        try {
          const dimensions = await getImageDimensions(file)
          fileInfo.w = dimensions.width
          fileInfo.h = dimensions.height
        } catch (error) {
          logger.warn('[MediaState] Failed to get image dimensions:', error)
        }
      }

      // If video, get duration and thumbnail
      if (file.type.startsWith('video/')) {
        try {
          const videoInfo = await getVideoInfo(file)
          fileInfo.duration = videoInfo.duration
          if (videoInfo.thumbnail) {
            // Upload thumbnail
            const thumbnailUpload = (await uploadContentFn?.(videoInfo.thumbnail, {
              type: 'image/jpeg',
              name: `${file.name}_thumb.jpg`
            })) ?? { content_uri: '' }
            fileInfo.thumbnail_url = thumbnailUpload.content_uri
            fileInfo.thumbnail_info = {
              ...(videoInfo.thumbnailWidth !== undefined && { w: videoInfo.thumbnailWidth }),
              ...(videoInfo.thumbnailHeight !== undefined && { h: videoInfo.thumbnailHeight }),
              mimetype: 'image/jpeg',
              ...(videoInfo.thumbnail.size !== undefined && { size: videoInfo.thumbnail.size })
            }
          }
        } catch (error) {
          logger.warn('[MediaState] Failed to get video info:', error)
        }
      }

      // Determine message type
      let msgType = 'm.file'
      if (file.type.startsWith('image/')) {
        msgType = 'm.image'
      } else if (file.type.startsWith('video/')) {
        msgType = 'm.video'
      } else if (file.type.startsWith('audio/')) {
        msgType = 'm.audio'
      }

      // Send file message
      await this.sendMessageFn(
        roomId,
        {
          body: file.name,
          info: fileInfo,
          url: mxcUri
        },
        msgType
      )

      return mediaFile
    } catch (error) {
      this.mediaFiles.value.delete(fileId)
      throw error
    }
  }

  /**
   * Get media file by ID
   */
  getMediaFile(fileId: string): MediaFile | undefined {
    return this.mediaFiles.value.get(fileId)
  }

  /**
   * Add media file to queue
   */
  addMediaFile(file: MediaFile): void {
    this.mediaFiles.value.set(file.id, file)
  }

  /**
   * Remove media file
   */
  removeMediaFile(fileId: string): void {
    this.mediaFiles.value.delete(fileId)
  }

  /**
   * Clear all media files
   */
  clearMediaFiles(): void {
    this.mediaFiles.value.clear()
  }

  /**
   * Update download queue
   */
  updateDownloadQueue(updates: Partial<DownloadQueue>): void {
    Object.assign(this.downloadQueue.value, updates)
  }

  /**
   * Add file to download queue
   */
  addToDownloadQueue(file: MediaFile): void {
    this.downloadQueue.value.pending.push(file)
  }

  /**
   * Clear download queue
   */
  clearDownloadQueue(): void {
    this.downloadQueue.value = {
      pending: [],
      active: [],
      completed: [],
      failed: [],
      paused: false
    }
  }
}
