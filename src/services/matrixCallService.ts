/**
 * Matrix VoIP Call Service
 * Handles WebRTC-based voice and video calls in Matrix rooms
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import { matrixGroupCallService, type GroupCallOptions } from './matrixGroupCallService'

/** Window with WebRTC extensions */
interface WindowWithWebRTC extends Window {
  webkitRTCPeerConnection?: typeof RTCPeerConnection
  mozRTCPeerConnection?: typeof RTCPeerConnection
}

/** Matrix event with content accessor */
interface MatrixEventLike {
  getContent?: () => Record<string, unknown>
  content?: Record<string, unknown>
  sender?: string
  event_id?: string
  getType?: () => string
  getTs?: () => number
  getSender?: () => string
  getId?: () => string
}

/** Matrix room with timeline */
interface MatrixRoomLike {
  roomId: string
  name?: string
  timeline?: unknown[]
  getLiveTimeline?: () => unknown
}

/** Matrix call event content */
interface MatrixCallEventContent {
  'm.call_id'?: string
  'm.type'?:
    | 'm.voice'
    | 'm.video'
    | 'm.invite'
    | 'm.candidates'
    | 'm.answer'
    | 'm.hangup'
    | 'm.reject'
    | 'm.select_answer'
  'm.sdp'?: RTCSessionDescriptionInit
  'm.party_size'?: number
  'm.candidates'?: Array<{ candidate: string; sdpMLineIndex: number; sdpMid: string }>
  'm.reason'?: string
}

export interface CallOptions {
  /** Room ID for the call */
  roomId: string
  /** Call type: 'voice' or 'video' */
  type: 'voice' | 'video'
  /** Whether we are the initiator */
  isInitiator?: boolean
  /** Call ID (optional, will be generated if not provided) */
  callId?: string
  /** Offer timeout (ms) */
  offerTimeout?: number
  /** Ice servers */
  iceServers?: RTCIceServer[]
}

export interface CallParticipant {
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

export interface CallMedia {
  /** Local audio stream */
  localAudio?: MediaStream | undefined
  /** Local video stream */
  localVideo?: MediaStream | undefined
  /** Remote audio stream */
  remoteAudio?: MediaStream | undefined
  /** Remote video stream */
  remoteVideo?: MediaStream | undefined
  /** Screen share stream */
  screenShare?: MediaStream | undefined
}

export interface CallStats {
  /** Call duration (ms) */
  duration: number
  /** Packets sent */
  packetsSent: number
  /** Packets received */
  packetsReceived: number
  /** Packets lost */
  packetsLost: number
  /** Round trip time (ms) */
  rtt: number
  /** Jitter */
  jitter: number
}

/**
 * Matrix VoIP Call State
 */
export enum CallState {
  /** Call is being set up */
  SETUP = 'setup',
  /** Invite sent, waiting for response */
  INVITE_SENT = 'invite_sent',
  /** Invite received */
  INVITE_RECEIVED = 'invite_received',
  /** Ringing */
  RINGING = 'ringing',
  /** Call is connected */
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
 * Call recording data
 */
interface CallRecordingData {
  recorder: MediaRecorder
  chunks: Blob[]
  startTime: number
}

/**
 * Matrix VoIP Call Service
 */
export class MatrixCallService {
  private static instance: MatrixCallService
  private activeCalls = new Map<string, MatrixCall>()
  private peerConnections = new Map<string, RTCPeerConnection>()
  private mediaStreams: CallMedia = {}
  private isInitialized = false
  private eventListeners = new Map<string, EventListener[]>()
  private callRecorders = new Map<string, CallRecordingData>()

