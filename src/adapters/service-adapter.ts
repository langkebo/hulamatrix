/**
 * 服务适配器接口
 * 统一不同服务实现的标准接口
 */

export interface ServiceAdapter {
  /**
   * 服务名称
   */
  name: string

  /**
   * 优先级（数值越高优先级越高）
   */
  priority: number

  /**
   * 是否就绪
   */
  isReady(): Promise<boolean>

  /**
   * 初始化服务
   */
  initialize?(): Promise<void>

  /**
   * 清理资源
   */
  cleanup?(): Promise<void>
}

export interface MessageAdapter extends ServiceAdapter {
  /**
   * 发送消息
   */
  sendMessage(params: { roomId: string; content: unknown; type?: string; encrypted?: boolean }): Promise<unknown>

  /**
   * 获取历史消息
   */
  getHistoryMessages(params: { roomId: string; limit?: number; from?: string }): Promise<unknown[]>

  /**
   * 标记消息已读
   */
  markAsRead(params: { roomId: string; messageId: string }): Promise<void>
}

export interface AuthAdapter extends ServiceAdapter {
  /**
   * 登录
   */
  login(params: { username: string; password: string; deviceName?: string }): Promise<unknown>

  /**
   * 登出
   */
  logout(): Promise<void>

  /**
   * 刷新token
   */
  refreshToken?(): Promise<void>

  /**
   * 验证token
   */
  validateToken?(): Promise<boolean>
}

export interface RoomAdapter extends ServiceAdapter {
  /**
   * 创建房间
   */
  createRoom(params: { name: string; type?: 'private' | 'public'; topic?: string; avatar?: string }): Promise<unknown>

  /**
   * 加入房间
   * @param params.roomId Room ID to join
   * @param params.reason Optional reason for joining
   * @param params.viaServers Optional list of servers to route join request through (for federation)
   */
  joinRoom(params: { roomId: string; reason?: string; viaServers?: string[] }): Promise<void>

  /**
   * 离开房间
   */
  leaveRoom(params: { roomId: string; reason?: string }): Promise<void>

  /**
   * 获取房间列表
   */
  getRooms(): Promise<unknown[]>

  /**
   * 获取房间详情
   */
  getRoomInfo(roomId: string): Promise<unknown>
}

export interface FileAdapter extends ServiceAdapter {
  /**
   * 上传文件
   */
  uploadFile(params: { file: File | Blob; roomId?: string; onProgress?: (progress: number) => void }): Promise<unknown>

  /**
   * 下载文件
   */
  downloadFile(params: {
    fileId: string
    savePath?: string
    onProgress?: (progress: number) => void
    resumeFrom?: number
  }): Promise<unknown>

  /**
   * 获取文件预览
   */
  getPreview(fileId: string): Promise<string>
}

export interface SyncAdapter extends ServiceAdapter {
  /**
   * 开始同步
   */
  startSync(params?: { roomId?: string; fromToken?: string }): Promise<void>

  /**
   * 停止同步
   */
  stopSync(): Promise<void>

  /**
   * 获取同步状态
   */
  getSyncStatus(): Promise<{
    status: 'syncing' | 'synced' | 'error'
    lastSync?: number
    error?: string
  }>
}

/**
 * 好友状态
 */
export type FriendStatus = 'online' | 'offline' | 'unavailable' | 'away'

/**
 * 好友信息
 */
export interface Friend {
  /** 用户ID */
  userId: string
  /** 显示名称 */
  displayName: string
  /** 头像URL */
  avatarUrl?: string
  /** 在线状态 */
  status?: FriendStatus
  /** 分类ID */
  categoryId?: string | null
  /** 备注 */
  remark?: string
  /** 最后活跃时间 */
  lastActive?: number
}

/**
 * 好友分类
 */
export interface FriendCategory {
  /** 分类ID */
  categoryId: string
  /** 分类名称 */
  name: string
  /** 描述 */
  description?: string
  /** 颜色 */
  color?: string
  /** 排序 */
  sort?: number
  /** 好友数量 */
  count?: number
}

/**
 * 好友请求
 */
export interface FriendRequest {
  /** 请求ID */
  requestId: string
  /** 发送者ID */
  fromUserId: string
  /** 发送者名称 */
  fromDisplayName: string
  /** 发送者头像 */
  fromAvatarUrl?: string
  /** 请求消息 */
  message?: string
  /** 房间ID */
  roomId?: string
  /** 请求时间 */
  timestamp: number
}

/**
 * Presence 更新事件
 */
export interface PresenceUpdateEvent {
  userId: string
  status: FriendStatus
  lastActive?: number
}

/**
 * Presence 更新回调
 * 注意: 实际 API 传递单个事件对象，而不是数组
 */
export type PresenceUpdateCallback = (event: PresenceUpdateEvent) => void

/**
 * 好友适配器接口
 */
export interface FriendAdapter extends ServiceAdapter {
  /**
   * 获取好友列表
   */
  listFriends(options?: { includePresence?: boolean; categoryId?: string | null }): Promise<Friend[]>

  /**
   * 搜索好友
   */
  searchFriends(query: string, limit?: number): Promise<Friend[]>

  /**
   * 发送好友请求
   * @returns requestId
   */
  sendFriendRequest(targetUserId: string, message?: string): Promise<string>

  /**
   * 获取待处理的好友请求
   */
  getPendingRequests(): Promise<FriendRequest[]>

  /**
   * 接受好友请求
   */
  acceptFriendRequest(requestId: string, categoryId?: string): Promise<void>

  /**
   * 拒绝好友请求
   */
  rejectFriendRequest(requestId: string): Promise<void>

  /**
   * 删除好友
   */
  removeFriend(userId: string): Promise<void>

  /**
   * 获取好友在线状态
   */
  getPresence(userId: string): Promise<FriendStatus>

