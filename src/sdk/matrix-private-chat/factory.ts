/**
 * Matrix PrivateChat 扩展工厂函数
 * 基于 matrix-js-sdk v39.1.3
 */

import type { MatrixClientLike, EnhancedMatrixClient } from './types.js'
import { PrivateChatExtension } from './PrivateChatExtension.js'
import { createDebugLogger } from './utils.js'

const logger = createDebugLogger('PrivateChatFactory')

/**
 * 增强的 Matrix 客户端配置
 */
export interface EnhancedMatrixClientConfig {
  baseUrl: string // Matrix 服务器地址
  accessToken: string // 访问令牌
  userId: string // 用户 ID
  deviceId?: string // 设备 ID（可选）
  privateChatApiBaseUrl?: string // PrivateChat API 基础地址（可选）
}

/**
 * 创建增强的 Matrix 客户端（包含 PrivateChat API）
 *
 * @example
 * ```typescript
 * const client = await createEnhancedMatrixClient({
 *   baseUrl: 'https://matrix.cjystx.top',
 *   accessToken: 'syt_...',
 *   userId: '@user:server.com',
 * });
 *
 * // 使用 PrivateChat API
 * const sessions = await client.privateChatV2.listSessions();
 * ```
 */
export async function createEnhancedMatrixClient(config: EnhancedMatrixClientConfig): Promise<EnhancedMatrixClient> {
  // 动态导入 matrix-js-sdk
  const matrixJs = await import('matrix-js-sdk')

  // 创建基础客户端
  const baseClient = matrixJs.createClient({
    baseUrl: config.baseUrl,
    accessToken: config.accessToken,
    deviceId: config.deviceId
  }) as unknown as MatrixClientLike

  // 扩展客户端
  extendMatrixClient(baseClient, config.privateChatApiBaseUrl || config.baseUrl)

  logger.info('Enhanced Matrix client created', {
    userId: config.userId,
    baseUrl: config.baseUrl
  })

  return baseClient as EnhancedMatrixClient
}

/**
 * 扩展现有 Matrix 客户端
 *
 * 为已有的 Matrix 客户端添加 PrivateChat API 功能。
 *
 * @example
 * ```typescript
 * import { MatrixClient } from 'matrix-js-sdk';
 *
 * const client = new MatrixClient({ ... });
 * extendMatrixClient(client);
 *
 * // 现在可以使用 PrivateChat API
 * await client.privateChatV2.createSession({ ... });
 * ```
 */
export function extendMatrixClient(client: MatrixClientLike, privateChatApiBaseUrl?: string): void {
  // 检查是否已经扩展
  if (isPrivateChatApiEnabled(client)) {
    logger.debug('Client already has PrivateChat API')
    return
  }

  // 获取 PrivateChat API 基础地址
  const baseUrl = privateChatApiBaseUrl || client.getHomeserverUrl?.() || ''

  if (!baseUrl) {
    throw new Error('Cannot determine PrivateChat API base URL')
  }

  // 创建 PrivateChat API 扩展
  const privateChatApi = new PrivateChatExtension(client, baseUrl)

  // 添加到客户端（使用不可写属性）
  Object.defineProperty(client, 'privateChatV2', {
    value: privateChatApi,
    writable: false,
    enumerable: true,
    configurable: true
  })

  logger.info('Matrix client extended with PrivateChat API', {
    baseUrl
  })
}

/**
 * 检查客户端是否已启用 PrivateChat API
 *
 * @example
 * ```typescript
 * if (isPrivateChatApiEnabled(client)) {
 *   await client.privateChatV2.listSessions();
 * }
 * ```
 */
export function isPrivateChatApiEnabled(client: MatrixClientLike): boolean {
  return 'privateChatV2' in client && typeof client.privateChatV2 === 'object' && client.privateChatV2 !== null
}

/**
 * 获取 PrivateChat API 实例
 *
 * 如果客户端未扩展，会抛出错误。
 *
 * @example
 * ```typescript
 * const privateChat = getPrivateChatApi(client);
 * await privateChat.listSessions();
 * ```
 */
export function getPrivateChatApi(client: MatrixClientLike): PrivateChatExtension {
  if (!isPrivateChatApiEnabled(client)) {
    throw new Error('PrivateChat API not enabled. Please call extendMatrixClient() first.')
  }

  return client.privateChatV2 as PrivateChatExtension
}

/**
 * 从环境变量创建增强客户端
 *
 * 读取 VITE_ 前缀的环境变量来配置客户端。
 * 适用于开发环境。
 *
 * @example
 * ```typescript
 * const client = await createFromEnv();
 * ```
 */
export async function createFromEnv(): Promise<EnhancedMatrixClient> {
  const baseUrl = import.meta.env.VITE_MATRIX_BASE_URL
  const accessToken = import.meta.env.VITE_MATRIX_ACCESS_TOKEN
  const userId = import.meta.env.VITE_MATRIX_USER_ID

  if (!baseUrl || !accessToken || !userId) {
    throw new Error(
      'Missing required environment variables: VITE_MATRIX_BASE_URL, VITE_MATRIX_ACCESS_TOKEN, VITE_MATRIX_USER_ID'
    )
  }

  return createEnhancedMatrixClient({
    baseUrl,
    accessToken,
    userId
  })
}
