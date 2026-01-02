/**
 * 增强的Matrix WebRTC通话系统
 * 提供完整的音视频通话功能，包括群组通话、屏幕共享、通话录制等
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { createLogger, toError } from '@/utils/logger'

const logger = createLogger('EnhancedRTC')

/** Matrix 客户端扩展接口 */
interface MatrixClientExtended {
  getUserId?: () => string
  sendEvent: (roomId: string, eventType: string, content: Record<string, unknown>) => Promise<unknown>
  on: (event: string, handler: (...args: unknown[]) => void) => void
}

/** Matrix 事件接口 */
interface MatrixEvent {
  getType?: () => string
  getContent?: () => Record<string, unknown>
  getRoomId?: () => string
  getSender?: () => string
}

/** RTC 统计报告接口 */
interface RTCStatsReport {
  frameWidth?: number
  frameHeight?: number
  audioLevel?: number
  framesPerSecond?: number
  currentRoundTripTime?: number
}

/** 标准 RTC 统计接口 */
interface StandardRTCStats {
  id: string
  type: string
  timestamp: number
  mediaType?: string
  bytesReceived?: number
  packetsReceived?: number
  bytesSent?: number
  packetsSent?: number
  [key: string]: unknown
}

export interface EnhancedCallConfig {
  roomId: string
  callId: string
  type: 'audio' | 'video' | 'screen'
  state: 'idle' | 'ringing' | 'connecting' | 'connected' | 'hold' | 'ended' | 'failed'
  localStream?: MediaStream
  remoteStreams: Map<string, MediaStream>
  screenShareStream?: MediaStream
  startTime?: number
  duration?: number
  participants: Participant[]
  isInitiator: boolean
  isEncrypted: boolean
  isRecorded: boolean
  stats: CallStats
  settings: CallSettings
}

export interface Participant {
  userId: string
  displayName?: string
  avatarUrl?: string
  state: 'connecting' | 'connected' | 'disconnected' | 'muted' | 'video-off'
  audioMuted: boolean
  videoMuted: boolean
  isScreenSharing: boolean
  audioLevel?: number
  connectionQuality?: 'excellent' | 'good' | 'fair' | 'poor'
  joinTime?: number
}

export interface CallSettings {
  autoAnswer: boolean
  enableVideo: boolean
  enableAudio: boolean
  enableScreenShare: boolean
  enableRecording: boolean
  maxVideoQuality: 'low' | 'medium' | 'high' | 'ultra'
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
  videoConstraints: MediaTrackConstraints
  audioConstraints: MediaTrackConstraints
}

export interface CallStats {
  roomId: string
  callId: string
  duration: number
  localCandidates: number
  remoteCandidates: number
  bytesReceived: number
  bytesSent: number
  packetsReceived: number
  packetsSent: number
  packetsLost: number
  jitter: number
  rtt: number
  audioLevel?: number
  videoResolution?: { width: number; height: number }
  frameRate?: number
  bitrate?: number
  networkQuality?: 'excellent' | 'good' | 'fair' | 'poor'
}

export interface CallRecording {
  id: string
  callId: string
  roomId: string
  startTime: number
  endTime?: number
  format: 'webm' | 'mp4' | 'audio-only'
  size?: number
  url?: string
  participants: string[]
  isEncrypted: boolean
}

/**
 * 增强的WebRTC通话管理器
 */
export class EnhancedMatrixRTCManager {
  private client: MatrixClient
  private activeCalls = new Map<string, EnhancedCallConfig>()
  private peerConnections = new Map<string, RTCPeerConnection>()
  private mediaRecorder?: MediaRecorder | undefined
  private eventListeners = new Map<string, Array<(...args: unknown[]) => void>>()

  constructor(client: MatrixClient) {
    this.client = client
    this.setupEventListeners()
  }

  /**
   * 初始化RTC系统
   */
  async initialize(): Promise<boolean> {
    try {
      // 检查WebRTC支持
      if (!this.checkWebRTCSupport()) {
        throw new Error('WebRTC is not supported in this browser')
      }

      // 获取媒体权限
      await this.requestMediaPermissions()

      // 设置默认通话设置
      this.setupDefaultSettings()

      this.emit('rtc:initialized', {})
      return true
    } catch (error) {
      logger.error('Failed to initialize RTC:', toError(error))
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.emit('rtc:error', { error: errorMessage })
      return false
    }
  }

