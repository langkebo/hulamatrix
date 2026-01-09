<!-- Mobile Group Call Interface - MatrixRTC group calls on mobile -->
<template>
  <div class="mobile-group-call" :class="{ 'in-call': isInCall }">
    <!-- Call Setup Screen -->
    <div v-if="callState === GroupCallState.SETUP" class="call-setup">
      <div class="setup-header">
        <n-icon :size="32" color="#18a058">
          <Users />
        </n-icon>
        <h2>群组通话</h2>
        <p>{{ roomName }}</p>
      </div>

      <div class="setup-options">
        <div class="option-card" :class="{ selected: callType === 'voice' }" @click="callType = 'voice'">
          <n-icon :size="40" :color="callType === 'voice' ? '#18a058' : 'var(--hula-gray-700)'">
            <Phone />
          </n-icon>
          <span>语音通话</span>
        </div>

        <div class="option-card" :class="{ selected: callType === 'video' }" @click="callType = 'video'">
          <n-icon :size="40" :color="callType === 'video' ? '#18a058' : 'var(--hula-gray-700)'">
            <Video />
          </n-icon>
          <span>视频通话</span>
        </div>
      </div>

      <div class="setup-participants">
        <div class="participants-header">
          <span>参与者 ({{ participants.length }})</span>
        </div>

        <div v-if="participants.length > 0" class="participants-list">
          <div v-for="participant in participants" :key="participant.userId" class="participant-item">
            <n-avatar :src="participant.avatar" :size="40" round>
              <template #fallback>
                <span>{{ participant.displayName?.[0] || participant.userId[1] }}</span>
              </template>
            </n-avatar>
            <div class="participant-info">
              <span class="participant-name">{{ participant.displayName || participant.userId }}</span>
              <span class="participant-status">{{ getParticipantStatus(participant) }}</span>
            </div>
          </div>
        </div>

        <div v-else class="empty-participants">
          <n-icon :size="48" color="#d0d0d0">
            <Users />
          </n-icon>
          <p>暂无其他参与者</p>
        </div>
      </div>

      <div class="setup-actions">
        <n-button type="primary" size="large" block :loading="joining" @click="startCall">
          <template #icon>
            <n-icon><PhoneCall /></n-icon>
          </template>
          开始通话
        </n-button>

        <n-button block size="large" @click="handleCancel">取消</n-button>
      </div>
    </div>

    <!-- Active Call Screen -->
    <div v-else-if="isInCall" class="active-call">
      <!-- Video Grid -->
      <div v-if="callType === 'video'" class="video-grid">
        <div
          v-for="stream in videoStreams"
          :key="stream.id"
          class="video-tile"
          :class="{ 'local-stream': stream.isLocal, speaking: stream.speaking }">
          <video :ref="(el) => setVideoRef(el, stream.id)" autoplay muted playsinline />
          <div class="video-label">
            <span>{{ stream.name }}</span>
            <n-icon v-if="stream.muted" :size="16"><MicrophoneOff /></n-icon>
          </div>
          <div v-if="stream.speaking" class="speaking-indicator"></div>
        </div>

        <!-- Local Video (Picture-in-Picture) -->
        <div v-if="localVideoStream" class="local-pip" @click="togglePipExpanded">
          <video ref="localVideoRef" autoplay muted playsinline />
        </div>
      </div>

      <!-- Voice Call Layout -->
      <div v-else class="voice-call">
        <!-- Room Avatar -->
        <div class="room-avatar">
          <n-avatar :src="roomAvatar" :size="120" round>
            <template #fallback>
              <span style="font-size: 48px">{{ roomName?.[0] || '?' }}</span>
            </template>
          </n-avatar>
        </div>

        <h2 class="room-name">{{ roomName }}</h2>

        <!-- Speaking Indicator -->
        <div v-if="speakingParticipant" class="speaking-now">
          <div class="avatar-wave"></div>
          <span>{{ speakingParticipant.displayName || speakingParticipant.userId }} 正在说话...</span>
        </div>

        <!-- Call Duration -->
        <div class="call-duration">
          <span>{{ formattedDuration }}</span>
        </div>

        <!-- Participants Scroll -->
        <div v-if="participants.length > 0" class="participants-scroll">
          <div class="participant-avatar-row">
            <n-avatar
              v-for="p in participants"
              :key="p.userId"
              :src="p.avatar"
              :size="48"
              round
              :class="{ speaking: p.speaking, muted: p.muted }">
              <template #fallback>
                <span>{{ p.displayName?.[0] || p.userId[1] }}</span>
              </template>
            </n-avatar>
          </div>
        </div>
      </div>

      <!-- Call Controls -->
      <div class="call-controls">
        <!-- Mute/Unmute -->
        <n-button
          circle
          :style="{ width: '56px', height: '56px' }"
          :type="isMuted ? 'error' : 'default'"
          :class="{ 'control-btn': true, muted: isMuted }"
          @click="toggleMute">
          <template #icon>
            <n-icon :size="28">
              <Microphone v-if="!isMuted" />
              <MicrophoneOff v-else />
            </n-icon>
          </template>
        </n-button>

        <!-- Video On/Off (video call only) -->
        <n-button
          v-if="callType === 'video'"
          circle
          :style="{ width: '56px', height: '56px' }"
          :type="isVideoOff ? 'error' : 'default'"
          :class="{ 'control-btn': true, 'video-off': isVideoOff }"
          @click="toggleVideo">
          <template #icon>
            <n-icon :size="28">
              <Video v-if="!isVideoOff" />
              <VideoOff v-else />
            </n-icon>
          </template>
        </n-button>

        <!-- Switch Camera (mobile only) -->
        <n-button
          v-if="isMobile && callType === 'video'"
          circle
          :style="{ width: '48px', height: '48px' }"
          class="control-btn secondary"
          @click="switchCamera">
          <template #icon>
            <n-icon :size="24">
              <CameraRotate />
            </n-icon>
          </template>
        </n-button>

        <!-- End Call -->
        <n-button
          circle
          :style="{ width: '64px', height: '64px' }"
          type="error"
          class="control-btn end-call"
          @click="endCall">
          <template #icon>
            <n-icon :size="32">
              <PhoneOff />
            </n-icon>
          </template>
        </n-button>

        <!-- Speaker Toggle -->
        <n-button
          circle
          :style="{ width: '48px', height: '48px' }"
          :type="isSpeakerOn ? 'primary' : 'default'"
          class="control-btn secondary"
          @click="toggleSpeaker">
          <template #icon>
            <n-icon :size="24">
              <Volume v-if="isSpeakerOn" />
              <Volume3 v-else />
            </n-icon>
          </template>
        </n-button>
      </div>
    </div>

    <!-- Call Ended Screen -->
    <div v-else-if="callState === GroupCallState.ENDED" class="call-ended">
      <div class="ended-content">
        <n-icon :size="64" :color="endCallReason === 'hung_up' ? '#18a058' : '#d03050'">
          <PhoneCheck v-if="endCallReason === 'hung_up'" />
          <PhoneX v-else />
        </n-icon>

        <h2>{{ endCallReason === 'hung_up' ? '通话结束' : '通话失败' }}</h2>

        <div v-if="callDuration > 0" class="ended-duration">
          <span>通话时长: {{ formattedDuration }}</span>
        </div>

        <div class="ended-stats">
          <div class="stat-item">
            <span class="stat-value">{{ participants.length + 1 }}</span>
            <span class="stat-label">参与人数</span>
          </div>
        </div>

        <n-button type="primary" size="large" block @click="handleClose">返回</n-button>
      </div>
    </div>

    <!-- Connection Status Banner -->
    <div v-if="isInCall && connectionStatus !== 'connected'" class="connection-banner" :class="connectionStatus">
      <n-spin v-if="connectionStatus === 'connecting'" :size="16" />
      <n-icon v-else :size="16">
        <AlertCircle />
      </n-icon>
      <span>{{ getConnectionStatusText() }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NIcon, NSpin, NAvatar, useDialog, useMessage } from 'naive-ui'
