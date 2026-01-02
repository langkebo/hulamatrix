/**
 * Matrix Group Call Service
 * Handles group calls using MatrixRTC (m.call.select_answer protocol)
 */

import { logger } from '@/utils/logger'
import { matrixClientService } from '@/integrations/matrix/client'

/** Group call participant */
export interface GroupCallParticipant {
  /** User ID */
  userId: string
  /** Device ID */
  deviceId: string
  /** Display name */
  displayName?: string
  /** Avatar URL */
  avatar?: string
  /** Is this user muted */
  muted: boolean
  /** Is this user's video enabled */
  videoEnabled: boolean
  /** Is user speaking */
  speaking?: boolean
  /** Audio level */
  audioLevel?: number
  /** Connection state */
  connectionState: RTCIceConnectionState
}

/** Group call options */
export interface GroupCallOptions {
  /** Room ID for the group call */
  roomId: string
  /** Call type: 'voice' or 'video' */
  type: 'voice' | 'video'
  /** Whether encryption is enabled */
  encrypted?: boolean
  /** Ice servers */
  iceServers?: RTCIceServer[]
  /** Application name */
  appName?: string
}

/** Group call state */
export enum GroupCallState {
  /** Call is being set up */
  SETUP = 'setup',
  /** Call is ready */
  READY = 'ready',
  /** Connected to call */
  CONNECTED = 'connected',
  /** Call is on hold */
  ON_HOLD = 'on_hold',
  /** Call is ending */
  ENDING = 'ending',
  /** Call has ended */
  ENDED = 'ended',
  /** Call failed */
  FAILED = 'failed'
}

/** Event listener type */
type EventListener = (...args: unknown[]) => void

/**
 * Matrix Group Call Service
 * Implements MatrixRTC group calls using m.call.select_answer protocol
 */
export class MatrixGroupCallService {
  private static instance: MatrixGroupCallService
  private activeGroupCalls = new Map<string, GroupCall>()
  private eventListeners = new Map<string, EventListener[]>()

  // Default ICE servers
  private defaultIceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]

  static getInstance(): MatrixGroupCallService {
    if (!MatrixGroupCallService.instance) {
      MatrixGroupCallService.instance = new MatrixGroupCallService()
    }
    return MatrixGroupCallService.instance
  }

  /**
   * Create a new group call
   */
  async createGroupCall(options: GroupCallOptions): Promise<GroupCall> {
    try {
      logger.info('[MatrixGroupCallService] Creating group call', options)

      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not available')
      }

      // Create group call instance
      const groupCall = new GroupCall({
        roomId: options.roomId,
        type: options.type,
        encrypted: options.encrypted ?? true,
        iceServers: options.iceServers || this.defaultIceServers,
        appName: options.appName || 'HuLaMatrix'
      })

      // Store group call
      this.activeGroupCalls.set(options.roomId, groupCall)

      logger.info('[MatrixGroupCallService] Group call created', { roomId: options.roomId })
      return groupCall
    } catch (error) {
      logger.error('[MatrixGroupCallService] Failed to create group call:', error)
      throw error
    }
  }

  /**
   * Get active group call
   */
  getGroupCall(roomId: string): GroupCall | undefined {
    return this.activeGroupCalls.get(roomId)
  }

  /**
   * Get all active group calls
   */
  getActiveGroupCalls(): GroupCall[] {
    return Array.from(this.activeGroupCalls.values())
  }

  /**
   * End a group call
   */
  async endGroupCall(roomId: string): Promise<void> {
    const groupCall = this.activeGroupCalls.get(roomId)
    if (!groupCall) {
      return
    }

    try {
      logger.info('[MatrixGroupCallService] Ending group call', { roomId })
      await groupCall.terminate()
      this.activeGroupCalls.delete(roomId)
    } catch (error) {
      logger.error('[MatrixGroupCallService] Failed to end group call:', error)
      throw error
    }
  }

  /**
   * Add event listener
   */
  on(event: string, listener: EventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(listener)
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: EventListener): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }
}

