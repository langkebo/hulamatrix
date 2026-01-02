/**
 * Matrix SDK Loader
 * 动态加载和使用 Matrix SDK
 */

import { createClient as matrixCreateClient, type ICreateClientOpts } from 'matrix-js-sdk'
import { logger } from '@/utils/logger'

/**
 * 同步状态数据
 */
export interface SyncStateData {
  presence?: unknown
  accountData?: unknown
  [key: string]: unknown
}

/**
 * 创建Matrix客户端
 * @param config 客户端配置
 * @returns Matrix客户端实例
 */
export async function createClient(config: ICreateClientOpts): Promise<ReturnType<typeof matrixCreateClient>> {
  logger.info('[MatrixSDK] Creating client with config:', config)

  try {
    const client = await matrixCreateClient(config)

    // 添加基本的事件监听器 - 使用类型断言绕过严格类型检查
    client.on('sync', (...args: unknown[]) => {
      const [state, prevState, data] = args as [string, string, SyncStateData]
      logger.info('[MatrixSDK] Sync state:', { state, prevState, data })
    })

    // 注意: event 参数类型由 matrix-js-sdk 内部处理
    client.on('event', (event: unknown) => {
      // 安全地访问 event 属性
      if (event && typeof event === 'object') {
        const e = event as Record<string, unknown>
        logger.debug('[MatrixSDK] Event received:', {
          type: typeof e.getType === 'function' ? e.getType() : undefined,
          roomId: typeof e.getRoomId === 'function' ? e.getRoomId() : undefined,
          eventId: typeof e.getId === 'function' ? e.getId() : undefined
        })
      }
    })

    return client
  } catch (error) {
    logger.error('[MatrixSDK] Failed to create client:', error)
    throw error
  }
}
