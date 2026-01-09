/**
 * Core Store - Room and Chat State Management
 * Handles rooms, messages, typing users, and room operations
 */

import { ref, computed, type Ref } from 'vue'
import { logger } from '@/utils/logger'
import type { Room, ChatMessage, RoomSearchResult } from './types'
import { MAX_RECENT_ROOMS, PRELOAD_ROOMS_COUNT } from './types'

/**
 * Room and chat state manager
 */
export class RoomStateManager {
  /** All rooms map */
  rooms: Ref<Map<string, Room>>

  /** All messages by room ID */
  messages: Ref<Map<string, ChatMessage[]>>

  /** Current room ID */
  currentRoomId: Ref<string | null>

  /** Typing users by room ID */
  typingUsers: Ref<Map<string, Set<string>>>

  /** Recent rooms list for LRU cache */
  recentRooms: Ref<string[]>

  /** Matrix client reference - use any to accommodate extended Matrix SDK types */
  private getClient: () => any

  /** Current user ID getter */
  private getCurrentUserId: () => string | undefined

  constructor(getClient: () => any, getCurrentUserId: () => string | undefined) {
    this.getClient = getClient
    this.getCurrentUserId = getCurrentUserId
    this.rooms = ref<Map<string, Room>>(new Map())
    this.messages = ref<Map<string, ChatMessage[]>>(new Map())
    this.currentRoomId = ref<string | null>(null)
    this.typingUsers = ref<Map<string, Set<string>>>(new Map())
    this.recentRooms = ref<string[]>([])
  }

  /**
   * Get current room
   */
  get currentRoom() {
    return computed(() => {
      if (!this.currentRoomId.value) return null
      return this.rooms.value.get(this.currentRoomId.value) || null
    })
  }

  /**
   * Get current room messages
   */
  get currentMessages() {
    return computed(() => {
      if (!this.currentRoomId.value) return []
      return this.messages.value.get(this.currentRoomId.value) || []
    })
  }

  /**
   * Get total unread count
   */
  get unreadCount() {
    return computed(() => {
      let total = 0
      for (const room of this.rooms.value.values()) {
        total += room.unreadCount + room.highlightCount
      }
      return total
    })
  }

  /**
   * Load initial rooms from Matrix client
   */
  async loadInitialRooms(): Promise<void> {
    const client = this.getClient()
    if (!client) return

    try {
      const joined = await client.getJoinedRooms()
      if (joined.joined_rooms) {
        for (const roomId of joined.joined_rooms) {
          const room = client.getRoom(roomId)
          if (room) {
            const avatarUrl = room.getAvatarUrl?.(client.getHomeserverUrl?.() || '', 48, 48, 'crop', true, true) || ''
            const memberCount = room.getJoinedMemberCount?.() || 0
            this.rooms.value.set(roomId, {
              id: roomId,
              name: room.name || roomId,
              avatar: avatarUrl,
              type: memberCount === 2 ? 'dm' : 'group',
              members: [],
              highlightCount: 0,
              notifications: 'all',
              isEncrypted: false,
              lastMessage: {
                id: '',
                roomId,
                sender: '',
                content: {},
                timestamp: 0,
                type: 'text',
                status: 'sent'
              },
              unreadCount: room.getUnreadNotificationCount?.() || 0
            })
          }
        }
      }
    } catch (error) {
      logger.error('[RoomState] Failed to load initial rooms:', error)
    }
  }

  /**
   * Join a room
   * @param roomId Room ID to join
   * @param viaServers Optional list of servers to route join request through (for federation)
   */
  async joinRoom(roomId: string, viaServers?: string[]): Promise<void> {
    const client = this.getClient()
    if (!client) return

    try {
      // Build options with viaServers for federation support
      const opts: Record<string, unknown> = {}
      if (viaServers !== undefined) {
        opts.viaServers = viaServers
      }

      await client.joinRoom(roomId, opts)
      this.currentRoomId.value = roomId
    } catch (error) {
      logger.error('[RoomState] Failed to join room:', error)
      throw error
    }
  }

  /**
   * Leave a room
   */
  async leaveRoom(roomId: string): Promise<void> {
    const client = this.getClient()
    if (!client) return

    try {
      await client.leave(roomId)
      if (this.currentRoomId.value === roomId) {
        this.currentRoomId.value = null
      }
      this.rooms.value.delete(roomId)
      this.messages.value.delete(roomId)
    } catch (error) {
      logger.error('[RoomState] Failed to leave room:', error)
      throw error
    }
  }

  /**
   * Send a message
   */
  async sendMessage(roomId: string, content: Record<string, unknown>, type: string = 'm.room.message'): Promise<void> {
    const client = this.getClient()
    const userId = this.getCurrentUserId()
    if (!client || !userId) return

    const tempId = 'temp-' + Date.now()
    const tempMessage: ChatMessage = {
      id: tempId,
      roomId,
      sender: userId,
      content,
      timestamp: Date.now(),
      type: 'text',
      status: 'sending'
    }

    // Add temporary message
    const roomMessages = this.messages.value.get(roomId) || []
    roomMessages.push(tempMessage)
    this.messages.value.set(roomId, roomMessages)

    try {
      const sendEventFn = (
        client as {
          sendEvent?(
            roomId: string,
            type: string,
            content: Record<string, unknown>
          ): Promise<{
            event_id: string
          }>
        }
      ).sendEvent
      const event = (await sendEventFn?.(roomId, type, content)) ?? { event_id: tempId }
      // Update message status
      tempMessage.id = event.event_id
      tempMessage.status = 'sent'
    } catch (error) {
      tempMessage.status = 'failed'
      logger.error('[RoomState] Failed to send message:', error)
      throw error
    }
  }

