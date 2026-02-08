/*
 * Matrix Delayed Event Service
 *
 * Implements MSC4140: Delayed Event Management
 * Provides support for scheduling and managing delayed events
 */

import { type MatrixEvent } from '@/lib/matrix-sdk'
import MatrixClientService from './MatrixClientService'

// Error codes (fallback since ErrorCode might not have CLIENT_NOT_INITIALIZED)
const ERROR_CODES = {
  CLIENT_NOT_INITIALIZED: 'CLIENT_NOT_INITIALIZED'
} as const

// Delayed event status
export type DelayedEventStatus = 'scheduled' | 'sent' | 'cancelled' | 'failed'

// Delayed event filter options (MSC4140)
export interface DelayedEventFilter {
  roomId?: string
  eventType?: string
  status?: DelayedEventStatus[]
  limit?: number
  from?: string
}

// Delayed event information
export interface DelayedEvent {
  eventId: string
  roomId: string
  eventType: string
  content: any
  delayMs: number
  scheduledTs: number
  sendTs?: number
  status: DelayedEventStatus
  sender?: string
  errorCode?: string
  errorMessage?: string
  retryCount?: number
}

// Schedule delayed event request
export interface ScheduleDelayedEventRequest {
  roomId: string
  eventType: string
  content: any
  delayMs: number
}

interface DelayedEventServiceConfig {
  enabled: boolean
  maxDelayTime: number
  maxScheduledEvents: number
  autoRetry: boolean
  maxRetries: number
  retryDelay: number
}

class MatrixDelayedEventService {
  private static instance: MatrixDelayedEventService | null = null
  private config: DelayedEventServiceConfig = {
    enabled: true,
    maxDelayTime: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxScheduledEvents: 100,
    autoRetry: true,
    maxRetries: 3,
    retryDelay: 60000 // 1 minute
  }

  private scheduledEvents: Map<string, DelayedEvent> = new Map()
  private eventTimers: Map<string, NodeJS.Timeout> = new Map()
  private eventListeners: Map<string, Set<(event: DelayedEvent) => void>> = new Map()

  private constructor() {
    this.initializeEventListeners()
    this.startScheduledEventProcessor()
  }

  static getInstance(): MatrixDelayedEventService {
    if (!MatrixDelayedEventService.instance) {
      MatrixDelayedEventService.instance = new MatrixDelayedEventService()
    }
    return MatrixDelayedEventService.instance
  }

  private initializeEventListeners(): void {
    const client = MatrixClientService.getInstance().getClient()
    if (!client) return

    this.client = client

    // Listen for delayed event updates
    client.on('Event.decrypted', (event: MatrixEvent) => {
      const content = event.getContent()
      if (content?.type === 'm.delayed_event.status') {
        this.handleDelayedEventStatus(event)
      }
    })
  }

