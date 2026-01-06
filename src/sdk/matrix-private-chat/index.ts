/**
 * Matrix PrivateChat SDK
 * 基于 matrix-js-sdk v39.1.3
 * 后端服务器: https://matrix.cjystx.top:443
 *
 * @example
 * ```typescript
 * import { createEnhancedMatrixClient, extendMatrixClient } from '@/sdk/matrix-private-chat';
 *
 * // 方式1: 创建新的增强客户端
 * const client = await createEnhancedMatrixClient({
 *   baseUrl: 'https://matrix.cjystx.top',
 *   accessToken: 'syt_...',
 *   userId: '@user:server.com',
 * });
 *
 * // 方式2: 扩展现有客户端
 * extendMatrixClient(existingClient);
 *
 * // 使用 PrivateChat API
 * const sessions = await client.privateChatV2.listSessions();
 * const session = await client.privateChatV2.createSession({
 *   participants: ['@alice:server.com'],
 *   session_name: 'Private Chat',
 * });
 * await client.privateChatV2.sendText(session.session_id, 'Hello!');
 *
 * // 订阅消息
 * const unsubscribe = client.privateChatV2.subscribeToMessages(
 *   session.session_id,
 *   (message) => {
 *     console.log('New message:', message.content);
 *   }
 * );
 *
 * // 取消订阅
 * unsubscribe();
 *
 * // 清理资源
 * client.privateChatV2.dispose();
 * ```
 */

// =============================================================================
// 类型导出
// =============================================================================

export type {
  // 基础类型
  BaseResponse,
  // 数据模型
  PrivateChatSession,
  PrivateChatMessage,
  PrivateChatStats,
  // API 请求类型
  CreateSessionOptions,
  SendMessageOptions,
  GetMessagesOptions,
  DeleteSessionOptions,
  GetStatsOptions,
  ListSessionsOptions,
  // API 响应类型
  CreateSessionResponse,
  SendMessageResponse,
  ListSessionsResponse,
  GetMessagesResponse,
  GetStatsResponse,
  OperationResponse,
  // 扩展类型
  MessageHandler,
  MatrixClientLike,
  EnhancedMatrixClient,
  PrivateChatApi
} from './types.js'

// =============================================================================
// 错误类型导出
// =============================================================================

export {
  PrivateChatError,
  CreateSessionError,
  SendMessageError,
  SessionNotFoundError,
  DeleteSessionError,
  NetworkError
} from './types.js'

// =============================================================================
// 核心类导出
// =============================================================================

export { PrivateChatExtension } from './PrivateChatExtension.js'

// =============================================================================
// 工厂函数导出
// =============================================================================

export {
  createEnhancedMatrixClient,
  extendMatrixClient,
  isPrivateChatApiEnabled,
  getPrivateChatApi,
  createFromEnv,
  type EnhancedMatrixClientConfig
} from './factory.js'

// =============================================================================
// 工具函数导出
// =============================================================================

export {
  buildQueryString,
  checkResponse,
  parseJsonResponse,
  fetchAndParse,
  checkBaseStatus,
  formatUserId,
  isValidSessionId,
  validateParticipants,
  delay,
  safeStringify,
  truncate,
  formatTimestamp,
  isSessionExpired,
  getSessionTTL,
  createDebugLogger,
  retry
} from './utils.js'

// =============================================================================
// 默认导出
// =============================================================================

export { PrivateChatExtension as default } from './PrivateChatExtension.js'
