import { FILE_SIZE_LIMITS } from '@/constants'
import { ref } from 'vue'
import { MsgEnum } from '@/enums'
import type { UploadOptions } from '@/hooks/useUpload'
import type { MessageStrategy } from '@/strategy/base'
import type { FileProcessResult } from '@/hooks/useMsgInput/types'
import { logger } from '@/utils/logger'

// Extended strategy interface with thumbnail generation methods
interface MessageStrategyWithThumbnails extends MessageStrategy {
  generateVideoThumbnail?: (file: File) => Promise<File>
  generateThumbnail?: (file: File) => Promise<File>
}

/**
 * 文件处理器 Composable
 */
export function useFileProcessor(
  _uploadHook: ReturnType<typeof import('@/hooks/useUpload').useUpload>,
  messageStrategies: Record<string, MessageStrategy>
) {
  const processingFiles = ref<Set<string>>(new Set())

  /**
   * 处理视频文件
   */
  const processVideoFile = async (file: File, _options?: UploadOptions): Promise<FileProcessResult> => {
    try {
      // 检查视频格式
      const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'm4v', '3gp']
      const fileExtension = file.name.split('.').pop()?.toLowerCase()

      if (!videoExtensions.includes(fileExtension || '')) {
        return {
          success: false,
          error: '不支持的视频格式'
        }
      }

      // 检查文件大小（100MB）
      if (file.size > FILE_SIZE_LIMITS.FILE_MAX_SIZE) {
        return {
          success: false,
          error: '视频文件大小不能超过100MB'
        }
      }

      // 生成视频缩略图
      const videoStrategy = messageStrategies[MsgEnum.VIDEO] as MessageStrategyWithThumbnails | undefined
      if (videoStrategy && 'generateVideoThumbnail' in videoStrategy && videoStrategy.generateVideoThumbnail) {
        const thumbnailFile = await videoStrategy.generateVideoThumbnail(file)

        return {
          success: true,
          processedFile: file,
          thumbnailFile,
          type: 'video'
        }
      }

      return {
        success: true,
        processedFile: file,
        type: 'video'
      }
    } catch (error) {
      logger.error('处理视频文件失败:', error)
      return {
        success: false,
        error: '处理视频文件失败'
      }
    }
  }

  /**
   * 处理图片文件
   */
  const processImageFile = async (file: File, _options?: UploadOptions): Promise<FileProcessResult> => {
    try {
      // 检查图片格式
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
      const fileExtension = file.name.split('.').pop()?.toLowerCase()

      if (!imageExtensions.includes(fileExtension || '')) {
        return {
          success: false,
          error: '不支持的图片格式'
        }
      }

      // 检查文件大小（20MB）
      if (file.size > 20 * 1024 * 1024) {
        return {
          success: false,
          error: '图片文件大小不能超过20MB'
        }
      }

      // 生成图片缩略图
      const imageStrategy = messageStrategies[MsgEnum.IMAGE] as MessageStrategyWithThumbnails | undefined
      if (imageStrategy && 'generateThumbnail' in imageStrategy && imageStrategy.generateThumbnail) {
        const thumbnailFile = await imageStrategy.generateThumbnail(file)

        return {
          success: true,
          processedFile: file,
          thumbnailFile,
          type: 'image'
        }
      }

      return {
        success: true,
        processedFile: file,
        type: 'image'
      }
    } catch (error) {
      logger.error('处理图片文件失败:', error)
      return {
        success: false,
        error: '处理图片文件失败'
      }
    }
  }

  /**
   * 处理通用文件
   */
  const processGenericFile = async (file: File, options?: UploadOptions): Promise<FileProcessResult> => {
    try {
      // 检查文件大小（100MB）
      if (file.size > FILE_SIZE_LIMITS.FILE_MAX_SIZE) {
        return {
          success: false,
          error: '文件大小不能超过100MB'
        }
      }

      // 如果是图片，尝试生成预览
      if (file.type.startsWith('image/')) {
        return processImageFile(file, options)
      }

      return {
        success: true,
        processedFile: file,
        type: 'file'
      }
    } catch (error) {
      logger.error('处理通用文件失败:', error)
      return {
        success: false,
        error: '处理文件失败'
      }
    }
  }

  /**
   * 批量处理文件
   */
  const processFiles = async (files: File[], options?: UploadOptions): Promise<FileProcessResult[]> => {
    const results: FileProcessResult[] = []

    for (const file of files) {
      processingFiles.value.add(file.name)

      try {
        let result: FileProcessResult

        // 根据文件类型选择处理方式
        if (file.type.startsWith('video/')) {
          result = await processVideoFile(file, options)
        } else if (file.type.startsWith('image/')) {
          result = await processImageFile(file, options)
        } else {
          result = await processGenericFile(file, options)
        }

        results.push(result)
      } catch (_error) {
        results.push({
          success: false,
          error: `处理文件 ${file.name} 失败`
        })
      } finally {
        processingFiles.value.delete(file.name)
      }
    }

    return results
  }

  return {
    processingFiles: processingFiles,
    processVideoFile,
    processImageFile,
    processGenericFile,
    processFiles
  }
}
