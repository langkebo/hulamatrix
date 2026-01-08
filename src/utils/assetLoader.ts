import { logger } from '@/utils/logger'

/**
 * 表情名称类型
 */
type EmojiName =
  | 'alien-monster'
  | 'bug'
  | 'comet'
  | 'fire'
  | 'gear'
  | 'hammer-and-wrench'
  | 'lipstick'
  | 'memo'
  | 'package'
  | 'party-popper'
  | 'recycling-symbol'
  | 'right-arrow-curving-left'
  | 'rocket'
  | 'test-tube'

/**
 * Asset Loader - 统一资源加载工具
 * 提供头像、表情、文件图标等资源的统一加载和管理
 */

/**
 * 头像资源管理
 */
export class AvatarLoader {
  /**
   * 头像总数（用于动态分配）
   */
  private static readonly AVATAR_COUNT = 22

  /**
   * 根据用户ID获取默认头像URL
   * 使用哈希算法确保同一用户总是获得相同的头像
   * @param userId 用户ID
   * @returns 头像URL
   */
  static getDefaultAvatarUrl(userId: string): string {
    if (!userId) return '/avatar/default.webp'

    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i)
      hash = hash & hash // Convert to 32-bit integer
    }

    const index = (Math.abs(hash) % AvatarLoader.AVATAR_COUNT) + 1
    const paddedIndex = index.toString().padStart(3, '0')
    return `/avatar/${paddedIndex}.webp`
  }

  /**
   * 获取用户头像URL（优先使用自定义头像，回退到默认头像）
   * @param avatarUrl 自定义头像URL
   * @param userId 用户ID（用于生成默认头像）
   * @returns 最终头像URL
   */
  static getAvatarUrl(avatarUrl: string | null | undefined, userId: string): string {
    if (avatarUrl && avatarUrl.trim() !== '') {
      return avatarUrl
    }
    return AvatarLoader.getDefaultAvatarUrl(userId)
  }

  /**
   * 预加载头像资源
   * @param userIds 用户ID列表
   * @returns Promise<void>
   */
  static async preloadAvatars(userIds: string[]): Promise<void> {
    const urls = userIds.map((id) => AvatarLoader.getDefaultAvatarUrl(id))
    await EmojiLoader.preloadImages(urls)
  }
}

/**
 * 表情资源管理
 */
export class EmojiLoader {
  /**
   * 可用的表情列表
   */
  private static readonly EMOJI_LIST = [
    'alien-monster',
    'bug',
    'comet',
    'fire',
    'gear',
    'hammer-and-wrench',
    'lipstick',
    'memo',
    'package',
    'party-popper',
    'recycling-symbol',
    'right-arrow-curving-left',
    'rocket',
    'test-tube'
  ] as const

  /**
   * 表情类型
   */
  static readonly EmojiType = this.EMOJI_LIST

  /**
   * 检查是否是有效的表情名称
   */
  private static isValidEmojiName(name: string): name is EmojiName {
    return EmojiLoader.EMOJI_LIST.includes(name as EmojiName)
  }

  /**
   * 获取表情URL
   * @param emojiName 表情名称
   * @returns 表情URL
   */
  static getEmojiUrl(emojiName: string): string {
    const normalizedName = emojiName.replace(/^[:\s]+|[:\s]+$/g, '').toLowerCase()
    if (EmojiLoader.isValidEmojiName(normalizedName)) {
      return `/emoji/${normalizedName}.webp`
    }
    // 回退到通用的emoji表情（如果有）
    return `/emoji/${normalizedName}.webp`
  }

  /**
   * 检查表情是否存在
   * @param emojiName 表情名称
   * @returns 是否存在
   */
  static hasEmoji(emojiName: string): boolean {
    const normalizedName = emojiName.replace(/^[:\s]+|[:\s]+$/g, '').toLowerCase()
    return EmojiLoader.isValidEmojiName(normalizedName)
  }

  /**
   * 获取所有可用的表情列表
   * @returns 表情列表
   */
  static getAllEmojis(): readonly string[] {
    return EmojiLoader.EMOJI_LIST
  }

  /**
   * 预加载表情资源
   * @returns Promise<void>
   */
  static async preloadEmojis(): Promise<void> {
    const urls = EmojiLoader.EMOJI_LIST.map((name) => `/emoji/${name}.webp`)
    await EmojiLoader.preloadImages(urls)
  }

