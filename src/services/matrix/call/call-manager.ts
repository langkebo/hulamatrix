/**
 * Matrix Call Manager - Core call lifecycle and WebRTC management
 * Handles call creation, peer connections, and Matrix event handling
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import type {
  WindowWithWebRTC,
  MatrixEventLike,
  MatrixRoomLike,
  MatrixCallEventContent,
  CallOptions,
  CallMedia
} from './types'
import { CallState, MatrixCall } from './types'

/**
 * Stop all tracks in a media stream
 */
function stopTracks(stream?: MediaStream): void {
  if (!stream) return
  stream.getTracks().forEach((track) => track.stop())
}

/**
 * Manager class for Matrix call lifecycle
 */
export class MatrixCallManager {
  private activeCalls = new Map<string, MatrixCall>()
  private peerConnections = new Map<string, RTCPeerConnection>()
  private mediaStreams: CallMedia = {}
  private isInitialized = false

  // Default ICE servers
  private defaultIceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]

  /**
   * Initialize the call manager
   */
  async initialize(): Promise<void> {
    try {
      logger.info('[MatrixCallManager] Initializing call manager')

      // Check WebRTC support
      if (!this.isWebRTCSupported()) {
        throw new Error('WebRTC is not supported in this browser')
      }

      // Set up event handlers
      this.setupEventHandlers()

      this.isInitialized = true
      logger.info('[MatrixCallManager] Call manager initialized')
    } catch (error) {
      logger.error('[MatrixCallManager] Failed to initialize:', error)
      throw error
    }
  }

  /**
   * Check if WebRTC is supported
   */
  private isWebRTCSupported(): boolean {
    const wnd = window as WindowWithWebRTC
    return !!(window.RTCPeerConnection || wnd.webkitRTCPeerConnection || wnd.mozRTCPeerConnection)
  }

  /**
   * Set up Matrix event handlers
   */
  private setupEventHandlers(): void {
    const client = matrixClientService.getClient()
    if (!client) {
      return
    }
    // Listen for call events
    const clientLike = client as { on: (event: string, handler: (...args: unknown[]) => void) => void }
    clientLike.on('Room.timeline', (event: unknown, room: unknown) => {
      this.handleCallEvent(event as MatrixEventLike, room as MatrixRoomLike)
    })
  }

  /**
   * Handle Matrix call events
   */
  private async handleCallEvent(event: MatrixEventLike, room: MatrixRoomLike): Promise<void> {
    try {
      const content = (event.getContent?.() || event.content || {}) as MatrixCallEventContent
      if (!content || !content['m.call_id']) {
        return
      }

      const callId = content['m.call_id']
      const callType = content['m.type'] // 'invite', 'candidates', 'answer', 'hangup'

      logger.info('[MatrixCallManager] Received call event', {
        callId,
        callType,
        sender: event.sender
      })

      switch (callType) {
        case 'm.invite':
          await this.handleCallInvite(event, room)
          break
        case 'm.candidates':
          await this.handleCallCandidates(event)
          break
        case 'm.answer':
          await this.handleCallAnswer(event)
          break
        case 'm.hangup':
          await this.handleCallHangup(event)
          break
        case 'm.reject':
          await this.handleCallReject(event)
          break
        case 'm.select_answer':
          await this.handleCallSelectAnswer(event as unknown as MatrixEventLike)
          break
      }
    } catch (error) {
      logger.error('[MatrixCallManager] Failed to handle call event:', error)
    }
  }

  /**
   * Start a new call
   */
  async startCall(options: CallOptions): Promise<MatrixCall> {
    if (!this.isInitialized) {
      throw new Error('VoIP service not initialized')
    }

    try {
      logger.info('[MatrixCallManager] Starting call', options)

      // Generate call ID if not provided
      const callId = options.callId || this.generateCallId()

      // Create call instance
      const call = new MatrixCall({
        callId,
        roomId: options.roomId,
        type: options.type,
        isInitiator: true
      })

      // Store call
      this.activeCalls.set(callId, call)

      // Get user media
      await this.getUserMedia(options.type)

      // Create peer connection
      const pc = await this.createPeerConnection(callId, options.iceServers)

      // Add local streams
      if (this.mediaStreams.localAudio) {
        const audioTrack = this.mediaStreams.localAudio.getAudioTracks()[0]
        if (audioTrack) {
          pc.addTrack(audioTrack, this.mediaStreams.localAudio)
        }
      }
      if (options.type === 'video' && this.mediaStreams.localVideo) {
        const videoTrack = this.mediaStreams.localVideo.getVideoTracks()[0]
        if (videoTrack) {
          pc.addTrack(videoTrack, this.mediaStreams.localVideo)
        }
      }

      // Create and send offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: options.type === 'video'
      })

      await pc.setLocalDescription(offer)

      // Send invite event
      await this.sendCallEvent(options.roomId, 'm.invite', {
        'm.call_id': callId,
        'm.type': options.type,
        'm.party_size': 1,
        'm.sdp': offer
      })

      // Update call state
      call.setState(CallState.INVITE_SENT)

      logger.info('[MatrixCallManager] Call started', { callId })
      return call
    } catch (error) {
      logger.error('[MatrixCallManager] Failed to start call:', error)
      throw error
    }
  }

  /**
   * Accept an incoming call
   */
  async acceptCall(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    try {
      logger.info('[MatrixCallManager] Accepting call', { callId })

      // Get user media
      await this.getUserMedia(call.type)

      // Create peer connection
      const pc = await this.createPeerConnection(callId)

      // Add local streams
      if (this.mediaStreams.localAudio) {
        const audioTrack = this.mediaStreams.localAudio.getAudioTracks()[0]
        if (audioTrack) {
          pc.addTrack(audioTrack, this.mediaStreams.localAudio)
        }
      }
      if (call.type === 'video' && this.mediaStreams.localVideo) {
        const videoTrack = this.mediaStreams.localVideo.getVideoTracks()[0]
        if (videoTrack) {
          pc.addTrack(videoTrack, this.mediaStreams.localVideo)
        }
      }

      // Create and send answer
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      // Send answer event
      await this.sendCallEvent(call.roomId, 'm.answer', {
        'm.call_id': callId,
        'm.type': call.type,
        'm.sdp': answer,
        'm.party_size': 2
      })

      // Update call state
      call.setState(CallState.CONNECTED)

      logger.info('[MatrixCallManager] Call accepted', { callId })
    } catch (error) {
      logger.error('[MatrixCallManager] Failed to accept call:', error)
      call.setState(CallState.FAILED)
      throw error
    }
  }

  /**
   * Reject an incoming call
   */
  async rejectCall(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    try {
      logger.info('[MatrixCallManager] Rejecting call', { callId })

      // Send reject event
      await this.sendCallEvent(call.roomId, 'm.reject', {
        'm.call_id': callId,
        'm.type': call.type
      })

      // Update call state
      call.setState(CallState.ENDED)

      // Clean up
      this.endCallInternal(callId)

      logger.info('[MatrixCallManager] Call rejected', { callId })
    } catch (error) {
      logger.error('[MatrixCallManager] Failed to reject call:', error)
      throw error
    }
  }

  /**
   * End an active call
   */
  async endCall(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId)
    if (!call) {
      return
    }

    try {
      logger.info('[MatrixCallManager] Ending call', { callId })

      // Update call state
      call.setState(CallState.ENDING)

      // Send hangup event
      await this.sendCallEvent(call.roomId, 'm.hangup', {
        'm.call_id': callId,
        'm.type': call.type,
        'm.reason': 'user_hangup'
      })

      // Clean up
      this.endCallInternal(callId)

      logger.info('[MatrixCallManager] Call ended', { callId })
    } catch (error) {
      logger.error('[MatrixCallManager] Failed to end call:', error)
      throw error
    }
  }

  /**
   * Internal call cleanup
   */
  private endCallInternal(callId: string): void {
    const call = this.activeCalls.get(callId)
    if (!call) return

    // Clean up peer connection
    const pc = this.peerConnections.get(callId)
    if (pc) {
      pc.close()
      this.peerConnections.delete(callId)
    }

    // Clean up media streams
    this.cleanupMediaStreams()

    // Remove call
    this.activeCalls.delete(callId)

    // Update final state
    call.setState(CallState.ENDED)
  }

  /**
   * Handle incoming call invite
   */
  private async handleCallInvite(event: MatrixEventLike, room: MatrixRoomLike): Promise<void> {
    const content = (event.getContent?.() || event.content || {}) as MatrixCallEventContent
    const callId = content['m.call_id']
    const callType = content['m.type']

    // Check if we already have this call
    if (this.activeCalls.has(callId || '')) {
      logger.warn('[MatrixCallManager] Call already exists', { callId })
      return
    }

    // Map Matrix call type to our type
    const mappedType: 'voice' | 'video' = callType === 'm.video' ? 'video' : 'voice'

    // Create call instance
    const call = new MatrixCall({
      callId: callId || '',
      roomId: room.roomId,
      type: mappedType,
      isInitiator: false,
      inviteEvent: event
    })

    // Store call
    this.activeCalls.set(callId || '', call)

    // Update call state
    call.setState(CallState.INVITE_RECEIVED)

    // Emit incoming call event
    window.dispatchEvent(
      new CustomEvent('matrixCallIncoming', {
        detail: { callId, call }
      })
    )

    logger.info('[MatrixCallManager] Incoming call', { callId, type: mappedType })
  }

  /**
   * Handle ICE candidates
   */
  private async handleCallCandidates(event: MatrixEventLike): Promise<void> {
    const content = (event.getContent?.() || event.content || {}) as MatrixCallEventContent
    const callId = content['m.call_id']
    const candidates = content['m.candidates']

    if (!callId || !candidates) {
      return
    }

    const pc = this.peerConnections.get(callId)
    if (!pc) {
      logger.warn('[MatrixCallManager] Peer connection not found for candidates', { callId })
      return
    }

    // Add ICE candidates
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(
          new RTCIceCandidate({
            candidate: candidate.candidate,
            sdpMLineIndex: candidate.sdpMLineIndex,
            sdpMid: candidate.sdpMid
          })
        )
      } catch (error) {
        logger.warn('[MatrixCallManager] Failed to add ICE candidate:', error)
      }
    }

    logger.debug('[MatrixCallManager] ICE candidates added', { callId, count: candidates.length })
  }

  /**
   * Handle call answer
   */
  private async handleCallAnswer(event: MatrixEventLike): Promise<void> {
    const content = (event.getContent?.() || event.content || {}) as MatrixCallEventContent
    const callId = content['m.call_id']
    const sdp = content['m.sdp']

    if (!callId || !sdp) {
      return
    }

    const pc = this.peerConnections.get(callId)
    if (!pc) {
      logger.warn('[MatrixCallManager] Peer connection not found for answer', { callId })
      return
    }

    // Set remote description
    await pc.setRemoteDescription(new RTCSessionDescription(sdp))

    // Update call state
    const call = this.activeCalls.get(callId)
    if (call) {
      call.setState(CallState.CONNECTED)
    }

    logger.info('[MatrixCallManager] Call answered', { callId })
  }

  /**
   * Handle call hangup
   */
  private async handleCallHangup(event: MatrixEventLike): Promise<void> {
    const content = (event.getContent?.() || event.content || {}) as MatrixCallEventContent
    const callId = content['m.call_id']

    if (!callId) {
      return
    }

    const call = this.activeCalls.get(callId)
    if (!call) {
      return
    }

    // Update call state
    call.setState(CallState.ENDED)

    // Clean up
    this.endCallInternal(callId)

    logger.info('[MatrixCallManager] Call hung up', { callId })
  }

  /**
   * Handle call reject
   */
  private async handleCallReject(event: MatrixEventLike): Promise<void> {
    const content = (event.getContent?.() || event.content || {}) as MatrixCallEventContent
    const callId = content['m.call_id']

    if (!callId) {
      return
    }

    const call = this.activeCalls.get(callId)
    if (!call) {
      return
    }

    // Update call state
    call.setState(CallState.ENDED)

    // Clean up
    this.endCallInternal(callId)

    logger.info('[MatrixCallManager] Call rejected', { callId })
  }

  /**
   * Handle select_answer event (for glazer calls)
   */
  private async handleCallSelectAnswer(event: MatrixEventLike): Promise<void> {
    const content = (event.getContent?.() || event.content || {}) as MatrixCallEventContent
    const callId = content['m.call_id']
    const roomId = content['room_id'] as string | undefined

    if (!roomId) {
      return
    }

    // This is handled by the group call service
    logger.debug('[MatrixCallManager] Select answer event', { callId, roomId })
  }

  /**
   * Create peer connection
   */
  private async createPeerConnection(callId: string, customIceServers?: RTCIceServer[]): Promise<RTCPeerConnection> {
    const iceServers = customIceServers || this.defaultIceServers

    const pc = new RTCPeerConnection({ iceServers })

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendIceCandidates(callId, [event.candidate])
      }
    }

    // Handle remote tracks
    pc.ontrack = (event) => this.handleRemoteTrack(callId, event)

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      this.handleConnectionStateChange(callId, pc.connectionState)
    }

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      this.handleIceConnectionStateChange(callId, pc.iceConnectionState)
    }

    // Store peer connection
    this.peerConnections.set(callId, pc)

    return pc
  }

  /**
   * Get user media
   */
  private async getUserMedia(type: 'voice' | 'video'): Promise<void> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === 'video'
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      if (type === 'video') {
        // Split into audio and video streams
        const audioTrack = stream.getAudioTracks()[0]
        const videoTrack = stream.getVideoTracks()[0]

        if (audioTrack) {
          this.mediaStreams.localAudio = new MediaStream([audioTrack])
        }
        if (videoTrack) {
          this.mediaStreams.localVideo = new MediaStream([videoTrack])
        }
      } else {
        this.mediaStreams.localAudio = stream
      }

      logger.debug('[MatrixCallManager] User media obtained', { type })
    } catch (error) {
      logger.error('[MatrixCallManager] Failed to get user media:', error)
      throw error
    }
  }

  /**
   * Handle remote track
   */
  private handleRemoteTrack(callId: string, event: RTCTrackEvent): void {
    const call = this.activeCalls.get(callId)
    if (!call) {
      return
    }

    const track = event.track
    if (track.kind === 'audio') {
      this.mediaStreams.remoteAudio = event.streams[0]
    } else if (track.kind === 'video') {
      this.mediaStreams.remoteVideo = event.streams[0]
    }

    logger.debug('[MatrixCallManager] Remote track received', { callId, kind: track.kind })
  }

  /**
   * Handle connection state changes
   */
  private handleConnectionStateChange(callId: string, state: string): void {
    const call = this.activeCalls.get(callId)
    if (!call) {
      return
    }

    logger.debug('[MatrixCallManager] Connection state changed', { callId, state })

    if (state === 'connected') {
      call.setState(CallState.CONNECTED)
    } else if (state === 'disconnected' || state === 'failed') {
      call.setState(CallState.ENDED)
      this.endCallInternal(callId)
    }
  }

  /**
   * Handle ICE connection state changes
   */
  private handleIceConnectionStateChange(callId: string, state: RTCIceConnectionState): void {
    const call = this.activeCalls.get(callId)
    if (!call) {
      return
    }

    logger.debug('[MatrixCallManager] ICE connection state changed', { callId, state })

    if (state === 'connected') {
      call.quality = 'excellent'
    } else if (state === 'disconnected') {
      call.quality = 'poor'
    } else if (state === 'failed') {
      call.quality = 'very_poor'
      call.setState(CallState.FAILED)
      this.endCallInternal(callId)
    }
  }

  /**
   * Send ICE candidates
   */
  private async sendIceCandidates(callId: string, candidates: RTCIceCandidate[]): Promise<void> {
    const call = this.activeCalls.get(callId)
    if (!call) {
      return
    }

    const formattedCandidates = candidates.map((c) => ({
      candidate: c.candidate,
      sdpMLineIndex: c.sdpMLineIndex,
      sdpMid: c.sdpMid
    }))

    await this.sendCallEvent(call.roomId, 'm.candidates', {
      'm.call_id': callId,
      'm.candidates': formattedCandidates
    })

    logger.debug('[MatrixCallManager] ICE candidates sent', { callId, count: candidates.length })
  }

  /**
   * Send call event to Matrix room
   */
  private async sendCallEvent(roomId: string, type: string, content: Record<string, unknown>): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      const clientLike = client as {
        sendEvent: (roomId: string, eventType: string, content: Record<string, unknown>) => Promise<unknown>
      }
      await clientLike.sendEvent(roomId, 'm.call.' + type, content)
      logger.debug('[MatrixCallManager] Call event sent', { roomId, type })
    } catch (error) {
      logger.error('[MatrixCallManager] Failed to send call event:', error)
      throw error
    }
  }

  /**
   * Generate unique call ID
   */
  private generateCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Clean up media streams
   */
  cleanupMediaStreams(): void {
    stopTracks(this.mediaStreams.localAudio)
    stopTracks(this.mediaStreams.localVideo)
    stopTracks(this.mediaStreams.remoteAudio)
    stopTracks(this.mediaStreams.remoteVideo)
    stopTracks(this.mediaStreams.screenShare)

    this.mediaStreams = {}
  }

  /**
   * Get active call by ID
   */
  getActiveCall(callId: string): MatrixCall | undefined {
    return this.activeCalls.get(callId)
  }

  /**
   * Get all active calls
   */
  getActiveCalls(): MatrixCall[] {
    return Array.from(this.activeCalls.values())
  }

  /**
   * Get media streams
   */
  getMediaStreams(): CallMedia {
    return this.mediaStreams
  }

  /**
   * Check if initialized
   */
  isReady(): boolean {
    return this.isInitialized
  }
}
