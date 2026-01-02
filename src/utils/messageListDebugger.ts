/**
 * 聊天列表调试工具
 * 用于诊断消息不显示问题
 */

import { useChatStore } from '@/stores/chat'
import { useGlobalStore } from '@/stores/global'
import { logger } from '@/utils/logger'

export interface MessageListDebugInfo {
  sessionListLength: number
  currentSessionRoomId: string
  messageMapKeys: string[]
  unreadCounts: Record<string, number>
  activeTimes: Record<string, number>
  lastMessages: Record<string, string>
}

export class MessageListDebugger {
  private chatStore = useChatStore()
  private globalStore = useGlobalStore()

  /**
   * 获取当前聊天列表的调试信息
   */
  getDebugInfo(): MessageListDebugInfo {
    const debugInfo: MessageListDebugInfo = {
      sessionListLength: this.chatStore.sessionList.length,
      currentSessionRoomId: this.globalStore.currentSessionRoomId || '',
      messageMapKeys: Object.keys(this.chatStore.messageMap),
      unreadCounts: {},
      activeTimes: {},
      lastMessages: {}
    }

    // 收集会话的详细信息
    this.chatStore.sessionList.forEach((session) => {
      debugInfo.unreadCounts[session.roomId] = session.unreadCount || 0
      debugInfo.activeTimes[session.roomId] = session.activeTime
      debugInfo.lastMessages[session.roomId] = session.text || '无最后消息'
    })

    return debugInfo
  }

  /**
   * 打印调试信息到控制台
   */
  logDebugInfo(): void {
    const debugInfo = this.getDebugInfo()

    console.group('🔍 聊天列表调试信息')
    logger.info('📊 基本统计:', {
      会话列表长度: debugInfo.sessionListLength,
      当前会话ID: debugInfo.currentSessionRoomId,
      消息映射房间数: debugInfo.messageMapKeys.length
    })

    logger.info('📱 会话详情:')
    Object.entries(debugInfo.unreadCounts).forEach(([roomId, unreadCount]) => {
      const activeTime = debugInfo.activeTimes[roomId]
      const lastMsg = debugInfo.lastMessages[roomId] || ''
      logger.info(`  房间 ${roomId}:`, {
        未读数: unreadCount,
        活跃时间: activeTime ? new Date(activeTime).toLocaleString() : '未知',
        最后消息: lastMsg.substring(0, 50) + (lastMsg.length > 50 ? '...' : '')
      })
    })

    logger.info('🗂️ 消息映射房间列表:', debugInfo.messageMapKeys)

    console.groupEnd()
  }

  /**
   * 检查特定房间的消息状态
   */
  checkRoomMessages(roomId: string): void {
    const messages = this.chatStore.chatMessageListByRoomId(roomId)
    const session = this.chatStore.getSession(roomId)

    console.group(`🏠 房间 ${roomId} 检查`)
    logger.info('会话信息:', session)
    logger.info('消息数量:', messages.length)

    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg && lastMsg.message) {
        logger.info('最后一条消息:', {
          ID: lastMsg.message.id,
          类型: lastMsg.message.type,
          发送时间: new Date(lastMsg.message.sendTime || 0).toLocaleString(),
          发送者: (lastMsg.fromUser as { name?: string } | undefined)?.name,
          内容:
            typeof lastMsg.message.body?.content === 'string'
              ? lastMsg.message.body.content.substring(0, 100)
              : JSON.stringify(lastMsg.message.body?.content).substring(0, 100)
        })
      }
    } else {
      logger.warn('⚠️ 该房间没有消息')
    }

    console.groupEnd()
  }

  /**
   * 模拟新消息到达，测试响应式更新
   */
  simulateNewMessage(roomId: string): void {
    logger.info(`🧪 模拟房间 ${roomId} 收到新消息`)

    // 更新会话活跃时间
    this.chatStore.updateSession(roomId, {
      activeTime: Date.now(),
      text: `[测试消息] ${new Date().toLocaleTimeString()}`,
      unreadCount: (this.chatStore.getSession(roomId)?.unreadCount || 0) + 1
    })

    // 等待响应式更新
    setTimeout(() => {
      this.logDebugInfo()
    }, 100)
  }

  /**
   * 清除所有会话的未读数（测试用）
   */
  clearAllUnreadCounts(): void {
    logger.info('🧹 清除所有会话未读数')
    this.chatStore.clearUnreadCount()

    setTimeout(() => {
      this.logDebugInfo()
    }, 100)
  }
}

// 导出单例实例
export const messageListDebugger = new MessageListDebugger()

// 在开发环境下，将调试器暴露到全局对象
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  const devWindow = window as typeof window & {
    messageListDebugger?: typeof messageListDebugger
  }
  devWindow.messageListDebugger = messageListDebugger
  logger.debug('💡 调试器已暴露到全局：window.messageListDebugger')
  logger.debug('💡 使用方法：')
  logger.debug('  - window.messageListDebugger.logDebugInfo() // 打印调试信息')
  logger.debug('  - window.messageListDebugger.checkRoomMessages("roomId") // 检查特定房间')
  logger.debug('  - window.messageListDebugger.simulateNewMessage("roomId") // 模拟新消息')
}
