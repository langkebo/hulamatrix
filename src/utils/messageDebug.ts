/**
 * Message Debug Utility
 * Provides detailed logging for message reception and processing flow
 */

import { logger } from '@/utils/logger'

export class MessageDebugger {
  private static enabled = import.meta.env.MODE === 'development'
  private static messageFlowMap = new Map<string, string[]>()

  /**
   * Log general debug message
   */
  static log(message: string, data?: unknown) {
    if (!MessageDebugger.enabled) return
    logger.debug(`[MessageDebug] ${message}`, data ?? '')
  }

  /**
   * Trace message flow through the system
   * @param messageId Unique message identifier
   * @param step Current step in the flow
   * @param data Optional data to log
   */
  static traceMessageFlow(messageId: string, step: string, data?: unknown) {
    if (!MessageDebugger.enabled) return

    // Track flow for this message
    if (!MessageDebugger.messageFlowMap.has(messageId)) {
      MessageDebugger.messageFlowMap.set(messageId, [])
    }
    MessageDebugger.messageFlowMap.get(messageId)!.push(step)

    const flow = MessageDebugger.messageFlowMap.get(messageId)!.join(' → ')
    logger.debug(`[MessageFlow] ${messageId}: ${flow}`, data ?? '')

    // Clean up old entries (prevent memory leak)
    if (MessageDebugger.messageFlowMap.size > 1000) {
      const firstKey = MessageDebugger.messageFlowMap.keys().next().value
      if (firstKey) {
        MessageDebugger.messageFlowMap.delete(firstKey)
      }
    }
  }

  /**
   * Log error in message processing
   */
  static error(message: string, error: unknown) {
    logger.error(`[MessageError] ${message}`, error)
  }

  /**
   * Log warning
   */
  static warn(message: string, data?: unknown) {
    logger.warn(`[MessageWarn] ${message}`, data ?? '')
  }

  /**
   * Get message flow history
   */
  static getMessageFlow(messageId: string): string[] | undefined {
    return MessageDebugger.messageFlowMap.get(messageId)
  }

  /**
   * Clear message flow history
   */
  static clearFlowHistory() {
    MessageDebugger.messageFlowMap.clear()
  }

  /**
   * Enable/disable debug logging
   */
  static setEnabled(enabled: boolean) {
    MessageDebugger.enabled = enabled
  }

  /**
   * Check if debug logging is enabled
   */
  static isEnabled(): boolean {
    return MessageDebugger.enabled
  }
}

// Export shortcut functions for convenience
export const debugLog = (message: string, data?: unknown) => MessageDebugger.log(message, data)
export const traceMessage = (messageId: string, step: string, data?: unknown) =>
  MessageDebugger.traceMessageFlow(messageId, step, data)
export const debugError = (message: string, error: unknown) => MessageDebugger.error(message, error)
export const debugWarn = (message: string, data?: unknown) => MessageDebugger.warn(message, data)
