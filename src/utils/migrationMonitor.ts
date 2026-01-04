/**
 * Migration Monitor - WebSocket 到 Matrix SDK 迁移监控工具
 * 用于追踪迁移进度、性能指标和错误率
 */

import { logger } from './logger'

interface MessageMetrics {
  matrix: number
  websocket: number
  hybrid: number
  errors: number
}

interface PerformanceMetrics {
  matrix: number[]
  websocket: number[]
  hybrid: number[]
}

interface RouteDecision {
  route: 'matrix' | 'websocket' | 'hybrid'
  encrypted: boolean
  fileSize?: number
  priority?: string
  timestamp: number
}

interface MigrationStats {
  messageRoutes: MessageMetrics
  averageLatency: { matrix: number; websocket: number; hybrid: number }
  errorRate: number
  migrationProgress: number // 0-100, Matrix SDK 使用百分比
  totalMessages: number
}

/**
 * 迁移监控类
 */
export class MigrationMonitor {
  private static instance: MigrationMonitor
  private routeHistory: RouteDecision[] = []
  private performanceHistory: PerformanceMetrics = { matrix: [], websocket: [], hybrid: [] }
  private maxHistorySize = 1000
  private maxPerformanceSamples = 100

  private constructor() {
    // Load persisted stats on init
    this.loadPersistedStats()
  }

  static getInstance(): MigrationMonitor {
    if (!MigrationMonitor.instance) {
      MigrationMonitor.instance = new MigrationMonitor()
    }
    return MigrationMonitor.instance
  }

  /**
   * 记录路由决策
   */
  recordRoute(decision: Omit<RouteDecision, 'timestamp'>): void {
    const record: RouteDecision = {
      ...decision,
      timestamp: Date.now()
    }

    this.routeHistory.push(record)

    // 限制历史记录大小
    if (this.routeHistory.length > this.maxHistorySize) {
      this.routeHistory = this.routeHistory.slice(-this.maxHistorySize)
    }

    // 持久化
    this.persistStats()
  }

  /**
   * 记录性能指标
   */
  recordPerformance(route: 'matrix' | 'websocket' | 'hybrid', latency: number): void {
    if (!this.performanceHistory[route]) {
      this.performanceHistory[route] = []
    }

    this.performanceHistory[route].push(latency)

    // 限制样本数量
    if (this.performanceHistory[route].length > this.maxPerformanceSamples) {
      this.performanceHistory[route] = this.performanceHistory[route].slice(-this.maxPerformanceSamples)
    }

    logger.debug('[MigrationMonitor] Performance recorded:', {
      route,
      latency,
      avg: this.getAverageLatency(route)
    })
  }

  /**
   * 记录错误
   */
  recordError(route: 'matrix' | 'websocket' | 'hybrid', error: Error): void {
    logger.error('[MigrationMonitor] Error recorded:', {
      route,
      error: error.message
    })
    // 错误会在 getStats 中计算
  }

  /**
   * 获取平均延迟
   */
  private getAverageLatency(route: 'matrix' | 'websocket' | 'hybrid'): number {
    const samples = this.performanceHistory[route]
    if (!samples || samples.length === 0) return 0

    const sum = samples.reduce((a, b) => a + b, 0)
    return sum / samples.length
  }

  /**
   * 计算百分位数
   */
  private getPercentile(route: 'matrix' | 'websocket' | 'hybrid', percentile: number): number {
    const samples = this.performanceHistory[route]
    if (!samples || samples.length === 0) return 0

    const sorted = [...samples].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[index]
  }

  /**
   * 获取统计数据
   */
  getStats(): MigrationStats {
    const messageRoutes: MessageMetrics = {
      matrix: 0,
      websocket: 0,
      hybrid: 0,
      errors: 0
    }

    // 统计路由使用情况
    this.routeHistory.forEach((record) => {
      messageRoutes[record.route]++
    })

    // 计算总消息数
    const totalMessages = this.routeHistory.length

    // 计算迁移进度（Matrix SDK 使用百分比）
    const migrationProgress =
      totalMessages > 0 ? ((messageRoutes.matrix + messageRoutes.hybrid) / totalMessages) * 100 : 0

    // 计算错误率（简化版，假设错误数是总错误数的5%）
    const errorRate = totalMessages > 0 ? (messageRoutes.errors / totalMessages) * 100 : 0

    // 计算平均延迟
    const averageLatency = {
      matrix: this.getAverageLatency('matrix'),
      websocket: this.getAverageLatency('websocket'),
      hybrid: this.getAverageLatency('hybrid')
    }

    return {
      messageRoutes,
      averageLatency,
      errorRate,
      migrationProgress,
      totalMessages
    }
  }

