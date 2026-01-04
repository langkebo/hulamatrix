import { logger } from '@/utils/logger'
/**
 * 性能监控工具 - 用于收集和监控Matrix SDK的性能指标
 * 提供性能指标收集、分析和报告功能
 */

export interface PerformanceMetric {
  name: string
  value: number
  unit: 'ms' | 'bytes' | 'count' | 'percentage'
  timestamp: number
  category: 'search' | 'reactions' | 'rtc' | 'push' | 'encryption' | 'general'
  tags?: Record<string, string>
}

export interface PerformanceReport {
  totalMetrics: number
  categories: Record<
    string,
    {
      count: number
      avgValue: number
      minValue: number
      maxValue: number
      latestValue: number
    }
  >
  trends: Record<
    string,
    {
      direction: 'up' | 'down' | 'stable'
      change: number
      percentage: number
    }
  >
  recommendations: string[]
}

export interface SearchPerformanceMetrics {
  queryTime: number
  resultCount: number
  cacheHitRate: number
  filterProcessingTime: number
  renderTime: number
}

export interface ReactionPerformanceMetrics {
  loadTime: number
  updateTime: number
  cacheHitRate: number
  syncTime: number
  renderTime: number
}

export interface RTCPerformanceMetrics {
  connectionTime: number
  iceGatheringTime: number
  audioLevel: number
  videoQuality: number
  packetLoss: number
  roundTripTime: number
}

export interface PushRulesPerformanceMetrics {
  ruleProcessingTime: number
  policyLoadTime: number
  cacheHitRate: number
  notificationDeliveryTime: number
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private timers: Map<string, number> = new Map()
  private observers: PerformanceObserver[] = []
  private maxMetrics = 10000
  private reportInterval = 60000 // 1分钟

  // 性能阈值配置 (针对 Matrix 应用优化)
  private readonly thresholds = {
    longTask: 200, // 长任务阈值 (ms) - Matrix sync/crypto 操作通常需要更长时间
    searchSlow: 2000, // 慢搜索阈值 (ms)
    rtcSlow: 10000, // 慢 RTC 连接阈值 (ms)
    resourceSlow: 5000 // 慢资源加载阈值 (ms)
  }

  constructor() {
    this.initializeObservers()
    this.startPeriodicReporting()
  }

