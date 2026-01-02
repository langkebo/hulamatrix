/**
 * MessageSyncService Unit Tests and Property-Based Tests
 * Tests for message status management, deduplication, and retry mechanism
 *
 * **Feature: sdk-integration-audit, Property 7: Message Status Progression**
 * **Feature: sdk-integration-audit, Property 8: Message Deduplication**
 * **Validates: Requirements 5.3, 5.4, 5.5**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import { MessageSyncService, MESSAGE_STATUS_TRANSITIONS } from '@/services/messageSyncService'

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

describe('MessageSyncService', () => {
  let service: MessageSyncService

  beforeEach(() => {
    // Create a fresh instance for each test
    service = new MessageSyncService({
      maxRetries: 3,
      retryDelayMs: 100, // Short delay for tests
      deduplicationWindowMs: 1000,
      maxProcessedEventIds: 100
    })
  })

  afterEach(() => {
    service.cleanup()
    vi.clearAllTimers()
  })

  // ==================== 5.1 消息状态管理测试 ====================
  describe('Message Status Management (5.1)', () => {
    describe('Status Transitions', () => {
      it('should allow valid status transitions', () => {
        // pending -> sent
        expect(service.isValidStatusTransition(MessageStatusEnum.PENDING, MessageStatusEnum.SENT)).toBe(true)
        // pending -> failed
        expect(service.isValidStatusTransition(MessageStatusEnum.PENDING, MessageStatusEnum.FAILED)).toBe(true)
        // sent -> delivered
        expect(service.isValidStatusTransition(MessageStatusEnum.SENT, MessageStatusEnum.DELIVERED)).toBe(true)
        // delivered -> read
        expect(service.isValidStatusTransition(MessageStatusEnum.DELIVERED, MessageStatusEnum.READ)).toBe(true)
        // failed -> pending (for retry)
        expect(service.isValidStatusTransition(MessageStatusEnum.FAILED, MessageStatusEnum.PENDING)).toBe(true)
      })

      it('should reject invalid status transitions', () => {
        // read -> pending (cannot go back)
        expect(service.isValidStatusTransition(MessageStatusEnum.READ, MessageStatusEnum.PENDING)).toBe(false)
        // delivered -> pending (cannot go back)
        expect(service.isValidStatusTransition(MessageStatusEnum.DELIVERED, MessageStatusEnum.PENDING)).toBe(false)
        // read -> sent (cannot go back)
        expect(service.isValidStatusTransition(MessageStatusEnum.READ, MessageStatusEnum.SENT)).toBe(false)
      })

      it('should not allow transitions from READ status', () => {
        const allowedFromRead = MESSAGE_STATUS_TRANSITIONS[MessageStatusEnum.READ]
        expect(allowedFromRead).toEqual([])
      })
    })

    describe('setMessagePending', () => {
      it('should set message status to pending', () => {
        const msgId = 'msg-1'
        service.setMessagePending(msgId)
        expect(service.getMessageStatus(msgId)).toBe(MessageStatusEnum.PENDING)
      })
    })

    describe('updateMessageStatus', () => {
      it('should update status for new message', () => {
        const msgId = 'msg-1'
        const result = service.updateMessageStatus(msgId, MessageStatusEnum.SENT)
        expect(result).toBe(true)
        expect(service.getMessageStatus(msgId)).toBe(MessageStatusEnum.SENT)
      })

      it('should update status with valid transition', () => {
        const msgId = 'msg-1'
        service.setMessagePending(msgId)

        const result = service.updateMessageStatus(msgId, MessageStatusEnum.SENT)
        expect(result).toBe(true)
        expect(service.getMessageStatus(msgId)).toBe(MessageStatusEnum.SENT)
      })

      it('should reject invalid status transition', () => {
        const msgId = 'msg-1'
        service.updateMessageStatus(msgId, MessageStatusEnum.READ)

        // Try to go back to pending
        const result = service.updateMessageStatus(msgId, MessageStatusEnum.PENDING)
        expect(result).toBe(false)
        expect(service.getMessageStatus(msgId)).toBe(MessageStatusEnum.READ)
      })
    })

    describe('Status helper methods', () => {
      it('markAsSent should update status to SENT', () => {
        const msgId = 'msg-1'
        service.setMessagePending(msgId)

        const result = service.markAsSent(msgId)
        expect(result).toBe(true)
        expect(service.getMessageStatus(msgId)).toBe(MessageStatusEnum.SENT)
      })

      it('markAsDelivered should update status to DELIVERED', () => {
        const msgId = 'msg-1'
        service.updateMessageStatus(msgId, MessageStatusEnum.SENT)

        const result = service.markAsDelivered(msgId)
        expect(result).toBe(true)
        expect(service.getMessageStatus(msgId)).toBe(MessageStatusEnum.DELIVERED)
      })

      it('markAsRead should update status to READ', () => {
        const msgId = 'msg-1'
        service.updateMessageStatus(msgId, MessageStatusEnum.DELIVERED)

        const result = service.markAsRead(msgId)
        expect(result).toBe(true)
        expect(service.getMessageStatus(msgId)).toBe(MessageStatusEnum.READ)
      })

      it('markAsFailed should update status to FAILED', () => {
        const msgId = 'msg-1'
        service.setMessagePending(msgId)

        const result = service.markAsFailed(msgId, 'Network error')
        expect(result).toBe(true)
        expect(service.getMessageStatus(msgId)).toBe(MessageStatusEnum.FAILED)
      })
    })

    describe('Status change callbacks', () => {
      it('should notify callbacks on status change', () => {
        const callback = vi.fn()
        service.onStatusChange(callback)

        const msgId = 'msg-1'
        service.setMessagePending(msgId)
        service.markAsSent(msgId)

        expect(callback).toHaveBeenCalledWith(msgId, MessageStatusEnum.PENDING, MessageStatusEnum.SENT)
      })

      it('should remove callback with offStatusChange', () => {
        const callback = vi.fn()
        service.onStatusChange(callback)
        service.offStatusChange(callback)

        const msgId = 'msg-1'
        service.setMessagePending(msgId)
        service.markAsSent(msgId)

        // Callback should not be called after removal
        expect(callback).not.toHaveBeenCalled()
      })
    })
  })

  // ==================== 5.2 消息去重测试 ====================
  describe('Message Deduplication (5.2)', () => {
    describe('isEventProcessed', () => {
      it('should return false for new event', () => {
        expect(service.isEventProcessed('event-1')).toBe(false)
      })

      it('should return true for processed event', () => {
        service.markEventProcessed('event-1')
        expect(service.isEventProcessed('event-1')).toBe(true)
      })
    })

    describe('markEventProcessed', () => {
      it('should return true for new event', () => {
        const result = service.markEventProcessed('event-1')
        expect(result).toBe(true)
      })

      it('should return false for duplicate event', () => {
        service.markEventProcessed('event-1')
        const result = service.markEventProcessed('event-1')
        expect(result).toBe(false)
      })
    })

    describe('shouldProcessMessage', () => {
      it('should return true for new message', () => {
        expect(service.shouldProcessMessage('event-1')).toBe(true)
      })

      it('should return false for duplicate message', () => {
        service.shouldProcessMessage('event-1')
        expect(service.shouldProcessMessage('event-1')).toBe(false)
      })

      it('should handle multiple unique events', () => {
        expect(service.shouldProcessMessage('event-1')).toBe(true)
        expect(service.shouldProcessMessage('event-2')).toBe(true)
        expect(service.shouldProcessMessage('event-3')).toBe(true)
        expect(service.getProcessedEventCount()).toBe(3)
      })
    })

    describe('clearProcessedEvents', () => {
      it('should clear all processed events', () => {
        service.markEventProcessed('event-1')
        service.markEventProcessed('event-2')
        expect(service.getProcessedEventCount()).toBe(2)

        service.clearProcessedEvents()
        expect(service.getProcessedEventCount()).toBe(0)

        // Should be able to process same events again
        expect(service.shouldProcessMessage('event-1')).toBe(true)
      })
    })
  })

  // ==================== 5.3 消息重试机制测试 ====================
  describe('Message Retry Mechanism (5.3)', () => {
    describe('addToRetryQueue', () => {
      it('should add message to retry queue', () => {
        const message = {
          id: 'msg-1',
          roomId: 'room-1',
          type: MsgEnum.TEXT,
          body: { text: 'Hello' },
          sendTime: Date.now(),
          messageMarks: {},
          status: MessageStatusEnum.FAILED
        }

        service.addToRetryQueue(message, 'Network error')

        expect(service.isInRetryQueue('msg-1')).toBe(true)
        expect(service.getRetryQueueSize()).toBe(1)
      })

      it('should mark message as failed when added to queue', () => {
        const message = {
          id: 'msg-1',
          roomId: 'room-1',
          type: MsgEnum.TEXT,
          body: { text: 'Hello' },
          sendTime: Date.now(),
          messageMarks: {},
          status: MessageStatusEnum.PENDING
        }

        service.setMessagePending('msg-1')
        service.addToRetryQueue(message, 'Network error')

        expect(service.getMessageStatus('msg-1')).toBe(MessageStatusEnum.FAILED)
      })
    })

    describe('getRetryInfo', () => {
      it('should return retry info for queued message', () => {
        const message = {
          id: 'msg-1',
          roomId: 'room-1',
          type: MsgEnum.TEXT,
          body: { text: 'Hello' },
          sendTime: Date.now(),
          messageMarks: {},
          status: MessageStatusEnum.FAILED
        }

        service.addToRetryQueue(message, 'Network error')

        const info = service.getRetryInfo('msg-1')
        expect(info).toBeDefined()
        expect(info?.id).toBe('msg-1')
        expect(info?.roomId).toBe('room-1')
        expect(info?.retryCount).toBe(0)
        expect(info?.error).toBe('Network error')
      })

      it('should return undefined for non-queued message', () => {
        expect(service.getRetryInfo('non-existent')).toBeUndefined()
      })
    })

    describe('removeFromRetryQueue', () => {
      it('should remove message from retry queue', () => {
        const message = {
          id: 'msg-1',
          roomId: 'room-1',
          type: MsgEnum.TEXT,
          body: { text: 'Hello' },
          sendTime: Date.now(),
          messageMarks: {},
          status: MessageStatusEnum.FAILED
        }

        service.addToRetryQueue(message, 'Network error')
        expect(service.isInRetryQueue('msg-1')).toBe(true)

        service.removeFromRetryQueue('msg-1')
        expect(service.isInRetryQueue('msg-1')).toBe(false)
      })
    })

    describe('getRetryQueue', () => {
      it('should return all messages in retry queue', () => {
        const message1 = {
          id: 'msg-1',
          roomId: 'room-1',
          type: MsgEnum.TEXT,
          body: { text: 'Hello 1' },
          sendTime: Date.now(),
          messageMarks: {},
          status: MessageStatusEnum.FAILED
        }

        const message2 = {
          id: 'msg-2',
          roomId: 'room-1',
          type: MsgEnum.TEXT,
          body: { text: 'Hello 2' },
          sendTime: Date.now(),
          messageMarks: {},
          status: MessageStatusEnum.FAILED
        }

        service.addToRetryQueue(message1, 'Error 1')
        service.addToRetryQueue(message2, 'Error 2')

        const queue = service.getRetryQueue()
        expect(queue.length).toBe(2)
        expect(queue.map((m) => m.id)).toContain('msg-1')
        expect(queue.map((m) => m.id)).toContain('msg-2')
      })
    })

    describe('clearRetryQueue', () => {
      it('should clear all messages from retry queue', () => {
        const message = {
          id: 'msg-1',
          roomId: 'room-1',
          type: MsgEnum.TEXT,
          body: { text: 'Hello' },
          sendTime: Date.now(),
          messageMarks: {},
          status: MessageStatusEnum.FAILED
        }

        service.addToRetryQueue(message, 'Network error')
        expect(service.getRetryQueueSize()).toBe(1)

        service.clearRetryQueue()
        expect(service.getRetryQueueSize()).toBe(0)
      })
    })

    describe('retryMessage', () => {
      it('should execute retry callback when retrying', async () => {
        const retryCallback = vi.fn().mockResolvedValue(true)
        service.setRetryCallback(retryCallback)

        const message = {
          id: 'msg-1',
          roomId: 'room-1',
          type: MsgEnum.TEXT,
          body: { text: 'Hello' },
          sendTime: Date.now(),
          messageMarks: {},
          status: MessageStatusEnum.FAILED
        }

        service.addToRetryQueue(message, 'Network error')

        const result = await service.retryMessage('msg-1')

        expect(retryCallback).toHaveBeenCalled()
        expect(result).toBe(true)
        expect(service.isInRetryQueue('msg-1')).toBe(false)
      })

      it('should return false for non-queued message', async () => {
        const result = await service.retryMessage('non-existent')
        expect(result).toBe(false)
      })

      it('should keep message in queue if retry fails', async () => {
        const retryCallback = vi.fn().mockResolvedValue(false)
        service.setRetryCallback(retryCallback)

        const message = {
          id: 'msg-1',
          roomId: 'room-1',
          type: MsgEnum.TEXT,
          body: { text: 'Hello' },
          sendTime: Date.now(),
          messageMarks: {},
          status: MessageStatusEnum.FAILED
        }

        service.addToRetryQueue(message, 'Network error')

        await service.retryMessage('msg-1')

        // Message should still be in queue after failed retry
        expect(service.isInRetryQueue('msg-1')).toBe(true)
      })
    })
  })

  // ==================== 统计和清理测试 ====================
  describe('Stats and Cleanup', () => {
    describe('getStats', () => {
      it('should return correct statistics', () => {
        // Add some processed events
        service.markEventProcessed('event-1')
        service.markEventProcessed('event-2')

        // Add a message to retry queue
        const message = {
          id: 'msg-1',
          roomId: 'room-1',
          type: MsgEnum.TEXT,
          body: { text: 'Hello' },
          sendTime: Date.now(),
          messageMarks: {},
          status: MessageStatusEnum.FAILED
        }
        service.addToRetryQueue(message, 'Error')

        // Set some message statuses
        service.setMessagePending('msg-2')
        service.setMessagePending('msg-3')

        const stats = service.getStats()
        expect(stats.processedEventCount).toBe(2)
        expect(stats.retryQueueSize).toBe(1)
        expect(stats.statusCacheSize).toBeGreaterThanOrEqual(2)
      })
    })

    describe('cleanup', () => {
      it('should clear all state', () => {
        // Add some data
        service.markEventProcessed('event-1')
        service.setMessagePending('msg-1')

        const message = {
          id: 'msg-2',
          roomId: 'room-1',
          type: MsgEnum.TEXT,
          body: { text: 'Hello' },
          sendTime: Date.now(),
          messageMarks: {},
          status: MessageStatusEnum.FAILED
        }
        service.addToRetryQueue(message, 'Error')

        // Cleanup
        service.cleanup()

        const stats = service.getStats()
        expect(stats.processedEventCount).toBe(0)
        expect(stats.retryQueueSize).toBe(0)
        expect(stats.statusCacheSize).toBe(0)
      })
    })
  })
})

// ==================== Property-Based Tests ====================

/**
 * Property-Based Tests for MessageSyncService
 *
 * **Feature: sdk-integration-audit, Property 7: Message Status Progression**
 * **Feature: sdk-integration-audit, Property 8: Message Deduplication**
 * **Validates: Requirements 5.3, 5.4, 5.5**
 */