  // Default ICE servers
  private defaultIceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]

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
    try {
      logger.info('[MatrixCallService] Initializing VoIP service')

      // Check WebRTC support
      if (!this.isWebRTCSupported()) {
        throw new Error('WebRTC is not supported in this browser')
      }

      // Set up event handlers
      this.setupEventHandlers()

      this.isInitialized = true
      logger.info('[MatrixCallService] VoIP service initialized')
    } catch (error) {
      logger.error('[MatrixCallService] Failed to initialize VoIP service:', error)
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

      logger.info('[MatrixCallService] Received call event', {
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
      logger.error('[MatrixCallService] Failed to handle call event:', error)
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
      logger.info('[MatrixCallService] Starting call', options)

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

      logger.info('[MatrixCallService] Call started', { callId })
      return call
    } catch (error) {
      logger.error('[MatrixCallService] Failed to start call:', error)
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
      logger.info('[MatrixCallService] Accepting call', { callId })

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

      logger.info('[MatrixCallService] Call accepted', { callId })
    } catch (error) {
      logger.error('[MatrixCallService] Failed to accept call:', error)
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
      logger.info('[MatrixCallService] Rejecting call', { callId })

      // Send reject event
      await this.sendCallEvent(call.roomId, 'm.reject', {
        'm.call_id': callId,
        'm.type': call.type
      })

      // Update call state
      call.setState(CallState.ENDED)

      // Clean up
      this.endCall(callId)

      logger.info('[MatrixCallService] Call rejected', { callId })
    } catch (error) {
      logger.error('[MatrixCallService] Failed to reject call:', error)
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
      logger.info('[MatrixCallService] Ending call', { callId })

      // Update call state
      call.setState(CallState.ENDING)

      // Send hangup event
      await this.sendCallEvent(call.roomId, 'm.hangup', {
        'm.call_id': callId,
        'm.type': call.type,
        'm.reason': 'user_hangup'
      })

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

      logger.info('[MatrixCallService] Call ended', { callId })
    } catch (error) {
      logger.error('[MatrixCallService] Failed to end call:', error)
      throw error
    }
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
      logger.warn('[MatrixCallService] Call already exists', { callId })
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
      new CustomEvent('matrixIncomingCall', {
        detail: {
          call,
          sender: event.sender,
          roomName: room.name
        }
      })
    )

    logger.info('[MatrixCallService] Incoming call received', {
      callId,
      type: callType,
      sender: event.sender
    })
  }

  /**
   * Handle call candidates
   */
  private async handleCallCandidates(event: MatrixEventLike): Promise<void> {
    const content = (event.getContent?.() || event.content || {}) as MatrixCallEventContent
    const callId = content['m.call_id']
    const candidates = content['m.candidates']

    const pc = this.peerConnections.get(callId || '')
    if (!pc) {
      logger.warn('[MatrixCallService] No peer connection for candidates', { callId })
      return
    }

    try {
      // Add ICE candidates
      if (candidates) {
        for (const candidate of candidates) {
          await pc.addIceCandidate(
            new RTCIceCandidate({
              candidate: candidate.candidate,
              sdpMLineIndex: candidate.sdpMLineIndex,
              sdpMid: candidate.sdpMid
            })
          )
        }
      }

      logger.debug('[MatrixCallService] ICE candidates added', {
        callId,
        count: candidates?.length || 0
      })
    } catch (error) {
      logger.error('[MatrixCallService] Failed to add ICE candidates:', error)
    }
  }

  /**
   * Handle call answer
   */
  private async handleCallAnswer(event: MatrixEventLike): Promise<void> {
    const content = (event.getContent?.() || event.content || {}) as MatrixCallEventContent
    const callId = content['m.call_id']
    const sdp = content['m.sdp']

    const pc = this.peerConnections.get(callId || '')
    if (!pc) {
      logger.warn('[MatrixCallService] No peer connection for answer', { callId })
      return
    }

    try {
      // Set remote description
      if (sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      }

      // Update call state
      const call = this.activeCalls.get(callId || '')
      if (call) {
        call.setState(CallState.CONNECTED)
      }

      logger.info('[MatrixCallService] Call answered', { callId })
    } catch (error) {
      logger.error('[MatrixCallService] Failed to handle call answer:', error)
      throw error
    }
  }

  /**
   * Handle call hangup
   */
  private async handleCallHangup(event: MatrixEventLike): Promise<void> {
    const content = (event.getContent?.() || event.content || {}) as MatrixCallEventContent
    const callId = content['m.call_id']

    const call = this.activeCalls.get(callId || '')
    if (!call) {
      return
    }

    logger.info('[MatrixCallService] Call hangup received', { callId })

    // Clean up call
    await this.endCall(callId || '')
  }

  /**
   * Handle call reject
   */
  private async handleCallReject(event: MatrixEventLike): Promise<void> {
    const content = (event.getContent?.() || event.content || {}) as MatrixCallEventContent
    const callId = content['m.call_id']

    const call = this.activeCalls.get(callId || '')
    if (!call) {
      return
    }

    logger.info('[MatrixCallService] Call rejected', { callId })

    // Update call state
    call.setState(CallState.FAILED)

    // Clean up call
    this.endCall(callId || '')
  }

