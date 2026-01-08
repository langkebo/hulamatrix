/**
 * Media Controls - Audio/video control for Matrix calls
 * Handles microphone, camera, speaker, and screen share controls
 */

import { logger } from '@/utils/logger'
import type { MatrixCallManager } from './call-manager'

/**
 * Media Controls Manager
 */
export class MediaControlsManager {
  constructor(private callManager: MatrixCallManager) {}

  /**
   * Mute microphone
   */
  async muteMic(callId: string): Promise<void> {
    const call = this.callManager.getActiveCall(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    const streams = this.callManager.getMediaStreams()
    const stream = streams.localAudio

    if (!stream) {
      logger.warn('[MediaControls] No local audio stream')
      return
    }

    const audioTrack = stream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = false
      logger.debug('[MediaControls] Microphone muted', { callId })
    }
  }

  /**
   * Unmute microphone
   */
  async unmuteMic(callId: string): Promise<void> {
    const call = this.callManager.getActiveCall(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    const streams = this.callManager.getMediaStreams()
    const stream = streams.localAudio

    if (!stream) {
      logger.warn('[MediaControls] No local audio stream')
      return
    }

    const audioTrack = stream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = true
      logger.debug('[MediaControls] Microphone unmuted', { callId })
    }
  }

  /**
   * Toggle microphone
   */
  toggleAudio(callId: string): boolean {
    const streams = this.callManager.getMediaStreams()
    const stream = streams.localAudio

    if (!stream) {
      logger.warn('[MediaControls] No local audio stream')
      return false
    }

    const audioTrack = stream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      const call = this.callManager.getActiveCall(callId)
      if (call) {
        call.participants.forEach((p) => {
          if (p.userId === 'local') {
            p.muted = !audioTrack.enabled
          }
        })
      }
      logger.debug('[MediaControls] Audio toggled', { callId, enabled: audioTrack.enabled })
      return audioTrack.enabled
    }
    return false
  }

  /**
   * Set muted state
   */
  async setMuted(callId: string, muted: boolean): Promise<void> {
    if (muted) {
      await this.muteMic(callId)
    } else {
      await this.unmuteMic(callId)
    }
  }

  /**
   * Enable camera
   */
  async enableCamera(callId: string): Promise<void> {
    const call = this.callManager.getActiveCall(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    const streams = this.callManager.getMediaStreams()
    const stream = streams.localVideo

    if (!stream) {
      logger.warn('[MediaControls] No local video stream')
      return
    }

    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = true
      logger.debug('[MediaControls] Camera enabled', { callId })
    }
  }

  /**
   * Disable camera
   */
  async disableCamera(callId: string): Promise<void> {
    const call = this.callManager.getActiveCall(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    const streams = this.callManager.getMediaStreams()
    const stream = streams.localVideo

    if (!stream) {
      logger.warn('[MediaControls] No local video stream')
      return
    }

    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = false
      logger.debug('[MediaControls] Camera disabled', { callId })
    }
  }

  /**
   * Enable speaker (unmute remote audio)
   */
  async enableSpeaker(callId: string): Promise<void> {
    const call = this.callManager.getActiveCall(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    const streams = this.callManager.getMediaStreams()
    const stream = streams.remoteAudio

    if (!stream) {
      logger.warn('[MediaControls] No remote audio stream')
      return
    }

    const audioTrack = stream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = true
      logger.debug('[MediaControls] Speaker enabled', { callId })
    }
  }

  /**
   * Disable speaker (mute remote audio)
   */
  async disableSpeaker(callId: string): Promise<void> {
    const call = this.callManager.getActiveCall(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    const streams = this.callManager.getMediaStreams()
    const stream = streams.remoteAudio

    if (!stream) {
      logger.warn('[MediaControls] No remote audio stream')
      return
    }

    const audioTrack = stream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = false
      logger.debug('[MediaControls] Speaker disabled', { callId })
    }
  }

  /**
   * Toggle video
   */
  toggleVideo(callId: string): boolean {
    const streams = this.callManager.getMediaStreams()
    const stream = streams.localVideo

    if (!stream) {
      logger.warn('[MediaControls] No local video stream')
      return false
    }

    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      const call = this.callManager.getActiveCall(callId)
      if (call) {
        call.participants.forEach((p) => {
          if (p.userId === 'local') {
            p.videoEnabled = !videoTrack.enabled
          }
        })
      }
      logger.debug('[MediaControls] Video toggled', { callId, enabled: videoTrack.enabled })
      return videoTrack.enabled
    }
    return false
  }

  /**
   * Set video enabled state
   */
  async setVideoEnabled(callId: string, enabled: boolean): Promise<void> {
    const call = this.callManager.getActiveCall(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    const streams = this.callManager.getMediaStreams()
    const stream = streams.localVideo

    if (!stream) {
      logger.warn('[MediaControls] No local video stream')
      return
    }

    const videoTrack = stream.getVideoTracks()[0]
    if (!videoTrack) {
      logger.warn('[MediaControls] No video track found')
      return
    }

    videoTrack.enabled = enabled

    // Update participant info
    call.participants.forEach((p) => {
      if (p.userId === 'local') {
        p.videoEnabled = enabled
      }
    })

    logger.debug('[MediaControls] Video enabled state set', { callId, enabled })
  }

  /**
   * Start screen share
   */
  async startScreenShare(callId: string): Promise<void> {
    const call = this.callManager.getActiveCall(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true
      })

      const streams = this.callManager.getMediaStreams()
      streams.screenShare = stream

      // Add screen share track to peer connection
      // Note: This would need access to the peer connection from call manager
      // For now, just store the stream

      call.isScreenSharing = true
      logger.info('[MediaControls] Screen share started', { callId })
    } catch (error) {
      logger.error('[MediaControls] Failed to start screen share:', error)
      throw error
    }
  }

  /**
   * Stop screen share
   */
  stopScreenShare(callId: string): void {
    const call = this.callManager.getActiveCall(callId)
    if (!call) {
      return
    }

    const streams = this.callManager.getMediaStreams()
    const stream = streams.screenShare

    if (!stream) {
      logger.warn('[MediaControls] No screen share stream')
      return
    }

    // Stop all tracks
    stream.getTracks().forEach((track) => track.stop())

    // Remove from streams
    streams.screenShare = undefined

    call.isScreenSharing = false
    logger.info('[MediaControls] Screen share stopped', { callId })
  }
}
