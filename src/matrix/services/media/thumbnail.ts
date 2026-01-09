/**
 * Matrix Thumbnail Service
 * Generates multi-size thumbnails and handles responsive image loading
 *
 * @module services/matrixThumbnailService
 */

import { logger } from '@/utils/logger'
import { mxcToHttp } from '@/matrix/core/mxc'

/**
 * 缩略图尺寸预设
 */
export interface ThumbnailSize {
  name: string
  width: number
  height: number
  method: 'crop' | 'scale'
}

/**
 * 预定义的缩略图尺寸
 */
export const THUMBNAIL_SIZES: Record<string, ThumbnailSize> = {
  xs: { name: 'xs', width: 32, height: 32, method: 'crop' },
  sm: { name: 'sm', width: 64, height: 64, method: 'crop' },
  md: { name: 'md', width: 128, height: 128, method: 'crop' },
  lg: { name: 'lg', width: 256, height: 256, method: 'scale' },
  xl: { name: 'xl', width: 512, height: 512, method: 'scale' },
  xxl: { name: 'xxl', width: 1024, height: 1024, method: 'scale' }
}

/**
 * 缩略图 URL 集合
 */
export interface ThumbnailUrls {
  xs?: string
  sm?: string
  md?: string
  lg?: string
  xl?: string
  xxl?: string
  [key: string]: string | undefined
}

/**
 * 客户端缩略图选项
 */
export interface ClientThumbnailOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'image/jpeg' | 'image/png' | 'image/webp'
  maintainAspectRatio?: boolean
}

/**
 * 响应式图片选项
 */
export interface ResponsiveImageOptions {
  sizes?: string // e.g., "(max-width: 600px) 100vw, 50vw"
  srcset?: string
  loading?: 'lazy' | 'eager'
  decoding?: 'async' | 'sync' | 'auto'
}

/**
 * 懒加载选项
 */
export interface LazyLoadOptions {
  rootMargin?: string
  threshold?: number
  placeholder?: string
}

/**
 * Matrix Thumbnail Service
 * 提供缩略图生成和响应式图片加载功能
 */
export class MatrixThumbnailService {
  private static instance: MatrixThumbnailService

  // 缩略图缓存
  private thumbnailCache: Map<string, ThumbnailUrls> = new Map()

  // 客户端生成的缩略图缓存
  private clientThumbnailCache: Map<string, Blob> = new Map()

  // Intersection Observer 实例
  private lazyLoadObserver: IntersectionObserver | null = null

  // 懒加载回调映射
  private lazyLoadCallbacks: Map<Element, () => void> = new Map()

  private constructor() {
    this.setupLazyLoadObserver()
  }

  static getInstance(): MatrixThumbnailService {
    if (!MatrixThumbnailService.instance) {
      MatrixThumbnailService.instance = new MatrixThumbnailService()
    }
    return MatrixThumbnailService.instance
  }

