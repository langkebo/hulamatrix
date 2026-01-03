/**
 * Platform Adapter
 *
 * 统一PC端和移动端的平台差异处理
 * 提供一致的API接口，内部根据平台选择不同实现
 */

import { isMobile } from '@/utils/PlatformConstants'
import type { MessageType } from '@/services/types'

/**
 * 平台配置
 */
export interface PlatformConfig {
  // 消息功能
  canForwardMessages: boolean
  canCopyMessages: boolean
  canSaveMedia: boolean
  canMultiSelect: boolean

  // 文件处理
  shouldCacheImages: boolean
  shouldCacheVideos: boolean

  // UI特性
  hasContextMenu: boolean
  hasLongPressMenu: boolean
  hasDragDrop: boolean

  // 窗口管理
  hasMultipleWindows: boolean
  hasTrayIcon: boolean

  // Matrix功能
  hasSpacesSupport: boolean
  hasAdvancedRoomManagement: boolean
  hasE2EESettings: boolean
}

/**
 * 获取平台特定配置
 */
export const getPlatformConfig = (): PlatformConfig => {
  const mobile = isMobile()

  return {
    // 消息功能 - 移动端应该支持这些功能
    canForwardMessages: true, // 移动端应该支持转发
    canCopyMessages: true, // 移动端应该支持复制
    canSaveMedia: true, // 移动端应该支持保存
    canMultiSelect: !mobile, // 桌面端支持多选

    // 文件处理
    shouldCacheImages: mobile, // 移动端需要缓存图片
    shouldCacheVideos: mobile, // 移动端需要缓存视频

    // UI特性
    hasContextMenu: !mobile, // 桌面端有右键菜单
    hasLongPressMenu: mobile, // 移动端有长按菜单
    hasDragDrop: !mobile, // 桌面端支持拖拽

    // 窗口管理
    hasMultipleWindows: !mobile, // 桌面端支持多窗口
    hasTrayIcon: !mobile, // 桌面端有托盘图标

    // Matrix功能
    hasSpacesSupport: !mobile, // 桌面端支持Spaces
    hasAdvancedRoomManagement: !mobile, // 桌面端有高级房间管理
    hasE2EESettings: !mobile // 桌面端有E2EE设置
  }
}

/**
 * 消息操作适配器
 */
