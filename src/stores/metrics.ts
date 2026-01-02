import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'
import {
  performanceMonitor,
  type PerformanceMetric,
  type PerformanceReport,
  type SearchPerformanceMetrics,
  type ReactionPerformanceMetrics,
  type RTCPerformanceMetrics,
  type PushRulesPerformanceMetrics
} from '@/utils/Perf'

export type MetricEvent = { name: string; ts: number; meta?: Record<string, unknown> }

export interface MetricsState {
  enabled: boolean
  autoReport: boolean
  reportInterval: number
  maxAge: number
  categories: string[]
}

export interface MetricsAlert {
  id: string
  type: 'warning' | 'error' | 'info'
  category: string
  metric: string
  threshold: number
  currentValue: number
  message: string
  timestamp: number
  acknowledged: boolean
}

export interface MetricsDashboard {
  overview: {
    totalMetrics: number
    activeCategories: number
    alertsCount: number
    healthScore: number
  }
  performance: {
    search: {
      avgQueryTime: number
      cacheHitRate: number
      successRate: number
    }
    reactions: {
      avgUpdateTime: number
      syncRate: number
      errorRate: number
    }
    rtc: {
      avgConnectionTime: number
      callQuality: number
      packetLossRate: number
    }
    push: {
      avgProcessingTime: number
      deliveryRate: number
      policyLoadTime: number
    }
  }
  trends: {
    [key: string]: {
      direction: 'up' | 'down' | 'stable'
      change: number
      percentage: number
    }
  }
}

