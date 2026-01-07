import { logger } from '@/utils/logger'
import { createApp } from 'vue'
import 'uno.css'
import '@unocss/reset/eric-meyer.css' // unocss提供的浏览器默认样式重置
// 引入 HuLa 统一主题变量（必须在最前面）
import './styles/scss/global/theme-variables.scss'
import '@/styles/index.scss' // 引入自定义样式
// 引入全局通用工具类
import './styles/scss/global/utilities.scss'
// 引入 Vant 主题覆盖（移动端）
import './mobile/styles/vant-theme.scss'
// TlbsMap已移除 - 如需地图功能可考虑替代方案
import { setupI18n } from '@/services/i18n'
import { AppException } from '@/common/exception'
import vResize from '@/directives/v-resize'
import vSlide from '@/directives/v-slide'
import router from '@/router'
import { pinia } from '@/stores'
import { initializePlatform } from '@/utils/PlatformConstants'
import { startWebVitalObserver } from '@/utils/WebVitalsObserver'
import { invoke } from '@tauri-apps/api/core'
import { isMobile } from '@/utils/PlatformConstants'
import App from '@/App.vue'
import { provideMatrixClientManager } from '@/integrations/matrix/client-manager'
import { Perf } from '@/utils/Perf'
import { flagSummary, validateEnvFlags, flags } from '@/utils/envFlags'
import { msg } from '@/utils/SafeUI'

// Type definitions for import.meta
interface ImportMetaEnv {
  DEV?: boolean
  PROD?: boolean
  MODE?: string
  VITE_PERFORMANCE_ENDPOINT?: string
  VITE_APP_VERSION?: string
  VITE_APP_NAME?: string
  VITE_APP_AUTHOR_URL?: string
  VITE_LOCKSCREEN_PASSWORD?: string
  VITE_LOCKSCREEN_ENABLE?: string
  VITE_MATRIX_DEV_SYNC?: string
  [key: string]: string | boolean | undefined
}

interface ImportMetaLike {
  env: ImportMetaEnv
  [key: string]: unknown
}

declare const importMeta: ImportMetaLike

// Type definitions for error events
interface ErrorEventLike {
  message?: string
  error?: Error
  filename?: string
  lineno?: number
  colno?: number
  [key: string]: unknown
}

interface PromiseRejectionEventLike {
  reason?: unknown
  promise?: Promise<unknown>
  [key: string]: unknown
}

// Type definitions for window augmentations
interface WindowWithCleanup extends Window {
  __globalErrorCleanup?: () => void
  [key: string]: unknown
}

initializePlatform()
startWebVitalObserver()

// 初始化错误捕获工具（在所有其他代码之前）
import { errorLogger } from '@/utils/errorLogger'
logger.info('✅ 错误捕获工具已启动 - 日志将保存到 docs/error_log.md')

// WebSocket 已废弃，使用 Matrix SDK
// import('@/services/webSocketRust')

// 在开发环境下引入调试器
if (import.meta.env.DEV) {
  import('@/utils/messageListDebugger')
}

// 初始化性能监控
import { usePerformanceMonitor } from '@/utils/extended-performance-monitor'
import { startHistoryMonitoring } from '@/utils/history-monitor'

// 获取性能监控实例
const perfMonitor = usePerformanceMonitor()

// 性能监控配置
// 生产环境: 启用完整性能监控
// 开发环境: 仅在 VITE_DEV_PERF='true' 时启用（避免影响开发性能）
const shouldEnablePerfMonitoring =
  import.meta.env.PROD || (import.meta.env.DEV && import.meta.env.VITE_DEV_PERF === 'true')

// 启动性能监控
if (shouldEnablePerfMonitoring) {
  // 启动扩展性能监控
  perfMonitor.start()

  logger.debug('🚀 Performance monitoring started', {
    env: import.meta.env.PROD ? 'production' : 'development'
  })

  // 历史监控仅在明确启用时启动（较重的操作）
  if (import.meta.env.PROD || import.meta.env.VITE_DEV_PERF === 'true') {
    startHistoryMonitoring(30000)
  }

  // 异步上报性能数据
  reportPerformance().catch((err) => {
    logger.warn('[Performance] Failed to report metrics:', err)
  })
} else {
  logger.debug('⏭️  Performance monitoring disabled (set VITE_DEV_PERF=true to enable in development)')
}