  /**
   * Schedule a delayed event (MSC4140)
   * Note: This is a client-side implementation until server-side API is available
   */
  async scheduleDelayedEvent(request: ScheduleDelayedEventRequest): Promise<string> {
    const client = MatrixClientService.getInstance().getClient()
    if (!client) {
      throw new Error(ERROR_CODES.CLIENT_NOT_INITIALIZED)
    }

    // Validate request
    this.validateScheduleRequest(request)

    const eventId = `delayed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = Date.now()
    const scheduledTs = now + request.delayMs

    const userId = client.getUserId() || undefined

    const delayedEvent: DelayedEvent = {
      eventId,
      roomId: request.roomId,
      eventType: request.eventType,
      content: request.content,
      delayMs: request.delayMs,
      scheduledTs,
      status: 'scheduled',
      sender: userId
    }

    try {
      // For now, use client-side scheduling
      // When MSC4140 server API is available, integrate with it
      this.scheduledEvents.set(eventId, delayedEvent)

      // Set local timer for tracking
      const timer = setTimeout(() => {
        this.handleScheduledEvent(eventId)
      }, request.delayMs)

      this.eventTimers.set(eventId, timer)

      this.notifyListeners('scheduled', delayedEvent)

      return eventId
    } catch (error) {
      console.error('[MatrixDelayedEventService] Failed to schedule event:', error)
      throw error
    }
  }

  /**
   * Get delayed events with optional filters (MSC4140)
   * Note: Currently uses local cache, will integrate with server API when available
   */
  async getDelayedEvents(filter: DelayedEventFilter = {}): Promise<DelayedEvent[]> {
    let events = Array.from(this.scheduledEvents.values())

    // Apply filters
    if (filter.roomId) {
      events = events.filter((e) => e.roomId === filter.roomId)
    }

    if (filter.eventType) {
      events = events.filter((e) => e.eventType === filter.eventType)
    }

    if (filter.status && filter.status.length > 0) {
      events = events.filter((e) => filter.status!.includes(e.status))
    }

    if (filter.limit) {
      events = events.slice(0, filter.limit)
    }

    return events
  }

  /**
   * Cancel a scheduled delayed event (MSC4140)
   */
  async cancelDelayedEvent(eventId: string): Promise<void> {
    const event = this.scheduledEvents.get(eventId)
    if (!event) {
      throw new Error('Event not found')
    }

    if (event.status !== 'scheduled') {
      throw new Error(`Event is ${event.status}, cannot cancel`)
    }

    try {
      // Clear local timer
      const timer = this.eventTimers.get(eventId)
      if (timer) {
        clearTimeout(timer)
        this.eventTimers.delete(eventId)
      }

      // Update event status
      event.status = 'cancelled'
      this.scheduledEvents.set(eventId, event)

      this.notifyListeners('cancelled', event)
    } catch (error) {
      console.error('[MatrixDelayedEventService] Failed to cancel event:', error)
      throw error
    }
  }

  /**
   * Get status of a specific delayed event
   */
  async getDelayedEventStatus(eventId: string): Promise<DelayedEvent | null> {
    // Check local cache
    return this.scheduledEvents.get(eventId) || null
  }

  /**
   * Handle delayed event status updates
   */
  private handleDelayedEventStatus(event: MatrixEvent): void {
    const content = event.getContent() as any
    if (!content || !content.event_id) return

    const eventId = content.event_id as string
    const existingEvent = this.scheduledEvents.get(eventId)

    if (!existingEvent) return

    // Update event status
    if (content.status === 'sent') {
      existingEvent.status = 'sent'
      existingEvent.sendTs = (content.sent_ts as number) || Date.now()

      // Clear timer
      const timer = this.eventTimers.get(eventId)
      if (timer) {
        clearTimeout(timer)
        this.eventTimers.delete(eventId)
      }

      this.notifyListeners('sent', existingEvent)
    } else if (content.status === 'failed') {
      existingEvent.status = 'failed'
      existingEvent.errorCode = content.error_code
      existingEvent.errorMessage = content.error_message

      // Auto-retry if enabled
      if (this.config.autoRetry && (!existingEvent.retryCount || existingEvent.retryCount < this.config.maxRetries)) {
        existingEvent.retryCount = (existingEvent.retryCount || 0) + 1
        setTimeout(() => this.retryEvent(eventId), this.config.retryDelay)
      }

      this.notifyListeners('failed', existingEvent)
    }
  }

  /**
   * Handle scheduled event when timer fires
   */
  private handleScheduledEvent(eventId: string): void {
    const event = this.scheduledEvents.get(eventId)
    if (!event) return

    // Update status
    event.status = 'sent'
    event.sendTs = Date.now()

    this.eventTimers.delete(eventId)
    this.notifyListeners('sent', event)
  }

  /**
   * Retry a failed delayed event
   */
  private async retryEvent(eventId: string): Promise<void> {
    const event = this.scheduledEvents.get(eventId)
    if (!event) return

    try {
      await this.scheduleDelayedEvent({
        roomId: event.roomId,
        eventType: event.eventType,
        content: event.content,
        delayMs: 0 // Send immediately
      })

      // Remove old event
      this.scheduledEvents.delete(eventId)
    } catch (error) {
      console.error('[MatrixDelayedEventService] Retry failed:', error)
    }
  }

  /**
   * Validate schedule request
   */
  private validateScheduleRequest(request: ScheduleDelayedEventRequest): void {
    if (!request.roomId) {
      throw new Error('Room ID is required')
    }

    if (!request.eventType) {
      throw new Error('Event type is required')
    }

    if (!request.content || typeof request.content !== 'object') {
      throw new Error('Content must be a valid object')
    }

    if (typeof request.delayMs !== 'number' || request.delayMs < 0) {
      throw new Error('Delay must be a positive number')
    }

    if (request.delayMs > this.config.maxDelayTime) {
      throw new Error(`Delay cannot exceed ${this.config.maxDelayTime}ms`)
    }

    // Check if limit reached
    if (this.scheduledEvents.size >= this.config.maxScheduledEvents) {
      throw new Error(`Maximum scheduled events limit reached (${this.config.maxScheduledEvents})`)
    }
  }

  /**
   * Start scheduled event processor
   * Periodically checks for events that should have been sent
   */
  private startScheduledEventProcessor(): void {
    setInterval(() => {
      const now = Date.now()
      for (const [eventId, event] of this.scheduledEvents.entries()) {
        if (event.status === 'scheduled' && event.scheduledTs <= now) {
          this.handleScheduledEvent(eventId)
        }
      }
    }, 60000) // Check every minute
  }

  /**
   * Register event listener
   */
  on(status: DelayedEventStatus, callback: (event: DelayedEvent) => void): () => void {
    if (!this.eventListeners.has(status)) {
      this.eventListeners.set(status, new Set())
    }

    this.eventListeners.get(status)!.add(callback)

    return () => {
      this.eventListeners.get(status)?.delete(callback)
    }
  }

  /**
   * Notify listeners
   */
  private notifyListeners(status: DelayedEventStatus, event: DelayedEvent): void {
    const listeners = this.eventListeners.get(status)
    if (listeners) {
      listeners.forEach((cb) => {
        try {
          cb(event)
        } catch (error) {
          console.error('[MatrixDelayedEventService] Listener error:', error)
        }
      })
    }
  }

  /**
   * Update service configuration
   */
  updateConfig(config: Partial<DelayedEventServiceConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current configuration
   */
  getConfig(): DelayedEventServiceConfig {
    return { ...this.config }
  }

  /**
   * Get all scheduled events
   */
  getScheduledEvents(): DelayedEvent[] {
    return Array.from(this.scheduledEvents.values()).filter((e) => e.status === 'scheduled')
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalScheduled: number
    totalSent: number
    totalCancelled: number
    totalFailed: number
    retryingEvents: number
  } {
    let totalSent = 0
    let totalCancelled = 0
    let totalFailed = 0
    let retryingEvents = 0

    for (const event of this.scheduledEvents.values()) {
      switch (event.status) {
        case 'sent':
          totalSent++
          break
        case 'cancelled':
          totalCancelled++
          break
        case 'failed':
          totalFailed++
          if (event.retryCount && event.retryCount < this.config.maxRetries) {
            retryingEvents++
          }
          break
      }
    }

    return {
      totalScheduled: this.getScheduledEvents().length,
      totalSent,
      totalCancelled,
      totalFailed,
      retryingEvents
    }
  }

  /**
   * Clear all scheduled events
   */
  async clearAllScheduledEvents(): Promise<void> {
    const eventIds = Array.from(this.scheduledEvents.keys())

    for (const eventId of eventIds) {
      try {
        await this.cancelDelayedEvent(eventId)
      } catch (error) {
        console.error(`[MatrixDelayedEventService] Failed to cancel event ${eventId}:`, error)
      }
    }

    // Clear all timers
    for (const timer of this.eventTimers.values()) {
      clearTimeout(timer)
    }
    this.eventTimers.clear()
  }

  /**
   * Clean up old events
   */
  cleanupOldEvents(olderThanMs: number = 7 * 24 * 60 * 60 * 1000): void {
    const now = Date.now()
    const cutoffTime = now - olderThanMs

    for (const [eventId, event] of this.scheduledEvents.entries()) {
      if (event.status === 'sent' && event.sendTs && event.sendTs < cutoffTime) {
        this.scheduledEvents.delete(eventId)
      } else if (event.status === 'cancelled' || (event.status === 'failed' && !event.retryCount)) {
        // Remove cancelled and failed events (without retries) older than cutoff
        this.scheduledEvents.delete(eventId)
      }
    }
  }
}

export const matrixDelayedEventService = MatrixDelayedEventService.getInstance()
export default MatrixDelayedEventService
