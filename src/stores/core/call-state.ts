/**
 * Core Store - RTC Call State Management
 * Handles Matrix RTC call functionality
 */

import { ref, type Ref } from 'vue'
import { logger } from '@/utils/logger'
import type { CallState } from './types'

/**
 * RTC call state manager
 */
export class CallStateManager {
  /** Call state */
  callState: Ref<CallState>

  constructor() {
    this.callState = ref<CallState>({
      isInCall: false,
      isMuted: false,
      isVideoEnabled: false,
      isScreenSharing: false
    })
  }

  /**
   * Start a call
   */
  async startCall(roomId: string, type: 'audio' | 'video'): Promise<void> {
    try {
      // Update call state
      this.callState.value.isInCall = true
      this.callState.value.callType = type
      this.callState.value.roomId = roomId

      // Import Matrix Call Service
      const { matrixCallService } = await import('@/services/matrixCallService')

      // Start call via Matrix Call Service
      const call = await matrixCallService.startCall({
        roomId,
        type: type === 'audio' ? 'voice' : 'video',
        isInitiator: true
      })

      logger.info('[CallState] Matrix RTC call started', { roomId, type, callId: call.callId })
    } catch (error) {
      logger.error('[CallState] Failed to start Matrix RTC call:', error)

      // Reset call state
      this.callState.value.isInCall = false
      this.callState.value.roomId = undefined

      throw error
    }
  }

  /**
   * End current call
   */
  async endCall(): Promise<void> {
    try {
      if (this.callState.value.roomId) {
        // Import Matrix Call Service
        const { matrixCallService } = await import('@/services/matrixCallService')

        // Get active calls and end them
        const activeCalls = matrixCallService.getActiveCalls()
        for (const call of activeCalls) {
          await matrixCallService.endCall(call.callId)
        }

        logger.info('[CallState] Matrix RTC call ended', { roomId: this.callState.value.roomId })
      }

      // Reset call state
      this.resetCallState()
    } catch (error) {
      logger.error('[CallState] Failed to end Matrix RTC call:', error)

      // Reset state even on error
      this.resetCallState()
    }
  }

  /**
   * Toggle audio (mute/unmute)
   */
  async toggleAudio(): Promise<void> {
    this.callState.value.isMuted = !this.callState.value.isMuted

    // Sync state to call service if there's an active call
    if (this.callState.value.isInCall && this.callState.value.roomId) {
      try {
        const { matrixCallService } = await import('@/services/matrixCallService')
        await matrixCallService.setMuted(this.callState.value.roomId, this.callState.value.isMuted)
        logger.info('[CallState] Audio toggled', { muted: this.callState.value.isMuted })
      } catch (error) {
        logger.error('[CallState] Failed to toggle audio:', error)
      }
    }
  }

  /**
   * Toggle video (enable/disable camera)
   */
  async toggleVideo(): Promise<void> {
    this.callState.value.isVideoEnabled = !this.callState.value.isVideoEnabled

    // Sync state to call service if there's an active call
    if (this.callState.value.isInCall && this.callState.value.roomId) {
      try {
        const { matrixCallService } = await import('@/services/matrixCallService')
        await matrixCallService.setVideoEnabled(this.callState.value.roomId, this.callState.value.isVideoEnabled)
        logger.info('[CallState] Video toggled', { enabled: this.callState.value.isVideoEnabled })
      } catch (error) {
        logger.error('[CallState] Failed to toggle video:', error)
      }
    }
  }

  /**
   * Toggle screen sharing
   */
  async toggleScreenShare(): Promise<void> {
    this.callState.value.isScreenSharing = !this.callState.value.isScreenSharing

    // Screen share requires additional media stream handling
    if (this.callState.value.isInCall && this.callState.value.isScreenSharing) {
      try {
        // Get screen share stream
        await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        })

        logger.info('[CallState] Screen share started')
      } catch (error) {
        logger.error('[CallState] Failed to start screen share:', error)
        this.callState.value.isScreenSharing = false
        throw error
      }
    } else {
      logger.info('[CallState] Screen share stopped')
    }
  }

  /**
   * Reset call state to default
   */
  resetCallState(): void {
    this.callState.value = {
      isInCall: false,
      isMuted: false,
      isVideoEnabled: false,
      isScreenSharing: false,
      roomId: undefined
    }
  }

  /**
   * Check if currently in a call
   */
  isInCall(): boolean {
    return this.callState.value.isInCall
  }

  /**
   * Get current call state
   */
  getCallState(): CallState {
    return this.callState.value
  }
}