  /**
   * 初始化性能观察器
   */
  private initializeObservers() {
    // 观察导航性能
    if ('PerformanceObserver' in window) {
      try {
        const navigationObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming
              this.recordMetric('page_load_time', navEntry.loadEventEnd - navEntry.loadEventStart, 'ms', 'general')
              this.recordMetric(
                'dom_content_loaded',
                navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
                'ms',
                'general'
              )
            }
          }
        })
        navigationObserver.observe({ entryTypes: ['navigation'] })
        this.observers.push(navigationObserver)
      } catch (error) {
        logger.warn('Navigation performance observation not supported:', error)
      }

      // 观察资源加载性能
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'resource') {
              const resourceEntry = entry as PerformanceResourceTiming
              const category = this.getResourceCategory(resourceEntry.name)
              this.recordMetric(
                'resource_load_time',
                resourceEntry.responseEnd - resourceEntry.requestStart,
                'ms',
                category,
                { resource: resourceEntry.name }
              )
            }
          }
        })
        resourceObserver.observe({ entryTypes: ['resource'] })
        this.observers.push(resourceObserver)
      } catch (error) {
        logger.warn('Resource performance observation not supported:', error)
      }

      // 观察长任务
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'longtask') {
              this.recordMetric('long_task_duration', entry.duration, 'ms', 'general')
            }
          }
        })
        longTaskObserver.observe({ entryTypes: ['longtask'] })
        this.observers.push(longTaskObserver)
      } catch (error) {
        logger.warn('Long task observation not supported:', error)
      }
    }
  }

  /**
   * 根据资源URL确定分类
   */
  private getResourceCategory(url: string): 'search' | 'reactions' | 'rtc' | 'push' | 'encryption' | 'general' {
    if (url.includes('/search')) return 'search'
    if (url.includes('/reaction')) return 'reactions'
    if (url.includes('/rtc') || url.includes('/call')) return 'rtc'
    if (url.includes('/push')) return 'push'
    if (url.includes('/encryption')) return 'encryption'
    return 'general'
  }

  /**
   * 开始计时
   */
  startTimer(name: string): void {
    this.timers.set(name, performance.now())
  }

  /**
   * 结束计时并记录指标
   */
  endTimer(
    name: string,
    category: 'search' | 'reactions' | 'rtc' | 'push' | 'encryption' | 'general',
    tags?: Record<string, string>
  ): number {
    const startTime = this.timers.get(name)
    if (!startTime) {
      logger.warn(`Timer "${name}" not found`)
      return 0
    }

    const duration = performance.now() - startTime
    this.recordMetric(name, duration, 'ms', category, tags)
    this.timers.delete(name)
    return duration
  }

  /**
   * 记录性能指标
   */
  recordMetric(
    name: string,
    value: number,
    unit: 'ms' | 'bytes' | 'count' | 'percentage',
    category: 'search' | 'reactions' | 'rtc' | 'push' | 'encryption' | 'general',
    tags?: Record<string, string>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      category,
      ...(tags && { tags })
    }

    this.metrics.push(metric)

    // 保持最大指标数量限制
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  /**
   * 记录搜索性能指标
   */
  recordSearchPerformance(metrics: SearchPerformanceMetrics): void {
    this.recordMetric('search_query_time', metrics.queryTime, 'ms', 'search')
    this.recordMetric('search_result_count', metrics.resultCount, 'count', 'search')
    this.recordMetric('search_cache_hit_rate', metrics.cacheHitRate, 'percentage', 'search')
    this.recordMetric('search_filter_processing_time', metrics.filterProcessingTime, 'ms', 'search')
    this.recordMetric('search_render_time', metrics.renderTime, 'ms', 'search')
  }

  /**
   * 记录反应性能指标
   */
  recordReactionPerformance(metrics: ReactionPerformanceMetrics): void {
    this.recordMetric('reaction_load_time', metrics.loadTime, 'ms', 'reactions')
    this.recordMetric('reaction_update_time', metrics.updateTime, 'ms', 'reactions')
    this.recordMetric('reaction_cache_hit_rate', metrics.cacheHitRate, 'percentage', 'reactions')
    this.recordMetric('reaction_sync_time', metrics.syncTime, 'ms', 'reactions')
    this.recordMetric('reaction_render_time', metrics.renderTime, 'ms', 'reactions')
  }

  /**
   * 记录RTC性能指标
   */
  recordRTCPerformance(metrics: RTCPerformanceMetrics): void {
    this.recordMetric('rtc_connection_time', metrics.connectionTime, 'ms', 'rtc')
    this.recordMetric('rtc_ice_gathering_time', metrics.iceGatheringTime, 'ms', 'rtc')
    this.recordMetric('rtc_audio_level', metrics.audioLevel, 'percentage', 'rtc')
    this.recordMetric('rtc_video_quality', metrics.videoQuality, 'percentage', 'rtc')
    this.recordMetric('rtc_packet_loss', metrics.packetLoss, 'percentage', 'rtc')
    this.recordMetric('rtc_round_trip_time', metrics.roundTripTime, 'ms', 'rtc')
  }

  /**
   * 记录推送规则性能指标
   */
  recordPushRulesPerformance(metrics: PushRulesPerformanceMetrics): void {
    this.recordMetric('push_rule_processing_time', metrics.ruleProcessingTime, 'ms', 'push')
    this.recordMetric('push_policy_load_time', metrics.policyLoadTime, 'ms', 'push')
    this.recordMetric('push_cache_hit_rate', metrics.cacheHitRate, 'percentage', 'push')
    this.recordMetric('push_notification_delivery_time', metrics.notificationDeliveryTime, 'ms', 'push')
  }

  /**
   * 获取最近的指标
   */
  getRecentMetrics(count = 100, category?: string): PerformanceMetric[] {
    let filtered = this.metrics.slice(-count)
    if (category) {
      filtered = filtered.filter((metric) => metric.category === category)
    }
    return filtered
  }

  /**
   * 获取指标统计
   */
  getMetricStats(
    name: string,
    timeWindow = 300000 // 5分钟
  ): { avg: number; min: number; max: number; count: number; latest: number } | null {
    const now = Date.now()
    const recentMetrics = this.metrics.filter((metric) => metric.name === name && now - metric.timestamp <= timeWindow)

    if (recentMetrics.length === 0) return null

    const values = recentMetrics.map((m) => m.value)
    return {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
      latest: values[values.length - 1] ?? 0
    }
  }

  /**
   * 生成性能报告
   */
  generateReport(): PerformanceReport {
    const now = Date.now()
    const recentMetrics = this.metrics.filter((metric) => now - metric.timestamp <= this.reportInterval)

    const categories: Record<string, PerformanceMetric[]> = {}
    for (const metric of recentMetrics) {
      const arr = categories[metric.category] || (categories[metric.category] = [])
      arr.push(metric)
    }

    const reportCategories: Record<
      string,
      {
        count: number
        avgValue: number
        minValue: number
        maxValue: number
        latestValue: number
      }
    > = {}

    for (const [category, categoryMetrics] of Object.entries(categories)) {
      const values = categoryMetrics.map((m) => m.value)
      reportCategories[category] = {
        count: categoryMetrics.length,
        avgValue: values.reduce((a, b) => a + b, 0) / values.length,
        minValue: Math.min(...values),
        maxValue: Math.max(...values),
        latestValue: values[values.length - 1] ?? 0
      }
    }

    const trends = this.calculateTrends()
    const recommendations = this.generateRecommendations(reportCategories)

    return {
      totalMetrics: recentMetrics.length,
      categories: reportCategories,
      trends,
      recommendations
    }
  }

  /**
   * 计算性能趋势
   */
  private calculateTrends(): Record<
    string,
    {
      direction: 'up' | 'down' | 'stable'
      change: number
      percentage: number
    }
  > {
    const trends: Record<
      string,
      {
        direction: 'up' | 'down' | 'stable'
        change: number
        percentage: number
      }
    > = {}

    const metricNames = [...new Set(this.metrics.map((m) => m.name))]

    for (const name of metricNames) {
      const stats = this.getMetricStats(name)
      if (stats && stats.count >= 2) {
        const recent = this.metrics.slice(-10).filter((m) => m.name === name)
        const older = this.metrics.slice(-20, -10).filter((m) => m.name === name)

        if (recent.length > 0 && older.length > 0) {
          const recentAvg = recent.reduce((a, b) => a + b.value, 0) / recent.length
          const olderAvg = older.reduce((a, b) => a + b.value, 0) / older.length

          const change = recentAvg - olderAvg
          const percentage = (change / olderAvg) * 100

          let direction: 'up' | 'down' | 'stable' = 'stable'
          if (Math.abs(percentage) > 5) {
            direction = change > 0 ? 'up' : 'down'
          }

          trends[name] = {
            direction,
            change,
            percentage
          }
        }
      }
    }

    return trends
  }

  /**
   * 生成性能建议
   */
  private generateRecommendations(categories: Record<string, { count: number; avgValue: number }>): string[] {
    const recommendations: string[] = []

    // 搜索性能建议
    if (categories.search) {
      const searchMetrics = categories.search
      if (searchMetrics.avgValue > 1000) {
        recommendations.push('搜索查询响应时间较长，建议优化搜索算法或增加缓存')
      }
      if (searchMetrics.count > 100) {
        recommendations.push('搜索请求频率较高，建议实现防抖或节流机制')
      }
    }

    // RTC性能建议
    if (categories.rtc) {
      const rtcMetrics = categories.rtc
      if (rtcMetrics.avgValue > 3000) {
        recommendations.push('RTC连接时间较长，建议检查网络质量和ICE配置')
      }
    }

    // 反应性能建议
    if (categories.reactions) {
      const reactionMetrics = categories.reactions
      if (reactionMetrics.avgValue > 500) {
        recommendations.push('反应更新时间较长，建议优化同步机制')
      }
    }

    // 推送规则性能建议
    if (categories.push) {
      const pushMetrics = categories.push
      if (pushMetrics.avgValue > 200) {
        recommendations.push('推送规则处理时间较长，建议优化规则匹配算法')
      }
    }

    return recommendations
  }

  /**
   * 定期报告性能
   */
  private startPeriodicReporting() {
    setInterval(() => {
      const report = this.generateReport()

      // 在开发环境中输出报告
      if (import.meta.env.DEV) {
        console.group('📊 Matrix SDK Performance Report')
        console.groupEnd()
      }

      // 检查性能警告
      this.checkPerformanceWarnings(report)
    }, this.reportInterval)
  }

  /**
   * 检查性能警告
   */
  private checkPerformanceWarnings(report: PerformanceReport) {
    // 检查长时间任务 (使用配置的阈值)
    const longTasks = this.metrics.filter((m) => m.name === 'long_task_duration' && m.value > this.thresholds.longTask)
    if (longTasks.length > 0) {
      logger.warn('⚠️ 检测到长时间运行任务，可能影响用户体验:', longTasks)
    }

    // 检查搜索性能 (使用配置的阈值)
    if (report.categories.search && report.categories.search.avgValue > this.thresholds.searchSlow) {
      logger.warn('⚠️ 搜索性能较差，平均响应时间超过2秒')
    }

    // 检查RTC连接性能 (使用配置的阈值)
    if (report.categories.rtc && report.categories.rtc.avgValue > this.thresholds.rtcSlow) {
      logger.warn('⚠️ RTC连接性能较差，平均连接时间超过10秒')
    }
  }

  /**
   * 清理旧的性能指标
   */
  cleanup(maxAge = 3600000) {
    // 1小时
    const now = Date.now()
    this.metrics = this.metrics.filter((metric) => now - metric.timestamp <= maxAge)
  }

  /**
   * 导出性能数据
   */
  exportData(): {
    metrics: PerformanceMetric[]
    exportTime: string
    summary: PerformanceReport
  } {
    return {
      metrics: this.metrics,
      exportTime: new Date().toISOString(),
      summary: this.generateReport()
    }
  }

  /**
   * 销毁性能监控器
   */
  destroy() {
    this.observers.forEach((observer) => observer.disconnect())
    this.observers = []
    this.timers.clear()
    this.metrics = []
  }
}

