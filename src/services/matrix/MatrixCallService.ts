import { createNewMatrixCall, CallEvent, type MatrixCall } from '@/lib/matrix-sdk'
import MatrixClientService from './MatrixClientService'
import { ref, type Ref } from 'vue'

export const CallType = {
  Voice: 'voice' as const,
  Video: 'video' as const
}

export const CallState = {
  Fledgling: 'fledgling' as const,
  InviteSent: 'invite_sent' as const,
  WaitLocalMedia: 'wait_local_media' as const,
  CreateOffer: 'create_offer' as const,
  CreateAnswer: 'create_answer' as const,
  Connecting: 'connecting' as const,
  Connected: 'connected' as const,
  Ringing: 'ringing' as const,
  Ended: 'ended' as const
}

export const CallErrorCode = {
  UserHangup: 'user_hangup' as const,
  NoUserMedia: 'no_user_media' as const,
  UnknownDevices: 'unknown_devices' as const,
  LocalOfferFailed: 'local_offer_failed' as const,
  SendInvite: 'send_invite' as const,
  CreateAnswer: 'create_answer' as const,
  CreateOffer: 'create_offer' as const,
  SendAnswer: 'send_answer' as const,
  SetRemoteDescription: 'set_remote_description' as const,
  SetLocalDescription: 'set_local_description' as const,
  AnsweredElsewhere: 'answered_elsewhere' as const,
  IceFailed: 'ice_failed' as const,
  InviteTimeout: 'invite_timeout' as const,
  Replaced: 'replaced' as const,
  SignallingFailed: 'signalling_timeout' as const,
  UserBusy: 'user_busy' as const,
  Transferred: 'transferred' as const,
  NewSession: 'new_session' as const
}

export const SDPStreamMetadataPurpose = {
  Usermedia: 'm.usermedia' as const,
  Screenshare: 'm.screenshare' as const
}

export enum CallStatus {
  Idle = 'idle',
  Calling = 'calling',
  Ringing = 'ringing',
  Connected = 'connected',
  Ended = 'ended',
  Error = 'error'
}

export interface CallInfo {
  callId: string
  roomId: string
  type: typeof CallType.Voice | typeof CallType.Video
  status: CallStatus
  peerUserId: string
  isIncoming: boolean
  startTime: number
  duration: number
}

export interface MediaDeviceInfo {
  deviceId: string
  label: string
  kind: 'audioinput' | 'videoinput' | 'audiooutput'
}

class MatrixCallService {
  private static instance: MatrixCallService
  private currentCall: MatrixCall | null = null
  private callListeners: Map<string, ((event: CallEvent, data: any) => void)[]> = new Map()

  private _callStatus: Ref<CallStatus> = ref(CallStatus.Idle)
  private _currentCallInfo: Ref<CallInfo | null> = ref(null)
  private _localAudioMuted: Ref<boolean> = ref(false)
  private _localVideoMuted: Ref<boolean> = ref(false)

  private constructor() {}

  static getInstance(): MatrixCallService {
    if (!MatrixCallService.instance) {
      MatrixCallService.instance = new MatrixCallService()
    }
    return MatrixCallService.instance
  }

  get callStatus(): Ref<CallStatus> {
    return this._callStatus
  }

  get currentCallInfo(): Ref<CallInfo | null> {
    return this._currentCallInfo
  }

  get localAudioMuted(): Ref<boolean> {
    return this._localAudioMuted
  }

  get localVideoMuted(): Ref<boolean> {
    return this._localVideoMuted
  }

  async createCall(roomId: string, type: typeof CallType.Voice | typeof CallType.Video): Promise<MatrixCall | null> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      this.cleanupCurrentCall()
      this._callStatus.value = CallStatus.Calling

      this.currentCall = createNewMatrixCall(client, roomId)

      if (!this.currentCall) {
        throw new Error('Failed to create call')
      }

      this.setupCallEventListeners(this.currentCall)
      this._currentCallInfo.value = {
        callId: this.currentCall.callId,
        roomId,
        type,
        status: CallStatus.Calling,
        peerUserId: '',
        isIncoming: false,
        startTime: Date.now(),
        duration: 0
      }

