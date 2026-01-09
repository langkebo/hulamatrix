/**
 * Matrix Push Notification Service
 * Handles Matrix push rules, notifications, and browser notifications
 *
 * Optimized to use SDK's PushProcessor for rule evaluation while maintaining
 * custom browser notification handling (not provided by SDK).
 */

import { matrixClientService } from '@/matrix/core/client'
import { logger } from '@/utils/logger'
import { parseMatrixEvent } from '@/utils/messageUtils'
import { MsgEnum } from '@/enums'
import type { MatrixPushRule, MatrixPresence, MatrixTypingEvent } from '@/types/matrix'
// @ts-expect-error - PushProcessor is exported from matrix-js-sdk
import { PushProcessor } from 'matrix-js-sdk/lib/push/PushProcessor'

export interface PushRuleScope {
  /** Global rules */
  global: boolean
  /** Device-specific rules */
  device: boolean
  /** Room-specific rules */
  room?: string
}

export interface NotificationContent {
  /** Notification ID */
  id: string
  /** Notification title */
  title: string
  /** Notification body */
  body: string
  /** Notification icon/avatar */
  icon?: string
  /** Notification sound name */
  sound?: string
  /** Room ID */
  roomId: string
  /** Event ID */
  eventId: string
  /** Sender ID */
  senderId: string
  /** Room name */
  roomName?: string
  /** Room avatar */
  roomAvatar?: string
  /** Sender display name */
  senderName?: string
  /** Message type */
  msgType?: string
  /** Is urgent notification */
  urgent?: boolean
  /** Notification actions */
  actions?: NotificationAction[]
  /** Notification read status */
  read?: boolean
  /** Notification type */
  type?: string
  /** Notification timestamp */
  timestamp?: number
}

export interface NotificationAction {
  /** Action ID */
  action: string
  /** Action title */
  title: string
  /** Action icon */
  icon?: string
}

export interface PushRuleEvaluator {
  /** Should notify */
  shouldNotify: boolean
  /** Notification highlight */
  highlight: boolean
  /** Notification sound */
  sound?: string
  /** Notification actions */
  actions?: NotificationAction[]
}

// Type definitions for Matrix SDK objects
interface MatrixEventLike {
  getType?(): string
  getSender(): string
  getId(): string
  getTs(): number
  getContent?<T = unknown>(): T
  content?: Record<string, unknown>
  sender?: { userId?: string }
}

interface MatrixRoomLike {
  roomId: string
  name?: string
  getLiveTimeline(): { getState(): MatrixRoomStateLike }
  getMember?(userId: string): MatrixMemberLike | undefined
  getAvatarUrl?(
    baseUrl: string,
    width: number,
    height: number,
    resizeMethod: string,
    allowDefault: boolean,
    allowDirectLinks: boolean
  ): string | undefined
}

interface MatrixRoomStateLike {
  getUserDisplayName(userId: string): string | undefined
}

interface MatrixMemberLike {
  userId: string
  name?: string
  membership?: string
  room?: MatrixRoomLike
  getAvatarUrl?(
    baseUrl: string,
    width: number,
    height: number,
    resizeMethod: string,
    allowDefault: boolean,
    allowDirectLinks: boolean
  ): string | undefined
}

interface MatrixClientLike {
  getUserId?(): string
  baseUrl?: string
  getPushRules?(): Promise<PushRulesResponse>
  addPushRule?(scope: string, type: string, ruleId: string, rule: MatrixPushRule): Promise<void>
  deletePushRule?(scope: string, type: string, ruleId: string): Promise<void>
  on?(event: string, handler: (...args: unknown[]) => void): void
}

interface PushRulesResponse {
  global?: PushRuleSet
  device?: PushRuleSet
}

interface PushRuleSet {
  override?: MatrixPushRule[]
  underride?: MatrixPushRule[]
  sender?: MatrixPushRule[]
  room?: MatrixPushRule[]
  content?: MatrixPushRule[]
}

/**
 * Matrix Push Notification Service
 */
export class MatrixPushService {
  private static instance: MatrixPushService
  private pushRules: Map<string, MatrixPushRule[]> = new Map()
  private notificationPermission: NotificationPermission = 'default'
  private activeNotifications = new Map<string, Notification>()
  private isInitialized = false
  // SDK PushProcessor for rule evaluation (replaces custom logic)
  private pushProcessor: PushProcessor | null = null

  static getInstance(): MatrixPushService {
    if (!MatrixPushService.instance) {
      MatrixPushService.instance = new MatrixPushService()
    }
    return MatrixPushService.instance
  }