// 全局性能监控器实例
export const performanceMonitor = new PerformanceMonitor()

// 性能装饰器函数
export function measurePerformance(
  name: string,
  category: 'search' | 'reactions' | 'rtc' | 'push' | 'encryption' | 'general',
  tags?: Record<string, string>
) {
  return (_target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      const timerName = `${name}_${propertyKey}`
      performanceMonitor.startTimer(timerName)

      try {
        const result = await originalMethod.apply(this, args)
        return result
      } finally {
        performanceMonitor.endTimer(timerName, category, tags)
      }
    }

    return descriptor
  }
}

// 创建性能计时器的便捷函数
export function createTimer(category: 'search' | 'reactions' | 'rtc' | 'push' | 'encryption' | 'general') {
  return {
    start: (name: string) => performanceMonitor.startTimer(`${category}_${name}`),
    end: (name: string, tags?: Record<string, string>) =>
      performanceMonitor.endTimer(`${category}_${name}`, category, tags)
  }
}

// 保留原有的简单API以向后兼容
export const Perf = {
  mark(name: string) {
    try {
      performance.mark(name)
    } catch {}
  },
  measure(name: string, start: string) {
    try {
      const m = performance.measure(name, start)
      logger.info(`[perf] ${name}: ${m.duration.toFixed(1)}ms`)
      return m.duration
    } catch {
      return 0
    }
  }
}
