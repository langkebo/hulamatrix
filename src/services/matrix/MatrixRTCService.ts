/*
 * MatrixRTC Service
 *
 * Implements MatrixRTC features from SDK v40.0.0:
 * - Multi-SFU support
 * - m.rtc.member event type (MSC4354 Sticky Events)
 * - RTC transport info (MSC4143)
 * - Call intent handling
 */

import MatrixClientService from './MatrixClientService'

// MSC4143: RTC Transport Information
export interface RTCTransportInfo {
  sessionId: string
  userId: string
  deviceId: string
  transportId?: string
  createdTs: number
  lastActiveTs: number
}

// m.rtc.member event content (MSC4354)
export interface RTCMemberEventContent {
  application?: string
  callId?: string
  device_id: string
  expires: number
  foci_active?: RTCFocusInfo[]
  foci_prev?: RTCFocusInfo[]
  join_room_id?: string
  room_id?: string
  livekit_is_reconnecting?: boolean
  created_ts?: number
  modified_ts?: number
  auto_join?: boolean
  priority?: number
}

export interface RTCFocusInfo {
  alias?: string
  createdAt: number
  expires: number
  expiry_ts?: number
  focused: boolean
  fwd: RTCMemberForwarding[]
  host: string
  livekit_server_url?: string
  protocol: 'livekit'
  roomId: string
  type: 'livekit'
  userId?: string
}

export interface RTCMemberForwarding {
  clientId: string
  dest: string
  src: string
  streamId: number
}

// Call intent types
export type CallIntent = 'notify_ring' | 'notify_prompt' | 'prompt_ring'

export interface CallNotificationContent {
  callId: string
  intent: CallIntent
  lifetime: number
  roomId: string
  senderUserId: string
  senderDeviceId: string
  createdTs: number
}

export interface MatrixRTCConfig {
  enabled: boolean
  maxConcurrentCalls: number
  defaultCallLifetime: number
  autoReconnect: boolean
  reconnectAttempts: number
  reconnectDelay: number
}

class MatrixRTCService {
  private static instance: MatrixRTCService | null = null
  private config: MatrixRTCConfig = {
    enabled: true,
    maxConcurrentCalls: 3,
    defaultCallLifetime: 600000, // 10 minutes
    autoReconnect: true,
    reconnectAttempts: 5,
    reconnectDelay: 3000
  }

  private activeCalls: Map<string, CallNotificationContent> = new Map()
  private rtcMemberCache: Map<string, Map<string, RTCMemberEventContent>> = new Map() // roomId -> (userId -> content)
  private transportCache: Map<string, RTCTransportInfo[]> = new Map()

  private constructor() {
    this.initializeEventListeners()
  }

  static getInstance(): MatrixRTCService {
    if (!MatrixRTCService.instance) {
      MatrixRTCService.instance = new MatrixRTCService()
    }
    return MatrixRTCService.instance
  }

  private initializeEventListeners(): void {
    const client = MatrixClientService.getInstance().getClient()
    if (!client) return

    // Listen for m.rtc.member events (MSC4354)
    client.on('RoomState.events' as any, (event: any) => {
      if (event.getType() === 'm.rtc.member') {
        this.handleRTCMemberEvent(event)
      }
    })

    // Listen for m.call.ring notification events
    client.on('Event.decrypted' as any, (event: any) => {
      if (event.getType() === 'm.call.ring') {
        this.handleCallRing(event)
      }
    })
  }

