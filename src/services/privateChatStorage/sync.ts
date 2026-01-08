/**
 * PrivateChat Storage Sync Manager
 * 存储同步管理器 - 处理本地和服务器的数据同步
 *
 * @module services/privateChatStorage/sync
 */

import type { PrivateChatSession } from '@/sdk/matrix-private-chat/types'
import { logger } from '@/utils/logger'
import type { PrivateChatStorageApi } from '@/sdk/matrix-private-chat/types'

/**
 * 同步策略
 */
export enum SyncStrategy {
  /** 手动同步 */
  MANUAL = 'manual',
  /** 懒加载：访问时同步 */
  LAZY = 'lazy',
  /** 定期同步 */
  PERIODIC = 'periodic',
  /** 实时同步（需要 WebHook） */
  REALTIME = 'realtime'
}

/**
 * 同步结果
 */
export interface SyncResult {
  /**
   * 同步是否成功
   */
  success: boolean

  /**
   * 合并的会话数
   */
  sessionsMerged?: number

  /**
   * 解决的冲突数
   */
  conflictsResolved?: number

  /**
   * 错误信息
   */
  error?: string

  /**
   * 操作耗时（毫秒）
   */
  duration: number

  /**
   * 同步时间戳
   */
  timestamp?: number

  /**
   * 新增的会话数
   */
  sessionsAdded?: number

  /**
   * 更新的会话数
   */
  sessionsUpdated?: number

  /**
   * 删除的会话数
   */
  sessionsDeleted?: number

  /**
   * 新增的消息数
   */
  messagesAdded?: number
}

/**
 * 同步配置选项
 */
export interface SyncOptions {
  /**
   * 同步策略
   */
  strategy?: SyncStrategy

  /**
   * 同步间隔（毫秒）- 仅 PERIODIC 策略
   */
  interval?: number

  /**
   * 是否自动启动同步
   */
  autoStart?: boolean

  /**
   * 冲突解决策略：'server' | 'local' | 'merge'
   */
  conflictResolution?: 'server' | 'local' | 'merge'

  /**
   * 同步超时（毫秒）
   */
  timeout?: number

  /**
   * 重试次数
   */
  retryAttempts?: number

  /**
   * 重试延迟（毫秒）
   */
  retryDelay?: number
}

/**
 * 同步状态
 */
export interface SyncState {
  /**
   * 是否正在同步
   */
  syncing: boolean

  /**
   * 最后同步时间
   */
  lastSyncTime: number

  /**
   * 下次同步时间
   */
  nextSyncTime?: number

  /**
   * 同步次数
   */
  syncCount: number

  /**
   * 失败次数
   */
  failureCount: number

  /**
   * 上次同步结果
   */
  lastResult?: SyncResult
}

/**
 * 同步事件类型
 */
export type SyncEventType =
  | 'sync.start'
  | 'sync.complete'
  | 'sync.error'
  | 'sync.progress'
  | 'conflict.detected'
  | 'conflict.resolved'

/**
 * 同步事件数据
 */
export interface SyncEventData {
  /**
   * 事件类型
   */
  type: SyncEventType

  /**
   * 进度（0-100）
   */
  progress?: number

  /**
   * 错误信息
   */
  error?: string

  /**
   * 冲突的会话 ID
   */
  conflictSessionId?: string

  /**
   * 时间戳
   */
  timestamp: number
}

/**
 * 同步事件监听器
 */
export type SyncEventListener = (event: SyncEventData) => void

/**
 * 存储同步管理器
 */
export class StorageSyncManager {
  private storage: PrivateChatStorageApi
  private fetchFromServer: ((endpoint: string) => Promise<unknown>) | null = null
  private strategy: SyncStrategy = SyncStrategy.PERIODIC
  private syncInterval = 5 * 60 * 1000 // 5分钟
  private syncTimer: ReturnType<typeof setInterval> | null = null
  private state: SyncState = {
    syncing: false,
    lastSyncTime: 0,
    syncCount: 0,
    failureCount: 0
  }
  private options: Required<SyncOptions>
  private listeners: Set<SyncEventListener> = new Set()
  private conflictResolution: 'server' | 'local' | 'merge' = 'server'

