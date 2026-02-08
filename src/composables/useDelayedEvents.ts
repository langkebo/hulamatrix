/*
 * Vue Composable for Delayed Events Service
 *
 * Provides reactive access to delayed event functionality
 */

import { ref, computed, onUnmounted } from 'vue'
import { matrixDelayedEventService } from '@/services/matrix'
import type {
  DelayedEvent,
  DelayedEventStatus,
  DelayedEventFilter,
  ScheduleDelayedEventRequest
} from '@/services/matrix'

export function useDelayedEvents() {
  const scheduledEvents = ref<DelayedEvent[]>([])
  const eventStatus = ref<'idle' | 'scheduling' | 'loading'>('idle')
  const error = ref<Error | null>(null)

  // Subscribe to event status changes
  const unsubscribeScheduled = matrixDelayedEventService.on('scheduled', (_event) => {
    refreshEvents()
  })

  const unsubscribeSent = matrixDelayedEventService.on('sent', (_event) => {
    refreshEvents()
  })

  const unsubscribeCancelled = matrixDelayedEventService.on('cancelled', (_event) => {
    refreshEvents()
  })

  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribeScheduled()
    unsubscribeSent()
    unsubscribeCancelled()
  })

  // Computed properties
  const hasScheduledEvents = computed(() => scheduledEvents.value.length > 0)
  const scheduledCount = computed(() => scheduledEvents.value.filter((e) => e.status === 'scheduled').length)
  const sentCount = computed(() => scheduledEvents.value.filter((e) => e.status === 'sent').length)
  const failedCount = computed(() => scheduledEvents.value.filter((e) => e.status === 'failed').length)

  // Methods
  const refreshEvents = async (filter?: DelayedEventFilter) => {
    try {
      eventStatus.value = 'loading'
      error.value = null

      const events = await matrixDelayedEventService.getDelayedEvents(filter)
      scheduledEvents.value = events

      eventStatus.value = 'idle'
    } catch (err) {
      error.value = err as Error
      eventStatus.value = 'idle'
    }
  }

  const scheduleEvent = async (request: ScheduleDelayedEventRequest) => {
    try {
      eventStatus.value = 'scheduling'
      error.value = null

      const eventId = await matrixDelayedEventService.scheduleDelayedEvent(request)

      await refreshEvents()
      eventStatus.value = 'idle'

      return eventId
    } catch (err) {
      error.value = err as Error
      eventStatus.value = 'idle'
      throw err
    }
  }

  const cancelEvent = async (eventId: string) => {
    try {
      await matrixDelayedEventService.cancelDelayedEvent(eventId)
      await refreshEvents()
    } catch (err) {
      error.value = err as Error
      throw err
    }
  }

  const getEventStatus = async (eventId: string) => {
    try {
      return await matrixDelayedEventService.getDelayedEventStatus(eventId)
    } catch (err) {
      error.value = err as Error
      return null
    }
  }

  const getRoomEvents = (roomId: string) => {
    return scheduledEvents.value.filter((e) => e.roomId === roomId)
  }

  const getEventsByStatus = (status: DelayedEventStatus) => {
    return scheduledEvents.value.filter((e) => e.status === status)
  }

  const getStats = () => {
    return matrixDelayedEventService.getStats()
  }

  const clearOldEvents = (olderThanMs?: number) => {
    // Service-level cleanup
    const service = matrixDelayedEventService as any
    if (service.cleanupOldEvents) {
      service.cleanupOldEvents(olderThanMs)
    }
    refreshEvents()
  }

  // Initialize with current events
  refreshEvents()

  return {
    // State
    scheduledEvents,
    eventStatus,
    error,

    // Computed
    hasScheduledEvents,
    scheduledCount,
    sentCount,
    failedCount,

    // Methods
    refreshEvents,
    scheduleEvent,
    cancelEvent,
    getEventStatus,
    getRoomEvents,
    getEventsByStatus,
    getStats,
    clearOldEvents
  }
}