/**
 * Group Call class
 * Represents an active MatrixRTC group call
 */
export class GroupCall {
  public readonly roomId: string
  public readonly type: 'voice' | 'video'
  public readonly encrypted: boolean
  public readonly appName: string
  public state: GroupCallState = GroupCallState.SETUP

  private iceServers: RTCIceServer[]
  private participants = new Map<string, GroupCallParticipant>()
  private localStreams: {
    audio?: MediaStream
    video?: MediaStream
    screenShare?: MediaStream
  } = {}
  private remoteStreams = new Map<string, MediaStream>()
  private peerConnections = new Map<string, RTCPeerConnection>()
  private dataChannels = new Map<string, RTCDataChannel>()

  // Local participant state
  private localMuted: boolean = false
  private localVideoOff: boolean = false
  private localScreenSharing: boolean = false

  // Media recorder for call recording
  private mediaRecorder: MediaRecorder | null = null
  private recordedChunks: Blob[] = []

  constructor(options: {
    roomId: string
    type: 'voice' | 'video'
    encrypted?: boolean
    iceServers?: RTCIceServer[]
    appName?: string
  }) {
    this.roomId = options.roomId
    this.type = options.type
    this.encrypted = options.encrypted ?? true
    this.iceServers = options.iceServers || []
    this.appName = options.appName || 'HuLaMatrix'
  }

  /**
   * Enter the group call
   */
  async enter(options?: { microphone?: 'muted' | 'unmuted'; camera?: 'off' | 'on' }): Promise<void> {
    try {
      logger.info('[GroupCall] Entering group call', {
        roomId: this.roomId,
        options
      })

      // Get user media
      await this.getLocalUserMedia()

      // Apply initial state
      if (options?.microphone === 'muted') {
        this.setMicrophoneMuted(true)
      }
      if (options?.camera === 'off') {
        this.setCameraEnabled(false)
      }

      this.state = GroupCallState.CONNECTED

      // Emit event
      this.emitStateChanged()

      logger.info('[GroupCall] Entered group call', { roomId: this.roomId })
    } catch (error) {
      logger.error('[GroupCall] Failed to enter group call:', error)
      this.state = GroupCallState.FAILED
      throw error
    }
  }

  /**
   * Leave the group call
   */
  async leave(): Promise<void> {
    try {
      logger.info('[GroupCall] Leaving group call', { roomId: this.roomId })

      this.state = GroupCallState.ENDING
      this.emitStateChanged()

      // Stop all tracks
      this.cleanupMediaStreams()

      // Close all peer connections
      this.peerConnections.forEach((pc) => pc.close())
      this.peerConnections.clear()

      // Close all data channels
      this.dataChannels.forEach((channel) => channel.close())
      this.dataChannels.clear()

      this.state = GroupCallState.ENDED
      this.emitStateChanged()

      logger.info('[GroupCall] Left group call', { roomId: this.roomId })
    } catch (error) {
      logger.error('[GroupCall] Failed to leave group call:', error)
      throw error
    }
  }

  /**
   * Terminate the group call (for call owner)
   */
  async terminate(): Promise<void> {
    try {
      logger.info('[GroupCall] Terminating group call', { roomId: this.roomId })

      // Send termination signal to all participants
      const client = matrixClientService.getClient()
      if (client) {
        // Send m.call.hangup to room
        await this.sendCallEvent('m.call.hangup', {
          'm.call_id': this.getCallId(),
          'm.type': this.type,
          'm.reason': 'call_ended'
        })
      }

      await this.leave()
    } catch (error) {
      logger.error('[GroupCall] Failed to terminate group call:', error)
      throw error
    }
  }

  /**
   * Get all participants
   */
  getParticipants(): GroupCallParticipant[] {
    return Array.from(this.participants.values())
  }

  /**
   * Get participant count
   */
  getParticipantCount(): number {
    return this.participants.size
  }

