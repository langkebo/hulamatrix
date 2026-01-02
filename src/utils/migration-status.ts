/**
 * Phase 1 Migration Status Monitor
 * 监控从自定义WebSocket到Matrix标准协议的迁移状态
 */

import { logger } from '@/utils/logger'

export interface MigrationPhase {
  name: string
  description: string
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
  progress: number // 0-100
  features: string[]
  startedAt?: Date
  completedAt?: Date
  error?: string
}

export interface MigrationConfig {
  disableWebSocket: boolean
  migrateMessaging: boolean
  matrixEnabled: boolean
  matrixRoomsEnabled: boolean
  matrixMediaEnabled: boolean
  matrixRtcEnabled: boolean
  matrixE2EEEnabled: boolean
}

/**
 * 迁移状态监控器
 */
export class MigrationStatusMonitor {
  private static instance: MigrationStatusMonitor
  private phases: Map<string, MigrationPhase> = new Map()
  private config: MigrationConfig

  private constructor() {
    this.config = this.loadConfig()
    this.initializePhases()
  }

  public static getInstance(): MigrationStatusMonitor {
    if (!MigrationStatusMonitor.instance) {
      MigrationStatusMonitor.instance = new MigrationStatusMonitor()
    }
    return MigrationStatusMonitor.instance
  }

  /**
   * 加载迁移配置
   */
  private loadConfig(): MigrationConfig {
    const env = import.meta.env as Record<string, string | undefined>

    return {
      disableWebSocket: env.VITE_DISABLE_WEBSOCKET === 'true',
      migrateMessaging: env.VITE_MIGRATE_MESSAGING === 'true',
      matrixEnabled: env.VITE_MATRIX_ENABLED === 'on',
      matrixRoomsEnabled: env.VITE_MATRIX_ROOMS_ENABLED === 'on',
      matrixMediaEnabled: env.VITE_MATRIX_MEDIA_ENABLED === 'on',
      matrixRtcEnabled: env.VITE_MATRIX_RTC_ENABLED === 'on',
      matrixE2EEEnabled: env.VITE_MATRIX_E2EE_ENABLED === 'on'
    }
  }

  /**
   * 初始化迁移阶段
   */
  private initializePhases(): void {
    this.phases.set('phase1', {
      name: 'Phase 1: Core Migration',
      description: '迁移核心功能到Matrix标准协议',
      status: this.config.disableWebSocket ? 'in-progress' : 'pending',
      progress: this.calculatePhase1Progress(),
      features: [
        'Message sending/receiving via Matrix',
        'Room management via Matrix',
        'User authentication via Matrix',
        'Media upload via Matrix',
        'RTC signaling via Matrix'
      ],
      startedAt: this.config.disableWebSocket ? new Date() : undefined
    })

    this.phases.set('phase2', {
      name: 'Phase 2: Advanced Features',
      description: '迁移高级功能',
      status: 'pending',
      progress: 0,
      features: ['E2E encryption', 'Advanced room settings', 'Admin features']
    })

    this.phases.set('phase3', {
      name: 'Phase 3: Cleanup',
      description: '移除自定义WebSocket代码',
      status: 'pending',
      progress: 0,
      features: ['Remove Rust WebSocket client', 'Remove custom WebSocket services', 'Update documentation']
    })
  }

  /**
   * 计算Phase 1进度
   */
  private calculatePhase1Progress(): number {
    if (!this.config.matrixEnabled) return 0

    let progress = 0
    const totalFeatures = 5

    if (this.config.matrixRoomsEnabled) progress += 1 // 消息和房间
    if (this.config.migrateMessaging) progress += 1 // 消息迁移
    if (this.config.matrixMediaEnabled) progress += 1 // 媒体上传
    if (this.config.matrixRtcEnabled) progress += 1 // RTC通话
    if (this.config.disableWebSocket) progress += 1 // WebSocket已禁用

    return Math.round((progress / totalFeatures) * 100)
  }

  /**
   * 获取迁移配置
   */
  public getConfig(): MigrationConfig {
    return { ...this.config }
  }

  /**
   * 获取所有阶段
   */
  public getPhases(): Map<string, MigrationPhase> {
    return new Map(this.phases)
  }

  /**
   * 获取指定阶段
   */
  public getPhase(phaseKey: string): MigrationPhase | undefined {
    return this.phases.get(phaseKey)
  }

