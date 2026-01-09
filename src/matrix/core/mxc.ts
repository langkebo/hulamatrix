import { useMatrixAuthStore } from '@/stores/matrixAuth'
import { matrixClientService } from '@/matrix/core/client'
import { logger } from '@/utils/logger'

type ThumbnailMethod = 'crop' | 'scale'

const cache = new Map<string, string>()

export function parseMxc(mxc: string): { server: string; mediaId: string } | null {
  if (!mxc || typeof mxc !== 'string') return null
  if (!mxc.startsWith('mxc://')) return null
  const rest = mxc.slice('mxc://'.length)
  const idx = rest.indexOf('/')
  if (idx <= 0) return null
  const server = rest.slice(0, idx)
  const mediaId = rest.slice(idx + 1)
  if (!server || !mediaId) return null
  return { server, mediaId }
}

export function getMediaBase(): string {
  let base = ''
  try {
    const auth = useMatrixAuthStore()
    base = auth.getHomeserverBaseUrl() || base
  } catch (e) {
    try {
      logger.warn('[mxc] getMediaBase auth read failed:', e instanceof Error ? e : new Error(String(e)))
    } catch {}
  }
  if (!base) {
    try {
      const client = matrixClientService.getClient() as { baseUrl?: string } | null
      base = (client?.baseUrl || '').replace(/\/$/, '') || base
    } catch (e) {
      try {
        logger.warn('[mxc] getMediaBase client read failed:', e instanceof Error ? e : new Error(String(e)))
      } catch {}
    }
  }
  return base.replace(/\/$/, '')
}

/**
 * 构建媒体下载 URL
 * @param mxc MXC 地址（mxc://server/id）
 * @param useAuth 是否使用认证媒体端点（需要访问令牌）
 * @returns 可用于下载的 HTTP URL 或 null
 */
export function buildDownloadUrl(mxc: string, useAuth = false): string | null {
  const p = parseMxc(mxc)
  if (!p) return null
  const base = getMediaBase()
  if (!base) return null
  if (useAuth) {
    return `${base}/_matrix/client/v1/media/download/${p.server}/${p.mediaId}`
  }
  return `${base}/_matrix/media/v3/download/${p.server}/${p.mediaId}`
}

/**
 * 构建媒体缩略图 URL
 * @param mxc MXC 地址（mxc://server/id）
 * @param width 目标宽度
 * @param height 目标高度
 * @param method 缩放方式（crop/scale）
 * @returns 缩略图 HTTP URL 或 null
 */
export function buildThumbnailUrl(
  mxc: string,
  width = 320,
  height = 320,
  method: ThumbnailMethod = 'crop'
): string | null {
  const p = parseMxc(mxc)
  if (!p) return null
  const base = getMediaBase()
  if (!base) return null
  const w = Math.max(1, Math.floor(width))
  const h = Math.max(1, Math.floor(height))
  const m = method === 'scale' ? 'scale' : 'crop'
  return `${base}/_matrix/media/v3/thumbnail/${p.server}/${p.mediaId}?width=${w}&height=${h}&method=${m}`
}

/**
 * 将 MXC 转换为 HTTP URL（优先使用 SDK 客户端方法）
 * @param mxc MXC 地址（mxc://server/id）
 * @param opts 选项：缩略图参数与是否使用认证媒体
 * @returns 可直接请求的 HTTP URL
 */
export function mxcToHttp(
  mxc: string,
  opts?: { thumbnail?: boolean; width?: number; height?: number; method?: ThumbnailMethod; authenticated?: boolean }
): string {
  if (!mxc || typeof mxc !== 'string') return mxc
  if (!mxc.startsWith('mxc://')) return mxc

  // Get client and try to use SDK's mxcUrlToHttp method
  const client = matrixClientService.getClient() as {
    mxcUrlToHttp?: (
      mxc: string,
      w?: number,
      h?: number,
      m?: string,
      resizeMethod?: string,
      allowDirect?: boolean,
      allowRedirects?: boolean,
      useAuth?: boolean
    ) => string
  } | null

  try {
    if (client?.mxcUrlToHttp) {
      const useAuth = !!opts?.authenticated
      const allowRedirects = true
      if (opts?.thumbnail) {
        const w = opts?.width ?? 320
        const h = opts?.height ?? 320
        const m = opts?.method === 'scale' ? 'scale' : 'crop'
        return client.mxcUrlToHttp(mxc, w, h, m, undefined, allowRedirects, useAuth)
      }
      return client.mxcUrlToHttp(mxc, undefined, undefined, undefined, undefined, allowRedirects, useAuth)
    }
  } catch (e) {
    try {
      logger.warn('[mxc] mxcUrlToHttp failed, fallback to manual build:', e instanceof Error ? e : new Error(String(e)))
    } catch {}
  }
  const key = JSON.stringify({ mxc, opts })
  const hit = cache.get(key)
  if (hit) return hit
  const useAuth = !!opts?.authenticated
  const url = opts?.thumbnail
    ? buildThumbnailUrl(mxc, opts?.width, opts?.height, opts?.method) || mxc
    : (() => {
        const d = buildDownloadUrl(mxc, useAuth)
        if (d) return d
        const p = parseMxc(mxc)
        if (p) {
          if (useAuth) return `/_matrix/client/v1/media/download/${p.server}/${p.mediaId}`
          return `/_matrix/media/v3/download/${p.server}/${p.mediaId}`
        }
        return mxc
      })()
  cache.set(key, url)
  return url
}
