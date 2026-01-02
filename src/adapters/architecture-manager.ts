/**
 * 架构管理器
 * 负责管理双重架构，智能选择实现方式
 */

import { matrixDiscovery } from '@/services/matrix-discovery'
import { matrixConfig } from '@/config/matrix-config'

export type ArchitectureMode = 'discovery' | 'websocket' | 'hybrid'

export interface FeatureContext {
  networkCondition?: 'good' | 'poor'
  messageType?: 'text' | 'file' | 'image' | 'encrypted'
  fileSize?: number
  priority?: 'low' | 'normal' | 'high'
  realtimeRequired?: boolean
}

export interface ImplementationResult {
  mode: ArchitectureMode
  reason: string
  fallback?: ArchitectureMode | undefined
}

/**
 * 架构管理器
 * 根据功能特性和上下文自动选择最优实现
 */
export class ArchitectureManager {
  private static instance: ArchitectureManager
  private currentMode: ArchitectureMode = 'hybrid'
  private featureRules: Map<string, (context: FeatureContext) => ArchitectureMode> = new Map()

  private constructor() {
    this.initializeRules()
  }

  public static getInstance(): ArchitectureManager {
    if (!ArchitectureManager.instance) {
      ArchitectureManager.instance = new ArchitectureManager()
    }
    return ArchitectureManager.instance
  }

  /**
   * 初始化功能规则
   */
  private initializeRules(): void {
    this.featureRules.set('user-auth', () => 'discovery')
    this.featureRules.set('room-management', () => 'discovery')
    this.featureRules.set('real-time-sync', () => 'websocket')
    this.featureRules.set('large-file-transfer', () => 'websocket')
    this.featureRules.set('messaging', (context) => this.selectMessagingMode(context))
    this.featureRules.set('file-sync', (context) => this.selectFileSyncMode(context))
    this.featureRules.set('rtc-calls', () => 'websocket')
  }

  /**
   * 根据功能和上下文选择实现
   */
  public selectImplementation(feature: string, context: FeatureContext = {}): ImplementationResult {
    const rule = this.featureRules.get(feature)
    const mode = rule ? rule(context) : this.defaultSelection(context)

    return {
      mode,
      reason: this.getSelectionReason(feature, mode, context),
      fallback: mode !== 'hybrid' ? 'hybrid' : undefined
    }
  }

  /**
   * 获取当前架构模式
   */
  public getCurrentMode(): ArchitectureMode {
    return this.currentMode
  }

  /**
   * 设置架构模式
   */
  public setMode(mode: ArchitectureMode): void {
    this.currentMode = mode
  }

  /**
   * 智能选择消息模式
   */
  private selectMessagingMode(context: FeatureContext): ArchitectureMode {
    // 网络状况不佳时使用WebSocket
    if (context.networkCondition === 'poor') {
      return 'websocket'
    }

    // 加密消息使用Matrix SDK
    if (context.messageType === 'encrypted') {
      return 'discovery'
    }

    // 大文件使用WebSocket
    if (context.fileSize && context.fileSize > 10 * 1024 * 1024) {
      return 'websocket'
    }

    // 高优先级消息使用混合模式确保送达
    if (context.priority === 'high') {
      return 'hybrid'
    }

    // 默认使用混合模式
    return 'hybrid'
  }

  /**
   * 智能选择文件同步模式
   */
  private selectFileSyncMode(context: FeatureContext): ArchitectureMode {
    // 大文件使用WebSocket
    if (context.fileSize && context.fileSize > 50 * 1024 * 1024) {
      return 'websocket'
    }

    // 网络不佳时使用WebSocket
    if (context.networkCondition === 'poor') {
      return 'websocket'
    }

    // 其他情况使用混合模式
    return 'hybrid'
  }

  /**
   * 默认选择逻辑
   */
  private defaultSelection(context: FeatureContext): ArchitectureMode {
    // 根据当前模式和上下文决定
    if (this.currentMode !== 'hybrid') {
      return this.currentMode
    }

    // 优先使用发现机制
    return context.realtimeRequired ? 'websocket' : 'discovery'
  }

  /**
   * 获取选择原因
   */
  private getSelectionReason(_feature: string, mode: ArchitectureMode, context: FeatureContext): string {
    const reasons = {
      discovery: '使用Matrix SDK发现机制',
      websocket: '使用WebSocket实现（性能/兼容性）',
      hybrid: '使用混合模式（可靠性优先）'
    }

    let reason = reasons[mode] || '默认选择'

    // 添加具体原因
    if (context.networkCondition === 'poor') {
      reason += ' - 网络状况不佳'
    }
    if (context.messageType === 'encrypted') {
      reason += ' - 消息加密需求'
    }
    if (context.fileSize && context.fileSize > 10 * 1024 * 1024) {
      reason += ' - 大文件传输'
    }

    return reason
  }

  /**
   * 检查功能是否就绪
   */
  public isFeatureReady(feature: string): boolean {
    // 检查发现机制是否就绪
    if (this.requiresDiscovery(feature)) {
      try {
        matrixConfig.getCurrentDiscovery()
        return true
      } catch {
        return false
      }
    }

    return true
  }

  /**
   * 检查功能是否需要发现机制
   */
  private requiresDiscovery(feature: string): boolean {
    const discoveryFeatures = ['user-auth', 'room-management']
    return discoveryFeatures.includes(feature)
  }

  /**
   * 运行时健康检查
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, unknown>
  }> {
    const details: Record<string, unknown> = {}

    try {
      // 检查发现机制
      const discovery = await matrixDiscovery.discoverDefaultServer()
      details.discovery = {
        status: 'ok',
        homeserverUrl: discovery.homeserverUrl
      }
    } catch (error) {
      details.discovery = {
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      }
    }

    // 检查WebSocket连接
    details.websocket = {
      status: 'unknown', // 需要实际检查
      message: '待实现'
    }

    // 综合评估
    const discoveryDetails = details.discovery as { status?: string } | undefined
    const hasDiscoveryError = discoveryDetails?.status === 'error'
    const status = hasDiscoveryError ? 'degraded' : 'healthy'

    return { status, details }
  }
}

// 导出单例实例
export const architectureManager = ArchitectureManager.getInstance()
