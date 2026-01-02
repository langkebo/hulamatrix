/**
 * 统一消息服务入口
 *
 * 提供跨协议的消息发送门面
 * Phase 1 Migration: 支持从自定义WebSocket迁移到Matrix标准协议
 */

import { logger } from '@/utils/logger'
import {
  ProtocolType,
  type SendMessageParams,
  type SendFileParams,
  type RecallMessageParams,
  type GetMessageHistoryParams,
  type Message,
  type MessageSendResult,
  type IMessageServiceListener
} from './IMessageService'
import { BaseMessageAdapter } from './BaseMessageAdapter'
import { matrixMessageAdapter } from './adapters/MatrixMessageAdapter'
import { isWebSocketDisabled } from '@/utils/migration-status'

/**
 * 统一消息服务门面
 *
 * 根据配置自动选择合适的协议发送消息
 * Phase 1: 当WebSocket禁用时，强制使用Matrix协议
 */
class MessageServiceFacade {
  private currentProtocol: ProtocolType = ProtocolType.HYBRID
  private adapters: Map<ProtocolType, BaseMessageAdapter> = new Map()

  constructor() {
    this.initialize()
  }

  /**
   * 初始化服务
   */
  private async initialize(): Promise<void> {
    logger.info('[MessageServiceFacade] 初始化统一消息服务')

    // Phase 1 Migration: 检查WebSocket禁用状态
    const websocketDisabled = isWebSocketDisabled()

    // 注册 Matrix 适配器
    try {
      await matrixMessageAdapter.initialize()
      if (matrixMessageAdapter.isAvailable()) {
        this.adapters.set(ProtocolType.MATRIX, matrixMessageAdapter)
      }
    } catch (error) {
      logger.warn('[MessageServiceFacade] Matrix 适配器初始化失败:', error)
    }

    // 根据环境变量和迁移状态选择默认协议
    const matrixEnabled = import.meta.env.VITE_MATRIX_ENABLED === 'on'

    if (websocketDisabled) {
      // Phase 1: WebSocket已禁用，强制使用Matrix
      this.currentProtocol = ProtocolType.MATRIX
      logger.info('[MessageServiceFacade] Phase 1 Migration: WebSocket disabled, using Matrix protocol')
    } else if (matrixEnabled) {
      this.currentProtocol = ProtocolType.MATRIX
    }

    logger.info(
      '[MessageServiceFacade] 当前协议:',
      this.currentProtocol,
      `websocketDisabled: ${websocketDisabled}, matrixEnabled: ${matrixEnabled}`
    )
  }

  /**
   * 发送消息
   */
  async sendMessage(params: SendMessageParams): Promise<MessageSendResult> {
    const adapter = this.selectAdapter()

    if (!adapter) {
      return {
        success: false,
        error: '没有可用的消息服务',
        tempMsgId: params.tempMsgId
      }
    }

    try {
      return await adapter.sendMessage(params)
    } catch (error) {
      logger.error('[MessageServiceFacade] 发送消息失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        tempMsgId: params.tempMsgId
      }
    }
  }

  /**
   * 发送文件
   */
  async sendFile(params: SendFileParams): Promise<MessageSendResult> {
    const adapter = this.selectAdapter()

    if (!adapter) {
      return {
        success: false,
        error: '没有可用的消息服务',
        tempMsgId: params.tempMsgId
      }
    }

    try {
      return await adapter.sendFile(params)
    } catch (error) {
      logger.error('[MessageServiceFacade] 发送文件失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        tempMsgId: params.tempMsgId
      }
    }
  }

  /**
   * 撤回消息
   */
  async recallMessage(params: RecallMessageParams): Promise<boolean> {
    const adapter = this.selectAdapter()

    if (!adapter) {
      logger.warn('[MessageServiceFacade] 没有可用的消息服务')
      return false
    }

    try {
      return await adapter.recallMessage(params)
    } catch (error) {
      logger.error('[MessageServiceFacade] 撤回消息失败:', error)
      return false
    }
  }

  /**
   * 获取消息历史
   */
  async getMessageHistory(params: GetMessageHistoryParams): Promise<Message[]> {
    const adapter = this.selectAdapter()

    if (!adapter) {
      logger.warn('[MessageServiceFacade] 没有可用的消息服务')
      return []
    }

    try {
      return await adapter.getMessageHistory(params)
    } catch (error) {
      logger.error('[MessageServiceFacade] 获取消息历史失败:', error)
      return []
    }
  }

  /**
   * 设置当前协议
   */
  setProtocol(protocol: ProtocolType): void {
    this.currentProtocol = protocol
    logger.info('[MessageServiceFacade] 切换协议到:', protocol)
  }

  /**
   * 获取当前协议
   */
  getProtocol(): ProtocolType {
    return this.currentProtocol
  }

  /**
   * 选择合适的适配器
   */
  private selectAdapter(): BaseMessageAdapter | undefined {
    // 优先使用当前协议
    let adapter = this.adapters.get(this.currentProtocol)

    // 如果当前协议不可用，尝试其他协议
    if (!adapter || !adapter.isAvailable()) {
      for (const [protocol, candidate] of this.adapters.entries()) {
        if (candidate.isAvailable()) {
          logger.info(`[MessageServiceFacade] 切换到协议: ${protocol}`)
          adapter = candidate
          break
        }
      }
    }

    return adapter
  }

  /**
   * 添加消息监听器
   */
  addListener(listener: IMessageServiceListener): void {
    this.adapters.forEach((adapter) => adapter.addListener(listener))
  }

  /**
   * 移除消息监听器
   */
  removeListener(listener: IMessageServiceListener): void {
    this.adapters.forEach((adapter) => adapter.removeListener(listener))
  }
}

// 导出单例实例
export const messageServiceFacade = new MessageServiceFacade()

// 导出便捷函数
export const sendMessage = (params: SendMessageParams) => messageServiceFacade.sendMessage(params)
export const sendFile = (params: SendFileParams) => messageServiceFacade.sendFile(params)
export const recallMessage = (params: RecallMessageParams) => messageServiceFacade.recallMessage(params)
export const getMessageHistory = (params: GetMessageHistoryParams) => messageServiceFacade.getMessageHistory(params)

// 默认导出
export default messageServiceFacade