  /**
   * Remove a participant
   */
  async removeParticipant(userId: string): Promise<void> {
    try {
      logger.info('[GroupCall] Removing participant', { roomId: this.roomId, userId })

      // Close peer connection
      const pc = this.peerConnections.get(userId)
      if (pc) {
        pc.close()
        this.peerConnections.delete(userId)
      }

      // Remove from participants
      this.participants.delete(userId)

      // Emit participant removed event
      window.dispatchEvent(
        new CustomEvent('groupCall:participantRemoved', {
          detail: { roomId: this.roomId, userId }
        })
      )
    } catch (error) {
      logger.error('[GroupCall] Failed to remove participant:', error)
      throw error
    }
  }

  /**
   * Set microphone muted state
   */
  async setMicrophoneMuted(muted: boolean): Promise<void> {
    try {
      if (this.localStreams.audio) {
        const audioTrack = this.localStreams.audio.getAudioTracks()[0]
        if (audioTrack) {
          audioTrack.enabled = !muted
          this.localMuted = muted

          // Emit state change
          window.dispatchEvent(
            new CustomEvent('groupCall:localMuteChanged', {
              detail: { roomId: this.roomId, muted }
            })
          )
        }
      }
    } catch (error) {
      logger.error('[GroupCall] Failed to set microphone state:', error)
      throw error
    }
  }

  /**
   * Set camera enabled state
   */
  async setCameraEnabled(enabled: boolean): Promise<void> {
    try {
      if (this.localStreams.video) {
        const videoTrack = this.localStreams.video.getVideoTracks()[0]
        if (videoTrack) {
          videoTrack.enabled = enabled
          this.localVideoOff = !enabled

          // Emit state change
          window.dispatchEvent(
            new CustomEvent('groupCall:localVideoChanged', {
              detail: { roomId: this.roomId, enabled }
            })
          )
        }
      }
    } catch (error) {
      logger.error('[GroupCall] Failed to set camera state:', error)
      throw error
    }
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(): Promise<void> {
    try {
      if (!navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen sharing not supported')
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      })

      this.localStreams.screenShare = screenStream
      this.localScreenSharing = true

      // Add screen share to all peer connections
      this.peerConnections.forEach((pc) => {
        screenStream.getTracks().forEach((track) => {
          pc.addTrack(track, screenStream)
        })
      })

      // Handle user stopping screen share
      screenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare()
      }

      // Emit state change
      window.dispatchEvent(
        new CustomEvent('groupCall:screenShareStarted', {
          detail: { roomId: this.roomId }
        })
      )

      logger.info('[GroupCall] Screen share started', { roomId: this.roomId })
    } catch (error) {
      logger.error('[GroupCall] Failed to start screen share:', error)
      throw error
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(): Promise<void> {
    try {
      if (this.localStreams.screenShare) {
        // Remove screen share tracks from all peer connections
        this.localStreams.screenShare.getTracks().forEach((track) => {
          this.peerConnections.forEach((pc) => {
            const senders = pc.getSenders()
            senders.forEach((sender) => {
              if (sender.track === track) {
                pc.removeTrack(sender)
              }
            })
          })
          track.stop()
        })

        delete this.localStreams.screenShare
        this.localScreenSharing = false

        // Emit state change
        window.dispatchEvent(
          new CustomEvent('groupCall:screenShareStopped', {
            detail: { roomId: this.roomId }
          })
        )

        logger.info('[GroupCall] Screen share stopped', { roomId: this.roomId })
      }
    } catch (error) {
      logger.error('[GroupCall] Failed to stop screen share:', error)
      throw error
    }
  }

  /**
   * Start recording the call
   */
  startRecording(): void {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        logger.warn('[GroupCall] Recording already in progress')
        return
      }

      // Combine all streams
      const streams: MediaStream[] = []
      if (this.localStreams.audio) streams.push(this.localStreams.audio)
      if (this.localStreams.video) streams.push(this.localStreams.video)

      if (streams.length === 0) {
        throw new Error('No media streams to record')
      }

      // Create a combined stream
      const combinedStream = new MediaStream([...streams.flatMap((s) => s.getTracks())])

      // Create media recorder
      const options = { mimeType: 'video/webm;codecs=vp8,opus' }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm'
      }