      return this.currentCall
    } catch (error) {
      console.error('Failed to create call:', error)
      this._callStatus.value = CallStatus.Error
      throw error
    }
  }

  async createVoiceCall(roomId: string): Promise<MatrixCall | null> {
    return this.createCall(roomId, CallType.Voice)
  }

  async createVideoCall(roomId: string): Promise<MatrixCall | null> {
    return this.createCall(roomId, CallType.Video)
  }

  async placeCall(): Promise<void> {
    if (!this.currentCall) {
      throw new Error('No active call')
    }

    try {
      if (this._currentCallInfo.value?.type === CallType.Voice) {
        await this.currentCall.placeVoiceCall()
      } else {
        await this.currentCall.placeVideoCall()
      }
    } catch (error) {
      console.error('Failed to place call:', error)
      this._callStatus.value = CallStatus.Error
      throw error
    }
  }

  async answerCall(audio = true, video = false): Promise<void> {
    if (!this.currentCall) {
      throw new Error('No incoming call')
    }

    try {
      await this.currentCall.answer(audio, video)
      this._callStatus.value = CallStatus.Connected
      if (this._currentCallInfo.value) {
        this._currentCallInfo.value.status = CallStatus.Connected
      }
    } catch (error) {
      console.error('Failed to answer call:', error)
      this._callStatus.value = CallStatus.Error
      throw error
    }
  }

  async hangupCall(): Promise<void> {
    if (!this.currentCall) {
      return
    }

    try {
      this.currentCall.hangup('user_hangup' as any, false)
      this.handleCallEnded()
    } catch (error) {
      console.error('Failed to hangup call:', error)
      this.handleCallEnded()
    }
  }

  async rejectCall(): Promise<void> {
    if (!this.currentCall) {
      return
    }

    try {
      this.currentCall.reject()
      this.handleCallEnded()
    } catch (error) {
      console.error('Failed to reject call:', error)
      this.handleCallEnded()
    }
  }

  async toggleAudioMute(): Promise<void> {
    if (!this.currentCall) {
      return
    }

    try {
      const newMutedState = !this._localAudioMuted.value
      await this.currentCall.setMicrophoneMuted(newMutedState)
      this._localAudioMuted.value = newMutedState
    } catch (error) {
      console.error('Failed to toggle audio mute:', error)
    }
  }

  async toggleVideoMute(): Promise<void> {
    if (!this.currentCall) {
      return
    }

    try {
      const newMutedState = !this._localVideoMuted.value
      await this.currentCall.setLocalVideoMuted(newMutedState)
      this._localVideoMuted.value = newMutedState
    } catch (error) {
      console.error('Failed to toggle video mute:', error)
    }
  }

  private setupCallEventListeners(call: MatrixCall): void {
    const handleStateChange = (_state: any, _oldState: any): void => {
      const state = call.state
      switch (state) {
        case 'ringing':
          this._callStatus.value = CallStatus.Ringing
          break
        case 'connected':
          this._callStatus.value = CallStatus.Connected
          if (this._currentCallInfo.value) {
            this._currentCallInfo.value.status = CallStatus.Connected
          }
          break
        case 'ended':
          this.handleCallEnded()
          break
        default:
          break
      }
    }

    call.on(CallEvent.State, handleStateChange)

    call.on(CallEvent.Hangup, () => {
      this.handleCallEnded()
    })

    call.on(CallEvent.Replaced, () => {
      this.handleCallEnded()
    })

    this.notifyListeners(CallEvent.State, { call })
  }

  private handleCallEnded(): void {
    this._callStatus.value = CallStatus.Ended
    if (this._currentCallInfo.value) {
      this._currentCallInfo.value.status = CallStatus.Ended
      this._currentCallInfo.value.duration = Date.now() - this._currentCallInfo.value.startTime
    }
    this.cleanupCurrentCall()
  }

  private cleanupCurrentCall(): void {
    if (this.currentCall) {
      const call = this.currentCall
      this.currentCall = null
      call.removeAllListeners()
    }
    this._callStatus.value = CallStatus.Idle
    this._localAudioMuted.value = false
    this._localVideoMuted.value = false
  }

  async getMediaDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices
        .filter(
          (device) => device.kind === 'audioinput' || device.kind === 'videoinput' || device.kind === 'audiooutput'
        )
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `${device.kind} - ${device.deviceId.slice(0, 8)}`,
          kind: device.kind as 'audioinput' | 'videoinput' | 'audiooutput'
        }))
    } catch (error) {
      console.error('Failed to enumerate media devices:', error)
      return []
    }
  }

  async switchAudioDevice(deviceId: string): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: false
      })
      stream.getTracks().forEach((track) => track.stop())
    } catch (error) {
      console.error('Failed to switch audio device:', error)
    }
  }

  async switchVideoDevice(deviceId: string): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: { exact: deviceId } }
      })
      stream.getTracks().forEach((track) => track.stop())
    } catch (error) {
      console.error('Failed to switch video device:', error)
    }
  }

  async startLocalVideo(): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      })
      return stream
    } catch (error) {
      console.error('Failed to start local video:', error)
      return null
    }
  }

  async stopLocalVideo(stream: MediaStream): Promise<void> {
    stream.getTracks().forEach((track) => track.stop())
  }

  on(event: string, listener: (event: CallEvent, data: any) => void): void {
    if (!this.callListeners.has(event)) {
      this.callListeners.set(event, [])
    }
    this.callListeners.get(event)?.push(listener)
  }

  off(event: string, listener: (event: CallEvent, data: any) => void): void {
    const listeners = this.callListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index !== -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private notifyListeners(event: CallEvent, data: any): void {
    const listeners = this.callListeners.get(event)
    if (listeners) {
      listeners.forEach((listener) => listener(event, data))
    }
  }

  getLocalVideoTrack(): MediaStreamTrack | null {
    if (!this.currentCall) return null
    const localFeeds = this.currentCall.getLocalFeeds()
    const videoFeed = localFeeds.find(
      (feed: any) =>
        feed.purpose === SDPStreamMetadataPurpose.Screenshare || feed.purpose === SDPStreamMetadataPurpose.Usermedia
    )
    return videoFeed?.stream.getVideoTracks()[0] || null
  }

  getRemoteVideoTrack(): MediaStreamTrack | null {
    if (!this.currentCall) return null
    const remoteFeeds = this.currentCall.getRemoteFeeds()
    const videoFeed = remoteFeeds.find(
      (feed: any) =>
        feed.purpose === SDPStreamMetadataPurpose.Screenshare || feed.purpose === SDPStreamMetadataPurpose.Usermedia
    )
    return videoFeed?.stream.getVideoTracks()[0] || null
  }

  getLocalAudioTrack(): MediaStreamTrack | null {
    if (!this.currentCall) return null
    const localFeeds = this.currentCall.getLocalFeeds()
    const audioFeed = localFeeds.find((feed: any) => feed.purpose === SDPStreamMetadataPurpose.Usermedia)
    return audioFeed?.stream.getAudioTracks()[0] || null
  }

  getRemoteAudioTrack(): MediaStreamTrack | null {
    if (!this.currentCall) return null
    const remoteFeeds = this.currentCall.getRemoteFeeds()
    const audioFeed = remoteFeeds.find((feed: any) => feed.purpose === SDPStreamMetadataPurpose.Usermedia)
    return audioFeed?.stream.getAudioTracks()[0] || null
  }

  getCallDuration(): number {
    if (!this._currentCallInfo.value || this._callStatus.value !== CallStatus.Connected) {
      return 0
    }
    return Date.now() - this._currentCallInfo.value.startTime
  }

  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    const pad = (n: number) => n.toString().padStart(2, '0')

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes % 60)}:${pad(seconds % 60)}`
    }
    return `${pad(minutes)}:${pad(seconds % 60)}`
  }

  destroy(): void {
    this.cleanupCurrentCall()
    this.callListeners.clear()
  }
}

export default MatrixCallService
