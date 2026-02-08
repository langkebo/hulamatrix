/*
 * Matrix Safety Error Handling Service
 *
 * Implements MSC4387: M_SAFETY error handling
 * Provides safety violation detection and user notifications
 */

import { type MatrixEvent } from '@/lib/matrix-sdk'
import MatrixClientService from './MatrixClientService'

// M_SAFETY error types (MSC4387)
export enum SafetyErrorType {
  MALICIOUS_CONTENT = 'm.safety.malicious_content',
  SPAM = 'm.safety.spam',
  INAPPROPRIATE_CONTENT = 'm.safety.inappropriate_content',
  PHISHING = 'm.safety.phishing',
  MALWARE = 'm.safety.malware',
  SCAM = 'm.safety.scam',
  VIOLENCE = 'm.safety.violence',
  SELF_HARM = 'm.safety.self_harm',
  OTHER = 'm.safety.other'
}

// M_SAFETY error severity
export enum SafetyErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// M_SAFETY error content (MSC4387)
export interface SafetyErrorContent {
  type: SafetyErrorType
  severity: SafetyErrorSeverity
  message: string
  details?: string
  affected_user_ids?: string[]
  affected_room_ids?: string[]
  recommended_actions?: RecommendedAction[]
  detection_method?: string
  confidence?: number
}

export interface RecommendedAction {
  action: string
  label: string
  required: boolean
  url?: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
}

// Safety error event
export interface SafetyErrorEvent {
  eventId: string
  roomId: string
  sender: string
  timestamp: number
  content: SafetyErrorContent
  handled: boolean
  actionTaken?: string
}

interface SafetyServiceConfig {
  enabled: boolean
  autoBlockHighSeverity: boolean
  showNotifications: boolean
  logErrors: boolean
  forwardToAdmin: boolean
  allowedSeverity: SafetyErrorSeverity[]
}

class MatrixSafetyService {
  private static instance: MatrixSafetyService | null = null
  private config: SafetyServiceConfig = {
    enabled: true,
    autoBlockHighSeverity: true,
    showNotifications: true,
    logErrors: true,
    forwardToAdmin: true,
    allowedSeverity: [SafetyErrorSeverity.LOW, SafetyErrorSeverity.MEDIUM]
  }

  private safetyErrors: Map<string, SafetyErrorEvent> = new Map()
  private blockedContent: Set<string> = new Set()
  private errorListeners: Set<(error: SafetyErrorEvent) => void> = new Set()

  private constructor() {
    this.initializeEventListeners()
  }

  static getInstance(): MatrixSafetyService {
    if (!MatrixSafetyService.instance) {
      MatrixSafetyService.instance = new MatrixSafetyService()
    }
    return MatrixSafetyService.instance
  }

  private initializeEventListeners(): void {
    const client = MatrixClientService.getInstance().getClient()
    if (!client) return

    // Listen for M_SAFETY error events (MSC4387)
    client.on('Event.decrypted' as any, (event: MatrixEvent) => {
      const eventType = event.getType()
      if (eventType === 'm.safety.error') {
        this.handleSafetyError(event)
      }
    })

    // Listen for safety error toasts/notifications
    client.on('RoomState.events' as any, (event: MatrixEvent) => {
      const eventType = event.getType()
      if (eventType === 'm.room.safety_settings') {
        this.handleSafetySettingsUpdate(event)
      }
    })
  }

  /**
   * Handle M_SAFETY error events (MSC4387)
   */
  private handleSafetyError(event: MatrixEvent): void {
    if (!this.config.enabled) return

    const content = event.getContent() as any
    if (!content || !content.type) return

    const safetyError: SafetyErrorEvent = {
      eventId: event.getId() || `safety_${Date.now()}`,
      roomId: event.getRoomId() || '',
      sender: event.getSender() || '',
      timestamp: event.getTs() || Date.now(),
      content: content as SafetyErrorContent,
      handled: false
    }

    // Store error
    this.safetyErrors.set(safetyError.eventId, safetyError)

    // Log error
    if (this.config.logErrors) {
      this.logSafetyError(safetyError)
    }

    // Auto-block high severity content
    if (this.shouldAutoBlock(safetyError)) {
      this.blockContent(safetyError)
      safetyError.actionTaken = 'auto_blocked'
      safetyError.handled = true
    }

    // Show notification
    if (this.config.showNotifications) {
      this.showSafetyNotification(safetyError)
    }

    // Forward to admin if configured
    if (this.config.forwardToAdmin && safetyError.content.severity === SafetyErrorSeverity.CRITICAL) {
      this.forwardToAdmin(safetyError)
    }

    // Notify listeners
    this.notifyErrorListeners(safetyError)
  }

