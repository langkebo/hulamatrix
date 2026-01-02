import { logger } from '@/utils/logger'
import { TIME_INTERVALS } from '@/constants'
import { computed, nextTick, onMounted, onUnmounted, ref, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { error, info } from '@tauri-apps/plugin-log'
import { CallTypeEnum, RTCCallStatus } from '@/enums'
import rustWebSocketClient from '@/services/webSocketRust'
import { sendMatrixRtcSignal } from '@/integrations/matrix/rtc'
import { useUserStore } from '@/stores/user'
import { useRtcStore } from '@/stores/rtc'
import { WsRequestMsgType, WsResponseMessageType } from '../services/wsType'
import { isMobile } from '../utils/PlatformConstants'
import { useMitt } from './useMitt'
import { useTauriListener } from './useTauriListener'
import { getTurnServer } from '@/integrations/matrix/voip'
import { flags } from '@/utils/envFlags'
import { composeRTCConfiguration } from '@/integrations/matrix/rtcIce'
import { msg } from '@/utils/SafeUI'
import { useI18nGlobal } from '@/services/i18n'
import type { MatrixRtcPayload } from '@/types/matrix'

// Tauri事件类型定义
interface TauriEvent<T = unknown> {
  payload: T
}

/** WebSocket RTC 信号消息 */
interface WSRtcSignalMessage {
  type: WsRequestMsgType.WEBRTC_SIGNAL
  data: {
    roomId: string
    signal: string
    signalType: string
    targetUid: string
    video?: boolean
    mediaType?: string
  }
}

// 定义具体的载荷类型
interface WsRtcSignalPayload {
  roomId: string
  signalType: string
  signal: string
  targetUid: string
  video: boolean
  callerUid: string
}

interface WsCallAcceptedPayload {
  roomId: string
  callerUid: string
  accepted: boolean
}

interface WsRoomClosedPayload {
  roomId: string
  reason?: string
}

interface WsCallRejectedPayload {
  roomId: string
  callerUid: string
  rejected: boolean
}

interface WsCancelPayload {
  roomId: string
  callerUid: string
}

interface WsTimeoutPayload {
  roomId: string
  callerUid: string
}

interface RtcMsgVO {
  roomId: string
  callType: CallTypeEnum
  callerId: string
  uidList?: string[]
  [key: string]: unknown
}

// 信令类型枚举
export enum SignalTypeEnum {
  JOIN = 'join',
  OFFER = 'offer',
  ANSWER = 'answer',
  CANDIDATE = 'candidate',
  LEAVE = 'leave'
}

export interface WSRtcCallMsg {
  // 房间ID
  roomId: string
  // 通话ID
  callerId: string
  // 信令类型
  signalType: SignalTypeEnum
  // 信令
  signal: string
  // 接收者ID列表
  receiverIds: string[]
  // 发送者ID
  senderId?: string
  // 通话状态
  status: RTCCallStatus
  // 是否是视频通话
  video: boolean
  // 目标uid
  targetUid: string
}

// const TURN_SERVER = import.meta.env.VITE_TURN_SERVER_URL
const MAX_TIME_OUT_SECONDS = 30
const MAX_RETRY = 2
let retryCount = 0
let configuration: RTCConfiguration = { iceServers: [], iceTransportPolicy: 'all' }
const fallbackIce: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]
async function ensureRtcConfig() {
  try {
    if (flags.matrixEnabled && flags.matrixRtcEnabled) {
      const turn = await getTurnServer()
      configuration = composeRTCConfiguration(turn, fallbackIce)
      return
    }
  } catch {}
  configuration = composeRTCConfiguration(null, fallbackIce)
}

// const settings = await getSettings()
// configuration.iceServers?.push(settings.ice_server)
// const isSupportScreenSharing = !!navigator?.mediaDevices?.getDisplayMedia

/**
 * RTC 通话铃声 URL
 * 从环境变量读取，支持自定义铃声文件路径
 * 默认值: '/sound/hula_bell.mp3'
 */
const rtcCallBellUrl = import.meta.env.VITE_RTC_CALL_BELL_URL || '/sound/hula_bell.mp3'

/**
 * webrtc 相关
 * @returns rtc 相关的状态和方法
 */