  /**
   * 发起通话
   */
  async initiateCall(
    roomId: string,
    callType: 'audio' | 'video',
    participantIds: string[] = [],
    settings?: Partial<CallSettings>
  ): Promise<string | null> {
    try {
      // 检查是否有进行中的通话
      const existingCall = this.getCallByRoom(roomId)
      if (existingCall) {
        throw new Error('A call is already in progress for this room')
      }

      const callId = this.generateCallId()
      const config = this.createCallConfig(roomId, callId, callType, true, participantIds, settings)

      // 获取本地媒体流
      const localStream = await this.getLocalStream(config.settings)
      config.localStream = localStream

      // 创建WebRTC连接
      const pc = this.createPeerConnection(callId, localStream)
      this.peerConnections.set(callId, pc)

      // 处理参与者
      for (const participantId of participantIds) {
        await this.inviteParticipant(roomId, callId, participantId)
      }

      // 发起Matrix通话信令
      await this.sendCallInvite(roomId, callId, callType)

      // 更新通话状态
      config.state = 'connecting'
      this.activeCalls.set(callId, config)

      this.emit('call:initiated', { callId, roomId, callType })
      return callId
    } catch (error) {
      logger.error('Failed to initiate call:', toError(error))
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.emit('call:error', { error: errorMessage })
      return null
    }
  }

  /**
   * 接听通话
   */
  async answerCall(roomId: string, callId: string, settings?: Partial<CallSettings>): Promise<boolean> {
    try {
      const config = this.createCallConfig(roomId, callId, 'audio', false, [], settings)

      // 获取本地媒体流
      const localStream = await this.getLocalStream(config.settings)
      config.localStream = localStream

      // 创建WebRTC连接
      const pc = this.createPeerConnection(callId, localStream)
      this.peerConnections.set(callId, pc)

      // 发送应答
      await this.sendCallAnswer(roomId, callId)

      // 更新通话状态
      config.state = 'connected'
      config.startTime = Date.now()
      this.activeCalls.set(callId, config)

      this.emit('call:answered', { callId, roomId })
      return true
    } catch (error) {
      logger.error('Failed to answer call:', toError(error))
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.emit('call:error', { error: errorMessage })
      return false
    }
  }

  /**
   * 拒绝通话
   */
  async rejectCall(roomId: string, callId: string): Promise<boolean> {
    try {
      await this.sendCallReject(roomId, callId)
      this.emit('call:rejected', { callId, roomId })
      return true
    } catch (error) {
      logger.error('Failed to reject call:', toError(error))
      return false
    }
  }

  /**
   * 结束通话
   */
  async hangupCall(callId: string): Promise<boolean> {
    try {
      const call = this.activeCalls.get(callId)
      if (!call) {
        return false
      }

      // 停止录制
      if (call.isRecorded) {
        await this.stopRecording(callId)
      }

      // 停止屏幕共享
      if (call.screenShareStream) {
        this.stopScreenShare(callId)
      }

      // 发送挂断信令
      await this.sendCallHangup(call.roomId, callId)

      // 清理WebRTC连接
      const pc = this.peerConnections.get(callId)
      if (pc) {
        pc.close()
        this.peerConnections.delete(callId)
      }

      // 清理媒体流
      this.cleanupStreams(call)

      // 更新通话状态
      call.state = 'ended'
      call.duration = call.startTime ? Date.now() - call.startTime : 0

      this.emit('call:ended', { callId, roomId: call.roomId, duration: call.duration })

      // 延迟清理
      setTimeout(() => {
        this.activeCalls.delete(callId)
      }, 1000)

      return true
    } catch (error) {
      logger.error('Failed to hangup call:', toError(error))
      return false
    }
  }

  /**
   * 切换麦克风
   */
  async toggleAudio(callId: string): Promise<boolean> {
    try {
      const call = this.activeCalls.get(callId)
      if (!call || !call.localStream) {
        return false
      }

      const audioTracks = call.localStream.getAudioTracks()

      // 检查是否有音频轨道
      if (audioTracks.length === 0) {
        logger.warn('No audio tracks found for call:', callId)
        return false
      }

      const firstTrack = audioTracks[0]
      if (!firstTrack) {
        logger.warn('First audio track is undefined for call:', callId)
        return false
      }

      const isMuted = !firstTrack.enabled

      audioTracks.forEach((track) => {
        if (track) {
          track.enabled = !isMuted
        }
      })

      // 更新参与者状态
      let myUserId = ''
      try {
        const clientExtended = this.client as unknown as MatrixClientExtended
        myUserId = clientExtended.getUserId?.() || ''
      } catch (error) {
        logger.warn('Failed to get user ID:', error)
      }

      if (!myUserId) {
        logger.warn('Unable to determine user ID for participant update')
        return !isMuted // Return the toggle state
      }

      const myParticipant = call.participants.find((p) => p.userId === myUserId)
      if (myParticipant) {
        myParticipant.audioMuted = isMuted
        myParticipant.state = isMuted ? 'muted' : 'connected'
      }

      this.emit('call:audio_toggled', { callId, muted: !isMuted })
      return true
    } catch (error) {
      logger.error('Failed to toggle audio:', toError(error))
      return false
    }
  }