  /**
   * Handle safety settings updates
   */
  private handleSafetySettingsUpdate(event: MatrixEvent): void {
    const content = event.getContent() as any
    if (!content) return

    // Update service config based on room settings
    if (content.enabled !== undefined) {
      this.config.enabled = !!content.enabled
    }

    if (content.severity_filter) {
      this.config.allowedSeverity = content.severity_filter as SafetyErrorSeverity[]
    }
  }

  /**
   * Check if content should be auto-blocked
   */
  private shouldAutoBlock(error: SafetyErrorEvent): boolean {
    if (!this.config.autoBlockHighSeverity) return false

    const severity = error.content.severity
    return severity === SafetyErrorSeverity.HIGH || severity === SafetyErrorSeverity.CRITICAL
  }

  /**
   * Block content based on safety error
   */
  private blockContent(error: SafetyErrorEvent): void {
    const eventId = error.eventId

    // Add to blocked content list
    this.blockedContent.add(eventId)

    // Also block affected content if available
    if (error.content.affected_user_ids) {
      // Block messages from affected users
      console.warn(`[MatrixSafetyService] Blocked content from users:`, error.content.affected_user_ids)
    }

    if (error.content.affected_room_ids) {
      // Block content from affected rooms
      console.warn(`[MatrixSafetyService] Blocked content from rooms:`, error.content.affected_room_ids)
    }
  }

  /**
   * Check if content is blocked
   */
  isContentBlocked(eventId: string): boolean {
    return this.blockedContent.has(eventId)
  }

  /**
   * Log safety error
   */
  private logSafetyError(error: SafetyErrorEvent): void {
    const logEntry = {
      timestamp: new Date(error.timestamp).toISOString(),
      type: error.content.type,
      severity: error.content.severity,
      roomId: error.roomId,
      sender: error.sender,
      message: error.content.message,
      details: error.content.details
    }

    console.warn('[MatrixSafetyService] Safety error detected:', logEntry)
  }

  /**
   * Show safety notification to user
   */
  private showSafetyNotification(error: SafetyErrorEvent): void {
    const notification = {
      type: 'safety',
      severity: error.content.severity,
      title: this.getSafetyErrorTitle(error.content.type),
      message: error.content.message,
      details: error.content.details,
      actions: error.content.recommended_actions || [],
      eventId: error.eventId
    }

    // Emit notification event
    if (typeof window !== 'undefined' && (window as any).emitNotification) {
      ;(window as any).emitNotification(notification)
    }

    console.log('[MatrixSafetyService] Safety notification:', notification)
  }

  /**
   * Get human-readable title for safety error type
   */
  private getSafetyErrorTitle(type: SafetyErrorType): string {
    const titles: Record<SafetyErrorType, string> = {
      [SafetyErrorType.MALICIOUS_CONTENT]: '恶意内容警告',
      [SafetyErrorType.SPAM]: '垃圾信息警告',
      [SafetyErrorType.INAPPROPRIATE_CONTENT]: '不当内容警告',
      [SafetyErrorType.PHISHING]: '钓鱼网站警告',
      [SafetyErrorType.MALWARE]: '恶意软件警告',
      [SafetyErrorType.SCAM]: '诈骗警告',
      [SafetyErrorType.VIOLENCE]: '暴力内容警告',
      [SafetyErrorType.SELF_HARM]: '自残内容警告',
      [SafetyErrorType.OTHER]: '安全警告'
    }

    return titles[type] || '安全警告'
  }

  /**
   * Forward critical safety errors to admin
   */
  private async forwardToAdmin(error: SafetyErrorEvent): Promise<void> {
    try {
      // Implementation would depend on admin API
      console.warn('[MatrixSafetyService] Forwarding critical safety error to admin:', error.eventId)
      // TODO: Implement admin API call
    } catch (err) {
      console.error('[MatrixSafetyService] Failed to forward to admin:', err)
    }
  }

