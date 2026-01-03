<template>
  <div class="matrix-call-optimized">
    <!-- 通话覆盖层 - 全屏模式 -->
    <div v-if="isCallActive && isFullscreen" class="call-overlay-fullscreen">
      <div class="call-header">
        <div class="call-info">
          <span class="call-duration">{{ formattedDuration }}</span>
          <span class="call-state">{{ callStateText }}</span>
        </div>
        <div class="call-actions">
          <n-button
            circle
            quaternary
            size="small"
            @click="toggleFullscreen"
          >
            <n-icon :component="Minimize" />
          </n-button>
        </div>
      </div>

      <!-- 媒体内容 -->
      <div class="call-media-fullscreen">
        <!-- 远程视频/音频 -->
        <div class="remote-media">
          <video
            v-if="call.type === 'video' && remoteVideoStream"
            ref="remoteVideoRef"
            :srcObject="remoteVideoStream"
            autoplay
            playsinline
            class="remote-video"
          />
          <div v-else class="audio-placeholder">
            <n-avatar
              v-bind="remoteUserAvatar !== undefined ? { src: remoteUserAvatar } : {}"
              :fallback-src="'/default-avatar.png'"
              round
              :size="120"
            >
              {{ remoteUserInitials }}
            </n-avatar>
            <span class="remote-user-name">{{ remoteUserName }}</span>
          </div>
        </div>

        <!-- 本地视频 - 画中画 -->
        <div
          v-if="call.type === 'video'"
          class="local-video-pip"
          @click="togglePip"
        >
          <video
            ref="localVideoRef"
            :srcObject="localVideoStream"
            autoplay
            muted
            playsinline
            class="local-video"
          />
        </div>
      </div>

      <!-- 控制栏 -->
      <div class="call-controls-fullscreen">
        <div class="control-buttons">
          <!-- 静音 -->
          <n-button
            circle
            :type="isMuted ? 'error' : 'default'"
            size="large"
            @click="toggleMute"
          >
            <n-icon :component="isMuted ? MicrophoneOff : Microphone" />
          </n-button>

          <!-- 视频 -->
          <n-button
            v-if="call.type === 'video'"
            circle
            :type="isVideoOff ? 'error' : 'default'"
            size="large"
            @click="toggleVideo"
          >
            <n-icon :component="isVideoOff ? VideoOff : Video" />
          </n-button>

          <!-- 屏幕共享 -->
          <n-button
            v-if="call.type === 'video' && supportsScreenShare"
            circle
            :type="isScreenSharing ? 'primary' : 'default'"
            size="large"
            @click="toggleScreenShare"
          >
            <n-icon :component="DeviceDesktop" />
          </n-button>

          <!-- 挂断 -->
          <n-button
            circle
            type="error"
            size="large"
            @click="endCall"
          >
            <n-icon :component="Phone" />
          </n-button>
        </div>
      </div>
    </div>

    <!-- 通话栏 - 内嵌模式 -->
    <div v-else-if="isCallActive" class="call-bar">
      <div class="call-bar-content">
        <!-- 左侧信息 -->
        <div class="call-info">
          <n-avatar
            v-bind="remoteUserAvatar !== undefined ? { src: remoteUserAvatar } : {}"
            :fallback-src="'/default-avatar.png'"
            round
            size="small"
          >
            {{ remoteUserInitials }}
          </n-avatar>
          <div class="call-details">
            <span class="call-user">{{ remoteUserName }}</span>
            <span class="call-meta">
              <span class="call-type">{{ call.type === 'video' ? '视频通话' : '语音通话' }}</span>
              <span class="call-duration">{{ formattedDuration }}</span>
            </span>
          </div>
        </div>

        <!-- 中间状态 -->
        <div class="call-status">
          <n-tag
            :type="getCallStatusType()"
            size="small"
            round
          >
            {{ callStateText }}
          </n-tag>
        </div>

        <!-- 右侧控制 -->
        <div class="call-controls">
          <n-button
            quaternary
            size="small"
            @click="toggleMute"
          >
            <n-icon :component="isMuted ? MicrophoneOff : Microphone" />
          </n-button>
          <n-button
            v-if="call.type === 'video'"
            quaternary
            size="small"
            @click="toggleVideo"
          >
            <n-icon :component="isVideoOff ? VideoOff : Video" />
          </n-button>
          <n-button
            quaternary
            size="small"
            @click="toggleFullscreen"
          >
            <n-icon :component="Maximize" />
          </n-button>
          <n-button
            type="error"
            size="small"
            @click="endCall"
          >
            <n-icon :component="PhoneOff" />
          </n-button>
        </div>
      </div>
    </div>

    <!-- 来电弹窗 -->
    <n-modal
      v-model:show="showIncomingCall"
      :mask-closable="false"
      preset="dialog"
      title="来电"
      style="width: 400px"
    >
      <div class="incoming-call-content">
        <n-avatar
          v-bind="incomingCallAvatar !== undefined ? { src: incomingCallAvatar } : {}"
          :fallback-src="'/default-avatar.png'"
          round
          :size="64"
        >
          {{ incomingCallInitials }}
        </n-avatar>
        <div class="incoming-call-info">
          <h3>{{ incomingCallName }}</h3>
          <p>{{ call.type === 'video' ? '视频通话' : '语音通话' }}</p>
        </div>
      </div>
      <template #action>
        <n-button size="large" @click="rejectCall">
          <n-icon :component="X" />
          拒绝
        </n-button>
        <n-button type="primary" size="large" @click="acceptCall">
          <n-icon :component="Phone" />
          接听
        </n-button>
      </template>
    </n-modal>

    <!-- 设置弹窗 -->
    <n-modal
      v-model:show="showSettings"
      preset="dialog"
      title="通话设置"
      style="width: 500px"
    >
      <div class="call-settings">
        <n-form label-placement="left">
          <n-form-item label="麦克风">
            <n-select
              v-model:value="selectedAudioInput"
              :options="audioInputDevices"
              placeholder="选择麦克风"
              @update:value="changeAudioInput"
            />
          </n-form-item>

          <n-form-item label="扬声器">
            <n-select
              v-model:value="selectedAudioOutput"
              :options="audioOutputDevices"
              placeholder="选择扬声器"
              @update:value="changeAudioOutput"
            />
          </n-form-item>

          <n-form-item v-if="call.type === 'video'" label="摄像头">
            <n-select
              v-model:value="selectedVideoInput"
              :options="videoInputDevices"
              placeholder="选择摄像头"
              @update:value="changeVideoInput"
            />
          </n-form-item>
        </n-form>
      </div>
    </n-modal>

    <!-- 网络状态提示 -->
    <div v-if="showNetworkStatus" class="network-status">
      <n-tag
        :type="networkQuality.type"
        size="small"
        round
      >
        <n-icon :component="networkQuality.icon" class="mr-1" />
        {{ networkQuality.text }}
      </n-tag>
    </div>
  </div>
