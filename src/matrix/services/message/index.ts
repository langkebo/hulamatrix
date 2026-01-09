/**
 * Matrix Message Services Module
 *
 * Message handling and event processing
 */

export * from './decrypt'
export * from './event-handler'
export * from './sync'

// Re-export core message utilities
export * from '@/matrix/core/messages'
export * from '@/matrix/core/threads'
export * from '@/matrix/core/typing'
export * from '@/matrix/core/reactions'
export * from '@/matrix/core/receipts'
export * from '@/matrix/core/history'