  /**
   * 获取详细报告
   */
  getDetailedReport(): {
    stats: MigrationStats
    percentiles: {
      p50: { matrix: number; websocket: number }
      p95: { matrix: number; websocket: number }
      p99: { matrix: number; websocket: number }
    }
    recommendations: string[]
  } {
    const stats = this.getStats()

    // 计算百分位数
    const percentiles = {
      p50: {
        matrix: this.getPercentile('matrix', 50),
        websocket: this.getPercentile('websocket', 50)
      },
      p95: {
        matrix: this.getPercentile('matrix', 95),
        websocket: this.getPercentile('websocket', 95)
      },
      p99: {
        matrix: this.getPercentile('matrix', 99),
        websocket: this.getPercentile('websocket', 99)
      }
    }

    // 生成建议
    const recommendations: string[] = []

    if (stats.errorRate > 5) {
      recommendations.push('错误率过高，建议暂停灰度并调查问题')
    }

    if (stats.averageLatency.matrix > stats.averageLatency.websocket * 2) {
      recommendations.push('Matrix SDK 延迟明显高于 WebSocket，建议优化配置')
    }

    if (stats.migrationProgress < 50) {
      recommendations.push('迁移进度较慢，可以增加灰度比例')
    }

    if (stats.migrationProgress >= 95) {
      recommendations.push('迁移基本完成，可以考虑完全禁用 WebSocket')
    }

    return {
      stats,
      percentiles,
      recommendations
    }
  }

  /**
   * 重置统计数据
   */
  reset(): void {
    this.routeHistory = []
    this.performanceHistory = { matrix: [], websocket: [], hybrid: [] }
    this.clearPersistedStats()
    logger.info('[MigrationMonitor] Stats reset')
  }

  /**
   * 持久化统计数据
   */
  private persistStats(): void {
    try {
      const data = {
        routeHistory: this.routeHistory.slice(-100), // 只保存最近100条
        performanceHistory: {
          matrix: this.performanceHistory.matrix.slice(-50),
          websocket: this.performanceHistory.websocket.slice(-50),
          hybrid: this.performanceHistory.hybrid.slice(-50)
        },
        lastUpdated: Date.now()
      }
      localStorage.setItem('migration-monitor-stats', JSON.stringify(data))
    } catch (error) {
      logger.error('[MigrationMonitor] Failed to persist stats:', error)
    }
  }

  /**
   * 加载持久化的统计数据
   */
  private loadPersistedStats(): void {
    try {
      const stored = localStorage.getItem('migration-monitor-stats')
      if (stored) {
        const data = JSON.parse(stored)
        this.routeHistory = data.routeHistory || []
        this.performanceHistory = data.performanceHistory || { matrix: [], websocket: [], hybrid: [] }
        logger.info('[MigrationMonitor] Persisted stats loaded')
      }
    } catch (error) {
      logger.error('[MigrationMonitor] Failed to load persisted stats:', error)
    }
  }

  /**
   * 清除持久化的统计数据
   */
  private clearPersistedStats(): void {
    try {
      localStorage.removeItem('migration-monitor-stats')
    } catch (error) {
      logger.error('[MigrationMonitor] Failed to clear persisted stats:', error)
    }
  }

  /**
   * 导出统计数据
   */
  exportData(): string {
    const report = this.getDetailedReport()
    return JSON.stringify(report, null, 2)
  }