// 性能数据上报
async function reportPerformance() {
  // 获取扩展性能指标
  const metrics = perfMonitor.getMetrics()

  // 在开发环境打印性能数据
  if (import.meta.env.DEV) {
    console.group('📊 Performance Metrics')
    logger.debug('Metrics:', metrics)
    console.groupEnd()
  }

  // 在生产环境上报到分析服务
  if (import.meta.env.PROD) {
    // 实现分析服务上报
    // 支持的分析服务可以通过环境变量配置：
    // - VITE_GA_ID: Google Analytics ID
    // - VITE_ANALYTICS_ENDPOINT: 自定义分析端点
    try {
      // Google Analytics 上报（如果配置了 GA ID）
      if (import.meta.env.VITE_GA_ID) {
        // 上报 Web Vitals 到 Google Analytics
        const gaId = import.meta.env.VITE_GA_ID
        // 使用类型断言访问 window.gtag
        const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag
        if (gtag) {
          gtag('event', 'web_vitals', {
            event_category: 'Performance',
            event_label: metrics.lcp,
            value: Math.round(metrics.lcp),
            non_interaction: true
          })
          logger.debug('[Analytics] Reported to Google Analytics', { gaId })
        }
      }

      // 自定义分析端点上报（如果配置了）
      if (import.meta.env.VITE_ANALYTICS_ENDPOINT) {
        const analyticsReport = {
          timestamp: Date.now(),
          url: window.location.href,
          userAgent: navigator.userAgent,
          version: import.meta.env.VITE_APP_VERSION || '3.0.5',
          metrics: {
            fcp: metrics.fcp,
            lcp: metrics.lcp,
            ttfb: metrics.ttfb,
            cls: metrics.cls
          }
        }

        await fetch(import.meta.env.VITE_ANALYTICS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(analyticsReport),
          keepalive: true // 使用 keepalive 确保在页面卸载时也能发送
        }).catch((error) => {
          logger.warn('[Analytics] Failed to report to analytics endpoint:', error)
        })
      }
    } catch (error) {
      logger.warn('[Analytics] Failed to report analytics:', error)
    }
  }

  // 在生产环境上报到服务端
  if (import.meta.env.PROD && import.meta.env.VITE_PERFORMANCE_ENDPOINT) {
    const report = {
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      version: import.meta.env.VITE_APP_VERSION || '3.0.5',
      metrics
    }

    await fetch(import.meta.env.VITE_PERFORMANCE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(report)
    })
  }
}

try {
  const v = validateEnvFlags()

  // 输出配置验证结果
  if (v.errors.length > 0) {
    logger.error('[EnvFlags] 关键配置错误:')
    for (const error of v.errors) {
      logger.error(`  ❌ ${error.key}: ${error.message}`)
      logger.error(`     💡 建议: ${error.suggestion}`)
    }
  }

  if (v.warnings.length > 0) {
    logger.warn('[EnvFlags] 配置警告:')
    for (const warning of v.warnings) {
      logger.warn(`  ⚠️  ${warning.key}=${warning.value}: ${warning.message}`)
      logger.warn(`     💡 建议: ${warning.suggestion}`)
    }
  }

  if (v.info.length > 0) {
    logger.info('[EnvFlags] 功能状态信息:')
    for (const info of v.info) {
      logger.info(`  ℹ️  ${info.message}`)
      logger.info(`     💡 ${info.suggestion}`)
    }
  }

  logger.info('[EnvFlags] 启动特性开关', flagSummary())

  // 如果有关键错误，阻止应用启动（仅在开发环境）
  if (!v.isValid && import.meta.env.DEV) {
    logger.error('[EnvFlags] 关键配置错误，应用无法启动')
    logger.error('[EnvFlags] 请修复上述错误后重新启动应用')
    // 注意: 生产环境不阻止启动，允许降级运行
  }
} catch (e) {
  logger.error('[EnvFlags] 校验失败', e)
}

