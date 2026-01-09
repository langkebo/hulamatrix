/**
 * Chat Store - Session State Management
 * Handles session list, session map, and session CRUD operations
 */

import { reactive, ref, type Ref } from 'vue'
import { logger } from '@/utils/logger'
import { RoomTypeEnum } from '@/enums'
import type { SessionItem } from '@/services/types'
import { getSessionListFromMatrix, getSessionFromMatrix } from '@/utils/matrixRoomMapper'
import { orderBy, uniqBy } from 'es-toolkit'
import { hiddenSessions } from '@/utils/HiddenSessions'

/**
 * Session loading options
 */
export interface SessionOptions {
  isLast: boolean
  isLoading: boolean
  cursor: string
}

/**
 * Session state manager
 */
export class SessionStateManager {
  /** Session list */
  sessionList: Ref<SessionItem[]>

  /** Session map for O(1) lookup by roomId */
  sessionMap: Ref<Record<string, SessionItem>>

  /** Session loading state */
  sessionOptions: SessionOptions

  /** Sync loading state */
  syncLoading: Ref<boolean>

  /** Current session room ID reference */
  private getCurrentRoomId: () => string

  /** User store reference */
  private userStore: { userInfo?: { uid?: string } }

  constructor(getCurrentRoomId: () => string, userStore: { userInfo?: { uid?: string } }) {
    this.getCurrentRoomId = getCurrentRoomId
    this.userStore = userStore
    this.sessionList = ref<SessionItem[]>([])
    this.sessionMap = ref<Record<string, SessionItem>>({})
    this.sessionOptions = reactive({ isLast: false, isLoading: false, cursor: '' })
    this.syncLoading = ref(false)
  }

  /**
   * Get current session info
   */
  getCurrentSession(): SessionItem | undefined {
    const roomId = this.getCurrentRoomId()
    if (!roomId) return undefined
    return this.getSession(roomId)
  }

  /**
   * Get session by room ID with dual lookup and auto-repair
   */
  getSession(roomId: string): SessionItem | undefined {
    // 优先从 map 中查找
    const fromMap = this.sessionMap.value[roomId]
    if (fromMap) {
      // 同步到 list（如果缺失）
      const inList = this.sessionList.value.find((s) => s.roomId === roomId)
      if (!inList && fromMap) {
        this.sessionList.value.push(fromMap)
      }
      return fromMap
    }

    // 从 list 中查找并同步到 map
    const fromList = this.sessionList.value.find((s) => s.roomId === roomId)
    if (fromList) {
      this.sessionMap.value[roomId] = fromList
      return fromList
    }

    return undefined
  }

  /**
   * Fetch session list from server
   */
  async getSessionList(): Promise<void> {
    try {
      const data = await getSessionListFromMatrix()
      const now = Date.now()

      this.sessionList.value = data.map((s) => ({
        ...s,
        activeTime: s.activeTime || now
      }))

      // 更新 sessionMap
      const newMap: Record<string, SessionItem> = {}
      for (const session of this.sessionList.value) {
        if (session.roomId) {
          newMap[session.roomId] = session
        }
      }
      this.sessionMap.value = newMap

      // 过滤隐藏会话并去重
      this.sortAndUniqueSessionList()
    } catch (error) {
      logger.warn('[ChatStore] Failed to get session list:', error)
    }
  }

  /**
   * Add a new session
   */
  async addSession(roomId: string): Promise<SessionItem | undefined> {
    try {
      const session = await getSessionFromMatrix(roomId)
      if (!session) return undefined

      // 添加到 list
      this.sessionList.value.push(session)
      // 添加到 map
      this.sessionMap.value[roomId] = session

      return session
    } catch (error) {
      logger.warn('[ChatStore] Failed to add session:', error)
      return undefined
    }
  }

  /**
   * Update session data
   */
  updateSession(roomId: string, data: Partial<SessionItem>): void {
    const index = this.sessionList.value.findIndex((s) => s.roomId === roomId)
    if (index !== -1) {
      const session = this.sessionList.value[index]
      const updatedSession = { ...session, ...data }
      this.sessionList.value[index] = updatedSession

      // 同步更新 map
      if (roomId) {
        this.sessionMap.value[roomId] = updatedSession
      }
    }
  }

  /**
   * Update session last active time
   */
  updateSessionLastActiveTime(roomId: string): SessionItem | undefined {
    const session = this.getSession(roomId)
    if (session) {
      this.updateSession(roomId, { activeTime: Date.now() })
    }
    return session
  }

  /**
   * Remove session
   */
  removeSession(roomId: string): void {
    const index = this.sessionList.value.findIndex((s) => s.roomId === roomId)
    if (index !== -1) {
      this.sessionList.value.splice(index, 1)
    }
    delete this.sessionMap.value[roomId]
  }

  /**
   * Check data consistency between sessionList and sessionMap
   */
  checkDataConsistency(): { inListNotInMap: string[]; inMapNotInList: string[] } {
    const sessionListIds = new Set(this.sessionList.value.map((s) => s.roomId))
    const sessionMapIds = new Set(Object.keys(this.sessionMap.value))

    const inListNotInMap = [...sessionListIds].filter((id) => !sessionMapIds.has(id) && id)
    const inMapNotInList = [...sessionMapIds].filter((id) => !sessionListIds.has(id) && id)

    // Auto-repair inconsistencies
    // 1. Add sessions in list but not in map
    for (const roomId of inListNotInMap) {
      const session = this.sessionList.value.find((s) => s.roomId === roomId)
      if (session) {
        this.sessionMap.value[roomId] = session
      }
    }

    // 2. Add sessions in map but not in list
    for (const roomId of inMapNotInList) {
      const session = this.sessionMap.value[roomId]
      if (session) {
        this.sessionList.value.push(session)
      }
    }

    return { inListNotInMap, inMapNotInList }
  }

  /**
   * Sort and unique session list
   */
  sortAndUniqueSessionList(): void {
    // Filter out hidden sessions and invalid sessions
    const base = this.sessionList.value.filter((s) => s && s.roomId && !hiddenSessions.isHidden(s.roomId))

    // Remove duplicates by roomId
    const unique = uniqBy(base, (item) => item.roomId)

    // Sort by: top (pinned first), then by activeTime (most recent first)
    const uniqueAndSorted = orderBy(unique, [(item) => !!item.top, (item) => item.activeTime], ['desc', 'desc'])

    this.sessionList.value = uniqueAndSorted
  }

  /**
   * Get all group sessions
   */
  getGroupSessions(): SessionItem[] {
    return this.sessionList.value.filter((s) => s.type === RoomTypeEnum.GROUP)
  }

  /**
   * Check if current room is a group
   */
  isCurrentGroup(): boolean {
    return this.getCurrentSession()?.type === RoomTypeEnum.GROUP
  }
}
