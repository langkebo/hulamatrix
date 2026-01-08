/**
 * Events Manager - Event handling and dispatching for Matrix calls
 * Manages event listeners and forwards events to group calls
 */

import { logger } from '@/utils/logger'
import type { EventListener } from './types'

/**
 * Events Manager
 */
export class EventsManager {
  private eventListeners = new Map<string, EventListener[]>()

  /**
   * Add event listener
   */
  on(event: string, listener: EventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)?.push(listener)
    logger.debug('[EventsManager] Listener added', { event })
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: EventListener): void {
    const listeners = this.eventListeners.get(event)
    if (!listeners) {
      return
    }

    const index = listeners.indexOf(listener)
    if (index > -1) {
      listeners.splice(index, 1)
      logger.debug('[EventsManager] Listener removed', { event })
    }

    // Clean up empty listener arrays
    if (listeners.length === 0) {
      this.eventListeners.delete(event)
    }
  }

  /**
   * Dispatch event to all listeners
   */
  dispatchEvent(event: string, detail: unknown): void {
    const listeners = this.eventListeners.get(event)
    if (!listeners || listeners.length === 0) {
      return
    }

    logger.debug('[EventsManager] Dispatching event', { event, listenerCount: listeners.length })

    for (const listener of listeners) {
      try {
        listener(detail)
      } catch (error) {
        logger.error('[EventsManager] Listener error:', { event, error })
      }
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event: string): void {
    this.eventListeners.delete(event)
    logger.debug('[EventsManager] All listeners removed', { event })
  }

  /**
   * Remove all listeners
   */
  clear(): void {
    this.eventListeners.clear()
    logger.debug('[EventsManager] All listeners cleared')
  }

  /**
   * Get listener count for an event
   */
  getListenerCount(event: string): number {
    return this.eventListeners.get(event)?.length || 0
  }
}
