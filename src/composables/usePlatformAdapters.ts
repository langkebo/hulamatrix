import { ref, computed } from 'vue'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { isDesktop, isMobile } from '@/utils/PlatformConstants'
import { logger } from '@/utils/logger'

export const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
import { useWindow } from '@/hooks/useWindow'
import { useRouter } from 'vue-router'
import { useTauriListener } from '@/hooks/useTauriListener'

// Type definitions for platform adapters
interface WindowManager {
  createWebviewWindow?: (...args: unknown[]) => unknown
  createRtcCallWindow?: (...args: unknown[]) => unknown
  sendWindowPayload?: (...args: unknown[]) => unknown
  [key: string]: unknown
}

interface WebviewWindowLike {
  label: string
  [key: string]: unknown
}

interface DesktopFeatures {
  createWebviewWindow: (...args: unknown[]) => unknown
  createRtcCallWindow: (...args: unknown[]) => unknown
  sendWindowPayload: (...args: unknown[]) => unknown
}

interface MobileFeatures {
  handleBackButton: () => void
  handleOrientationChange: () => void
  handleNetworkChange: () => void
}

// 🔥 平台适配器 - 统一处理不同平台的逻辑
export const usePlatformAdapters = () => {
  const router = useRouter()
  const { addListener } = useTauriListener()

  // 平台检测
  const platform = computed(() => ({
    isDesktop: isDesktop(),
    isMobile: isMobile(),
    isTauri: Boolean(isTauri),
    isWeb: !isTauri
  }))

  // 窗口管理
  const appWindow = computed((): WebviewWindowLike => {
    if (platform.value.isTauri) {
      return WebviewWindow.getCurrent() as unknown as WebviewWindowLike
    }
    return { label: 'web' }
  })

  // 🔥 桌面端特定功能
  const desktopFeatures = ref<DesktopFeatures>({
    createWebviewWindow: () => {},
    createRtcCallWindow: () => {},
    sendWindowPayload: () => {}
  })

  // 🔥 移动端特定功能
  const mobileFeatures = ref<MobileFeatures>({
    handleBackButton: () => {},
    handleOrientationChange: () => {},
    handleNetworkChange: () => {}
  })

  // 初始化平台特定功能
  const initialize = async () => {
    if (platform.value.isDesktop) {
      await initializeDesktopFeatures()
    } else if (platform.value.isMobile) {
      await initializeMobileFeatures()
    }

    logger.debug(`✅ Platform initialized: ${platform.value.isDesktop ? 'Desktop' : 'Mobile'}`)
  }

  // 初始化桌面端功能
  const initializeDesktopFeatures = async () => {
    const windowManager = useWindow() as WindowManager
    desktopFeatures.value = {
      createWebviewWindow: windowManager.createWebviewWindow || (() => {}),
      createRtcCallWindow: windowManager.createRtcCallWindow || (() => {}),
      sendWindowPayload: windowManager.sendWindowPayload || (() => {})
    }

    // 桌面端特定事件监听
    try {
      if (typeof addListener === 'function') {
        // 监听窗口焦点变化 - 暂时注释掉未使用的监听器
        // Tauri的addListener通常返回一个取消监听的函数
        // 注意：实际的事件名称可能需要根据Tauri的文档调整
        // const unlistenFocus = await addListener('tauri://focus', focusListener)
        // const unlistenBlur = await addListener('tauri://blur', blurListener)
        // 清理函数会在组件卸载时调用
        // if (unlistenFocus) unlistenFocus()
        // if (unlistenBlur) unlistenBlur()
      }
    } catch (error) {
      logger.warn('Failed to add Tauri listeners:', error)
    }
  }

  // 初始化移动端功能
  const initializeMobileFeatures = async () => {
    // 移动端返回键处理
    mobileFeatures.value.handleBackButton = () => {
      if (window.history.length > 1) {
        router.back()
      } else {
        // 退出应用或回到主页
        router.replace('/mobile/message')
      }
    }

    // 屏幕方向变化处理
    mobileFeatures.value.handleOrientationChange = () => {
      const orientation =
        window.orientation || (window.screen && window.screen.orientation && window.screen.orientation.angle)
      logger.debug('Orientation changed:', orientation)
    }

    // 网络状态变化处理
    mobileFeatures.value.handleNetworkChange = () => {
      const isOnline = navigator.onLine
      logger.debug('Network status changed:', { isOnline })
    }

    // 注册移动端事件监听
    window.addEventListener('popstate', mobileFeatures.value.handleBackButton)
    window.addEventListener('orientationchange', mobileFeatures.value.handleOrientationChange)
    window.addEventListener('online', mobileFeatures.value.handleNetworkChange)
    window.addEventListener('offline', mobileFeatures.value.handleNetworkChange)
  }

  // 🔥 平台特定UI适配
  const uiAdapters = {
    // 消息输入框适配
    messageInput: computed(() => ({
      placeholder: platform.value.isMobile ? '输入消息...' : '输入消息，按Enter发送',
      multiline: platform.value.isDesktop,
      maxHeight: platform.value.isMobile ? '100px' : '200px'
    })),

    // 文件上传适配
    fileUpload: computed(() => ({
      multiple: platform.value.isDesktop,
      maxSize: platform.value.isMobile ? 10 * 1024 * 1024 : 50 * 1024 * 1024, // 10MB vs 50MB
      acceptTypes: platform.value.isMobile ? 'image/*,video/*,.pdf,.doc,.docx' : '*' // 桌面端支持所有类型
    })),

    // 视频播放适配
    videoPlayer: computed(() => ({
      controls: platform.value.isDesktop,
      autoplay: !platform.value.isMobile,
      pictureInPicture: platform.value.isDesktop && 'pictureInPictureEnabled' in document
    }))
  }

  // 🔥 性能优化适配
  const performanceAdapters = {
    // 懒加载策略
    lazyLoading: computed(() => ({
      enabled: true,
      threshold: platform.value.isMobile ? 0.1 : 0.25,
      rootMargin: platform.value.isMobile ? '50px' : '100px'
    })),

    // 虚拟滚动
    virtualScrolling: computed(() => ({
      enabled: true,
      itemHeight: platform.value.isMobile ? 60 : 80,
      bufferSize: platform.value.isMobile ? 10 : 20
    })),

    // 图片优化
    imageOptimization: computed(() => ({
      lazy: true,
      webp: platform.value.isDesktop,
      quality: platform.value.isMobile ? 0.8 : 0.9,
      placeholder: 'blur'
    }))
  }

  // 🔥 存储适配
  const storageAdapters = {
    // 存储容量限制
    getStorageLimit: () => {
      if (platform.value.isMobile) {
        return {
          localStorage: 5 * 1024 * 1024, // 5MB
          sessionStorage: 5 * 1024 * 1024 // 5MB
        }
      }
      return {
        localStorage: 10 * 1024 * 1024, // 10MB
        sessionStorage: 10 * 1024 * 1024 // 10MB
      }
    },

    // 存储可用性检查
    isStorageAvailable: (type: 'localStorage' | 'sessionStorage') => {
      try {
        const storage = window[type]
        const testKey = '__storage_test__'
        storage.setItem(testKey, 'test')
        storage.removeItem(testKey)
        return true
      } catch {
        return false
      }
    }
  }

  return {
    // 平台信息
    platform,

    // 窗口管理
    appWindow,

    // 平台特定功能
    desktopFeatures,
    mobileFeatures,

    // UI适配
    uiAdapters,

    // 性能适配
    performanceAdapters,

    // 存储适配
    storageAdapters,

    // 初始化
    initialize,

    // 工具方法
    isDesktop: isDesktop,
    isMobile: isMobile,
    isTauri: isTauri
  }
}

export default usePlatformAdapters
