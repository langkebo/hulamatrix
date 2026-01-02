/**
 * 架构相关类型定义
 */

import type { ArchitectureMode } from '@/adapters/architecture-manager'

export type { ArchitectureMode, FeatureContext, ImplementationResult } from '@/adapters/architecture-manager'

/**
 * 服务实现接口
 */
export interface ServiceImplementation {
  name: string
  mode: ArchitectureMode
  isAvailable: boolean
  healthStatus: 'healthy' | 'degraded' | 'unhealthy'
}

/**
 * 迁移状态
 */
export interface MigrationState {
  feature: string
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'rolled-back'
  progress: number // 0-100
  startTime: Date
  endTime?: Date
  error?: string
}

/**
 * 架构统计信息
 */
export interface ArchitectureStats {
  discoveryUsage: number
  websocketUsage: number
  hybridUsage: number
  migrationProgress: Record<string, MigrationState>
  lastHealthCheck: Date
}
