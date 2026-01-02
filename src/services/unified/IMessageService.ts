/**
 * 统一消息服务接口
 *
 * 定义跨协议的消息发送标准接口
 * 支持 Matrix、WebSocket 等多种协议
 */

// ==================== 类型定义 ====================

/**
 * 发送消息参数
 */
export interface SendMessageParams {
  /** 房间ID */
  roomId: string
  /** 消息类型 */
  msgType: string
  /** 消息内容 */
  content: unknown
  /** 临时消息ID */
  tempMsgId?: string
  /** 回复的消息 */
  replyTo?: string
  /** 附加选项 */
  options?: MessageSendOptions
}

/**
 * 消息发送选项
 */
export interface MessageSendOptions {
  /** 是否加密 */
  encrypted?: boolean
  /** 超时时间（毫秒） */
  timeout?: number
  /** 重试次数 */
  retryCount?: number
  /** 自定义元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 发送文件参数
 */
export interface SendFileParams {
  /** 房间ID */
  roomId: string
  /** 文件对象 */
  file: File
  /** 文件名（可选，默认使用file.name） */
  fileName?: string
  /** 临时消息ID */
  tempMsgId?: string
  /** 附加选项 */
  options?: MessageSendOptions
}

/**
 * 消息撤回参数
 */
export interface RecallMessageParams {
  /** 房间ID */
  roomId: string
  /** 消息ID */
  eventId: string
  /** 撤回原因 */
  reason?: string
}

/**
 * 获取消息历史参数
 */
export interface GetMessageHistoryParams {
  /** 房间ID */
  roomId: string
  /** 限制数量 */
  limit?: number
  /** 分页 token */
  fromToken?: string
  /** 方向 */
  direction?: 'f' | 'b'
}

/**
 * 消息对象
 */
export interface Message {
  /** 消息ID */
  eventId: string
  /** 房间ID */
  roomId: string
  /** 发送者ID */
  senderId: string
  /** 消息类型 */
  type: string
  /** 消息内容 */
  content: unknown
  /** 时间戳 */
  timestamp: number
  /** 发送状态 */
  status?: 'sending' | 'sent' | 'failed'
  /** 是否已加密 */
  encrypted?: boolean
}

/**
 * 消息发送结果
 */
export interface MessageSendResult {
  /** 成功标志 */
  success: boolean
  /** 消息ID */
  eventId?: string | undefined
  /** 错误信息 */
  error?: string | undefined
  /** 临时消息ID（用于匹配） */
  tempMsgId?: string | undefined
}

/**
 * 协议类型
 */
export enum ProtocolType {
  /** Matrix 协议 */
  MATRIX = 'matrix',
  /** WebSocket 协议 */
  WEBSOCKET = 'websocket',
  /** 混合模式 */
  HYBRID = 'hybrid'
}

// ==================== 接口定义 ====================

/**
 * 统一消息服务接口
 *
 * 所有消息服务适配器必须实现此接口
 */
export interface IMessageService {
  /**
   * 发送文本消息
   * @param params 发送参数
   * @returns 发送结果
   */
  sendMessage(params: SendMessageParams): Promise<MessageSendResult>

  /**
   * 发送文件
   * @param params 文件参数
   * @returns 发送结果
   */
  sendFile(params: SendFileParams): Promise<MessageSendResult>

  /**
   * 撤回消息
   * @param params 撤回参数
   * @returns 是否成功
   */
  recallMessage(params: RecallMessageParams): Promise<boolean>

  /**
   * 获取消息历史
   * @param params 查询参数
   * @returns 消息列表
   */
  getMessageHistory(params: GetMessageHistoryParams): Promise<Message[]>

  /**
   * 获取服务支持的协议类型
   */
  getProtocolType(): ProtocolType

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean

  /**
   * 初始化服务
   */
  initialize(): Promise<void>

  /**
   * 销毁服务
   */
  destroy(): void
}

/**
 * 消息服务事件监听器
 */
export interface IMessageServiceListener {
  /**
   * 消息发送中
   */
  onSending?(tempMsgId: string): void

  /**
   * 消息发送成功
   */
  onSendSuccess?(tempMsgId: string, eventId: string): void

  /**
   * 消息发送失败
   */
  onSendFailed?(tempMsgId: string, error: Error): void

  /**
   * 收到新消息
   */
  onNewMessage?(message: Message): void

  /**
   * 消息撤回
   */
  onMessageRecalled?(eventId: string): void
}

/**
 * 消息服务工厂接口
 */
export interface IMessageServiceFactory {
  /**
   * 创建指定协议的消息服务
   */
  createService(protocol: ProtocolType): IMessageService

  /**
   * 获取默认服务
   */
  getDefaultService(): IMessageService
}