import {
  Users,
  Phone,
  Video,
  PhoneCall,
  PhoneOff,
  Microphone,
  MicrophoneOff,
  Volume,
  Volume3,
  VideoOff,
  CameraRotate,
  PhoneCheck,
  PhoneX,
  AlertCircle
} from '@vicons/tabler'
import {
  matrixGroupCallService,
  GroupCallState,
  GroupCall,
  type GroupCallOptions,
  type GroupCallParticipant
} from '@/services/matrixGroupCallService'
import { matrixClientService } from '@/integrations/matrix/client'
import { useHaptic } from '@/composables/useMobileGestures'
import { logger } from '@/utils/logger'

interface Props {
  roomId: string
  roomName?: string
  roomAvatar?: string
  initialCallType?: 'voice' | 'video'
}

interface Emits {
  (e: 'close'): void
  (e: 'callEnded', data: { duration: number; reason: string }): void
}

const props = withDefaults(defineProps<Props>(), {
  initialCallType: 'voice'
})

const emit = defineEmits<Emits>()

const router = useRouter()
const dialog = useDialog()
const message = useMessage()
const { success, error, selection, warning } = useHaptic()

// State
const callState = ref<GroupCallState>(GroupCallState.SETUP)
const callType = ref<'voice' | 'video'>(props.initialCallType)
const joining = ref(false)
const isMuted = ref(false)
const isVideoOff = ref(false)
const isSpeakerOn = ref(true)
const connectionStatus = ref<'connecting' | 'connected' | 'failed'>('connecting')
const callDuration = ref(0)
const endCallReason = ref<'hung_up' | 'failed'>('hung_up')

