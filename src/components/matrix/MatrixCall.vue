<template>
  <div class="matrix-call" :class="callStateClass">
    <!-- Call Overlay -->
    <div v-if="isCallActive" class="call-overlay">
      <!-- Remote Video/Audio -->
      <div class="remote-media">
        <video
          v-if="call?.type === 'video' && remoteVideoStream"
          ref="remoteVideoRef"
          :srcObject="remoteVideoStream"
          autoplay
          playsinline
          class="remote-video" />
        <div v-else class="audio-placeholder">
          <n-avatar
            v-bind="remoteUserAvatar !== undefined ? { src: remoteUserAvatar } : {}"
            :fallback-src="'/default-avatar.png'"
            round
            size="large">
            {{ remoteUserInitials }}
          </n-avatar>
          <span class="remote-user-name">{{ remoteUserName }}</span>
        </div>
      </div>

      <!-- Local Video -->
      <div v-if="call?.type === 'video'" class="local-video-container">
        <video ref="localVideoRef" :srcObject="localVideoStream" autoplay muted playsinline class="local-video" />
      </div>

      <!-- Call Controls -->
      <div class="call-controls">
        <div class="call-info">
          <span class="call-duration">{{ formattedDuration }}</span>
          <span class="call-state">{{ callStateText }}</span>
        </div>

        <div class="control-buttons">
          <!-- Mute/Unmute -->
          <n-button circle :type="isMuted ? 'error' : 'default'" size="large" @click="toggleMute">
            <n-icon :component="isMuted ? MicrophoneOff : Microphone" />
          </n-button>

          <!-- Video On/Off -->
          <n-button
            v-if="call?.type === 'video'"
            circle
            :type="isVideoOff ? 'error' : 'default'"
            size="large"
            @click="toggleVideo">
            <n-icon :component="isVideoOff ? VideoOff : Video" />
          </n-button>

          <!-- Screen Share -->
          <n-button
            v-if="call?.type === 'video' && supportsScreenShare"
            circle
            :type="isScreenSharing ? 'primary' : 'default'"
            size="large"
            @click="toggleScreenShare">
            <n-icon :component="DeviceDesktop" />
          </n-button>

          <!-- End Call -->
          <n-button circle type="error" size="large" @click="endCall">
            <n-icon :component="PhoneCall" />
          </n-button>
        </div>
      </div>
    </div>

    <!-- Incoming Call Modal -->
    <n-modal v-model:show="showIncomingCall" :mask-closable="false" preset="dialog" title="来电">
      <div class="incoming-call-content">
        <n-avatar
          v-bind="incomingCallAvatar !== undefined ? { src: incomingCallAvatar } : {}"
          :fallback-src="'/default-avatar.png'"
          round
          size="large">
          {{ incomingCallInitials }}
        </n-avatar>
        <div class="incoming-call-info">
          <h3>{{ incomingCallName }}</h3>
          <p>{{ call?.type === 'video' ? '视频通话' : '语音通话' }}</p>
        </div>
      </div>
      <template #action>
        <n-button size="large" @click="rejectCall">
          <n-icon :component="X" />
          拒绝
        </n-button>
        <n-button type="primary" size="large" @click="acceptCall">
          <n-icon :component="PhoneCall" />
          接听
        </n-button>
      </template>
    </n-modal>

    <!-- Call Settings Modal -->
    <n-modal v-model:show="showSettings" preset="dialog" title="通话设置">
      <div class="call-settings">
        <n-form-item label="麦克风">
          <n-select
            v-model:value="selectedAudioInput"
            :options="audioInputDevices"
            placeholder="选择麦克风"
            @update:value="changeAudioInput" />
        </n-form-item>

        <n-form-item label="扬声器">
          <n-select
            v-model:value="selectedAudioOutput"
            :options="audioOutputDevices"
            placeholder="选择扬声器"
            @update:value="changeAudioOutput" />
        </n-form-item>

        <n-form-item v-if="call?.type === 'video'" label="摄像头">
          <n-select
            v-model:value="selectedVideoInput"
            :options="videoInputDevices"
            placeholder="选择摄像头"
            @update:value="changeVideoInput" />
        </n-form-item>
      </div>
    </n-modal>

    <!-- Network Status -->
    <div v-if="showNetworkStatus" class="network-status">
      <n-tag :type="networkQuality.type" size="small" round>
        {{ networkQuality.text }}
      </n-tag>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { NModal, NButton, NIcon, NAvatar, NTag, NSelect, useMessage } from 'naive-ui'
