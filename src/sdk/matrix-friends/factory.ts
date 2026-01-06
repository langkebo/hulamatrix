/**
 * Matrix Friends SDK 工厂函数
 *
 * 用于创建增强的 Matrix 客户端，集成 Friends API
 */

import type { MatrixClientLike } from './FriendsApiExtension'
import { MatrixFriendsApiExtension } from './FriendsApiExtension'

/**
 * 增强的 Matrix 客户端配置
 */
export interface EnhancedMatrixClientConfig {
  /** Matrix 基础 URL (例如: https://matrix.cjystx.top:443) */
  baseUrl: string
  /** 访问令牌 */
  accessToken: string
  /** 用户 ID */
  userId: string
  /** Friends API 基础 URL (可选，默认使用 baseUrl) */
  friendsApiBaseUrl?: string
  /** 设备 ID (可选) */
  deviceId?: string
  /** 是否自动创建 DM 房间 (默认: true) */
  autoCreateDM?: boolean
}

/**
 * 增强的 Matrix 客户端类型
 * 扩展自标准 Matrix 客户端，添加 friends 属性
 */
export interface EnhancedMatrixClient extends MatrixClientLike {
  readonly friends: import('./types').FriendsApi
}

/**
 * 创建增强的 Matrix 客户端
 *
 * @param config 客户端配置
 * @returns 增强的 Matrix 客户端实例
 *
 * @example
 * ```typescript
 * const client = await createEnhancedMatrixClient({
 *   baseUrl: 'https://matrix.cjystx.top:443',
 *   accessToken: 'syt_...',
 *   userId: '@user:cjystx.top',
 * });
 *
 * // 使用 Friends API
 * const friends = await client.friends.list();
 * const stats = await client.friends.getStats();
 * ```
 */
export async function createEnhancedMatrixClient(config: EnhancedMatrixClientConfig): Promise<EnhancedMatrixClient> {
  // 动态导入 matrix-js-sdk
  const matrixJs = await import('matrix-js-sdk')

  // 创建标准 Matrix 客户端
  // 注意: matrix-js-sdk 的 createClient 不接受 userId 参数
  const baseClient = matrixJs.createClient({
    baseUrl: config.baseUrl,
    accessToken: config.accessToken,
    deviceId: config.deviceId
  }) as unknown as MatrixClientLike

  // 设置 userId（如果需要）
  if (config.userId && typeof (baseClient as any).setUserId === 'function') {
    ;(baseClient as any).setUserId(config.userId)
  }

  // 创建 Friends API 扩展
  const friendsApi = new MatrixFriendsApiExtension(baseClient, config.friendsApiBaseUrl || config.baseUrl)

  // 将扩展添加到客户端
  // 注意: configurable 设为 true 以支持测试环境中的重新定义
  Object.defineProperty(baseClient, 'friends', {
    value: friendsApi,
    writable: false,
    enumerable: true,
    configurable: true // 允许在测试中重新定义
  })

  return baseClient as EnhancedMatrixClient
}

/**
 * 从 token 创建增强客户端（简化版）
 *
 * @param baseUrl Matrix 基础 URL
 * @param accessToken 访问令牌
 * @param userId 用户 ID
 * @param friendsApiBaseUrl Friends API 基础 URL (可选)
 * @returns 增强的 Matrix 客户端实例
 *
 * @example
 * ```typescript
 * const client = await createClientFromToken(
 *   'https://matrix.cjystx.top:443',
 *   'syt_...',
 *   '@user:cjystx.top'
 * );
 * ```
 */
export async function createClientFromToken(
  baseUrl: string,
  accessToken: string,
  userId: string,
  friendsApiBaseUrl?: string
): Promise<EnhancedMatrixClient> {
  return createEnhancedMatrixClient({
    baseUrl,
    accessToken,
    userId,
    friendsApiBaseUrl
  })
}

/**
 * 扩展现有 Matrix 客户端
 *
 * @param client 现有的 Matrix 客户端
 * @param friendsApiBaseUrl Friends API 基础 URL (可选)
 * @returns 扩展后的客户端
 *
 * @example
 * ```typescript
 * import { createClient } from 'matrix-js-sdk';
 * import { extendMatrixClient } from '@/sdk/matrix-friends/factory';
 *
 * const baseClient = createClient({
 *   baseUrl: 'https://matrix.cjystx.top:443',
 *   accessToken: 'syt_...',
 *   userId: '@user:cjystx.top',
 * });
 *
 * const enhancedClient = extendMatrixClient(baseClient);
 * ```
 */
export function extendMatrixClient(client: MatrixClientLike, friendsApiBaseUrl?: string): EnhancedMatrixClient {
  // 创建 Friends API 扩展
  const friendsApi = new MatrixFriendsApiExtension(client, friendsApiBaseUrl || client.getHomeserverUrl?.() || '')

  // 将扩展添加到客户端
  // 注意: configurable 设为 true 以支持测试环境中的重新定义
  Object.defineProperty(client, 'friends', {
    value: friendsApi,
    writable: false,
    enumerable: true,
    configurable: true // 允许在测试中重新定义
  })

  return client as EnhancedMatrixClient
}

/**
 * 检查客户端是否已扩展 Friends API
 *
 * @param client Matrix 客户端
 * @returns 是否已扩展
 */
export function isFriendsApiEnabled(client: MatrixClientLike): boolean {
  return 'friends' in client && typeof (client as any).friends === 'object'
}
