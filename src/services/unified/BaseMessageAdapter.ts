/**
 * 消息服务适配器基类
 *
 * 提供通用的消息服务实现，所有具体适配器都应继承此类
 */

import type {
  IMessageService,
  IMessageServiceListener,
  ProtocolType,
  SendMessageParams,
  SendFileParams,
  RecallMessageParams,
  GetMessageHistoryParams,
  Message,
  MessageSendResult
} from './IMessageService'
import { logger } from '@/utils/logger'

/**
 * 抽象消息服务适配器
 */
export abstract class BaseMessageAdapter implements IMessageService {
  protected listeners: Set<IMessageServiceListener> = new Set()
  protected initialized: boolean = false
  protected destroyed: boolean = false

  constructor() {
    this.initialize()
  }

  // ==================== 抽象方法（子类必须实现）====================

  /**
   * 获取协议类型
   */
  abstract getProtocolType(): ProtocolType

  /**
   * 检查服务是否可用
   */
  abstract isAvailable(): boolean

  /**
   * 初始化服务
   */
  abstract initialize(): Promise<void>

  /**
   * 发送消息的具体实现
   */
  protected abstract doSendMessage(params: SendMessageParams): Promise<MessageSendResult>

  /**
   * 发送文件的具体实现
   */
  protected abstract doSendFile(params: SendFileParams): Promise<MessageSendResult>

  /**
   * 撤回消息的具体实现
   */
  protected abstract doRecallMessage(params: RecallMessageParams): Promise<boolean>

  /**
   * 获取消息历史的具体实现
   */
  protected abstract doGetMessageHistory(params: GetMessageHistoryParams): Promise<Message[]>

  // ==================== 公共接口实现 ====================

  /**
   * 发送消息
   */
  async sendMessage(params: SendMessageParams): Promise<MessageSendResult> {
    this.checkState()

    const tempMsgId = params.tempMsgId || this.generateTempId()

    try {
      this.notifyListeners('onSending', tempMsgId)
      const result = await this.doSendMessage({ ...params, tempMsgId })

      if (result.success) {
        this.notifyListeners('onSendSuccess', tempMsgId, result.eventId!)
      } else {
        this.notifyListeners('onSendFailed', tempMsgId, new Error(result.error || '发送失败'))
      }

      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.notifyListeners('onSendFailed', tempMsgId, err)
      throw err
    }
  }

  /**
   * 发送文件
   */
  async sendFile(params: SendFileParams): Promise<MessageSendResult> {
    this.checkState()

    const tempMsgId = params.tempMsgId || this.generateTempId()

    try {
      this.notifyListeners('onSending', tempMsgId)
      const result = await this.doSendFile({ ...params, tempMsgId })

      if (result.success) {
        this.notifyListeners('onSendSuccess', tempMsgId, result.eventId!)
      } else {
        this.notifyListeners('onSendFailed', tempMsgId, new Error(result.error || '发送失败'))
      }

      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.notifyListeners('onSendFailed', tempMsgId, err)
      throw err
    }
  }

  /**
   * 撤回消息
   */
  async recallMessage(params: RecallMessageParams): Promise<boolean> {
    this.checkState()
    return this.doRecallMessage(params)
  }

  /**
   * 获取消息历史
   */
  async getMessageHistory(params: GetMessageHistoryParams): Promise<Message[]> {
    this.checkState()
    return this.doGetMessageHistory(params)
  }

  /**
   * 添加监听器
   */
  addListener(listener: IMessageServiceListener): void {
    this.listeners.add(listener)
  }

  /**
   * 移除监听器
   */
  removeListener(listener: IMessageServiceListener): void {
    this.listeners.delete(listener)
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.destroyed = true
    this.initialized = false
    this.listeners.clear()
  }

  // ==================== 受保护的方法 ====================

  /**
   * 通知所有监听器
   */
  protected notifyListeners(event: keyof IMessageServiceListener, ...args: unknown[]): void {
    this.listeners.forEach((listener) => {
      const handler = listener[event]
      if (typeof handler === 'function') {
        // Use Function.prototype.apply for type-safe listener invocation
        Function.prototype.apply.call(handler, listener, args)
      }
    })
  }

  /**
   * 生成临时消息ID
   */
  protected generateTempId(): string {
    return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * 检查服务状态
   */
  protected checkState(): void {
    if (this.destroyed) {
      throw new Error('消息服务已销毁')
    }
    if (!this.initialized) {
      throw new Error('消息服务未初始化')
    }
  }

  /**
   * 延迟执行（用于重试）
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 带重试的异步操作
   */
  protected async withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3, delayMs: number = 1000): Promise<T> {
    let lastError: Error | undefined

    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (i < maxRetries) {
          await this.delay(delayMs * (i + 1)) // 指数退避
        }
      }
    }

    throw lastError
  }
}

/**
 * 消息服务适配器工厂
 */
export class MessageServiceFactory {
  private static services: Map<ProtocolType, IMessageService> = new Map()

  /**
   * 注册消息服务
   */
  static register(protocol: ProtocolType, service: IMessageService): void {
    MessageServiceFactory.services.set(protocol, service)
  }

  /**
   * 获取消息服务
   */
  static get(protocol: ProtocolType): IMessageService | undefined {
    return MessageServiceFactory.services.get(protocol)
  }

  /**
   * 创建服务
   */
  static create(protocol: ProtocolType): IMessageService | undefined {
    const service = MessageServiceFactory.services.get(protocol)
    if (service && !service.isAvailable()) {
      logger.warn(`协议 ${protocol} 的服务不可用`)
      return undefined
    }
    return service
  }

  /**
   * 获取所有可用服务
   */
  static getAvailableServices(): IMessageService[] {
    return Array.from(MessageServiceFactory.services.values()).filter((s) => s.isAvailable())
  }

  /**
   * 销毁所有服务
   */
  static destroyAll(): void {
    MessageServiceFactory.services.forEach((service) => service.destroy())
    MessageServiceFactory.services.clear()
  }
}
