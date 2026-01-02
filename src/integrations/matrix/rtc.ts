import { matrixClientService } from '@/integrations/matrix/client'
import { useRtcStore } from '@/stores/rtc'
import { flags } from '@/utils/envFlags'
import { handleRtcCallEvent } from './rtcUiHandler'
import { logger } from '@/utils/logger'
import type {
  MatrixCallSignalType,
  MatrixRtcPayload,
  MatrixCallEvent,
  InviteContent,
  AnswerContent,
  CandidatesContent,
  HangupContent,
  RejectContent
} from '@/types/matrix'

export type { MatrixCallEvent }
export type CallType = 'audio' | 'video'
export type CallState = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended' | 'failed'

/** TURN服务器凭证接口 */
export interface TurnServerCredentials {
  uris: string[]
  username: string
  password: string
  ttl: number
}

/** Matrix 客户端扩展接口 */
interface MatrixClientExtended {
  getRoom?: (roomId: string) => MatrixRoomLike | null
  sendEvent: (roomId: string, eventType: string, content: Record<string, unknown>) => Promise<unknown>
  on: (event: string, handler: (...args: unknown[]) => void) => void
}

/** Matrix 房间接口 */
interface MatrixRoomLike {
  roomId?: string
  getJoinedMembers: () => MatrixRoomMemberLike[]
}

/** Matrix 房间成员接口 */
interface MatrixRoomMemberLike {
  userId?: string
}

/** Matrix 事件接口 */
interface MatrixEventLike {
  getType?: () => string
  getContent?: () => Record<string, unknown> | MatrixRtcPayload
  getSender?: () => string
  getRoomId?: () => string
  getTs?: () => number
}

/** ICE 候选基础接口 */
interface IceCandidateBase {
  candidate: string
  sdpMLineIndex?: number
  sdpMid?: string
}

/** 全局 this 扩展 */
interface GlobalThisWithRTC {
  RTCPeerConnection?: typeof RTCPeerConnection
}

export interface CallConfig {
  roomId: string
  callId: string
  type: CallType
  state: CallState
  localStream?: MediaStream
  remoteStream?: MediaStream
  startTime?: number
  duration?: number
  participants: string[]
  isInitiator: boolean
}

export interface CallStats {
  roomId: string
  callId: string
  duration: number
  state: CallState
  localCandidates: number
  remoteCandidates: number
  bytesReceived: number
  bytesSent: number
  packetsReceived: number
  packetsSent: number
  audioLevel?: number
  videoResolution?: { width: number; height: number }
}

/**
 * 发送Matrix RTC信号
 */
export async function sendMatrixRtcSignal(
  roomId: string,
  signalType: MatrixCallSignalType,
  payload: MatrixRtcPayload
): Promise<boolean> {
  const client = matrixClientService.getClient() as MatrixClientExtended | null
  if (!client) return false

  try {
    const content = { ...payload }
    let eventType = 'm.call.invite'

    switch (signalType) {
      case 'offer': {
        const offerContent = content as InviteContent
        if (!offerContent?.offer) return false
        eventType = 'm.call.invite'
        break
      }
      case 'answer': {
        const answerContent = content as AnswerContent
        if (!answerContent?.answer) return false
        eventType = 'm.call.answer'
        break
      }
      case 'candidate': {
        const candidateContent = content as CandidatesContent
        if (!Array.isArray(candidateContent?.candidates) || !candidateContent?.candidates.length) return false
        eventType = 'm.call.candidates'
        break
      }
      case 'hangup': {
        const hangupContent = content as HangupContent
        if (!hangupContent?.reason) return false
        eventType = 'm.call.hangup'
        break
      }
      case 'reject': {
        const rejectContent = content as RejectContent
        if (!rejectContent?.reason) return false
        eventType = 'm.call.reject'
        break
      }
      case 'select_answer':
        eventType = 'm.call.select_answer'
        break
      default:
        logger.warn('Unknown RTC signal type:', signalType)
        return false
    }

    await client.sendEvent(roomId, eventType, content)
    return true
  } catch (error) {
    logger.error('Failed to send RTC signal:', error)
    return false
  }
}

/**
 * 发起通话
 */
export async function initiateCall(
  roomId: string,
  type: CallType,
  callId: string = generateCallId()
): Promise<boolean> {
  try {
    const client = matrixClientService.getClient() as MatrixClientExtended | null
    if (!client) return false

    const room = client.getRoom?.(roomId)
    if (!room) {
      logger.error('Room not found:', roomId)
      return false
    }

    const members = room.getJoinedMembers()
    if (members.length !== 2) {
      logger.error('Call only supported in 1:1 rooms')
      return false
    }

    // 获取媒体流
    const constraints = {
      audio: true,
      video: type === 'video'
    }

    const localStream = await navigator.mediaDevices.getUserMedia(constraints)

    // 创建SDP offer
    const peerConnection = createPeerConnection()
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream)
    })

    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    // 发送邀请
    const inviteContent: InviteContent = {
      call_id: callId,
      lifetime: 60000, // 60秒
      version: 1,
      offer: {
        sdp: offer.sdp ?? '',
        type: offer.type ?? 'offer'
      }
    }

    const success = await sendMatrixRtcSignal(roomId, 'offer', inviteContent)

    if (success) {
      // 更新RTC存储状态
      const rtc = useRtcStore()
      rtc.setOngoing(roomId)

      return true
    }

    // 清理资源
    localStream.getTracks().forEach((track) => track.stop())
    return false
  } catch (error) {
    logger.error('Failed to initiate call:', error)
    return false
  }
}