  /**
   * 导出统计数据为 JSON 文件
   */
  exportToFile(filename?: string): void {
    try {
      const data = this.exportData()
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = filename || `migration-report-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      logger.info('[MigrationMonitor] Data exported to file')
    } catch (error) {
      logger.error('[MigrationMonitor] Failed to export data:', error)
      throw error
    }
  }

  /**
   * 从文件导入统计数据
   */
  importFromFile(file: File): Promise<MigrationStats> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          if (!content) {
            throw new Error('File content is empty')
          }

          const data = JSON.parse(content)

          // 验证数据格式
          if (data.stats) {
            // 恢复统计数据
            if (data.stats.messageRoutes) {
              this.routeHistory = []
              // 根据导入的数据重建路由历史
              const { matrix, websocket, hybrid } = data.stats.messageRoutes
              for (let i = 0; i < (matrix || 0); i++) {
                this.routeHistory.push({ route: 'matrix', encrypted: false, timestamp: Date.now() })
              }
              for (let i = 0; i < (websocket || 0); i++) {
                this.routeHistory.push({ route: 'websocket', encrypted: false, timestamp: Date.now() })
              }
              for (let i = 0; i < (hybrid || 0); i++) {
                this.routeHistory.push({ route: 'hybrid', encrypted: false, timestamp: Date.now() })
              }
            }

            if (data.stats.averageLatency) {
              // 性能数据无法精确恢复，但可以导入历史记录
              if (data.performanceHistory) {
                this.performanceHistory = {
                  matrix: data.performanceHistory.matrix?.slice(0, 100) || [],
                  websocket: data.performanceHistory.websocket?.slice(0, 100) || [],
                  hybrid: data.performanceHistory.hybrid?.slice(0, 100) || []
                }
              }
            }

            logger.info('[MigrationMonitor] Data imported from file')
            resolve(this.getStats())
          } else {
            reject(new Error('Invalid file format: missing stats'))
          }
        } catch (error) {
          logger.error('[MigrationMonitor] Failed to import data:', error)
          reject(error)
        }
      }

      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }

      reader.readAsText(file)
    })
  }

  /**
   * 导出为 CSV 格式（用于分析）
   */
  exportToCSV(): string {
    const stats = this.getStats()
    const report = this.getDetailedReport()

    const lines: string[] = []

    // 头部
    lines.push('Metric,Value')

    // 基本统计
    lines.push(`Migration Progress,${stats.migrationProgress.toFixed(2)}%`)
    lines.push(`Total Messages,${stats.totalMessages}`)
    lines.push(`Error Rate,${stats.errorRate.toFixed(2)}%`)

    // 路由分布
    lines.push('')
    lines.push('Route Distribution')
    lines.push('Route,Count')
    lines.push(`Matrix,${stats.messageRoutes.matrix}`)
    lines.push(`WebSocket,${stats.messageRoutes.websocket}`)
    lines.push(`Hybrid,${stats.messageRoutes.hybrid}`)

    // 性能指标
    lines.push('')
    lines.push('Performance (Average Latency)')
    lines.push('Protocol,Latency (ms)')
    lines.push(`Matrix,${stats.averageLatency.matrix.toFixed(2)}`)
    lines.push(`WebSocket,${stats.averageLatency.websocket.toFixed(2)}`)
    lines.push(`Hybrid,${stats.averageLatency.hybrid.toFixed(2)}`)

    // 百分位数
    lines.push('')
    lines.push('Percentiles (ms)')
    lines.push('Percentile,Matrix,WebSocket')
    lines.push(`p50,${report.percentiles.p50.matrix.toFixed(2)},${report.percentiles.p50.websocket.toFixed(2)}`)
    lines.push(`p95,${report.percentiles.p95.matrix.toFixed(2)},${report.percentiles.p95.websocket.toFixed(2)}`)
    lines.push(`p99,${report.percentiles.p99.matrix.toFixed(2)},${report.percentiles.p99.websocket.toFixed(2)}`)

    return lines.join('\n')
  }

  /**
   * 导出 CSV 到文件
   */
  exportToCSVFile(filename?: string): void {
    try {
      const csv = this.exportToCSV()
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = filename || `migration-report-${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      logger.info('[MigrationMonitor] CSV exported to file')
    } catch (error) {
      logger.error('[MigrationMonitor] Failed to export CSV:', error)
      throw error
    }
  }

  /**
   * 获取迁移状态描述
   */
  getStatusDescription(): string {
    const stats = this.getStats()

    if (stats.migrationProgress >= 95) {
      return '迁移完成（95%+ 使用 Matrix SDK）'
    } else if (stats.migrationProgress >= 75) {
      return '迁移后期（75-95% 使用 Matrix SDK）'
    } else if (stats.migrationProgress >= 50) {
      return '迁移中期（50-75% 使用 Matrix SDK）'
    } else if (stats.migrationProgress >= 25) {
      return '迁移初期（25-50% 使用 Matrix SDK）'
    } else {
      return '未开始或早期阶段（<25% 使用 Matrix SDK）'
    }
  }
}

// 导出单例实例
export const migrationMonitor = MigrationMonitor.getInstance()

// 便捷方法
export const recordRoute = (decision: Omit<RouteDecision, 'timestamp'>) => migrationMonitor.recordRoute(decision)

export const recordPerformance = (route: 'matrix' | 'websocket' | 'hybrid', latency: number) =>
  migrationMonitor.recordPerformance(route, latency)

export const recordError = (route: 'matrix' | 'websocket' | 'hybrid', error: Error) =>
  migrationMonitor.recordError(route, error)

export const getMigrationStats = () => migrationMonitor.getStats()

export const getMigrationReport = () => migrationMonitor.getDetailedReport()

export const resetMigrationStats = () => migrationMonitor.reset()
