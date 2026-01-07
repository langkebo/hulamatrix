/**
 * Matrix Media Metadata Service
 * Extracts metadata from media files (images, videos, audio)
 *
 * @module services/matrixMediaMetadataService
 */

import { logger } from '@/utils/logger'

/**
 * 图片元数据
 */
export interface ImageMetadata {
  width: number
  height: number
  mimeType?: string
  size?: number
}

/**
 * 视频元数据
 */
export interface VideoMetadata {
  duration: number // 毫秒
  width: number
  height: number
  mimeType?: string
  size?: number
}

/**
 * 音频元数据
 */
export interface AudioMetadata {
  duration: number // 毫秒
  mimeType?: string
  size?: number
}

/**
 * 文件元数据（联合类型）
 */
export type MediaMetadata = ImageMetadata | VideoMetadata | AudioMetadata

/**
 * 媒体类型
 */
export type MediaType = 'image' | 'video' | 'audio' | 'file'

/**
 * Matrix Media Metadata Service
 * 提供媒体文件元数据提取功能
 */
export class MatrixMediaMetadataService {
  private static instance: MatrixMediaMetadataService

  // 缓存已提取的元数据
  private metadataCache: Map<string, MediaMetadata> = new Map()

  private constructor() {}

  static getInstance(): MatrixMediaMetadataService {
    if (!MatrixMediaMetadataService.instance) {
      MatrixMediaMetadataService.instance = new MatrixMediaMetadataService()
    }
    return MatrixMediaMetadataService.instance
  }

  /**
   * 检测文件类型
   */
  detectMediaType(file: File | Blob): MediaType {
    const type = file.type.toLowerCase()

    if (type.startsWith('image/')) {
      return 'image'
    } else if (type.startsWith('video/')) {
      return 'video'
    } else if (type.startsWith('audio/')) {
      return 'audio'
    }

    return 'file'
  }

  /**
   * 提取图片元数据
   */
  async extractImageMetadata(file: File | Blob): Promise<ImageMetadata> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(url)

        const metadata: ImageMetadata = {
          width: img.width,
          height: img.height,
          mimeType: file.type,
          size: file.size
        }

        logger.debug('[MediaMetadataService] Image metadata extracted:', metadata)
        resolve(metadata)
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load image'))
      }

      img.src = url
    })
  }

  /**
   * 提取视频元数据
   */
  async extractVideoMetadata(file: File | Blob): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      const url = URL.createObjectURL(file)

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url)

        const metadata: VideoMetadata = {
          duration: Math.round(video.duration * 1000), // 转换为毫秒
          width: video.videoWidth,
          height: video.videoHeight,
          mimeType: file.type,
          size: file.size
        }

        logger.debug('[MediaMetadataService] Video metadata extracted:', metadata)
        resolve(metadata)
      }

      video.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load video'))
      }

      video.src = url
    })
  }

  /**
   * 提取音频元数据
   */
  async extractAudioMetadata(file: File | Blob): Promise<AudioMetadata> {
    return new Promise((resolve, reject) => {
      const audio = new Audio()
      const url = URL.createObjectURL(file)

      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url)

        const metadata: AudioMetadata = {
          duration: Math.round(audio.duration * 1000), // 转换为毫秒
          mimeType: file.type,
          size: file.size
        }

        logger.debug('[MediaMetadataService] Audio metadata extracted:', metadata)
        resolve(metadata)
      }

      audio.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load audio'))
      }

      audio.src = url
    })
  }

  /**
   * 提取媒体元数据（自动检测类型）
   */
  async extractMetadata(file: File | Blob): Promise<MediaMetadata> {
    const mediaType = this.detectMediaType(file)

    switch (mediaType) {
      case 'image':
        return this.extractImageMetadata(file)
      case 'video':
        return this.extractVideoMetadata(file)
      case 'audio':
        return this.extractAudioMetadata(file)
      default:
        throw new Error(`Unsupported media type: ${file.type}`)
    }
  }

  /**
   * 提取元数据（带缓存）
   */
  async extractMetadataCached(file: File | Blob): Promise<MediaMetadata> {
    const cacheKey = `${file.type}_${file.size}_${(file as File).name || 'blob'}`

    // 检查缓存
    if (this.metadataCache.has(cacheKey)) {
      return this.metadataCache.get(cacheKey)!
    }

    // 提取元数据
    const metadata = await this.extractMetadata(file)

    // 缓存结果
    this.metadataCache.set(cacheKey, metadata)

    return metadata
  }

  /**
   * 批量提取元数据
   */
  async extractBatchMetadata(files: File[] | Blob[]): Promise<Map<File | Blob, MediaMetadata>> {
    const results = new Map<File | Blob, MediaMetadata>()
    const errors = new Map<File | Blob, Error>()

    for (const file of files) {
      try {
        const metadata = await this.extractMetadataCached(file)
        results.set(file, metadata)
      } catch (error) {
        errors.set(file, error as Error)
      }
    }

    if (errors.size > 0) {
      logger.warn('[MediaMetadataService] Some files failed to extract metadata:', {
        failed: errors.size,
        total: files.length
      })
    }

    logger.info('[MediaMetadataService] Batch metadata extraction completed:', {
      success: results.size,
      failed: errors.size,
      total: files.length
    })

    return results
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.metadataCache.clear()
    logger.debug('[MediaMetadataService] Metadata cache cleared')
  }

  /**
   * 获取缓存大小
   */
  getCacheSize(): number {
    return this.metadataCache.size
  }
}

// 导出单例实例
export const matrixMediaMetadataService = MatrixMediaMetadataService.getInstance()

// 导出便捷函数
export async function extractImageMetadata(file: File | Blob): Promise<ImageMetadata> {
  return matrixMediaMetadataService.extractImageMetadata(file)
}

export async function extractVideoMetadata(file: File | Blob): Promise<VideoMetadata> {
  return matrixMediaMetadataService.extractVideoMetadata(file)
}

export async function extractAudioMetadata(file: File | Blob): Promise<AudioMetadata> {
  return matrixMediaMetadataService.extractAudioMetadata(file)
}

export async function extractMetadata(file: File | Blob): Promise<MediaMetadata> {
  return matrixMediaMetadataService.extractMetadata(file)
}
