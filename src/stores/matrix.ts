import { defineStore } from 'pinia'
import type { MatrixRoom, MatrixMember, MatrixMessage } from '@/types/matrix'
import { MessageStatus } from '@/types/matrix'
import { matrixClientService } from '@/integrations/matrix/client'
import { useMatrixClient } from '@/composables'
import { matrixCallService } from '@/services/matrixCallService'
import { Room, MatrixEvent, RoomMember, ClientEvent, RoomEvent } from 'matrix-js-sdk'
import type { MatrixCall } from '@/services/matrixCallService'
import { MatrixEventHandler } from '@/matrix/services/message/event-handler'
import { logger } from '@/utils/logger'

/** Sync state type */
type SyncState = 'PREPARED' | 'SYNCING' | 'ERROR' | 'STOPPED'

/** Raw event structure */
interface RawMatrixEvent {
  sender?: string
  event_id?: string
  room_id?: string
  type?: string
  content?: Record<string, unknown>
  origin_server_ts?: number
}

/** Event with raw event access */
interface EventWithRaw {
  event?: RawMatrixEvent
  localTimestamp?: number
  status?: unknown
}

/** Room with avatar URL method */
interface RoomWithAvatar {
  getAvatarUrl?: (
    baseUrl: string,
    width: number,
    height: number,
    resizeMethod: string,
    allowDefault: boolean,
    allowDirectLinks: boolean
  ) => string
}

/** Room with last active timestamp */
interface RoomWithTimestamp {
  getLastActiveTimestamp?: () => number
}

/** Member with avatar URL method */
interface MemberWithAvatar {
  getAvatarUrl?: (
    baseUrl: string,
    width: number,
    height: number,
    resizeMethod: string,
    allowDefault: boolean,
    allowDirectLinks: boolean
  ) => string
}

/** Extended Matrix client with additional methods */
interface ExtendedMatrixClient {
  getVisibleRooms?: () => Room[]
  scrollback?: (room: Room, limit: number) => void
}

/** Room state event */
interface RoomStateEvent {
  event?: {
    content?: {
      topic?: string
    }
  }
}

/** Live timeline */
interface LiveTimeline {
  getEvents: () => MatrixEvent[]
}

/** Room with timeline access */
interface RoomWithTimeline {
  loadMembersIfNeeded?: () => Promise<boolean>
  getLiveTimeline?: () => LiveTimeline
}

const normalizeSyncState = (state: unknown): SyncState => {
  const s = String(state || '').toUpperCase()
  if (s === 'PREPARED') return 'PREPARED'
  if (s === 'ERROR') return 'ERROR'
  if (s === 'STOPPED') return 'STOPPED'
  if (s === 'RECONNECTING') return 'SYNCING'
  if (s === 'SYNCING') return 'SYNCING'
  return 'SYNCING'
}

const INITIAL_MESSAGES_PER_ROOM = 50
const MAX_LIVE_MESSAGES_PER_ROOM = 500

// Helper to map SDK Room to UI MatrixRoom
const mapRoom = (room: Room): MatrixRoom => {
  const { client } = useMatrixClient()
  const roomWithAvatar = room as Room & RoomWithAvatar
  // Use explicit cast if TS definition is outdated or missing
  const avatarUrl = roomWithAvatar.getAvatarUrl
    ? roomWithAvatar.getAvatarUrl((client.value?.baseUrl as string) || '', 48, 48, 'crop', true, true)
    : undefined

  // Safe access to topic
  let topic = ''
  try {
    const topicEvent = room.currentState.getStateEvents('m.room.topic', '') as RoomStateEvent | undefined
    topic = topicEvent?.event?.content?.topic || ''
  } catch (_e) {
    /* ignore */
  }

  const isRoomEncryptedMethod = client.value?.isRoomEncrypted as ((roomId: string) => boolean) | undefined
  const encrypted = isRoomEncryptedMethod ? isRoomEncryptedMethod(room.roomId) : false

  return {
    roomId: room.roomId,
    name: room.name,
    topic,
    avatarUrl: avatarUrl || undefined,
    avatar: avatarUrl || undefined,
    encrypted: encrypted || false,
    joinRule: room.currentState.getJoinRule(),
    guestAccess: room.currentState.getGuestAccess(),
    historyVisibility: room.currentState.getHistoryVisibility(),
    memberCount: room.getJoinedMemberCount(),
    _room: room
  }
}

