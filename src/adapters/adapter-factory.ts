/**
 * 适配器工厂
 * 负责创建和管理不同类型的适配器实例
 * Phase 7: Matrix SDK 优先模式 - WebSocket adapters removed
 */

import type {
  AdapterFactory,
  MessageAdapter,
  AuthAdapter,
  RoomAdapter,
  FileAdapter,
  SyncAdapter,
  FriendAdapter,
  PrivateChatAdapter,
  AdapterConfig,
  ServiceAdapter
} from './service-adapter'
import {
  MatrixMessageAdapter,
  MatrixAuthAdapter,
  MatrixRoomAdapter,
  MatrixFileAdapter,
  MatrixSyncAdapter
} from './matrix-adapter'
// REMOVED: WebSocket adapters - Matrix SDK is now the only supported protocol
import { matrixFriendAdapter } from './matrix-friend-adapter'
import { matrixPrivateChatAdapter } from './matrix-private-chat-adapter'
// REMOVED: WebSocket friend adapter - Use enhancedFriendsService instead
import { adapterManager } from './adapter-manager'
import { logger } from '@/utils/logger'
import { featureFlags } from '@/config/feature-flags'

/**
 * 适配器工厂实现
 */
export class DefaultAdapterFactory implements AdapterFactory {
  private static instance: DefaultAdapterFactory
  private initialized = false

  private constructor() {}

  public static getInstance(): DefaultAdapterFactory {
    if (!DefaultAdapterFactory.instance) {
      DefaultAdapterFactory.instance = new DefaultAdapterFactory()
    }
    return DefaultAdapterFactory.instance
  }

  /**
   * 获取适配器优先级
   * Phase 7: Matrix SDK is the only supported protocol
   */
  private getMatrixPriority(): number {
    return 100 // Phase 7: Matrix is now the only protocol
  }

  // REMOVED: getWebSocketPriority - WebSocket adapters removed in Phase 7

  /**
   * 初始化所有适配器
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // Phase 7: Matrix SDK is the only supported protocol
      const matrixPriority = this.getMatrixPriority()

      logger.info('[AdapterFactory] Initializing adapters with Matrix SDK only:', {
        matrix: matrixPriority,
        matrixFirstRouting: featureFlags.isEnabled('MATRIX_FIRST_ROUTING')
      })

      // 创建 Matrix 适配器
      const matrixMessage = new MatrixMessageAdapter()
      const matrixAuth = new MatrixAuthAdapter()
      const matrixRoom = new MatrixRoomAdapter()
      const matrixFile = new MatrixFileAdapter()
      const matrixSync = new MatrixSyncAdapter()

      // REMOVED: WebSocket adapter creation - Phase 7 migration to Matrix-only

      // 注册 Matrix 适配器 (Phase 7: Matrix is the only protocol)
      this.registerAdapter('message', 'matrix', matrixMessage, {
        enabled: true,
        priority: matrixPriority,
        fallback: {
          delay: 5000,
          maxRetries: 3,
          timeout: 10000
        }
      })

      this.registerAdapter('auth', 'matrix', matrixAuth, {
        enabled: true,
        priority: matrixPriority,
        fallback: {
          delay: 3000,
          maxRetries: 3,
          timeout: 10000
        }
      })

      this.registerAdapter('room', 'matrix', matrixRoom, {
        enabled: true,
        priority: matrixPriority,
        fallback: {
          delay: 5000,
          maxRetries: 3,
          timeout: 15000
        }
      })

      this.registerAdapter('file', 'matrix', matrixFile, {
        enabled: true,
        priority: matrixPriority - 10, // 文件上传优先级稍低（大文件仍使用 WebSocket）
        fallback: {
          delay: 10000,
          maxRetries: 2,
          timeout: 30000
        }
      })

      this.registerAdapter('sync', 'matrix', matrixSync, {
        enabled: true,
        priority: matrixPriority,
        fallback: {
          delay: 5000,
          maxRetries: 3,
          timeout: 10000
        }
      })

      // REMOVED: WebSocket adapter registration - Phase 7 migration to Matrix-only
      // This included: message, auth, room, file, sync WebSocket adapters

      // 注册好友适配器 (Phase 7: Matrix-only)
      this.registerAdapter('friend', 'matrix', matrixFriendAdapter, {
        enabled: true,
        priority: matrixPriority,
        fallback: {
          delay: 3000,
          maxRetries: 3,
          timeout: 10000
        }
      })

      // REMOVED: WebSocket friend adapter registration - Use enhancedFriendsService instead

      // 初始化适配器
      await this.initializeAdapters()

      this.initialized = true
      logger.info('[AdapterFactory] All adapters initialized successfully')
    } catch (error) {
      logger.error('[AdapterFactory] Initialization failed:', error)
      throw error
    }
  }

  /**
   * 创建消息适配器
   */
  createMessageAdapter(): MessageAdapter {
    const adapters = adapterManager.listAdapters('message')
    if (adapters.length === 0) {
      throw new Error('No message adapters available')
    }

    // 返回优先级最高的适配器
    const best = adapters
      .filter((a) => a.ready)
      .sort((a, b) => {
        const aPriority = adapterManager.getAdapter('message', a.adapter.name)?.priority || 0
        const bPriority = adapterManager.getAdapter('message', b.adapter.name)?.priority || 0
        return bPriority - aPriority
      })[0]

    if (!best) {
      throw new Error('No ready message adapters available')
    }

    return best.adapter as unknown as MessageAdapter
  }