  /**
   * Handle select answer (for group calls)
   * This is part of the MatrixRTC (m.call.select_answer) protocol for group calls
   */
  private async handleCallSelectAnswer(event: MatrixEventLike): Promise<void> {
    try {
      const content = (event.getContent?.() || event.content || {}) as MatrixCallEventContent
      const callId = content['m.call_id']
      // Get room ID from event's room property or via type assertion
      const roomId =
        (event as unknown as { getRoomId?: () => string; room?: { roomId: string } })?.getRoomId?.() ||
        (event as unknown as { room?: { roomId: string } })?.room?.roomId ||
        ''

      logger.info('[MatrixCallService] Select answer received for group call', { callId, roomId })

      if (!roomId) {
        logger.warn('[MatrixCallService] No room ID in select answer event')
        return
      }

      // Check if there's an active group call for this room
      let groupCall = matrixGroupCallService.getGroupCall(roomId)

      // If no active group call exists, create one
      if (!groupCall) {
        logger.info('[MatrixCallService] Creating new group call for room', { roomId })

        const options: GroupCallOptions = {
          roomId,
          type: (content['m.type'] as 'voice' | 'video') || 'voice',
          encrypted: true,
          iceServers: this.defaultIceServers,
          appName: 'HuLaMatrix'
        }

        groupCall = await matrixGroupCallService.createGroupCall(options)

        // Emit event for UI to handle
        this.dispatchEvent('groupCall:created', { roomId, callId })
      }

      // Enter the group call
      const callType = (content['m.type'] as 'voice' | 'video') || 'voice'
      await groupCall.enter({
        microphone: 'unmuted',
        camera: callType === 'video' ? 'on' : 'off'
      })

      logger.info('[MatrixCallService] Joined group call', {
        roomId,
        participantCount: groupCall.getParticipantCount()
      })

      // Emit event for UI updates
      this.dispatchEvent('groupCall:joined', {
        roomId,
        callId,
        participantCount: groupCall.getParticipantCount()
      })
    } catch (error) {
      logger.error('[MatrixCallService] Failed to handle select answer:', error)
    }
  }

  /**
   * Create WebRTC peer connection
   */
  private async createPeerConnection(callId: string, customIceServers?: RTCIceServer[]): Promise<RTCPeerConnection> {
    const iceServers = customIceServers || this.defaultIceServers

    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10
    })

    // Store peer connection
    this.peerConnections.set(callId, pc)