/**
 * 接听通话
 */
export async function answerCall(
  roomId: string,
  callId: string,
  offerContent: InviteContent,
  type: CallType
): Promise<boolean> {
  try {
    const client = matrixClientService.getClient() as MatrixClientExtended | null
    if (!client) return false

    // 获取媒体流
    const constraints = {
      audio: true,
      video: type === 'video'
    }

    const localStream = await navigator.mediaDevices.getUserMedia(constraints)

    // 创建peer connection
    const peerConnection = createPeerConnection()
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream)
    })

    // 设置远程描述
    if (offerContent?.offer?.sdp) {
      const offer: RTCSessionDescriptionInit = {
        type: (offerContent.offer.type === 'offer' ? 'offer' : 'answer') as RTCSdpType,
        sdp: offerContent.offer.sdp
      }
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    }

    // 创建answer
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    // 发送应答
    const answerContent: AnswerContent = {
      call_id: callId,
      version: 1,
      answer: {
        sdp: answer.sdp || '',
        type: answer.type
      }
    }

    const success = await sendMatrixRtcSignal(roomId, 'answer', answerContent)

    if (success) {
      // 更新RTC存储状态
      const rtc = useRtcStore()
      rtc.setOngoing(roomId)

      return true
    }

    // 清理资源
    localStream.getTracks().forEach((track) => track.stop())
    return false
  } catch (error) {
    logger.error('Failed to answer call:', error)
    return false
  }
}

/**
 * 挂断通话
 */
export async function hangupCall(roomId: string, callId: string): Promise<boolean> {
  try {
    const hangupContent: HangupContent = {
      call_id: callId,
      version: 1,
      reason: 'user_hangup'
    }

    const success = await sendMatrixRtcSignal(roomId, 'hangup', hangupContent)

    if (success) {
      // 更新RTC存储状态
      const rtc = useRtcStore()
      rtc.setEnded(roomId)
    }

    return success
  } catch (error) {
    logger.error('Failed to hangup call:', error)
    return false
  }
}

/**
 * 拒绝通话
 */
export async function rejectCall(roomId: string, callId: string): Promise<boolean> {
  try {
    const rejectContent: RejectContent = {
      call_id: callId,
      version: 1,
      reason: 'user_rejected'
    }

    const success = await sendMatrixRtcSignal(roomId, 'reject', rejectContent)

    if (success) {
    }

    return success
  } catch (error) {
    logger.error('Failed to reject call:', error)
    return false
  }
}

/**
 * 发送ICE候选
 */
export async function sendIceCandidates(
  roomId: string,
  callId: string,
  candidates: RTCIceCandidateInit[]
): Promise<boolean> {
  try {
    const candidatesContent: CandidatesContent = {
      call_id: callId,
      version: 1,
      candidates: candidates.map((candidate): IceCandidateBase => {
        const base: IceCandidateBase = { candidate: candidate.candidate || '' }
        if (candidate.sdpMLineIndex !== null && candidate.sdpMLineIndex !== undefined)
          base.sdpMLineIndex = candidate.sdpMLineIndex
        if (candidate.sdpMid !== null && candidate.sdpMid !== undefined) base.sdpMid = candidate.sdpMid
        return base
      })
    }

    const success = await sendMatrixRtcSignal(roomId, 'candidate', candidatesContent)

    if (success) {
    }

    return success
  } catch (error) {
    logger.error('Failed to send ICE candidates:', error)
    return false
  }
}

/**
 * 切换静音状态
 */
export function toggleAudioMute(stream?: MediaStream): boolean {
  try {
    const targetStream = stream || getCurrentLocalStream()
    if (!targetStream) return false

    const audioTracks = targetStream.getAudioTracks()
    if (audioTracks.length === 0) return false
    const track = audioTracks[0]
    if (!track) return false
    track.enabled = !track.enabled
    return track.enabled
  } catch (error) {
    logger.error('Failed to toggle audio mute:', error)
    return false
  }
}

/**
 * 切换视频状态
 */
export function toggleVideoMute(stream?: MediaStream): boolean {
  try {
    const targetStream = stream || getCurrentLocalStream()
    if (!targetStream) return false

    const videoTracks = targetStream.getVideoTracks()
    if (videoTracks.length === 0) return false
    const track = videoTracks[0]
    if (!track) return false
    track.enabled = !track.enabled
    return track.enabled
  } catch (error) {
    logger.error('Failed to toggle video mute:', error)
    return false
  }
}