  /**
   * 创建认证适配器
   */
  createAuthAdapter(): AuthAdapter {
    const adapters = adapterManager.listAdapters('auth')
    if (adapters.length === 0) {
      throw new Error('No auth adapters available')
    }

    const best = adapters
      .filter((a) => a.ready)
      .sort((a, b) => {
        const aPriority = adapterManager.getAdapter('auth', a.adapter.name)?.priority || 0
        const bPriority = adapterManager.getAdapter('auth', b.adapter.name)?.priority || 0
        return bPriority - aPriority
      })[0]

    if (!best) {
      throw new Error('No ready auth adapters available')
    }

    return best.adapter as unknown as AuthAdapter
  }

  /**
   * 创建房间适配器
   */
  createRoomAdapter(): RoomAdapter {
    const adapters = adapterManager.listAdapters('room')
    if (adapters.length === 0) {
      throw new Error('No room adapters available')
    }

    const best = adapters
      .filter((a) => a.ready)
      .sort((a, b) => {
        const aPriority = adapterManager.getAdapter('room', a.adapter.name)?.priority || 0
        const bPriority = adapterManager.getAdapter('room', b.adapter.name)?.priority || 0
        return bPriority - aPriority
      })[0]

    if (!best) {
      throw new Error('No ready room adapters available')
    }

    return best.adapter as unknown as RoomAdapter
  }

  /**
   * 创建文件适配器
   */
  createFileAdapter(): FileAdapter {
    const adapters = adapterManager.listAdapters('file')
    if (adapters.length === 0) {
      throw new Error('No file adapters available')
    }

    const best = adapters
      .filter((a) => a.ready)
      .sort((a, b) => {
        const aPriority = adapterManager.getAdapter('file', a.adapter.name)?.priority || 0
        const bPriority = adapterManager.getAdapter('file', b.adapter.name)?.priority || 0
        return bPriority - aPriority
      })[0]

    if (!best) {
      throw new Error('No ready file adapters available')
    }

    return best.adapter as unknown as FileAdapter
  }

  /**
   * 创建同步适配器
   */
  createSyncAdapter(): SyncAdapter {
    const adapters = adapterManager.listAdapters('sync')
    if (adapters.length === 0) {
      throw new Error('No sync adapters available')
    }

    const best = adapters
      .filter((a) => a.ready)
      .sort((a, b) => {
        const aPriority = adapterManager.getAdapter('sync', a.adapter.name)?.priority || 0
        const bPriority = adapterManager.getAdapter('sync', b.adapter.name)?.priority || 0
        return bPriority - aPriority
      })[0]

    if (!best) {
      throw new Error('No ready sync adapters available')
    }

    return best.adapter as unknown as SyncAdapter
  }

  /**
   * 创建好友适配器
   * Phase 4: 根据优先级返回 Matrix 或 WebSocket 适配器
   */
  createFriendAdapter(): FriendAdapter {
    const adapters = adapterManager.listAdapters('friend')
    if (adapters.length === 0) {
      // 回退到直接返回 Matrix 适配器
      return matrixFriendAdapter
    }

    const best = adapters
      .filter((a) => a.ready)
      .sort((a, b) => {
        const aPriority = adapterManager.getAdapter('friend', a.adapter.name)?.priority || 0
        const bPriority = adapterManager.getAdapter('friend', b.adapter.name)?.priority || 0
        return bPriority - aPriority
      })[0]

    return (best?.adapter as unknown as FriendAdapter) || matrixFriendAdapter
  }

  /**
   * 创建私密聊天适配器
   */
  createPrivateChatAdapter(): PrivateChatAdapter {
    return matrixPrivateChatAdapter
  }

  /**
   * 注册适配器
   */
  private registerAdapter(type: string, name: string, adapter: ServiceAdapter, config: AdapterConfig): void {
    adapterManager.registerAdapter(type, name, adapter, config)
  }

  /**
   * 初始化所有适配器
   */
  private async initializeAdapters(): Promise<void> {
    const adapters = adapterManager.listAdapters()

    for (const { adapter } of adapters) {
      try {
        if (adapter.initialize) {
          await adapter.initialize()
          logger.info(`[AdapterFactory] Adapter ${adapter.name} initialized`)
        }
      } catch (error) {
        logger.error(`[AdapterFactory] Failed to initialize adapter ${adapter.name}:`, error)
        // 继续初始化其他适配器
      }
    }
  }
}

// 导出单例实例
export const adapterFactory = DefaultAdapterFactory.getInstance()

// 便捷函数
export async function getBestMessageAdapter(): Promise<MessageAdapter> {
  return (await adapterManager.getBestAdapter('message')) as unknown as MessageAdapter
}

export async function getBestAuthAdapter(): Promise<AuthAdapter> {
  return (await adapterManager.getBestAdapter('auth')) as unknown as AuthAdapter
}

export async function getBestRoomAdapter(): Promise<RoomAdapter> {
  return (await adapterManager.getBestAdapter('room')) as unknown as RoomAdapter
}

export async function getBestFileAdapter(): Promise<FileAdapter> {
  return (await adapterManager.getBestAdapter('file')) as unknown as FileAdapter
}

export async function getBestSyncAdapter(): Promise<SyncAdapter> {
  return (await adapterManager.getBestAdapter('sync')) as unknown as SyncAdapter
}
