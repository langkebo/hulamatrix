/**
 * Matrix Media Upload Service
 *
 * 基于 Matrix JS SDK 的媒体上传服务
 * 用于替代旧的 WebSocket 七牛云上传 API
 *
 * **Matrix SDK API 参考**:
 * - client.uploadContent(file, options): 上传文件到 Matrix 媒体服务器
 * - 返回 mxc:// URL 格式
 *
 * **旧的实现** (已废弃):
 * - 七牛云上传 (get_qiniu_token, QINIU)
 * - 分片上传 (chunked uploads)
 * - 自定义文件哈希去重
 *
 * **新的实现**:
 * - 直接使用 Matrix SDK 的 uploadContent 方法
 * - 自动缓存支持
 * - 进度跟踪支持
 */

import { matrixClientService } from './client'
import { logger } from '@/utils/logger'
import { hybridMediaCache } from '@/utils/mediaCacheDB'

/**
 * 上传选项
 */
export interface UploadContentOptions {
  /** 文件名 */
  name?: string
  /** MIME 类型 */
  type?: string
  /** 进度回调 */
  onProgress?: (loaded: number, total: number) => void
  /** 取消信号 */
  signal?: AbortSignal
  /** 是否缓存上传的文件 */
  cache?: boolean
  /** 缓存 TTL（毫秒） */
  cacheTTL?: number
}

/**
 * 媒体缓存统计
 */
export interface MediaCacheStats {
  memory: { count: number; size: number }
  db: { count: number; totalSize: number; expiredCount: number; maxSize: number }
}

/**
 * 上传文件到 Matrix 媒体服务器
 *
 * @param file - 要上传的文件
 * @param options - 上传选项
 * @returns mxc:// URL
 *
 * @example
 * ```typescript
 * const file = new File(["content"], "example.txt", { type: "text/plain" })
 * const mxcUrl = await uploadContent(file, { name: "example.txt" })
 * console.log(mxcUrl) // "mxc://server.com/mediaId"
 * ```
 */
export async function uploadContent(
  file: Blob | File,
  options?: UploadContentOptions
): Promise<string> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error('Matrix client not initialized')
  }

  // 获取文件名和类型
  const fileLike = file as Partial<File>
  const name = options?.name || fileLike.name || `upload-${Date.now()}`
  const type = options?.type || fileLike.type || 'application/octet-stream'

  logger.debug('[MatrixMedia] Starting upload', { name, type, size: file.size })

  // 准备上传选项
  const uploadOptions: {
    name?: string
    type?: string
    progressHandler?: { loaded: (bytes: number) => void }
    signal?: AbortSignal
  } = {
    name,
    type
  }

  // 添加进度回调
  if (options?.onProgress) {
    uploadOptions.progressHandler = {
      loaded: (bytes: number) => {
        options.onProgress!(bytes, file.size)
      }
    }
  }

  // 添加取消信号
  if (options?.signal) {
    uploadOptions.signal = options.signal
  }

  try {
    // 使用 Matrix SDK 上传
    const startTime = Date.now()

    // 类型安全的上传调用
    let mxcUrl: string
    if (
      client &&
      typeof client === 'object' &&
      'uploadContent' in client &&
      typeof client.uploadContent === 'function'
    ) {
      mxcUrl = await (client.uploadContent as (
        file: Blob | File,
        options: { name?: string; type?: string; progressHandler?: { loaded: (bytes: number) => void }; signal?: AbortSignal }
      ) => Promise<string>)(file, uploadOptions)
    } else {
      throw new Error('Matrix client does not support uploadContent')
    }

    const duration = Date.now() - startTime
    logger.info('[MatrixMedia] Upload completed', {
      mxc: mxcUrl,
      duration: `${duration}ms`,
      size: file.size
    })

    // 可选：缓存上传的文件
    if (options === undefined || options.cache !== false) {
      const cacheKey = `mxc:${mxcUrl}`
      await hybridMediaCache.put(cacheKey, file, options?.cacheTTL)
      logger.debug('[MatrixMedia] Cached uploaded file', { cacheKey })
    }

    return mxcUrl
  } catch (error) {
    logger.error('[MatrixMedia] Upload failed', error as Error)
    throw new Error(`Upload failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 上传图片并获取尺寸
 *
 * @param file - 图片文件
 * @param options - 上传选项
 * @returns mxc:// URL 和图片尺寸
 */
export async function uploadImage(
  file: File,
  options?: UploadContentOptions
): Promise<{ mxcUrl: string; width?: number; height?: number }> {
  // 获取图片尺寸
  let width: number | undefined
  let height: number | undefined

  if (file.type.startsWith('image/')) {
    try {
      const dimensions = await getImageDimensions(file)
      width = dimensions.width
      height = dimensions.height
      logger.debug('[MatrixMedia] Image dimensions', { width, height })
    } catch (error) {
      logger.warn('[MatrixMedia] Failed to get image dimensions', error as Error)
    }
  }

  // 上传文件
  const mxcUrl = await uploadContent(file, options)

  return { mxcUrl, width, height }
}

/**
 * 获取图片尺寸
 */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.width, height: img.height })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

/**
 * 下载媒体内容
 *
 * @param mxc - mxc:// URL
 * @param authenticated - 是否需要认证
 * @returns Blob
 */
export async function downloadContent(mxc: string, authenticated?: boolean): Promise<Blob> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error('Matrix client not initialized')
  }

  // 使用 mxcToHttp 转换 URL
  const httpUrl = mxcToHttp(mxc, { authenticated })

  const response = await fetch(httpUrl, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`)
  }

  return await response.blob()
}

/**
 * 下载媒体内容（带缓存）
 *
 * @param mxc - mxc:// URL
 * @param options - 下载选项
 * @returns Blob
 */