// 全局错误处理 - 只在开发模式下添加，生产环境可能有自己的错误处理
if ((import.meta as unknown as ImportMetaLike)?.env?.DEV) {
  try {
    const errorHandler = (ev: Event | ErrorEventLike) => {
      const errorEvent = ev as Partial<ErrorEventLike>
      const msg = String(errorEvent?.message || errorEvent?.error || '')
      const file = String(errorEvent?.filename || '')
      const isDevNoise = file.includes('@vite/client') || msg.includes('WebSocket closed without opened')
      if (isDevNoise) return
      const errorOrMessage = errorEvent?.error || errorEvent?.message || String(ev)
      logger.error('[EnvFlags] 异常', flagSummary(), typeof errorOrMessage === 'string' ? errorOrMessage : undefined)
    }

    const rejectionHandler = (ev: Event | PromiseRejectionEventLike) => {
      const rejectionEvent = ev as Partial<PromiseRejectionEventLike>
      const reasonText = String(rejectionEvent?.reason || '')
      const isDevNoise =
        reasonText.includes('@vite') ||
        reasonText.includes('WebSocket closed without opened') ||
        reasonText.includes('transformCallback')
      if (isDevNoise) return
      const reason = rejectionEvent?.reason
      logger.error('[EnvFlags] 未处理拒绝', flagSummary(), typeof reason === 'string' ? reason : String(reason))
    }

    window.addEventListener('error', errorHandler)
    window.addEventListener('unhandledrejection', rejectionHandler)

    // 导出清理函数供测试使用
    if (typeof window !== 'undefined') {
      ;(window as unknown as WindowWithCleanup).__globalErrorCleanup = () => {
        window.removeEventListener('error', errorHandler)
        window.removeEventListener('unhandledrejection', rejectionHandler)
      }
    }
  } catch (error) {
    logger.debug('[Main] Failed to setup global error handlers (non-critical):', error)
  }
}

if ((import.meta as unknown as ImportMetaLike)?.env?.DEV) {
  /**! 控制台打印项目版本信息(不需要可手动关闭)*/
  import('@/utils/logger').then(({ logger }) => {
    const meta = import.meta as unknown as ImportMetaLike
    const appName = meta?.env?.VITE_APP_NAME || 'HuLa'
    const appVersion = meta?.env?.VITE_APP_VERSION || ''
    const appAuthorUrl = meta?.env?.VITE_APP_AUTHOR_URL || ''
    logger.debug(
      `%c 🍀 ${appName} ${appVersion}`,
      'font-size:20px;border-left: 4px solid #13987f;background: #cef9ec;font-family: Comic Sans MS, cursive;color:#581845;padding:10px;border-radius:4px;',
      `${appAuthorUrl}`
    )
  })
  const __origConsoleError = console.error
  console.error = (...args: unknown[]) => {
    try {
      const text = args.map((a) => (typeof a === 'string' ? a : '')).join(' ')
      const isDevNoise =
        text.includes('@vite/client') ||
        text.includes('WebSocket closed without opened') ||
        text.includes('Failed to get TURN URIs') ||
        text.includes("Can't fetch server versions") ||
        text.includes('ConnectionError: fetch failed') ||
        text.includes('/_matrix/client') ||
        text.includes('/_synapse/client') ||
        text.includes('sync /sync error') ||
        text.includes('net::ERR_ABORTED') ||
        text.includes('[Performance] Long task detected:') ||
        text.includes('[Performance] Slow resource:') ||
        text.includes('[PerformanceMonitor] Long task detected:') ||
        // Filter Matrix SDK event builder errors (handled by startClient error recovery)
        text.includes('builder error') ||
        text.includes('Event builder') ||
        text.includes('Invalid event') ||
        text.includes('MatrixEvent builder') ||
        // Filter Vue 3.5+ strict mode warnings from third-party libraries (Naive UI compatibility)
        text.includes('No default value') ||
        text.includes('[seemly/rgba]: Invalid color value') ||
        // Filter Vue internal property access warnings (Vue 3 internal behavior)
        text.includes('Property "$type" was accessed') ||
        text.includes('Property "toJSON" was accessed') ||
        text.includes('enumerating keys on a component instance') ||
        // Filter Vue 3.5+ component lifecycle errors (internal Vue errors during unmount/update)
        text.includes('Right side of assignment cannot be destructured') ||
        (text.includes('null is not an object') && text.includes('parentNode')) ||
        (text.includes('TypeError') && args.some((a) => a instanceof Error && a.message === 'No default value'))
      if (isDevNoise) return
    } catch (_error) {
      // Silently ignore console.error filtering errors
    }
    __origConsoleError.apply(console, args as unknown[])
  }
  const __origConsoleWarn = console.warn
  console.warn = (...args: unknown[]) => {
    try {
      const text = args.map((a) => (typeof a === 'string' ? a : '')).join(' ')
      const isDevNoise =
        text.includes('[Compatibility] Using legacy store') ||
        text.includes('[EnhancedFriends] Client not initialized') ||
        text.includes('[HistoryStats]') ||
        // Filter expected Matrix SDK performance warnings
        text.includes('检测到长时间运行任务') ||
        text.includes('📊 Matrix SDK Performance Report') ||
        text.includes('[PerformanceMonitor] Long task detected:') ||
        text.includes('[Performance] Long task detected:') ||
        text.includes('[Performance] Slow resource:') ||
        // Filter Vue internal property access warnings (Vue 3 internal behavior)
        text.includes('Property "$type" was accessed') ||
        text.includes('Property "toJSON" was accessed') ||
        text.includes('enumerating keys on a component instance')
      if (isDevNoise) return
    } catch (_error) {
      // Silently ignore console.warn filtering errors
    }
    __origConsoleWarn.apply(console, args as unknown[])
  }
  import('@/integrations/matrix/spaces-test-harness').then((m) => {
    try {
      m.setupSpacesTestHarness()
    } catch (error) {
      logger.debug('[Main] Spaces test harness setup failed (non-critical):', error)
    }
  })
}