// Helper to map SDK Event to UI MatrixMessage
const mapEvent = (event: MatrixEvent, currentUserId?: string): MatrixMessage => {
  const eventWithRaw = event as MatrixEvent & EventWithRaw
  const rawEvent = eventWithRaw.event || {}
  const sender = (rawEvent.sender as string | undefined) || ''
  // Map status to MessageStatus enum, default to SENT
  let status: MessageStatus = MessageStatus.SENT
  if (typeof eventWithRaw.status === 'string') {
    const statusMap: Record<string, MessageStatus> = {
      pending: MessageStatus.PENDING,
      sent: MessageStatus.SENT,
      delivered: MessageStatus.DELIVERED,
      read: MessageStatus.READ,
      failed: MessageStatus.FAILED
    }
    status = statusMap[eventWithRaw.status] || MessageStatus.SENT
  }
  return {
    eventId: (rawEvent.event_id as string | undefined) || '',
    roomId: (rawEvent.room_id as string | undefined) || '',
    sender,
    type: (rawEvent.type as string | undefined) || '',
    content: (rawEvent.content as Record<string, unknown>) || {},
    timestamp: (rawEvent.origin_server_ts as number | undefined) ?? eventWithRaw.localTimestamp ?? Date.now(),
    isOutgoing: !!currentUserId && sender === currentUserId,
    status,
    _event: event
  }
}

// Helper to map SDK Member to UI MatrixMember
const mapMember = (member: RoomMember): MatrixMember => {
  const { client } = useMatrixClient()
  const memberWithAvatar = member as RoomMember & MemberWithAvatar
  const avatarUrl = memberWithAvatar.getAvatarUrl
    ? memberWithAvatar.getAvatarUrl((client.value?.baseUrl as string) || '', 48, 48, 'crop', true, true)
    : undefined
  return {
    userId: member.userId,
    displayName: member.name,
    avatarUrl: avatarUrl || undefined,
    powerLevel: member.powerLevel,
    membership: member.membership || 'join',
    _member: member
  }
}

