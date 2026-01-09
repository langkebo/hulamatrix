/**
 * Matrix 服务发现模块 (Phase 10 优化 - 统一使用 SDK AutoDiscovery)
 *
 * 此模块提供统一的服务发现接口，内部使用 MatrixServerDiscovery
 * 确保 SDK 的 AutoDiscovery 功能被充分利用。
 */

import { matrixServerDiscovery, type DiscoveryResult as ServerDiscoveryResult } from '@/integrations/matrix/server-discovery'
import { logger } from '@/utils/logger'

export type DiscoveryResult = {
  homeserverUrl: string
  capabilities?: {
    versions?: string[]
    capabilities?: Record<string, unknown>
  }
}

/**
 * 执行完整的 Matrix 服务发现流程 (Phase 10 优化)
 *
 * 优先使用 SDK 的 AutoDiscovery，通过 MatrixServerDiscovery 统一实现
 * @param serverName 输入的服务器名（域名或 URL）
 * @returns 发现结果，包含 homeserver 基础地址与能力信息
 */
export async function performAutoDiscovery(serverName: string): Promise<DiscoveryResult> {
  try {
    logger.debug('[Discovery] 执行服务发现', { serverName })

    // 使用统一的 MatrixServerDiscovery (Phase 10 优化)
    const result: ServerDiscoveryResult = await matrixServerDiscovery.discover(serverName, {
      timeout: 10000,
      skipCache: false,
      validateCapabilities: true
    })

    // 转换为旧格式以保持向后兼容
    const legacyResult: DiscoveryResult = {
      homeserverUrl: result.homeserverUrl,
      capabilities: {
        versions: result.capabilities.versions,
        capabilities: result.capabilities.unstableFeatures
      }
    }

    logger.debug('[Discovery] 服务发现成功', {
      homeserverUrl: legacyResult.homeserverUrl,
      versions: legacyResult.capabilities?.versions?.length || 0
    })

    return legacyResult
  } catch (error) {
    logger.error('[Discovery] 服务发现失败:', error)
    throw error
  }
}

/**
 * 安全的服务发现流程，返回可用的 homeserver 地址，失败时抛出带有上下文的错误
 * (Phase 10 优化 - 内部使用 MatrixServerDiscovery)
 * @param serverName 输入的服务器名（域名或 URL）
 * @returns 发现结果
 */
export async function safeAutoDiscovery(serverName: string): Promise<DiscoveryResult> {
  try {
    return await performAutoDiscovery(serverName)
  } catch (error) {
    const e = error instanceof Error ? error.message : String(error)
    throw new Error(`服务发现失败: ${e}`)
  }
}

/**
 * 周期性轮询 .well-known 配置变化
 * @param client 已初始化的 Matrix 客户端
 * @param intervalMs 轮询间隔（毫秒）
 */
export function pollWellKnownUpdates(
  client: { pollForWellKnownChanges?: () => Promise<void> },
  intervalMs: number = 300000
): void {
  try {
    setInterval(
      async () => {
        try {
          await client.pollForWellKnownChanges?.()
        } catch {}
      },
      Math.max(60000, intervalMs)
    )
  } catch {}
}

/**
 * 清除发现缓存 (Phase 10 优化 - 使用 MatrixServerDiscovery)
 */
export function clearDiscoveryCache(serverName?: string): void {
  matrixServerDiscovery.clearCache(serverName)
}
