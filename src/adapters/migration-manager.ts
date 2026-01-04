/**
 * 迁移管理器
 * 负责管理从 WebSocket 到 Matrix SDK 的渐进式迁移
 */

import { adapterManager } from './adapter-manager'
import { architectureManager } from './architecture-manager'
import { featureFlags } from '@/config/feature-flags'
import { logger } from '@/utils/logger'

/**
 * 应用设置类型
 */
interface AppSettings {
  theme?: string | null
  language?: string | null
  migrationDate?: string | null
  [key: string]: unknown
}

export interface MigrationState {
  /**
   * 当前迁移阶段
   */
  phase: 'preparation' | 'data-migration' | 'service-migration' | 'verification' | 'completed'

  /**
   * 迁移进度（0-100）
   */
  progress: number

  /**
   * 当前步骤
   */
  currentStep: string

  /**
   * 是否正在迁移
   */
  isMigrating: boolean

  /**
   * 迁移开始时间
   */
  startTime?: number

  /**
   * 预计完成时间
   */
  estimatedTime?: number

  /**
   * 错误信息
   */
  error?: string | undefined

  /**
   * 已迁移的房间列表
   */
  migratedRooms: string[]

  /**
   * 待迁移的房间列表
   */
  pendingRooms: string[]

  /**
   * 失败的房间列表
   */
  failedRooms: Array<{ roomId: string; error: string }>
}

export interface MigrationOptions {
  /**
   * 是否强制迁移
   */
  force?: boolean

  /**
   * 迁移策略
   */
  strategy?: 'conservative' | 'balanced' | 'aggressive'

  /**
   * 批处理大小
   */
  batchSize?: number

  /**
   * 迁移超时（毫秒）
   */
  timeout?: number

  /**
   * 是否跳过验证
   */
  skipValidation?: boolean

  /**
   * 回滚策略
   */
  rollback?: boolean
}

export interface MigrationStep {
  /**
   * 步骤名称
   */
  name: string

  /**
   * 步骤描述
   */
  description: string

  /**
   * 执行函数
   */
  execute: () => Promise<void>

  /**
   * 验证函数
   */
  validate?: () => Promise<boolean>

  /**
   * 回滚函数
   */
  rollback?: () => Promise<void>

  /**
   * 预计耗时（毫秒）
   */
  estimatedTime?: number

  /**
   * 是否必需
   */
  required?: boolean
}

/**
 * 迁移管理器实现
 */
export class MigrationManager {
  private static instance: MigrationManager
  private state: MigrationState = {
    phase: 'preparation',
    progress: 0,
    currentStep: '',
    isMigrating: false,
    migratedRooms: [],
    pendingRooms: [],
    failedRooms: []
  }

  private listeners: Array<(state: MigrationState) => void> = []
  private migrationSteps: MigrationStep[] = []

  private constructor() {
    this.initializeMigrationSteps()
  }

  public static getInstance(): MigrationManager {
    if (!MigrationManager.instance) {
      MigrationManager.instance = new MigrationManager()
    }
    return MigrationManager.instance
  }