import { Microphone, MicrophoneOff, Video, VideoOff, DeviceDesktop, PhoneCall, X } from '@vicons/tabler'
import { matrixCallService, MatrixCall, CallState } from '@/services/matrixCallService'
import { matrixRoomManager } from '@/matrix/services/room/manager'
import { matrixClientService } from '@/integrations/matrix/client'
import { AvatarUtils } from '@/utils/AvatarUtils'
import type { MatrixMember } from '@/types/matrix'
import { logger } from '@/utils/logger'

interface Props {
  call?: MatrixCall | null
  autoAccept?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  call: null,
  autoAccept: false
})

const emit = defineEmits<{
  callEnded: [call: MatrixCall]
}>()

const message = useMessage()

// Refs
const remoteVideoRef = ref<HTMLVideoElement>()
const localVideoRef = ref<HTMLVideoElement>()

// State
const showIncomingCall = ref(false)
const showSettings = ref(false)
const showNetworkStatus = ref(false)
const isMuted = ref(false)
const isVideoOff = ref(false)
const isScreenSharing = ref(false)
const callStartTime = ref<number | null>(null)

// Device selection
const audioInputDevices = ref<MediaDeviceInfo[]>([])
const audioOutputDevices = ref<MediaDeviceInfo[]>([])
const videoInputDevices = ref<MediaDeviceInfo[]>([])
const selectedAudioInput = ref<string>('')
const selectedAudioOutput = ref<string>('')
const selectedVideoInput = ref<string>('')

// Media streams
const localVideoStream = ref<MediaStream | null>(null)
const localAudioStream = ref<MediaStream | null>(null)
const remoteVideoStream = ref<MediaStream | null>(null)
const remoteAudioStream = ref<MediaStream | null>(null)

// Room members cache for getting user info
const roomMembers = ref<MatrixMember[]>([])

// Network quality stats
const networkStats = ref({
  packetsLost: 0,
  packetsReceived: 0,
  bytesReceived: 0,
  bytesSent: 0,
  rtt: 0,
  jitter: 0,
  bandwidth: 0
})
let statsInterval: ReturnType<typeof setInterval> | null = null

// Computed
const currentCall = computed(() => props.call || matrixCallService.getActiveCall(''))

const isCallActive = computed(() => {
  return (
    currentCall.value &&
    [CallState.INVITE_SENT, CallState.INVITE_RECEIVED, CallState.CONNECTED].includes(currentCall.value.state)
  )
})

const callStateClass = computed(() => {
  const call = currentCall.value
  if (!call) return ''

  return `call-${call.state}`
})

const callStateText = computed(() => {
  const call = currentCall.value
  if (!call) return ''

  switch (call.state) {
    case CallState.INVITE_SENT:
      return '呼叫中...'
    case CallState.INVITE_RECEIVED:
      return '来电中...'
    case CallState.RINGING:
      return '响铃中...'
    case CallState.CONNECTED:
      return '通话中'
    case CallState.ON_HOLD:
      return '已保持'
    case CallState.ENDING:
      return '结束通话中...'
    case CallState.ENDED:
      return '通话已结束'
    case CallState.FAILED:
      return '通话失败'
    default:
      return ''
  }
})