export const useWebRtc = (roomId: string, remoteUserId: string, callType: CallTypeEnum, isReceiver: boolean) => {
  const { addListener } = useTauriListener()

  const router = useRouter()
  const userStore = useUserStore()
  const rtcStore = useRtcStore()

  info(`useWebRtc, roomId: ${roomId}, remoteUserId: ${remoteUserId}, callType: ${callType}, isReceiver: ${isReceiver}`)
  const rtcMsg = ref<RtcMsgVO>({
    roomId: roomId,
    callType: callType,
    callerId: userStore.userInfo!.uid
  })

  // 设备相关状态
  const audioDevices = ref<MediaDeviceInfo[]>([])
  const videoDevices = ref<MediaDeviceInfo[]>([])
  const selectedAudioDevice = computed({
    get: () => rtcStore.selectedAudioId,
    set: (v) => rtcStore.setAudioDevice(String(v || ''))
  }) as unknown as Ref<string | null | undefined>
  const selectedVideoDevice = computed({
    get: () => rtcStore.selectedVideoId,
    set: (v) => rtcStore.setVideoDevice(String(v || ''))
  }) as unknown as Ref<string | null | undefined>

  // 状态
  const connectionStatus = ref<RTCCallStatus | undefined>(undefined)
  const isDeviceLoad = ref(false)
  const isLinker = ref(false) // 判断是否是 webrtc 连接的参与者

  // rtc状态
  const rtcStatus = ref<RTCPeerConnectionState | undefined>(undefined)
  // const isRtcConnecting = computed(() => rtcStatus.value === 'connecting')
  // 流相关状态
  const localStream = ref<MediaStream | null>(null)
  const remoteStream = ref<MediaStream | null>(null)
  // WebRTC 连接对象
  const peerConnection = ref<RTCPeerConnection | null>(null)
  const channel = ref<RTCDataChannel | null>(null)
  const channelStatus = ref<RTCDataChannelState | undefined>(undefined)
  // 待发送ice列表
  const pendingCandidates = ref<RTCIceCandidate[]>([])
  // 添加铃声相关状态
  const bellAudio = ref<HTMLAudioElement | null>(null)

  // 添加计时器引用
  const callTimer = ref<NodeJS.Timeout | null>(null)

  // 添加计时相关的变量
  const callDuration = ref(0)
  const animationFrameId = ref<number | null>(null)
  const startTime = ref<number>(0)

  // 添加桌面共享相关状态
  const isScreenSharing = ref(false)
  const offer = ref<RTCSessionDescriptionInit>()

  // 接通后确保窗口聚焦显示
  const focusCurrentWindow = async () => {
    try {
      const currentWindow = getCurrentWebviewWindow()
      const visible = await currentWindow.isVisible()
      if (!visible) {
        await currentWindow.show()
      }
      const minimized = await currentWindow.isMinimized()
      if (minimized) {
        await currentWindow.unminimize()
      }
      await currentWindow.setFocus()
    } catch (e) {
      logger.warn('设置窗口聚焦失败:', e, 'useWebRtc')
    }
  }

  // 开始计时
  const startCallTimer = () => {
    // 获取高精度时间戳
    startTime.value = performance.now()
    const animate = (currentTime: number) => {
      // 计算已经过去的秒数
      const elapsed = Math.floor((currentTime - startTime.value) / 1000)
      callDuration.value = elapsed
      // 递归调用，形成动画循环
      animationFrameId.value = requestAnimationFrame(animate)
    }
    animationFrameId.value = requestAnimationFrame(animate) // 启动动画循环
  }

  // 停止计时
  const stopCallTimer = () => {
    if (animationFrameId.value) {
      cancelAnimationFrame(animationFrameId.value)
      animationFrameId.value = null
    }
    callDuration.value = 0
    startTime.value = 0
  }

  /**
   * 打开铃声
   */
  const startBell = () => {
    if (!rtcCallBellUrl) {
      bellAudio.value = null
      return
    }
    bellAudio.value = new Audio(rtcCallBellUrl)
    bellAudio.value!.loop = true
    bellAudio.value?.play?.()
  }

  /**
   * 发送通话请求
   */
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
  const sendCall = async () => {
    try {
      if (isTauri) {
        await rustWebSocketClient.sendMessage({
          type: WsRequestMsgType.VIDEO_CALL_REQUEST,
          data: {
            roomId: roomId,
            targetUid: remoteUserId,
            isVideo: callType === CallTypeEnum.VIDEO
          }
        })
      } else {
        const offerData = {
          call_id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          lifetime: 60000,
          version: 1,
          offer: { sdp: '', type: 'offer' } as RTCSessionDescriptionInit
        }
        await sendMatrixRtcSignal(roomId, 'offer', offerData as unknown as MatrixRtcPayload)
      }
    } catch (error) {
      logger.error('发送通话请求失败:', { error, component: 'useWebRtc' })
    }
  }

  /**
   * 关闭铃声
   */
  const stopBell = () => {
    bellAudio.value?.pause?.()
    bellAudio.value = null
  }

  const pauseBell = () => {
    bellAudio.value?.pause?.()
  }

  const playBell = () => {
    bellAudio.value?.play?.()
  }

  /**
   * 接听电话响应事件
   */
  const handleCallResponse = async (status: number) => {
    try {
      info('[收到通知] 接听电话响应事件')
      // 发送挂断消息
      sendRtcCall2VideoCallResponse(status)
      await endCall()
    } finally {
      clear()
    }
  }

  /**
   * 结束通话
   */
  const endCall = async () => {
    try {
      info('[收到通知] 结束通话')
      // 移动端router 回退
      if (!isMobile()) {
        await getCurrentWebviewWindow().close()
      } else {
        router.back()
      }
    } finally {
      clear()
    }
  }

  // 发送 ws 请求，通知双方通话状态
  // -1 = 超时 0 = 拒绝 1 = 接通 2 = 挂断
  const sendRtcCall2VideoCallResponse = async (status: number) => {
    try {
      info(`发送 ws 请求，通知双方通话状态 ${status}`)
      await rustWebSocketClient.sendMessage({
        type: WsRequestMsgType.VIDEO_CALL_RESPONSE,
        data: {
          callerUid: remoteUserId,
          roomId: roomId,
          accepted: status
        }
      })
    } catch (error) {
      logger.error('发送通话响应失败:', { error, component: 'useWebRtc' })
    }
  }

  // 获取设备列表
  const getDevices = async () => {
    try {
      info('start getDevices')
      isDeviceLoad.value = true

      // 先请求权限以获取完整的设备信息
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        stream.getTracks().forEach((track) => track.stop()) // 立即停止流
      } catch (_permissionError) {
        error('Permission denied, will get limited device info')
      }

      const devices = (await navigator.mediaDevices.enumerateDevices()) || []
      info(`getDevices, devices: ${JSON.stringify(devices)}`)
      if (devices.length === 0) {
        return false
      }
      audioDevices.value = devices.filter((device) => device.kind === 'audioinput')
      videoDevices.value = devices.filter((device) => device.kind === 'videoinput')
      // 默认选择 “default” | "第一个" 设备
      const defaultAudio =
        audioDevices.value.find((device) => device.deviceId === 'default')?.deviceId ||
        audioDevices.value?.[0]?.deviceId
      const defaultVideo =
        videoDevices.value.find((device) => device.deviceId === 'default')?.deviceId ||
        videoDevices.value?.[0]?.deviceId
      if (defaultAudio) rtcStore.setAudioDevice(defaultAudio)
      if (defaultVideo) rtcStore.setVideoDevice(defaultVideo)
      // 使用方法更新设备列表（如果 rtcStore 有这些方法）
      const rtcStoreLike = rtcStore as unknown as {
        audioDevices?: Ref<MediaDeviceInfo[]>
        videoDevices?: Ref<MediaDeviceInfo[]>
      }
      if (rtcStoreLike.audioDevices) rtcStoreLike.audioDevices.value = audioDevices.value
      if (rtcStoreLike.videoDevices) rtcStoreLike.videoDevices.value = videoDevices.value
      isDeviceLoad.value = false
      return true
    } catch (err) {
      msg.error?.('获取设备失败!')
      error(`获取设备失败: ${err}`)
      // 默认没有设备
      selectedAudioDevice.value = selectedAudioDevice.value || null
      selectedVideoDevice.value = selectedVideoDevice.value || null
      isDeviceLoad.value = false
      return false
    }
  }

  // 获取本地媒体流
  const getLocalStream = async (type: CallTypeEnum) => {
    try {
      info('获取本地媒体流')
      const constraints: MediaStreamConstraints = {}
      if (audioDevices.value.length > 0) {
        const a: MediaTrackConstraints = {}
        if (selectedAudioDevice.value) a.deviceId = { exact: selectedAudioDevice.value }
        constraints.audio = a
      } else {
        constraints.audio = false
      }
      if (type === CallTypeEnum.VIDEO && videoDevices.value.length > 0) {
        const v: MediaTrackConstraints = {}
        if (selectedVideoDevice.value) v.deviceId = { exact: selectedVideoDevice.value }
        constraints.video = v
      } else {
        constraints.video = false
      }
      if (!constraints.audio && !constraints.video) {
        msg.error('没有可用的设备!')
        // 没有可用设备时自动挂断并关闭窗口
        setTimeout(async () => {
          if (isReceiver) {
            // 接听方：发送拒绝响应
            await handleCallResponse(0)
          } else {
            // 发起方：直接结束通话
            await handleCallResponse(2)
          }
        }, 1000)
        return false
      }
      localStream.value = await navigator.mediaDevices.getUserMedia(constraints)
      // 打印 localStream 的信息（不能直接序列号 stream，不然会返回null）
      info(`get localStream success`)
      info(`localStream.id: ${localStream.value?.id}`)
      info(`localStream.active: ${localStream.value?.active}`)
      info(`localStream.getTracks().length: ${localStream.value?.getTracks()?.length}`)
      // 打印每个轨道的信息
      localStream.value?.getTracks()?.forEach((track, index) => {
        info(`Track ${index}: kind=${track.kind}, label=${track.label}, enabled=${track.enabled}`)
      })

      const audioTrack = localStream.value.getAudioTracks()[0]
      if (audioTrack) {
        // 检查音频轨道是否真的在工作
        info(`Audio track enabled: ${audioTrack.enabled}`)
        info(`Audio track muted: ${audioTrack.muted}`)
        info(`Audio track readyState: ${audioTrack.readyState}`)

        // 强制启用音频轨道
        audioTrack.enabled = true
      }

      return true
    } catch (err) {
      logger.error('获取本地流失败:', { err, component: 'useWebRtc' })
      msg.error('获取本地媒体流失败，请检查设备!')
      error(`获取本地媒体流失败，请检查设备! ${err}`)
      await sendRtcCall2VideoCallResponse(2)
      return false
    }
  }

  // 创建 RTCPeerConnection
  const createPeerConnection = async (roomId: string) => {
    try {
      await ensureRtcConfig()
      const pc = new RTCPeerConnection(configuration)

      // 监听远程流
      pc.ontrack = (event) => {
        info('pc 监听到 ontrack 事件')
        if (event.streams[0]) {
          remoteStream.value = event.streams[0]
        } else {
          remoteStream.value = null
        }
      }

      // 添加本地流
      info('添加本地流到 PC')
      if (localStream.value) {
        localStream.value.getTracks().forEach((track) => {
          localStream.value && pc.addTrack(track, localStream.value)
        })
      } else {
        logger.warn('localStream 为 null，无法添加本地流到 PeerConnection', { component: 'useWebRtc' })
      }

      // 连接状态变化 "closed" | "connected" | "connecting" | "disconnected" | "failed" | "new";
      pc.onconnectionstatechange = (_e) => {
        info(`RTC 连接状态变化: ${pc.connectionState}`)
        switch (pc.connectionState) {
          case 'new':
            info('RTC 连接新建')
            break
          case 'connecting':
            info('RTC 连接中')
            connectionStatus.value = RTCCallStatus.CALLING
            break
          case 'connected':
            info('RTC 连接成功')
            connectionStatus.value = RTCCallStatus.ACCEPT
            startCallTimer() // 开始计时
            // 接通后将窗口置顶展示并聚焦
            void focusCurrentWindow()
            break
          case 'disconnected':
            info('RTC 连接断开')
            connectionStatus.value = RTCCallStatus.END
            if (retryCount < MAX_RETRY) {
              retryCount++
              void retryConnect(roomId)
            } else {
              msg.error('RTC通讯连接失败!')
              setTimeout(async () => {
                await endCall()
              }, 500)
            }
            break
          case 'closed':
            info('RTC 连接关闭')
            connectionStatus.value = RTCCallStatus.END
            setTimeout(async () => {
              await endCall()
            }, 500)
            break
          case 'failed':
            connectionStatus.value = RTCCallStatus.ERROR
            info('RTC 连接失败')
            if (retryCount < MAX_RETRY) {
              retryCount++
              void retryConnect(roomId)
            } else {
              msg.error('RTC通讯连接失败!')
              setTimeout(async () => {
                await endCall()
              }, 500)
            }
            break
          default:
            info('RTC 连接状态变化: ', pc.connectionState)
            break
        }
        rtcStatus.value = pc.connectionState
      }
      // 创建信道
      channel.value = pc.createDataChannel('chat')
      channel.value.onopen = () => {
        // logger.debug("信道已打开", { component: 'useWebRtc' });
      }
      channel.value.onmessage = (_event) => {}
      channel.value.onerror = (event) => {
        logger.warn('信道出错:', { event, component: 'useWebRtc' })
      }
      channel.value.onclose = () => {
        // logger.debug("信道已关闭", { component: 'useWebRtc' });
      }
      pc.onicecandidate = async (event) => {
        info('pc 监听到 onicecandidate 事件')
        if (event.candidate && roomId) {
          try {
            pendingCandidates.value.push(event.candidate)
          } catch (err) {
            logger.error('发送ICE候选者出错:', { error: err, component: 'useWebRtc' })
          }
        }
      }
      peerConnection.value = pc
    } catch (err) {
      logger.error('创建 PeerConnection 失败:', { error: err, component: 'useWebRtc' })
      connectionStatus.value = RTCCallStatus.ERROR
      throw err
    }
  }

  // 发起通话
  const startCall = async (roomId: string, type: CallTypeEnum, uidList?: string[]) => {
    try {
      if (!roomId) {
        return false
      }
      clear() // 清理资源
      if (!(await getDevices())) {
        msg.error('获取设备失败!')
        // 获取设备失败时自动关闭窗口
        setTimeout(async () => {
          await handleCallResponse(0)
        }, 1000)
        return false
      }
      // 保存通话信息
      rtcMsg.value = {
        roomId,
        callType: type,
        callerId: userStore.userInfo!.uid,
        uidList: uidList || []
      }
      isLinker.value = true // 标记是会话人
      // 设置30秒超时定时器
      callTimer.value = setTimeout(() => {
        if (connectionStatus.value === RTCCallStatus.CALLING) {
          msg.warning('通话无人接听，自动挂断')
          endCall()
        }
      }, MAX_TIME_OUT_SECONDS * 1000)

      if (!(await getLocalStream(type))) {
        clear()
        // 获取本地媒体流失败时自动关闭窗口
        setTimeout(async () => {
          await endCall()
        }, 1000)
        return false
      }

      // 1. 创建 RTCPeerConnection
      await createPeerConnection(roomId)
      // 创建并发送 offer
      const rtcOffer = await peerConnection.value!.createOffer()
      offer.value = rtcOffer
      await peerConnection.value!.setLocalDescription(rtcOffer)
      // 发起通话请求
      await sendCall()
      // 播放铃声
      startBell()

      // 开始通话
      connectionStatus.value = RTCCallStatus.CALLING
      rtcStatus.value = 'new'
      return true
    } catch (err) {
      logger.error('开始通话失败:', { error: err, component: 'useWebRtc' })
      msg.error('RTC通讯连接失败!')
      clear()
      return false
    }
  }

  // 发送SDP offer
  const sendOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      const signalData = {
        callerUid: userStore.userInfo!.uid,
        roomId: roomId,
        signal: JSON.stringify(offer),
        signalType: 'offer',
        targetUid: remoteUserId,
        video: callType === CallTypeEnum.VIDEO
      }

      info('ws发送 offer')
      if (isTauri) {
        const wsMsg: WSRtcSignalMessage = {
          type: WsRequestMsgType.WEBRTC_SIGNAL,
          data: signalData
        }
        await rustWebSocketClient.sendMessage(wsMsg as unknown)
      } else {
        await sendMatrixRtcSignal(roomId, 'offer', signalData as unknown as MatrixRtcPayload)
      }
    } catch (error) {
      logger.error('Failed to send SDP offer:', { error: error, component: 'useWebRtc' })
    }
  }

  const retryConnect = async (rid: string) => {
    try {
      await createPeerConnection(rid)
      if (localStream.value) {
        localStream.value.getTracks().forEach((track) => {
          localStream.value && peerConnection.value?.addTrack(track, localStream.value)
        })
      }
      const rtcOffer = await peerConnection.value!.createOffer()
      offer.value = rtcOffer
      await peerConnection.value!.setLocalDescription(rtcOffer)
      await sendCall()
    } catch {}
  }

  const clear = () => {
    try {
      // 停止铃声并重置
      stopBell()
      // 清除超时定时器
      if (callTimer.value) {
        clearTimeout(callTimer.value)
        callTimer.value = null
      }
      // 停止计时器
      stopCallTimer()
      // 关闭信道
      channel.value?.close?.()
      // 关闭连接
      peerConnection.value?.close?.()
      // 关闭媒体流
      localStream.value?.getTracks().forEach((track) => track.stop())
      remoteStream.value?.getTracks().forEach((track) => track.stop())
    } catch (error) {
      msg.error('部分资源清理失败!')
      logger.error('清理资源失败:', { error: error, component: 'useWebRtc' })
      return
    } finally {
      // 重置状态
      rtcMsg.value = {
        roomId: '',
        callType: 0 as CallTypeEnum,
        callerId: '',
        uidList: []
      }
      pendingCandidates.value = []
      audioDevices.value = []
      videoDevices.value = []
      selectedAudioDevice.value = null
      selectedVideoDevice.value = null
      localStream.value = null
      remoteStream.value = null
      connectionStatus.value = undefined
      rtcStatus.value = undefined
      isScreenSharing.value = false
      isLinker.value = false
      // 关闭连接
      peerConnection.value = null
      channel.value = null
      channelStatus.value = undefined
    }
  }

  // 发送ICE候选者
  const sendIceCandidate = async (candidate: RTCIceCandidate) => {
    try {
      info('发送ICE候选者')
      const signalData = {
        roomId: roomId,
        signal: JSON.stringify(candidate),
        signalType: 'candidate',
        targetUid: remoteUserId,
        mediaType: callType === CallTypeEnum.VIDEO ? 'VideoSignal' : 'AudioSignal'
      }

      if (isTauri) {
        const wsMsg: WSRtcSignalMessage = {
          type: WsRequestMsgType.WEBRTC_SIGNAL,
          data: signalData
        }
        await rustWebSocketClient.sendMessage(wsMsg as unknown)
      } else {
        await sendMatrixRtcSignal(roomId, 'candidate', signalData as unknown as MatrixRtcPayload)
      }
    } catch (error) {
      logger.error('Failed to send ICE candidate:', { error: error, component: 'useWebRtc' })
    }
  }

  // 处理收到的 offer - 接听者
  const handleOffer = async (signal: RTCSessionDescriptionInit, video: boolean, roomId: string) => {
    try {
      connectionStatus.value = RTCCallStatus.CALLING
      await nextTick()

      await getDevices()
      const hasLocalStream = await getLocalStream(video ? CallTypeEnum.VIDEO : CallTypeEnum.AUDIO)

      // 停止铃声
      stopBell()

      // 检查本地媒体流是否获取成功
      if (!hasLocalStream || !localStream.value) {
        // 睡眠 3s
        await new Promise<void>((resolve) => setTimeout(resolve, TIME_INTERVALS.TOAST_DURATION))
        await handleCallResponse(0)
        return false
      }

      // 2. 创建 RTCPeerConnection
      await nextTick() // 等待一帧
      await createPeerConnection(roomId)
      rtcStatus.value = 'new'

      // 3. 设置远程描述
      info('设置远程描述')
      await peerConnection.value!.setRemoteDescription(signal)

      // 4. 创建并发送 answer
      const answer = await peerConnection.value!.createAnswer()
      await peerConnection.value!.setLocalDescription(answer)

      if (!roomId) {
        msg.error('房间号不存在，请重新连接！')
        return false
      }

      isLinker.value = true // 标记是会话人
      // 6. 发送 answer 信令到远端
      await sendAnswer(answer)
      connectionStatus.value = RTCCallStatus.ACCEPT
      info('处理 offer 结束')
      return true
    } catch (e) {
      error(`处理 offer 失败: ${e}`)
      await endCall()
      return false
    }
  }

  // 发送SDP answer
  const sendAnswer = async (answer: RTCSessionDescriptionInit) => {
    try {
      const signalData = {
        callerUid: userStore.userInfo!.uid,
        roomId: roomId,
        signal: JSON.stringify(answer),
        signalType: SignalTypeEnum.ANSWER,
        targetUid: remoteUserId,
        video: callType === CallTypeEnum.VIDEO
      }

      logger.debug('发送SDP answer:', { data: signalData, component: 'useWebRtc' })
      if (isTauri) {
        const wsMsg: WSRtcSignalMessage = {
          type: WsRequestMsgType.WEBRTC_SIGNAL,
          data: signalData
        }
        await rustWebSocketClient.sendMessage(wsMsg as unknown)
      } else {
        await sendMatrixRtcSignal(roomId, 'answer', signalData as unknown as MatrixRtcPayload)
      }

      logger.debug('SDP answer sent via WebSocket::', { data: answer, component: 'useWebRtc' })
    } catch (error) {
      logger.error('Failed to send SDP answer:', { error: error, component: 'useWebRtc' })
    }
  }

  const handleAnswer = async (answer: RTCSessionDescriptionInit, roomId: string) => {
    try {
      info('处理 answer 消息')
      if (peerConnection.value) {
        // 清除超时定时器
        if (callTimer.value) {
          clearTimeout(callTimer.value)
          callTimer.value = null
        }

        // 2. 停止铃声
        stopBell()

        // 3. 通知服务器通话已建立
        if (!isReceiver) {
          if (!roomId) {
            msg.error('房间号不存在，请重新连接！')
            await endCall()
            return
          }
          // 4. 发起者 - 设置远程描述
          logger.debug('发起者 - 设置远程描述:', { data: answer, component: 'useWebRtc' })
          await peerConnection.value.setRemoteDescription(answer)
        }
      }
    } catch (error) {
      logger.error('处理 answer 失败:', { error: error, component: 'useWebRtc' })
      connectionStatus.value = RTCCallStatus.ERROR
      await endCall()
    }
  }

  // 处理 ICE candidate
  const handleCandidate = async (signal: RTCIceCandidateInit) => {
    try {
      if (peerConnection.value && peerConnection.value.remoteDescription) {
        info('添加 candidate')
        await peerConnection.value!.addIceCandidate(signal)
      }
    } catch (error) {
      logger.error('处理 candidate 失败:', { error: error, component: 'useWebRtc' })
    }
  }

  // 视频轨道状态
  const isVideoEnabled = ref(callType === CallTypeEnum.VIDEO)

  // 切换静音
  const toggleMute = () => {
    if (localStream.value) {
      const audioTrack = localStream.value.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
      }
    }
  }

  // 切换视频
  const toggleVideo = async () => {
    if (localStream.value) {
      const videoTrack = localStream.value.getVideoTracks()[0]
      if (videoTrack) {
        // 切换视频轨道的启用状态
        videoTrack.enabled = !videoTrack.enabled
        isVideoEnabled.value = videoTrack.enabled

        // 如果是关闭视频，通知对方
        if (!videoTrack.enabled) {
          logger.debug('本地视频已关闭，对方将看不到视频', 'useWebRtc')
        } else {
          logger.debug('本地视频已开启，对方可以看到视频', 'useWebRtc')
        }
      } else if (callType === CallTypeEnum.VIDEO) {
        // 如果没有视频轨道但是视频通话，尝试重新获取
        try {
          const constraints: MediaStreamConstraints = { audio: false }
          if (videoDevices.value.length > 0) {
            const v: MediaTrackConstraints = {}
            if (selectedVideoDevice.value) v.deviceId = { exact: selectedVideoDevice.value }
            constraints.video = v
          } else {
            constraints.video = true
          }

          const newStream = await navigator.mediaDevices.getUserMedia(constraints)
          const newVideoTrack = newStream.getVideoTracks()[0]

          if (newVideoTrack && peerConnection.value) {
            // 添加新的视频轨道
            peerConnection.value.addTrack(newVideoTrack, localStream.value!)
            localStream.value!.addTrack(newVideoTrack)
            isVideoEnabled.value = true

            logger.debug('重新获取视频轨道成功', 'useWebRtc')
          }
        } catch (error) {
          logger.error('重新获取视频轨道失败:', { error: error, component: 'useWebRtc' })
          msg.error('无法开启摄像头')
        }
      }
    }
  }

  // 切换音频设备
  const switchAudioDevice = async (deviceId: string) => {
    try {
      selectedAudioDevice.value = deviceId
      if (localStream.value) {
        const newStream = await navigator?.mediaDevices?.getUserMedia({
          audio: { deviceId: { exact: deviceId } },
          video:
            rtcMsg.value.callType === CallTypeEnum.VIDEO
              ? selectedVideoDevice.value
                ? { deviceId: { exact: selectedVideoDevice.value } }
                : false
              : false
        } as MediaStreamConstraints)
        // 替换现有轨道
        const newAudioTrack = newStream.getAudioTracks()[0]
        const oldAudioTrack = localStream.value.getAudioTracks()[0]

        if (newAudioTrack) {
          if (!oldAudioTrack) {
            localStream.value.addTrack(newAudioTrack)
            peerConnection.value?.addTrack(newAudioTrack, localStream.value)
            return
          }
          peerConnection.value?.getSenders().forEach((sender) => {
            if (sender.track && sender.track.kind === 'audio') {
              sender?.replaceTrack?.(newAudioTrack)
            }
          })
          oldAudioTrack && localStream.value.removeTrack(oldAudioTrack)
          localStream.value.addTrack(newAudioTrack)
        } else {
          msg.error('切换设备不存在或不支持，请重新选择！')
        }
      }
    } catch (error) {
      msg.error('切换音频设备失败！')
      logger.error('切换音频设备失败:', { error: error, component: 'useWebRtc' })
    }
    return
  }

  // 获取前置和后置摄像头设备
  const getFrontAndBackCameras = () => {
    const frontCamera = videoDevices.value.find(
      (device) =>
        device.label.toLowerCase().includes('front') ||
        device.label.toLowerCase().includes('前置') ||
        device.label.toLowerCase().includes('user')
    )

    const backCamera = videoDevices.value.find(
      (device) =>
        device.label.toLowerCase().includes('back') ||
        device.label.toLowerCase().includes('后置') ||
        device.label.toLowerCase().includes('environment') ||
        device.label.toLowerCase().includes('rear')
    )

    return { frontCamera, backCamera }
  }

  // 切换前置/后置摄像头（移动端专用）
  const switchCameraFacing = async (): Promise<void> => {
    if (!isMobile()) {
      logger.warn('摄像头翻转功能仅在移动端可用', 'useWebRtc')
      return
    }

    try {
      const { frontCamera, backCamera } = getFrontAndBackCameras()

      if (!frontCamera || !backCamera) {
        // 如果无法通过设备名称识别，则使用 facingMode 约束
        await switchVideoDevice('user')
        return
      }

      // 如果能识别前置和后置摄像头，直接切换
      const currentDevice = selectedVideoDevice.value
      const targetDevice = currentDevice === frontCamera.deviceId ? backCamera : frontCamera
      await switchVideoDevice(targetDevice.deviceId)
    } catch (error) {
      msg.error('摄像头翻转失败！')
      logger.error('摄像头翻转失败:', { error: error, component: 'useWebRtc' })
    }
  }

  // 切换视频设备
  const switchVideoDevice = async (deviceId: string) => {
    try {
      // 前置校验
      selectedVideoDevice.value = deviceId
      if (localStream.value && localStream.value.getVideoTracks().length > 0) {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: selectedAudioDevice.value ? { deviceId: { exact: selectedAudioDevice.value ?? undefined } } : false,
          video: { deviceId: { exact: deviceId } }
        })

        // 替换现有轨道
        const newVideoTrack = newStream.getVideoTracks()[0]
        const oldVideoTrack = localStream.value.getVideoTracks()[0]
        // logger.debug('Video tracks:', { oldVideoTrack, newVideoTrack, component: 'useWebRtc' });

        if (newVideoTrack) {
          if (!oldVideoTrack) {
            localStream.value.addTrack(newVideoTrack)
            peerConnection.value?.addTrack(newVideoTrack, localStream.value)
            return
          }
          peerConnection.value?.getSenders().forEach((sender) => {
            if (sender.track && sender.track.kind === 'video') {
              sender.replaceTrack(newVideoTrack)
            }
          })
          oldVideoTrack && localStream.value.removeTrack(oldVideoTrack)
          localStream.value.addTrack(newVideoTrack)
        } else {
          msg.error('切换设备不存在或不支持，请重新选择！')
        }
      }
    } catch (error) {
      msg.error('切换视频设备失败！')
      logger.error('切换视频设备失败:', { error: error, component: 'useWebRtc' })
    }
    return
  }

  // 停止桌面共享
  const stopScreenShare = () => {
    if (isScreenSharing.value) {
      isScreenSharing.value = false
      // 停止当前的本地流
      if (localStream.value) {
        localStream.value.getTracks().forEach((track) => track.stop())
      }
      if (!selectedVideoDevice.value || !rtcMsg.value.callType) {
        return false
      }
      // 切换到默认设备
      getLocalStream(rtcMsg.value.callType)
      // 切换原来的视频轨道
      selectedVideoDevice.value && switchVideoDevice(selectedVideoDevice.value)
      return true
    }
    return false
  }

  // 开始桌面共享
  const startScreenShare = async () => {
    try {
      if (!navigator?.mediaDevices?.getDisplayMedia) {
        msg.warning('当前设备不支持桌面共享功能！')
        return
      }
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true // 如果需要共享音频
      })
      if (!screenStream) {
        return
      }

      // 停止当前的本地流
      if (localStream.value) {
        localStream.value.getTracks().forEach((track) => track.stop())
      }

      // 替换本地流为桌面共享流
      localStream.value = screenStream
      // 添加新的视频轨道到连接
      screenStream.getTracks().forEach((track) => {
        if (localStream.value) {
          peerConnection.value?.addTrack(track, localStream.value)
        }
      })
      // 远程替换为桌面共享流
      const newVideoTrack = screenStream.getVideoTracks()[0]
      const oldVideoTrack = localStream.value.getVideoTracks()[0]
      if (!newVideoTrack) {
        msg.error(t('matrix.call.screenShareFailed'))
        return
      }
      newVideoTrack.onended = () => {
        msg.warning(t('matrix.call.screenShareEnded'))
        stopScreenShare()
      }
      peerConnection.value?.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === 'video') {
          sender.replaceTrack(newVideoTrack)
        }
      })
      oldVideoTrack && localStream.value.removeTrack(oldVideoTrack)
      localStream.value.addTrack(newVideoTrack)
      isScreenSharing.value = true // 开始桌面共享
    } catch (error: unknown) {
      logger.error('开始桌面共享失败:', { error: error, component: 'useWebRtc' })
      isScreenSharing.value = false
      stopScreenShare()
      if (error && typeof error === 'object' && 'name' in error && error.name === 'NotAllowedError') {
        msg.warning(t('matrix.call.screenShareEnded'))
        return
      }
      msg.error(t('matrix.call.screenShareFailed'))
    }
  }

  const toggleAudioOutput = () => {
    msg.info(t('matrix.call.audioToggleFailed'))
  }

  const lisendCandidate = async () => {
    if (!peerConnection.value) {
      return
    }

    info('第一次交换 ICE candidates...')
    if (pendingCandidates.value.length > 0) {
      pendingCandidates.value.forEach(async (candidate) => {
        await sendIceCandidate(candidate)
      })
    }

    pendingCandidates.value = []

    peerConnection.value.onicecandidate = async (event) => {
      if (event.candidate) {
        info('第二次交换 ICE candidates...')
        await sendIceCandidate(event.candidate)
      }
    }
  }

  // 处理接收到的信令消息
  const handleSignalMessage = async (data: WSRtcCallMsg) => {
    try {
      info('处理信令消息')
      const signal = JSON.parse(data.signal)

      switch (data.signalType) {
        case SignalTypeEnum.OFFER:
          await handleOffer(signal, true, roomId)
          await lisendCandidate()
          break

        case SignalTypeEnum.ANSWER:
          await handleAnswer(signal, roomId)
          // offer 发送 candidate
          await lisendCandidate()
          break

        case SignalTypeEnum.CANDIDATE:
          if (signal.candidate) {
            info('收到 candidate 信令')
            await handleCandidate(signal)
          }
          break

        default:
      }
    } catch (error) {
      logger.error('处理信令消息错误:', { error: error, component: 'useWebRtc' })
    }
  }

  // 监听 WebRTC 信令消息（注册并保存卸载函数）
  // useMitt.on(WsResponseMessageType.WEBRTC_SIGNAL, handleSignalMessage)
  void (async () => {
    await addListener(
      listen('ws-webrtc-signal', (event: TauriEvent<WsRtcSignalPayload>) => {
        info(`收到信令消息: ${JSON.stringify(event.payload)}`)
        // Transform WsRtcSignalPayload to WSRtcCallMsg
        const callMsg: WSRtcCallMsg = {
          roomId: event.payload.roomId,
          callerId: event.payload.callerUid,
          signalType: event.payload.signalType as SignalTypeEnum,
          signal: event.payload.signal,
          receiverIds: [event.payload.targetUid],
          senderId: event.payload.callerUid,
          status: RTCCallStatus.ACCEPT,
          video: event.payload.video,
          targetUid: event.payload.targetUid
        }
        handleSignalMessage(callMsg)
      }),
      `${roomId}-ws-webrtc-signal`
    )
    await addListener(
      listen('ws-call-accepted', (event: TauriEvent<WsCallAcceptedPayload>) => {
        info(`通话被接受: ${JSON.stringify(event.payload)}`)
        // // 接受方，发送是否接受
        // info(`收到 CallAccepted'消息 ${isReceiver}`)
        if (!isReceiver) {
          sendOffer(offer.value!)
          // 对方接通后，主叫方窗口前置并聚焦
          void focusCurrentWindow()
        }
      }),
      `${roomId}-ws-call-accepted`
    )
    await addListener(
      listen('ws-room-closed', (event: TauriEvent<WsRoomClosedPayload>) => {
        info(`房间已关闭: ${JSON.stringify(event.payload)}`)
        endCall()
      }),
      `${roomId}-ws-room-closed`
    )
    await addListener(
      listen('ws-dropped', () => {
        endCall()
      }),
      `${roomId}-ws-dropped`
    )
    await addListener(
      listen('ws-call-rejected', (event: TauriEvent<WsCallRejectedPayload>) => {
        info(`通话被拒绝: ${JSON.stringify(event.payload)}`)
        endCall()
      }),
      `${roomId}-ws-call-rejected`
    )
    await addListener(
      listen('ws-cancel', (event: TauriEvent<WsCancelPayload>) => {
        info(`已取消通话: ${JSON.stringify(event.payload)}`)
        endCall()
      }),
      `${roomId}-ws-cancel`
    )
    await addListener(
      listen('ws-timeout', (event: TauriEvent<WsTimeoutPayload>) => {
        info(`已取消通话: ${JSON.stringify(event.payload)}`)
        endCall()
      }),
      `${roomId}-ws-timeout`
    )
  })()

  onMounted(async () => {
    if (!isReceiver) {
      await startCall(roomId, callType, [remoteUserId])
    }
  })

  onUnmounted(() => {
    // 移除 WebRTC 信令消息监听器
    useMitt.off(WsResponseMessageType.WEBRTC_SIGNAL, handleSignalMessage)
  })

  return {
    startCallTimer,
    stopScreenShare,
    startScreenShare,
    toggleVideo,
    switchVideoDevice,
    switchCameraFacing,
    switchAudioDevice,
    isScreenSharing,
    selectedVideoDevice,
    selectedAudioDevice,
    localStream,
    remoteStream,
    peerConnection,
    getLocalStream,
    startCall,
    handleCallResponse,
    callDuration,
    connectionStatus,
    toggleMute,
    sendRtcCall2VideoCallResponse,
    isVideoEnabled,
    stopBell,
    startBell,
    pauseBell,
    playBell,
    toggleAudioOutput
  }
}
const { t } = useI18nGlobal()