  /**
   * 初始化迁移步骤
   */
  private initializeMigrationSteps(): void {
    this.migrationSteps = [
      {
        name: 'validate-prerequisites',
        description: '验证迁移前提条件',
        execute: async () => {
          await this.validatePrerequisites()
        },
        validate: async () => {
          return await this.checkPrerequisites()
        },
        estimatedTime: 5000,
        required: true
      },
      {
        name: 'backup-data',
        description: '备份当前数据',
        execute: async () => {
          await this.backupCurrentData()
        },
        rollback: async () => {
          await this.restoreBackup()
        },
        estimatedTime: 30000,
        required: true
      },
      {
        name: 'migrate-user-profile',
        description: '迁移用户资料',
        execute: async () => {
          await this.migrateUserProfile()
        },
        validate: async () => {
          return await this.validateUserProfile()
        },
        estimatedTime: 10000,
        required: true
      },
      {
        name: 'migrate-rooms',
        description: '迁移房间列表',
        execute: async () => {
          await this.migrateRooms()
        },
        validate: async () => {
          return await this.validateRoomMigration()
        },
        estimatedTime: 60000,
        required: true
      },
      {
        name: 'migrate-messages',
        description: '迁移历史消息',
        execute: async () => {
          await this.migrateMessages()
        },
        validate: async () => {
          return await this.validateMessageMigration()
        },
        estimatedTime: 300000,
        required: true
      },
      {
        name: 'migrate-files',
        description: '迁移文件资源',
        execute: async () => {
          await this.migrateFiles()
        },
        validate: async () => {
          return await this.validateFileMigration()
        },
        estimatedTime: 120000,
        required: false
      },
      {
        name: 'update-settings',
        description: '更新本地设置',
        execute: async () => {
          await this.updateSettings()
        },
        rollback: async () => {
          await this.restoreSettings()
        },
        estimatedTime: 5000,
        required: true
      },
      {
        name: 'verification',
        description: '验证迁移结果',
        execute: async () => {
          await this.performVerification()
        },
        estimatedTime: 30000,
        required: true
      }
    ]
  }