    // Set up event handlers
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendIceCandidates(callId, [event.candidate])
      }
    }

    pc.ontrack = (event) => {
      this.handleRemoteTrack(callId, event)
    }

    pc.onconnectionstatechange = () => {
      this.handleConnectionStateChange(callId, pc.connectionState)
    }

    pc.oniceconnectionstatechange = () => {
      this.handleIceConnectionStateChange(callId, pc.iceConnectionState)
    }

    return pc
  }

  /**
   * Get user media (camera/microphone)
   */
  private async getUserMedia(type: 'voice' | 'video'): Promise<void> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video:
          type === 'video'
            ? {
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }
            : false
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      // Store streams
      this.mediaStreams.localAudio = stream
      if (type === 'video') {
        this.mediaStreams.localVideo = stream
      }

      logger.info('[MatrixCallService] User media obtained', { type })
    } catch (error) {
      logger.error('[MatrixCallService] Failed to get user media:', error)
      throw error
    }
  }

  /**
   * Handle remote track
   */
  private handleRemoteTrack(callId: string, event: RTCTrackEvent): void {
    const stream = event.streams[0]
    const track = event.track

    if (track.kind === 'audio') {
      this.mediaStreams.remoteAudio = stream
    } else if (track.kind === 'video') {
      this.mediaStreams.remoteVideo = stream
    }

    // Emit track event
    window.dispatchEvent(
      new CustomEvent('matrixCallTrack', {
        detail: {
          callId,
          kind: track.kind,
          stream
        }
      })
    )

    logger.debug('[MatrixCallService] Remote track received', {
      callId,
      kind: track.kind
    })
  }

  /**
   * Handle connection state change
   */
  private handleConnectionStateChange(callId: string, state: string): void {
    const call = this.activeCalls.get(callId)
    if (!call) {
      return
    }

    logger.debug('[MatrixCallService] Connection state changed', {
      callId,
      state
    })

    // Emit state change event
    window.dispatchEvent(
      new CustomEvent('matrixCallConnectionState', {
        detail: {
          callId,
          state
        }
      })
    )

    // Update call state based on connection
    if (state === 'connected') {
      call.setState(CallState.CONNECTED)
    } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
      call.setState(CallState.FAILED)
      this.endCall(callId)
    }
  }

  /**
   * Handle ICE connection state change
   */
  private handleIceConnectionStateChange(callId: string, state: RTCIceConnectionState): void {
    logger.debug('[MatrixCallService] ICE connection state changed', {
      callId,
      state
    })

    // Emit ICE state change event
    window.dispatchEvent(
      new CustomEvent('matrixCallIceConnectionState', {
        detail: {
          callId,
          state
        }
      })
    )

    // Handle failed ICE connection
    if (state === 'failed') {
      const call = this.activeCalls.get(callId)
      if (call) {
        call.setState(CallState.FAILED)
      }
      this.endCall(callId)
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

    const formattedCandidates = candidates.map((candidate) => ({
      candidate: candidate.candidate,
      sdpMLineIndex: candidate.sdpMLineIndex,
      sdpMid: candidate.sdpMid
    }))

    try {
      await this.sendCallEvent(call.roomId, 'm.candidates', {
        'm.call_id': callId,
        'm.type': call.type,
        'm.candidates': formattedCandidates
      })

      logger.debug('[MatrixCallService] ICE candidates sent', {
        callId,
        count: candidates.length
      })
    } catch (error) {
      logger.error('[MatrixCallService] Failed to send ICE candidates:', error)
    }
  }

  /**
   * Send Matrix call event
   */
  private async sendCallEvent(roomId: string, type: string, content: Record<string, unknown>): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      const clientLike = client as {
        sendEvent: (roomId: string, type: string, content: Record<string, unknown>) => Promise<unknown>
      }
      await clientLike.sendEvent(roomId, type, content)
    } catch (error) {
      logger.error('[MatrixCallService] Failed to send call event:', error)
      throw error
    }
  }

  /**
   * Generate unique call ID
   */
  private generateCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Clean up media streams
   */
  private cleanupMediaStreams(): void {
    // Stop all tracks
    const stopTracks = (stream?: MediaStream) => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }

    stopTracks(this.mediaStreams.localAudio)
    stopTracks(this.mediaStreams.localVideo)
    stopTracks(this.mediaStreams.remoteAudio)
    stopTracks(this.mediaStreams.remoteVideo)
    stopTracks(this.mediaStreams.screenShare)

    // Clear references
    this.mediaStreams = {}
  }

  /**
   * Mute microphone
   */
  async muteMic(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    const stream = this.mediaStreams.localAudio
    if (!stream) {
      throw new Error('No audio stream available')
    }

    const audioTrack = stream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = false
      call.isMuted = true
    }
  }

  /**
   * Unmute microphone
   */
  async unmuteMic(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    const stream = this.mediaStreams.localAudio
    if (!stream) {
      throw new Error('No audio stream available')
    }

    const audioTrack = stream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = true
      call.isMuted = false
    }
  }

  /**
   * Toggle audio mute
   */
  toggleAudio(callId: string): boolean {
    const stream = this.mediaStreams.localAudio
    if (!stream) {
      return false
    }

    const audioTrack = stream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled

      // Update call state
      const call = this.activeCalls.get(callId)
      if (call) {
        call.isMuted = !audioTrack.enabled
      }

      return audioTrack.enabled
    }

    return false
  }

  /**
   * Enable camera
   */
  async enableCamera(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    const stream = this.mediaStreams.localVideo
    if (!stream) {
      throw new Error('No video stream available')
    }

    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = true
      call.isCameraOff = false
    }
  }

  /**
   * Disable camera
   */
  async disableCamera(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    const stream = this.mediaStreams.localVideo
    if (!stream) {
      throw new Error('No video stream available')
    }

    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = false
      call.isCameraOff = true
    }
  }

  /**
   * Enable speaker
   */
  async enableSpeaker(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    call.isSpeakerOn = true
    // Note: Speaker control in WebRTC is more complex and typically
    // involves changing the audio output device, which is browser-dependent
  }

  /**
   * Disable speaker
   */
  async disableSpeaker(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    call.isSpeakerOn = false
  }

  /**
   * Toggle video
   */
  toggleVideo(callId: string): boolean {
    const stream = this.mediaStreams.localVideo
    if (!stream) {
      return false
    }

    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled

      // Update call state
      const call = this.activeCalls.get(callId)
      if (call) {
        call.isCameraOff = !videoTrack.enabled
      }

      return videoTrack.enabled
    }

    return false
  }

  /**
   * Start screen share
   */
  async startScreenShare(callId: string): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      })

      this.mediaStreams.screenShare = stream

      // Add screen share to peer connection
      const pc = this.peerConnections.get(callId)
      if (pc) {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream)
        })
      }

      logger.info('[MatrixCallService] Screen share started', { callId })
    } catch (error) {
      logger.error('[MatrixCallService] Failed to start screen share:', error)
      throw error
    }
  }

  /**
   * Stop screen share
   */
  stopScreenShare(callId: string): void {
    const stream = this.mediaStreams.screenShare
    if (!stream) {
      return
    }

    // Remove tracks from peer connection
    const pc = this.peerConnections.get(callId)
    if (pc) {
      stream.getTracks().forEach((track) => {
        pc.getSenders().forEach((sender) => {
          if (sender.track === track) {
            pc.removeTrack(sender)
          }
        })
      })
    }

    // Stop tracks
    stream.getTracks().forEach((track) => track.stop())

    // Clear reference
    delete this.mediaStreams.screenShare

    logger.info('[MatrixCallService] Screen share stopped', { callId })
  }

  /**
   * Get media streams
   */
  getMediaStreams(): CallMedia {
    return { ...this.mediaStreams }
  }

  /**
   * Send DTMF tone (for phone keypad functionality)
   * @param callId - The call ID
   * @param tone - DTMF tone character (0-9, *, #, A-D)
   */
  async sendDtmf(callId: string, tone: string): Promise<void> {
    const call = this.activeCalls.get(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    // Validate tone
    const validTones = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#', 'A', 'B', 'C', 'D']
    if (!validTones.includes(tone.toUpperCase())) {
      throw new Error(`Invalid DTMF tone: ${tone}`)
    }

    try {
      logger.info('[MatrixCallService] Sending DTMF tone', { callId, tone })

      // Get the peer connection for this call
      const pc = this.peerConnections.get(callId)
      if (!pc) {
        throw new Error('No peer connection for this call')
      }

      // Get the sender for the audio track
      const senders = pc.getSenders()
      const audioSender = senders.find((sender) => sender.track?.kind === 'audio')

      if (!audioSender) {
        throw new Error('No audio track found')
      }

      // Use RTCRtpSender.generateDTMF to create the tone
      // Note: This requires the browser to support DTMF
      const dtmfSender = audioSender as unknown as {
        dtmf?: RTCDTMFSender
        generateDTMF?: () => RTCDTMFSender
      }

      let dtmf: RTCDTMFSender | undefined

      if (dtmfSender.dtmf) {
        dtmf = dtmfSender.dtmf
      } else if (dtmfSender.generateDTMF) {
        dtmf = dtmfSender.generateDTMF()
      }

      if (!dtmf) {
        // Fallback: send DTMF as data channel message or Matrix event
        await this.sendDtmfAsEvent(callId, tone)
        return
      }

      // Insert DTMF tone
      // Note: RTCDTMFSender.insertDTMF may have different signatures across browsers
      try {
        // Try with duration parameter only (Firefox style)
        dtmf.insertDTMF(tone, 100)
      } catch {
        // Try with options object (Chrome style)
        const dtmfOptions = {
          duration: 100, // 100ms tone duration
          interToneGap: 50 // 50ms gap between tones
        } as unknown
        dtmf.insertDTMF(tone, dtmfOptions as number)
      }

      // Emit DTMF event
      window.dispatchEvent(
        new CustomEvent('matrixCallDtmfSent', {
          detail: { callId, tone }
        })
      )

      logger.info('[MatrixCallService] DTMF tone sent', { callId, tone })
    } catch (error) {
      logger.error('[MatrixCallService] Failed to send DTMF tone:', error)

      // Fallback: send as Matrix event
      try {
        await this.sendDtmfAsEvent(callId, tone)
      } catch (fallbackError) {
        logger.error('[MatrixCallService] DTMF fallback also failed:', fallbackError)
        throw error
      }
    }
  }

  /**
   * Send DTMF as Matrix event (fallback method)
   */
  private async sendDtmfAsEvent(callId: string, tone: string): Promise<void> {
    const call = this.activeCalls.get(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    // Send DTMF as custom Matrix event
    await this.sendCallEvent(call.roomId, 'm.call.dtmf', {
      'm.call_id': callId,
      'm.type': call.type,
      'm.tone': tone,
      'm.timestamp': Date.now()
    })

    logger.info('[MatrixCallService] DTMF sent as Matrix event', { callId, tone })
  }

  /**
   * Start call recording
   * @param callId - The call ID
   * @param options - Recording options
   */
  async startRecording(
    callId: string,
    options?: {
      mimeType?: string
      audioBitsPerSecond?: number
      videoBitsPerSecond?: number
    }
  ): Promise<void> {
    const call = this.activeCalls.get(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    try {
      logger.info('[MatrixCallService] Starting call recording', { callId, options })

      // Check if already recording
      if (call.isRecording) {
        logger.warn('[MatrixCallService] Recording already in progress')
        return
      }

      // Get all streams (local and remote)
      const streams: MediaStream[] = []

      if (this.mediaStreams.localAudio) {
        streams.push(this.mediaStreams.localAudio)
      }
      if (this.mediaStreams.localVideo) {
        streams.push(this.mediaStreams.localVideo)
      }
      if (this.mediaStreams.remoteAudio) {
        streams.push(this.mediaStreams.remoteAudio)
      }
      if (this.mediaStreams.remoteVideo) {
        streams.push(this.mediaStreams.remoteVideo)
      }

      if (streams.length === 0) {
        throw new Error('No media streams available for recording')
      }

      // Combine all streams
      const combinedStream = new MediaStream([...streams.flatMap((s) => s.getTracks())])

      // Determine supported MIME type
      let mimeType = options?.mimeType || 'video/webm;codecs=vp8,opus'
      const supportedTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm',
        'audio/webm'
      ]

      if (!MediaRecorder.isTypeSupported(mimeType)) {
        for (const type of supportedTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type
            break
          }
        }
      }

      // Create MediaRecorder
      const recorderOptions: MediaRecorderOptions = {
        mimeType
      }

      if (options?.audioBitsPerSecond || options?.videoBitsPerSecond) {
        recorderOptions.audioBitsPerSecond = options.audioBitsPerSecond
        recorderOptions.videoBitsPerSecond = options.videoBitsPerSecond
      }

      const mediaRecorder = new MediaRecorder(combinedStream, recorderOptions)

      // Store recorder chunks
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onerror = (event) => {
        logger.error('[MatrixCallService] MediaRecorder error:', event)
        call.isRecording = false
        this.callRecorders.delete(callId)
      }

      // Start recording
      mediaRecorder.start(1000) // Capture in 1-second chunks

      // Store recorder
      this.callRecorders.set(callId, {
        recorder: mediaRecorder,
        chunks,
        startTime: Date.now()
      })

      // Update call state
      call.isRecording = true

      // Emit event
      window.dispatchEvent(
        new CustomEvent('matrixCallRecordingStarted', {
          detail: { callId, mimeType }
        })
      )

      logger.info('[MatrixCallService] Recording started', { callId, mimeType })
    } catch (error) {
      logger.error('[MatrixCallService] Failed to start recording:', error)
      throw error
    }
  }

  /**
   * Stop call recording and return the recorded blob
   * @param callId - The call ID
   * @returns The recorded blob
   */
  async stopRecording(callId: string): Promise<Blob> {
    const call = this.activeCalls.get(callId)
    if (!call) {
      throw new Error('Call not found')
    }

    const recordingData = this.callRecorders.get(callId)
    if (!recordingData || !call.isRecording) {
      throw new Error('No recording in progress')
    }

    try {
      logger.info('[MatrixCallService] Stopping call recording', { callId })

      return new Promise((resolve, reject) => {
        const { recorder, chunks } = recordingData

        recorder.onstop = () => {
          const mimeType = recorder.mimeType || 'video/webm'
          const blob = new Blob(chunks, { type: mimeType })
          const duration = Date.now() - recordingData.startTime

          // Clean up
          this.callRecorders.delete(callId)
          call.isRecording = false

          logger.info('[MatrixCallService] Recording stopped', {
            callId,
            size: blob.size,
            duration
          })

          // Emit event with blob
          window.dispatchEvent(
            new CustomEvent('matrixCallRecordingStopped', {
              detail: { callId, blob, duration, mimeType }
            })
          )

          resolve(blob)
        }

        recorder.onerror = (error) => {
          logger.error('[MatrixCallService] Error stopping recorder:', error)
          this.callRecorders.delete(callId)
          call.isRecording = false
          reject(error)
        }

        recorder.stop()
      })
    } catch (error) {
      logger.error('[MatrixCallService] Failed to stop recording:', error)
      throw error
    }
  }

  /**
   * Pause call recording
   */
  async pauseRecording(callId: string): Promise<void> {
    const recordingData = this.callRecorders.get(callId)
    if (!recordingData) {
      throw new Error('No recording in progress')
    }

    const { recorder } = recordingData
    if (recorder.state === 'recording') {
      recorder.pause()
      logger.info('[MatrixCallService] Recording paused', { callId })
    }
  }

  /**
   * Resume call recording
   */
  async resumeRecording(callId: string): Promise<void> {
    const recordingData = this.callRecorders.get(callId)
    if (!recordingData) {
      throw new Error('No recording in progress')
    }

    const { recorder } = recordingData
    if (recorder.state === 'paused') {
      recorder.resume()
      logger.info('[MatrixCallService] Recording resumed', { callId })
    }
  }

  /**
   * Get active call
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

  // ========== Group Call Methods ==========

  /**
   * Create a new group call
   * @param options - Group call options
   * @returns The created group call
   */
  async createGroupCall(options: GroupCallOptions): Promise<import('./matrixGroupCallService').GroupCall> {
    try {
      logger.info('[MatrixCallService] Creating group call', options)

      const groupCall = await matrixGroupCallService.createGroupCall(options)

      // Set up event forwarding from group call to this service
      this.setupGroupCallEventForwarding(options.roomId)

      return groupCall
    } catch (error) {
      logger.error('[MatrixCallService] Failed to create group call:', error)
      throw error
    }
  }

  /**
   * Get active group call for a room
   * @param roomId - The room ID
   * @returns The group call or undefined
   */
  getGroupCall(roomId: string): import('./matrixGroupCallService').GroupCall | undefined {
    return matrixGroupCallService.getGroupCall(roomId)
  }

  /**
   * Get all active group calls
   * @returns Array of active group calls
   */
  getActiveGroupCalls(): import('./matrixGroupCallService').GroupCall[] {
    return matrixGroupCallService.getActiveGroupCalls()
  }

  /**
   * End a group call
   * @param roomId - The room ID
   */
  async endGroupCall(roomId: string): Promise<void> {
    try {
      logger.info('[MatrixCallService] Ending group call', { roomId })

      await matrixGroupCallService.endGroupCall(roomId)

      // Emit event
      this.dispatchEvent('groupCall:ended', { roomId })
    } catch (error) {
      logger.error('[MatrixCallService] Failed to end group call:', error)
      throw error
    }
  }

  /**
   * Join an existing group call
   * @param roomId - The room ID
   * @param options - Join options
   */
  async joinGroupCall(
    roomId: string,
    options?: { microphone?: 'muted' | 'unmuted'; camera?: 'off' | 'on' }
  ): Promise<void> {
    try {
      const groupCall = matrixGroupCallService.getGroupCall(roomId)
      if (!groupCall) {
        throw new Error('No active group call in this room')
      }

      await groupCall.enter(options)

      logger.info('[MatrixCallService] Joined group call', { roomId })

      // Emit event
      this.dispatchEvent('groupCall:joined', {
        roomId,
        participantCount: groupCall.getParticipantCount()
      })
    } catch (error) {
      logger.error('[MatrixCallService] Failed to join group call:', error)
      throw error
    }
  }

  /**
   * Leave a group call
   * @param roomId - The room ID
   */
  async leaveGroupCall(roomId: string): Promise<void> {
    try {
      const groupCall = matrixGroupCallService.getGroupCall(roomId)
      if (!groupCall) {
        return
      }

      await groupCall.leave()

      logger.info('[MatrixCallService] Left group call', { roomId })

      // Emit event
      this.dispatchEvent('groupCall:left', { roomId })
    } catch (error) {
      logger.error('[MatrixCallService] Failed to leave group call:', error)
      throw error
    }
  }

  /**
   * Set up event forwarding from group call service
   */
  private setupGroupCallEventForwarding(roomId: string): void {
    // Listen for group call state changes
    const onStateChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ roomId: string; state: string }>
      if (customEvent.detail.roomId === roomId) {
        this.dispatchEvent('groupCall:stateChanged', customEvent.detail)
      }
    }

    const onParticipantRemoved = (event: Event) => {
      const customEvent = event as CustomEvent<{ roomId: string; userId: string }>
      if (customEvent.detail.roomId === roomId) {
        this.dispatchEvent('groupCall:participantRemoved', customEvent.detail)
      }
    }

    window.addEventListener('groupCall:stateChanged', onStateChanged as EventListener)
    window.addEventListener('groupCall:participantRemoved', onParticipantRemoved as EventListener)
  }

  /**
   * Dispatch event to registered listeners
   */
  private dispatchEvent(event: string, detail: unknown): void {
    window.dispatchEvent(new CustomEvent(event, { detail }))

    // Also notify any registered listeners
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(detail)
        } catch (error) {
          logger.error('[MatrixCallService] Error in event listener:', { event, error })
        }
      })
    }
  }
}

