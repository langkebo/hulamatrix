/**
 * 媒体服务
 * 处理媒体文件的上传、下载和缓存
 *
 * SDK Integration:
 * - client.uploadContent() - Upload files to Matrix media repository
 * - client.mxcUrlToHttp() - Convert MXC URLs to HTTP URLs with thumbnail support
 * - Uses Tauri invoke('download_media') for desktop-native download
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import { invoke } from '@tauri-apps/api/core'
import { exists, remove } from '@tauri-apps/plugin-fs'

/** 上传内容结果接口 (SDK native) */
interface UploadContentResult {
  content_uri: string
  [key: string]: unknown
}

export interface MediaUploadOptions {
  /** 文件名 */
  filename?: string
  /** MIME类型 */
  contentType?: string
  /** 生成缩略图 */
  generateThumbnail?: boolean
  /** 缩略图宽度 */
  thumbnailWidth?: number
  /** 缩略图高度 */
  thumbnailHeight?: number
}

export interface MediaUploadResult {
  /** Matrix内容URI */
  contentUri: string
  /** 文件大小 */
  size: number
  /** MIME类型 */
  mimeType: string
  /** 缩略图信息 */
  thumbnailInfo?: {
    uri: string
    width: number
    height: number
    size: number
  }
}

export interface MediaCacheEntry {
  /** 本地文件路径 */
  localPath: string
  /** 文件大小 */
  size: number
  /** MIME类型 */
  mimeType: string
  /** 缓存时间 */
  cachedAt: number
  /** 最后访问时间 */
  lastAccessed: number
  /** 缩略图路径 */
  thumbnailPath?: string
}

export interface MediaDownloadOptions {
  /** 强制重新下载 */
  force?: boolean
  /** 显示进度 */
  showProgress?: boolean
  /** 最大文件大小限制（字节） */
  maxSize?: number
}

/**
 * 媒体服务类
 */
export class MediaService {
  private static instance: MediaService
  private cache = new Map<string, MediaCacheEntry>()
  private downloadQueue = new Map<string, Promise<string>>()
  private readonly maxCacheSize = 1024 * 1024 * 1024 // 1GB
  private readonly maxCacheAge = 30 * 24 * 60 * 60 * 1000 // 30天

  static getInstance(): MediaService {
    if (!MediaService.instance) {
      MediaService.instance = new MediaService()
    }
    return MediaService.instance
  }

  /**
   * 初始化媒体服务
   */
  async initialize(): Promise<void> {
    try {
      // 加载缓存索引
      await this.loadCacheIndex()

      // 定期清理过期缓存
      setInterval(
        () => {
          this.cleanupCache()
        },
        60 * 60 * 1000
      ) // 每小时执行一次

      logger.info('[MediaService] Media service initialized')
    } catch (error) {
      logger.error('[MediaService] Failed to initialize media service:', error)
      throw error
    }
  }

  /**
   * 上传媒体文件
   * Uses SDK's native uploadContent() method
   */
  async uploadMedia(file: File | Blob, options: MediaUploadOptions = {}): Promise<MediaUploadResult> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const filename = options.filename || (file as File).name || 'media'
      const contentType = options.contentType || (file as File).type || 'application/octet-stream'

      logger.info('[MediaService] Uploading media:', {
        filename,
        size: file.size,
        contentType
      })

      // Use SDK's native uploadContent (no type casting needed)
      const uploadContentMethod = client.uploadContent as
        | ((file: Blob, options: { name?: string; type?: string }) => Promise<UploadContentResult>)
        | undefined
      const uploadResult = (await uploadContentMethod?.(file, {
        name: filename,
        type: contentType
      })) as UploadContentResult

      const result: MediaUploadResult = {
        contentUri: uploadResult.content_uri,
        size: file.size,
        mimeType: contentType
      }

      // 如果需要生成缩略图
      if (options.generateThumbnail && contentType.startsWith('image/')) {
        try {
          const thumbnail = await this.generateThumbnail(file, options)
          const thumbnailUpload = (await uploadContentMethod?.(thumbnail.blob, {
            name: `thumb_${filename}`,
            type: thumbnail.mimeType
          })) as UploadContentResult

          result.thumbnailInfo = {
            uri: thumbnailUpload.content_uri,
            width: thumbnail.width,
            height: thumbnail.height,
            size: thumbnail.blob.size
          }
        } catch (thumbnailError) {
          logger.warn('[MediaService] Failed to generate thumbnail:', thumbnailError)
        }
      }

      logger.info('[MediaService] Media uploaded successfully:', {
        contentUri: result.contentUri,
        size: result.size,
        hasThumbnail: !!result.thumbnailInfo
      })