export const useMatrixStore = defineStore('matrix', {
  state: () => ({
    // Connection State
    isConnected: false,
    isSyncing: false,
    syncState: 'STOPPED' as SyncState,

    // User Info
    userId: '',
    displayName: '',
    avatarUrl: '',

    // Data
    rooms: [] as MatrixRoom[],
    currentRoomId: '',
    roomMembers: new Map<string, MatrixMember[]>(),
    roomMessages: new Map<string, MatrixMessage[]>(),

    // UI State
    activeCalls: new Map<string, MatrixCall>(),
    unreadCounts: new Map<string, number>(),
    typingUsers: new Map<string, Set<string>>(),

    settings: {
      enableNotifications: true,
      enableSound: true,
      enableEncryption: true,
      autoAcceptCalls: false,
      theme: 'auto' as 'light' | 'dark' | 'auto'
    }
  }),

  getters: {
    currentRoom: (state) => state.rooms.find((room) => room.roomId === state.currentRoomId),
    currentRoomMembers: (state) => state.roomMembers.get(state.currentRoomId) || [],
    currentRoomMessages: (state) => state.roomMessages.get(state.currentRoomId) || [],

    totalUnreadCount: (state) => {
      let total = 0
      state.unreadCounts.forEach((count) => {
        total += count
      })
      return total
    },

    activeCallsList: (state) => Array.from(state.activeCalls.values()),
    getRoomUnreadCount: (state) => (roomId: string) => state.unreadCounts.get(roomId) || 0,

    getMemberDisplayName: (state) => (roomId: string, userId: string) => {
      const members = state.roomMembers.get(roomId) || []
      const member = members.find((m) => m.userId === userId)
      return member?.displayName || userId
    }
  },

  actions: {
    async initialize(credentials: { userId: string; accessToken: string; deviceId: string; homeServer: string }) {
      await matrixClientService.initialize({
        userId: credentials.userId,
        accessToken: credentials.accessToken,
        deviceId: credentials.deviceId,
        homeserver: credentials.homeServer,
        baseUrl: credentials.homeServer
      })

      this.userId = credentials.userId
      this.isConnected = true

      // Start Sync
      await matrixClientService.start()

      // Listeners
      this.setupEventListeners()

      // Initial Load (will be updated by sync)
      this.refreshRooms()
    },

    async disconnect() {
      await matrixClientService.stop()
      this.isConnected = false
      this.syncState = 'STOPPED'
      this.rooms = []
      this.currentRoomId = ''
      this.roomMessages.clear()
    },

    refreshRooms() {
      const { client } = useMatrixClient()
      if (client.value) {
        const extendedClient = client.value as ExtendedMatrixClient
        const visibleRooms = (extendedClient.getVisibleRooms?.() || []) as Room[]
        this.rooms = visibleRooms.map(mapRoom).sort((a: MatrixRoom, b: MatrixRoom) => {
          // Sort by last message timestamp desc
          const ta = (a._room as Room & RoomWithTimestamp)?.getLastActiveTimestamp?.() ?? 0
          const tb = (b._room as Room & RoomWithTimestamp)?.getLastActiveTimestamp?.() ?? 0
          return tb - ta
        })
      }
    },

    async setCurrentRoom(roomId: string) {
      this.currentRoomId = roomId

      // Load members/messages from SDK memory
      const { client } = useMatrixClient()
      if (client.value) {
        const getRoomMethod = client.value.getRoom as ((roomId: string) => Room | null) | undefined
        const room = getRoomMethod?.(roomId)
        if (room) {
          const roomWithTimeline = room as Room & RoomWithTimeline
          try {
            await roomWithTimeline.loadMembersIfNeeded?.()
          } catch {}

          const members = room.getJoinedMembers()
          this.roomMembers.set(roomId, members.map(mapMember))

          const timeline = roomWithTimeline.getLiveTimeline ? roomWithTimeline.getLiveTimeline() : null
          if (timeline) {
            const events = timeline.getEvents()
            const messageEvents = events.filter((e: MatrixEvent) => {
              const eventWithRaw = e as MatrixEvent & EventWithRaw
              const type = eventWithRaw.event?.type || (e as unknown as { getType?: () => string })?.getType?.()
              return type === 'm.room.message'
            })
            const visible = messageEvents.slice(-INITIAL_MESSAGES_PER_ROOM)
            this.roomMessages.set(
              roomId,
              visible.map((e: MatrixEvent) => mapEvent(e, this.userId))
            )

            const lastEvent = visible[visible.length - 1]
            if (lastEvent) {
              const eventWithRaw = lastEvent as MatrixEvent & EventWithRaw
              const lastEventId = eventWithRaw.event?.event_id
              if (lastEventId) {
                await matrixClientService.sendReadReceipt(roomId, lastEventId)
                this.unreadCounts.set(roomId, 0)
              }
            }
          }
        }
      }
    },

    async loadMoreMessages(roomId: string, limit = 30) {
      const { client } = useMatrixClient()
      if (!client.value) return
      const getRoomMethod = client.value.getRoom as ((roomId: string) => Room | null) | undefined
      const room = getRoomMethod?.(roomId)
      if (!room) return

      const extendedClient = client.value as ExtendedMatrixClient
      await extendedClient.scrollback?.(room, limit)

      const roomWithTimeline = room as Room & RoomWithTimeline
      const timeline = roomWithTimeline.getLiveTimeline ? roomWithTimeline.getLiveTimeline() : null
      if (!timeline) return

      const events = timeline.getEvents()
      const messageEvents = events.filter((e: MatrixEvent) => {
        const eventWithRaw = e as MatrixEvent & EventWithRaw
        const type = eventWithRaw.event?.type || (e as unknown as { getType?: () => string })?.getType?.()
        return type === 'm.room.message'
      })
      const visible = messageEvents.slice(-MAX_LIVE_MESSAGES_PER_ROOM)
      this.roomMessages.set(
        roomId,
        visible.map((e: MatrixEvent) => mapEvent(e, this.userId))
      )
    },

    async sendTextMessage(roomId: string, text: string) {
      await matrixClientService.sendTextMessage(roomId, text)
      // UI update handled by 'Room.timeline' event listener
    },

    async sendFileMessage(roomId: string, file: File) {
      await matrixClientService.sendMediaMessage(roomId, file, file.name, file.type)
    },

    setupEventListeners() {
      const { client } = useMatrixClient()
      if (!client.value) return

      // Sync State using string literals or Enums if available
      // Note: 'sync' event might be specific to client wrapper or SDK
      const onMethod = client.value.on as ((event: string, handler: (...args: unknown[]) => void) => void) | undefined
      onMethod?.(ClientEvent.Sync, (state: unknown) => {
        const normalized = normalizeSyncState(state)
        this.syncState = normalized
        this.isSyncing = normalized === 'SYNCING'
        if (normalized === 'PREPARED') this.refreshRooms()
      })

      // Room List Updates
      onMethod?.(ClientEvent.Room, () => {
        this.refreshRooms()
      })

      // Timeline Updates (New Messages)
      // Room.timeline is often exposed as "Room.timeline" string in some versions, or RoomEvent.Timeline
      onMethod?.(RoomEvent.Timeline, ((
        event: MatrixEvent,
        room: Room | undefined,
        toStartOfTimeline: boolean | undefined
      ) => {
        if (!room || toStartOfTimeline) return // Pagination
        const eventWithRaw = event as MatrixEvent & EventWithRaw
        const rawEvent = eventWithRaw.event || {}
        const type = rawEvent.type || (event as unknown as { getType?: () => string })?.getType?.()
        if (type !== 'm.room.message') return

        const roomId = room.roomId
        const msgs = this.roomMessages.get(roomId) || []
        msgs.push(mapEvent(event, this.userId))
        if (msgs.length > MAX_LIVE_MESSAGES_PER_ROOM) {
          msgs.splice(0, msgs.length - MAX_LIVE_MESSAGES_PER_ROOM)
        }
        this.roomMessages.set(roomId, msgs)

        // Update unread count
        const sender = rawEvent.sender || (event as unknown as { getSender?: () => string })?.getSender?.()
        if (roomId !== this.currentRoomId && sender !== this.userId) {
          const count = this.unreadCounts.get(roomId) || 0
          this.unreadCounts.set(roomId, count + 1)
        }

        // Refresh room list (to update sorting/preview)
        this.refreshRooms()
      }) as (...args: unknown[]) => void)

      // Call events (Keep logic or delegate to CallService)
      matrixCallService.on('callIncoming', (...args: unknown[]) => {
        const call = args[0] as MatrixCall
        if (call) {
          this.activeCalls.set(call.callId, call)
        }
      })

      // Initialize comprehensive Matrix event handler
      // Handles crypto events, call events, room events, member events, etc.
      const eventHandler = MatrixEventHandler.getInstance()
      eventHandler.initialize()

      // Register callbacks for event handling
      eventHandler.setCallbacks({
        // Sync state changes
        onSyncStateChange: (state: string, prevState: string) => {
          logger.debug(`[MatrixStore] Sync state: ${state} from: ${prevState}`)
        },

        // Room events
        onRoomTopicChange: (roomId: string, topic: string) => {
          logger.debug(`[MatrixStore] Room topic changed: ${roomId} ${topic}`)
          this.refreshRooms()
        },

        onRoomAvatarChange: (roomId: string, avatarUrl: string) => {
          logger.debug(`[MatrixStore] Room avatar changed: ${roomId} ${avatarUrl}`)
          this.refreshRooms()
        },

        onMyMembershipChange: (roomId: string, membership: string, _prevMembership: string) => {
          logger.debug(`[MatrixStore] Membership changed: ${roomId} ${membership}`)
          if (membership === 'leave' || membership === 'ban') {
            this.roomMessages.delete(roomId)
            this.unreadCounts.delete(roomId)
            this.refreshRooms()
          }
        },

        onEventRedaction: (roomId: string, eventId: string, reason?: string) => {
          logger.debug(`[MatrixStore] Event redacted: ${roomId} ${eventId} ${reason || ''}`)
          const msgs = this.roomMessages.get(roomId) || []
          const index = msgs.findIndex((m) => m.eventId === eventId)
          if (index !== -1) {
            msgs.splice(index, 1)
            this.roomMessages.set(roomId, msgs)
          }
        },

        // Member events
        onMemberNameChange: (roomId: string, userId: string, newName: string) => {
          logger.debug(`[MatrixStore] Member name changed: ${roomId} ${userId} ${newName}`)
        },

        onMemberAvatarChange: (roomId: string, userId: string, newAvatarUrl: string) => {
          logger.debug(`[MatrixStore] Member avatar changed: ${roomId} ${userId} ${newAvatarUrl}`)
        },

        onMemberPowerLevelChange: (roomId: string, userId: string, newLevel: number) => {
          logger.debug(`[MatrixStore] Member power level changed: ${roomId} ${userId} ${newLevel}`)
        },

        // Crypto events (E2EE)
        onKeyVerificationRequest: (request: { requestingDevice: { userId: string }; requestId: string }) => {
          logger.debug('[MatrixStore] Key verification request:', request.requestingDevice.userId)

          // Emit event for UI to show verification request dialog
          window.dispatchEvent(
            new CustomEvent('matrix:verification-request', {
              detail: {
                requestId: request.requestId,
                userId: request.requestingDevice.userId,
                timestamp: Date.now()
              }
            })
          )
        },

        onVerificationStatusChange: (requestId: string, status: string) => {
          logger.debug('[MatrixStore] Verification status changed:', requestId, status)

          // Emit event for UI to update verification status
          window.dispatchEvent(
            new CustomEvent('matrix:verification-status-changed', {
              detail: {
                requestId,
                status,
                timestamp: Date.now()
              }
            })
          )
        },

        onUserTrustStatusChange: (userId: string, trustLevel: string) => {
          logger.debug('[MatrixStore] User trust status changed:', userId, trustLevel)

          // Emit event for UI to update trust indicators
          window.dispatchEvent(
            new CustomEvent('matrix:user-trust-changed', {
              detail: {
                userId,
                trustLevel,
                timestamp: Date.now()
              }
            })
          )
        },

        onDeviceVerificationChange: (userId: string, deviceId: string, trustLevel: string) => {
          logger.debug(`[MatrixStore] Device verification changed: ${userId} ${deviceId} ${trustLevel}`)

          // Emit event for UI to update device list
          window.dispatchEvent(
            new CustomEvent('matrix:device-verification-changed', {
              detail: {
                userId,
                deviceId,
                trustLevel,
                timestamp: Date.now()
              }
            })
          )
        },

        // Call events (VoIP)
        onCallInvite: (call: { callId: string; type?: string }) => {
          logger.debug('[MatrixStore] Incoming call:', call.callId)
          // Call events are also handled by matrixCallService
        },

        onCallStateChange: (call: { callId: string; state?: string; type?: string }) => {
          logger.debug('[MatrixStore] Call state changed:', call.callId, call.state)
        },

        onCallHangup: (call: { callId: string }) => {
          logger.debug('[MatrixStore] Call hangup:', call.callId)
          this.activeCalls.delete(call.callId)
        },

        onCallError: (call: { callId: string }, error: Error) => {
          logger.error(`[MatrixStore] Call error: ${call.callId}`, error.toString())
        }
      })
    }
  }
})
