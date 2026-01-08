import { setupMatrixMessageBridge } from './messages'
import { logger } from '@/utils/logger'
import { setupMatrixRoomBridge } from './rooms'
import { setupMatrixNotificationBridge } from './notifications'
import { setupMatrixMediaBridge } from './media'
import { setupMatrixThreadsBridge } from './threads'
import { setupMatrixRtcBridge } from './rtc'
import { usePresenceStore } from '@/stores/presence'
import { setupMatrixTypingBridge } from './typing'
import { setupMatrixEventBus } from './event-bus'
import { setupEnhancedV2Features } from './enhanced-v2'

/**
 * 设置 Presence 初始化，支持自动重试
 */
function setupPresenceWithRetry() {
  const presenceStore = usePresenceStore()

  // 尝试立即初始化
  const success = presenceStore.setup()

  if (!success) {
    // 如果初始化失败（客户端未就绪），设置延迟重试
    let attempts = 0
    const maxAttempts = 10
    const retryInterval = 1000 // 1秒

    const retrySetup = () => {
      attempts++
      const setupSuccess = presenceStore.setup()

      if (setupSuccess) {
        // 初始化成功，停止重试
        return
      }

      if (attempts < maxAttempts) {
        // 继续重试
        setTimeout(retrySetup, retryInterval)
      }
    }

    setTimeout(retrySetup, retryInterval)
  }
}

export function setupMatrixBridges() {
  setupMatrixRoomBridge()
  setupMatrixMessageBridge()
  setupMatrixNotificationBridge()
  setupMatrixMediaBridge()
  setupMatrixThreadsBridge()
  setupPresenceWithRetry()
  setupMatrixTypingBridge()
  setupMatrixEventBus()
  setupMatrixRtcBridge((_type, _content, _roomId) => {
    // 占位：事件已通过 messages 桥接映射为系统消息进行展示
  })

  // Initialize enhanced v2 features (friendsV2, privateChatV2)
  // These use the new RESTful API endpoints
  setupEnhancedV2Features().catch((error) => {
    logger.error('[Matrix Bridges] Failed to setup enhanced v2 features:', error)
  })
}
