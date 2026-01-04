/**
 * useMatrixClient Composable
 *
 * 提供访问 Matrix 客户端的统一入口
 * 直接使用 matrixClientService，避免重复调用 getClient()
 *
 * Phase 12 优化: 减少代码中 432+ 次 getClient() 调用
 */

import { computed } from 'vue'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'

/**
 * useMatrixClient Composable
 *
 * 提供 Matrix 客户端访问的响应式接口
 * 自动连接到 matrixClientService 单例
 *
 * @example
 * ```ts
 * import { useMatrixClient } from '@/composables'
 *
 * const { client, isReady } = useMatrixClient()
 *
 * if (isReady.value && client.value) {
 *   await client.setDisplayName('New Name')
 * }
 * ```
 *
 * @example
 * ```ts
 * // ❌ 旧代码 - 重复调用 getClient()
 * const client1 = matrixClientService.getClient()
 * const client2 = matrixClientService.getClient()
 *
 * // ✅ 新代码 - 使用 composable
 * const { client } = useMatrixClient()
 * // client.value 是响应式的，自动同步
 * ```
 */
export function useMatrixClient() {
  /**
   * Matrix 客户端实例（响应式）
   * 自动从 matrixClientService 获取
   */
  const client = computed(() => matrixClientService.getClient())

  /**
   * 客户端是否已初始化
   */
  const isReady = computed(() => matrixClientService.isClientInitialized())

  /**
   * 用户 ID
   */
  const userId = computed(() => {
    const c = client.value
    if (!c) return null
    const clientLike = c as { getUserId?: () => string }
    return clientLike.getUserId?.() || null
  })

  /**
   * 设备 ID
   */
  const deviceId = computed(() => {
    const c = client.value
    if (!c) return null
    const clientLike = c as { getDeviceId?: () => string }
    return clientLike.getDeviceId?.() || null
  })

  /**
   * 房间列表
   */
  const rooms = computed(() => {
    const c = client.value
    if (!c) return []
    const clientLike = c as { getRooms?: () => unknown[] }
    return clientLike.getRooms?.() || []
  })

  return {
    client,
    isReady,
    userId,
    deviceId,
    rooms
  }
}

/**
 * 便捷方法：获取客户端并执行操作
 *
 * @example
 * ```ts
 * import { withClient } from '@/composables'
 *
 * await withClient(async (client) => {
 *   await client.setDisplayName('New Name')
 * })
 * ```
 */
export async function withClient<T>(fn: (client: unknown) => Promise<T>): Promise<T | null> {
  const client = matrixClientService.getClient()
  if (!client) {
    logger.warn('[useMatrixClient] Client not initialized')
    return null
  }
  return fn(client)
}

export default useMatrixClient