/**
 * 开始屏幕共享
 */
export async function startScreenShare(): Promise<MediaStream | null> {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    })

    return screenStream
  } catch (error) {
    logger.error('Failed to start screen share:', error)
    return null
  }
}

/**
 * 停止屏幕共享
 */
export function stopScreenShare(stream: MediaStream): void {
  try {
    stream.getTracks().forEach((track) => track.stop())
  } catch (error) {
    logger.error('Failed to stop screen share:', error)
  }
}

/**
 * 获取通话统计信息
 */
export async function getCallStats(peerConnection: RTCPeerConnection): Promise<CallStats | null> {
  try {
    const stats = await peerConnection.getStats()
    let bytesReceived = 0
    let bytesSent = 0
    let packetsReceived = 0
    let packetsSent = 0
    let audioLevel = 0

    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
        bytesReceived += report.bytesReceived || 0
        packetsReceived += report.packetsReceived || 0
      } else if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
        bytesSent += report.bytesSent || 0
        packetsSent += report.packetsSent || 0
      } else if (report.type === 'track' && report.kind === 'audio') {
        audioLevel = report.audioLevel || 0
      }
    })

    return {
      roomId: '',
      callId: '',
      duration: 0,
      state: 'connected',
      localCandidates: 0,
      remoteCandidates: 0,
      bytesReceived,
      bytesSent,
      packetsReceived,
      packetsSent,
      audioLevel
    }
  } catch (error) {
    logger.error('Failed to get call stats:', error)
    return null
  }
}

/**
 * 设置Matrix RTC桥接
 */
export function setupMatrixRtcBridge(
  onSignal?: (type: MatrixCallSignalType, content: MatrixRtcPayload, roomId: string) => void,
  onCallEvent?: (event: MatrixCallEvent) => void
): void {
  const client = matrixClientService.getClient() as MatrixClientExtended | null
  if (!client) return

  const rtc = useRtcStore()

  const handler = (...args: unknown[]) => {
    const event = args[0] as MatrixEventLike
    const room = args[1] as MatrixRoomLike | undefined
    const toStartOfTimeline = args[2] as boolean | undefined

    if (toStartOfTimeline) return

    const type = event.getType?.() || ''
    if (!type?.startsWith('m.call.')) return

    const raw = event.getContent?.() || {}
    const content: MatrixRtcPayload = raw as MatrixRtcPayload
    const sender = event.getSender?.() || ''
    const roomId = room?.roomId || event.getRoomId?.() || ''
    const timestamp = event.getTs?.() || Date.now()

    const signalType = type.replace('m.call.', '') as MatrixCallSignalType
    const callEvent: MatrixCallEvent = {
      type: signalType as 'invite' | 'answer' | 'hangup' | 'reject' | 'select_answer' | 'candidates',
      content,
      sender,
      roomId,
      timestamp
    }

    // 处理不同的通话事件
    switch (type) {
      case 'm.call.invite': {
        const inviteContent = content as InviteContent
        const isVideo = !!inviteContent?.offer?.sdp?.includes?.('m=video')
        rtc.setIncoming(roomId, sender, isVideo ? 'video' : 'audio')
        break
      }

      case 'm.call.answer':
        rtc.setOngoing(roomId)
        break

      case 'm.call.hangup':
        rtc.setEnded(roomId)
        break

      case 'm.call.reject':
        rtc.setEnded(roomId)
        break
    }

    // 调用回调函数
    if (onSignal) onSignal(signalType, content, roomId)

    if (onCallEvent) {
      onCallEvent(callEvent)
    }
  }

  client.on('Room.timeline', handler)
}

/**
 * 生成通话ID
 */
function generateCallId(): string {
  return Math.random().toString(36).substr(2, 9)
}

/**
 * 获取当前本地媒体流
 */
function getCurrentLocalStream(): MediaStream | null {
  // 这里应该从RTC store或全局状态中获取当前的本地流
  // 实际实现需要根据项目的状态管理来调整
  return null
}

function createPeerConnection(): RTCPeerConnection {
  try {
    const globalRTC = globalThis as typeof globalThis & GlobalThisWithRTC
    return new (globalRTC.RTCPeerConnection || RTCPeerConnection)()
  } catch {
    return new RTCPeerConnection()
  }
}

/**
 * 设置WebRTC通话功能（如果启用）
 */
export function setupRtcIfEnabled(): void {
  if (!flags.matrixRtcEnabled || !flags.matrixEnabled) {
    return
  }

  try {
    // 设置RTC桥接
    setupMatrixRtcBridge(
      () => {},
      (event) => handleRtcCallEvent(event)
    )
  } catch (error) {
    logger.error('Failed to setup WebRTC bridge:', error)
  }
}

/**
 * 检查WebRTC支持
 */
export function checkWebRtcSupport(): boolean {
  try {
    return (
      typeof RTCPeerConnection !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices !== 'undefined' &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    )
  } catch {
    return false
  }
}
