/**
 * Matrix VoIP Call Service - Main Entry Point
 * Orchestrates all call-related modules and provides unified API
 */

import { matrixGroupCallService, type GroupCallOptions } from '../../matrixGroupCallService'
import { logger } from '@/utils/logger'
import { MatrixCallManager } from './call-manager'
import { MediaControlsManager } from './media-controls'
import { CallRecordingManager } from './recording'
import { DTMFManager } from './dtmf'
import { EventsManager } from './events'
import { MatrixCall, type CallOptions, type CallMedia, type EventListener } from './types'

/**
 * Matrix VoIP Call Service
 * Main service class that orchestrates all call functionality
 */
export class MatrixCallService {
  private static instance: MatrixCallService
  private callManager: MatrixCallManager
  private mediaControls: MediaControlsManager
  private recording: CallRecordingManager
  private dtmf: DTMFManager
  private events: EventsManager

  // Expose peer connections for DTMF manager
  private peerConnections = new Map<string, RTCPeerConnection>()

  private constructor() {
    this.callManager = new MatrixCallManager()
    this.mediaControls = new MediaControlsManager(this.callManager)
    this.recording = new CallRecordingManager(this.callManager)
    this.dtmf = new DTMFManager(this.callManager, this.peerConnections)
    this.events = new EventsManager()
  }

  static getInstance(): MatrixCallService {
    if (!MatrixCallService.instance) {
      MatrixCallService.instance = new MatrixCallService()
    }
    return MatrixCallService.instance
  }

  /**
   * Initialize the VoIP service
   */
  async initialize(): Promise<void> {
    await this.callManager.initialize()
    logger.info('[MatrixCallService] VoIP service initialized')
  }

  /**
   * Start a new call
   */
  async startCall(options: CallOptions): Promise<MatrixCall> {
    return this.callManager.startCall(options)
  }

  /**
   * Accept an incoming call
   */
  async acceptCall(callId: string): Promise<void> {
    return this.callManager.acceptCall(callId)
  }

  /**
   * Reject an incoming call
   */
  async rejectCall(callId: string): Promise<void> {
    return this.callManager.rejectCall(callId)
  }

  /**
   * End an active call
   */
  async endCall(callId: string): Promise<void> {
    return this.callManager.endCall(callId)
  }

  /**
   * Mute microphone
   */
  async muteMic(callId: string): Promise<void> {
    return this.mediaControls.muteMic(callId)
  }

  /**
   * Unmute microphone
   */
  async unmuteMic(callId: string): Promise<void> {
    return this.mediaControls.unmuteMic(callId)
  }

  /**
   * Toggle microphone
   */
  toggleAudio(callId: string): boolean {
    return this.mediaControls.toggleAudio(callId)
  }

  /**
   * Set muted state
   */
  async setMuted(callId: string, muted: boolean): Promise<void> {
    return this.mediaControls.setMuted(callId, muted)
  }

  /**
   * Enable camera
   */
  async enableCamera(callId: string): Promise<void> {
    return this.mediaControls.enableCamera(callId)
  }

  /**
   * Disable camera
   */
  async disableCamera(callId: string): Promise<void> {
    return this.mediaControls.disableCamera(callId)
  }

  /**
   * Enable speaker
   */
  async enableSpeaker(callId: string): Promise<void> {
    return this.mediaControls.enableSpeaker(callId)
  }

  /**
   * Disable speaker
   */
  async disableSpeaker(callId: string): Promise<void> {
    return this.mediaControls.disableSpeaker(callId)
  }

  /**
   * Toggle video
   */
  toggleVideo(callId: string): boolean {
    return this.mediaControls.toggleVideo(callId)
  }

  /**
   * Set video enabled state
   */
  async setVideoEnabled(callId: string, enabled: boolean): Promise<void> {
    return this.mediaControls.setVideoEnabled(callId, enabled)
  }

  /**
   * Start screen share
   */
  async startScreenShare(callId: string): Promise<void> {
    return this.mediaControls.startScreenShare(callId)
  }

