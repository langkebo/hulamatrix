/**
 * Matrix PrivateChat API 类型定义
 * 基于 matrix-js-sdk v39.1.3
 * 后端服务器: https://matrix.cjystx.top:443
 */

// =============================================================================
// 基础类型
// =============================================================================

/**
 * 基础响应
 */
export interface BaseResponse {
  status: 'ok' | 'error'
  error?: string
  errcode?: string
}

// =============================================================================
// 数据模型
// =============================================================================

/**
 * 私聊会话
 */
export interface PrivateChatSession {
  session_id: string // 会话唯一 ID (UUID)
  session_name?: string // 会话名称
  creator_id: string // 创建者用户 ID
  participants: string[] // 参与者列表
  created_at: string // 创建时间 (ISO 8601)
  updated_at?: string // 更新时间 (ISO 8601)
  ttl_seconds?: number // 会话生存时间（秒）
  expires_at?: string // 过期时间 (ISO 8601)
  status?: string // 会话状态
}

/**
 * 私聊消息
 */
export interface PrivateChatMessage {
  id?: string // 消息 ID (V1)
  message_id?: string // 消息 ID (V2)
  session_id: string // 会话 ID
  sender_id: string // 发送者用户 ID
  content: string // 消息内容（可能是加密后的 Base64）
  type: 'text' | 'image' | 'file' | 'audio' | 'video' // 消息类型
  message_type?: string // 消息类型（后端字段）
  created_at: string // 创建时间 (ISO 8601)
  expires_at?: string // 过期时间 (ISO 8601)
}

/**
 * 会话统计
 */
export interface PrivateChatStats {
  message_count: number // 消息总数
  participant_count: number // 参与者数量
  last_activity: string // 最后活跃时间 (ISO 8601)
}

// =============================================================================
// API 请求类型
// =============================================================================

/**
 * 创建会话选项
 */
export interface CreateSessionOptions {
  participants: string[] // 参与者列表 (必需)
  session_name?: string // 会话名称
  creator_id?: string // 创建者 ID（可选，默认使用 token 用户）
  ttl_seconds?: number // 消息/会话存活秒数 (可选，默认 0 不销毁)
  auto_delete?: boolean // 是否自动销毁会话 (可选)
}

/**
 * 发送消息选项
 */
export interface SendMessageOptions {
  session_id: string // 会话 ID (必需)
  content: string // 消息内容 (必需)
  sender_id?: string // 发送者 ID (可选，默认使用 token 用户)
  type?: 'text' | 'image' | 'file' | 'audio' | 'video' // 消息类型
  message_type?: string // 消息类型（后端字段）
  ttl_seconds?: number // 该条消息的 TTL (可选)
}

/**
 * 获取消息选项
 */
export interface GetMessagesOptions {
  session_id: string // 会话 ID (必需)
  user_id?: string // 用户 ID (V2 需要，可选)
  limit?: number // 每页数量 (默认: 50)
  before?: string // 获取此消息 ID 之前的消息
}

/**
 * 删除会话选项
 */
export interface DeleteSessionOptions {
  session_id: string // 会话 ID (必需)
  user_id?: string // 用户 ID (V2 需要，可选)
}

/**
 * 获取统计选项
 */
export interface GetStatsOptions {
  session_id: string // 会话 ID (必需)
}

// =============================================================================
// API 响应类型
// =============================================================================

/**
 * 创建会话响应
 */
export interface CreateSessionResponse extends BaseResponse {
  session_id?: string // 会话 ID
  session?: PrivateChatSession // 会话详情（可选）
}

/**
 * 发送消息响应
 */
export interface SendMessageResponse extends BaseResponse {
  message_id?: string // 消息 ID
}

/**
 * 获取会话列表响应
 */
export interface ListSessionsResponse extends BaseResponse {
  sessions?: PrivateChatSession[] // 会话列表
}

/**
 * 获取消息响应
 */
