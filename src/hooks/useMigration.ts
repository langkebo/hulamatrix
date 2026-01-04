/**
 * 迁移 Hook
 * 提供 Vue 组件中使用的迁移管理功能
 */

import { ref, computed, onMounted, onUnmounted, readonly } from 'vue'
import { migrationManager, type MigrationState, type MigrationOptions } from '@/adapters/migration-manager'
import { featureFlags } from '@/config/feature-flags'
import { logger } from '@/utils/logger'

export interface MigrationConfig {
  /**
   * 自动显示提示
   */
  autoShowPrompt?: boolean

  /**
   * 迁移策略
   */
  strategy?: 'conservative' | 'balanced' | 'aggressive'

  /**
   * 是否启用回滚
   */
  enableRollback?: boolean

  /**
   * 迁移超时时间（毫秒）
   */
  timeout?: number
}

/**
 * 使用迁移管理
 */
export function useMigration(config: MigrationConfig = {}) {
  const {
    autoShowPrompt = true,
    strategy = 'balanced',
    enableRollback = true,
    timeout = 600000 // 10 minutes
  } = config

  // State
  const state = ref<MigrationState>(migrationManager.getState())
  const showPrompt = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isMigrating = computed(() => state.value.isMigrating)
  const isCompleted = computed(() => state.value.phase === 'completed')
  const canMigrate = computed(() => migrationManager.canMigrate())
  const progress = computed(() => state.value.progress)
  const currentStep = computed(() => state.value.currentStep)
  const migrationPhase = computed(() => state.value.phase)

  // 迁移统计
  const stats = computed(() => ({
    totalRooms: state.value.pendingRooms.length + state.value.migratedRooms.length,
    migratedRooms: state.value.migratedRooms.length,
    failedRooms: state.value.failedRooms.length,
    successRate:
      state.value.migratedRooms.length > 0
        ? Math.round(
            (state.value.migratedRooms.length / (state.value.migratedRooms.length + state.value.failedRooms.length)) *
              100
          )
        : 0
  }))

  // 监听器
  let unsubscribe: (() => void) | null = null

  onMounted(() => {
    // 监听迁移状态变化
    unsubscribe = migrationManager.addListener((newState) => {
      state.value = newState
      error.value = newState.error || null
    })

    // 检查是否应该显示提示
    if (autoShowPrompt && canMigrate.value) {
      checkShouldShowPrompt()
    }
  })

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe()
    }
  })

  /**
   * 检查是否应该显示提示
   */
  const checkShouldShowPrompt = () => {
    // 检查功能标志
    if (!featureFlags.isEnabled('matrix-migration')) {
      return false
    }

    // 检查是否已经迁移
    if (localStorage.getItem('migration_completed') === 'true') {
      return false
    }

    // 检查是否已经忽略
    const dismissTime = localStorage.getItem('migration_prompt_dismissed')
    if (dismissTime) {
      const daysSinceDismiss = (Date.now() - parseInt(dismissTime, 10)) / (1000 * 60 * 60 * 24)
      if (daysSinceDismiss < 7) {
        return false
      }
    }

    // 检查是否有定时迁移
    const scheduled = localStorage.getItem('migration_scheduled')
    if (scheduled) {
      const scheduledTime = parseInt(scheduled, 10)
      if (scheduledTime > Date.now()) {
        // 设置定时器
        setTimeout(() => {
          startMigration()
        }, scheduledTime - Date.now())
        return false
      }
    }

    return true
  }

  /**
   * 开始迁移
   */
  const startMigration = async (options: Partial<MigrationOptions> = {}) => {
    if (!canMigrate.value) {
      throw new Error('Migration cannot be started at this time')
    }

    isLoading.value = true
    error.value = null

    try {
      logger.info('[useMigration] Starting migration...')

      const migrationOptions: MigrationOptions = {
        strategy,
        rollback: enableRollback,
        timeout,
        ...options
      }

      await migrationManager.startMigration(migrationOptions)

      logger.info('[useMigration] Migration completed successfully')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      error.value = errorMessage
      logger.error('[useMigration] Migration failed:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 取消迁移
   */
  const cancelMigration = async (): Promise<void> => {
    if (!isMigrating.value) {
      return
    }

    try {
      logger.info('[useMigration] Cancelling migration...')
      // 调用 migrationManager 的取消方法
      // cancelMigration 会更新内部状态，监听器会自动同步到 state.value
      // isMigrating 和 progress 是计算属性，会自动反映 state.value 的变化
      await migrationManager.cancelMigration()
      logger.info('[useMigration] Migration cancelled')
    } catch (err) {
      logger.error('[useMigration] Failed to cancel migration:', err)
      throw err
    }
  }

  /**
   * 重置迁移状态
   */
  const resetMigration = (): void => {
    migrationManager.resetState()
    error.value = null
    logger.info('[useMigration] Migration state reset')
  }

  /**
   * 忽略提示
   */
  const dismissPrompt = (): void => {
    localStorage.setItem('migration_prompt_dismissed', Date.now().toString())
    showPrompt.value = false
    logger.info('[useMigration] Migration prompt dismissed')
  }

  /**
   * 定时迁移
   */
  const scheduleMigration = (time: Date): void => {
    const timestamp = time.getTime()
    localStorage.setItem('migration_scheduled', timestamp.toString())

    // 设置定时器
    setTimeout(() => {
      startMigration()
    }, timestamp - Date.now())

    logger.info(`[useMigration] Migration scheduled for ${time.toISOString()}`)
  }

  /**
   * 检查迁移前提条件
   */
  const checkPrerequisites = async (): Promise<{
    valid: boolean
    issues: string[]
  }> => {
    const issues: string[] = []

    // 检查功能标志
    if (!featureFlags.isEnabled('matrix-migration')) {
      issues.push('Matrix migration feature is not enabled')
    }

    // 检查网络连接
    try {
      const matrixAdapter = await migrationManager['checkMatrixAvailability']()
      if (!matrixAdapter) {
        issues.push('Matrix service is not available')
      }
    } catch (_err) {
      issues.push('Failed to check Matrix availability')
    }

    // 检查存储空间
    try {
      const storageSpace = await migrationManager['checkStorageSpace']()
      const requiredSpace = 100 * 1024 * 1024 // 100MB
      if (storageSpace < requiredSpace) {
        issues.push('Insufficient storage space for migration')
      }
    } catch (_err) {
      issues.push('Failed to check storage space')
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }

  /**
   * 获取迁移历史
   */
  const getMigrationHistory = (): Array<{
    date: string
    status: 'success' | 'failed' | 'cancelled'
    details?: string
  }> => {
    const historyStr = localStorage.getItem('migration_history')
    if (!historyStr) {
      return []
    }

    try {
      return JSON.parse(historyStr)
    } catch {
      return []
    }
  }

  /**
   * 记录迁移历史
   */
  const recordMigrationHistory = (status: 'success' | 'failed' | 'cancelled', details?: string): void => {
    const history = getMigrationHistory()
    history.push({
      date: new Date().toISOString(),
      status,
      ...(details && { details })
    })

    // 只保留最近10条记录
    if (history.length > 10) {
      history.splice(0, history.length - 10)
    }

    localStorage.setItem('migration_history', JSON.stringify(history))
  }

  /**
   * 获取当前架构模式
   */
  const getCurrentArchitecture = (): 'websocket' | 'matrix' | 'hybrid' => {
    // 迁移完成意味着使用 Matrix
    if (isCompleted.value) {
      return 'matrix'
    }

    // 正在迁移中
    if (isMigrating.value) {
      return 'hybrid'
    }

    // 默认使用 WebSocket
    return 'websocket'
  }

  /**
   * 获取迁移建议
   */
  const getMigrationRecommendation = (): {
    shouldMigrate: boolean
    reason: string
    priority: 'low' | 'medium' | 'high'
  } => {
    // 如果已经完成
    if (isCompleted.value) {
      return {
        shouldMigrate: false,
        reason: 'Migration already completed',
        priority: 'low'
      }
    }

    // 如果正在迁移
    if (isMigrating.value) {
      return {
        shouldMigrate: false,
        reason: 'Migration in progress',
        priority: 'low'
      }
    }

    // 检查用户使用情况
    const lastLogin = localStorage.getItem('last_login')
    const daysSinceLogin = lastLogin ? (Date.now() - parseInt(lastLogin, 10)) / (1000 * 60 * 60 * 24) : Infinity

    // 活跃用户建议迁移
    if (daysSinceLogin < 7) {
      return {
        shouldMigrate: true,
        reason: 'Active user would benefit from improved features',
        priority: 'high'
      }
    }

    // 普通用户可以迁移
    if (daysSinceLogin < 30) {
      return {
        shouldMigrate: true,
        reason: 'Recommended for better performance and security',
        priority: 'medium'
      }
    }

    // 不活跃用户暂时不迁移
    return {
      shouldMigrate: false,
      reason: 'User not active enough for migration',
      priority: 'low'
    }
  }

  return {
    // State
    state: readonly(state),
    showPrompt: readonly(showPrompt),
    isLoading: readonly(isLoading),
    error: readonly(error),

    // Computed
    isMigrating,
    isCompleted,
    canMigrate,
    progress,
    currentStep,
    migrationPhase,
    stats,
    currentArchitecture: getCurrentArchitecture(),

    // Methods
    startMigration,
    cancelMigration,
    resetMigration,
    dismissPrompt,
    scheduleMigration,
    checkPrerequisites,
    getMigrationHistory,
    recordMigrationHistory,
    getMigrationRecommendation,
    checkShouldShowPrompt
  }
}

/**
 * 使用迁移提示
 */
export function useMigrationPrompt() {
  const { canMigrate, dismissPrompt, startMigration } = useMigration()

  const showDialog = ref(false)
  const selectedOption = ref<'later' | 'now' | 'schedule'>('later')
  const scheduledTime = ref<Date | null>(null)

  // 显示迁移提示
  const prompt = () => {
    if (!canMigrate.value) {
      return
    }

    showDialog.value = true
  }

  // 处理提示确认
  const handlePromptConfirm = async () => {
    switch (selectedOption.value) {
      case 'later':
        dismissPrompt()
        break
      case 'now':
        await startMigration()
        break
      case 'schedule':
        if (scheduledTime.value) {
          // 定时迁移实现说明：
          // - 需要使用 setTimeout 或 Background Task API 来调度
          // - 考虑使用 Tauri 的后台任务支持（移动端）
          // - 需要处理用户离开页面后的迁移启动
          // - 需要存储调度时间到 localStorage 以便恢复
          //
          // 实现方案：
          // 1. 计算延迟时间 = scheduledTime - Date.now()
          // 2. 设置 setTimeout 在指定时间触发 startMigration()
          // 3. 或者使用通知 API 在指定时间提醒用户
          // 4. 移动端可以使用 Tauri 的 scheduler 插件
          logger.warn('[useMigration] Scheduled migration not implemented yet')
        }
        break
    }

    showDialog.value = false
  }

  return {
    showDialog: readonly(showDialog),
    selectedOption,
    scheduledTime,
    prompt,
    handlePromptConfirm
  }
}