const formattedDuration = computed(() => {
  if (!callStartTime.value) return '00:00'

  const duration = Date.now() - callStartTime.value
  const minutes = Math.floor(duration / 60000)
  const seconds = Math.floor((duration % 60000) / 1000)

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

const supportsScreenShare = computed(() => {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)
})

const networkQuality = computed(() => {
  const stats = networkStats.value
  const packetsReceived = stats.packetsReceived

  // Calculate packet loss percentage
  const packetLossRate = packetsReceived > 0 ? (stats.packetsLost / (stats.packetsLost + packetsReceived)) * 100 : 0

  // Determine quality based on multiple factors
  let quality: 'success' | 'warning' | 'error' = 'success'
  let text = '连接良好'

  // Check packet loss (critical factor)
  if (packetLossRate > 5) {
    quality = 'error'
    text = `网络差 (丢包 ${packetLossRate.toFixed(1)}%)`
  } else if (packetLossRate > 2) {
    quality = 'warning'
    text = `网络一般 (丢包 ${packetLossRate.toFixed(1)}%)`
  }

  // Check RTT (Round Trip Time)
  if (stats.rtt > 500) {
    quality = quality === 'success' ? 'error' : quality
    text = `延迟高 (${stats.rtt}ms)`
  } else if (stats.rtt > 200 && quality === 'success') {
    quality = 'warning'
    text = `延迟一般 (${stats.rtt}ms)`
  }

  // Check bandwidth (in kbps)
  const bandwidthKbps = stats.bandwidth / 1000
  if (bandwidthKbps > 0 && bandwidthKbps < 100) {
    quality = quality === 'success' ? 'warning' : quality
    text = `带宽低 (${bandwidthKbps.toFixed(0)}kbps)`
  }

  return { type: quality, text }
})

/**
 * 获取远程用户显示名称
 * 从缓存的房间成员列表中获取远程用户的信息
 */
const remoteUserName = computed(() => {
  const call = currentCall.value
  if (!call?.roomId) return 'Remote User'

  // 从 inviteEvent 获取发送者，然后从成员列表中找到对方
  const inviteEvent = call.inviteEvent as { getSender?: () => string; sender?: string } | undefined
  const sender = inviteEvent?.getSender?.() || inviteEvent?.sender || ''

  // 对于1对1通话，找到另一个成员
  const otherMember = roomMembers.value.find((m) => m.userId !== sender)
  return otherMember?.displayName || otherMember?.userId?.split(':')[0]?.substring(1) || 'Remote User'
})

/**
 * 获取远程用户头像 URL
 */
const remoteUserAvatar = computed(() => {
  const call = currentCall.value
  if (!call?.roomId) return undefined

  const inviteEvent = call.inviteEvent as { getSender?: () => string; sender?: string } | undefined
  const sender = inviteEvent?.getSender?.() || inviteEvent?.sender || ''

  const otherMember = roomMembers.value.find((m) => m.userId !== sender)

  if (otherMember?.avatarUrl) {
    return AvatarUtils.getAvatarUrl(otherMember.avatarUrl)
  }
  return undefined
})

const remoteUserInitials = computed(() => {
  const name = remoteUserName.value
  if (!name) return '?'
  return name.substring(0, 2).toUpperCase()
})

const incomingCallName = computed(() => {
  const call = currentCall.value
  if (!call?.inviteEvent) return '未知来电'

  const inviteEvent = call.inviteEvent as { getSender?: () => string; sender?: string } | undefined
  const sender = inviteEvent?.getSender?.() || inviteEvent?.sender || ''

  // Try to get display name from cached members
  const member = roomMembers.value.find((m) => m.userId === sender)
  if (member?.displayName) return member.displayName

  return sender?.split(':')[0]?.substring(1) || '未知来电'
})

/**
 * 获取来电者头像 URL
 * 从缓存的房间成员中获取来电者的头像
 */
const incomingCallAvatar = computed(() => {
  const call = currentCall.value
  if (!call?.inviteEvent || !call.roomId) return undefined

  const inviteEvent = call.inviteEvent as { getSender?: () => string; sender?: string } | undefined
  const sender = inviteEvent?.getSender?.() || inviteEvent?.sender || ''

  const member = roomMembers.value.find((m) => m.userId === sender)

  if (member?.avatarUrl) {
    return AvatarUtils.getAvatarUrl(member.avatarUrl)
  }
  return undefined
})

const incomingCallInitials = computed(() => {
  const name = incomingCallName.value
  if (!name) return '?'
  return name.substring(0, 2).toUpperCase()
})

// Methods
/**
 * 加载房间成员信息
 * 用于获取通话对方的显示名称和头像
 */
const loadRoomMembers = async (roomId: string) => {
  try {
    const members = await matrixRoomManager.getRoomMembers(roomId)
    roomMembers.value = members
  } catch (error) {
    // 静默失败，使用默认值
  }
}

const initializeDevices = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()

    audioInputDevices.value = devices.filter((d) => d.kind === 'audioinput')
    audioOutputDevices.value = devices.filter((d) => d.kind === 'audiooutput')
    videoInputDevices.value = devices.filter((d) => d.kind === 'videoinput')

    // Select default devices
    if (audioInputDevices.value.length > 0) {
      selectedAudioInput.value = audioInputDevices.value[0]?.deviceId ?? ''
    }
    if (audioOutputDevices.value.length > 0) {
      selectedAudioOutput.value = audioOutputDevices.value[0]?.deviceId ?? ''
    }
    if (videoInputDevices.value.length > 0) {
      selectedVideoInput.value = videoInputDevices.value[0]?.deviceId ?? ''
    }
  } catch (error) {}
}