</template>

<script setup lang="ts">
// Network Information API interface (not in standard TypeScript lib)
interface NetworkInformation {
  downlink?: number
  effectiveType?: string
  rtt?: number
  saveData?: boolean
}

// Extended Navigator interface
interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation
  mozConnection?: NetworkInformation
  webkitConnection?: NetworkInformation
}

// Extended HTMLMediaElement interface with setSinkId (Audio Output Devices API)
interface HTMLMediaElementWithSinkId extends HTMLMediaElement {
  setSinkId(sinkId: string): Promise<void>
}

// Matrix call invite event interface
interface MatrixInviteEvent {
  getSender?(): string
  sender?: string
}

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { NModal, NButton, NIcon, NAvatar, NTag, NSelect, NForm, NFormItem, useMessage } from 'naive-ui'
import {
  Microphone,
  MicrophoneOff,
  Video,
  VideoOff,
  DeviceDesktop,
  Phone,
  PhoneOff,
  X,
  Maximize,
  Minimize,
  Wifi,
  WifiOff,
  Wifi2
} from '@vicons/tabler'
import { matrixCallService, MatrixCall, CallState } from '@/services/matrixCallService'
import { matrixRoomManager } from '@/services/matrixRoomManager'
import { matrixClientService } from '@/integrations/matrix/client'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import type { MatrixRoomLike } from '@/services/matrixRoomManager'

interface Props {
  roomId?: string
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  roomId: '',
  compact: false
})

const emit = defineEmits<{
  callStarted: [call: MatrixCall]
  callEnded: [call: MatrixCall]
}>()

const message = useMessage()
const userStore = useUserStore()

// Refs
const remoteVideoRef = ref<HTMLVideoElement>()
const localVideoRef = ref<HTMLVideoElement>()

// State
const showIncomingCall = ref(false)
const showSettings = ref(false)
const showNetworkStatus = ref(false)
const isFullscreen = ref(false)
const isMuted = ref(false)
const isVideoOff = ref(false)
const isScreenSharing = ref(false)
const isPipExpanded = ref(false)
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
const remoteVideoStream = ref<MediaStream | null>(null)