  /**
   * 切换视频
   */
  async toggleVideo(callId: string): Promise<boolean> {
    try {
      const call = this.activeCalls.get(callId)
      if (!call || !call.localStream) {
        return false
      }

      const videoTracks = call.localStream.getVideoTracks()
      const firstVideoTrack = videoTracks[0]
      const isVideoOff = videoTracks.length === 0 || !firstVideoTrack?.enabled

      if (isVideoOff) {
        // 开启视频
        const videoStream = await this.getVideoStream(call.settings)
        videoStream.getVideoTracks().forEach((track) => {
          call.localStream?.addTrack(track)
        })
      } else {
        // 关闭视频
        videoTracks.forEach((track) => {
          if (track) {
            track.stop()
            call.localStream?.removeTrack(track)
          }
        })
      }

      // 更新参与者状态
      let myUserId = ''
      try {
        const clientExtended = this.client as unknown as MatrixClientExtended
        myUserId = clientExtended.getUserId?.() || ''
      } catch (error) {
        logger.warn('Failed to get user ID:', error)
        myUserId = ''
      }

      if (!myUserId) {
        logger.warn('Unable to determine user ID for participant update')
        return isVideoOff // Return the toggle state
      }

      const myParticipant = call.participants.find((p) => p.userId === myUserId)
      if (myParticipant) {
        myParticipant.videoMuted = isVideoOff
        myParticipant.state = isVideoOff ? 'video-off' : 'connected'
      }

      this.emit('call:video_toggled', { callId, videoOn: isVideoOff })
      return true
    } catch (error) {
      logger.error('Failed to toggle video:', toError(error))
      return false
    }
  }

