/**
 * Matrix Call Quality Monitoring Service
 * 实时监控 WebRTC 通话质量和网络状态
 *
 * @module services/matrixCallQualityService
 */

import { logger } from '@/utils/logger'

/**
 * 网络质量等级
 */
export enum NetworkQuality {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  BAD = 'bad'
}

/**
 * 连接状态
 */
export enum ConnectionState {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed'
}

/**
 * 通话质量指标
 */
export interface CallQualityMetrics {
  /** 网络质量 */
  networkQuality: NetworkQuality
  /** 连接状态 */
  connectionState: ConnectionState
  /** 往返时延 */
  roundTripTime?: number
  /** 丢包率 */
  packetLoss?: number
  /** 抖动 */
  jitter?: number
  /** 带宽 */
  bandwidth?: {
    download?: number
    upload?: number
  }
  /** 音频级别 */
  audioLevel?: number
  /** 视频质量 */
  videoQuality?: {
    width?: number
    height?: number
    frameRate?: number
    bitrate?: number
  }
  /** 最后更新时间 */
  timestamp: number
}

/**
 * 质量统计
 */
export interface QualityStats {
  /** 平均 RTT */
  avgRtt: number
  /** 最小 RTT */
  minRtt: number
  /** 最大 RTT */
  maxRtt: number
  /** 平均丢包率 */
  avgPacketLoss: number
  /** 平均抖动 */
  avgJitter: number
  /** 质量变化次数 */
  qualityChanges: number
  /** 连接断开次数 */
  disconnections: number
  /** 监控开始时间 */
  startTime: number
}

/**
 * 质量变化事件
 */
export interface QualityChangeEvent {
  oldQuality: NetworkQuality
  newQuality: NetworkQuality
  metrics: CallQualityMetrics
  timestamp: number
}

/**
 * 配置选项
 */
export interface QualityMonitoringOptions {
  /** 统计收集间隔 */
  statsInterval?: number
  /** 质量计算样本数量 */
  sampleSize?: number
  /** 是否自动调整质量 */
  autoAdjust?: boolean
  /** 质量降级阈值 */
  degradationThreshold?: number
}

/**
 * Matrix Call Quality Service
 * 监控和管理通话质量
 */
export class MatrixCallQualityService {
  private static instance: MatrixCallQualityService

  // 当前监控的连接
  private connections: Map<string, RTCPeerConnection> = new Map()

  // 质量指标缓存
  private metricsCache: Map<string, CallQualityMetrics> = new Map()

  // 统计数据
  private statsCache: Map<string, QualityStats> = new Map()

  // 定时器
  private statsIntervals: Map<string, ReturnType<typeof setInterval>> = new Map()

  // 配置
  private config: Required<QualityMonitoringOptions> = {
    statsInterval: 1000,
    sampleSize: 10,
    autoAdjust: true,
    degradationThreshold: 5
  }

  // 事件监听器
  private listeners: Map<string, Array<(data: unknown) => void>> = new Map()

  private constructor() {}

  static getInstance(): MatrixCallQualityService {
    if (!MatrixCallQualityService.instance) {
      MatrixCallQualityService.instance = new MatrixCallQualityService()
    }
    return MatrixCallQualityService.instance
  }

  /**
   * 配置监控选项
   */
  configure(options: QualityMonitoringOptions): void {
    this.config = { ...this.config, ...options }
    logger.info('[MatrixCallQualityService] Configuration updated', this.config)
  }

  /**
   * 开始监控连接
   */
  async startMonitoring(callId: string, peerConnection: RTCPeerConnection): Promise<void> {
    if (this.connections.has(callId)) {
      logger.warn('[MatrixCallQualityService] Already monitoring call', { callId })
      return
    }

    logger.info('[MatrixCallQualityService] Starting monitoring', { callId })

    this.connections.set(callId, peerConnection)

    // 初始化统计
    this.statsCache.set(callId, {
      avgRtt: 0,
      minRtt: Infinity,
      maxRtt: 0,
      avgPacketLoss: 0,
      avgJitter: 0,
      qualityChanges: 0,
      disconnections: 0,
      startTime: Date.now()
    })

    // 监听连接状态
    peerConnection.addEventListener('iceconnectionstatechange', () => {
      this.handleConnectionStateChange(callId, peerConnection.iceConnectionState)
    })

    peerConnection.addEventListener('connectionstatechange', () => {
      this.handleConnectionStateChange(callId, peerConnection.connectionState)
    })

    // 启动统计收集
    this.startStatsCollection(callId, peerConnection)

    // 发送初始事件
    this.emit('monitoring_started', { callId })
  }

  /**
   * 停止监控
   */
  async stopMonitoring(callId: string): Promise<void> {
    logger.info('[MatrixCallQualityService] Stopping monitoring', { callId })

    // 清除定时器
    const interval = this.statsIntervals.get(callId)
    if (interval) {
      clearInterval(interval)
      this.statsIntervals.delete(callId)
    }

    // 获取最终统计
    const stats = this.statsCache.get(callId)
    if (stats) {
      this.emit('monitoring_ended', { callId, stats })
    }

    // 清理
    this.connections.delete(callId)
    this.metricsCache.delete(callId)
    this.statsCache.delete(callId)

    this.emit('monitoring_stopped', { callId })
  }