// Computed
const currentCall = computed(() => {
  if (props.roomId) {
    return matrixCallService.getActiveCall(props.roomId)
  }
  return matrixCallService.getActiveCalls()[0]
})

const isCallActive = computed(() => {
  const call = currentCall.value
  return (
    call &&
    [CallState.INVITE_SENT, CallState.INVITE_RECEIVED, CallState.RINGING, CallState.CONNECTED].includes(call.state)
  )
})

const call = computed(() => currentCall.value || ({ type: 'voice' } as MatrixCall))

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
  // 基于浏览器网络连接信息和 RTC 统计数据计算网络质量
  const nav = navigator as NavigatorWithConnection
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection
  if (connection) {
    const downlink = connection.downlink || 0
    if (downlink > 5) {
      return { type: 'success' as const, text: '连接良好', icon: Wifi }
    } else if (downlink > 2) {
      return { type: 'warning' as const, text: '连接一般', icon: Wifi2 }
    } else {
      return { type: 'error' as const, text: '连接较差', icon: WifiOff }
    }
  }
  return { type: 'success' as const, text: '连接良好', icon: Wifi }
})

// 获取远程用户显示名称
const remoteUserName = computed(() => {
  const call = currentCall.value
  if (!call) return '未知用户'

  // 尝试从邀请事件获取发送者
  if (call.inviteEvent) {
    const inviteEvent = call.inviteEvent as MatrixInviteEvent
    const sender = inviteEvent?.getSender?.() || inviteEvent?.sender || ''
    if (sender) {
      // 尝试从房间成员获取显示名称
      const client = matrixClientService.getClient() as unknown as {
        getRoom?: (roomId: string) => MatrixRoomLike | undefined
      }
      const room = client?.getRoom?.(call.roomId)
      if (room) {
        const member = room.getMember?.(sender)
        if (member?.displayName) {
          return member.displayName
        }
      }
      // 降级到从 userId 提取 localpart
      return sender.split(':')[0]?.substring(1) || sender
    }
  }

  return '未知用户'
})

// 获取远程用户头像
const remoteUserAvatar = computed(() => {
  const call = currentCall.value
  if (!call) return undefined

  if (call.inviteEvent) {
    const inviteEvent = call.inviteEvent as MatrixInviteEvent
    const sender = inviteEvent?.getSender?.() || inviteEvent?.sender || ''
    if (sender) {
      // 尝试从房间成员获取头像
      const client = matrixClientService.getClient() as unknown as {
        getRoom?: (roomId: string) => MatrixRoomLike | undefined
      }
      const room = client?.getRoom?.(call.roomId)
      if (room) {
        const member = room.getMember?.(sender)
        if (member?.avatarUrl) {
          return AvatarUtils.getAvatarUrl(member.avatarUrl)
        }
      }
      // 尝试从 userStore 获取头像
      const userInfo = userStore.userInfo
      if (userInfo?.uid === sender && userInfo.avatar) {
        return userInfo.avatar
      }
    }
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

  const inviteEvent = call.inviteEvent as MatrixInviteEvent
  const sender = inviteEvent?.getSender?.() || inviteEvent?.sender || ''

  if (!sender) return '未知来电'

  // 尝试从房间成员获取显示名称
  const client = matrixClientService.getClient() as unknown as {
    getRoom?: (roomId: string) => MatrixRoomLike | undefined
  }
  const room = client?.getRoom?.(call.roomId)
  if (room) {
    const member = room.getMember?.(sender)
    if (member?.displayName) {
      return member.displayName
    }
  }

  // 降级到从 userId 提取 localpart
  return sender.split(':')[0]?.substring(1) || '未知来电'
})

const incomingCallAvatar = computed(() => {
  const call = currentCall.value
  if (!call?.inviteEvent) return undefined

  const inviteEvent = call.inviteEvent as MatrixInviteEvent
  const sender = inviteEvent?.getSender?.() || inviteEvent?.sender || ''

  if (!sender) return undefined

  // 尝试从房间成员获取头像
  const client = matrixClientService.getClient() as unknown as {
    getRoom?: (roomId: string) => MatrixRoomLike | undefined
  }
  const room = client?.getRoom?.(call.roomId)
  if (room) {
    const member = room.getMember?.(sender)
    if (member?.avatarUrl) {
      return AvatarUtils.getAvatarUrl(member.avatarUrl)
    }
  }

  // 尝试从 userStore 获取头像
  const userInfo = userStore.userInfo
  if (userInfo?.uid === sender && userInfo.avatar) {
    return userInfo.avatar
  }

  return undefined
})

const incomingCallInitials = computed(() => {
  const name = incomingCallName.value
  if (!name) return '?'
  return name.substring(0, 2).toUpperCase()
})

// Methods
const getCallStatusType = () => {
  const call = currentCall.value
  if (!call) return 'default'

  switch (call.state) {
    case CallState.CONNECTED:
      return 'success'
    case CallState.FAILED:
      return 'error'
    case CallState.RINGING:
      return 'warning'
    default:
      return 'info'
  }
}

const acceptCall = async () => {
  const call = currentCall.value
  if (!call) return

  try {
    showIncomingCall.value = false
    await matrixCallService.acceptCall(call.callId)
    callStartTime.value = Date.now()

    // Get media streams
    const streams = matrixCallService.getMediaStreams()
    localVideoStream.value = streams.localVideo || null
    remoteVideoStream.value = streams.remoteVideo || null

    // Set video elements
    if (localVideoRef.value && localVideoStream.value) {
      localVideoRef.value.srcObject = localVideoStream.value
    }
    if (remoteVideoRef.value && remoteVideoStream.value) {
      remoteVideoRef.value.srcObject = remoteVideoStream.value
    }

    emit('callStarted', call)
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
    localVideoStream.value = null
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

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
}

const togglePip = () => {
  isPipExpanded.value = !isPipExpanded.value
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

const changeAudioInput = async (deviceId: string) => {
  const call = currentCall.value
  if (!call) return

  try {
    // 获取新的音频输入流
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId } },
      video: false
    })

    // 替换当前音频轨道
    if (localVideoStream.value) {
      const audioTracks = localVideoStream.value.getAudioTracks()
      audioTracks.forEach((track) => {
        localVideoStream.value?.removeTrack(track)
        track.stop()
      })
      const newAudioTracks = newStream.getAudioTracks()
      newAudioTracks.forEach((track) => {
        localVideoStream.value?.addTrack(track)
      })
    }

    selectedAudioInput.value = deviceId
    message.success('音频输入已切换')
  } catch (error) {
    message.error('切换音频输入失败')
  }
}