  /**
   * 开始屏幕共享
   */
  async startScreenShare(callId: string): Promise<boolean> {
    try {
      const call = this.activeCalls.get(callId)
      if (!call) {
        return false
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      })

      call.screenShareStream = screenStream

      // 将屏幕共享流添加到所有WebRTC连接
      const pc = this.peerConnections.get(callId)
      if (pc) {
        screenStream.getTracks().forEach((track) => {
          pc.addTrack(track, screenStream)
        })
      }

      this.emit('call:screen_share_started', { callId })
      return true
    } catch (error) {
      logger.error('Failed to start screen share:', toError(error))
      return false
    }
  }

  /**
   * 停止屏幕共享
   */
  async stopScreenShare(callId: string): Promise<boolean> {
    try {
      const call = this.activeCalls.get(callId)
      if (!call || !call.screenShareStream) {
        return false
      }

      const screenStream = call.screenShareStream

      // 从所有WebRTC连接中移除屏幕共享流
      const pc = this.peerConnections.get(callId)
      if (pc) {
        screenStream.getTracks().forEach((track) => {
          const sender = pc.getSenders().find((s) => s.track === track)
          if (sender) {
            pc.removeTrack(sender)
          }
          track.stop()
        })
      }

      // Clear the screen share stream by omitting it from the config
      const { screenShareStream: _remove, ...callWithoutScreenShare } = call
      this.activeCalls.set(callId, { ...callWithoutScreenShare })

      this.emit('call:screen_share_stopped', { callId })
      return true
    } catch (error) {
      logger.error('Failed to stop screen share:', toError(error))
      return false
    }
  }

  /**
   * 开始通话录制
   */
  async startRecording(callId: string, format: 'webm' | 'mp4' = 'webm'): Promise<boolean> {
    try {
      const call = this.activeCalls.get(callId)
      if (!call || !call.localStream) {
        return false
      }

      // 创建录制流（包含本地和远程流）
      const recorderStream = new MediaStream()

      // 添加本地流
      call.localStream.getTracks().forEach((track) => {
        recorderStream.addTrack(track.clone())
      })

      // 添加远程流
      call.remoteStreams.forEach((stream) => {
        stream.getTracks().forEach((track) => {
          recorderStream.addTrack(track.clone())
        })
      })

      // 创建录制器
      this.mediaRecorder = new MediaRecorder(recorderStream, {
        mimeType: format === 'mp4' ? 'video/mp4' : 'video/webm'
      })

      const chunks: Blob[] = []
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: format === 'mp4' ? 'video/mp4' : 'video/webm' })
        const url = URL.createObjectURL(blob)

        const recording: CallRecording = {
          id: this.generateRecordingId(),
          callId,
          roomId: call.roomId,
          startTime: Date.now(),
          format,
          size: blob.size,
          url,
          participants: call.participants.map((p) => p.userId),
          isEncrypted: call.isEncrypted
        }

        this.emit('call:recording_completed', { callId, recording })
      }

      this.mediaRecorder.start()
      call.isRecorded = true

      this.emit('call:recording_started', { callId, format })
      return true
    } catch (error) {
      logger.error('Failed to start recording:', toError(error))
      return false
    }
  }

  /**
   * 停止通话录制
   */
  async stopRecording(callId: string): Promise<boolean> {
    try {
      if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
        return false
      }

      this.mediaRecorder.stop()
      this.mediaRecorder = undefined

      const call = this.activeCalls.get(callId)
      if (call) {
        call.isRecorded = false
      }

      this.emit('call:recording_stopped', { callId })
      return true
    } catch (error) {
      logger.error('Failed to stop recording:', toError(error))
      return false
    }
  }

  /**
   * 获取通话统计信息
   */
  async getCallStats(callId: string): Promise<CallStats | null> {
    try {
      const call = this.activeCalls.get(callId)
      if (!call) {
        return null
      }

      const pc = this.peerConnections.get(callId)
      if (!pc) {
        return null
      }

      const stats = await pc.getStats()
      const callStats: CallStats = {
        roomId: call.roomId,
        callId,
        duration: call.duration || 0,
        localCandidates: 0,
        remoteCandidates: 0,
        bytesReceived: 0,
        bytesSent: 0,
        packetsReceived: 0,
        packetsSent: 0,
        packetsLost: 0,
        jitter: 0,
        rtt: 0
      }

      // 处理统计数据
      stats.forEach((report: StandardRTCStats) => {
        const reportTyped = report as unknown as RTCStatsReport
        switch (report.type) {
          case 'inbound-rtp':
            if (report.mediaType === 'video') {
              callStats.bytesReceived += report.bytesReceived ?? 0
              callStats.packetsReceived += report.packetsReceived ?? 0
              callStats.videoResolution = {
                width: reportTyped.frameWidth || 0,
                height: reportTyped.frameHeight || 0
              }
            } else if (report.mediaType === 'audio') {
              const audioLevel = reportTyped.audioLevel
              if (audioLevel !== undefined) {
                callStats.audioLevel = audioLevel
              }
            }
            break

          case 'outbound-rtp':
            if (report.mediaType === 'video') {
              callStats.bytesSent += report.bytesSent ?? 0
              callStats.packetsSent += report.packetsSent ?? 0
              callStats.frameRate = reportTyped.framesPerSecond || 0
            }
            break

          case 'remote-candidate':
            callStats.remoteCandidates++
            break

          case 'local-candidate':
            callStats.localCandidates++
            break

          case 'candidate-pair': {
            const rtt = reportTyped.currentRoundTripTime
            if (rtt) {
              callStats.rtt = Math.round(rtt * 1000) / 1000
            }
            break
          }
        }
      })

      // 计算网络质量
      callStats.networkQuality = this.calculateNetworkQuality(callStats)
      call.stats = callStats

      return callStats
    } catch (error) {
      logger.error('Failed to get call stats:', toError(error))
      return null
    }
  }

  /**
   * 邀请参与者加入通话
   */
  async inviteParticipant(roomId: string, callId: string, participantId: string): Promise<boolean> {
    try {
      // 向参与者发送邀请
      const clientExtended = this.client as unknown as MatrixClientExtended
      await clientExtended.sendEvent(roomId, 'm.call.invite', {
        call_id: callId,
        lifetime: 60000,
        version: 1,
        invitee: participantId
      })

      // 添加到参与者列表
      const call = this.activeCalls.get(callId)
      if (call) {
        call.participants.push({
          userId: participantId,
          state: 'connecting',
          audioMuted: false,
          videoMuted: false,
          isScreenSharing: false
        })
      }

      this.emit('participant:invited', { callId, participantId })
      return true
    } catch (error) {
      logger.error('Failed to invite participant:', toError(error))
      return false
    }
  }

  /**
   * 获取所有活跃通话
   */
  getActiveCalls(): EnhancedCallConfig[] {
    return Array.from(this.activeCalls.values())
  }

  /**
   * 根据房间获取通话
   */
  getCallByRoom(roomId: string): EnhancedCallConfig | undefined {
    return Array.from(this.activeCalls.values()).find((call) => call.roomId === roomId)
  }

  // ========== 私有方法 ==========

  private checkWebRTCSupport(): boolean {
    return !!(window.RTCPeerConnection && window.RTCSessionDescription && navigator.mediaDevices)
  }

  private async requestMediaPermissions(): Promise<void> {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    } catch (error) {
      // 权限被拒绝，但不抛出错误
      logger.warn('Media permission denied:', { error })
    }
  }

  private setupDefaultSettings(): void {
    // 默认设置
  }

  private generateCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateRecordingId(): string {
    return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private createCallConfig(
    roomId: string,
    callId: string,
    callType: 'audio' | 'video',
    isInitiator: boolean,
    participantIds: string[],
    settings?: Partial<CallSettings>
  ): EnhancedCallConfig {
    const defaultSettings: CallSettings = {
      autoAnswer: false,
      enableVideo: callType === 'video',
      enableAudio: true,
      enableScreenShare: true,
      enableRecording: false,
      maxVideoQuality: 'medium',
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      videoConstraints: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 }
      },
      audioConstraints: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    }

    const finalSettings = { ...defaultSettings, ...settings }

    return {
      roomId,
      callId,
      type: callType,
      state: 'idle',
      remoteStreams: new Map(),
      participants: participantIds.map((userId) => ({
        userId,
        state: 'connecting',
        audioMuted: false,
        videoMuted: false,
        isScreenSharing: false
      })),
      isInitiator,
      isEncrypted: false, // Will be updated asynchronously
      isRecorded: false,
      stats: {
        roomId,
        callId,
        duration: 0,
        localCandidates: 0,
        remoteCandidates: 0,
        bytesReceived: 0,
        bytesSent: 0,
        packetsReceived: 0,
        packetsSent: 0,
        packetsLost: 0,
        jitter: 0,
        rtt: 0
      },
      settings: finalSettings
    }
  }

  private async getLocalStream(settings: CallSettings): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: settings.enableAudio ? settings.audioConstraints : false,
      video: settings.enableVideo ? settings.videoConstraints : false
    }

    return await navigator.mediaDevices.getUserMedia(constraints)
  }

  private async getVideoStream(settings: CallSettings): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      video: settings.videoConstraints
    }

    return await navigator.mediaDevices.getUserMedia(constraints)
  }

  private createPeerConnection(callId: string, localStream: MediaStream): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]
    })

    // 添加本地流
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream)
    })

    // 处理ICE候选
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // 发送ICE候选
        this.sendIceCandidates(callId, [event.candidate])
      }
    }

    // 处理远程流
    pc.ontrack = (event: RTCTrackEvent) => {
      const call = this.activeCalls.get(callId)
      if (call) {
        // 使用streams数组中的第一个流
        const stream = event.streams[0]
        if (!stream) return

        const userId = stream.id // 这里应该从信令中获取实际的userId
        call.remoteStreams.set(userId, stream)

        // 更新参与者状态
        const participant = call.participants.find((p) => p.userId === userId)
        if (participant) {
          participant.state = 'connected'
        }

        this.emit('participant:connected', { callId, userId, stream })
      }
    }

    return pc
  }

  private async sendCallInvite(roomId: string, callId: string, _callType: 'audio' | 'video'): Promise<void> {
    const clientExtended = this.client as unknown as MatrixClientExtended
    await clientExtended.sendEvent(roomId, 'm.call.invite', {
      call_id: callId,
      lifetime: 60000,
      version: 1,
      offer: {
        sdp: '', // 实际的SDP应该在设置好WebRTC连接后生成
        type: 'offer'
      }
    })
  }

  private async sendCallAnswer(roomId: string, callId: string): Promise<void> {
    const clientExtended = this.client as unknown as MatrixClientExtended
    await clientExtended.sendEvent(roomId, 'm.call.answer', {
      call_id: callId,
      version: 1,
      answer: {
        sdp: '', // 实际的SDP应该在创建应答后生成
        type: 'answer'
      }
    })
  }

  private async sendCallHangup(roomId: string, callId: string): Promise<void> {
    const clientExtended = this.client as unknown as MatrixClientExtended
    await clientExtended.sendEvent(roomId, 'm.call.hangup', {
      call_id: callId,
      version: 1,
      reason: 'user_hangup'
    })
  }

  private async sendCallReject(roomId: string, callId: string): Promise<void> {
    const clientExtended = this.client as unknown as MatrixClientExtended
    await clientExtended.sendEvent(roomId, 'm.call.reject', {
      call_id: callId,
      version: 1,
      reason: 'user_rejected'
    })
  }

  private async sendIceCandidates(_callId: string, _candidates: RTCIceCandidate[]): Promise<void> {
    // 这里应该获取房间信息并发送ICE候选
    // 实际实现需要根据Matrix通话信令协议
  }

  private calculateNetworkQuality(stats: CallStats): 'excellent' | 'good' | 'fair' | 'poor' {
    const { rtt, packetsLost, packetsReceived } = stats

    // 简单的网络质量计算
    let score = 100

    // RTT影响
    if (rtt < 50) score -= 0
    else if (rtt < 100) score -= 10
    else if (rtt < 200) score -= 25
    else score -= 40

    // 丢包率影响
    const lossRate = (packetsLost / Math.max(packetsReceived, 1)) * 100
    if (lossRate < 1) score -= 0
    else if (lossRate < 3) score -= 10
    else if (lossRate < 5) score -= 20
    else score -= 40

    if (score >= 80) return 'excellent'
    if (score >= 60) return 'good'
    if (score >= 40) return 'fair'
    return 'poor'
  }

  private cleanupStreams(call: EnhancedCallConfig): void {
    if (call.localStream) {
      call.localStream.getTracks().forEach((track) => track.stop())
    }

    if (call.screenShareStream) {
      call.screenShareStream.getTracks().forEach((track) => track.stop())
    }

    call.remoteStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop())
    })

    // Remove localStream and screenShareStream from the call config
    const { localStream: _ls, screenShareStream: _ss, ...callWithoutStreams } = call
    this.activeCalls.set(call.callId, callWithoutStreams)
    call.remoteStreams.clear()
  }

  private setupEventListeners(): void {
    // Matrix通话事件监听
    const clientExtended = this.client as unknown as MatrixClientExtended
    clientExtended.on('event', (event: unknown) => {
      const matrixEvent = event as MatrixEvent
      const eventType = matrixEvent.getType?.() || ''
      if (eventType.startsWith('m.call.')) {
        this.handleMatrixCallEvent(matrixEvent)
      }
    })
  }

  private handleMatrixCallEvent(event: MatrixEvent): void {
    const eventType = event.getType?.() || ''
    const content = event.getContent?.() || {}
    const roomId = event.getRoomId?.()
    const callId = content.call_id as string | undefined

    if (!callId) return

    switch (eventType) {
      case 'm.call.invite':
        this.emit('call:received', { roomId, callId, content })
        break

      case 'm.call.answer':
        this.emit('call:answered_remotely', { roomId, callId })
        break

      case 'm.call.hangup':
        this.emit('call:ended_remotely', { roomId, callId })
        break

      case 'm.call.candidates':
        this.emit('call:ice_candidates', { roomId, callId, candidates: content.candidates || [] })
        break
    }
  }

  private emit(event: string, data: Record<string, unknown>) {
    const listeners = this.eventListeners.get(event) || []
    listeners.forEach((listener) => {
      try {
        listener(data)
      } catch (error) {
        logger.error(`Error in RTC event listener for ${event}:`, toError(error))
      }
    })
  }

  /**
   * 事件监听器管理
   */
  public addEventListener(event: string, listener: (...args: unknown[]) => void) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(listener)
  }

  public removeEventListener(event: string, listener: (...args: unknown[]) => void) {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  /**
   * 清理资源
   */
  public destroy() {
    // 结束所有活跃通话
    this.activeCalls.forEach((_call, callId) => {
      this.hangupCall(callId)
    })

    this.activeCalls.clear()
    this.peerConnections.clear()

    if (this.mediaRecorder) {
      this.mediaRecorder.stop()
      this.mediaRecorder = undefined
    }

    this.eventListeners.clear()
  }
}

/**
 * 创建增强的RTC管理器
 */
export function createEnhancedRTCManager(client: MatrixClient): EnhancedMatrixRTCManager {
  return new EnhancedMatrixRTCManager(client)
}