export interface GetMessagesResponse extends BaseResponse {
  messages?: PrivateChatMessage[] // 消息列表
}

/**
 * 获取统计响应
 */
export interface GetStatsResponse extends BaseResponse {
  stats?: PrivateChatStats // 统计信息
}

/**
 * 操作响应
 */
export interface OperationResponse extends BaseResponse {
  // 通用操作响应
}

// =============================================================================
// 扩展类型
// =============================================================================

/**
 * 消息处理器类型
 */
export type MessageHandler = (message: PrivateChatMessage) => void

/**
 * Matrix 客户端接口（最小化）
 */
export interface MatrixClientLike {
  getAccessToken?(): string
  getUserId?(): string
  getHomeserverUrl?(): string
}

/**
 * 增强的 Matrix 客户端（包含 PrivateChat API）
 */
export interface EnhancedMatrixClient extends MatrixClientLike {
  privateChatV2: PrivateChatApi
}

/**
 * PrivateChat API 接口
 */
export interface PrivateChatApi {
  // 会话管理
  listSessions(options?: ListSessionsOptions): Promise<ListSessionsResponse>
  createSession(options: CreateSessionOptions): Promise<CreateSessionResponse>
  deleteSession(sessionId: string, options?: DeleteSessionOptions): Promise<OperationResponse>
  getSession(sessionId: string): PrivateChatSession | null
  hasSession(sessionId: string): boolean

  // 消息管理
  sendMessage(options: SendMessageOptions): Promise<SendMessageResponse>
  sendText(sessionId: string, content: string): Promise<string>
  getMessages(options: GetMessagesOptions): Promise<GetMessagesResponse>

  // 统计信息
  getStats(options: GetStatsOptions): Promise<GetStatsResponse>

  // 订阅和缓存
  subscribeToMessages(sessionId: string, handler: MessageHandler): () => void
  invalidateCache(): void

  // 资源清理
  dispose(): void
}

/**
 * 列出会话选项
 */
export interface ListSessionsOptions {
  user_id?: string // 用户 ID (V2 需要，可选)
}

// =============================================================================
// 错误类型
// =============================================================================

/**
 * PrivateChat 错误基类
 */
export class PrivateChatError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public body?: string
  ) {
    super(message)
    this.name = 'PrivateChatError'
  }

  /**
   * 检查是否为认证错误
   */
  isAuthError(): boolean {
    return this.statusCode === 401
  }

  /**
   * 检查是否为权限错误
   */
  isForbidden(): boolean {
    return this.statusCode === 403
  }

  /**
   * 检查是否为参数错误
   */
  isInvalidParam(): boolean {
    return this.statusCode === 400
  }

  /**
   * 检查是否为未找到错误
   */
  isNotFound(): boolean {
    return this.statusCode === 404
  }
}

/**
 * 创建会话错误
 */
export class CreateSessionError extends PrivateChatError {
  constructor(message: string, statusCode?: number, body?: string) {
    super(message, statusCode || 400, body)
    this.name = 'CreateSessionError'
  }
}

/**
 * 发送消息错误
 */
export class SendMessageError extends PrivateChatError {
  constructor(message: string, statusCode?: number, body?: string) {
    super(message, statusCode || 400, body)
    this.name = 'SendMessageError'
  }
}

/**
 * 会话不存在错误
 */
export class SessionNotFoundError extends PrivateChatError {
  constructor(message: string, statusCode?: number, body?: string) {
    super(message, statusCode || 404, body)
    this.name = 'SessionNotFoundError'
  }
}

/**
 * 删除会话错误
 */
export class DeleteSessionError extends PrivateChatError {
  constructor(message: string, statusCode?: number, body?: string) {
    super(message, statusCode || 400, body)
    this.name = 'DeleteSessionError'
  }
}

/**
 * 网络错误
 */
export class NetworkError extends PrivateChatError {
  constructor(message: string) {
    super(message, 0, '')
    this.name = 'NetworkError'
  }
}