const acceptCall = async () => {
  const call = currentCall.value
  if (!call) return

  try {
    showIncomingCall.value = false
    await matrixCallService.acceptCall(call.callId)

    // Start call timer
    callStartTime.value = Date.now()

    // Get media streams
    const streams = matrixCallService.getMediaStreams()
    if (streams) {
      localAudioStream.value = streams.localAudio || null
      localVideoStream.value = streams.localVideo || null
      remoteAudioStream.value = streams.remoteAudio || null
      remoteVideoStream.value = streams.remoteVideo || null
    }

    // Set video elements
    if (localVideoRef.value && localVideoStream.value) {
      localVideoRef.value.srcObject = localVideoStream.value
    }
    if (remoteVideoRef.value && remoteVideoStream.value) {
      remoteVideoRef.value.srcObject = remoteVideoStream.value
    }
  } catch (error) {
    message.error('接听失败')
  }
}

const rejectCall = async () => {
  const call = currentCall.value
  if (!call) return

  try {
    showIncomingCall.value = false
    await matrixCallService.rejectCall(call.callId)
  } catch (error) {
    message.error('拒绝失败')
  }
}

const endCall = async () => {
  const call = currentCall.value
  if (!call) return

  try {
    await matrixCallService.endCall(call.callId)
    callStartTime.value = null

    // Clear video elements
    if (localVideoRef.value) {
      localVideoRef.value.srcObject = null
    }
    if (remoteVideoRef.value) {
      remoteVideoRef.value.srcObject = null
    }

    // Clear streams
    localAudioStream.value = null
    localVideoStream.value = null
    remoteAudioStream.value = null
    remoteVideoStream.value = null

    emit('callEnded', call)
  } catch (error) {
    message.error('挂断失败')
  }
}

const toggleMute = () => {
  const call = currentCall.value
  if (!call) return

  isMuted.value = matrixCallService.toggleAudio(call.callId)
}

const toggleVideo = () => {
  const call = currentCall.value
  if (!call) return

  isVideoOff.value = !matrixCallService.toggleVideo(call.callId)
}

const toggleScreenShare = async () => {
  const call = currentCall.value
  if (!call) return

  try {
    if (isScreenSharing.value) {
      matrixCallService.stopScreenShare(call.callId)
      isScreenSharing.value = false
    } else {
      await matrixCallService.startScreenShare(call.callId)
      isScreenSharing.value = true
    }
  } catch (error) {
    message.error('屏幕共享失败')
  }
}

const changeAudioInput = async (deviceId: string) => {
  try {
    const call = currentCall.value
    if (!call || !call.callId) return

    // Get new audio input stream
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId } },
      video: false
    })

    // Replace audio track in peer connection
    const service = matrixCallService as unknown as { peerConnections: Map<string, RTCPeerConnection> }
    const peerConnection = service.peerConnections?.get(call.callId)
    if (!peerConnection) {
      message.warning('无法获取通话连接')
      return
    }

    const sender = peerConnection.getSenders().find((s) => s.track?.kind === 'audio')
    if (sender && newStream.getAudioTracks().length > 0) {
      await sender.replaceTrack(newStream.getAudioTracks()[0])
    }

    // Update local audio stream
    localAudioStream.value = newStream

    // Update selected device
    selectedAudioInput.value = deviceId

    logger.info('[MatrixCall] Audio input changed:', { deviceId })
  } catch (error) {
    logger.error('[MatrixCall] Failed to change audio input:', error)
    message.error('切换麦克风失败')
  }
}

