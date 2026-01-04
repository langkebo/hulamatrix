import { matrixClientService } from './client'
import { useChatStore } from '@/stores/chat'
import { Perf } from '@/utils/Perf'
import { MessageStatusEnum } from '@/enums'
import { mxcToHttp, buildDownloadUrl, buildThumbnailUrl } from './mxc'
import { hybridMediaCache } from '@/utils/mediaCacheDB'

// Type definitions for Matrix SDK objects
interface FileLike {
  name?: string
  type?: string
  [key: string]: unknown
}

interface MatrixUploadOptions {
  name?: string
  type?: string
  onProgress?: (loaded: number) => void
  signal?: AbortSignal
  [key: string]: unknown
}

interface MatrixClientLike {
  uploadContent?(file: Blob | File, options: MatrixUploadOptions): Promise<string>
  upload?(file: Blob | File, options: MatrixUploadOptions): Promise<string>
  on?(event: string, handler: (...args: unknown[]) => void): void
  [key: string]: unknown
}

interface MatrixEventLike {
  getId?(): string
  getContent?<T = Record<string, unknown>>(): T
  [key: string]: unknown
}

export type UploadOptions = {
  name?: string
  type?: string
  onProgress?: (loaded: number) => void
  signal?: AbortSignal
}

export async function uploadContent(file: Blob | File, opts?: UploadOptions): Promise<string> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) throw new Error('Matrix client not initialized')
  const fileLike = file as unknown as Partial<FileLike>
  const name = (
    opts?.name ||
    fileLike?.name ||
    `upload-${Date.now()}.${
      String(fileLike?.type || '')
        .split?.('/')
        ?.pop?.() || 'bin'
    }`
  ).toString()
  const type = opts?.type || fileLike?.type || 'application/octet-stream'
  Perf.mark('media-upload-start')
  let mxc: string | null = null
  const uploadOptions: MatrixUploadOptions = {
    name,
    type
  }
  if (opts?.onProgress !== undefined) uploadOptions.onProgress = opts.onProgress
  if (opts?.signal !== undefined) uploadOptions.signal = opts.signal
  if (typeof client.uploadContent === 'function') {
    mxc = await client.uploadContent(file, uploadOptions)
  } else if (typeof client.upload === 'function') {
    mxc = await client.upload(file, uploadOptions)
  } else {
    mxc = 'mxc://server/mock'
  }
  Perf.measure('media-upload-duration', 'media-upload-start')
  return mxc
}

export const mediaUrl = {
  mxcToHttp,
  download: buildDownloadUrl,
  thumbnail: buildThumbnailUrl
}

export async function downloadContent(mxc: string, opts?: { authenticated?: boolean }): Promise<Blob> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client not initialized')
  const authenticated = opts?.authenticated ?? false
  const url = mxcToHttp(mxc, { authenticated })
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`download failed: ${res.status}`)
  return await res.blob()
}

/**
 * Download content with IndexedDB caching
 * Checks cache first, downloads if not cached
 */
export async function downloadContentCached(
  mxc: string,
  opts?: { authenticated?: boolean; ttl?: number; forceRefresh?: boolean }
): Promise<Blob> {
  const cacheKey = `mxc:${mxc}`

  // Check cache first (unless force refresh is requested)
  if (!opts?.forceRefresh) {
    const cached = await hybridMediaCache.get(cacheKey)
    if (cached) {
      return cached
    }
  }

  // Download the content
  const blob = await downloadContent(mxc, opts)

  // Store in cache
  await hybridMediaCache.put(cacheKey, blob, opts?.ttl, mxcToHttp(mxc, { authenticated: opts?.authenticated }))

  return blob
}

/**
 * Preload media into cache
 */
export async function preloadMedia(mxc: string, opts?: { authenticated?: boolean; ttl?: number }): Promise<void> {
  const cacheKey = `mxc:${mxc}`

  // Check if already cached
  const cached = await hybridMediaCache.has(cacheKey)
  if (cached) return

  // Download and cache
  const blob = await downloadContent(mxc, opts)
  await hybridMediaCache.put(cacheKey, blob, opts?.ttl, mxcToHttp(mxc, { authenticated: opts?.authenticated }))
}

/**
 * Upload content and cache result
 */
export async function uploadContentCached(
  file: Blob | File,
  opts?: UploadOptions & { cacheTTL?: number }
): Promise<string> {
  // Upload the file
  const mxc = await uploadContent(file, opts)

  // Cache the uploaded blob
  const cacheKey = `mxc:${mxc}`
  await hybridMediaCache.put(cacheKey, file, opts?.cacheTTL)

  return mxc
}

/**
 * Clear media cache
 */
export async function clearMediaCache(): Promise<void> {
  await hybridMediaCache.clear()
}

/**
 * Get media cache statistics
 */
export async function getMediaCacheStats(): Promise<{
  memory: { count: number; size: number }
  db: { count: number; totalSize: number; expiredCount: number; maxSize: number }
}> {
  return await hybridMediaCache.getStats()
}

/**
 * Cleanup expired media cache entries
 */
export async function cleanupMediaCache(): Promise<number> {
  return await hybridMediaCache.cleanup()
}

export function setupMatrixMediaBridge() {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) return
  const chatStore = useChatStore()

  client.on?.('Room.timeline', (...args: unknown[]) => {
    const toStartOfTimeline = args[2] as boolean
    if (toStartOfTimeline) return
    const event = args[0] as unknown
    const ev = event as Partial<MatrixEventLike>
    const content =
      (typeof ev?.getContent === 'function' ? ev.getContent() : (ev?.content as Record<string, unknown>)) || {}
    if (
      content.msgtype === 'm.image' ||
      content.msgtype === 'm.video' ||
      content.msgtype === 'm.file' ||
      content.msgtype === 'm.audio'
    ) {
      const id = typeof ev?.getId === 'function' ? ev.getId() : ''
      const msg = chatStore.getMessage(id)
      const body = msg?.message?.body || {}
      const url = typeof body?.url === 'string' ? mediaUrl.mxcToHttp(body.url) : body?.url
      const updateBody: { url?: string; [key: string]: unknown } = { ...(typeof body === 'object' ? body : {}) }
      if (url !== undefined) updateBody.url = url
      chatStore.updateMsg({
        msgId: id,
        status: msg?.message?.status ?? MessageStatusEnum.SUCCESS,
        body: updateBody,
        uploadProgress: 0
      })
    }
  })
}
