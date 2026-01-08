/**
 * Matrix VoIP Call Service - Type Definitions
 * Contains all types, interfaces, and the MatrixCall class
 */

import { logger } from '@/utils/logger'

/** Window with WebRTC extensions */
export interface WindowWithWebRTC extends Window {
  webkitRTCPeerConnection?: typeof RTCPeerConnection
  mozRTCPeerConnection?: typeof RTCPeerConnection
}

/** Matrix event with content accessor */
export interface MatrixEventLike {
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
export interface MatrixRoomLike {
  roomId: string
  name?: string
  timeline?: unknown[]
  getLiveTimeline?: () => unknown
}

/** Matrix call event content */
export interface MatrixCallEventContent {
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
  room_id?: string
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
export type EventListener = (...args: unknown[]) => void

/**
 * Call recording data
 */
export interface CallRecordingData {
  recorder: MediaRecorder
  chunks: Blob[]
  startTime: number
}

/**
 * Matrix Call - Represents a single VoIP call
 */
export class MatrixCall {
  public readonly callId: string
  public readonly roomId: string
  public readonly type: 'voice' | 'video'
  public readonly isInitiator: boolean
  public inviteEvent?: MatrixEventLike

  public state: CallState = CallState.SETUP
  public startTime?: number
  public endTime?: number
  public duration: number = 0
  public participants: CallParticipant[] = []
  public stats?: CallStats
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
   * Check if call is active method (for compatibility)
   */
  isActiveMethod(): boolean {
    return this.isActive
  }
}