  /**
   * 预加载图片资源（公共方法，供其他类使用）
   * @param urls 图片URL列表
   * @returns Promise<void>
   */
  static async preloadImages(urls: string[]): Promise<void> {
    const promises = urls.map(
      (url) =>
        new Promise<void>((resolve, _reject) => {
          const img = new Image()
          img.onload = () => resolve()
          img.onerror = () => resolve() // 即使失败也不阻塞
          img.src = url
        })
    )
    await Promise.all(promises)
  }
}

/**
 * 文件图标资源管理
 */
export class FileIconLoader {
  /**
   * 支持的文件类型图标映射
   */
  private static readonly FILE_ICONS: Record<string, string> = {
    // 文档类
    doc: 'doc.svg',
    docx: 'docx.svg',
    pdf: 'pdf.svg',
    txt: 'txt.svg',
    md: 'md.svg',

    // 表格类
    xls: 'xls.svg',
    xlsx: 'xls.svg',

    // 演示类
    ppt: 'ppt.svg',
    pptx: 'ppt.svg',

    // 图片类
    jpg: 'jpg.svg',
    jpeg: 'jpg.svg',
    png: 'png.svg',
    gif: 'gif.svg',
    svg: 'svg.svg',
    webp: 'gif.svg',
    bmp: 'gif.svg',
    psd: 'psd.svg',

    // 视频类
    mp4: 'mp4.svg',
    mov: 'mov.svg',
    avi: 'mov.svg',
    mkv: 'mov.svg',
    webm: 'mov.svg',
    flv: 'mov.svg',

    // 音频类
    mp3: 'mp3.svg',
    wav: 'mp3.svg',
    m4a: 'mp3.svg',
    aac: 'mp3.svg',
    ogg: 'mp3.svg',
    flac: 'mp3.svg',

    // 代码类
    js: 'js.svg',
    jsx: 'jsx.svg',
    ts: 'ts.svg',
    vue: 'vue.svg',
    html: 'html.svg',
    css: 'css.svg',
    scss: 'scss.svg',
    less: 'less.svg',
    json: 'json.svg',
    py: 'py.svg',
    java: 'java.svg',
    sql: 'sql.svg',
    gitignore: 'gitignore.svg',

    // 压缩包类
    zip: 'zip.svg',
    rar: 'zip.svg',
    '7z': 'zip.svg',
    tar: 'zip.svg',
    gz: 'zip.svg',
    iso: 'iso.svg',

    // 可执行文件
    exe: 'exe.svg',
    apk: 'apk.svg',
    ipa: 'ipa.svg',
    dmg: 'dmg.svg',

    // 设计文件
    cad: 'cad.svg',
    stylus: 'stylus.svg',

    // 其他
    other: 'other.svg'
  }

  /**
   * 获取文件图标URL
   * @param fileName 文件名或扩展名
   * @returns 文件图标URL
   */
  static getFileIconUrl(fileName: string): string {
    const ext = FileIconLoader.getExtension(fileName)
    const iconFile = FileIconLoader.FILE_ICONS[ext] || FileIconLoader.FILE_ICONS.other
    return `/file/${iconFile}`
  }

  /**
   * 根据MIME类型获取文件图标URL
   * @param mimeType MIME类型
   * @returns 文件图标URL
   */
  static getFileIconUrlByMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'text/plain': 'txt',
      'text/html': 'html',
      'text/css': 'css',
      'text/javascript': 'js',
      'application/json': 'json',
      'image/': 'gif',
      'video/': 'mp4',
      'audio/': 'mp3',
      'application/zip': 'zip',
      'application/x-rar-compressed': 'zip',
      'application/x-7z-compressed': 'zip'
    }

    for (const [mime, ext] of Object.entries(mimeToExt)) {
      if (mimeType.startsWith(mime)) {
        return `/file/${FileIconLoader.FILE_ICONS[ext] || FileIconLoader.FILE_ICONS.other}`
      }
    }

    return `/file/${FileIconLoader.FILE_ICONS.other}`
  }

  /**
   * 获取文件扩展名
   * @param fileName 文件名
   * @returns 小写的扩展名（不含点）
   */
  private static getExtension(fileName: string): string {
    const parts = fileName.split('.')
    return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
  }
}

/**
 * 音效资源管理
 */
export class SoundLoader {
  /**
   * 可用的音效列表
   */
  private static readonly SOUNDS = {
    message: '/sound/message.mp3',
    notification: '/sound/notification.mp3',
    sent: '/sound/sent.mp3',
    received: '/sound/received.mp3',
    error: '/sound/error.mp3',
    typing: '/sound/typing.mp3',
    call: '/sound/call.mp3',
    hangup: '/sound/hangup.mp3'
  } as const

  /**
   * 音效缓存
   */
  private static audioCache: Map<string, HTMLAudioElement> = new Map()