const changeAudioOutput = async (deviceId: string) => {
  try {
    // Set output device for remote audio
    if (remoteVideoRef.value) {
      await (remoteVideoRef.value as unknown as { setSinkId?: (deviceId: string) => Promise<void> }).setSinkId?.(
        deviceId
      )
    }
    if (localVideoRef.value) {
      await (localVideoRef.value as unknown as { setSinkId?: (deviceId: string) => Promise<void> }).setSinkId?.(
        deviceId
      )
    }

    // Update selected device
    selectedAudioOutput.value = deviceId

    logger.info('[MatrixCall] Audio output changed:', { deviceId })
  } catch (error) {
    logger.error('[MatrixCall] Failed to change audio output:', error)
    message.error('切换扬声器失败')
  }
}

const changeVideoInput = async (deviceId: string) => {
  try {
    const call = currentCall.value
    if (!call || !call.callId) return

    // Get new video input stream
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { deviceId: { exact: deviceId } }
    })

    // Replace video track in peer connection
    const service = matrixCallService as unknown as { peerConnections: Map<string, RTCPeerConnection> }
    const peerConnection = service.peerConnections?.get(call.callId)
    if (!peerConnection) {
      message.warning('无法获取通话连接')
      return
    }

    const sender = peerConnection.getSenders().find((s) => s.track?.kind === 'video')
    if (sender && newStream.getVideoTracks().length > 0) {
      await sender.replaceTrack(newStream.getVideoTracks()[0])
    }

    // Update local video stream
    localVideoStream.value = newStream
    if (localVideoRef.value) {
      localVideoRef.value.srcObject = newStream
    }

    // Update selected device
    selectedVideoInput.value = deviceId

    logger.info('[MatrixCall] Video input changed:', { deviceId })
  } catch (error) {
    logger.error('[MatrixCall] Failed to change video input:', error)
    message.error('切换摄像头失败')
  }
}

const handleCallEvent = (event: CustomEvent) => {
  const { call } = event.detail

  if (call.state === CallState.INVITE_RECEIVED && !props.autoAccept) {
    showIncomingCall.value = true
  }

  if (call.state === CallState.CONNECTED) {
    callStartTime.value = Date.now()
  }
}

const handleCallTrack = (event: CustomEvent) => {
  const { kind, stream } = event.detail

  if (kind === 'video') {
    remoteVideoStream.value = stream
    if (remoteVideoRef.value) {
      remoteVideoRef.value.srcObject = stream
    }
  } else if (kind === 'audio') {
    remoteAudioStream.value = stream
  }

  // Start collecting stats when track is ready
  startStatsCollection()
}

/**
 * Start collecting WebRTC statistics
 */
const startStatsCollection = () => {
  // Clear any existing interval
  if (statsInterval) {
    clearInterval(statsInterval)
  }

  // Collect stats every 1 second
  statsInterval = setInterval(async () => {
    const call = currentCall.value
    if (!call || !call.callId) return

    try {
      // Access peer connection from the service using internal map
      const service = matrixCallService as unknown as { peerConnections: Map<string, RTCPeerConnection> }
      const peerConnection = service.peerConnections?.get(call.callId)
      if (!peerConnection) return

      const stats = await peerConnection.getStats(null)

      let packetsLost = 0
      let packetsReceived = 0
      let bytesReceived = 0
      let bytesSent = 0
      let currentRtt = 0
      let totalBandwidth = 0

      stats.forEach((report: RTCStatsReport) => {
        // Remote inbound stream stats (for receiving audio/video)
        const reportType = (report as unknown as { type?: string }).type
        if (reportType === 'inbound-rtp' && (report as unknown as { kind?: string }).kind === 'video') {
          packetsLost += (report as unknown as { packetsLost?: number }).packetsLost || 0
          packetsReceived += (report as unknown as { packetsReceived?: number }).packetsReceived || 0
          bytesReceived += (report as unknown as { bytesReceived?: number }).bytesReceived || 0
        }

        // Local outbound stream stats (for sending audio/video)
        if (reportType === 'outbound-rtp') {
          bytesSent += (report as unknown as { bytesSent?: number }).bytesSent || 0
        }

        // Candidate pair stats (for RTT and bandwidth)
        if (reportType === 'candidate-pair' && (report as unknown as { state?: string }).state === 'succeeded') {
          currentRtt = (report as unknown as { currentRoundTripTime?: number }).currentRoundTripTime || 0
          totalBandwidth += (report as unknown as { availableOutgoingBitrate?: number }).availableOutgoingBitrate || 0
        }
      })

      // Update stats
      networkStats.value = {
        packetsLost,
        packetsReceived,
        bytesReceived,
        bytesSent,
        rtt: currentRtt,
        jitter: 0, // Would need jitter buffer stats
        bandwidth: totalBandwidth
      }
    } catch (error) {
      logger.error('[MatrixCall] Failed to get stats:', error)
    }
  }, 1000)
}