  /**
   * Check if push service is initialized
   */
  getIsInitialized(): boolean {
    return this.isInitialized
  }

  /**
   * Initialize the push service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('[MatrixPushService] Initializing push notification service (with SDK PushProcessor)')

      // Check and request notification permission
      await this.requestNotificationPermission()

      // Initialize SDK PushProcessor
      const client = matrixClientService.getClient()
      if (client) {
        this.pushProcessor = new PushProcessor({ client })
        logger.info('[MatrixPushService] SDK PushProcessor initialized')
      }

      // Load existing push rules (for display/management)
      await this.loadPushRules()

      // Set up push notification handlers
      this.setupPushHandlers()

      this.isInitialized = true
      logger.info('[MatrixPushService] Push notification service initialized')
    } catch (error) {
      logger.error('[MatrixPushService] Failed to initialize push service:', error)
      throw error
    }
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      logger.warn('[MatrixPushService] This browser does not support notifications')
      return 'denied'
    }

    if (Notification.permission === 'default') {
      this.notificationPermission = await Notification.requestPermission()
    } else {
      this.notificationPermission = Notification.permission
    }

    logger.info('[MatrixPushService] Notification permission:', this.notificationPermission)
    return this.notificationPermission
  }

  /**
   * Load push rules from server
   */
  async loadPushRules(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('[MatrixPushService] No client available to load push rules')
      return
    }