  /**
   * 播放音效
   * @param soundName 音效名称
   * @param volume 音量（0-1）
   */
  static playSound(soundName: keyof typeof SoundLoader.SOUNDS, volume = 0.5): void {
    const url = SoundLoader.SOUNDS[soundName]
    if (!url) return

    let audio = SoundLoader.audioCache.get(url)

    if (!audio) {
      audio = new Audio(url)
      audio.volume = volume
      SoundLoader.audioCache.set(url, audio)
    }

    // 重置播放时间
    audio.currentTime = 0
    audio.play().catch(() => {
      // 忽略播放失败（可能是因为浏览器自动播放限制）
    })
  }

  /**
   * 预加载音效资源
   * @returns Promise<void>
   */
  static async preloadSounds(): Promise<void> {
    const promises = Object.values(SoundLoader.SOUNDS).map(
      (url) =>
        new Promise<void>((resolve) => {
          const audio = new Audio(url)
          audio.addEventListener('canplaythrough', () => {
            SoundLoader.audioCache.set(url, audio)
            resolve()
          })
          audio.addEventListener('error', () => resolve()) // 即使失败也不阻塞
          audio.load()
        })
    )
    await Promise.all(promises)
  }
}

/**
 * 主题资源管理
 */
export class ThemeLoader {
  /**
   * 预加载关键资源
   * 包括头像、表情、文件图标
   * @returns Promise<void>
   */
  static async preloadCriticalAssets(): Promise<void> {
    try {
      // 预加载默认头像
      await AvatarLoader.preloadAvatars(['default'])

      // 预加载常用表情（前5个）
      const commonEmojis = EmojiLoader.getAllEmojis().slice(0, 5)
      await Promise.all(
        commonEmojis.map((emoji) =>
          fetch(EmojiLoader.getEmojiUrl(emoji))
            .then(() => {})
            .catch(() => {})
        )
      )

      // 预加载常用文件图标
      const commonFileTypes = ['pdf', 'doc', 'docx', 'xls', 'jpg', 'mp4', 'zip']
      await Promise.all(
        commonFileTypes.map((ext) =>
          fetch(FileIconLoader.getFileIconUrl(`test.${ext}`))
            .then(() => {})
            .catch(() => {})
        )
      )
    } catch (error) {
      logger.warn('Some assets failed to preload:', error)
    }
  }

  /**
   * 清理资源缓存
   */
  static clearCache(): void {
    SoundLoader['audioCache'].clear()
  }
}

/**
 * 资源预加载管理器
 * 用于在应用启动时预加载关键资源
 */
export class AssetPreloader {
  private static isPreloading = false
  private static preloadPromises: Set<Promise<void>> = new Set()

  /**
   * 开始预加载关键资源
   * 使用低优先级，不阻塞应用启动
   * @returns Promise<void>
   */
  static async preload(): Promise<void> {
    if (AssetPreloader.isPreloading) return

    AssetPreloader.isPreloading = true

    const promise = (async () => {
      try {
        // 使用 requestIdleCallback 或 setTimeout 延迟加载
        await new Promise((resolve) => {
          if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            window.requestIdleCallback(() => resolve(void 0))
          } else {
            setTimeout(resolve, 100)
          }
        })

        // 预加载资源
        await ThemeLoader.preloadCriticalAssets()
        await EmojiLoader.preloadEmojis()
        await SoundLoader.preloadSounds()
      } catch (error) {
        logger.warn('Asset preloading failed:', error)
      } finally {
        AssetPreloader.isPreloading = false
      }
    })()

    AssetPreloader.preloadPromises.add(promise)
    promise.finally(() => {
      AssetPreloader.preloadPromises.delete(promise)
    })

    return promise
  }

  /**
   * 等待所有预加载完成
   * @returns Promise<void>
   */
  static async waitForPreload(): Promise<void> {
    await Promise.all(AssetPreloader.preloadPromises)
  }
}

// 导出便捷函数
export const getAvatarUrl = AvatarLoader.getAvatarUrl.bind(AvatarLoader)
export const getDefaultAvatarUrl = AvatarLoader.getDefaultAvatarUrl.bind(AvatarLoader)
export const getEmojiUrl = EmojiLoader.getEmojiUrl.bind(EmojiLoader)
export const getFileIconUrl = FileIconLoader.getFileIconUrl.bind(FileIconLoader)
export const getFileIconUrlByMimeType = FileIconLoader.getFileIconUrlByMimeType.bind(FileIconLoader)
export const playSound = SoundLoader.playSound.bind(SoundLoader)
export const preloadAssets = AssetPreloader.preload.bind(AssetPreloader)