const changeAudioOutput = async (deviceId: string) => {
  try {
    // 更新远程视频元素的音频输出
    if (remoteVideoRef.value) {
      await (remoteVideoRef.value as unknown as HTMLMediaElementWithSinkId).setSinkId(deviceId)
      selectedAudioOutput.value = deviceId
      message.success('音频输出已切换')
    }
  } catch (error) {
    message.error('切换音频输出失败')
  }
}

const changeVideoInput = async (deviceId: string) => {
  const call = currentCall.value
  if (!call) return

  try {
    // 获取新的视频输入流
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { deviceId: { exact: deviceId } }
    })

    // 替换当前视频轨道
    if (localVideoStream.value) {
      const videoTracks = localVideoStream.value.getVideoTracks()
      videoTracks.forEach((track) => {
        localVideoStream.value?.removeTrack(track)
        track.stop()
      })
      const newVideoTracks = newStream.getVideoTracks()
      newVideoTracks.forEach((track) => {
        localVideoStream.value?.addTrack(track)
      })
    }

    selectedVideoInput.value = deviceId
    message.success('视频输入已切换')
  } catch (error) {
    message.error('切换视频输入失败')
  }
}

// Event handlers
const handleCallEvent = (event: CustomEvent) => {
  const { call } = event.detail

  if (call.state === CallState.INVITE_RECEIVED) {
    showIncomingCall.value = true
  }

  if (call.state === CallState.CONNECTED && !callStartTime.value) {
    callStartTime.value = Date.now()
  }

  if (call.state === CallState.ENDED || call.state === CallState.FAILED) {
    showIncomingCall.value = false
    isFullscreen.value = false
  }
}

const handleCallTrack = (event: CustomEvent) => {
  const { kind, stream } = event.detail

  if (kind === 'video') {
    remoteVideoStream.value = stream
    if (remoteVideoRef.value) {
      remoteVideoRef.value.srcObject = stream
    }
  }
}

// Lifecycle
onMounted(async () => {
  await initializeDevices()
  window.addEventListener('matrixIncomingCall', handleCallEvent as EventListener)
  window.addEventListener('matrixCallTrack', handleCallTrack as EventListener)
  window.addEventListener('matrixCallConnectionState', () => {
    showNetworkStatus.value = true
    setTimeout(() => {
      showNetworkStatus.value = false
    }, 3000)
  })

  // Check network status
  const nav = navigator as NavigatorWithConnection
  if (nav.connection) {
    showNetworkStatus.value = true
    setTimeout(() => {
      showNetworkStatus.value = false
    }, 3000)
  }
})