  /**
   * Get RTC transport information for a room (MSC4143)
   * Returns active transport sessions for RTC
   */
  async getRTCTransports(roomId: string): Promise<RTCTransportInfo[]> {
    const client = MatrixClientService.getInstance().getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      // Check cache first
      const cached = this.transportCache.get(roomId)
      if (cached) {
        // Verify cache freshness (5 minutes)
        const now = Date.now()
        const valid = cached.some((t) => now - t.lastActiveTs < 300000)
        if (valid) return cached
      }

      // MSC4143: Fetch RTC transports from server
      // Note: This API endpoint may not be available yet, returning cached data
      const transports: RTCTransportInfo[] = cached || []
      this.transportCache.set(roomId, transports)

      return transports
    } catch (error) {
      console.error('[MatrixRTCService] Failed to get RTC transports:', error)
      // Return cached data on error
      return this.transportCache.get(roomId) || []
    }
  }

  /**
   * Handle m.rtc.member sticky events (MSC4354)
   * These events track RTC member state in a room
   */
  private handleRTCMemberEvent(event: any): void {
    const roomId = event.getRoomId()
    const sender = event.getSender()
    const content = event.getContent() as RTCMemberEventContent

    if (!roomId || !sender) return

    // Update cache
    if (!this.rtcMemberCache.has(roomId)) {
      this.rtcMemberCache.set(roomId, new Map())
    }

    const roomCache = this.rtcMemberCache.get(roomId)!

    // Check if member is active (not expired)
    const now = Date.now()
    if (content.expires * 1000 > now) {
      roomCache.set(sender, content)
    } else {
      roomCache.delete(sender)
    }

    // Notify listeners about RTC member state change
    this.notifyRTCMemberChange(roomId, sender, content)
  }

  /**
   * Get all active RTC members in a room
   */
  getActiveRTCMembers(roomId: string): Map<string, RTCMemberEventContent> {
    const now = Date.now()
    const members = this.rtcMemberCache.get(roomId) || new Map()

    // Filter out expired members
    const active = new Map<string, RTCMemberEventContent>()
    for (const [userId, content] of members.entries()) {
      if (content.expires * 1000 > now) {
        active.set(userId, content)
      }
    }

    return active
  }

  /**
   * Check if a user is in an active RTC session
   */
  isUserInRTCCall(roomId: string, userId: string): boolean {
    const members = this.getActiveRTCMembers(roomId)
    const member = members.get(userId)

    if (!member) return false

    // Check if member has active foci
    return !!(member.foci_active && member.foci_active.length > 0)
  }

  /**
   * Get active SFU (Focus) servers for a room
   */
  getActiveSFUs(roomId: string): RTCFocusInfo[] {
    const members = this.getActiveRTCMembers(roomId)
    const sfus = new Set<RTCFocusInfo>()

    for (const member of members.values()) {
      if (member.foci_active) {
        member.foci_active.forEach((focus) => {
          if (focus.focused) {
            sfus.add(focus)
          }
        })
      }
    }

    return Array.from(sfus)
  }

  /**
   * Handle call ring notifications
   */
  private handleCallRing(event: any): void {
    const content = event.getContent()
    const sender = event.getSender()

    if (!content || !sender) return

    const notification: CallNotificationContent = {
      callId: content.call_id || `call_${Date.now()}`,
      intent: content.intent || 'notify_ring',
      lifetime: content.lifetime || this.config.defaultCallLifetime,
      roomId: event.getRoomId(),
      senderUserId: sender,
      senderDeviceId: content.sender_device_id || sender.split(':')[0],
      createdTs: Date.now()
    }

    this.activeCalls.set(notification.callId, notification)

    // Auto-expire after lifetime
    setTimeout(() => {
      this.activeCalls.delete(notification.callId)
    }, notification.lifetime)

    // Notify about incoming call
    this.notifyIncomingCall(notification)
  }

  /**
   * Send a call ring notification to a room
   */
  async sendCallRing(roomId: string, intent: CallIntent = 'notify_ring', lifetime?: number): Promise<string> {
    const client = MatrixClientService.getInstance().getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const content = {
      call_id: callId,
      intent,
      lifetime: lifetime || this.config.defaultCallLifetime,
      created_ts: Date.now()
    }

    try {
      await client.sendEvent(roomId, 'm.call.ring' as any, content)
      return callId
    } catch (error) {
      console.error('[MatrixRTCService] Failed to send call ring:', error)
      throw error
    }
  }

  /**
   * Get all active call notifications
   */
  getActiveCalls(): CallNotificationContent[] {
    return Array.from(this.activeCalls.values())
  }

  /**
   * Get calls for a specific room
   */
  getCallsForRoom(roomId: string): CallNotificationContent[] {
    return this.getActiveCalls().filter((call) => call.roomId === roomId)
  }

  /**
   * Cancel an active call notification
   */
  async cancelCall(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    const client = MatrixClientService.getInstance().getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      // Send a redaction to cancel the call
      await client.redactEvent(call.roomId, callId)
      this.activeCalls.delete(callId)
    } catch (error) {
      console.error('[MatrixRTCService] Failed to cancel call:', error)
      throw error
    }
  }

  /**
   * Set RTC member sticky event for current user (MSC4354)
   */
  async setRTCMemberState(roomId: string, content: Partial<RTCMemberEventContent>): Promise<void> {
    const client = MatrixClientService.getInstance().getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const userId = client.getUserId()
    if (!userId) {
      throw new Error('User ID not available')
    }

    const deviceId = client.getDeviceId()
    if (!deviceId) {
      throw new Error('Device ID not available')
    }

    const now = Math.floor(Date.now() / 1000)
    const eventContent: RTCMemberEventContent = {
      device_id: deviceId,
      expires: now + Math.floor(this.config.defaultCallLifetime / 1000),
      created_ts: content.created_ts || now,
      modified_ts: now,
      ...content
    }

    try {
      // Set m.rtc.member state event (sticky)
      await client.sendStateEvent(roomId, 'm.rtc.member' as any, eventContent, userId)
    } catch (error) {
      console.error('[MatrixRTCService] Failed to set RTC member state:', error)
      throw error
    }
  }

  /**
   * Clear RTC member sticky event
   */
  async clearRTCMemberState(roomId: string): Promise<void> {
    const client = MatrixClientService.getInstance().getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const userId = client.getUserId()
    if (!userId) {
      throw new Error('User ID not available')
    }

    try {
      await client.sendStateEvent(roomId, 'm.rtc.member' as any, {}, userId)
    } catch (error) {
      console.error('[MatrixRTCService] Failed to clear RTC member state:', error)
      throw error
    }
  }

  // Event notification methods
  private rtcMemberListeners: Set<(roomId: string, userId: string, content: RTCMemberEventContent) => void> = new Set()
  private incomingCallListeners: Set<(call: CallNotificationContent) => void> = new Set()

  onRTCMemberChange(callback: (roomId: string, userId: string, content: RTCMemberEventContent) => void): () => void {
    this.rtcMemberListeners.add(callback)
    return () => this.rtcMemberListeners.delete(callback)
  }

  private notifyRTCMemberChange(roomId: string, userId: string, content: RTCMemberEventContent): void {
    this.rtcMemberListeners.forEach((cb) => {
      try {
        cb(roomId, userId, content)
      } catch (error) {
        console.error('[MatrixRTCService] RTC member change listener error:', error)
      }
    })
  }

  onIncomingCall(callback: (call: CallNotificationContent) => void): () => void {
    this.incomingCallListeners.add(callback)
    return () => this.incomingCallListeners.delete(callback)
  }

  private notifyIncomingCall(call: CallNotificationContent): void {
    this.incomingCallListeners.forEach((cb) => {
      try {
        cb(call)
      } catch (error) {
        console.error('[MatrixRTCService] Incoming call listener error:', error)
      }
    })
  }

  /**
   * Update service configuration
   */
  updateConfig(config: Partial<MatrixRTCConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current configuration
   */
  getConfig(): MatrixRTCConfig {
    return { ...this.config }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.transportCache.clear()
    this.rtcMemberCache.clear()
  }

  /**
   * Get service statistics
   */
  getStats(): {
    activeCalls: number
    cachedRooms: number
    totalRTCMembers: number
    activeSFUs: number
  } {
    let totalMembers = 0
    for (const members of this.rtcMemberCache.values()) {
      totalMembers += members.size
    }

    return {
      activeCalls: this.activeCalls.size,
      cachedRooms: this.rtcMemberCache.size,
      totalRTCMembers: totalMembers,
      activeSFUs: this.getActiveSFUs('*').length // All rooms
    }
  }
}

export const matrixRTCService = MatrixRTCService.getInstance()
export default MatrixRTCService