  /**
   * 订阅 Presence 更新
   */
  subscribeToPresence(callback: PresenceUpdateCallback): () => void

  /**
   * 获取好友分类列表
   */
  listCategories(): Promise<FriendCategory[]>

  /**
   * 创建好友分类
   */
  createCategory(name: string, description?: string, color?: string): Promise<FriendCategory>

  /**
   * 删除好友分类
   */
  deleteCategory(categoryId: string): Promise<void>

  /**
   * 设置好友分类
   */
  setFriendCategory(userId: string, categoryId: string | null): Promise<void>

  /**
   * 更新好友备注
   */
  updateFriendRemark(userId: string, remark: string): Promise<void>
}

/**
 * 私密聊天会话
 */
export interface PrivateChatSession {
  /** 会话ID */
  sessionId: string
  /** 用户ID */
  userId: string
  /** 用户名称 */
  displayName: string
  /** 头像URL */
  avatarUrl?: string
  /** 未读消息数 */
  unreadCount: number
  /** 最后消息 */
  lastMessage?: {
    content: string
    timestamp: number
    isSelf: boolean
  }
  /** 消息自毁时间（秒） */
  ttl?: number
  /** 是否已读 */
  isRead: boolean
}

/**
 * 私密聊天消息
 */
export interface PrivateChatMessage {
  /** 消息ID */
  messageId: string
  /** 会话ID */
  sessionId: string
  /** 发送者ID */
  senderId: string
  /** 消息内容 */
  content: string
  /** 消息类型 */
  type: 'text' | 'image' | 'file' | 'voice' | 'video'
  /** 发送时间 */
  timestamp: number
  /** 是否是自己发送的 */
  isSelf: boolean
  /** 消息状态 */
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  /** 是否已销毁 */
  isDestroyed?: boolean
  /** 销毁时间 */
  destroyAt?: number
}

/**
 * 私密聊天适配器接口
 */
export interface PrivateChatAdapter extends ServiceAdapter {
  /**
   * 获取私密聊天会话列表
   */
  listSessions(): Promise<PrivateChatSession[]>

  /**
   * 创建私密聊天会话
   * @returns sessionId
   */
  createSession(userId: string): Promise<string>

  /**
   * 获取私密聊天消息
   */
  getMessages(sessionId: string, limit?: number, from?: string): Promise<PrivateChatMessage[]>

  /**
   * 发送私密消息
   * @returns messageId
   */
  sendMessage(sessionId: string, content: string, type?: PrivateChatMessage['type'], ttl?: number): Promise<string>

  /**
   * 标记消息已读
   */
  markAsRead(sessionId: string, messageId: string): Promise<void>

  /**
   * 设置消息自毁
   */
  setMessageSelfDestruct(sessionId: string, messageId: string, ttl: number): Promise<void>

  /**
   * 撤回消息
   */
  recallMessage(sessionId: string, messageId: string): Promise<void>

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): Promise<void>

  /**
   * 清除会话历史
   */
  clearHistory(sessionId: string): Promise<void>

  /**
   * 订阅新消息
   */
  subscribeToMessages(sessionId: string, callback: (message: PrivateChatMessage) => void): () => void

  /**
   * 订阅会话更新
   */
  subscribeToSessionUpdates(callback: (session: PrivateChatSession) => void): () => void
}

/**
 * 适配器工厂接口
 */
export interface AdapterFactory {
  /**
   * 创建消息适配器
   */
  createMessageAdapter(): MessageAdapter

  /**
   * 创建认证适配器
   */
  createAuthAdapter(): AuthAdapter

  /**
   * 创建房间适配器
   */
  createRoomAdapter(): RoomAdapter

  /**
   * 创建文件适配器
   */
  createFileAdapter(): FileAdapter

  /**
   * 创建同步适配器
   */
  createSyncAdapter(): SyncAdapter

  /**
   * 创建好友适配器
   */
  createFriendAdapter(): FriendAdapter

  /**
   * 创建私密聊天适配器
   */
  createPrivateChatAdapter(): PrivateChatAdapter
}

/**
 * 适配器管理器接口
 */
export interface AdapterManager {
  /**
   * 注册适配器
   */
  registerAdapter<T extends ServiceAdapter>(type: string, name: string, adapter: T): void

  /**
   * 获取适配器
   */
  getAdapter<T extends ServiceAdapter>(type: string, name?: string): T | null

  /**
   * 获取最佳适配器
   */
  getBestAdapter<T extends ServiceAdapter>(type: string): Promise<T | null>

  /**
   * 移除适配器
   */
  removeAdapter(type: string, name: string): void

  /**
   * 列出所有适配器
   */
  listAdapters(type?: string): Array<{
    type: string
    name: string
    adapter: ServiceAdapter
    ready: boolean
  }>
}

/**
 * 服务适配器配置
 */
export interface AdapterConfig {
  /**
   * 是否启用
   */
  enabled: boolean

  /**
   * 优先级
   */
  priority: number

  /**
   * 配置参数
   */
  config?: Record<string, unknown>

  /**
   * 故障转移设置
   */
  fallback?: {
    /**
     * 故障转移延迟（毫秒）
     */
    delay: number

    /**
     * 最大重试次数
     */
    maxRetries: number

    /**
     * 失败超时（毫秒）
     */
    timeout: number
  }
}

/**
 * 适配器上下文
 */
export interface AdapterContext {
  /**
   * 网络状况
   */
  networkCondition?: 'good' | 'poor'

  /**
   * 功能特性
   */
  features?: string[]

  /**
   * 用户偏好
   */
  preferences?: Record<string, unknown>

  /**
   * 环境信息
   */
  environment?: {
    platform: string
    version: string
    capabilities: string[]
  }
}