  /**
   * 设置懒加载观察器
   */
  private setupLazyLoadObserver(): void {
    if (typeof IntersectionObserver === 'undefined') {
      logger.warn('[ThumbnailService] IntersectionObserver not available')
      return
    }

    this.lazyLoadObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const callback = this.lazyLoadCallbacks.get(entry.target)
            if (callback) {
              callback()
              this.lazyLoadCallbacks.delete(entry.target)
              this.lazyLoadObserver?.unobserve(entry.target)
            }
          }
        })
      },
      {
        rootMargin: '50px',
        threshold: 0.01
      }
    )
  }

  /**
   * 生成多个尺寸的缩略图 URL
   */
  getThumbnailUrls(
    mxcUrl: string,
    sizes: (keyof typeof THUMBNAIL_SIZES)[] = ['sm', 'md', 'lg', 'xl'],
    method: 'crop' | 'scale' = 'crop'
  ): ThumbnailUrls {
    // 检查缓存
    const cacheKey = `${mxcUrl}_${sizes.join(',')}_${method}`
    if (this.thumbnailCache.has(cacheKey)) {
      return this.thumbnailCache.get(cacheKey)!
    }

    const urls: ThumbnailUrls = {}

    for (const size of sizes) {
      const sizeConfig = THUMBNAIL_SIZES[size]
      if (sizeConfig) {
        urls[size] = mxcToHttp(mxcUrl, {
          width: sizeConfig.width,
          height: sizeConfig.height,
          method: sizeConfig.method
        })
      }
    }

    // 缓存结果
    this.thumbnailCache.set(cacheKey, urls)

    return urls
  }

  /**
   * 根据容器宽度选择合适的缩略图尺寸
   */
  getThumbnailForWidth(mxcUrl: string, containerWidth: number, method: 'crop' | 'scale' = 'scale'): string {
    let size: keyof typeof THUMBNAIL_SIZES = 'lg'

    if (containerWidth <= 64) {
      size = 'xs'
    } else if (containerWidth <= 128) {
      size = 'sm'
    } else if (containerWidth <= 256) {
      size = 'md'
    } else if (containerWidth <= 512) {
      size = 'lg'
    } else if (containerWidth <= 1024) {
      size = 'xl'
    } else {
      size = 'xxl'
    }

    const sizeConfig = THUMBNAIL_SIZES[size]
    return mxcToHttp(mxcUrl, {
      width: sizeConfig.width,
      height: sizeConfig.height,
      method
    })
  }

  /**
   * 生成 srcset 字符串
   */
  generateSrcSet(
    mxcUrl: string,
    sizes: (keyof typeof THUMBNAIL_SIZES)[] = ['sm', 'md', 'lg', 'xl'],
    method: 'crop' | 'scale' = 'scale'
  ): string {
    const urls = this.getThumbnailUrls(mxcUrl, sizes, method)

    return sizes
      .filter((size) => urls[size])
      .map((size) => {
        const sizeConfig = THUMBNAIL_SIZES[size]
        return `${urls[size]} ${sizeConfig.width}w`
      })
      .join(', ')
  }

  /**
   * 生成 sizes 属性
   */
  generateSizes(breakpoints: { maxWidth: number; size: string }[]): string {
    return breakpoints.map((bp) => `(max-width: ${bp.maxWidth}px) ${bp.size}`).join(', ')
  }

  /**
   * 客户端生成缩略图（使用 Canvas）
   */
  async generateClientThumbnail(file: File | Blob, options: ClientThumbnailOptions = {}): Promise<Blob> {
    const { width = 256, height = 256, quality = 0.9, format = 'image/jpeg', maintainAspectRatio = true } = options

    const cacheKey = `${file.size}_${width}_${height}_${format}_${quality}`

    // 检查缓存
    if (this.clientThumbnailCache.has(cacheKey)) {
      return this.clientThumbnailCache.get(cacheKey)!
    }

    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(url)

        try {
          // 创建 canvas
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }

          // 计算目标尺寸
          let targetWidth = width
          let targetHeight = height

          if (maintainAspectRatio) {
            const aspectRatio = img.width / img.height
            if (aspectRatio > width / height) {
              targetHeight = Math.round(width / aspectRatio)
            } else {
              targetWidth = Math.round(height * aspectRatio)
            }
          }

          canvas.width = targetWidth
          canvas.height = targetHeight

          // 绘制缩略图
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

          // 转换为 Blob
          canvas.toBlob(
            (blob) => {
              if (blob) {
                // 缓存结果
                this.clientThumbnailCache.set(cacheKey, blob)
                resolve(blob)
              } else {
                reject(new Error('Failed to generate thumbnail'))
              }
            },
            format,
            quality
          )
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load image'))
      }

      img.src = url
    })
  }

  /**
   * 批量生成客户端缩略图
   */
  async generateBatchClientThumbnails(
    files: (File | Blob)[],
    options: ClientThumbnailOptions = {}
  ): Promise<Map<File | Blob, Blob>> {
    const results = new Map<File | Blob, Blob>()

    for (const file of files) {
      try {
        const thumbnail = await this.generateClientThumbnail(file, options)
        results.set(file, thumbnail)
      } catch (error) {
        logger.error('[ThumbnailService] Failed to generate client thumbnail', { error })
      }
    }

    logger.info('[ThumbnailService] Batch client thumbnails generated', {
      total: files.length,
      successful: results.size
    })

    return results
  }

  /**
   * 注册懒加载元素
   */
  registerLazyLoad(element: Element, callback: () => void): void {
    if (!this.lazyLoadObserver) {
      // 如果 IntersectionObserver 不可用，直接执行回调
      callback()
      return
    }

    this.lazyLoadCallbacks.set(element, callback)
    this.lazyLoadObserver.observe(element)
  }

  /**
   * 取消懒加载
   */
  unregisterLazyLoad(element: Element): void {
    this.lazyLoadCallbacks.delete(element)
    this.lazyLoadObserver?.unobserve(element)
  }

  /**
   * 预加载图片
   */
  async preloadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()

      img.onload = () => resolve(img)
      img.onerror = reject

      img.src = url
    })
  }

  /**
   * 批量预加载图片
   */
  async preloadImages(urls: string[]): Promise<HTMLImageElement[]> {
    const results: HTMLImageElement[] = []
    const errors: string[] = []

    for (const url of urls) {
      try {
        const img = await this.preloadImage(url)
        results.push(img)
      } catch (error) {
        errors.push(url)
        logger.error('[ThumbnailService] Failed to preload image', { url, error })
      }
    }

    logger.info('[ThumbnailService] Images preloaded', {
      total: urls.length,
      successful: results.length,
      failed: errors.length
    })

    return results
  }

  /**
   * 清除缩略图 URL 缓存
   */
  clearUrlCache(): void {
    this.thumbnailCache.clear()
    logger.debug('[ThumbnailService] Thumbnail URL cache cleared')
  }

  /**
   * 清除客户端缩略图缓存
   */
  clearClientCache(): void {
    this.clientThumbnailCache.clear()
    logger.debug('[ThumbnailService] Client thumbnail cache cleared')
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.clearUrlCache()
    this.clearClientCache()
  }

  /**
   * 获取缓存大小
   */
  getCacheSize(): { urlCache: number; clientCache: number } {
    return {
      urlCache: this.thumbnailCache.size,
      clientCache: this.clientThumbnailCache.size
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    // 停止观察所有元素
    if (this.lazyLoadObserver) {
      this.lazyLoadObserver.disconnect()
      this.lazyLoadObserver = null
    }

    // 清除所有缓存
    this.clearAllCache()

    // 清除回调
    this.lazyLoadCallbacks.clear()

    logger.info('[ThumbnailService] Disposed')
  }
}

