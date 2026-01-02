/**
 * Extended Performance Monitor with additional metrics
 */

import { logger } from '@/utils/logger'
import { flags } from '@/utils/envFlags'
import { errorLogManager } from '@/utils/error-handler'
import { isDevNoise } from '@/utils/error-handler'

export interface PerformanceMetrics {
  fcp: number
  lcp: number
  fid: number
  ttfb: number
  cls: number
  domContentLoaded: number
  loadComplete: number
  firstPaint: number
  firstContentfulPaint: number
  resourceCount: number
  totalResourceSize: number
  slowResources: number
  memoryUsage: number
  memoryLimit: number
  memoryPressure: string
  frameRate: number
  droppedFrames: number
  connectionType: string
  effectiveBandwidth: number
  rtt: number
  errorCount: number
  warningCount: number
  apiResponseTime: number
  messageRenderTime: number
  syncDuration: number
  timestamp: number
  [key: string]: number | string
}

/** Google Analytics gtag 函数类型 */
declare type Gtag = (event: string, action: string, options?: Record<string, unknown>) => void

declare const gtag: Gtag | undefined

interface PerformanceMemory {
  jsHeapSizeLimit: number
  totalJSHeapSize: number
  usedJSHeapSize: number
}

interface PerformanceWithMemory extends Performance {
  memory: PerformanceMemory
}

interface LayoutShift extends PerformanceEntry {
  value: number
  hadRecentInput: boolean
}

interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: number
}

/** ImportMeta 环境变量类型 */
interface ImportMetaEnv {
  DEV?: boolean
  VITE_MATRIX_ACCESS_TOKEN?: string
  VITE_MATRIX_USER_ID?: string
  [key: string]: string | boolean | undefined
}

// 使用 Omit 避免与 ImportMeta 的 env 属性冲突
interface ImportMetaWithEnv extends Omit<ImportMeta, 'env'> {
  env: ImportMetaEnv
}

/** 网络连接信息类型 */
interface NetworkConnection {
  effectiveType?: string
  downlink?: number
  rtt?: number
  addEventListener?: (event: string, listener: () => void) => void
}

interface MonitorConfig {
  reportInterval: number
  maxMetricsHistory: number
  enableNetworkMonitoring: boolean
  enableMemoryMonitoring: boolean
  enableFrameRateMonitoring: boolean
  enableErrorTracking: boolean
}

class ExtendedPerformanceMonitor {
  private metrics: Map<string, number | string> = new Map()
  private observers: PerformanceObserver[] = []
  private isMonitoring = false
  private lastFrameTime: number | null = null
  private frameCount = 0
  private config: MonitorConfig = {
    reportInterval: 60000, // 1 minute
    maxMetricsHistory: 100,
    enableNetworkMonitoring: true,
    enableMemoryMonitoring: true,
    enableFrameRateMonitoring: true,
    enableErrorTracking: true
  }

