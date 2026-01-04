/**
 * 架构选择器
 * 基于网络条件和性能指标智能选择最优架构
 */

import type { ArchitectureMode, FeatureContext } from '@/types/architecture'

/** 网络连接信息 */
export interface NetworkConnection {
  downlink: number
  effectiveType?: string
  type?: string
  addEventListener?: (event: string, listener: () => void) => void
}

/** 网络连接 API 类型 */
export interface NavigatorWithConnection extends Navigator {
  connection?: NetworkConnection
}

/** 性能内存信息 */
export interface PerformanceMemory {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

/** 带内存性能的性能 API */
export interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory
}

/** ImportMeta 环境类型 */
export interface ImportMetaEnv {
  VITE_MATRIX_SERVER_NAME?: string
  [key: string]: unknown
}

/** ImportMeta 类型 */
export interface ImportMetaWithEnv {
  env?: ImportMetaEnv
}

export interface NetworkMetrics {
  latency: number // ms
  bandwidth: number // Mbps
  packetLoss: number // percentage
  connectionType: 'wifi' | '4g' | '5g' | 'unknown'
}

export interface PerformanceMetrics {
  discoveryLatency?: number
  websocketLatency?: number
  memoryUsage?: number
  cpuUsage?: number
}

/**
 * 架构选择器
 */
export class ArchitectureSelector {
  private static instance: ArchitectureSelector
  private networkMetrics: NetworkMetrics | null = null
  private performanceMetrics: PerformanceMetrics = {}

  private constructor() {
    this.initializeMetrics()
  }

  public static getInstance(): ArchitectureSelector {
    if (!ArchitectureSelector.instance) {
      ArchitectureSelector.instance = new ArchitectureSelector()
    }
    return ArchitectureSelector.instance
  }

  /**
   * 初始化性能指标
   */
  private async initializeMetrics(): Promise<void> {
    // 检测网络类型
    this.detectNetworkType()

    // 监听网络变化
    if ('connection' in navigator) {
      const nav = navigator as NavigatorWithConnection
      const connection = nav.connection
      if (connection?.addEventListener) {
        connection.addEventListener('change', () => this.updateNetworkMetrics())
      }
    }

    // 定期收集性能指标
    setInterval(() => {
      void this.collectPerformanceMetrics()
    }, 30000) // 每30秒更新一次
  }

  /**
   * 根据上下文选择最优架构
   */
  public async selectOptimalArchitecture(
    feature: string,
    context: FeatureContext = {}
  ): Promise<{
    recommendation: ArchitectureMode
    confidence: number // 0-100
    reasoning: string[]
  }> {
    const reasoning: string[] = []

    // 基于网络状况选择
    const networkRecommendation = this.selectByNetwork(context, reasoning)
    reasoning.push(...networkRecommendation.reasoning)

    // 基于性能指标选择
    const performanceRecommendation = this.selectByPerformance(context, reasoning)
    reasoning.push(...performanceRecommendation.reasoning)

    // 基于功能特性选择
    const featureRecommendation = this.selectByFeature(feature, context, reasoning)
    reasoning.push(...featureRecommendation.reasoning)

    // 综合决策
    const recommendation = this.makeFinalDecision(
      [networkRecommendation.mode, performanceRecommendation.mode, featureRecommendation.mode],
      reasoning
    )

    return {
      recommendation,
      confidence: this.calculateConfidence(reasoning),
      reasoning
    }
  }

  /**
   * 基于网络状况选择
   */
  private selectByNetwork(
    _context: FeatureContext,
    reasoning: string[]
  ): { mode: ArchitectureMode; reasoning: string[] } {
    if (!this.networkMetrics) {
      return { mode: 'hybrid', reasoning: ['网络信息未知，使用混合模式'] }
    }

    const { latency, bandwidth, packetLoss } = this.networkMetrics

    // 高延迟或高丢包率时，优先使用WebSocket
    if (latency > 500 || packetLoss > 5) {
      reasoning.push(`网络质量差(延迟:${latency}ms,丢包:${packetLoss}%)，优先WebSocket`)
      return { mode: 'websocket', reasoning }
    }

    // 带宽充足时，可以使用混合模式
    if (bandwidth > 5) {
      reasoning.push(`带宽充足(${bandwidth}Mbps)，支持混合模式`)
      return { mode: 'hybrid', reasoning }
    }

    // 默认情况
    reasoning.push('网络状况一般，使用混合模式平衡性能和可靠性')
    return { mode: 'hybrid', reasoning }
  }

  /**
   * 基于性能指标选择
   */
  private selectByPerformance(
    _context: FeatureContext,
    reasoning: string[]
  ): { mode: ArchitectureMode; reasoning: string[] } {
    const { discoveryLatency, websocketLatency } = this.performanceMetrics

    // 比较两种实现的延迟
    if (discoveryLatency && websocketLatency) {
      const diff = Math.abs(discoveryLatency - websocketLatency)
      const threshold = 100 // 100ms阈值

      if (diff > threshold) {
        if (discoveryLatency < websocketLatency) {
          reasoning.push(`Matrix SDK更快(${discoveryLatency}ms vs ${websocketLatency}ms)`)
          return { mode: 'discovery', reasoning }
        } else {
          reasoning.push(`WebSocket更快(${websocketLatency}ms vs ${discoveryLatency}ms)`)
          return { mode: 'websocket', reasoning }
        }
      }
    }

    // 基于内存使用选择
    const { memoryUsage } = this.performanceMetrics
    if (memoryUsage && memoryUsage > 150 * 1024 * 1024) {
      // 150MB
      reasoning.push(`内存使用较高(${(memoryUsage / 1024 / 1024).toFixed(1)}MB)，使用WebSocket减少内存占用`)
      return { mode: 'websocket', reasoning }
    }

    reasoning.push('性能指标正常，使用混合模式')
    return { mode: 'hybrid', reasoning }
  }

