/**
 * @deprecated 七牛云图片处理工具已废弃
 *
 * 项目已迁移到 Matrix 媒体服务器，此文件仅用于兼容历史数据。
 * 新功能请使用 Matrix 的缩略图 API (buildThumbnailUrl from @/integrations/matrix/mxc)
 *
 * 注意：由于 QINIU_HOST_KEYWORDS 为空，此工具实际上不会匹配任何 URL。
 * 如果需要支持历史七牛云链接，请在配置中添加相应的 host keywords。
 */

const QINIU_HOST_KEYWORDS: string[] = []

const isQiniuHost = (hostname: string) => {
  const lowerHost = hostname.toLowerCase()
  return QINIU_HOST_KEYWORDS.some((keyword) => lowerHost.includes(keyword))
}

export type QiniuImageFormat = 'webp' | 'avif'

export type QiniuThumbOptions = {
  width?: number
  height?: number
  quality?: number
  format?: QiniuImageFormat
}

export const buildQiniuThumbnailUrl = (url?: string | null, options: QiniuThumbOptions = {}): string | undefined => {
  if (!url) return url ?? undefined

  try {
    const parsedUrl = new URL(url)
    if (!isQiniuHost(parsedUrl.hostname)) {
      return url
    }

    // 如果已经带有 imageView/imageMogr 等后处理参数，直接返回原链接
    const existingQuery = parsedUrl.search.toLowerCase()
    if (
      existingQuery.includes('imageview') ||
      existingQuery.includes('imagemogr') ||
      existingQuery.includes('imageview2')
    ) {
      return url
    }

    const { width, height, quality = 75 } = options
    const segments = ['imageView2', '2']
    if (width) segments.push('w', Math.round(width).toString())
    if (height) segments.push('h', Math.round(height).toString())
    if (quality) segments.push('q', Math.round(quality).toString())
    if (options.format) segments.push('format', options.format)

    const directive = segments.join('/')
    const hasQuery = parsedUrl.search.length > 0
    parsedUrl.search += `${hasQuery ? '&' : '?'}${directive}`

    return parsedUrl.toString()
  } catch {
    return url
  }
}

let preferredFormat: QiniuImageFormat | null | undefined

const canUseDataUrl = (type: string) => {
  if (typeof document === 'undefined') return false
  const canvas = document.createElement('canvas')
  if (!canvas.getContext) return false
  try {
    return canvas.toDataURL(type).startsWith(`data:${type}`)
  } catch {
    return false
  }
}

const detectPreferredFormat = (): QiniuImageFormat | undefined => {
  try {
    if (canUseDataUrl('image/avif')) {
      return 'avif'
    }
    if (canUseDataUrl('image/webp')) {
      return 'webp'
    }
  } catch {
    // ignore detection errors
  }
  return void 0
}

export const getPreferredQiniuFormat = (): QiniuImageFormat | undefined => {
  if (preferredFormat === null) {
    return undefined
  }

  if (preferredFormat === undefined) {
    preferredFormat = detectPreferredFormat() ?? null
  }

  return preferredFormat === null ? undefined : preferredFormat
}
