import type { SessionItem } from '@/services/types'
import { unreadCountManager } from '@/utils/UnreadCountManager'

/**
 * 未读计数持久化存储接口
 */
interface UnreadCountStore {
  apply: (uid: string | undefined, sessions: SessionItem[]) => void
  set: (uid: string | undefined, roomId: string, count: number) => void
  remove: (uid: string | undefined, roomId: string) => void
}

export function applyPersistedUnreadCounts(
  store: UnreadCountStore,
  uid: number | string | undefined,
  sessions: SessionItem[]
): void {
  store.apply(String(uid), sessions)
}

export function persistUnreadCount(
  store: UnreadCountStore,
  uid: number | string | undefined,
  roomId: string,
  count: number
): void {
  store.set(String(uid), roomId, count)
}

export function removeUnreadCountCache(
  store: UnreadCountStore,
  uid: number | string | undefined,
  roomId: string
): void {
  store.remove(String(uid), roomId)
}

export function requestUnreadUpdate(sessionId?: string): void {
  unreadCountManager.requestUpdate(sessionId)
}

export function calculateGlobalUnread(
  sessionList: SessionItem[],
  unReadMark: {
    newFriendUnreadCount: number
    newGroupUnreadCount: number
    newMsgUnreadCount: number
    noticeUnreadCount: number
  }
): void {
  unreadCountManager.calculateTotal(sessionList, unReadMark)
}

export function setUnreadUpdateCallback(cb: () => void): void {
  unreadCountManager.setUpdateCallback(cb)
}