export const useMetricsStore = defineStore('metrics', () => {
  // 兼容旧的简单指标系统
  const events = ref<MetricEvent[]>([])
  const thresholds = ref<Record<string, { clicks: number; failRate: number }>>({})
  const overrides = ref<Record<string, 'on' | 'off' | 'auto'>>({})

  // 新的高级性能监控系统
  const state = ref<MetricsState>({
    enabled: true,
    autoReport: true,
    reportInterval: 60000, // 1分钟
    maxAge: 3600000, // 1小时
    categories: ['search', 'reactions', 'rtc', 'push', 'encryption', 'general']
  })

  const alerts = ref<MetricsAlert[]>([])
  const dashboard = ref<MetricsDashboard | null>(null)
  const lastReport = ref<PerformanceReport | null>(null)
  const loading = ref(false)

  // 阈值配置
  const performanceThresholds = ref({
    search: {
      queryTime: 1000, // 1秒
      cacheHitRate: 70, // 70%
      errorRate: 5 // 5%
    },
    reactions: {
      updateTime: 500, // 500ms
      syncTime: 1000, // 1秒
      errorRate: 3 // 3%
    },
    rtc: {
      connectionTime: 5000, // 5秒
      packetLossRate: 5, // 5%
      audioLevel: 30 // 30%
    },
    push: {
      processingTime: 200, // 200ms
      deliveryTime: 1000, // 1秒
      errorRate: 2 // 2%
    }
  })

  // 计算属性
  const recentMetrics = computed(() => {
    return performanceMonitor.getRecentMetrics(100)
  })

  const metricsByCategory = computed(() => {
    const grouped: Record<string, PerformanceMetric[]> = {}
    for (const metric of recentMetrics.value) {
      const key = metric.category
      const arr = grouped[key] || (grouped[key] = [])
      arr.push(metric)
    }
    return grouped
  })

  const activeAlerts = computed(() => {
    return alerts.value.filter((alert) => !alert.acknowledged)
  })

  const criticalAlerts = computed(() => {
    return activeAlerts.value.filter((alert) => alert.type === 'error')
  })

  const healthScore = computed(() => {
    if (!dashboard.value) return 100

    let score = 100
    const { performance } = dashboard.value

    // 搜索性能评分 (30%)
    if (performance.search.avgQueryTime > performanceThresholds.value.search.queryTime) {
      score -= 15
    }
    if (performance.search.cacheHitRate < performanceThresholds.value.search.cacheHitRate) {
      score -= 10
    }

    // RTC性能评分 (25%)
    if (performance.rtc.avgConnectionTime > performanceThresholds.value.rtc.connectionTime) {
      score -= 15
    }
    if (performance.rtc.packetLossRate > performanceThresholds.value.rtc.packetLossRate) {
      score -= 10
    }

    // 反应性能评分 (20%)
    if (performance.reactions.avgUpdateTime > performanceThresholds.value.reactions.updateTime) {
      score -= 10
    }

    // 推送性能评分 (15%)
    if (performance.push.avgProcessingTime > performanceThresholds.value.push.processingTime) {
      score -= 8
    }

    // 警报扣分 (10%)
    const alertPenalty = criticalAlerts.value.length * 5
    score = Math.max(0, score - alertPenalty)

    return Math.round(score)
  })

  // 旧的简单指标系统方法
  const record = (name: string, meta?: Record<string, unknown>) => {
    const ev = { name, ts: Date.now(), meta: meta ?? {} }
    events.value.push(ev)
    try {
      const key = '__metrics__'
      const raw = localStorage.getItem(key)
      const arr = raw ? JSON.parse(raw) : []
      arr.push(ev)
      localStorage.setItem(key, JSON.stringify(arr).slice(0, 10000))
    } catch {}
  }

  const load = () => {
    try {
      const raw = localStorage.getItem('__metrics__')
      const arr = raw ? JSON.parse(raw) : []
      if (Array.isArray(arr)) events.value = arr
      const th = localStorage.getItem('__metrics_thresholds__')
      const ov = localStorage.getItem('__feature_overrides__')
      thresholds.value = th ? JSON.parse(th) : {}
      overrides.value = ov ? JSON.parse(ov) : {}
    } catch {}
  }

  const summaryByDay = () => {
    const day = (ts: number) => new Date(ts).toISOString().slice(0, 10)
    const map: Record<string, Record<string, number>> = {}
    for (const ev of events.value) {
      const d = day(ev.ts)
      const m = (map[d] ||= {})
      m[ev.name] = (m[ev.name] || 0) + 1
    }
    return map
  }

  const summaryFor = (prefix: string) => {
    const s = { click: 0, success: 0, failed: 0, unsupported: 0 }
    for (const ev of events.value) {
      if (ev.name.startsWith(prefix)) {
        if (ev.name.includes('click')) s.click++
        else if (ev.name.includes('success')) s.success++
        else if (ev.name.includes('failed')) s.failed++
        else if (ev.name.includes('unsupported')) s.unsupported++
      }
    }
    const rate = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)
    return { ...s, successRate: rate(s.success, s.click), failRate: rate(s.failed, s.click) }
  }

  const exportCsv = () => {
    const rows = [['date', 'name', 'count']]
    const sum = summaryByDay()
    for (const d of Object.keys(sum)) {
      const m = sum[d]
      if (!m) continue
      for (const k of Object.keys(m)) {
        rows.push([d, k, String(m[k])])
      }
    }
    const csv = rows.map((r) => r.join(',')).join('\n')
    try {
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `metrics_${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
    return csv
  }

  const shouldDisable = (feature: string, thresholdConfig?: { failRate?: number; clicks?: number }) => {
    const s = summaryFor(feature)
    const conf = thresholds.value[feature] || { clicks: 10, failRate: 50 }
    const minClicks = thresholdConfig?.clicks ?? conf.clicks ?? 10
    const maxFailRate = thresholdConfig?.failRate ?? conf.failRate ?? 50
    return s.click >= minClicks && s.failRate >= maxFailRate
  }

  const setThreshold = (feature: string, clicks: number, failRate: number) => {
    thresholds.value[feature] = { clicks, failRate }
    try {
      localStorage.setItem('__metrics_thresholds__', JSON.stringify(thresholds.value))
    } catch {}
  }

  const setOverride = (feature: string, mode: 'on' | 'off' | 'auto') => {
    overrides.value[feature] = mode
    try {
      localStorage.setItem('__feature_overrides__', JSON.stringify(overrides.value))
    } catch {}
  }

  const getOverride = (feature: string): 'on' | 'off' | 'auto' => {
    return overrides.value[feature] || 'auto'
  }

  // 新的高级性能监控方法
  const initialize = async () => {
    if (!state.value.enabled) return

    loading.value = true

    try {
      // 初始化性能监控
      await updateDashboard()

      // 启动自动报告
      if (state.value.autoReport) {
        startAutoReporting()
      }

      // 检查性能警告
      checkPerformanceAlerts()
    } catch (error) {
      logger.error('Failed to initialize metrics store:', error)
    } finally {
      loading.value = false
    }
  }

  const updateDashboard = async () => {
    try {
      const report = performanceMonitor.generateReport()
      lastReport.value = report

      // 计算性能数据
      const performance = calculatePerformanceMetrics(report)

      // 更新仪表板
      dashboard.value = {
        overview: {
          totalMetrics: report.totalMetrics,
          activeCategories: Object.keys(report.categories).length,
          alertsCount: activeAlerts.value.length,
          healthScore: healthScore.value
        },
        performance,
        trends: report.trends
      }
    } catch (error) {
      logger.error('Failed to update dashboard:', error)
    }
  }

  const calculatePerformanceMetrics = (report: PerformanceReport) => {
    const categories = report.categories

    return {
      search: {
        avgQueryTime: getAverageMetric(categories, 'search_query_time') || 0,
        cacheHitRate: getAverageMetric(categories, 'search_cache_hit_rate') || 100,
        successRate: 100 - (getAverageMetric(categories, 'search_error_rate') || 0)
      },
      reactions: {
        avgUpdateTime: getAverageMetric(categories, 'reaction_update_time') || 0,
        syncRate: getAverageMetric(categories, 'reaction_sync_rate') || 100,
        errorRate: getAverageMetric(categories, 'reaction_error_rate') || 0
      },
      rtc: {
        avgConnectionTime: getAverageMetric(categories, 'rtc_connection_time') || 0,
        callQuality: getAverageMetric(categories, 'rtc_video_quality') || 100,
        packetLossRate: getAverageMetric(categories, 'rtc_packet_loss') || 0
      },
      push: {
        avgProcessingTime: getAverageMetric(categories, 'push_rule_processing_time') || 0,
        deliveryRate: getAverageMetric(categories, 'push_delivery_rate') || 100,
        policyLoadTime: getAverageMetric(categories, 'push_policy_load_time') || 0
      }
    }
  }

  const getAverageMetric = (_categories: unknown, metricName: string): number | null => {
    const metrics = performanceMonitor.getRecentMetrics(100)
    const relevantMetrics = metrics.filter((m) => m.name === metricName)

    if (relevantMetrics.length === 0) return null

    const values = relevantMetrics.map((m) => m.value)
    return values.reduce((a, b) => a + b, 0) / values.length
  }

  const checkPerformanceAlerts = () => {
    if (!dashboard.value) return

    const { performance } = dashboard.value
    const newAlerts: MetricsAlert[] = []

    // 检查搜索性能
    if (performance.search.avgQueryTime > performanceThresholds.value.search.queryTime) {
      newAlerts.push(
        createAlert(
          'warning',
          'search',
          'query_time',
          performanceThresholds.value.search.queryTime,
          performance.search.avgQueryTime,
          '搜索查询响应时间过长'
        )
      )
    }

    if (performance.search.cacheHitRate < performanceThresholds.value.search.cacheHitRate) {
      newAlerts.push(
        createAlert(
          'warning',
          'search',
          'cache_hit_rate',
          performanceThresholds.value.search.cacheHitRate,
          performance.search.cacheHitRate,
          '搜索缓存命中率过低'
        )
      )
    }

    // 检查RTC性能
    if (performance.rtc.avgConnectionTime > performanceThresholds.value.rtc.connectionTime) {
      newAlerts.push(
        createAlert(
          'error',
          'rtc',
          'connection_time',
          performanceThresholds.value.rtc.connectionTime,
          performance.rtc.avgConnectionTime,
          'RTC连接时间过长'
        )
      )
    }

    if (performance.rtc.packetLossRate > performanceThresholds.value.rtc.packetLossRate) {
      newAlerts.push(
        createAlert(
          'warning',
          'rtc',
          'packet_loss',
          performanceThresholds.value.rtc.packetLossRate,
          performance.rtc.packetLossRate,
          'RTC丢包率过高'
        )
      )
    }

    // 检查反应性能
    if (performance.reactions.avgUpdateTime > performanceThresholds.value.reactions.updateTime) {
      newAlerts.push(
        createAlert(
          'warning',
          'reactions',
          'update_time',
          performanceThresholds.value.reactions.updateTime,
          performance.reactions.avgUpdateTime,
          '反应更新时间过长'
        )
      )
    }

    // 检查推送性能
    if (performance.push.avgProcessingTime > performanceThresholds.value.push.processingTime) {
      newAlerts.push(
        createAlert(
          'warning',
          'push',
          'processing_time',
          performanceThresholds.value.push.processingTime,
          performance.push.avgProcessingTime,
          '推送规则处理时间过长'
        )
      )
    }

    // 添加新警报（避免重复）
    for (const newAlert of newAlerts) {
      const exists = alerts.value.some(
        (alert) => alert.metric === newAlert.metric && alert.category === newAlert.category && !alert.acknowledged
      )

      if (!exists) {
        alerts.value.push(newAlert)
      }
    }
  }

  const createAlert = (
    type: 'warning' | 'error' | 'info',
    category: string,
    metric: string,
    threshold: number,
    currentValue: number,
    message: string
  ): MetricsAlert => {
    return {
      id: `${category}_${metric}_${Date.now()}`,
      type,
      category,
      metric,
      threshold,
      currentValue,
      message,
      timestamp: Date.now(),
      acknowledged: false
    }
  }

  const acknowledgeAlert = (alertId: string) => {
    const alert = alerts.value.find((a) => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
    }
  }

  const clearAlerts = (category?: string) => {
    if (category) {
      alerts.value = alerts.value.filter((alert) => alert.category !== category)
    } else {
      alerts.value = []
    }
  }

  const startAutoReporting = () => {
    if (state.value.autoReport) {
      setInterval(async () => {
        await updateDashboard()
        checkPerformanceAlerts()
      }, state.value.reportInterval)
    }
  }

  const recordSearchMetrics = (metrics: SearchPerformanceMetrics) => {
    performanceMonitor.recordSearchPerformance(metrics)
  }

  const recordReactionMetrics = (metrics: ReactionPerformanceMetrics) => {
    performanceMonitor.recordReactionPerformance(metrics)
  }

  const recordRTCMetrics = (metrics: RTCPerformanceMetrics) => {
    performanceMonitor.recordRTCPerformance(metrics)
  }

  const recordPushRulesMetrics = (metrics: PushRulesPerformanceMetrics) => {
    performanceMonitor.recordPushRulesPerformance(metrics)
  }

  const exportMetrics = () => {
    return performanceMonitor.exportData()
  }

  const updatePerformanceThreshold = (
    category: keyof typeof performanceThresholds.value,
    metric: string,
    value: number
  ) => {
    const categoryThresholds = performanceThresholds.value[category]
    if (!categoryThresholds) return

    const metricKey = metric as keyof typeof categoryThresholds
    if (typeof categoryThresholds[metricKey] === 'number') {
      categoryThresholds[metricKey] = value as never
    }
  }

  const updateSettings = (newSettings: Partial<MetricsState>) => {
    state.value = { ...state.value, ...newSettings }
  }

  const reset = () => {
    alerts.value = []
    dashboard.value = null
    lastReport.value = null
    loading.value = false

    // 重置状态
    state.value = {
      enabled: true,
      autoReport: true,
      reportInterval: 60000,
      maxAge: 3600000,
      categories: ['search', 'reactions', 'rtc', 'push', 'encryption', 'general']
    }
  }

  const cleanup = () => {
    performanceMonitor.cleanup(state.value.maxAge)
  }

  return {
    // 旧的简单指标系统
    events: computed(() => events.value),
    thresholds: computed(() => thresholds.value),
    overrides: computed(() => overrides.value),
    record,
    load,
    summaryByDay,
    summaryFor,
    exportCsv,
    shouldDisable,
    setThreshold,
    setOverride,
    getOverride,

    // 新的高级性能监控系统
    state: computed(() => state.value),
    alerts: computed(() => alerts.value),
    dashboard: computed(() => dashboard.value),
    lastReport: computed(() => lastReport.value),
    loading: computed(() => loading.value),
    performanceThresholds: computed(() => performanceThresholds.value),

    recentMetrics,
    metricsByCategory,
    activeAlerts,
    criticalAlerts,
    healthScore,

    initialize,
    updateDashboard,
    recordSearchMetrics,
    recordReactionMetrics,
    recordRTCMetrics,
    recordPushRulesMetrics,
    acknowledgeAlert,
    clearAlerts,
    exportMetrics,
    updatePerformanceThreshold,
    updateSettings,
    cleanup,
    reset
  }
})
