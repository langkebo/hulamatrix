/**
 * Call History Store
 * Manages call history and recordings
 */

import { defineStore } from 'pinia'
import { logger } from '@/utils/logger'
import callRecordingStorage, { type CallRecording } from '@/utils/callRecordingStorage'

export interface CallHistoryEntry {
  /** Unique call ID */
  id: string
  /** Room ID */
  roomId: string
  /** Room name */
  roomName?: string
  /** Call type */
  callType: 'voice' | 'video' | 'group_voice' | 'group_video'
  /** Call start time */
  startTime: number
  /** Call end time */
  endTime: number
  /** Call duration in seconds */
  duration: number
  /** Was the call answered */
  answered: boolean
  /** Participant user IDs */
  participants: string[]
  /** Recording ID (if exists) */
  recordingId?: string
  /** Call direction */
  direction: 'incoming' | 'outgoing' | 'internal'
  /** Call ended reason */
  endReason?: 'ended' | 'failed' | 'declined' | 'busy'
}

export interface CallAnalytics {
  /** Total calls count */
  totalCalls: number
  /** Total call duration in seconds */
  totalDuration: number
  /** Average call duration in seconds */
  averageDuration: number
  /** Calls by type */
  byType: Record<string, number>
  /** Calls by room */
  byRoom: Record<string, number>
  /** Answered calls count */
  answeredCalls: number
  /** Missed calls count */
  missedCalls: number
  /** Answer rate percentage */
  answerRate: number
  /** Call history by day */
  byDay: Record<string, number>
}

interface CallHistoryState {
  /** All call history entries */
  calls: CallHistoryEntry[]
  /** Selected call ID */
  selectedCallId: string | null
  /** Loading state */
  loading: boolean
  /** Error message */
  error: string | null
}

export const useCallHistoryStore = defineStore('callHistory', {
  state: (): CallHistoryState => ({
    calls: [],
    selectedCallId: null,
    loading: false,
    error: null
  }),

  getters: {
    /**
     * Get all calls sorted by date (newest first)
     */
    sortedCalls: (state): CallHistoryEntry[] => {
      return [...state.calls].sort((a, b) => b.startTime - a.startTime)
    },

    /**
     * Get selected call
     */
    selectedCall: (state): CallHistoryEntry | undefined => {
      return state.calls.find((c) => c.id === state.selectedCallId)
    },

    /**
     * Get missed calls
     */
    missedCalls: (state): CallHistoryEntry[] => {
      return state.calls.filter((c) => !c.answered && c.direction === 'incoming')
    },

    /**
     * Get calls by room
     */
    callsByRoom:
      (state) =>
      (roomId: string): CallHistoryEntry[] => {
        return state.calls.filter((c) => c.roomId === roomId)
      },

    /**
     * Get calls analytics
     */
    analytics(): CallAnalytics {
      const totalCalls = this.calls.length
      const totalDuration = this.calls.reduce((sum, call) => sum + call.duration, 0)
      const averageDuration = totalCalls > 0 ? totalDuration / totalCalls : 0
      const answeredCalls = this.calls.filter((c) => c.answered).length
      const missedCalls = totalCalls - answeredCalls
      const answerRate = totalCalls > 0 ? (answeredCalls / totalCalls) * 100 : 0

      const byType: Record<string, number> = {}
      const byRoom: Record<string, number> = {}
      const byDay: Record<string, number> = {}

      for (const call of this.calls) {
        // Count by type
        byType[call.callType] = (byType[call.callType] || 0) + 1

        // Count by room
        byRoom[call.roomId] = (byRoom[call.roomId] || 0) + 1

        // Count by day
        const day = new Date(call.startTime).toISOString().split('T')[0]
        byDay[day] = (byDay[day] || 0) + 1
      }

      return {
        totalCalls,
        totalDuration,
        averageDuration,
        byType,
        byRoom,
        answeredCalls,
        missedCalls,
        answerRate,
        byDay
      }
    }
  },

  actions: {
    /**
     * Add a call to history
     */
    addCall(call: Omit<CallHistoryEntry, 'id'>): string {
      const id = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const newCall: CallHistoryEntry = { ...call, id }

      this.calls.push(newCall)
      logger.info('[CallHistory] Call added', { id, roomId: call.roomId })

      return id
    },

    /**
     * Update call with recording
     */
    async updateCallWithRecording(callId: string, blob: Blob, mimeType: string): Promise<void> {
      const call = this.calls.find((c) => c.id === callId)
      if (!call) {
        throw new Error('Call not found')
      }

      try {
        // Save recording
        const recording = await callRecordingStorage.saveRecording({
          roomId: call.roomId,
          roomName: call.roomName,
          callType: call.callType,
          startTime: call.startTime,
          endTime: call.endTime,
          duration: call.duration,
          blobUrl: URL.createObjectURL(blob),
          size: blob.size,
          mimeType,
          participants: call.participants,
          encrypted: false
        })

        // Update call with recording ID
        call.recordingId = recording.id

        logger.info('[CallHistory] Recording saved for call', { callId, recordingId: recording.id })
      } catch (error) {
        logger.error('[CallHistory] Failed to save recording:', error)
        throw error
      }
    },

    /**
     * Get recording for a call
     */
    getCallRecording(callId: string): CallRecording | undefined {
      const call = this.calls.find((c) => c.id === callId)
      if (!call?.recordingId) {
        return undefined
      }

      return callRecordingStorage.getRecording(call.recordingId)
    },

    /**
     * Select a call
     */
    selectCall(callId: string | null): void {
      this.selectedCallId = callId
      logger.debug('[CallHistory] Call selected', { callId })
    },

    /**
     * Delete a call
     */
    async deleteCall(callId: string): Promise<void> {
      const callIndex = this.calls.findIndex((c) => c.id === callId)
      if (callIndex === -1) {
        throw new Error('Call not found')
      }

      const call = this.calls[callIndex]

      // Delete recording if exists
      if (call.recordingId) {
        await callRecordingStorage.deleteRecording(call.recordingId)
      }

      // Remove call
      this.calls.splice(callIndex, 1)

      if (this.selectedCallId === callId) {
        this.selectedCallId = null
      }

      logger.info('[CallHistory] Call deleted', { callId })
    },

    /**
     * Delete all calls
     */
    async deleteAllCalls(): Promise<void> {
      // Delete all recordings
      const recordingIds = this.calls.map((c) => c.recordingId).filter((id): id is string => id !== undefined)

      for (const recordingId of recordingIds) {
        await callRecordingStorage.deleteRecording(recordingId)
      }

      // Clear calls
      this.calls = []
      this.selectedCallId = null

      logger.info('[CallHistory] All calls deleted')
    },

    /**
     * Search calls
     */
    searchCalls(query: string): CallHistoryEntry[] {
      const lowerQuery = query.toLowerCase()

      return this.calls.filter(
        (call) =>
          call.roomName?.toLowerCase().includes(lowerQuery) ||
          call.participants.some((p) => p.toLowerCase().includes(lowerQuery))
      )
    },

    /**
     * Get calls by date range
     */
    getCallsByDateRange(startDate: Date, endDate: Date): CallHistoryEntry[] {
      const start = startDate.getTime()
      const end = endDate.getTime()

      return this.calls.filter((call) => call.startTime >= start && call.startTime <= end)
    },

    /**
     * Clear all data
     */
    clear(): void {
      this.calls = []
      this.selectedCallId = null
      this.error = null

      logger.info('[CallHistory] Store cleared')
    }
  }
})