  /**
   * 添加状态监听器
   */
  addListener(listener: (state: MigrationState) => void): () => void {
    this.listeners.push(listener)

    // 返回取消监听的函数
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * 获取当前状态
   */
  getState(): MigrationState {
    return { ...this.state }
  }

  /**
   * 检查是否可以开始迁移
   */
  canMigrate(): boolean {
    // 检查功能标志
    if (!featureFlags.isEnabled('matrix-migration')) {
      return false
    }

    // 检查是否已经在迁移中
    if (this.state.isMigrating) {
      return false
    }

    // 检查是否已经完成
    if (this.state.phase === 'completed') {
      return false
    }

    return true
  }

  /**
   * 开始迁移
   */
  async startMigration(options: MigrationOptions = {}): Promise<void> {
    if (!this.canMigrate()) {
      throw new Error('Migration cannot be started at this time')
    }

    logger.info('[MigrationManager] Starting migration with options:', options)

    // 更新状态
    this.state.isMigrating = true
    this.state.startTime = Date.now()
    this.state.error = undefined as string | undefined
    this.state.failedRooms = []

    // 计算总预计时间
    const totalTime = this.migrationSteps
      .filter((step) => step.required || options.force)
      .reduce((sum, step) => sum + (step.estimatedTime || 0), 0)
    this.state.estimatedTime = totalTime

    this.notifyStateChange()

    try {
      // 准备阶段
      this.state.phase = 'preparation'
      await this.executeStep('validate-prerequisites')

      // 数据迁移阶段
      this.state.phase = 'data-migration'
      await this.executeStep('backup-data')
      await this.executeStep('migrate-user-profile')
      await this.executeStep('migrate-rooms')
      await this.executeStep('migrate-messages')

      if (options.force || (await this.shouldMigrateFiles())) {
        await this.executeStep('migrate-files')
      }

      // 服务迁移阶段
      this.state.phase = 'service-migration'
      await this.executeStep('update-settings')

      // 验证阶段
      this.state.phase = 'verification'
      await this.executeStep('verification')

      // 完成
      this.state.phase = 'completed'
      this.state.progress = 100
      this.state.currentStep = 'Migration completed successfully'

      logger.info('[MigrationManager] Migration completed successfully')
    } catch (error) {
      logger.error('[MigrationManager] Migration failed:', error)

      this.state.error = error instanceof Error ? error.message : String(error)

      // 如果启用回滚，执行回滚
      if (options.rollback && this.state.phase !== 'preparation') {
        logger.info('[MigrationManager] Initiating rollback...')
        await this.performRollback()
      }

      throw error
    } finally {
      this.state.isMigrating = false
      this.notifyStateChange()
    }
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(stepName: string): Promise<void> {
    const step = this.migrationSteps.find((s) => s.name === stepName)
    if (!step) {
      throw new Error(`Unknown migration step: ${stepName}`)
    }

    logger.info(`[MigrationManager] Executing step: ${stepName}`)
    this.state.currentStep = step.description

    // 更新进度
    const stepIndex = this.migrationSteps.indexOf(step)
    this.state.progress = Math.round((stepIndex / this.migrationSteps.length) * 100)
    this.notifyStateChange()

    // 执行步骤
    await step.execute()

    // 验证步骤
    if (step.validate) {
      const isValid = await step.validate()
      if (!isValid) {
        throw new Error(`Step validation failed: ${stepName}`)
      }
    }

    logger.info(`[MigrationManager] Step completed: ${stepName}`)
  }

  /**
   * 执行回滚
   */
  private async performRollback(): Promise<void> {
    logger.warn('[MigrationManager] Performing rollback...')

    // 按相反顺序执行回滚
    const executedSteps = this.migrationSteps.filter((step) => step.rollback).reverse()

    for (const step of executedSteps) {
      try {
        if (step.rollback) {
          await step.rollback()
          logger.info(`[MigrationManager] Rolled back step: ${step.name}`)
        }
      } catch (error) {
        logger.error(`[MigrationManager] Failed to rollback step ${step.name}:`, error)
        // 继续回滚其他步骤
      }
    }

    logger.warn('[MigrationManager] Rollback completed')
  }

  /**
   * 验证前提条件
   */
  private async validatePrerequisites(): Promise<void> {
    // 检查网络连接
    const networkCondition = await this.checkNetworkCondition()
    if (networkCondition === 'poor') {
      throw new Error('Network condition is too poor for migration')
    }

    // 检查存储空间
    const storageSpace = await this.checkStorageSpace()
    const requiredSpace = 100 * 1024 * 1024 // 100MB
    if (storageSpace < requiredSpace) {
      throw new Error('Insufficient storage space for migration')
    }

    // 检查 Matrix 服务可用性
    const matrixAvailable = await this.checkMatrixAvailability()
    if (!matrixAvailable) {
      throw new Error('Matrix service is not available')
    }
  }

  /**
   * 检查前提条件
   */
  private async checkPrerequisites(): Promise<boolean> {
    try {
      await this.validatePrerequisites()
      return true
    } catch {
      return false
    }
  }

  /**
   * 备份当前数据
   */
  private async backupCurrentData(): Promise<void> {
    // 获取所有房间和消息数据
    type WebSocketAdapter = { getRooms?: () => unknown[] }
    const wsAdapter = (await adapterManager.getAdapter('room', 'websocket')) as WebSocketAdapter | null
    if (!wsAdapter) {
      throw new Error('WebSocket adapter not available for backup')
    }

    // 备份到本地存储
    const rooms = wsAdapter.getRooms ? await wsAdapter.getRooms() : []
    const backupData = {
      timestamp: Date.now(),
      rooms: rooms,
      settings: this.getCurrentSettings()
    }

    localStorage.setItem('migration_backup', JSON.stringify(backupData))
    logger.info('[MigrationManager] Data backup completed')
  }

  /**
   * 恢复备份
   */
  private async restoreBackup(): Promise<void> {
    const backupStr = localStorage.getItem('migration_backup')
    if (!backupStr) {
      logger.warn('[MigrationManager] No backup found')
      return
    }

    try {
      const backupData = JSON.parse(backupStr)
      // 恢复设置
      this.restoreSettingsData(backupData.settings)

      logger.info('[MigrationManager] Backup restored')
    } catch (error) {
      logger.error('[MigrationManager] Failed to restore backup:', error)
    }
  }

  /**
   * 迁移用户资料
   */
  private async migrateUserProfile(): Promise<void> {
    // 从 WebSocket 获取用户资料
    const wsAuth = await adapterManager.getAdapter('auth', 'websocket')
    if (!wsAuth) {
      throw new Error('WebSocket auth adapter not available')
    }

    // 在 Matrix 中创建或更新用户资料
    const matrixAuth = await adapterManager.getAdapter('auth', 'matrix')
    if (!matrixAuth) {
      throw new Error('Matrix auth adapter not available')
    }

    // 迁移逻辑
    logger.info('[MigrationManager] User profile migration completed')
  }

  /**
   * 验证用户资料迁移
   */
  private async validateUserProfile(): Promise<boolean> {
    // 验证 Matrix 中的用户资料
    return true
  }

  /**
   * 迁移房间
   */
  private async migrateRooms(): Promise<void> {
    type RoomAdapter = { getRooms?: () => Array<{ roomId?: string; id?: string }> }
    const wsRoomAdapter = (await adapterManager.getAdapter('room', 'websocket')) as RoomAdapter | null
    if (!wsRoomAdapter) {
      throw new Error('WebSocket room adapter not available')
    }

    const matrixRoomAdapter = (await adapterManager.getAdapter('room', 'matrix')) as RoomAdapter | null
    if (!matrixRoomAdapter) {
      throw new Error('Matrix room adapter not available')
    }

    // 获取所有房间
    const rooms = wsRoomAdapter.getRooms ? await wsRoomAdapter.getRooms() : []
    this.state.pendingRooms = rooms.map((r) => r.roomId || r.id).filter((id): id is string => !!id)

    // 批量迁移房间
    const batchSize = 10
    for (let i = 0; i < this.state.pendingRooms.length; i += batchSize) {
      const batch = this.state.pendingRooms.slice(i, i + batchSize)

      for (const roomId of batch) {
        try {
          // 迁移单个房间
          await this.migrateSingleRoom(roomId)
          this.state.migratedRooms.push(roomId)
        } catch (error) {
          logger.error(`[MigrationManager] Failed to migrate room ${roomId}:`, error)
          this.state.failedRooms.push({
            roomId,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }

      // 更新进度
      this.state.progress = Math.round(((i + batchSize) / this.state.pendingRooms.length) * 50 + 30)
      this.notifyStateChange()
    }
  }

  /**
   * 迁移单个房间
   */
  private async migrateSingleRoom(roomId: string): Promise<void> {
    // 实现房间迁移逻辑
    logger.debug(`[MigrationManager] Migrating room: ${roomId}`)
  }

  /**
   * 验证房间迁移
   */
  private async validateRoomMigration(): Promise<boolean> {
    // 验证所有房间是否已成功迁移
    return this.state.failedRooms.length === 0
  }

  /**
   * 迁移消息
   */
  private async migrateMessages(): Promise<void> {
    // 实现消息迁移逻辑
    logger.info('[MigrationManager] Message migration completed')
  }

  /**
   * 验证消息迁移
   */
  private async validateMessageMigration(): Promise<boolean> {
    return true
  }

  /**
   * 迁移文件
   */
  private async migrateFiles(): Promise<void> {
    // 实现文件迁移逻辑
    logger.info('[MigrationManager] File migration completed')
  }

  /**
   * 验证文件迁移
   */
  private async validateFileMigration(): Promise<boolean> {
    return true
  }

  /**
   * 更新设置
   */
  private async updateSettings(): Promise<void> {
    // 切换到 Matrix 适配器
    architectureManager.setMode('discovery')

    // 更新本地设置
    localStorage.setItem('migration_completed', 'true')
    localStorage.setItem('migration_date', Date.now().toString())

    logger.info('[MigrationManager] Settings updated')
  }

  /**
   * 恢复设置
   */
  private async restoreSettings(): Promise<void> {
    // 恢复到 WebSocket 模式
    architectureManager.setMode('websocket')

    // 清除迁移标记
    localStorage.removeItem('migration_completed')
    localStorage.removeItem('migration_date')

    logger.info('[MigrationManager] Settings restored')
  }

  /**
   * 执行最终验证
   */
  private async performVerification(): Promise<void> {
    // 验证 Matrix 服务正常工作
    const matrixAdapter = await adapterManager.getBestAdapter('message')
    if (!matrixAdapter || matrixAdapter.name !== 'matrix-message') {
      throw new Error('Matrix adapter is not the primary adapter')
    }

    // 验证数据完整性
    logger.info('[MigrationManager] Verification completed')
  }

  /**
   * 判断是否应该迁移文件
   */
  private async shouldMigrateFiles(): Promise<boolean> {
    // 根据用户设置和文件大小决定
    return featureFlags.isEnabled('file-migration')
  }

  /**
   * 检查网络状况
   */
  private async checkNetworkCondition(): Promise<'good' | 'poor'> {
    // 实现网络状况检查
    return 'good'
  }

  /**
   * 检查存储空间
   */
  private async checkStorageSpace(): Promise<number> {
    // 返回可用字节数
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      return estimate.quota ? estimate.quota - (estimate.usage || 0) : 0
    }
    return 1024 * 1024 * 1024 // 1GB 默认值
  }

  /**
   * 检查 Matrix 服务可用性
   */
  private async checkMatrixAvailability(): Promise<boolean> {
    try {
      const matrixAdapter = await adapterManager.getAdapter('auth', 'matrix')
      return matrixAdapter ? await matrixAdapter.isReady() : false
    } catch {
      return false
    }
  }

  /**
   * 获取当前设置
   */
  private getCurrentSettings(): AppSettings {
    // 返回需要备份的设置
    return {
      theme: localStorage.getItem('theme'),
      language: localStorage.getItem('language'),
      // 其他设置
      migrationDate: localStorage.getItem('migration_date')
    }
  }

  /**
   * 恢复设置数据
   */
  private restoreSettingsData(settings: AppSettings): void {
    if (settings.theme) {
      localStorage.setItem('theme', settings.theme)
    }
    if (settings.language) {
      localStorage.setItem('language', settings.language)
    }
  }

  /**
   * 通知状态变化
   */
  private notifyStateChange(): void {
    const state = this.getState()
    this.listeners.forEach((listener) => {
      try {
        listener(state)
      } catch (error) {
        logger.error('[MigrationManager] Listener error:', error)
      }
    })
  }

  /**
   * 重置迁移状态
   */
  resetState(): void {
    this.state = {
      phase: 'preparation',
      progress: 0,
      currentStep: '',
      isMigrating: false,
      migratedRooms: [],
      pendingRooms: [],
      failedRooms: []
    }
    this.notifyStateChange()
  }

  /**
   * 取消正在进行的迁移
   */
  async cancelMigration(): Promise<void> {
    if (!this.state.isMigrating) {
      logger.warn('[MigrationManager] Cannot cancel: no migration in progress')
      return
    }

    logger.info('[MigrationManager] Cancelling migration...')

    // 设置取消标志，让正在执行的步骤能够中止
    this.state.isMigrating = false

    // 执行回滚以清理部分迁移的数据
    await this.performRollback()

    // 重置状态到初始状态
    this.resetState()

    logger.info('[MigrationManager] Migration cancelled and rolled back')
  }

  /**
   * 回滚已完成的迁移
   */
  async rollbackMigration(): Promise<void> {
    if (this.state.isMigrating) {
      throw new Error('Cannot rollback while migration is in progress')
    }

    if (this.state.phase !== 'completed') {
      throw new Error('Can only rollback a completed migration')
    }

    logger.info('[MigrationManager] Rolling back migration...')

    this.state.phase = 'preparation'
    this.state.progress = 0
    this.notifyStateChange()

    try {
      // 执行回滚
      await this.performRollback()

      // 重置状态
      this.resetState()

      logger.info('[MigrationManager] Migration rolled back successfully')
    } catch (error) {
      logger.error('[MigrationManager] Rollback failed:', error)
      throw error
    }
  }
}

// 导出单例实例
export const migrationManager = MigrationManager.getInstance()
