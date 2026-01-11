/**
 * Chat Store - Unread Count State Management
 * Handles unread count tracking and persistence
 */

import { reactive, computed } from 'vue'
import type { SessionItem } from '@/services/types'
import { useSessionUnreadStore } from '@/stores/sessionUnread'
import {
  applyPersistedUnreadCounts,
  persistUnreadCount as persistUnreadCountSvc,
  removeUnreadCountCache as removeUnreadCountCacheSvc,
  requestUnreadUpdate as requestUnreadUpdateSvc
} from '@/services/session'
import type { NewMsgCountState } from './types'

/**
 * Unread count state manager
 */
export class UnreadStateManager {
  /** New message count by room ID */
  newMsgCount: Record<string, NewMsgCountState>

  /** Current session room ID reference */
  private getCurrentRoomId: () => string

  /** User store reference */
  private userStore: { userInfo?: { uid?: string } }

  /** Session unread store reference */
  private sessionUnreadStore: ReturnType<typeof useSessionUnreadStore>

  constructor(
    getCurrentRoomId: () => string,
    userStore: { userInfo?: { uid?: string } },
    sessionUnreadStore: ReturnType<typeof useSessionUnreadStore>
  ) {
    this.getCurrentRoomId = getCurrentRoomId
    this.userStore = userStore
    this.sessionUnreadStore = sessionUnreadStore
    this.newMsgCount = reactive<Record<string, NewMsgCountState>>({})
  }

  /**
   * Get current room's new message count
   */
  get currentNewMsgCount() {
    return computed<NewMsgCountState>({
      get: () => {
        const roomId = this.getCurrentRoomId()
        const current = this.newMsgCount[roomId]
        if (current === undefined) {
          this.newMsgCount[roomId] = { count: 0, isStart: false }
        }
        return this.newMsgCount[roomId]
      },
      set: (val: NewMsgCountState) => {
        const roomId = this.getCurrentRoomId()
        this.newMsgCount[roomId] = val
      }
    })
  }

  /**
   * Sync persisted unread counts to memory
   */
  syncPersistedUnreadCounts(targetSessions: SessionItem[] = []): void {
    if (!targetSessions.length) return
    applyPersistedUnreadCounts(this.sessionUnreadStore, this.userStore.userInfo?.uid, targetSessions)
  }

  /**
   * Update local cache unread count for a room
   */
  persistUnreadCount(roomId: string, count: number): void {
    if (!roomId) return
    persistUnreadCountSvc(this.sessionUnreadStore, this.userStore.userInfo?.uid, roomId, count)
  }

  /**
   * Remove unread count cache for a room
   */
  removeUnreadCountCache(roomId: string): void {
    if (!roomId) return
    removeUnreadCountCacheSvc(this.sessionUnreadStore, this.userStore.userInfo?.uid, roomId)
  }

  /**
   * Clear new message count for current room
   */
  clearNewMsgCount(): void {
    const current = this.currentNewMsgCount.value
    if (current) {
      current.count = 0
      current.isStart = false
    }
  }

  /**
   * Clear all unread counts
   */
  clearUnreadCount(): void {
    for (const roomId in this.newMsgCount) {
      this.newMsgCount[roomId] = { count: 0, isStart: false }
    }
  }

  /**
   * Request unread count update from server
   */
  async requestUnreadCountUpdate(sessionId?: string): Promise<void> {
    requestUnreadUpdateSvc(sessionId)
  }

  /**
   * Update total unread count
   */
  updateTotalUnreadCount(): void {
    // This would typically trigger a UI update
    // Implementation depends on how total unread is displayed
  }

  /**
   * Get unread count for a specific room
   */
  getUnreadCount(roomId: string): NewMsgCountState | undefined {
    return this.newMsgCount[roomId]
  }

  /**
   * Set unread count for a specific room
   */
  setUnreadCount(roomId: string, count: number, isStart = false): void {
    this.newMsgCount[roomId] = { count, isStart }
  }
}