export const forceUpdateMessageTop = (topValue: number) => {
  // 获取所有符合条件的元素
  const messages = document.querySelectorAll('.n-message-container.n-message-container--top')

  messages.forEach((el) => {
    const dom = el as HTMLElement
    dom.style.top = `${topValue}px`
  })
}

if (isMobile()) {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', setup)
  } else {
    setup()
  }
}

async function setup() {
  try {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
    if (isTauri) {
      await invoke('set_complete', { task: 'frontend' })
    }
  } catch (error) {
    logger.debug('[Main] Failed to set frontend complete flag (non-critical):', error)
  }
}

Perf.mark('app-start')
const app = createApp(App)

provideMatrixClientManager(app)
app.use(router).use(pinia).use(setupI18n).directive('resize', vResize).directive('slide', vSlide).mount('#app')
Perf.measure('app-mounted', 'app-start')

// 预加载关键资源（头像、表情、文件图标）
import { AssetPreloader } from '@/utils/assetLoader'
AssetPreloader.preload()
  .then(() => {
    logger.info('[Assets] Critical assets preloaded successfully')
  })
  .catch((error) => {
    logger.warn('[Assets] Failed to preload some assets:', error)
  })

// 应用环境变量中的锁屏设置（必须在 Pinia 安装之后）
try {
  const { useSettingStore } = await import('@/stores/setting')
  const setting = useSettingStore()
  const env = ((import.meta as unknown as ImportMetaLike)?.env || {}) as ImportMetaEnv
  if (env?.VITE_LOCKSCREEN_PASSWORD) {
    setting.lockScreen.password = String(env.VITE_LOCKSCREEN_PASSWORD)
  }
  if (env?.VITE_LOCKSCREEN_ENABLE === 'true') {
    setting.lockScreen.enable = true
  }
} catch (error) {
  logger.warn('[Main] Failed to apply lock screen settings from environment:', error)
}