  constructor(
    storage: PrivateChatStorageApi,
    options: SyncOptions = {},
    fetchFromServer?: (endpoint: string) => Promise<unknown>
  ) {
    this.storage = storage
    this.fetchFromServer = fetchFromServer || null
    this.strategy = options.strategy || SyncStrategy.PERIODIC
    this.syncInterval = options.interval || 5 * 60 * 1000
    this.conflictResolution = options.conflictResolution || 'server'

    this.options = {
      strategy: this.strategy,
      interval: this.syncInterval,
      autoStart: options.autoStart ?? false,
      conflictResolution: this.conflictResolution,
      timeout: options.timeout || 30000,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000
    }

    if (this.options.autoStart) {
      this.startAutoSync().catch((error) => {
        logger.error('[StorageSyncManager] Failed to start auto sync:', error)
      })
    }
  }

  /**
   * 启动自动同步
   */
  async startAutoSync(): Promise<void> {
    if (this.strategy !== SyncStrategy.PERIODIC) {
      return
    }

    if (this.syncTimer) {
      this.stopAutoSync()
    }

    this.syncTimer = setInterval(async () => {
      await this.sync().catch((error) => {
        this.emit({ type: 'sync.error', error: error.message, timestamp: Date.now() })
      })
    }, this.syncInterval)

    // 立即执行一次同步
    await this.sync()
  }

  /**
   * 停止自动同步
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }

  /**
   * 执行同步
   *
   * @returns Promise<SyncResult>
   */
  async sync(): Promise<SyncResult> {
    if (this.state.syncing) {
      return {
        success: false,
        error: 'Sync already in progress',
        duration: 0
      }
    }

    const startTime = Date.now()
    this.state.syncing = true
    this.emit({ type: 'sync.start', timestamp: startTime })

    try {
      // 1. 从本地获取数据
      const localSessions = await this.storage.getSessions()

      // 2. 从服务器获取数据（如果有 fetchFromServer）
      let serverSessions: PrivateChatSession[] = []
      if (this.fetchFromServer) {
        try {
          const data = (await this.fetchFromServer('/_synapse/client/enhanced/private_chat/v2/sessions')) as {
            sessions?: PrivateChatSession[]
          }
          serverSessions = data.sessions || []
        } catch (error) {
          logger.warn('[StorageSyncManager] Failed to fetch from server:', error)
        }
      }

      // 3. 合并数据
      const { merged, conflicts } = await this.mergeSessions(localSessions, serverSessions)

      // 4. 保存合并后的数据
      for (const session of merged) {
        await this.storage.saveSession(
          session as unknown as import('@/sdk/matrix-private-chat/types').StoredPrivateChatSession
        )
      }

      // 5. 更新同步时间
      this.state.lastSyncTime = Date.now()
      this.state.syncCount++
      this.state.failureCount = 0

      const duration = Date.now() - startTime
      const result: SyncResult = {
        success: true,
        duration,
        timestamp: this.state.lastSyncTime,
        sessionsMerged: merged.length,
        conflictsResolved: conflicts.length,
        sessionsAdded: serverSessions.length,
        sessionsUpdated: merged.filter((m) => localSessions.some((l) => l.session_id === m.session_id)).length
      }

      this.state.lastResult = result
      this.emit({ type: 'sync.complete', progress: 100, timestamp: Date.now() })

      return result
    } catch (error) {
      this.state.failureCount++
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      const result: SyncResult = {
        success: false,
        error: errorMessage,
        duration
      }

      this.state.lastResult = result
      this.emit({ type: 'sync.error', error: errorMessage, timestamp: Date.now() })

      // 重试逻辑
      if (this.state.failureCount <= this.options.retryAttempts) {
        setTimeout(() => {
          this.sync().catch((err) => {
            logger.error('[StorageSyncManager] Retry failed:', err)
          })
        }, this.options.retryDelay * this.state.failureCount)
      }

      return result
    } finally {
      this.state.syncing = false
    }
  }