/**
 * Stop collecting statistics
 */
const stopStatsCollection = () => {
  if (statsInterval) {
    clearInterval(statsInterval)
    statsInterval = null
  }
}

// Lifecycle
onMounted(() => {
  // Initialize devices
  initializeDevices()

  // Listen for call events
  window.addEventListener('matrixIncomingCall', handleCallEvent as EventListener)
  window.addEventListener('matrixCallTrack', handleCallTrack as EventListener)

  // Handle device changes
  navigator.mediaDevices.addEventListener('devicechange', initializeDevices)

  // Auto accept incoming calls if enabled
  if (props.autoAccept && currentCall.value?.state === CallState.INVITE_RECEIVED) {
    acceptCall()
  }
})

onUnmounted(() => {
  window.removeEventListener('matrixIncomingCall', handleCallEvent as EventListener)
  window.removeEventListener('matrixCallTrack', handleCallTrack as EventListener)
  navigator.mediaDevices.removeEventListener('devicechange', initializeDevices)

  // Stop collecting stats
  stopStatsCollection()

  // End active call
  if (currentCall.value?.isActiveMethod()) {
    endCall()
  }
})

// Watch for call changes
watch(currentCall, (newCall) => {
  if (newCall) {
    // 加载房间成员信息
    if (newCall.roomId) {
      loadRoomMembers(newCall.roomId)
    }

    if (newCall.state === CallState.INVITE_RECEIVED && !props.autoAccept) {
      showIncomingCall.value = true
    }

    if (newCall.state === CallState.CONNECTED && !callStartTime.value) {
      callStartTime.value = Date.now()
    }
  } else {
    showIncomingCall.value = false
    callStartTime.value = null
  }
})
</script>

<style scoped>
.matrix-call {
  position: relative;
  height: 100%;
  background: var(--hula-black);
}

.call-overlay {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.remote-media {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hula-brand-primary);
}

.remote-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.audio-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: white;
}

.remote-user-name {
  font-size: 18px;
  font-weight: 500;
}

.local-video-container {
  position: absolute;
  bottom: 120px;
  right: 16px;
  width: 120px;
  height: 160px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(var(--hula-black-rgb), 0.3);
  z-index: 10;
}

.local-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.call-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24px;
  background: linear-gradient(to top, rgba(var(--hula-black-rgb), 0.8), transparent);
}

.call-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  color: white;
}

.call-duration {
  font-size: 16px;
  font-weight: 500;
}

.call-state {
  font-size: 14px;
  opacity: 0.8;
}

.control-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.control-buttons .n-button {
  width: 56px;
  height: 56px;
  background: rgba(var(--hula-white-rgb), 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(var(--hula-white-rgb), 0.2);
}

.control-buttons .n-button:hover {
  background: rgba(var(--hula-white-rgb), 0.2);
}

.control-buttons .n-button--error-type {
  background: var(--hula-brand-primary);
  border-color: var(--hula-brand-primary);
}

.control-buttons .n-button--error-type:hover {
  background: var(--hula-brand-primary);
}

.control-buttons .n-button--primary-type {
  background: var(--hula-brand-primary);
  border-color: var(--hula-brand-primary);
}

.incoming-call-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px;
}

.incoming-call-info {
  text-align: center;
}

.incoming-call-info h3 {
  margin: 0 0 4px 0;
  font-size: 20px;
}

.incoming-call-info p {
  margin: 0;
  color: var(--n-text-color-3);
}

.call-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0;
}

.network-status {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
}

/* Call state styles */
.call-setup .remote-media {
  background: var(--hula-brand-primary);
}

.call-connected .remote-media {
  background: var(--hula-brand-primary);
}

.call-failed .remote-media {
  background: var(--hula-brand-primary);
}

@media (max-width: 768px) {
  .local-video-container {
    width: 80px;
    height: 106px;
    bottom: 140px;
    right: 8px;
  }

  .call-controls {
    padding: 16px;
  }

  .control-buttons .n-button {
    width: 48px;
    height: 48px;
  }

  .control-buttons {
    gap: 12px;
  }
}
</style>