  /**
   * Manually report safety violation
   */
  async reportSafetyViolation(
    roomId: string,
    _eventId: string,
    type: SafetyErrorType,
    details?: string
  ): Promise<void> {
    const client = MatrixClientService.getInstance().getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const content: SafetyErrorContent = {
      type,
      severity: SafetyErrorSeverity.MEDIUM,
      message: `User reported safety violation: ${type}`,
      details,
      affected_room_ids: [roomId]
    }

    try {
      // Send M_SAFETY error event (MSC4387)
      await client.sendEvent(roomId, 'm.safety.error' as any, content)

      console.log('[MatrixSafetyService] Safety violation reported successfully')
    } catch (error) {
      console.error('[MatrixSafetyService] Failed to report safety violation:', error)
      throw error
    }
  }

  /**
   * Handle recommended action from safety error
   */
  async executeRecommendedAction(errorId: string, action: RecommendedAction): Promise<void> {
    const error = this.safetyErrors.get(errorId)
    if (!error) {
      throw new Error('Safety error not found')
    }

    try {
      // Mark action as taken
      error.actionTaken = action.action
      error.handled = true

      console.log('[MatrixSafetyService] Recommended action executed:', action.action)
    } catch (err) {
      console.error('[MatrixSafetyService] Failed to execute recommended action:', err)
      throw err
    }
  }

  /**
   * Dismiss safety error
   */
  dismissSafetyError(errorId: string): void {
    const error = this.safetyErrors.get(errorId)
    if (error) {
      error.handled = true
      error.actionTaken = 'dismissed'
    }
  }

  /**
   * Register error listener
   */
  onError(callback: (error: SafetyErrorEvent) => void): () => void {
    this.errorListeners.add(callback)
    return () => this.errorListeners.delete(callback)
  }

  /**
   * Notify all error listeners
   */
  private notifyErrorListeners(error: SafetyErrorEvent): void {
    this.errorListeners.forEach((cb) => {
      try {
        cb(error)
      } catch (err) {
        console.error('[MatrixSafetyService] Error listener callback failed:', err)
      }
    })
  }

  /**
   * Get all safety errors
   */
  getSafetyErrors(): SafetyErrorEvent[] {
    return Array.from(this.safetyErrors.values())
  }

  /**
   * Get safety errors for a room
   */
  getSafetyErrorsForRoom(roomId: string): SafetyErrorEvent[] {
    return this.getSafetyErrors().filter((e) => e.roomId === roomId)
  }

  /**
   * Get unhandled safety errors
   */
  getUnhandledSafetyErrors(): SafetyErrorEvent[] {
    return this.getSafetyErrors().filter((e) => !e.handled)
  }

  /**
   * Update service configuration
   */
  updateConfig(config: Partial<SafetyServiceConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current configuration
   */
  getConfig(): SafetyServiceConfig {
    return { ...this.config }
  }

  /**
   * Clear old safety errors
   */
  clearOldErrors(olderThanMs: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now()
    const cutoffTime = now - olderThanMs

    for (const [errorId, error] of this.safetyErrors.entries()) {
      if (error.timestamp < cutoffTime && error.handled) {
        this.safetyErrors.delete(errorId)
        this.blockedContent.delete(errorId)
      }
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalErrors: number
    handledErrors: number
    unhandledErrors: number
    blockedContent: number
    errorsByType: Record<string, number>
    errorsBySeverity: Record<string, number>
  } {
    const errors = this.getSafetyErrors()
    const errorsByType: Record<string, number> = {}
    const errorsBySeverity: Record<string, number> = {}

    for (const error of errors) {
      errorsByType[error.content.type] = (errorsByType[error.content.type] || 0) + 1
      errorsBySeverity[error.content.severity] = (errorsBySeverity[error.content.severity] || 0) + 1
    }

    return {
      totalErrors: errors.length,
      handledErrors: errors.filter((e) => e.handled).length,
      unhandledErrors: errors.filter((e) => !e.handled).length,
      blockedContent: this.blockedContent.size,
      errorsByType,
      errorsBySeverity
    }
  }

  /**
   * Unblock content
   */
  unblockContent(eventId: string): void {
    this.blockedContent.delete(eventId)
  }

  /**
   * Clear all blocked content
   */
  clearBlockedContent(): void {
    this.blockedContent.clear()
  }

  /**
   * Get blocked content list
   */
  getBlockedContent(): string[] {
    return Array.from(this.blockedContent)
  }
}

export const matrixSafetyService = MatrixSafetyService.getInstance()
export default MatrixSafetyService