  /**
   * 获取当前质量指标
   */
  getMetrics(callId: string): CallQualityMetrics | null {
    return this.metricsCache.get(callId) || null
  }

  /**
   * 获取统计数据
   */
  getStats(callId: string): QualityStats | null {
    return this.statsCache.get(callId) || null
  }

  /**
   * 获取网络质量
   */
  getNetworkQuality(callId: string): NetworkQuality {
    const metrics = this.metricsCache.get(callId)
    return metrics?.networkQuality || NetworkQuality.BAD
  }

  /**
   * 开始统计收集
   */
  private startStatsCollection(callId: string, peerConnection: RTCPeerConnection): void {
    const interval = setInterval(async () => {
      try {
        const stats = await peerConnection.getStats()
        const metrics = this.processStats(stats)

        const oldMetrics = this.metricsCache.get(callId)
        const oldQuality = oldMetrics?.networkQuality

        this.metricsCache.set(callId, {
          ...metrics,
          timestamp: Date.now()
        })

        // 检查质量变化
        if (oldQuality && oldQuality !== metrics.networkQuality) {
          this.handleQualityChange(callId, oldQuality, metrics.networkQuality, metrics)
        }

        // 更新统计
        this.updateStats(callId, metrics)

        // 发送指标更新事件
        this.emit('metrics_updated', { callId, metrics })

        // 自动调整质量
        if (this.config.autoAdjust && metrics.networkQuality === NetworkQuality.POOR) {
          this.emit('quality_degradation', { callId, metrics })
        }
      } catch (error) {
        logger.error('[MatrixCallQualityService] Failed to collect stats', { callId, error })
      }
    }, this.config.statsInterval)

    this.statsIntervals.set(callId, interval)
  }

  /**
   * 处理统计数据
   */
  private processStats(stats: RTCStatsReport): CallQualityMetrics {
    let rtt = 0
    let packetLoss = 0
    let jitter = 0
    let audioLevel = 0
    let downloadBandwidth = 0
    let uploadBandwidth = 0
    let videoWidth = 0
    let videoHeight = 0
    let videoFrameRate = 0

    stats.forEach((report) => {
      // RTT (往返时延)
      if (report.type === 'remote-inbound-rtp' && 'roundTripTime' in report) {
        rtt = (report.roundTripTime as number) * 1000 // 转换为毫秒
      }

      // 丢包率
      if (report.type === 'inbound-rtp') {
        const packetsReceived = report.packetsReceived as number
        const packetsLost = report.packetsLost as number
        const total = packetsReceived + packetsLost
        if (total > 0) {
          packetLoss = (packetsLost / total) * 100
        }
      }

      // 抖动
      if (report.type === 'inbound-rtp' && 'jitter' in report) {
        jitter = report.jitter as number
      }

      // 音频级别
      if (report.type === 'media-source' && 'audioLevel' in report) {
        audioLevel = report.audioLevel as number
      }

      // 带宽
      if (report.type === 'outbound-rtp' && 'bytesSent' in report) {
        const bytesSent = report.bytesSent as number
        uploadBandwidth = bytesSent * 8 // 转换为 bps (简化计算)
      }

      if (report.type === 'inbound-rtp' && 'bytesReceived' in report) {
        const bytesReceived = report.bytesReceived as number
        downloadBandwidth = bytesReceived * 8
      }

      // 视频质量
      if (report.type === 'inbound-rtp' && 'mediaType' in report && report.mediaType === 'video') {
        if ('frameWidth' in report) videoWidth = report.frameWidth as number
        if ('frameHeight' in report) videoHeight = report.frameHeight as number
        if ('framesPerSecond' in report) videoFrameRate = report.framesPerSecond as number
      }
    })

    // 计算网络质量
    const networkQuality = this.calculateNetworkQuality(rtt, packetLoss, jitter)

    return {
      networkQuality,
      connectionState: ConnectionState.CONNECTED,
      roundTripTime: rtt || undefined,
      packetLoss: packetLoss || undefined,
      jitter: jitter || undefined,
      bandwidth: {
        download: downloadBandwidth || undefined,
        upload: uploadBandwidth || undefined
      },
      audioLevel: audioLevel || undefined,
      videoQuality: {
        width: videoWidth || undefined,
        height: videoHeight || undefined,
        frameRate: videoFrameRate || undefined
      },
      timestamp: Date.now()
    }
  }