  constructor(config?: Partial<MonitorConfig>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }
  }

  /**
   * Start extended performance monitoring
   */
  start() {
    if (this.isMonitoring || typeof window === 'undefined') return

    this.isMonitoring = true

    // Initialize core metrics
    this.initializeCoreMetrics()

    // Setup performance observers
    this.setupObservers()

    // Setup custom metrics collection
    this.setupCustomMetrics()

    // Start periodic reporting
    this.startPeriodicReporting()

    // Monitor memory usage
    if (this.config.enableMemoryMonitoring && 'memory' in performance) {
      this.monitorMemory()
    }

    // Monitor frame rate
    if (this.config.enableFrameRateMonitoring) {
      this.monitorFrameRate()
    }

    // Monitor network information
    if (this.config.enableNetworkMonitoring && 'connection' in navigator) {
      this.monitorNetwork()
    }

    // Track errors
    if (this.config.enableErrorTracking) {
      this.trackErrors()
    }
  }

  /**
   * Stop performance monitoring
   */
  stop() {
    if (!this.isMonitoring) return

    this.isMonitoring = false

    // Disconnect all observers
    this.observers.forEach((observer) => observer.disconnect())
    this.observers = []

    // Clear timers
    if (this.frameRateTimer) {
      clearInterval(this.frameRateTimer)
      this.frameRateTimer = null
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

    return {
      // Core Web Vitals
      fcp: (this.metrics.get('fcp') as number) || 0,
      lcp: (this.metrics.get('lcp') as number) || 0,
      fid: (this.metrics.get('fid') as number) || 0,
      ttfb: (this.metrics.get('ttfb') as number) || 0,
      cls: (this.metrics.get('cls') as number) || 0,

      // Navigation metrics
      domContentLoaded: nav ? nav.domContentLoadedEventEnd : 0,
      loadComplete: nav ? nav.loadEventEnd : 0,
      firstPaint: (this.metrics.get('firstPaint') as number) || 0,
      firstContentfulPaint: (this.metrics.get('firstContentfulPaint') as number) || 0,

      // Resource metrics
      resourceCount: performance.getEntriesByType('resource').length,
      totalResourceSize: this.calculateTotalResourceSize(),
      slowResources: this.getSlowResources().length,

      // Memory metrics
      memoryUsage: (this.metrics.get('memoryUsage') as number) || 0,
      memoryLimit: (this.metrics.get('memoryLimit') as number) || 0,
      memoryPressure: (this.metrics.get('memoryPressure') as string) || 'low',

      // Performance metrics
      frameRate: (this.metrics.get('frameRate') as number) || 0,
      droppedFrames: (this.metrics.get('droppedFrames') as number) || 0,

      // Network metrics
      connectionType: (this.metrics.get('connectionType') as string) || 'unknown',
      effectiveBandwidth: (this.metrics.get('effectiveBandwidth') as number) || 0,
      rtt: (this.metrics.get('rtt') as number) || 0,

      // Error metrics
      errorCount: (this.metrics.get('errorCount') as number) || 0,
      warningCount: (this.metrics.get('warningCount') as number) || 0,

      // Custom metrics
      apiResponseTime: (this.metrics.get('apiResponseTime') as number) || 0,
      messageRenderTime: (this.metrics.get('messageRenderTime') as number) || 0,
      syncDuration: (this.metrics.get('syncDuration') as number) || 0,

      timestamp: Date.now()
    }
  }

  /**
   * Track custom metric
   */
  trackMetric(name: string, value: number) {
    this.metrics.set(name, value)

    // Log significant metrics
    if (this.isSignificantMetric(name, value)) {
      logger.info(`[Performance] Significant metric: ${name}=${value}`)
    }
  }

  /**
   * Measure function execution time
   */
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    try {
      const result = await fn()
      const duration = performance.now() - start
      this.trackMetric(`${name}Duration`, duration)
      return result
    } catch (error) {
      const duration = performance.now() - start
      this.trackMetric(`${name}Error`, duration)
      throw error
    }
  }

  /**
   * Measure sync function execution time
   */
  measure<T>(name: string, fn: () => T): T {
    const start = performance.now()
    try {
      const result = fn()
      const duration = performance.now() - start
      this.trackMetric(`${name}Duration`, duration)
      return result
    } catch (error) {
      const duration = performance.now() - start
      this.trackMetric(`${name}Error`, duration)
      throw error
    }
  }

  private initializeCoreMetrics() {
    // First Paint
    this.observePerformanceEntry('paint', (entries) => {
      entries.forEach((entry) => {
        if (entry.name === 'first-paint') {
          this.metrics.set('firstPaint', entry.startTime)
        } else if (entry.name === 'first-contentful-paint') {
          this.metrics.set('firstContentfulPaint', entry.startTime)
          this.metrics.set('fcp', entry.startTime)
        }
      })
    })

    // Largest Contentful Paint
    this.observePerformanceEntry(
      'largest-contentful-paint',
      (entries) => {
        const lastEntry = entries[entries.length - 1]
        if (lastEntry) {
          this.metrics.set('lcp', lastEntry.startTime)
        }
      },
      true
    )

    // First Input Delay
    this.observePerformanceEntry('first-input', (entries) => {
      entries.forEach((entry) => {
        const e = entry as PerformanceEventTiming
        if (e.processingStart && e.startTime) {
          this.metrics.set('fid', e.processingStart - e.startTime)
        }
      })
    })

    // Cumulative Layout Shift
    this.observePerformanceEntry('layout-shift', (entries) => {
      let clsValue = 0
      entries.forEach((entry) => {
        const e = entry as LayoutShift
        if (!e.hadRecentInput) {
          clsValue += e.value
        }
      })
      this.metrics.set('cls', clsValue)
    })

    // Navigation timing
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (nav) {
      this.metrics.set('ttfb', nav.responseStart - nav.requestStart)
    }
  }

  private setupObservers() {
    // Long tasks observer
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            logger.warn('[Performance] Long task detected:', {
              duration: entry.duration,
              startTime: entry.startTime
            })
            this.trackMetric('longTaskCount', ((this.metrics.get('longTaskCount') as number) || 0) + 1)
          })
        })
        longTaskObserver.observe({ entryTypes: ['longtask'] })
        this.observers.push(longTaskObserver)
      } catch (_e) {
        logger.warn('Long task observer not supported')
      }
    }

    // Resource timing observer
    this.observePerformanceEntry('resource', (entries) => {
      entries.forEach((entry) => {
        if (entry.duration > 1000) {
          // Slow resources
          logger.warn('[Performance] Slow resource:', {
            name: entry.name,
            duration: entry.duration,
            size: (entry as PerformanceResourceTiming).transferSize
          })
        }
      })
    })
  }

  private observePerformanceEntry(
    type: string,
    callback: (entries: PerformanceEntry[], observer?: PerformanceObserver) => void,
    buffered = false
  ) {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list, obs) => {
          callback(list.getEntries(), obs)
        })
        observer.observe({ type, buffered })
        this.observers.push(observer)
      } catch (e) {
        logger.warn(`Performance observer for ${type} not supported:`, e)
      }
    }
  }

  private setupCustomMetrics() {
    // Monitor API response times
    this.interceptFetch()
  }

  private interceptFetch() {
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const start = performance.now()
      let urlStr = ''
      try {
        if (typeof args[0] === 'string') {
          urlStr = args[0] as string
        } else if (typeof Request !== 'undefined' && args[0] instanceof Request) {
          urlStr = (args[0] as Request).url
        }
      } catch {}

      try {
        const isDev = !!(import.meta as ImportMetaWithEnv)?.env?.DEV
        const matrixDisabled = !flags.matrixEnabled

        // 检查是否有有效的 Matrix 凭据
        const hasValidCredentials = this.hasValidMatrixCredentials()

        // 只在以下条件下启用 URL 重写：
        // 1. 开发环境
        // 2. Matrix 已启用
        // 3. 有有效的凭据（避免无凭据时的 ERR_ABORTED）
        if (
          !matrixDisabled &&
          isDev &&
          hasValidCredentials &&
          typeof urlStr === 'string' &&
          /https?:\/\/.+\/_matrix\//.test(urlStr)
        ) {
          const u = new URL(urlStr)
          const rel = `${u.pathname}${u.search}`
          args[0] = rel
          urlStr = rel
        } else if (
          !matrixDisabled &&
          isDev &&
          hasValidCredentials &&
          typeof urlStr === 'string' &&
          /https?:\/\/.+\/_synapse\//.test(urlStr)
        ) {
          const u = new URL(urlStr)
          const rel = `${u.pathname}${u.search}`
          args[0] = rel
          urlStr = rel
        } else if (
          !matrixDisabled &&
          isDev &&
          hasValidCredentials &&
          typeof Request !== 'undefined' &&
          args[0] instanceof Request
        ) {
          const req = args[0] as Request
          const reqUrl = req.url
          if (/https?:\/\/.+\/_matrix\//.test(reqUrl) || /https?:\/\/.+\/_synapse\//.test(reqUrl)) {
            const u = new URL(reqUrl)
            const rel = `${u.pathname}${u.search}`
            try {
              const clone = req.clone()
              const body = await clone.arrayBuffer().catch(() => undefined)
              const headersObj: Record<string, string> = {}
              clone.headers.forEach((v, k) => (headersObj[k] = v))
              const init: RequestInit = {
                method: clone.method,
                headers: headersObj,
                body: body as BodyInit | null,
                credentials: clone.credentials as RequestCredentials,
                cache: clone.cache as RequestCache
              }
              args[0] = rel
              args[1] = init
              urlStr = rel
            } catch {}
          }
        }
      } catch {}

      try {
        const response = await originalFetch(...args)
        const duration = performance.now() - start

        // Track API response times
        if (!!flags.matrixEnabled && typeof urlStr === 'string' && urlStr.includes('/_matrix/')) {
          this.trackMetric('apiResponseTime', duration)
          if (duration > 1000) {
            logger.warn('[Performance] Slow API call:', { url: urlStr, duration })
          }
        }

        return response
      } catch (error) {
        this.trackMetric('apiErrorCount', ((this.metrics.get('apiErrorCount') as number) || 0) + 1)

        // Log error with errorLogManager for better categorization
        const errorObj = error instanceof Error ? error : new Error(String(error))
        errorLogManager.log(errorObj, { url: urlStr })

        try {
          const msg = String(errorObj.message || '').toLowerCase()
          const isBackendPath =
            typeof urlStr === 'string' && (urlStr.includes('/_matrix/') || urlStr.includes('/_synapse/'))
          const isBackendAbort =
            msg.includes('timeout') || msg.includes('err_aborted') || msg.includes('connectionerror: fetch failed')
          if (isBackendPath && isBackendAbort && typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('backend-disconnected', {
                detail: { url: urlStr, message: errorObj.message }
              })
            )
          }
        } catch {}

        throw error
      }
    }
  }

  private monitorMemory() {
    const updateMemoryMetrics = () => {
      if ('memory' in performance) {
        const memory = (performance as unknown as PerformanceWithMemory).memory
        const usage = memory.usedJSHeapSize
        const limit = memory.jsHeapSizeLimit
        const pressure = usage / limit > 0.9 ? 'high' : usage / limit > 0.7 ? 'medium' : 'low'

        this.metrics.set('memoryUsage', usage)
        this.metrics.set('memoryLimit', limit)
        this.metrics.set('memoryPressure', pressure)

        if (pressure === 'high') {
          logger.warn('[Performance] High memory usage detected:', {
            used: Math.round(usage / 1024 / 1024) + ' MB',
            limit: Math.round(limit / 1024 / 1024) + ' MB'
          })
        }
      }
    }

    // Update immediately and then every 5 seconds
    updateMemoryMetrics()
    setInterval(updateMemoryMetrics, 5000)
  }

  private frameRateTimer: number | null = null

  private monitorFrameRate() {
    const calculateFrameRate = () => {
      if (!this.frameCount) this.frameCount = 0
      this.frameCount++
      const now = performance.now()

      if (this.lastFrameTime) {
        const delta = now - this.lastFrameTime
        const fps = 1000 / delta
        this.metrics.set('frameRate', Math.round(fps))

        // Track dropped frames (<30fps)
        if (fps < 30) {
          const dropped = ((this.metrics.get('droppedFrames') as number) || 0) + 1
          this.metrics.set('droppedFrames', dropped)
        }
      }

      this.lastFrameTime = now
      requestAnimationFrame(calculateFrameRate)
    }

    calculateFrameRate()
  }

  private monitorNetwork() {
    const updateNetworkMetrics = () => {
      if ('connection' in navigator) {
        const conn = (navigator as Navigator & { connection?: NetworkConnection }).connection
        if (conn) {
          this.metrics.set('connectionType', conn.effectiveType || 'unknown')
          this.metrics.set('effectiveBandwidth', conn.downlink || 0)
          this.metrics.set('rtt', conn.rtt || 0)
        }
      }
    }

    updateNetworkMetrics()

    // Update on connection change
    if ('connection' in navigator) {
      const conn = (navigator as Navigator & { connection?: NetworkConnection }).connection
      if (conn?.addEventListener) {
        conn.addEventListener('change', updateNetworkMetrics)
      }
    }
  }

  private trackErrors() {
    // Track JavaScript errors (dev noise filters)
    window.addEventListener('error', (event) => {
      const msg = String(event.message || '')
      const file = String(event.filename || '')
      const isDevNoiseFlag = isDevNoise(msg) || file.includes('@vite/client')

      if (isDevNoiseFlag) return

      this.metrics.set('errorCount', ((this.metrics.get('errorCount') as number) || 0) + 1)

      // Log to errorLogManager
      const error = event.error instanceof Error ? event.error : new Error(msg)
      errorLogManager.log(error, {
        url: file,
        stack: event.error?.stack
      })

      logger.error('[Performance] Error detected:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno
      })
    })

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const reasonText = String((event as PromiseRejectionEvent)?.reason || '')
      const isDevNoise =
        reasonText.includes('@vite') ||
        reasonText.includes('WebSocket closed without opened') ||
        reasonText.includes('transformCallback')

      if (isDevNoise) return

      this.metrics.set('errorCount', ((this.metrics.get('errorCount') as number) || 0) + 1)

      // Log to errorLogManager
      const error =
        event.reason instanceof Error
          ? event.reason
          : new Error(typeof event.reason === 'string' ? event.reason : String(event.reason))
      errorLogManager.log(error)

      logger.error('[Performance] Unhandled rejection:', (event as PromiseRejectionEvent)?.reason)
    })

    // Track logger.warnings
    const originalWarn = logger.warn
    logger.warn = (...args) => {
      this.metrics.set('warningCount', ((this.metrics.get('warningCount') as number) || 0) + 1)
      originalWarn.apply(console, args)
    }
  }

  private calculateTotalResourceSize(): number {
    return performance.getEntriesByType('resource').reduce((total, entry) => {
      const size = (entry as PerformanceResourceTiming).transferSize || 0
      return total + size
    }, 0)
  }

  private getSlowResources(): PerformanceResourceTiming[] {
    return performance
      .getEntriesByType('resource')
      .filter((entry) => entry.duration > 1000) as PerformanceResourceTiming[]
  }

  private isSignificantMetric(name: string, value: number): boolean {
    const thresholds: Record<string, number> = {
      fcp: 1800,
      lcp: 2500,
      fid: 100,
      ttfb: 800,
      cls: 0.1,
      memoryUsage: 50 * 1024 * 1024, // 50MB
      frameRate: 30,
      apiResponseTime: 1000
    }

    const threshold = thresholds[name]
    if (!threshold) return false

    return value > threshold
  }

  private startPeriodicReporting() {
    setInterval(() => {
      if (this.isMonitoring) {
        const metrics = this.getMetrics()
        this.reportMetrics(metrics)
      }
    }, this.config.reportInterval)
  }

  private reportMetrics(metrics: PerformanceMetrics) {
    // Report to analytics service
    if (typeof gtag !== 'undefined') {
      gtag('event', 'performance_metrics', {
        custom_map: {
          fcp: 'fcp',
          lcp: 'lcp',
          fid: 'fid',
          cls: 'cls'
        }
      })
    }
    // Prevent unused variable error
    void metrics
    // Log performance summary
    console.group('[Performance Report]')
    console.groupEnd()
  }

  /**
   * 检查是否有有效的 Matrix 凭据
   * 避免在无凭据时进行 URL 重写导致 ERR_ABORTED
   */
  private hasValidMatrixCredentials(): boolean {
    try {
      // 检查环境变量中的凭据
      const importMeta = import.meta as ImportMetaWithEnv
      const envToken = importMeta?.env?.VITE_MATRIX_ACCESS_TOKEN
      const envUserId = importMeta?.env?.VITE_MATRIX_USER_ID

      // 如果有环境变量凭据，认为是有效的
      if (envToken && envUserId) {
        return true
      }

      // 检查 MatrixAuth store 中是否有凭据
      // 动态导入避免循环依赖
      if (typeof window !== 'undefined') {
        const authStore = (window as Window & { __matrixAuthStore?: { accessToken?: string; userId?: string } })
          .__matrixAuthStore
        if (authStore && authStore.accessToken && authStore.userId) {
          return true
        }
      }

      return false
    } catch {
      // 如果检查失败，默认返回 false 以避免问题
      return false
    }
  }
}

// Create singleton instance
export const extendedPerformanceMonitor = new ExtendedPerformanceMonitor()

// Export for use in components
export const usePerformanceMonitor = () => {
  return {
    start: () => extendedPerformanceMonitor.start(),
    stop: () => extendedPerformanceMonitor.stop(),
    getMetrics: () => extendedPerformanceMonitor.getMetrics(),
    trackMetric: (name: string, value: number) => extendedPerformanceMonitor.trackMetric(name, value),
    measureAsync: <T>(name: string, fn: () => Promise<T>) => extendedPerformanceMonitor.measureAsync(name, fn),
    measure: <T>(name: string, fn: () => T) => extendedPerformanceMonitor.measure(name, fn)
  }
}