// 导出单例实例
export const matrixThumbnailService = MatrixThumbnailService.getInstance()

// 导出便捷函数
export function getThumbnailUrls(
  mxcUrl: string,
  sizes?: (keyof typeof THUMBNAIL_SIZES)[],
  method?: 'crop' | 'scale'
): ThumbnailUrls {
  return matrixThumbnailService.getThumbnailUrls(mxcUrl, sizes, method)
}

export function getThumbnailForWidth(mxcUrl: string, containerWidth: number, method?: 'crop' | 'scale'): string {
  return matrixThumbnailService.getThumbnailForWidth(mxcUrl, containerWidth, method)
}

export function generateSrcSet(
  mxcUrl: string,
  sizes?: (keyof typeof THUMBNAIL_SIZES)[],
  method?: 'crop' | 'scale'
): string {
  return matrixThumbnailService.generateSrcSet(mxcUrl, sizes, method)
}

export async function generateClientThumbnail(file: File | Blob, options?: ClientThumbnailOptions): Promise<Blob> {
  return matrixThumbnailService.generateClientThumbnail(file, options)
}

export async function preloadImage(url: string): Promise<HTMLImageElement> {
  return matrixThumbnailService.preloadImage(url)
}

export function registerLazyLoad(element: Element, callback: () => void): void {
  matrixThumbnailService.registerLazyLoad(element, callback)
}