  /**
   * 基于功能特性选择
   */
  private selectByFeature(
    feature: string,
    context: FeatureContext,
    reasoning: string[]
  ): { mode: ArchitectureMode; reasoning: string[] } {
    switch (feature) {
      case 'user-auth':
      case 'room-management':
        reasoning.push('认证和房间管理使用Matrix SDK标准实现')
        return { mode: 'discovery', reasoning }

      case 'rtc-calls':
      case 'real-time-sync':
        reasoning.push('实时通信使用WebSocket保证低延迟')
        return { mode: 'websocket', reasoning }

      case 'file-transfer':
        if (context.fileSize && context.fileSize > 50 * 1024 * 1024) {
          reasoning.push(`大文件(${(context.fileSize / 1024 / 1024).toFixed(1)}MB)使用WebSocket传输`)
          return { mode: 'websocket', reasoning }
        }
        break

      case 'messaging':
        if (context.messageType === 'encrypted') {
          reasoning.push('加密消息使用Matrix SDK E2EE支持')
          return { mode: 'discovery', reasoning }
        }
        break
    }

    reasoning.push('功能特性允许使用混合模式')
    return { mode: 'hybrid', reasoning }
  }

  /**
   * 做出最终决策
   */
  private makeFinalDecision(recommendations: ArchitectureMode[], _reasoning: string[]): ArchitectureMode {
    // 统计推荐次数
    const counts = recommendations.reduce(
      (acc, mode) => {
        acc[mode] = (acc[mode] || 0) + 1
        return acc
      },
      {} as Record<ArchitectureMode, number>
    )

    // 找出推荐次数最多的模式
    const maxCount = Math.max(...Object.values(counts))
    const topModes = Object.entries(counts)
      .filter(([_, count]) => count === maxCount)
      .map(([mode, _]) => mode) as ArchitectureMode[]

    // 如果有多个模式推荐次数相同，优先级：hybrid > discovery > websocket
    if (topModes.includes('hybrid')) return 'hybrid'
    if (topModes.includes('discovery')) return 'discovery'
    return 'websocket'
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(reasoning: string[]): number {
    // 基于推理的数量和质量计算置信度
    const hasNetworkInfo = reasoning.some((r) => r.includes('网络') || r.includes('带宽'))
    const hasPerformanceInfo = reasoning.some((r) => r.includes('延迟') || r.includes('内存'))
    const hasFeatureInfo = reasoning.some((r) => r.includes('功能') || r.includes('消息'))

    let confidence = 50 // 基础置信度

    if (hasNetworkInfo) confidence += 20
    if (hasPerformanceInfo) confidence += 20
    if (hasFeatureInfo) confidence += 10

    return Math.min(confidence, 100)
  }

  /**
   * 检测网络类型
   */
  private detectNetworkType(): void {
    if ('connection' in navigator) {
      const nav = navigator as NavigatorWithConnection
      const connection = nav.connection
      if (connection) {
        this.networkMetrics = {
          latency: 0, // 将通过实际测量更新
          bandwidth: connection.downlink || 0,
          packetLoss: 0, // 需要通过WebRTC测量
          connectionType: this.getConnectionType(connection)
        }
      }
    }
  }

  /**
   * 获取连接类型
   */
  private getConnectionType(connection: NetworkConnection): NetworkMetrics['connectionType'] {
    if (connection.effectiveType) {
      switch (connection.effectiveType) {
        case 'slow-2g':
        case '2g':
          return 'unknown'
        case '3g':
          return 'unknown' // 无法准确判断
        case '4g':
          return '4g'
      }
    }

    // 尝试通过API判断
    const nav = navigator as NavigatorWithConnection
    if (nav.connection?.type) {
      return nav.connection.type as 'wifi' | '4g' | '5g' | 'unknown'
    }

    return 'unknown'
  }

  /**
   * 更新网络指标
   */
  private updateNetworkMetrics(): void {
    if ('connection' in navigator) {
      const nav = navigator as NavigatorWithConnection
      const connection = nav.connection
      if (connection && this.networkMetrics) {
        this.networkMetrics = {
          ...this.networkMetrics,
          bandwidth: connection.downlink || 0,
          connectionType: this.getConnectionType(connection)
        }
      }
    }
  }

  /**
   * 收集性能指标
   */
  private async collectPerformanceMetrics(): Promise<void> {
    // 测量发现机制延迟
    const startTime = performance.now()
    try {
      const meta = import.meta as ImportMetaWithEnv
      const env = meta.env || {}
      const server = String(env.VITE_MATRIX_SERVER_NAME || '').trim() || 'cjystx.top'
      await fetch(`https://${server}/.well-known/matrix/client`, {
        method: 'HEAD',
        cache: 'no-cache'
      })
      this.performanceMetrics.discoveryLatency = performance.now() - startTime
    } catch {
      this.performanceMetrics.discoveryLatency = 9999 // 标记为不可用
    }

    // 测量内存使用
    if ('memory' in performance) {
      const perf = performance as PerformanceWithMemory
      const memory = perf.memory
      if (memory) {
        this.performanceMetrics.memoryUsage = memory.usedJSHeapSize
      }
    }
  }

  /**
   * 获取当前网络指标
   */
  public getNetworkMetrics(): NetworkMetrics | null {
    return this.networkMetrics
  }

  /**
   * 获取当前性能指标
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics }
  }
}

// 导出单例实例
export const architectureSelector = ArchitectureSelector.getInstance()