export const messageActionAdapter = {
  /**
   * 转发消息
   * @param message 要转发的消息
   */
  async forward(message: MessageType): Promise<void> {
    const config = getPlatformConfig()
    if (!config.canForwardMessages) {
      throw new Error('Forward not supported on this platform')
    }

    if (isMobile()) {
      // 移动端实现 - 通过路由跳转或底部面板
      const { useMitt } = await import('@/hooks/useMitt')
      const { MittEnum } = await import('@/enums')
      useMitt.emit(MittEnum.FORWARD_MESSAGE, message)
    } else {
      // 桌面端实现 - 使用mitt事件触发转发
      const { useMitt } = await import('@/hooks/useMitt')
      const { MittEnum } = await import('@/enums')
      useMitt.emit(MittEnum.FORWARD_MESSAGE, message)
    }
  },

  /**
   * 复制消息内容
   * @param message 要复制的消息
   */
  async copy(message: MessageType): Promise<void> {
    const config = getPlatformConfig()
    if (!config.canCopyMessages) {
      throw new Error('Copy not supported on this platform')
    }

    // 统一复制实现
    const text = extractMessageText(message)
    await navigator.clipboard.writeText(text)
  },

  /**
   * 保存媒体文件
   * @param message 包含媒体的消息
   */
  async saveMedia(message: MessageType): Promise<void> {
    const config = getPlatformConfig()
    if (!config.canSaveMedia) {
      throw new Error('Save media not supported on this platform')
    }

    if (isMobile()) {
      // 移动端实现 - 使用Tauri的文件保存API
      const { invoke } = await import('@tauri-apps/api/core')
      const body = message.message.body
      const url = body && typeof body === 'object' && 'url' in body ? body.url : ''
      await invoke('save_media_to_gallery', { url })
    } else {
      // 桌面端实现 - 使用浏览器下载API或Tauri对话框
      const body = message.message.body
      const url = body && typeof body === 'object' && 'url' in body ? body.url : ''
      if (url) {
        // 创建临时链接触发下载
        const a = document.createElement('a')
        a.href = url
        a.download = ''
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    }
  }
}

/**
 * 文件缓存适配器
 */
export const fileCacheAdapter = {
  /**
   * 判断是否需要缓存文件
   * @param messageType 消息类型
   */
  shouldCache(messageType: string): boolean {
    const config = getPlatformConfig()

    const isImage = messageType === 'image' || messageType === 'm.image'
    const isVideo = messageType === 'video' || messageType === 'm.video'

    if (isImage) return config.shouldCacheImages
    if (isVideo) return config.shouldCacheVideos
    return false
  },

  /**
   * 处理消息中的文件
   * 统一PC端和移动端的文件处理逻辑
   */
  async processMessageFile(data: {
    message?: {
      roomId?: string
      id?: string
      type?: string
      url?: string
      body?: {
        filename?: string
        body?: string
        url?: string
        info?: { mimetype?: string }
      }
    }
    msg_type?: string
    roomId?: string
    id?: string
    url?: string
  }): Promise<void> {
    const messageType = data.message?.type || data.msg_type || ''
    if (this.shouldCache(messageType)) {
      const { useFileStore } = await import('@/stores/file')
      const fileStore = useFileStore()

      // 添加到文件store（移动端和PC端都需要）
      // 注意：这里需要将data转换为FileInfo格式
      if (data && (data.message?.roomId || data.roomId)) {
        const roomId = data.message?.roomId || data.roomId || ''
        const fileInfo = {
          id: data.message?.id || data.id || '',
          roomId,
          fileName: data.message?.body?.filename || data.message?.body?.body || 'unknown',
          type: this.getFileType(messageType),
          url: data.message?.body?.url || data.message?.url || data.url || '',
          suffix: data.message?.body?.info?.mimetype?.split('/').pop()
        }
        fileStore.addFile(fileInfo)
      }
    }
  },

  /**
   * 根据消息类型获取文件类型
   */
  getFileType(messageType: string): 'file' | 'voice' | 'video' | 'image' {
    if (messageType === 'image' || messageType === 'm.image') return 'image'
    if (messageType === 'video' || messageType === 'm.video') return 'video'
    if (messageType === 'voice' || messageType === 'm.audio') return 'voice'
    return 'file'
  }
}

/**
 * 通知适配器
 * 使用统一的通知服务，保持向后兼容
 */
export const notificationAdapter = {
  /**
   * 显示通知
   * @param title 通知标题
   * @param body 通知内容
   * @param options 额外选项
   */
  async show(
    title: string,
    body: string,
    options?: {
      silent?: boolean
      icon?: string
      onClick?: () => void
    }
  ): Promise<void> {
    // 使用统一通知服务
    const { notificationService } = await import('@/services/notificationService')
    await notificationService.send({ title, body, options })
  },

  /**
   * 发送系统通知
   */
  async system(level: 'info' | 'success' | 'warning' | 'error', title: string, body?: string): Promise<void> {
    const { notificationService } = await import('@/services/notificationService')
    await notificationService.showSystem(level, title, body)
  },

  /**
   * 发送好友通知
   */
  async friend(level: 'info' | 'success' | 'warning' | 'error', title: string, body?: string): Promise<void> {
    const { notificationService } = await import('@/services/notificationService')
    await notificationService.showFriend(level, title, body)
  },

  /**
   * 发送群组通知
   */
  async group(title: string, body?: string): Promise<void> {
    const { notificationService } = await import('@/services/notificationService')
    await notificationService.showGroup(title, body)
  },

  /**
   * 根据策略判断是否通知
   */
  async shouldNotify(policyInput: {
    session?: { roomId?: string; muteNotification?: number; shield?: boolean } | import('@/services/types').SessionItem
    isForeground: boolean
    isActiveChat: boolean
  }) {
    const { notificationService } = await import('@/services/notificationService')
    return notificationService.shouldNotify(policyInput as import('@/utils/notificationPolicy').PolicyInput)
  },

  /**
   * 获取未读通知数量
   */
  getUnreadCount(): number {
    const { useNotificationStore } = require('@/stores/notifications')
    const notificationStore = useNotificationStore()
    return notificationStore.getUnreadCount()
  },

  /**
   * 清除所有通知
   */
  clearAll(): void {
    const { useNotificationStore } = require('@/stores/notifications')
    const notificationStore = useNotificationStore()
    notificationStore.clearNotifications()
  }
}

/**
 * 窗口适配器
 */
export const windowAdapter = {
  /**
   * 关闭当前窗口/返回上一页
   */
  async close(): Promise<void> {
    if (isMobile()) {
      // 移动端返回
      const { useRouter } = await import('vue-router')
      const router = useRouter()
      if (window.history.length > 1) {
        router.back()
      }
    } else {
      // 桌面端关闭窗口
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      const window = getCurrentWebviewWindow()
      await window.close()
    }
  },

  /**
   * 创建新窗口/导航到新页面
   */
  async open(url: string, options?: Record<string, unknown>): Promise<void> {
    if (isMobile()) {
      // 移动端路由跳转
      const { useRouter } = await import('vue-router')
      const router = useRouter()
      router.push(url)
    } else {
      // 桌面端创建新窗口
      const { useWindow } = await import('@/hooks/useWindow')
      const { createWebviewWindow } = useWindow()
      createWebviewWindow(
        String(options?.title || 'Window'),
        String(options?.label || 'window'),
        (options?.width as number) || 800,
        (options?.height as number) || 600,
        undefined, // wantCloseWindow
        (options?.resizable as boolean) || false,
        (options?.minW as number) || 330,
        (options?.minH as number) || 495,
        options?.transparent as boolean | undefined,
        options?.visible !== false,
        options?.queryParams as Record<string, string | number | boolean> | undefined
      )
    }
  }
}

/**
 * 工具函数：提取消息文本
 */
function extractMessageText(message: MessageType): string {
  const body = message.message.body
  if (typeof body === 'string') return body
  if (body && typeof body === 'object') {
    if ('url' in body) return body.url as string
    if ('text' in body) return body.text as string
    if ('body' in body) return body.body as string
    if ('info' in body && typeof body.info === 'object') {
      const info = body.info as Record<string, unknown>
      if (info.body) return String(info.body)
    }
  }
  return String(body || '')
}

/**
 * 导出便捷函数
 */
export const platform = {
  config: getPlatformConfig,
  isMobile,
  message: messageActionAdapter,
  fileCache: fileCacheAdapter,
  notification: notificationAdapter,
  window: windowAdapter
}

export default platform