// Participants
const participants = ref<GroupCallParticipant[]>([])

// Video streams
const videoStreams = ref<
  Array<{
    id: string
    stream?: MediaStream
    name: string
    isLocal: boolean
    muted: boolean
    speaking: boolean
  }>
>([])

const localVideoStream = ref<MediaStream | null>(null)
const videoRefs = new Map<string, HTMLVideoElement>()

// Timer
let durationTimer: number | null = null
let callStartTime = 0

// Computed
const isInCall = computed(() => {
  return [GroupCallState.READY, GroupCallState.CONNECTED, GroupCallState.ON_HOLD].includes(callState.value)
})

const speakingParticipant = computed(() => {
  return participants.value.find((p) => p.speaking)
})

const formattedDuration = computed(() => {
  const minutes = Math.floor(callDuration.value / 60)
  const seconds = callDuration.value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

const isMobile = computed(() => {
  return import.meta.env.TAURI_ENV_PLATFORM === 'android' || import.meta.env.TAURI_ENV_PLATFORM === 'ios'
})

// Methods
const startCall = async () => {
  joining.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    // Get TURN servers
    const turnServers = await getTurnServers()

    const options: GroupCallOptions = {
      roomId: props.roomId,
      type: callType.value,
      encrypted: true,
      iceServers: turnServers
    }

    logger.info('[MobileGroupCall] Starting group call', options)

    // Create group call
    const groupCall = await matrixGroupCallService.createGroupCall(options)

    // Setup local media
    await setupLocalMedia()

    // Join the call
    await groupCall.enter({
      microphone: isMuted.value ? 'muted' : 'unmuted',
      camera: isVideoOff.value ? 'off' : 'on'
    })

    callState.value = GroupCallState.CONNECTED
    connectionStatus.value = 'connected'
    startDurationTimer()

    // Setup event listeners on the service instead of the group call object
    setupGroupCallListeners()

    success()
  } catch (error) {
    logger.error('[MobileGroupCall] Failed to start call:', error)
    message.error('无法开始通话: ' + (error instanceof Error ? error.message : String(error)))
    callState.value = GroupCallState.FAILED
  } finally {
    joining.value = false
  }
}

const setupLocalMedia = async () => {
  try {
    const constraints: MediaStreamConstraints = {
      audio: !isMuted.value,
      video: callType.value === 'video' && !isVideoOff.value
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints)

    if (callType.value === 'video') {
      localVideoStream.value = stream
      videoStreams.value.push({
        id: 'local',
        stream,
        name: '我',
        isLocal: true,
        muted: isMuted.value,
        speaking: false
      })

      await nextTick()
      const localVideoRef = videoRefs.get('local')
      if (localVideoRef && stream) {
        localVideoRef.srcObject = stream
      }
    }
  } catch (error) {
    logger.error('[MobileGroupCall] Failed to get local media:', error)
    message.warning('无法访问摄像头或麦克风')
  }
}

const setupGroupCallListeners = () => {
  // Participant changes - listen on service level with room-specific event
  const participantsEvent = `participants_${props.roomId}`
  const handleParticipantsChanged = (...args: unknown[]) => {
    const parts = args[0] as GroupCallParticipant[] | undefined
    if (!parts) return

    participants.value = parts

    // Update video streams
    if (callType.value === 'video') {
      // This would be populated by actual WebRTC tracks in a real implementation
      videoStreams.value = [
        {
          id: 'local',
          stream: localVideoStream.value || undefined,
          name: '我',
          isLocal: true,
          muted: isMuted.value,
          speaking: false
        },
        ...parts
          .filter((p) => p.videoEnabled)
          .map((p) => ({
            id: p.userId,
            name: p.displayName || p.userId,
            isLocal: false,
            muted: p.muted,
            speaking: p.speaking || false
          }))
      ]
    }
  }
  matrixGroupCallService.on(participantsEvent, handleParticipantsChanged)

  // Speaking indicator
  const speakingEvent = `speaking_${props.roomId}`
  const handleSpeakingChanged = (...args: unknown[]) => {
    const userId = args[0] as string | undefined
    const speaking = args[1] as boolean | undefined
    if (!userId) return

    const participant = participants.value.find((p) => p.userId === userId)
    if (participant && speaking !== undefined) {
      participant.speaking = speaking
    }
  }
  matrixGroupCallService.on(speakingEvent, handleSpeakingChanged)

  // Call state changes
  const stateEvent = `state_${props.roomId}`
  const handleStateChanged = (...args: unknown[]) => {
    const state = args[0] as GroupCallState | undefined
    if (!state) return

    callState.value = state
    if (state === GroupCallState.ENDED) {
      stopDurationTimer()
    }
  }
  matrixGroupCallService.on(stateEvent, handleStateChanged)
}

const toggleMute = async () => {
  const groupCall = matrixGroupCallService.getGroupCall(props.roomId)
  if (!groupCall) return

  try {
    await groupCall.setMicrophoneMuted(!isMuted.value)
    isMuted.value = !isMuted.value
    selection()
  } catch (error) {
    logger.error('[MobileGroupCall] Failed to toggle mute:', error)
  }
}

const toggleVideo = async () => {
  if (callType.value !== 'video') return

  const groupCall = matrixGroupCallService.getGroupCall(props.roomId)
  if (!groupCall) return

  try {
    await groupCall.setCameraEnabled(isVideoOff.value)
    isVideoOff.value = !isVideoOff.value
    selection()
  } catch (error) {
    logger.error('[MobileGroupCall] Failed to toggle video:', error)
  }
}

const switchCamera = async () => {
  try {
    // Implementation would switch between front and back cameras
    // This is handled by useWebRtc hook's switchCameraFacing function
    selection()
  } catch (error) {
    logger.error('[MobileGroupCall] Failed to switch camera:', error)
  }
}

const toggleSpeaker = () => {
  isSpeakerOn.value = !isSpeakerOn.value
  // Toggle between speakerphone and earpiece
  selection()
}

const endCall = async () => {
  dialog.warning({
    title: '结束通话',
    content: '确定要结束当前通话吗？',
    positiveText: '结束',
    negativeText: '取消',
    onPositiveClick: async () => {
      await performEndCall()
    }
  })
}

const performEndCall = async () => {
  try {
    const groupCall = matrixGroupCallService.getGroupCall(props.roomId)
    if (groupCall) {
      await groupCall.leave()
      await groupCall.terminate()
    }

    stopDurationTimer()
    cleanup()

    callState.value = GroupCallState.ENDED
    endCallReason.value = 'hung_up'

    emit('callEnded', {
      duration: callDuration.value,
      reason: 'hung_up'
    })

    warning()
  } catch (error) {
    logger.error('[MobileGroupCall] Failed to end call:', error)
  }
}

const handleCancel = () => {
  emit('close')
}

const handleClose = () => {
  emit('close')
}

const setVideoRef = (el: Element | ComponentPublicInstance | null, id: string) => {
  if (el && el instanceof HTMLVideoElement) {
    videoRefs.set(id, el)
  }
}

const togglePipExpanded = () => {
  // Toggle PiP view expanded state
  selection()
}

const getParticipantStatus = (participant: GroupCallParticipant) => {
  if (participant.muted) return '已静音'
  if (!participant.videoEnabled) return '未开启视频'
  if (participant.speaking) return '正在说话'
  return '在线'
}

const getConnectionStatusText = () => {
  switch (connectionStatus.value) {
    case 'connecting':
      return '连接中...'
    case 'failed':
      return '连接失败'
    default:
      return ''
  }
}

const startDurationTimer = () => {
  callStartTime = Date.now()
  durationTimer = window.setInterval(() => {
    callDuration.value = Math.floor((Date.now() - callStartTime) / 1000)
  }, 1000)
}

const stopDurationTimer = () => {
  if (durationTimer) {
    clearInterval(durationTimer)
    durationTimer = null
  }
}

const cleanup = () => {
  // Stop local streams
  if (localVideoStream.value) {
    localVideoStream.value.getTracks().forEach((track) => track.stop())
    localVideoStream.value = null
  }

  // Clear video refs
  videoRefs.clear()
  videoStreams.value = []
}

const getTurnServers = async (): Promise<RTCIceServer[]> => {
  try {
    const client = matrixClientService.getClient()
    if (!client) return []

    // This would fetch TURN servers from the homeserver
    // For now, return default STUN servers
    return [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]
  } catch {
    return []
  }
}

// Lifecycle
onMounted(() => {
  // Load initial participants from room
  loadRoomParticipants()
})

onUnmounted(() => {
  cleanup()
})

const loadRoomParticipants = async () => {
  try {
    const client = matrixClientService.getClient()
    if (!client) return

    // Type assertion for Matrix client methods
    const extendedClient = client as {
      getRoom: (roomId: string) =>
        | {
            getJoinedMembers: () => Array<{
              userId: string
              name?: string
              getAvatarUrl?: (baseUrl: string, width: number, height: number, method: string) => string
            }>
          }
        | undefined
      getUserId: () => string
      baseUrl: string
    }

    const room = extendedClient.getRoom(props.roomId)
    if (!room) return

    const members = room.getJoinedMembers()
    const currentUserId = extendedClient.getUserId()

    participants.value = members
      .filter((m: { userId: string }) => m.userId !== currentUserId)
      .map(
        (m: {
          userId: string
          name?: string
          getAvatarUrl?: (baseUrl: string, width: number, height: number, method: string) => string
        }) => ({
          userId: m.userId,
          deviceId: '',
          displayName: m.name || m.userId,
          avatar: m.getAvatarUrl?.(extendedClient.baseUrl, 80, 80, 'crop') || '',
          muted: false,
          videoEnabled: false,
          connectionState: 'new'
        })
      )
  } catch (error) {
    logger.error('[MobileGroupCall] Failed to load participants:', error)
  }
}

// Watch call type changes
watch(callType, (_newType) => {
  if (isInCall.value) {
    // Would need to re-negotiate with new type
    message.info('切换通话类型需要重新加入')
  }
})
</script>

<style scoped lang="scss">
.mobile-group-call {
  position: fixed;
  inset: 0;
  background: var(--bg-color);
  z-index: 9999;
  display: flex;
  flex-direction: column;

  &.in-call {
    background: var(--hula-black);
  }
}

// Setup Screen
.call-setup {
  flex: 1;
  padding: 20px;
  overflow-y: auto;

  .setup-header {
    text-align: center;
    margin-bottom: 24px;

    h2 {
      margin: 16px 0 8px;
      font-size: 24px;
      color: var(--text-color-1);
    }

    p {
      color: var(--text-color-3);
      font-size: 14px;
    }
  }

  .setup-options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    margin-bottom: 24px;

    .option-card {
      padding: 24px;
      background: var(--card-color);
      border-radius: 16px;
      text-align: center;
      cursor: pointer;
      border: 2px solid transparent;
      transition: all 0.2s;

      &:active {
        transform: scale(0.95);
      }

      &.selected {
        border-color: var(--primary-color);
        background: rgba(24, 160, 88, 0.1);
      }

      span {
        display: block;
        margin-top: 12px;
        font-size: 14px;
        color: var(--text-color-2);
      }
    }
  }

  .setup-participants {
    background: var(--card-color);
    border-radius: 16px;
    padding: 16px;
    margin-bottom: 24px;

    .participants-header {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-1);
      margin-bottom: 12px;
    }

    .participants-list {
      .participant-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 0;

        .participant-info {
          flex: 1;

          .participant-name {
            display: block;
            font-size: 14px;
            color: var(--text-color-1);
          }

          .participant-status {
            font-size: 12px;
            color: var(--text-color-3);
          }
        }
      }
    }

    .empty-participants {
      text-align: center;
      padding: 32px 16px;
      color: var(--text-color-3);
    }
  }

  .setup-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
}