  /**
   * 计算网络质量
   */
  private calculateNetworkQuality(rtt: number, packetLoss: number, jitter: number): NetworkQuality {
    // RTT 评分
    let rttScore = 100
    if (rtt > 500) rttScore -= 50
    else if (rtt > 300) rttScore -= 30
    else if (rtt > 150) rttScore -= 15
    else if (rtt > 100) rttScore -= 5

    // 丢包率评分
    let lossScore = 100
    if (packetLoss > 10) lossScore -= 50
    else if (packetLoss > 5) lossScore -= 30
    else if (packetLoss > 2) lossScore -= 15
    else if (packetLoss > 1) lossScore -= 5

    // 抖动评分
    let jitterScore = 100
    if (jitter > 100) jitterScore -= 50
    else if (jitter > 50) jitterScore -= 30
    else if (jitter > 30) jitterScore -= 15
    else if (jitter > 10) jitterScore -= 5

    // 综合评分
    const totalScore = (rttScore + lossScore + jitterScore) / 3

    if (totalScore >= 90) return NetworkQuality.EXCELLENT
    if (totalScore >= 70) return NetworkQuality.GOOD
    if (totalScore >= 50) return NetworkQuality.FAIR
    if (totalScore >= 30) return NetworkQuality.POOR
    return NetworkQuality.BAD
  }

  /**
   * 更新统计
   */
  private updateStats(callId: string, metrics: CallQualityMetrics): void {
    const stats = this.statsCache.get(callId)
    if (!stats) return

    // 更新 RTT
    if (metrics.roundTripTime) {
      stats.avgRtt = (stats.avgRtt + metrics.roundTripTime) / 2
      stats.minRtt = Math.min(stats.minRtt, metrics.roundTripTime)
      stats.maxRtt = Math.max(stats.maxRtt, metrics.roundTripTime)
    }

    // 更新丢包率
    if (metrics.packetLoss !== undefined) {
      stats.avgPacketLoss = (stats.avgPacketLoss + metrics.packetLoss) / 2
    }

    // 更新抖动
    if (metrics.jitter !== undefined) {
      stats.avgJitter = (stats.avgJitter + metrics.jitter) / 2
    }
  }

  /**
   * 处理质量变化
   */
  private handleQualityChange(
    callId: string,
    oldQuality: NetworkQuality,
    newQuality: NetworkQuality,
    metrics: CallQualityMetrics
  ): void {
    const stats = this.statsCache.get(callId)
    if (stats) {
      stats.qualityChanges++
    }

    const event: QualityChangeEvent = {
      oldQuality,
      newQuality,
      metrics,
      timestamp: Date.now()
    }

    this.emit('quality_changed', { callId, event })

    logger.info('[MatrixCallQualityService] Quality changed', {
      callId,
      from: oldQuality,
      to: newQuality
    })
  }

  /**
   * 处理连接状态变化
   */
  private handleConnectionStateChange(callId: string, state: string): void {
    const stats = this.statsCache.get(callId)
    let connectionState: ConnectionState

    switch (state) {
      case 'connected':
      case 'completed':
        connectionState = ConnectionState.CONNECTED
        break
      case 'disconnected':
      case 'closed':
        connectionState = ConnectionState.DISCONNECTED
        if (stats) stats.disconnections++
        break
      case 'new':
      case 'checking':
      case 'connecting':
        connectionState = ConnectionState.RECONNECTING
        break
      case 'failed':
        connectionState = ConnectionState.FAILED
        break
      default:
        connectionState = ConnectionState.DISCONNECTED
    }

    // 更新指标
    const metrics = this.metricsCache.get(callId)
    if (metrics) {
      metrics.connectionState = connectionState
    }

    this.emit('connection_state_changed', { callId, state: connectionState })
  }

  /**
   * 添加事件监听器
   */
  on(event: string, listener: (data: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  /**
   * 移除事件监听器
   */
  off(event: string, listener: (data: unknown) => void): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index !== -1) {
        listeners.splice(index, 1)
      }
    }
  }

  /**
   * 发送事件
   */
  private emit(event: string, data: unknown): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data)
        } catch (error) {
          logger.error('[MatrixCallQualityService] Event listener error', { event, error })
        }
      })
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    // 停止所有监控
    this.connections.forEach((_, callId) => {
      this.stopMonitoring(callId)
    })

    // 清除定时器
    this.statsIntervals.forEach((interval) => {
      clearInterval(interval)
    })
    this.statsIntervals.clear()

    // 清理监听器
    this.listeners.clear()

    logger.info('[MatrixCallQualityService] Disposed')
  }
}

// 导出单例实例
export const matrixCallQualityService = MatrixCallQualityService.getInstance()

// 导出便捷函数
export async function startCallQualityMonitoring(callId: string, peerConnection: RTCPeerConnection): Promise<void> {
  return matrixCallQualityService.startMonitoring(callId, peerConnection)
}

export async function stopCallQualityMonitoring(callId: string): Promise<void> {
  return matrixCallQualityService.stopMonitoring(callId)
}

export function getCallQualityMetrics(callId: string): CallQualityMetrics | null {
  return matrixCallQualityService.getMetrics(callId)
}

export function getNetworkQuality(callId: string): NetworkQuality {
  return matrixCallQualityService.getNetworkQuality(callId)
}