  /**
   * Update LRU recent rooms list
   */
  updateRecentRoom(roomId: string): void {
    if (!roomId) return

    // Remove existing room ID
    const index = this.recentRooms.value.indexOf(roomId)
    if (index > -1) {
      this.recentRooms.value.splice(index, 1)
    }

    // Add to beginning (most recent)
    this.recentRooms.value.unshift(roomId)

    // Limit list length
    if (this.recentRooms.value.length > MAX_RECENT_ROOMS) {
      this.recentRooms.value = this.recentRooms.value.slice(0, MAX_RECENT_ROOMS)
    }

    logger.debug('[RoomState] Updated recent rooms:', { roomId, recent: this.recentRooms.value.slice(0, 5) })
  }

  /**
   * Switch to room with smart preloading
   */
  async switchToRoom(roomId: string, preload = true): Promise<{ success: boolean; roomId: string; error?: unknown }> {
    try {
      logger.info('[RoomState] Switching to room:', { roomId, preload })

      // 1. Update current room
      this.currentRoomId.value = roomId

      // 2. Update LRU cache
      this.updateRecentRoom(roomId)

      // 3. Smart preloading
      if (preload) {
        await this.preloadActiveRooms()
      }

      // 4. Check if room needs message loading
      if (!this.messages.value.has(roomId)) {
        logger.debug('[RoomState] Room messages not cached, will load on demand:', { roomId })
      }

      return { success: true, roomId }
    } catch (error) {
      logger.error('[RoomState] Failed to switch room:', error)
      return { success: false, roomId, error }
    }
  }

  /**
   * Preload active rooms
   */
  async preloadActiveRooms(): Promise<void> {
    try {
      const activeRooms = Array.from(this.rooms.value.values())
        .filter((room: Room) => room.lastMessage?.timestamp)
        .sort((a: Room, b: Room) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0))
        .slice(0, PRELOAD_ROOMS_COUNT)
        .map((room) => room.id)

      logger.debug('[RoomState] Preloading active rooms:', activeRooms)

      for (const roomId of activeRooms) {
        if (!this.messages.value.has(roomId)) {
          logger.debug('[RoomState] Room needs loading:', { roomId })
        }
      }
    } catch (error) {
      logger.warn('[RoomState] Failed to preload active rooms:', error)
    }
  }

  /**
   * Clear room data
   */
  clearRoomData(): void {
    this.rooms.value.clear()
    this.messages.value.clear()
    this.currentRoomId.value = null
    this.typingUsers.value.clear()
  }

  /**
   * Add typing user
   */
  addTypingUser(roomId: string, userId: string): void {
    if (!this.typingUsers.value.has(roomId)) {
      this.typingUsers.value.set(roomId, new Set())
    }
    this.typingUsers.value.get(roomId)?.add(userId)
  }

  /**
   * Remove typing user
   */
  removeTypingUser(roomId: string, userId: string): void {
    this.typingUsers.value.get(roomId)?.delete(userId)
  }

  /**
   * Clear typing users for room
   */
  clearTypingUsers(roomId: string): void {
    this.typingUsers.value.delete(roomId)
  }

  /**
   * Search rooms
   */
  searchKnownRooms(query: string): RoomSearchResult[] {
    if (!query.trim()) return []

    return Array.from(this.rooms.value.values())
      .filter(
        (room) =>
          room.name?.toLowerCase().includes(query.toLowerCase()) || room.id.toLowerCase().includes(query.toLowerCase())
      )
      .map((room) => ({
        id: room.id,
        name: room.name,
        avatar: room.avatar || '',
        type: room.type === 'dm' ? 'dm' : 'private',
        memberCount: room.members.length,
        topic: room.topic || '',
        lastMessage: null,
        unreadCount: room.unreadCount
      }))
  }

  /**
   * Get room by ID
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.value.get(roomId)
  }

  /**
   * Set room
   */
  setRoom(roomId: string, room: Room): void {
    this.rooms.value.set(roomId, room)
  }

  /**
   * Get messages for room
   */
  getRoomMessages(roomId: string): ChatMessage[] {
    return this.messages.value.get(roomId) || []
  }

  /**
   * Set messages for room
   */
  setRoomMessages(roomId: string, messages: ChatMessage[]): void {
    this.messages.value.set(roomId, messages)
  }

  /**
   * Add message to room
   */
  addMessage(roomId: string, message: ChatMessage): void {
    const roomMessages = this.messages.value.get(roomId) || []
    roomMessages.push(message)
    this.messages.value.set(roomId, roomMessages)
  }

  /**
   * Update room
   */
  updateRoom(roomId: string, updates: Partial<Room>): void {
    const room = this.rooms.value.get(roomId)
    if (room) {
      Object.assign(room, updates)
    }
  }
}