describe('MessageSyncService Property-Based Tests', () => {
  let service: MessageSyncService

  beforeEach(() => {
    service = new MessageSyncService({
      maxRetries: 3,
      retryDelayMs: 100,
      deduplicationWindowMs: 1000,
      maxProcessedEventIds: 100
    })
  })

  afterEach(() => {
    service.cleanup()
  })

  /**
   * Property-Based Test: Message Status Progression
   * **Feature: sdk-integration-audit, Property 7: Message Status Progression**
   * **Validates: Requirements 5.3, 5.4**
   *
   * *For any* message sent through the Message_Sync service, the status SHALL
   * progress through pending → sent → delivered → read (or pending → failed on error).
   */
  describe('Property 7: Message Status Progression', () => {
    // Define valid status progression paths
    const validProgressionPaths = [
      // Happy path: pending -> sent -> delivered -> read
      [MessageStatusEnum.PENDING, MessageStatusEnum.SENT, MessageStatusEnum.DELIVERED, MessageStatusEnum.READ],
      // Alternative: pending -> sending -> sent -> delivered -> read
      [
        MessageStatusEnum.PENDING,
        MessageStatusEnum.SENDING,
        MessageStatusEnum.SENT,
        MessageStatusEnum.DELIVERED,
        MessageStatusEnum.READ
      ],
      // Error path: pending -> failed
      [MessageStatusEnum.PENDING, MessageStatusEnum.FAILED],
      // Error path: pending -> sending -> failed
      [MessageStatusEnum.PENDING, MessageStatusEnum.SENDING, MessageStatusEnum.FAILED],
      // Error path: pending -> sent -> failed
      [MessageStatusEnum.PENDING, MessageStatusEnum.SENT, MessageStatusEnum.FAILED],
      // Retry path: failed -> pending
      [MessageStatusEnum.FAILED, MessageStatusEnum.PENDING],
      // Retry path: failed -> sending
      [MessageStatusEnum.FAILED, MessageStatusEnum.SENDING],
      // Skip delivered: sent -> read
      [MessageStatusEnum.SENT, MessageStatusEnum.READ]
    ]

    it('should only allow valid status transitions for any message', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // Random message ID
          fc.constantFrom(...Object.values(MessageStatusEnum)), // Current status
          fc.constantFrom(...Object.values(MessageStatusEnum)), // Target status
          async (msgId, currentStatus, targetStatus) => {
            // Clean up before each iteration to ensure isolation
            service.cleanup()
            service = new MessageSyncService({
              maxRetries: 3,
              retryDelayMs: 100,
              deduplicationWindowMs: 1000,
              maxProcessedEventIds: 100
            })

            // Set initial status
            service.updateMessageStatus(msgId, currentStatus)

            // Attempt transition
            const result = service.updateMessageStatus(msgId, targetStatus)

            // Get allowed transitions for current status
            const allowedTransitions = MESSAGE_STATUS_TRANSITIONS[currentStatus] || []

            // Property: Transition succeeds IFF target is in allowed transitions
            if (allowedTransitions.includes(targetStatus)) {
              expect(result).toBe(true)
              expect(service.getMessageStatus(msgId)).toBe(targetStatus)
            } else {
              expect(result).toBe(false)
              expect(service.getMessageStatus(msgId)).toBe(currentStatus)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should progress through valid paths without skipping required states', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // Random message ID
          fc.constantFrom(...validProgressionPaths), // Valid progression path
          async (msgId, path) => {
            // Start fresh
            service.cleanup()
            service = new MessageSyncService({
              maxRetries: 3,
              retryDelayMs: 100,
              deduplicationWindowMs: 1000,
              maxProcessedEventIds: 100
            })

            // Apply each status in the path
            for (let i = 0; i < path.length; i++) {
              const status = path[i]
              const result = service.updateMessageStatus(msgId, status)

              // Property: Each transition in a valid path MUST succeed
              expect(result).toBe(true)
              expect(service.getMessageStatus(msgId)).toBe(status)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should not allow backward transitions from terminal states', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // Random message ID
          fc.constantFrom(
            MessageStatusEnum.PENDING,
            MessageStatusEnum.SENDING,
            MessageStatusEnum.SENT,
            MessageStatusEnum.DELIVERED,
            MessageStatusEnum.FAILED
          ), // Non-terminal states to try transitioning to
          async (msgId, targetStatus) => {
            // Clean up before each iteration to ensure isolation
            service.cleanup()
            service = new MessageSyncService({
              maxRetries: 3,
              retryDelayMs: 100,
              deduplicationWindowMs: 1000,
              maxProcessedEventIds: 100
            })

            // Set message to READ (terminal state)
            service.updateMessageStatus(msgId, MessageStatusEnum.READ)

            // Attempt to transition to any other status
            const result = service.updateMessageStatus(msgId, targetStatus)

            // Property: READ is terminal - no transitions allowed
            expect(result).toBe(false)
            expect(service.getMessageStatus(msgId)).toBe(MessageStatusEnum.READ)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should allow retry from FAILED state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // Random message ID
          async (msgId) => {
            // Clean up before each iteration to ensure isolation
            service.cleanup()
            service = new MessageSyncService({
              maxRetries: 3,
              retryDelayMs: 100,
              deduplicationWindowMs: 1000,
              maxProcessedEventIds: 100
            })

            // Set message to FAILED
            service.setMessagePending(msgId)
            service.markAsFailed(msgId)
            expect(service.getMessageStatus(msgId)).toBe(MessageStatusEnum.FAILED)

            // Property: FAILED messages can transition to PENDING for retry
            const result = service.updateMessageStatus(msgId, MessageStatusEnum.PENDING)
            expect(result).toBe(true)
            expect(service.getMessageStatus(msgId)).toBe(MessageStatusEnum.PENDING)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should notify callbacks on every valid status change', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // Random message ID
          async (msgId) => {
            // Clean up before each iteration to ensure isolation
            service.cleanup()
            service = new MessageSyncService({
              maxRetries: 3,
              retryDelayMs: 100,
              deduplicationWindowMs: 1000,
              maxProcessedEventIds: 100
            })

            const statusChanges: Array<{ msgId: string; oldStatus: MessageStatusEnum; newStatus: MessageStatusEnum }> =
              []
            const callback = (id: string, oldStatus: MessageStatusEnum, newStatus: MessageStatusEnum) => {
              statusChanges.push({ msgId: id, oldStatus, newStatus })
            }

            service.onStatusChange(callback)

            // Progress through a valid path
            service.setMessagePending(msgId)
            service.markAsSent(msgId)
            service.markAsDelivered(msgId)
            service.markAsRead(msgId)

            // Property: Callback should be called for each transition
            expect(statusChanges.length).toBe(3) // sent, delivered, read (pending doesn't trigger callback)
            expect(statusChanges[0].newStatus).toBe(MessageStatusEnum.SENT)
            expect(statusChanges[1].newStatus).toBe(MessageStatusEnum.DELIVERED)
            expect(statusChanges[2].newStatus).toBe(MessageStatusEnum.READ)

            service.offStatusChange(callback)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property-Based Test: Message Deduplication
   * **Feature: sdk-integration-audit, Property 8: Message Deduplication**
   * **Validates: Requirements 5.5**
   *
   * *For any* message event received multiple times (same event_id),
   * the Message_Sync SHALL only add it to the message list once.
   */
  describe('Property 8: Message Deduplication', () => {
    it('should return false for duplicate event IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // Random event ID
          fc.integer({ min: 2, max: 10 }), // Number of times to process same event
          async (eventId, repeatCount) => {
            // Clean up before each iteration to ensure isolation
            service.clearProcessedEvents()

            // First processing should succeed
            const firstResult = service.shouldProcessMessage(eventId)
            expect(firstResult).toBe(true)

            // All subsequent processings should fail (duplicate)
            for (let i = 1; i < repeatCount; i++) {
              const result = service.shouldProcessMessage(eventId)
              // Property: Duplicate events MUST return false
              expect(result).toBe(false)
            }

            // Property: Event count should be 1 regardless of repeat attempts
            expect(service.isEventProcessed(eventId)).toBe(true)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should correctly track unique event IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 50 }), // Array of event IDs (may have duplicates)
          async (eventIds) => {
            // Clean up before each iteration to ensure isolation
            service.clearProcessedEvents()

            // Process all events
            const results = eventIds.map((id) => service.shouldProcessMessage(id))

            // Calculate expected unique count
            const uniqueIds = new Set(eventIds)
            const expectedUniqueCount = uniqueIds.size

            // Property: Processed event count MUST equal unique event count
            expect(service.getProcessedEventCount()).toBe(expectedUniqueCount)

            // Property: First occurrence of each ID should return true
            const firstOccurrences = new Map<string, number>()
            eventIds.forEach((id, index) => {
              if (!firstOccurrences.has(id)) {
                firstOccurrences.set(id, index)
              }
            })

            results.forEach((result, index) => {
              const eventId = eventIds[index]
              const isFirstOccurrence = firstOccurrences.get(eventId) === index
              if (isFirstOccurrence) {
                expect(result).toBe(true)
              } else {
                expect(result).toBe(false)
              }
            })

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain deduplication after clearing and re-adding', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }), // Array of unique event IDs
          async (eventIds) => {
            // Process all events
            eventIds.forEach((id) => service.markEventProcessed(id))
            const _countBefore = service.getProcessedEventCount()

            // Clear all events
            service.clearProcessedEvents()
            expect(service.getProcessedEventCount()).toBe(0)

            // Re-process same events - all should succeed now
            const results = eventIds.map((id) => service.shouldProcessMessage(id))

            // Property: After clearing, all events should be processable again
            const uniqueIds = new Set(eventIds)
            results.forEach((result, index) => {
              const eventId = eventIds[index]
              // Only first occurrence should succeed
              const firstIndex = eventIds.indexOf(eventId)
              if (firstIndex === index) {
                expect(result).toBe(true)
              }
            })

            // Property: Count should match unique IDs
            expect(service.getProcessedEventCount()).toBe(uniqueIds.size)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle concurrent-like event processing correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // Single event ID
          fc.integer({ min: 5, max: 20 }), // Number of "concurrent" attempts
          async (eventId, attemptCount) => {
            // Clean up before each iteration to ensure isolation
            service.clearProcessedEvents()

            // Simulate concurrent processing attempts
            const results: boolean[] = []
            for (let i = 0; i < attemptCount; i++) {
              results.push(service.shouldProcessMessage(eventId))
            }

            // Property: Exactly ONE attempt should succeed
            const successCount = results.filter((r) => r === true).length
            expect(successCount).toBe(1)

            // Property: First attempt should be the successful one
            expect(results[0]).toBe(true)

            // Property: All subsequent attempts should fail
            for (let i = 1; i < results.length; i++) {
              expect(results[i]).toBe(false)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve deduplication state across multiple operations', async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(fc.uuid(), { minLength: 5, maxLength: 30 }), async (eventIds) => {
          // Clean up before each iteration to ensure isolation
          service.clearProcessedEvents()

          const uniqueIds = new Set(eventIds)

          // Process events in batches
          const batchSize = Math.ceil(eventIds.length / 3)
          for (let i = 0; i < eventIds.length; i += batchSize) {
            const batch = eventIds.slice(i, i + batchSize)
            batch.forEach((id) => service.markEventProcessed(id))
          }

          // Property: All unique events should be marked as processed
          for (const id of uniqueIds) {
            expect(service.isEventProcessed(id)).toBe(true)
          }

          // Property: Total count should equal unique count
          expect(service.getProcessedEventCount()).toBe(uniqueIds.size)

          return true
        }),
        { numRuns: 100 }
      )
    })
  })
})