      return result
    } catch (error) {
      const fileName = options.filename || (file instanceof File ? file.name : undefined) || 'media'
      logger.error('[MediaService] Failed to upload media:', {
        filename: fileName,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * Get thumbnail URL using SDK's mxcUrlToHttp
   * Uses Matrix server-side thumbnail generation for better performance
   */
  getThumbnailUrl(
    mxcUri: string,
    width: number = 128,
    height: number = 128,
    method: 'crop' | 'scale' = 'scale',
    allowRedirects: boolean = true
  ): string | null {
    const client = matrixClientService.getClient()
    if (!client || !client.mxcUrlToHttp) {
      logger.warn('[MediaService] Client or mxcUrlToHttp not available')
      return null
    }

    try {
      const mxcUrlToHttpMethod = client.mxcUrlToHttp as
        | ((
            mxcUri: string,
            width?: number,
            height?: number,
            resizeMethod?: string,
            allowDirectLinks?: boolean,
            allowRedirects?: boolean,
            useAuthentication?: boolean
          ) => string)
        | undefined
      const result = mxcUrlToHttpMethod?.(
        mxcUri,
        width,
        height,
        method,
        false, // allowDirectLinks
        allowRedirects,
        false // useAuthentication
      )
      return result || null
    } catch (error) {
      logger.error('[MediaService] Failed to generate thumbnail URL:', { mxcUri, error })
      return null
    }
  }

  /**
   * Get HTTP URL for MXC URI
   * Converts MXC URLs to HTTP URLs for direct access
   */
  getHttpUrl(mxcUri: string, useAuthentication: boolean = false): string | null {
    const client = matrixClientService.getClient()
    if (!client || !client.mxcUrlToHttp) {
      logger.warn('[MediaService] Client or mxcUrlToHttp not available')
      return null
    }

    try {
      const mxcUrlToHttpMethod = client.mxcUrlToHttp as
        | ((
            mxcUri: string,
            width?: number,
            height?: number,
            resizeMethod?: string,
            allowDirectLinks?: boolean,
            allowRedirects?: boolean,
            useAuthentication?: boolean
          ) => string)
        | undefined
      const result = mxcUrlToHttpMethod?.(
        mxcUri,
        undefined, // width
        undefined, // height
        undefined, // resizeMethod
        false, // allowDirectLinks
        true, // allowRedirects
        useAuthentication
      )
      return result || null
    } catch (error) {
      logger.error('[MediaService] Failed to generate HTTP URL:', { mxcUri, error })
      return null
    }
  }

  /**
   * 下载媒体文件
   */
  async downloadMedia(mxcUri: string, options: MediaDownloadOptions = {}): Promise<string> {
    // 检查缓存
    if (!options.force) {
      const cached = this.cache.get(mxcUri)
      if (cached && (await this.isCacheValid(cached))) {
        // 更新访问时间
        cached.lastAccessed = Date.now()
        this.saveCacheIndex()
        return cached.localPath
      }
    }

    // 检查是否正在下载
    if (this.downloadQueue.has(mxcUri)) {
      return this.downloadQueue.get(mxcUri)!
    }

    // 开始下载
    const downloadPromise = this.performDownload(mxcUri, options)
    this.downloadQueue.set(mxcUri, downloadPromise)

    try {
      const localPath = await downloadPromise
      return localPath
    } finally {
      this.downloadQueue.delete(mxcUri)
    }
  }

  /**
   * 执行实际的下载
   */
  private async performDownload(mxcUri: string, options: MediaDownloadOptions): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      logger.info('[MediaService] Downloading media:', { mxcUri })

      // 使用Tauri API下载文件
      const result = (await invoke('download_media', {
        mxcUri,
        force: options.force || false,
        maxSize: options.maxSize || 100 * 1024 * 1024 // 默认100MB
      })) as { localPath: string; size: number; mimeType: string }

      // 添加到缓存
      const cacheEntry: MediaCacheEntry = {
        localPath: result.localPath,
        size: result.size,
        mimeType: result.mimeType,
        cachedAt: Date.now(),
        lastAccessed: Date.now()
      }

      this.cache.set(mxcUri, cacheEntry)
      await this.saveCacheIndex()

      logger.info('[MediaService] Media downloaded successfully:', {
        mxcUri,
        localPath: result.localPath,
        size: result.size
      })

      return result.localPath
    } catch (error) {
      logger.error('[MediaService] Failed to download media:', {
        mxcUri,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * 生成缩略图
   */
  private async generateThumbnail(
    file: File | Blob,
    options: MediaUploadOptions
  ): Promise<{ blob: Blob; width: number; height: number; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        const maxWidth = options.thumbnailWidth || 200
        const maxHeight = options.thumbnailHeight || 200

        // 计算缩略图尺寸
        let width = img.width
        let height = img.height

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width *= ratio
          height *= ratio
        }

        canvas.width = width
        canvas.height = height

        // 绘制缩略图
        ctx?.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({
                blob,
                width,
                height,
                mimeType: 'image/jpeg'
              })
            } else {
              reject(new Error('Failed to generate thumbnail'))
            }
          },
          'image/jpeg',
          0.8
        )
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }

  /**
   * 检查缓存是否有效
   */
  private async isCacheValid(entry: MediaCacheEntry): Promise<boolean> {
    try {
      // 检查文件是否存在
      const fileExists = await exists(entry.localPath)
      if (!fileExists) {
        return false
      }

      // 检查缓存是否过期
      const age = Date.now() - entry.cachedAt
      return age < this.maxCacheAge
    } catch (error) {
      logger.warn('[MediaService] Failed to check cache validity:', error)
      return false
    }
  }

  /**
   * 清理过期缓存
   */
  private async cleanupCache(): Promise<void> {
    try {
      const now = Date.now()
      const toDelete: string[] = []

      // 查找过期条目
      for (const [uri, entry] of this.cache.entries()) {
        const age = now - entry.cachedAt
        if (age > this.maxCacheAge) {
          toDelete.push(uri)
        }
      }

      // 删除过期缓存
      for (const uri of toDelete) {
        const entry = this.cache.get(uri)
        if (entry) {
          await this.deleteLocalFile(entry.localPath)
          if (entry.thumbnailPath) {
            await this.deleteLocalFile(entry.thumbnailPath)
          }
          this.cache.delete(uri)
        }
      }

      // 检查总缓存大小
      await this.enforceCacheSizeLimit()

      if (toDelete.length > 0) {
        await this.saveCacheIndex()
        logger.info('[MediaService] Cleaned up expired cache entries:', toDelete.length)
      }
    } catch (error) {
      logger.error('[MediaService] Failed to cleanup cache:', error)
    }
  }

  /**
   * 强制执行缓存大小限制
   */
  private async enforceCacheSizeLimit(): Promise<void> {
    const totalSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0)

    if (totalSize > this.maxCacheSize) {
      // 按最后访问时间排序，删除最旧的
      const sorted = Array.from(this.cache.entries()).sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
      let currentSize = totalSize

      for (const [uri, entry] of sorted) {
        if (currentSize <= this.maxCacheSize * 0.8) break // 保留20%空间

        // 删除本地文件
        await this.deleteLocalFile(entry.localPath)
        if (entry.thumbnailPath) {
          await this.deleteLocalFile(entry.thumbnailPath)
        }

        this.cache.delete(uri)
        currentSize -= entry.size
      }
    }
  }

  /**
   * 删除本地文件
   * @param filePath - 文件路径
   */
  private async deleteLocalFile(filePath: string): Promise<void> {
    try {
      if (await exists(filePath)) {
        await remove(filePath)
        logger.debug('[MediaService] Deleted local file:', filePath)
      }
    } catch (error) {
      logger.warn('[MediaService] Failed to delete local file:', { filePath, error })
    }
  }

  /**
   * 加载缓存索引
   * 从 localStorage 加载缓存索引，恢复缓存状态
   */
  private async loadCacheIndex(): Promise<void> {
    try {
      const index = localStorage.getItem('mediaCacheIndex')
      if (index) {
        const data = JSON.parse(index)
        this.cache = new Map(data)
        logger.debug('[MediaService] Cache index loaded:', { entries: this.cache.size })
      }
    } catch (error) {
      logger.warn('[MediaService] Failed to load cache index:', error)
    }
  }

  /**
   * 保存缓存索引
   * 将当前缓存状态保存到 localStorage 以便下次启动时恢复
   */
  private async saveCacheIndex(): Promise<void> {
    try {
      const data = Array.from(this.cache.entries())
      localStorage.setItem('mediaCacheIndex', JSON.stringify(data))
      logger.debug('[MediaService] Cache index saved:', { entries: data.length })
    } catch (error) {
      logger.warn('[MediaService] Failed to save cache index:', error)
    }
  }

  /**
   * 预加载媒体
   */
  async preloadMedia(mxcUris: string[]): Promise<void> {
    const promises = mxcUris.map((uri) =>
      this.downloadMedia(uri).catch((error) => {
        logger.warn('[MediaService] Failed to preload media:', { uri, error })
      })
    )

    await Promise.allSettled(promises)
    logger.info('[MediaService] Media preload completed:', { count: mxcUris.length })
  }

  /**
   * 清除所有缓存
   * 删除所有本地缓存的媒体文件并清空缓存索引
   */
  async clearCache(): Promise<void> {
    try {
      // 删除所有本地缓存的文件
      for (const [_uri, entry] of this.cache.entries()) {
        try {
          await this.deleteLocalFile(entry.localPath)
          // 同时删除缩略图（如果有）
          if (entry.thumbnailPath) {
            await this.deleteLocalFile(entry.thumbnailPath)
          }
        } catch (error) {
          logger.warn('[MediaService] Failed to delete cached file:', {
            path: entry.localPath,
            error
          })
        }
      }

      // 清空缓存
      this.cache.clear()

      // 清除 localStorage 中的缓存索引
      localStorage.removeItem('mediaCacheIndex')

      logger.info('[MediaService] All cache cleared')
    } catch (error) {
      logger.error('[MediaService] Failed to clear cache:', error)
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    count: number
    totalSize: number
    oldestEntry: number | null
    newestEntry: number | null
  } {
    const entries = Array.from(this.cache.values())

    return {
      count: entries.length,
      totalSize: entries.reduce((sum, entry) => sum + entry.size, 0),
      oldestEntry: entries.length > 0 ? Math.min(...entries.map((e) => e.cachedAt)) : null,
      newestEntry: entries.length > 0 ? Math.max(...entries.map((e) => e.cachedAt)) : null
    }
  }
}

// 导出单例实例
export const mediaService = MediaService.getInstance()