    try {
      logger.info('[MatrixPushService] Loading push rules')

      // Get push rules from server
      const clientLike = client as unknown as MatrixClientLike
      const response = clientLike.getPushRules
        ? await clientLike.getPushRules()
        : ({ global: {}, device: {} } as PushRulesResponse)

      const flatten = (set: PushRuleSet): MatrixPushRule[] => {
        if (!set) return []
        const parts: MatrixPushRule[][] = [
          set.override || [],
          set.underride || [],
          set.sender || [],
          set.room || [],
          set.content || []
        ]
        return ([] as MatrixPushRule[]).concat(...parts)
      }

      const globalRules = flatten(response.global || {})
      const deviceRules = flatten(response.device || {})

      this.pushRules.set('global', globalRules)
      this.pushRules.set('device', deviceRules)

      logger.info('[MatrixPushService] Push rules loaded', {
        global: globalRules.length,
        device: deviceRules.length
      })
    } catch (error) {
      logger.error('[MatrixPushService] Failed to load push rules:', error)
      // Use default push rules
      this.loadDefaultPushRules()
    }
  }

  /**
   * Load default push rules
   */
  private loadDefaultPushRules(): void {
    const defaultRules: MatrixPushRule[] = [
      {
        ruleId: 'm.rule.contains_display_name',
        type: 'content',
        enabled: true,
        default: true,
        pattern: '{{displayname}}',
        actions: [{ notify: true }, { set_tweak: 'highlight' }, { set_tweak: 'sound', value: 'default' }]
      },
      {
        ruleId: 'm.rule.contains_user_name',
        type: 'content',
        enabled: true,
        default: true,
        pattern: '{{userid}}',
        actions: [{ notify: true }, { set_tweak: 'highlight' }, { set_tweak: 'sound', value: 'default' }]
      },
      {
        ruleId: 'm.rule.invite_for_me',
        type: 'override',
        enabled: true,
        default: true,
        conditions: [
          { kind: 'event_match', key: 'type', pattern: 'm.room.member' },
          { kind: 'event_match', key: 'content.membership', pattern: 'invite' },
          { kind: 'event_match', key: 'state_key', pattern: '{{userid}}' }
        ],
        actions: [{ notify: true }, { set_tweak: 'sound', value: 'default' }]
      },
      {
        ruleId: 'm.rule.member_event',
        type: 'override',
        enabled: true,
        default: true,
        conditions: [{ kind: 'event_match', key: 'type', pattern: 'm.room.member' }],
        actions: [{ notify: false }]
      },
      {
        ruleId: 'm.rule.suppress_notices',
        type: 'content',
        enabled: true,
        default: true,
        conditions: [{ kind: 'event_match', key: 'content.msgtype', pattern: 'm.notice' }],
        actions: [{ notify: false }]
      }
    ]

    this.pushRules.set('global', defaultRules)
    logger.info('[MatrixPushService] Using default push rules')
  }

  /**
   * Set up push notification handlers
   */
  private setupPushHandlers(): void {
    const client = matrixClientService.getClient()
    if (!client) {
      return
    }
    const clientLike = client as unknown as MatrixClientLike

    // Listen for timeline events
    clientLike.on?.('Room.timeline', (...args: unknown[]) => {
      const [event, room] = args as [MatrixEventLike, MatrixRoomLike]
      this.handleTimelineEvent(event, room)
    })

    // Listen for typing events
    clientLike.on?.('Room.typing', (...args: unknown[]) => {
      const [event] = args as [MatrixTypingEvent]
      this.handleTypingEvent(event)
    })

    // Listen for presence changes
    clientLike.on?.('User.presence', (...args: unknown[]) => {
      const [event] = args as [MatrixPresence]
      this.handlePresenceEvent(event)
    })

    // Listen for invitation events
    clientLike.on?.('RoomMember.membership', (...args: unknown[]) => {
      const [event, member] = args as [MatrixEventLike, MatrixMemberLike]
      this.handleMembershipEvent(event, member)
    })
  }

  /**
   * Handle timeline events for notifications
   */
  private async handleTimelineEvent(event: MatrixEventLike, room: MatrixRoomLike): Promise<void> {
    try {
      // Skip our own events
      const client = matrixClientService.getClient()
      const clientLike = client as unknown as MatrixClientLike
      const currentUserId = clientLike?.getUserId?.()
      if (event.sender?.userId === currentUserId) {
        return
      }

      // Skip events that don't need notifications
      if (!this.shouldNotifyForEvent(event)) {
        return
      }

      // Evaluate push rules
      const evaluator = await this.evaluatePushRules(event, room)
      if (!evaluator.shouldNotify) {
        return
      }

      // Extract notification content
      const notification = this.extractNotificationContent(event, room, evaluator)
      if (!notification) {
        return
      }

      // Show notification
      await this.showNotification(notification)
    } catch (error) {
      logger.error('[MatrixPushService] Failed to handle timeline event:', error)
    }
  }

  /**
   * Check if event should be considered for notifications
   */
  private shouldNotifyForEvent(event: MatrixEventLike): boolean {
    const eventType = event.getType?.()

    // Only notify for these event types
    const notifyTypes = ['m.room.message', 'm.room.encrypted', 'm.call.invite', 'm.reaction']

    return eventType ? notifyTypes.includes(eventType) : false
  }

  /**
   * Evaluate push rules for an event using SDK PushProcessor
   *
   * Replaces custom implementation with SDK's PushProcessor.actionsForEvent()
   */
  private async evaluatePushRules(event: MatrixEventLike, room: MatrixRoomLike): Promise<PushRuleEvaluator> {
    // Default evaluator
    const evaluator: PushRuleEvaluator = {
      shouldNotify: false,
      highlight: false
    }

    // Use SDK PushProcessor if available (recommended by Phase 10 optimization)
    if (this.pushProcessor) {
      try {
        // Convert our event-like object to SDK MatrixEvent format
        const sdkEvent = this.convertToSdkEvent(event, room)
        if (sdkEvent) {
          // Use SDK's PushProcessor to evaluate push rules
          const pushDetails = this.pushProcessor.actionsForEvent(sdkEvent)

          // Map SDK push details to our evaluator format
          evaluator.shouldNotify = pushDetails.notify || false
          evaluator.highlight = pushDetails.tweaks?.highlight || false
          evaluator.sound = pushDetails.tweaks?.sound as string

          logger.debug('[MatrixPushService] SDK PushProcessor evaluation result:', {
            shouldNotify: evaluator.shouldNotify,
            highlight: evaluator.highlight,
            sound: evaluator.sound
          })

          return evaluator
        }
      } catch (error) {
        logger.warn('[MatrixPushService] SDK PushProcessor evaluation failed, using fallback:', error)
        // Fall through to custom implementation
      }
    }

    // Fallback: Custom implementation (when SDK is not available)
    const roomState = room.getLiveTimeline().getState()

    // Get current user info
    const client = matrixClientService.getClient()
    const clientLike = client as unknown as MatrixClientLike
    const userId = clientLike?.getUserId?.() || ''
    const userDisplayName = roomState?.getUserDisplayName(userId) || userId

    // Get all applicable rules
    const rules = [
      ...(this.pushRules.get('global') || []),
      ...(this.pushRules.get('device') || []),
      ...(this.pushRules.get(room.roomId) || [])
    ].filter((rule) => rule.enabled)

    // Evaluate each rule
    for (const rule of rules) {
      if (
        await this.evaluateRule(rule, event, room, {
          userId,
          userDisplayName
        })
      ) {
        evaluator.shouldNotify = true

        // Apply rule actions
        for (const action of rule.actions) {
          if (action.notify) {
            evaluator.shouldNotify = true
          }
          if (action.set_tweak === 'highlight') {
            evaluator.highlight = true
          }
          if (action.set_tweak === 'sound') {
            evaluator.sound = typeof action.value === 'string' ? action.value : 'default'
          }
        }

        // Stop at first matching rule (unless it's an override rule)
        if (rule.type !== 'override') {
          break
        }
      }
    }

    return evaluator
  }

  /**
   * Convert our event-like object to SDK MatrixEvent format
   * This is needed for PushProcessor.actionsForEvent()
   */
  private convertToSdkEvent(event: MatrixEventLike, room: MatrixRoomLike): unknown {
    const client = matrixClientService.getClient()
    if (!client) return null

    // Get the actual Room object from client
    // Use type assertion to bypass TS limitations
    const sdkClient = client as {
      getRoom?: (roomId: string) => { getLiveTimeline?: () => { getEvents?: () => unknown[] } | null } | null
    }
    const sdkRoom = sdkClient.getRoom?.(room.roomId)
    if (!sdkRoom) return null

    // Get the actual event from room timeline
    const timeline = sdkRoom.getLiveTimeline?.()
    if (!timeline) return null

    const events = timeline.getEvents?.()
    if (!events) return null

    const sdkEvent = events.find((e: unknown) => {
      const eventLike = e as { getId?: () => string } | null
      return eventLike?.getId?.() === event.getId()
    })
    return sdkEvent || null
  }

  /**
   * Evaluate a single push rule
   */
  private async evaluateRule(
    rule: MatrixPushRule,
    event: MatrixEventLike,
    room: MatrixRoomLike,
    context: { userId: string; userDisplayName: string }
  ): Promise<boolean> {
    const content = (event.getContent?.() || event.content || {}) as Record<string, unknown>

    switch (rule.type) {
      case 'content':
        return this.evaluateContentRule(rule, content, context)

      case 'sender':
        return rule.pattern ? event.getSender().includes(rule.pattern) : true

      case 'room':
        return rule.pattern ? room.roomId.includes(rule.pattern) : true

      default:
        return false
    }
  }

  /**
   * Evaluate content-based push rule
   */
  private evaluateContentRule(
    rule: MatrixPushRule,
    content: Record<string, unknown>,
    context: { userId: string; userDisplayName: string }
  ): boolean {
    if (!rule.pattern || !content.body) {
      return false
    }

    // Substitute template variables
    const pattern = rule.pattern
      .replace('{{displayname}}', context.userDisplayName)
      .replace('{{userid}}', context.userId)

    // Check if pattern matches message body
    const regex = new RegExp(pattern, 'i')
    return typeof content.body === 'string' && regex.test(content.body)
  }

  /**
   * Extract notification content from Matrix event
   */
  private extractNotificationContent(
    event: MatrixEventLike,
    room: MatrixRoomLike,
    evaluator: PushRuleEvaluator
  ): NotificationContent | null {
    try {
      const sender = event.getSender()
      const roomId = room.roomId
      const eventId = event.getId()

      // Get room and sender info
      const roomName = room.name || roomId
      const senderMember = room.getMember?.(sender)
      const senderName = senderMember?.name || sender.split(':')[0]?.substring(1) || sender

      // Parse event to get message content - adapt to messageUtils.MatrixEventLike
      const adaptedEvent = (() => {
        const result: {
          getContent?: <T = Record<string, unknown>>() => T
          content?: Record<string, unknown>
          getSender?: () => string
          sender?: string
          getRoomId?: () => string
          roomId?: string
          getId?: () => string
          eventId?: string
          getTs?: () => number
        } = {
          sender,
          roomId,
          eventId
        }
        if (event.getContent !== undefined) result.getContent = event.getContent
        if (event.content !== undefined) result.content = event.content
        if (sender !== undefined) {
          result.getSender = () => sender
          result.sender = sender
        }
        if (roomId !== undefined) {
          result.getRoomId = () => roomId
          result.roomId = roomId
        }
        if (eventId !== undefined) {
          result.getId = () => eventId
          result.eventId = eventId
        }
        if (event.getTs !== undefined) result.getTs = event.getTs
        return result
      })()
      const parsedEvent = parseMatrixEvent(adaptedEvent)

      // Generate notification body
      let body = ''
      switch (parsedEvent.type) {
        case MsgEnum.TEXT:
          body = (parsedEvent.body as { text?: string })?.text || 'New message'
          break
        case MsgEnum.IMAGE:
          body = '[图片]'
          break
        case MsgEnum.VIDEO:
          body = '[视频]'
          break
        case MsgEnum.VOICE:
          body = '[语音]'
          break
        case MsgEnum.FILE:
          body = `[文件] ${(parsedEvent.body as { fileName?: string })?.fileName || ''}`
          break
        case MsgEnum.LOCATION:
          body = '[位置]'
          break
        case MsgEnum.EMOJI:
          body = '[表情回应]'
          break
        default:
          body = 'New message'
      }

      // Check if it's a reply
      if ((parsedEvent.body as { replyEventId?: string })?.replyEventId) {
        body = `回复: ${body}`
      }

      const notification: NotificationContent = (() => {
        const result: NotificationContent = {
          id: eventId, // Use eventId as notification ID
          title: senderName,
          body: `${roomName}: ${body}`,
          roomId,
          eventId,
          senderId: sender,
          msgType: String(parsedEvent.type), // Convert MsgEnum to string
          urgent: evaluator.highlight,
          actions: this.generateNotificationActions(roomId, eventId, evaluator)
        }
        if (roomName !== undefined) result.roomName = roomName
        if (senderName !== undefined) result.senderName = senderName
        if (evaluator.sound !== undefined) result.sound = evaluator.sound
        return result
      })()

      // Add room avatar if available
      const client = matrixClientService.getClient()
      const clientLike = client as unknown as MatrixClientLike
      const baseUrl: string = clientLike?.baseUrl || ''
      const roomAvatar = room.getAvatarUrl?.(baseUrl, 64, 64, 'crop', true, true)
      if (roomAvatar) {
        notification.icon = roomAvatar
      }

      // Add sender avatar if available
      const senderAvatar = senderMember?.getAvatarUrl?.(baseUrl, 64, 64, 'crop', true, true)
      if (senderAvatar) {
        notification.icon = senderAvatar
      }

      return notification
    } catch (error) {
      logger.error('[MatrixPushService] Failed to extract notification content:', error)
      return null
    }
  }

  /**
   * Generate notification actions
   */
  private generateNotificationActions(
    _roomId: string,
    _eventId: string,
    evaluator: PushRuleEvaluator
  ): NotificationAction[] {
    const actions: NotificationAction[] = [
      {
        action: 'open',
        title: '查看消息'
      }
    ]

    if (evaluator.highlight) {
      actions.push({
        action: 'mark_read',
        title: '标记已读'
      })
    }

    return actions
  }

  /**
   * Show browser notification
   */
  private async showNotification(notification: NotificationContent): Promise<void> {
    if (this.notificationPermission !== 'granted') {
      logger.warn('[MatrixPushService] Notification permission not granted')
      return
    }

    try {
      // Check if notification for this event already exists
      const existingNotification = this.activeNotifications.get(notification.eventId)
      if (existingNotification) {
        // Close existing notification
        existingNotification.close()
        this.activeNotifications.delete(notification.eventId)
      }

      // Create browser notification
      const browserNotification = new Notification(
        notification.title,
        (() => {
          const options: {
            body: string
            icon?: string
            tag: string
            requireInteraction?: boolean
            silent?: boolean
          } = {
            body: notification.body,
            tag: notification.eventId
          }
          if (notification.icon !== undefined) options.icon = notification.icon
          if (notification.urgent !== undefined) options.requireInteraction = notification.urgent
          if (notification.sound !== undefined) options.silent = !notification.sound
          return options
        })()
      )

      // Store notification reference
      this.activeNotifications.set(notification.eventId, browserNotification)

      // Set up click handler
      browserNotification.onclick = () => {
        this.handleNotificationClick(notification)
      }

      // Set up close handler
      browserNotification.onclose = () => {
        this.activeNotifications.delete(notification.eventId)
      }

      // Auto-close after 5 seconds if not urgent
      if (!notification.urgent) {
        setTimeout(() => {
          if (browserNotification) {
            browserNotification.close()
          }
        }, 5000)
      }

      logger.debug('[MatrixPushService] Notification shown', {
        eventId: notification.eventId,
        roomId: notification.roomId
      })
    } catch (error) {
      logger.error('[MatrixPushService] Failed to show notification:', error)
    }
  }

  /**
   * Handle notification click
   */
  private handleNotificationClick(notification: NotificationContent): void {
    // Close the notification
    const browserNotification = this.activeNotifications.get(notification.eventId)
    if (browserNotification) {
      browserNotification.close()
      this.activeNotifications.delete(notification.eventId)
    }

    // Emit event for UI to handle
    const clickEvent = new CustomEvent('matrixNotificationClick', {
      detail: {
        eventId: notification.eventId,
        roomId: notification.roomId,
        action: 'open'
      }
    })
    window.dispatchEvent(clickEvent)

    // Focus the window
    window.focus?.()

    logger.info('[MatrixPushService] Notification clicked', {
      eventId: notification.eventId,
      roomId: notification.roomId
    })
  }

  /**
   * Handle typing events
   */
  private handleTypingEvent(_event: MatrixTypingEvent): void {
    // Don't show notifications for typing events
    // This can be used to update typing indicators in the UI
  }

  /**
   * Handle presence events
   */
  private handlePresenceEvent(_event: MatrixPresence): void {
    // Don't show notifications for presence events
    // This can be used to update presence status in the UI
  }

  /**
   * Handle membership events (invites, joins, leaves)
   */
  private async handleMembershipEvent(event: MatrixEventLike, member: MatrixMemberLike): Promise<void> {
    try {
      const membership = member.membership
      const userId = member.userId

      // Get current user ID
      const client = matrixClientService.getClient()
      const clientLike = client as unknown as MatrixClientLike
      const currentUserId = clientLike?.getUserId?.()

      // Only handle invitations for current user
      if (membership === 'invite' && userId === currentUserId) {
        const room = member.room
        const roomName = room?.name || 'Unknown Room'
        const inviterName = member.name || member.userId.split(':')[0]?.substring(1) || member.userId

        const notification: NotificationContent = {
          id: `invite-${room?.roomId || ''}-${Date.now()}`, // Generate unique ID
          title: 'Room Invitation',
          body: `${inviterName} invited you to ${roomName}`,
          roomId: room?.roomId || '',
          eventId: event.getId(),
          senderId: member.userId,
          roomName,
          senderName: inviterName,
          urgent: true
        }

        await this.showNotification(notification)
      }
    } catch (error) {
      logger.error('[MatrixPushService] Failed to handle membership event:', error)
    }
  }

  /**
   * Add custom push rule
   */
  async addPushRule(
    scope: string,
    type: string,
    ruleId: string,
    rule: Omit<MatrixPushRule, 'ruleId' | 'type'>
  ): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      const clientLike = client as unknown as MatrixClientLike
      await clientLike.addPushRule?.(scope, type, ruleId, {
        ...rule,
        type,
        ruleId,
        enabled: rule.enabled ?? true,
        actions: rule.actions ?? ['notify']
      } as MatrixPushRule)

      // Refresh rules
      await this.loadPushRules()

      logger.info('[MatrixPushService] Push rule added', { scope, type, ruleId })
    } catch (error) {
      logger.error('[MatrixPushService] Failed to add push rule:', error)
      throw error
    }
  }

  /**
   * Remove push rule
   */
  async removePushRule(scope: string, type: string, ruleId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      const clientLike = client as unknown as MatrixClientLike
      await clientLike.deletePushRule?.(scope, type, ruleId)

      // Refresh rules
      await this.loadPushRules()

      logger.info('[MatrixPushService] Push rule removed', { scope, type, ruleId })
    } catch (error) {
      logger.error('[MatrixPushService] Failed to remove push rule:', error)
      throw error
    }
  }

  /**
   * Get all push rules
   */
  getPushRules(): Map<string, MatrixPushRule[]> {
    return new Map(this.pushRules)
  }

  /**
   * Clear all notifications
   */
  clearAllNotifications(): void {
    for (const notification of this.activeNotifications.values()) {
      notification.close()
    }
    this.activeNotifications.clear()
    logger.info('[MatrixPushService] All notifications cleared')
  }

  /**
   * Get notification permission
   */
  getNotificationPermission(): NotificationPermission {
    return this.notificationPermission
  }

  /**
   * Test notification
   */
  async testNotification(): Promise<void> {
    const testNotification: NotificationContent = {
      id: 'test-notification',
      title: 'Test Notification',
      body: 'This is a test notification from HuLamatrix',
      roomId: 'test',
      eventId: 'test',
      senderId: 'test',
      roomName: 'Test Room',
      senderName: 'Test User'
    }

    await this.showNotification(testNotification)
  }
}

// Export singleton instance
export const matrixPushService = MatrixPushService.getInstance()