// Global Vue error handler - improved with better logging and user feedback
app.config.errorHandler = (err, instance, info) => {
  // Enhanced error logging to capture more details
  const errorDetails = {
    errorMessage: err instanceof Error ? err.message : String(err),
    errorStack: err instanceof Error ? err.stack : undefined,
    errorName: err instanceof Error ? err.name : undefined,
    componentName: instance?.$options?.name || (instance as any)?.$?.type?.name || 'Unknown',
    componentTag: (instance as any)?.$type?.__name || (instance as any)?.$?.vnode?.type?.name || 'Unknown',
    info,
    fullError: err
  }

  // Log detailed error information
  logger.error('[VueErrorHandler] Error caught:', errorDetails)

  // 使用错误捕获工具记录
  errorLogger.logError(`[Vue] ${errorDetails.componentName}: ${errorDetails.errorMessage} - ${info}`, err)

  // Log the raw error object for debugging
  console.error('[VueErrorHandler] Raw error:', err)
  console.error('[VueErrorHandler] Component instance:', instance)

  // Handle AppException with user-friendly message
  if (err instanceof AppException) {
    msg.error(err.message)
    return
  }

  // Handle other errors with generic message
  // Don't show error toasts for development noise
  const isDevNoise =
    String(err).includes('@vite') ||
    String(err).includes('WebSocket closed without opened') ||
    String(err).includes('transformCallback') ||
    // Filter Vue 3.5+ strict mode warnings from third-party libraries (Naive UI compatibility)
    (err instanceof Error && err.message === 'No default value') ||
    String(err).includes('No default value') ||
    // Filter seemly color library warnings (Naive UI dependency)
    (err instanceof Error && err.message.includes('[seemly/rgba]: Invalid color value')) ||
    String(err).includes('[seemly/rgba]: Invalid color value') ||
    // Filter Vue 3.5+ component lifecycle errors (internal Vue errors during unmount/update)
    (err instanceof Error && err.message.includes('Right side of assignment cannot be destructured')) ||
    String(err).includes('Right side of assignment cannot be destructured') ||
    (err instanceof Error && err.message.includes('null is not an object') && err.message.includes('parentNode')) ||
    (String(err).includes('null is not an object') && String(err).includes('parentNode'))

  if (!isDevNoise) {
    // Provide user-friendly error message
    const errorMessage = err instanceof Error ? err.message : '操作失败,请重试'
    // Only show non-sensitive errors
    if (!errorMessage.includes('token') && !errorMessage.includes('authorization')) {
      msg.error(errorMessage)
    }
  }
}

if (flags.matrixEnabled) {
  try {
    const { useMatrixAuthStore } = await import('@/stores/matrixAuth')
    const auth = useMatrixAuthStore()
    const baseUrl = auth.getHomeserverBaseUrl()
    const token = auth.accessToken
    const uid = auth.userId
    if (baseUrl && token && uid) {
      await (await import('@/integrations/matrix/client')).matrixClientService.initialize({
        baseUrl,
        accessToken: token,
        userId: uid
      })
      ;(await import('@/integrations/matrix/client')).initializeMatrixBridges()
      await (await import('@/integrations/matrix/client')).matrixClientService.startClient({
        initialSyncLimit: 5,
        pollTimeout: 15000
      })
    }
  } catch (error) {
    logger.error('[Main] Matrix client initialization failed:', error)
    msg.warning('Matrix 服务初始化失败,部分功能可能不可用')
  }
}

if (flags.matrixEnabled && import.meta.env.VITE_MATRIX_DEV_SYNC === 'true') {
  import('@/hooks/useMatrixDevSync').then((m) => m.useMatrixDevSync())
}
// Register service worker (web-only, not in Tauri)
;(async () => {
  if (typeof window !== 'undefined' && !('__TAURI__' in window) && 'serviceWorker' in navigator) {
    try {
      const { registerServiceWorker: registerSW, getServiceWorker } = await import('@/utils/serviceWorker')
      const registration = await registerSW()

      if (registration) {
        logger.info('[Main] Service worker registered successfully')

        // Set up update handler
        const sw = getServiceWorker()

        sw.onUpdate((reg) => {
          logger.info('[Main] New service worker available')
          // Could show update notification to user
          // For now, just activate the new version
          reg.waiting?.postMessage({ action: 'skip-waiting' })
        })
      }
    } catch (error) {
      logger.warn('[Main] Service worker registration failed:', error)
    }
  }
})()