// Active Call Screen
.active-call {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;

  // Video Grid
  .video-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-auto-rows: 1fr;
    gap: 2px;
    background: var(--hula-black);

    .video-tile {
      position: relative;
      background: var(--hula-gray-800);
      overflow: hidden;

      &.local-stream {
        grid-column: 2;
        grid-row: 1;
      }

      &.speaking {
        border: 2px solid #18a058;
      }

      video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .video-label {
        position: absolute;
        bottom: 8px;
        left: 8px;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background: rgba(var(--hula-black-rgb), 0.6);
        border-radius: 4px;
        color: white;
        font-size: 12px;
      }

      .speaking-indicator {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 12px;
        height: 12px;
        background: #18a058;
        border-radius: 50%;
        animation: pulse 1s infinite;
      }
    }

    .local-pip {
      position: absolute;
      bottom: 100px;
      right: 16px;
      width: 120px;
      height: 160px;
      background: var(--hula-black);
      border-radius: 12px;
      border: 2px solid rgba(var(--hula-white-rgb), 0.3);
      overflow: hidden;
      z-index: 10;

      video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
  }

  // Voice Call Layout
  .voice-call {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px;

    .room-avatar {
      margin-bottom: 24px;
    }

    .room-name {
      font-size: 24px;
      color: white;
      margin-bottom: 16px;
    }

    .speaking-now {
      display: flex;
      align-items: center;
      gap: 8px;
      color: rgba(var(--hula-white-rgb), 0.8);
      font-size: 14px;
      margin-bottom: 24px;

      .avatar-wave {
        width: 8px;
        height: 8px;
        background: #18a058;
        border-radius: 50%;
        animation: pulse 1.5s infinite;
      }
    }

    .call-duration {
      font-size: 32px;
      font-weight: 300;
      color: white;
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      margin-bottom: 32px;
    }

    .participants-scroll {
      width: 100%;
      overflow-x: auto;
      margin-bottom: 32px;

      .participant-avatar-row {
        display: flex;
        gap: 16px;
        padding: 0 16px;
        justify-content: center;

        :deep(.n-avatar) {
          border: 2px solid transparent;
          transition: all 0.2s;

          &.speaking {
            border-color: #18a058;
            transform: scale(1.1);
          }

          &.muted {
            opacity: 0.6;
          }
        }
      }
    }
  }

  // Call Controls
  .call-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 24px;
    background: rgba(var(--hula-black-rgb), 0.8);
    backdrop-filter: blur(10px);

    .control-btn {
      flex-shrink: 0;

      &.secondary {
        background: rgba(var(--hula-white-rgb), 0.1);
        border: 1px solid rgba(var(--hula-white-rgb), 0.2);
      }

      &.muted,
      &.video-off {
        background: var(--error-color);
        border-color: var(--error-color);
      }

      &.end-call {
        width: 64px;
        height: 64px;
      }
    }
  }
}

// Call Ended Screen
.call-ended {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;

  .ended-content {
    text-align: center;
    max-width: 320px;

    h2 {
      margin: 24px 0 16px;
      font-size: 24px;
      color: var(--text-color-1);
    }

    .ended-duration {
      font-size: 14px;
      color: var(--text-color-3);
      margin-bottom: 32px;
    }

    .ended-stats {
      display: flex;
      justify-content: center;
      gap: 48px;
      margin-bottom: 32px;

      .stat-item {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: var(--primary-color);
        }

        .stat-label {
          font-size: 12px;
          color: var(--text-color-3);
        }
      }
    }
  }
}

// Connection Banner
.connection-banner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: rgba(var(--hula-black-rgb), 0.8);
  color: white;
  font-size: 14px;
  z-index: 100;

  &.connecting {
    background: rgba(240, 160, 32, 0.9);
  }

  &.failed {
    background: rgba(208, 48, 80, 0.9);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

// Safe area for mobile
@supports (padding: env(safe-area-inset-bottom)) {
  .call-controls {
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
    padding-bottom: env(safe-area-inset-bottom);
  }
}
</style>