  /**
   * Stop screen share
   */
  stopScreenShare(callId: string): void {
    this.mediaControls.stopScreenShare(callId)
  }

  /**
   * Get media streams
   */
  getMediaStreams(): CallMedia {
    return this.callManager.getMediaStreams()
  }

  /**
   * Send DTMF tone
   */
  async sendDtmf(callId: string, tone: string): Promise<void> {
    return this.dtmf.sendDtmf(callId, tone)
  }

  /**
   * Start recording
   */
  async startRecording(
    callId: string,
    options?: {
      mimeType?: string
      audioBitsPerSecond?: number
      videoBitsPerSecond?: number
    }
  ): Promise<void> {
    return this.recording.startRecording(callId, options)
  }

  /**
   * Stop recording
   */
  async stopRecording(callId: string): Promise<Blob> {
    return this.recording.stopRecording(callId)
  }

  /**
   * Pause recording
   */
  async pauseRecording(callId: string): Promise<void> {
    return this.recording.pauseRecording(callId)
  }

  /**
   * Resume recording
   */
  async resumeRecording(callId: string): Promise<void> {
    return this.recording.resumeRecording(callId)
  }

  /**
   * Get active call
   */
  getActiveCall(callId: string): MatrixCall | undefined {
    return this.callManager.getActiveCall(callId)
  }

  /**
   * Get all active calls
   */
  getActiveCalls(): MatrixCall[] {
    return this.callManager.getActiveCalls()
  }

  /**
   * Add event listener
   */
  on(event: string, listener: EventListener): void {
    this.events.on(event, listener)
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: EventListener): void {
    this.events.off(event, listener)
  }

  /**
   * Create group call
   */
  async createGroupCall(options: GroupCallOptions): Promise<import('../../matrixGroupCallService').GroupCall> {
    const groupCall = await matrixGroupCallService.createGroupCall(options)
    this.setupGroupCallEventForwarding(options.roomId)
    return groupCall
  }

  /**
   * Get group call
   */
  getGroupCall(roomId: string): import('../../matrixGroupCallService').GroupCall | undefined {
    return matrixGroupCallService.getGroupCall(roomId)
  }

  /**
   * Get all active group calls
   */
  getActiveGroupCalls(): import('../../matrixGroupCallService').GroupCall[] {
    return matrixGroupCallService.getActiveGroupCalls()
  }

  /**
   * End group call
   */
  async endGroupCall(roomId: string): Promise<void> {
    await matrixGroupCallService.endGroupCall(roomId)
  }

  /**
   * Join group call
   */
  async joinGroupCall(
    roomId: string,
    options?: {
      microphone?: 'muted' | 'unmuted'
      camera?: 'off' | 'on'
    }
  ): Promise<void> {
    const groupCall = matrixGroupCallService.getGroupCall(roomId)
    if (!groupCall) {
      throw new Error('Group call not found')
    }
    await groupCall.enter(options)
  }

  /**
   * Leave group call
   */
  async leaveGroupCall(roomId: string): Promise<void> {
    const groupCall = matrixGroupCallService.getGroupCall(roomId)
    if (!groupCall) {
      throw new Error('Group call not found')
    }
    await groupCall.leave()
  }

  /**
   * Set up group call event forwarding
   */
  private setupGroupCallEventForwarding(roomId: string): void {
    // Forward group call state changes
    window.addEventListener('matrixGroupCallStateChanged', (event) => {
      const customEvent = event as CustomEvent<{ roomId: string }>
      if (customEvent.detail.roomId === roomId) {
        this.events.dispatchEvent('groupCallStateChanged', customEvent.detail)
      }
    })

    // Forward group call participant changes
    window.addEventListener('matrixGroupCallParticipantChanged', (event) => {
      const customEvent = event as CustomEvent<{ roomId: string }>
      if (customEvent.detail.roomId === roomId) {
        this.events.dispatchEvent('groupCallParticipantChanged', customEvent.detail)
      }
    })
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.callManager.isReady()
  }
}

// Export singleton instance
export const matrixCallService = MatrixCallService.getInstance()

// Re-export types
export * from './types'