onUnmounted(() => {
  window.removeEventListener('matrixIncomingCall', handleCallEvent as EventListener)
  window.removeEventListener('matrixCallTrack', handleCallTrack as EventListener)

  // End active call
  if (currentCall.value?.isActive) {
    endCall()
  }
})

// Watch for room changes
watch(
  () => props.roomId,
  (newRoomId) => {
    if (newRoomId) {
      // Check if there's an active call for this room
      const roomCall = matrixCallService.getActiveCall(newRoomId)
      if (roomCall) {
        // Handle existing call
        if (roomCall.state === CallState.CONNECTED) {
          callStartTime.value = Date.now()
        }
      }
    }
  }
)
</script>

<style scoped>
.matrix-call-optimized {
  position: relative;
}

/* 全屏通话模式 */
.call-overlay-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #000;
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

.call-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
}

.call-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.call-duration {
  font-size: 16px;
  font-weight: 500;
  color: white;
}

.call-state {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.call-media-fullscreen {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remote-media {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
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

.local-video-pip {
  position: absolute;
  bottom: 120px;
  right: 16px;
  width: 160px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.local-video-pip:hover {
  transform: scale(1.05);
}

.local-video-pip.expanded {
  width: 240px;
  height: 180px;
  bottom: 140px;
}

.local-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.call-controls-fullscreen {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24px;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
}

.control-buttons {
  display: flex;
  justify-content: center;
  gap: 24px;
}

/* 内嵌通话栏 */
.call-bar {
  position: relative;
  background: var(--n-color);
  border-top: 1px solid var(--n-border-color);
  z-index: 10;
}

.call-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  gap: 16px;
}

.call-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: 12px;
}

.call-user {
  font-weight: 500;
  color: var(--n-text-color-1);
}

.call-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.call-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 来电弹窗 */
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

/* 设置弹窗 */
.call-settings {
  padding: 16px 0;
}

/* 网络状态 */
.network-status {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
}

/* 响应式 */
@media (max-width: 768px) {
  .call-bar-content {
    padding: 8px 12px;
  }

  .call-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .call-info {
    min-width: 0;
  }

  .call-title {
    font-size: 13px;
  }

  .call-controls {
    gap: 4px;
  }

  .local-video-pip {
    width: 120px;
    height: 90px;
    bottom: 140px;
  }

  .call-controls-fullscreen {
    padding: 16px;
  }

  .control-buttons {
    gap: 16px;
  }

  .remote-video,
  .local-video {
    object-position: center;
  }
}

@media (max-width: 480px) {
  .call-bar {
    height: 56px;
  }

  .call-bar-content {
    padding: 6px 8px;
  }

  .call-type-text {
    display: none;
  }

  .call-controls {
    .n-button {
      padding: 0 8px;
    }
  }

  .call-controls-fullscreen {
    padding: 12px;
  }

  .control-buttons {
    gap: 12px;
  }

  .control-btn {
    width: 50px;
    height: 50px;
  }

  .local-video-pip {
    width: 100px;
    height: 75px;
    bottom: 120px;
    right: 10px;
  }

  .debug-panel {
    right: 10px;
    bottom: 80px;
    max-width: calc(100% - 20px);
  }
}

/* 横屏优化 */
@media (max-width: 768px) and (orientation: landscape) {
  .local-video-pip {
    bottom: 80px;
  }

  .call-controls-fullscreen {
    padding: 12px 24px;
  }
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .call-overlay-fullscreen {
    background: #000000;
  }

  .call-bar {
    background: rgba(24, 24, 28, 0.95);
    backdrop-filter: blur(20px);
  }
}

/* 高对比度模式 */
@media (prefers-contrast: high) {
  .call-bar {
    border: 2px solid;
  }

  .control-btn {
    border: 1px solid currentColor;
  }
}

/* 减少动画模式 */
@media (prefers-reduced-motion: reduce) {
  .call-bar-enter-active,
  .call-bar-leave-active {
    transition: none;
  }

  .local-video-pip {
    transition: none;
  }
}

/* 动画 */
.call-bar-enter-active,
.call-bar-leave-active {
  transition: all 0.3s ease;
}

.call-bar-enter-from {
  transform: translateY(100%);
}

.call-bar-leave-to {
  transform: translateY(100%);
}
</style>