/**
 * Matrix Call class
 */
export class MatrixCall {
  public readonly callId: string
  public readonly roomId: string
  public readonly type: 'voice' | 'video'
  public readonly isInitiator: boolean
  public state: CallState = CallState.SETUP
  public startTime?: number
  public endTime?: number
  public inviteEvent?: MatrixEventLike | undefined

  // Additional properties for UI compatibility
  public duration: number = 0
  public participantCount: number = 0
  public isMuted: boolean = false
  public isCameraOff: boolean = false
  public isSpeakerOn: boolean = false
  public isRecording: boolean = false
  public isScreenSharing: boolean = false
  public quality?: 'excellent' | 'good' | 'poor' | 'very_poor'

  private _durationTimer?: ReturnType<typeof setInterval>

  constructor(options: {
    callId: string
    roomId: string
    type: 'voice' | 'video'
    isInitiator: boolean
    inviteEvent?: MatrixEventLike
  }) {
    this.callId = options.callId
    this.roomId = options.roomId
    this.type = options.type
    this.isInitiator = options.isInitiator
    this.inviteEvent = options.inviteEvent
  }

  /**
   * Set call state
   */
  setState(state: CallState): void {
    const prevState = this.state
    this.state = state

    // Track call timing
    if (state === CallState.CONNECTED && !this.startTime) {
      this.startTime = Date.now()
      this.startDurationTimer()
    } else if (state === CallState.ENDED || state === CallState.FAILED) {
      this.endTime = Date.now()
      this.stopDurationTimer()
    }

    // Emit state change event
    window.dispatchEvent(
      new CustomEvent('matrixCallStateChanged', {
        detail: {
          callId: this.callId,
          state,
          prevState
        }
      })
    )

    logger.debug('[MatrixCall] State changed', {
      callId: this.callId,
      state,
      prevState
    })
  }

  /**
   * Start duration timer
   */
  private startDurationTimer(): void {
    if (this._durationTimer) {
      clearInterval(this._durationTimer)
    }

    this._durationTimer = setInterval(() => {
      this.duration = this.getDuration() / 1000 // Convert to seconds
    }, 1000)
  }

  /**
   * Stop duration timer
   */
  private stopDurationTimer(): void {
    if (this._durationTimer) {
      clearInterval(this._durationTimer)
      delete this._durationTimer
    }
    this.duration = this.getDuration() / 1000
  }

  /**
   * Get call duration
   */
  getDuration(): number {
    if (!this.startTime) {
      return 0
    }
    const endTime = this.endTime || Date.now()
    return endTime - this.startTime
  }

  /**
   * Get active property (for template compatibility)
   */
  get isActive(): boolean {
    return [
      CallState.INVITE_SENT,
      CallState.INVITE_RECEIVED,
      CallState.RINGING,
      CallState.CONNECTED,
      CallState.ON_HOLD
    ].includes(this.state)
  }

  /**
   * Check if call is active (method version)
   */
  isActiveMethod(): boolean {
    return this.isActive
  }
}

// Export singleton instance
export const matrixCallService = MatrixCallService.getInstance()
