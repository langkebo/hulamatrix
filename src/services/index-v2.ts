/**
 * 统一服务入口 v2.0
 * 导出所有 v2.0 服务和 Store
 *
 * 统一 PC 端和移动端使用
 */

// ==================== 服务 ====================

export { friendsServiceV2 } from './friendsServiceV2'
export { privateChatServiceV2 } from './privateChatServiceV2'

// ==================== Store ====================

export { useFriendsStoreV2 } from '@/stores/friendsSDK'
export { usePrivateChatStoreV2 } from '@/stores/privateChatV2'

// ==================== 类型 ====================

export type {
  // 好友系统类型
  FriendItem,
  FriendCategoryItem,
  PendingRequestItem,
  FriendsState,
  // 私聊系统类型
  PrivateChatSessionItem,
  PrivateChatMessageItem,
  PrivateChatState,
  // 服务接口
  IFriendsServiceV2,
  IPrivateChatServiceV2,
  // 工具类型
  CreateSessionParams,
  SendMessageParams,
  GetMessagesParams,
  MessageHandler
} from '@/types/matrix-sdk-v2'

// ==================== 便捷函数 ====================

/**
 * 初始化所有 v2.0 服务
 */
export async function initializeV2Services(): Promise<void> {
  const { friendsServiceV2 } = await import('./friendsServiceV2')
  const { privateChatServiceV2 } = await import('./privateChatServiceV2')

  await Promise.all([friendsServiceV2.initialize(), privateChatServiceV2.initialize()])
}

/**
 * 清理所有 v2.0 服务资源
 */
export function disposeV2Services(): void {
  const { privateChatServiceV2 } = require('./privateChatServiceV2')
  privateChatServiceV2.dispose()
}

/**
 * 获取服务状态摘要
 */
export async function getV2ServicesSummary(): Promise<{
  friendsInitialized: boolean
  totalFriends: number
  pendingRequests: number
}> {
  const { useFriendsStoreV2 } = await import('@/stores/friendsSDK')

  const friendsStore = useFriendsStoreV2()

  return {
    friendsInitialized: friendsStore.initialized,
    totalFriends: friendsStore.totalFriendsCount,
    pendingRequests: friendsStore.pendingCount
  }
}