  /**
   * 合并本地和服务器会话数据
   *
   * @param local - 本地会话
   * @param server - 服务器会话
   * @returns Promise<{ merged: PrivateChatSession[]; conflicts: PrivateChatSession[] }>
   */
  private async mergeSessions(
    local: PrivateChatSession[],
    server: PrivateChatSession[]
  ): Promise<{ merged: PrivateChatSession[]; conflicts: PrivateChatSession[] }> {
    const mergedMap = new Map<string, PrivateChatSession>()
    const conflicts: PrivateChatSession[] = []

    // 添加本地会话
    for (const session of local) {
      mergedMap.set(session.session_id, session)
    }

    // 合并服务器会话
    for (const serverSession of server) {
      const localSession = mergedMap.get(serverSession.session_id)

      if (localSession) {
        // 检测冲突
        if (this.hasConflict(localSession, serverSession)) {
          conflicts.push(serverSession)
          this.emit({
            type: 'conflict.detected',
            conflictSessionId: serverSession.session_id,
            timestamp: Date.now()
          })

          // 根据冲突解决策略处理
          const resolved = this.resolveConflict(localSession, serverSession)
          mergedMap.set(serverSession.session_id, resolved)

          this.emit({
            type: 'conflict.resolved',
            conflictSessionId: serverSession.session_id,
            timestamp: Date.now()
          })
        } else {
          // 无冲突，比较更新时间
          const serverTime = new Date(serverSession.updated_at || 0).getTime()
          const localTime = new Date(localSession.updated_at || 0).getTime()

          if (serverTime > localTime) {
            mergedMap.set(serverSession.session_id, serverSession)
          }
        }
      } else {
        // 新会话
        mergedMap.set(serverSession.session_id, serverSession)
      }
    }

    return {
      merged: Array.from(mergedMap.values()),
      conflicts
    }
  }

  /**
   * 检测两个会话是否冲突
   *
   * @param local - 本地会话
   * @param server - 服务器会话
   * @returns boolean
   */
  private hasConflict(local: PrivateChatSession, server: PrivateChatSession): boolean {
    // 如果两边都在不同时间修改过，则认为有冲突
    const localTime = new Date(local.updated_at || 0).getTime()
    const serverTime = new Date(server.updated_at || 0).getTime()
    const timeDiff = Math.abs(localTime - serverTime)

    // 如果更新时间差小于 1 秒，可能同时修改
    return timeDiff < 1000 && local.updated_at !== server.updated_at
  }

  /**
   * 解决冲突
   *
   * @param local - 本地会话
   * @param server - 服务器会话
   * @returns PrivateChatSession
   */
  private resolveConflict(local: PrivateChatSession, server: PrivateChatSession): PrivateChatSession {
    switch (this.conflictResolution) {
      case 'server':
        return server
      case 'local':
        return local
      case 'merge': {
        // 合并策略：保留较新的数据
        const localTime = new Date(local.updated_at || 0).getTime()
        const serverTime = new Date(server.updated_at || 0).getTime()
        return localTime > serverTime ? local : server
      }
      default:
        return server
    }
  }

  /**
   * 获取同步状态
   *
   * @returns SyncState
   */
  getState(): SyncState {
    return { ...this.state }
  }

  /**
   * 获取最后同步时间
   *
   * @returns Promise<number>
   */
  async getLastSyncTime(): Promise<number> {
    return this.state.lastSyncTime
  }

  /**
   * 添加事件监听器
   *
   * @param listener - 监听器函数
   */
  addListener(listener: SyncEventListener): void {
    this.listeners.add(listener)
  }

  /**
   * 移除事件监听器
   *
   * @param listener - 监听器函数
   */
  removeListener(listener: SyncEventListener): void {
    this.listeners.delete(listener)
  }

  /**
   * 发送事件
   *
   * @param event - 事件数据
   */
  private emit(event: SyncEventData): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (error) {
        logger.error('[StorageSyncManager] Listener error:', error)
      }
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.stopAutoSync()
    this.listeners.clear()
  }
}

/**
 * 创建存储同步管理器
 *
 * @param storage - 存储服务
 * @param options - 同步选项
 * @param fetchFromServer - 从服务器获取数据的函数
 * @returns StorageSyncManager
 */
export function createStorageSyncManager(
  storage: PrivateChatStorageApi,
  options?: SyncOptions,
  fetchFromServer?: (endpoint: string) => Promise<unknown>
): StorageSyncManager {
  return new StorageSyncManager(storage, options, fetchFromServer)
}