  /**
   * 更新阶段状态
   */
  public updatePhase(
    phaseKey: string,
    updates: Partial<Omit<MigrationPhase, 'name' | 'description' | 'features'>>
  ): void {
    const phase = this.phases.get(phaseKey)
    if (phase) {
      this.phases.set(phaseKey, { ...phase, ...updates })
      logger.info(`Migration phase ${phaseKey} updated:`, updates)
    }
  }

  /**
   * 检查是否使用Matrix协议
   */
  public isUsingMatrix(): boolean {
    return this.config.matrixEnabled && this.config.disableWebSocket
  }

  /**
   * 获取迁移摘要
   */
  public getSummary(): {
    currentPhase: string
    overallProgress: number
    matrixEnabled: boolean
    websocketDisabled: boolean
    status: 'migration' | 'matrix-only' | 'hybrid' | 'legacy'
  } {
    const phase1 = this.phases.get('phase1')
    const overallProgress = phase1 ? phase1.progress : 0

    let status: 'migration' | 'matrix-only' | 'hybrid' | 'legacy' = 'legacy'

    if (this.config.matrixEnabled && this.config.disableWebSocket) {
      status = overallProgress >= 100 ? 'matrix-only' : 'migration'
    } else if (this.config.matrixEnabled && !this.config.disableWebSocket) {
      status = 'hybrid'
    }

    return {
      currentPhase: 'phase1',
      overallProgress,
      matrixEnabled: this.config.matrixEnabled,
      websocketDisabled: this.config.disableWebSocket,
      status
    }
  }

  /**
   * 记录迁移事件
   */
  public logMigrationEvent(event: string, data?: Record<string, unknown>): void {
    logger.info(`[Migration Monitor] ${event}`, data || {})
  }

  /**
   * 检查功能是否已迁移到Matrix
   */
  public isFeatureMigrated(feature: string): boolean {
    if (!this.config.disableWebSocket) return false

    const migratedFeatures: Record<string, boolean> = {
      messaging: this.config.migrateMessaging && this.config.matrixRoomsEnabled,
      rooms: this.config.matrixRoomsEnabled,
      media: this.config.matrixMediaEnabled,
      rtc: this.config.matrixRtcEnabled,
      e2ee: this.config.matrixE2EEEnabled,
      auth: this.config.matrixEnabled
    }

    return migratedFeatures[feature] || false
  }

  /**
   * 获取迁移状态报告
   */
  public getStatusReport(): {
    config: MigrationConfig
    summary: ReturnType<MigrationStatusMonitor['getSummary']>
    phases: Record<string, MigrationPhase>
    recommendations: string[]
  } {
    const summary = this.getSummary()
    const phases: Record<string, MigrationPhase> = {}
    this.phases.forEach((phase, key) => {
      phases[key] = phase
    })

    const recommendations: string[] = []

    if (summary.status === 'migration') {
      recommendations.push('Continue monitoring Phase 1 migration')
      if (!this.config.matrixMediaEnabled) {
        recommendations.push('Enable VITE_MATRIX_MEDIA_ENABLED for media upload')
      }
      if (!this.config.matrixRtcEnabled) {
        recommendations.push('Enable VITE_MATRIX_RTC_ENABLED for video calls')
      }
    } else if (summary.status === 'matrix-only') {
      recommendations.push('Phase 1 completed! Ready to start Phase 2')
      recommendations.push('Consider removing WebSocket Rust code')
    } else if (summary.status === 'hybrid') {
      recommendations.push('Set VITE_DISABLE_WEBSOCKET=true to start migration')
    } else {
      recommendations.push('Enable VITE_MATRIX_ENABLED=on to start migration')
    }

    return {
      config: this.config,
      summary,
      phases,
      recommendations
    }
  }
}

// 导出单例
export const migrationMonitor = MigrationStatusMonitor.getInstance()

/**
 * 便捷方法：检查是否在迁移模式
 */
export const isInMigrationMode = (): boolean => {
  return migrationMonitor.getSummary().status === 'migration'
}

/**
 * 便捷方法：检查是否使用Matrix协议
 */
export const isUsingMatrixProtocol = (): boolean => {
  return migrationMonitor.isUsingMatrix()
}

/**
 * 便捷方法：检查WebSocket是否禁用
 */
export const isWebSocketDisabled = (): boolean => {
  return migrationMonitor.getConfig().disableWebSocket
}