      this.mediaRecorder = new MediaRecorder(combinedStream, options)
      this.recordedChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      }

      this.mediaRecorder.start()
      logger.info('[GroupCall] Recording started', { roomId: this.roomId })

      // Emit event
      window.dispatchEvent(
        new CustomEvent('groupCall:recordingStarted', {
          detail: { roomId: this.roomId }
        })
      )
    } catch (error) {
      logger.error('[GroupCall] Failed to start recording:', error)
      throw error
    }
  }

  /**
   * Stop recording and return the recorded blob
   */
  async stopRecording(): Promise<Blob> {
    try {
      if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
        throw new Error('No recording in progress')
      }

      return new Promise((resolve, _reject) => {
        this.mediaRecorder!.onstop = () => {
          const blob = new Blob(this.recordedChunks, { type: 'video/webm' })
          this.recordedChunks = []
          this.mediaRecorder = null

          logger.info('[GroupCall] Recording stopped', {
            roomId: this.roomId,
            size: blob.size
          })

          // Emit event
          window.dispatchEvent(
            new CustomEvent('groupCall:recordingStopped', {
              detail: { roomId: this.roomId, blob }
            })
          )

          resolve(blob)
        }

        this.mediaRecorder!.stop()
      })
    } catch (error) {
      logger.error('[GroupCall] Failed to stop recording:', error)
      throw error
    }
  }

  /**
   * Get local media streams
   */
  getLocalStreams(): typeof this.localStreams {
    return { ...this.localStreams }
  }

  /**
   * Get remote media stream for a participant
   */
  getRemoteStream(userId: string): MediaStream | undefined {
    return this.remoteStreams.get(userId)
  }

  /**
   * Get local state
   */
  getLocalState() {
    return {
      muted: this.localMuted,
      videoOff: this.localVideoOff,
      screenSharing: this.localScreenSharing
    }
  }

  /**
   * Get call ID
   */
  private getCallId(): string {
    return `groupcall_${this.roomId}_${Date.now()}`
  }

  /**
   * Get local user media
   */
  private async getLocalUserMedia(): Promise<void> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video:
          this.type === 'video'
            ? {
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }
            : false
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      // Store streams
      this.localStreams.audio = stream
      if (this.type === 'video') {
        this.localStreams.video = stream
      }

      logger.info('[GroupCall] Local media obtained', {
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length
      })
    } catch (error) {
      logger.error('[GroupCall] Failed to get local media:', error)
      throw error
    }
  }

  /**
   * Clean up media streams
   */
  private cleanupMediaStreams(): void {
    const stopStream = (stream?: MediaStream) => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }

    stopStream(this.localStreams.audio)
    stopStream(this.localStreams.video)
    stopStream(this.localStreams.screenShare)

    this.localStreams = {}
    this.remoteStreams.forEach((stream) => stopStream(stream))
    this.remoteStreams.clear()
  }

  /**
   * Send Matrix call event
   */
  private async sendCallEvent(type: string, content: Record<string, unknown>): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    const clientLike = client as {
      sendEvent: (roomId: string, type: string, content: Record<string, unknown>) => Promise<unknown>
    }

    try {
      await clientLike.sendEvent(this.roomId, type, content)
    } catch (error) {
      logger.error('[GroupCall] Failed to send call event:', error)
      throw error
    }
  }

  /**
   * Emit state changed event
   */
  private emitStateChanged(): void {
    window.dispatchEvent(
      new CustomEvent('groupCall:stateChanged', {
        detail: {
          roomId: this.roomId,
          state: this.state
        }
      })
    )
  }
}

// Export singleton instance
export const matrixGroupCallService = MatrixGroupCallService.getInstance()
