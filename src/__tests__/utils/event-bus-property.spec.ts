/**
 * Property-Based Tests for Event Bus
 * Tests for once listener, event history, and namespace isolation
 *
 * **Feature: sdk-backend-integration**
 * **Property 16: Event Bus Once Listener**
 * **Property 17: Event History Recording**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'

import { TypedEventBus } from '@/utils/EventBus'

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

interface TestEvents extends Record<string, unknown> {
  test: string
  number: number
  object: { value: number }
}

describe('Event Bus Property-Based Tests', () => {
  let bus: TypedEventBus<TestEvents>

  beforeEach(() => {
    vi.clearAllMocks()
    bus = new TypedEventBus<TestEvents>({ enableLogger: false })
  })

  afterEach(() => {
    bus.clear()
  })

  /**
   * Property 16: Event Bus Once Listener
   *
   * *For any* event registered with `once()`, the listener should be called
   * exactly once and then automatically removed.
   *
   * **Validates: Requirements 15.4**
   */
  describe('Property 16: Event Bus Once Listener', () => {
    it('should call once listener exactly once per event', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), fc.array(fc.anything()), async (eventName, payloads) => {
          const bus = new TypedEventBus<Record<string, unknown>>({ enableLogger: false })
          let callCount = 0

          bus.once(eventName, () => {
            callCount++
            return
          })

          // Emit event multiple times
          for (const payload of payloads) {
            await bus.emit(eventName, payload)
          }

          // Property: Listener should be called exactly once
          // (only if there was at least one emission)
          const expectedCalls = payloads.length > 0 ? 1 : 0
          expect(callCount).toBe(expectedCalls)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should remove once listener after first call', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), async (eventName) => {
          const bus = new TypedEventBus<Record<string, unknown>>({ enableLogger: false })
          let callCount = 0

          bus.once(eventName, () => {
            callCount++
            return
          })

          // First emit - should trigger
          await bus.emit(eventName, {})

          // Check listener count after first emit
          const countAfterFirst = bus.listenerCount(eventName as string)

          // Second emit - should not trigger (listener removed)
          await bus.emit(eventName, {})

          // Check listener count after second emit
          const countAfterSecond = bus.listenerCount(eventName as string)

          // Property: Listener should be removed after first call
          expect(countAfterFirst).toBe(0)
          expect(countAfterSecond).toBe(0)
          expect(callCount).toBe(1)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should handle multiple once listeners independently', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), fc.integer({ min: 1, max: 10 }), async (eventName, emitCount) => {
          const bus = new TypedEventBus<Record<string, unknown>>({ enableLogger: false })
          const calls: number[] = []

          // Add multiple once listeners
          bus.once(eventName, () => {
            calls.push(1)
            return
          })
          bus.once(eventName, () => {
            calls.push(2)
            return
          })
          bus.once(eventName, () => {
            calls.push(3)
            return
          })

          // Emit multiple times
          for (let i = 0; i < emitCount; i++) {
            await bus.emit(eventName, {})
          }

          // Property: Each once listener should be called exactly once
          expect(calls).toEqual([1, 2, 3])
          expect(calls.length).toBe(3)

          // All listeners should be removed
          expect(bus.listenerCount(String(eventName))).toBe(0)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should mix once and regular listeners correctly', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), fc.integer({ min: 1, max: 5 }), async (eventName, emitCount) => {
          const bus = new TypedEventBus<Record<string, unknown>>({ enableLogger: false })
          let onceCallCount = 0
          let regularCallCount = 0

          // Add once listener
          bus.once(eventName, () => {
            onceCallCount++
            return
          })

          // Add regular listener
          bus.on(eventName, () => {
            regularCallCount++
            return
          })

          // Emit multiple times
          for (let i = 0; i < emitCount; i++) {
            await bus.emit(eventName, {})
          }

          // Property: Once listener called once, regular listener called every time
          expect(onceCallCount).toBe(1)
          expect(regularCallCount).toBe(emitCount)

          // Only regular listener should remain
          expect(bus.listenerCount(eventName as string)).toBe(1)

          return true
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 17: Event History Recording
   *
   * *For any* event emitted on an event bus, the event should be recorded
   * in the event history with timestamp and payload.
   *
   * **Validates: Requirements 15.2**
   */
  describe('Property 17: Event History Recording', () => {
    it('should record all emitted events in history', async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(fc.tuple(fc.string(), fc.anything())), async (events) => {
          const bus = new TypedEventBus<Record<string, unknown>>({ enableLogger: false })

          // Emit all events
          for (const [eventName, payload] of events) {
            await bus.emit(eventName, payload)
          }

          // Get history
          const history = bus.getEventHistory()

          // Property: History should contain all emitted events
          expect(history.length).toBe(events.length)

          // Verify each event in history
          for (let i = 0; i < events.length; i++) {
            const [expectedName, expectedPayload] = events[i]!
            const historyEntry = history[i]!

            expect(historyEntry.event).toBe(expectedName)
            expect(historyEntry.data).toEqual(expectedPayload)
            expect(historyEntry.timestamp).toBeGreaterThan(0)
            expect(typeof historyEntry.timestamp).toBe('number')
          }

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should include timestamp in history entries', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), fc.anything(), async (eventName, payload) => {
          const bus = new TypedEventBus<Record<string, unknown>>({ enableLogger: false })

          const beforeTime = Date.now()
          await bus.emit(eventName, payload)
          const afterTime = Date.now()

          const history = bus.getEventHistory()
          expect(history.length).toBe(1)

          const entry = history[0]!

          // Property: Timestamp should be reasonable
          expect(entry.timestamp).toBeGreaterThanOrEqual(beforeTime)
          expect(entry.timestamp).toBeLessThanOrEqual(afterTime)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should preserve event order in history', async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(fc.integer({ min: 1, max: 100 })), async (numbers) => {
          const bus = new TypedEventBus<Record<string, unknown>>({ enableLogger: false })

          // Emit events in specific order
          for (const num of numbers) {
            await bus.emit('test', num)
          }

          const history = bus.getEventHistory()

          // Property: Events should be in the same order as emitted
          for (let i = 0; i < numbers.length; i++) {
            expect(history[i]?.data).toBe(numbers[i])
          }

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should limit history size to maxHistorySize', async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(fc.string(), { minLength: 0, maxLength: 200 }), async (events) => {
          const bus = new TypedEventBus<Record<string, unknown>>({ enableLogger: false })

          // Emit all events
          for (const eventName of events) {
            await bus.emit(eventName, {})
          }

          const history = bus.getEventHistory()

          // Property: History should be limited to maxHistorySize (100)
          expect(history.length).toBeLessThanOrEqual(100)

          // If more than 100 events, only last 100 should be kept
          if (events.length > 100) {
            expect(history.length).toBe(100)
            // Should contain the last 100 events
            expect(history[0]?.event).toBe(events[events.length - 100]!)
          } else {
            expect(history.length).toBe(events.length)
          }

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should support history limit parameter', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string(), { minLength: 5, maxLength: 50 }),
          fc.integer({ min: 1, max: 20 }),
          async (events, limit) => {
            const bus = new TypedEventBus<Record<string, unknown>>({ enableLogger: false })

            // Emit all events
            for (const eventName of events) {
              await bus.emit(eventName, {})
            }

            // Get limited history
            const limitedHistory = bus.getEventHistory(limit)
            const fullHistory = bus.getEventHistory()

            // Property: Limited history should respect the limit
            expect(limitedHistory.length).toBe(Math.min(limit, fullHistory.length))

            // Limited history should contain the most recent events
            if (fullHistory.length > limit) {
              const expectedLastEvent = fullHistory[fullHistory.length - limit]?.event
              expect(limitedHistory[0]?.event).toBe(expectedLastEvent)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return frozen history array', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), fc.anything(), async (eventName, payload) => {
          const bus = new TypedEventBus<Record<string, unknown>>({ enableLogger: false })

          await bus.emit(eventName, payload)

          const history = bus.getEventHistory()

          // Property: History should be frozen (immutable)
          expect(Object.isFrozen(history)).toBe(true)

          // Attempting to modify should fail or not affect original
          try {
            // @ts-expect-error - Testing immutability
            history[0] = { event: 'modified', data: 'modified', timestamp: 0 }
            // If we can set it, verify it doesn't affect the bus's internal state
            const newHistory = bus.getEventHistory()
            expect(newHistory[0]?.event).toBe(eventName)
          } catch {
            // Setting property on frozen array throws
            expect(true).toBe(true)
          }

          return true
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Additional property tests for namespace isolation
   */
  describe('Namespace Isolation', () => {
    it('should isolate events between different buses', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), fc.string(), async (eventName1, _eventName2) => {
          const bus1 = new TypedEventBus<Record<string, unknown>>({ namespace: 'bus1', enableLogger: false })
          const bus2 = new TypedEventBus<Record<string, unknown>>({ namespace: 'bus2', enableLogger: false })

          let bus1Calls = 0
          let bus2Calls = 0

          bus1.on(eventName1, () => {
            bus1Calls++
            return
          })
          bus2.on(eventName1, () => {
            bus2Calls++
            return
          })

          // Emit on bus1 only
          await bus1.emit(eventName1, {})

          // Property: Only bus1 should receive the event
          expect(bus1Calls).toBe(1)
          expect(bus2Calls).toBe(0)

          return true
        }),
        { numRuns: 100 }
      )
    })
  })
})