export async function downloadContentCached(
  mxc: string,
  options?: {
    authenticated?: boolean
    ttl?: number
    forceRefresh?: boolean
  }
): Promise<Blob> {
  const cacheKey = `mxc:${mxc}`

  // 检查缓存
  if (!options?.forceRefresh) {
    const cached = await hybridMediaCache.get(cacheKey)
    if (cached) {
      logger.debug('[MatrixMedia] Cache hit', { cacheKey })
      return cached
    }
  }

  // 下载内容
  const blob = await downloadContent(mxc, options?.authenticated)

  // 存入缓存
  await hybridMediaCache.put(
    cacheKey,
    blob,
    options?.ttl,
    mxcToHttp(mxc, { authenticated: options?.authenticated })
  )

  return blob
}

/**
 * 预加载媒体到缓存
 *
 * @param mxc - mxc:// URL
 * @param options - 预加载选项
 */
export async function preloadMedia(
  mxc: string,
  options?: { authenticated?: boolean; ttl?: number }
): Promise<void> {
  const cacheKey = `mxc:${mxc}`

  // 检查是否已缓存
  const cached = await hybridMediaCache.has(cacheKey)
  if (cached) {
    logger.debug('[MatrixMedia] Already cached', { cacheKey })
    return
  }

  // 下载并缓存
  const blob = await downloadContent(mxc, options?.authenticated)
  await hybridMediaCache.put(
    cacheKey,
    blob,
    options?.ttl,
    mxcToHttp(mxc, { authenticated: options?.authenticated })
  )

  logger.debug('[MatrixMedia] Preloaded to cache', { cacheKey })
}

/**
 * 清除媒体缓存
 */
export async function clearMediaCache(): Promise<void> {
  await hybridMediaCache.clear()
  logger.info('[MatrixMedia] Media cache cleared')
}

/**
 * 获取媒体缓存统计
 */
export async function getMediaCacheStats(): Promise<MediaCacheStats> {
  return await hybridMediaCache.getStats()
}

/**
 * 清理过期的媒体缓存
 */
export async function cleanupMediaCache(): Promise<number> {
  const count = await hybridMediaCache.cleanup()
  logger.info('[MatrixMedia] Cleaned up expired cache entries', { count })
  return count
}

/**
 * MXC URL 转 HTTP URL
 *
 * @param mxc - mxc:// URL
 * @param options - 转换选项
 * @returns HTTP URL
 */
export function mxcToHttp(
  mxc: string,
  options?: {
    width?: number
    height?: number
    method?: 'crop' | 'scale'
    authenticated?: boolean
  }
): string {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error('Matrix client not initialized')
  }

  // 调用 Matrix SDK 的 mxcUrlToHttp 方法
  if (
    client &&
    typeof client === 'object' &&
    'mxcUrlToHttp' in client &&
    typeof client.mxcUrlToHttp === 'function'
  ) {
    return (client.mxcUrlToHttp as (
      mxc: string,
      width?: number,
      height?: number,
      method?: 'crop' | 'scale',
      allowDirectLinks?: boolean,
      allowRedirects?: boolean,
      useAuthentication?: boolean
    ) => string)(
      mxc,
      options?.width,
      options?.height,
      options?.method,
      false,
      true,
      options?.authenticated
    )
  }

  // 降级：手动构造 URL
  const match = mxc.match(/^mxc:\/\/([^/]+)\/(.+)$/)
  if (!match) {
    throw new Error(`Invalid MXC URL: ${mxc}`)
  }

  const [, server, mediaId] = match
  const baseUrl = (client.getBaseUrl as () => string)()
  return `${baseUrl}/_matrix/media/v3/download/${server}/${mediaId}`
}

/**
 * 构建下载 URL
 */
export function buildDownloadUrl(mxc: string, authenticated?: boolean): string {
  return mxcToHttp(mxc, { authenticated })
}

/**
 * 构建缩略图 URL
 */
export function buildThumbnailUrl(
  mxc: string,
  width: number,
  height: number,
  method?: 'crop' | 'scale',
  authenticated?: boolean
): string {
  return mxcToHttp(mxc, { width, height, method, authenticated })
}

/**
 * 导出的媒体 URL 工具
 */
export const mediaUrl = {
  mxcToHttp,
  download: buildDownloadUrl,
  thumbnail: buildThumbnailUrl
}

/**
 * 设置 Matrix 媒体桥接
 * 监听房间事件，自动转换 MXC URL 为 HTTP URL
 */
export function setupMatrixMediaBridge(): void {
  const client = matrixClientService.getClient()
  if (!client) return

  // 监听房间时间线事件
  if (
    client &&
    typeof client === 'object' &&
    'on' in client &&
    typeof client.on === 'function'
  ) {
    ;(client as { on: (event: string, handler: (...args: unknown[]) => void) => void }).on(
      'Room.timeline',
      (...args: unknown[]) => {
        const toStartOfTimeline = args[2] as boolean
        if (toStartOfTimeline) return

        const event = args[0] as unknown
        if (!event || typeof event !== 'object') return

        // 检查是否是媒体事件
        const content = 'getContent' in event && typeof event.getContent === 'function' ? event.getContent() : {}
        if (!content || typeof content !== 'object') return

        const isMediaEvent =
          content.msgtype === 'm.image' ||
          content.msgtype === 'm.video' ||
          content.msgtype === 'm.file' ||
          content.msgtype === 'm.audio'

        if (isMediaEvent && content.url) {
          // MXC URL 已在消息中，UI 组件会使用 mxcToHttp 转换
          logger.debug('[MatrixMedia] Media event received', {
            msgtype: content.msgtype,
            mxc: content.url
          })
        }
      }
    )
  }
}
