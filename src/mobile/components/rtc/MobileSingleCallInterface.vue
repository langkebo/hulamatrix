<!-- Mobile Single Call Interface - 1-on-1 call interface for mobile -->
<template>
  <div class="mobile-single-call" :class="{ 'is-audio': callType === 'audio' }">
    <!-- Video Call Layout -->
    <div v-if="callType === 'video'" class="video-layout">
      <!-- Remote Video (Full Screen) -->
      <div class="remote-video-container">
        <video ref="remoteVideoRef" class="remote-video" :srcObject="remoteStream" autoplay playsinline muted />

        <!-- Remote Overlay (Top) -->
        <div class="remote-overlay-top">
          <div class="participant-info">
            <n-avatar :src="remoteParticipant?.avatar || ''" :size="40" round>
              <template #fallback>
                <span>{{ remoteParticipant?.name?.charAt(0) || '?' }}</span>
              </template>
            </n-avatar>
            <div class="participant-details">
              <div class="participant-name">{{ remoteParticipant?.name || 'Unknown' }}</div>
              <div class="call-status">{{ getCallStatusText() }}</div>
            </div>
          </div>

          <!-- Call Duration -->
          <div v-if="callState === 'connected'" class="call-duration">
            {{ formatCallDuration(callDuration) }}
          </div>
        </div>

        <!-- Local Video (Picture in Picture) -->
        <div
          v-if="localStream && !isLocalVideoHidden"
          class="local-video-container"
          :class="{ dragging: isDraggingLocal }"
          @touchstart="startDragLocal"
          @touchmove="onDragLocal"
          @touchend="stopDragLocal"
          @click="toggleLocalVideo">
          <video
            ref="localVideoRef"
            class="local-video"
            :srcObject="localStream"
            autoplay
            playsinline
            muted
            :style="localVideoStyle" />
          <div v-if="isCameraOff" class="camera-off-indicator">
            <n-icon :size="32"><CameraOff /></n-icon>
          </div>
        </div>

        <!-- Waiting Screen -->
        <div v-if="callState === 'calling'" class="waiting-screen">
          <div class="caller-info">
            <n-avatar :src="remoteParticipant?.avatar || ''" :size="100" round>
              <template #fallback>
                <span style="font-size: 40px">{{ remoteParticipant?.name?.charAt(0) || '?' }}</span>
              </template>
            </n-avatar>
            <div class="caller-name">{{ remoteParticipant?.name }}</div>
            <div class="calling-animation">
              <n-spin size="large" />
            </div>
            <div class="calling-text">正在呼叫...</div>
          </div>
        </div>
      </div>

      <!-- Call Controls (Bottom) -->
      <div class="call-controls-bottom">
        <div class="primary-controls">
          <!-- Mute -->
          <n-button circle :type="isMuted ? 'error' : 'default'" :style="controlButtonStyle" @click="toggleMicrophone">
            <template #icon>
              <n-icon :size="24">
                <MicrophoneOff v-if="isMuted" />
                <Microphone v-else />
              </n-icon>
            </template>
          </n-button>

          <!-- Camera Toggle -->
          <n-button circle :type="isCameraOff ? 'error' : 'default'" :style="controlButtonStyle" @click="toggleCamera">
            <template #icon>
              <n-icon :size="24">
                <VideoOff v-if="isCameraOff" />
                <Video v-else />
              </n-icon>
            </template>
          </n-button>

          <!-- End Call -->
          <n-button circle type="error" :style="endCallButtonStyle" @click="endCall">
            <template #icon>
              <n-icon :size="28"><PhoneOff /></n-icon>
            </template>
          </n-button>

          <!-- Speaker Toggle -->
          <n-button
            circle
            :type="isSpeakerOn ? 'default' : 'warning'"
            :style="controlButtonStyle"
            @click="toggleSpeaker">
            <template #icon>
              <n-icon :size="24">
                <Volume v-if="!isSpeakerOn" />
                <Volume2 v-else />
              </n-icon>
            </template>
          </n-button>

          <!-- Switch Camera -->
          <n-button circle :style="controlButtonStyle" @click="switchCamera">
            <template #icon>
              <n-icon :size="24"><CameraRotate /></n-icon>
            </template>
          </n-button>
        </div>

        <div class="secondary-controls">
          <!-- Hide Local Video -->
          <n-button text :style="{ color: 'white' }" @click="toggleLocalVideo">
            <template #icon>
              <n-icon :size="20">
                <EyeOff v-if="!isLocalVideoHidden" />
                <Eye v-else />
              </n-icon>
            </template>
            {{ isLocalVideoHidden ? '显示我' : '隐藏我' }}
          </n-button>
        </div>
      </div>
    </div>

    <!-- Audio Call Layout -->
    <div v-else class="audio-layout">
      <!-- Background Pulse -->
      <div class="pulse-background">
        <div class="pulse-circle" v-for="i in 3" :key="i"></div>
      </div>

      <!-- Content -->
      <div class="audio-content">
        <!-- Avatar -->
        <div class="avatar-container">
          <n-avatar :src="remoteParticipant?.avatar || ''" :size="150" round>
            <template #fallback>
              <span style="font-size: 60px">{{ remoteParticipant?.name?.charAt(0) || '?' }}</span>
            </template>
          </n-avatar>
        </div>

        <!-- Participant Name -->
        <div class="participant-name-large">{{ remoteParticipant?.name || 'Unknown' }}</div>

        <!-- Call Status/Duration -->
        <div class="call-info">
          <div v-if="callState === 'calling'" class="calling-status">
            <n-spin size="small" />
            <span>正在呼叫...</span>
          </div>
          <div v-else class="call-duration-large">
            {{ formatCallDuration(callDuration) }}
          </div>
        </div>

        <!-- Controls -->
        <div class="audio-controls">
          <!-- Mute -->
          <n-button circle :type="isMuted ? 'error' : 'default'" :style="audioControlStyle" @click="toggleMicrophone">
            <template #icon>
              <n-icon :size="28">
                <MicrophoneOff v-if="isMuted" />
                <Microphone v-else />
              </n-icon>
            </template>
          </n-button>

          <!-- Speaker -->
          <n-button
            circle
            :type="isSpeakerOn ? 'default' : 'warning'"
            :style="audioControlStyle"
            @click="toggleSpeaker">
            <template #icon>
              <n-icon :size="28">
                <Volume v-if="!isSpeakerOn" />
                <Volume2 v-else />
              </n-icon>
            </template>
          </n-button>

          <!-- End Call -->
          <n-button circle type="error" :style="audioEndCallStyle" @click="endCall">
            <template #icon>
              <n-icon :size="32"><PhoneOff /></n-icon>
            </template>
          </n-button>
        </div>
      </div>
    </div>

    <!-- Incoming Call Sheet (if not initiator) -->
    <div v-if="showIncomingSheet" class="incoming-call-sheet">
      <div class="sheet-content">
        <n-avatar :src="remoteParticipant?.avatar || ''" :size="80" round>
          <template #fallback>
            <span style="font-size: 32px">{{ remoteParticipant?.name?.charAt(0) || '?' }}</span>
          </template>
        </n-avatar>
        <div class="caller-name">{{ remoteParticipant?.name }}</div>
        <div class="call-type-text">{{ callType === 'video' ? '视频通话' : '语音通话' }}</div>

        <div class="incoming-actions">
          <n-button circle type="error" :style="incomingActionStyle" @click="rejectCall">
            <template #icon>
              <n-icon :size="28"><PhoneOff /></n-icon>
            </template>
          </n-button>
          <n-button circle type="success" :style="incomingActionStyle" @click="acceptCall">
            <template #icon>
              <n-icon :size="28"><Phone /></n-icon>
            </template>
          </n-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { NButton, NIcon, NAvatar, NSpin, useMessage } from 'naive-ui'
import {
  Microphone,
  MicrophoneOff,
  Video,
  VideoOff,
  PhoneOff,
  Phone,
  CameraRotate,
  Volume,
  Volume2,
  Eye,
  EyeOff,
  CameraOff as CameraOffIcon
} from '@vicons/tabler'
import { CallTypeEnum } from '@/enums'
import { logger } from '@/utils/logger'
import { msg } from '@/utils/SafeUI'
import { useCallControls } from '@/composables'

interface Props {
  roomId: string
  callId: string
  callType: 'audio' | 'video'
  isInitiator: boolean
  remoteParticipant?: { userId: string; name?: string; avatar?: string }
  isIncoming?: boolean
}

interface Emits {
  (e: 'call-ended', callId: string): void
  (e: 'call-answered'): void
  (e: 'call-rejected'): void
}

const props = withDefaults(defineProps<Props>(), {
  isIncoming: false
})

const emit = defineEmits<Emits>()
const message = msg

// Use the shared composable for call controls
const {
  callState,
  callDuration,
  localStream,
  remoteStream,
  isMuted,
  isCameraOff,
  isSpeakerOn,
  isLocalVideoHidden,
  rtc,
  callStatusText,
  formattedDuration,
  startCall: startCallBase,
  endCall: endCallBase,
  acceptCall: acceptCallBase,
  rejectCall: rejectCallBase,
  toggleMicrophone,
  toggleCamera,
  toggleLocalVideo,
  switchCamera
} = useCallControls({
  roomId: props.roomId,
  remoteUserId: props.remoteParticipant?.userId || '',
  callType: props.callType,
  isInitiator: props.isInitiator
})

// Mobile-specific state
const showIncomingSheet = ref(!props.isInitiator && props.isIncoming)

// UI state
const isDraggingLocal = ref(false)
const localVideoPosition = ref({ x: 16, y: 200 })

// Video refs
const remoteVideoRef = ref<HTMLVideoElement>()
const localVideoRef = ref<HTMLVideoElement>()

// Touch drag state
const dragStartPos = ref({ x: 0, y: 0 })
const dragStartVideoPos = ref({ x: 0, y: 0 })

// Computed styles
const controlButtonStyle = {
  width: '56px',
  height: '56px',
  backgroundColor: 'rgba(var(--hula-white-rgb), 0.2)',
  border: 'none',
  color: 'white'
}

const endCallButtonStyle = {
  width: '64px',
  height: '64px',
  backgroundColor: '#f0a020'
}

const audioControlStyle = {
  width: '64px',
  height: '64px',
  backgroundColor: 'rgba(var(--hula-white-rgb), 0.15)',
  border: 'none',
  color: 'white'
}

const audioEndCallStyle = {
  width: '72px',
  height: '72px',
  backgroundColor: '#f0a020'
}

const incomingActionStyle = {
  width: '64px',
  height: '64px'
}

const localVideoStyle = computed(() => ({
  transform: `translate(${localVideoPosition.value.x}px, ${localVideoPosition.value.y}px)`
}))

// ========== Mobile-specific methods ==========

// Local toggleSpeaker that uses remoteVideoRef
const toggleSpeaker = () => {
  if (remoteVideoRef.value) {
    remoteVideoRef.value.muted = isSpeakerOn.value
    isSpeakerOn.value = !isSpeakerOn.value
  }
}

const startCall = async () => {
  await startCallBase()

  // Set local video element source
  if (localVideoRef.value && localStream.value) {
    localVideoRef.value.srcObject = localStream.value
  }

  showIncomingSheet.value = false
}

const endCall = async () => {
  await endCallBase()
  emit('call-ended', props.callId)
}

const acceptCall = async () => {
  await acceptCallBase()

  // Set local video element source
  if (localVideoRef.value && localStream.value) {
    localVideoRef.value.srcObject = localStream.value
  }

  showIncomingSheet.value = false
  emit('call-answered')
}

const rejectCall = async () => {
  await rejectCallBase()
  emit('call-rejected')
}

// Touch drag handlers (mobile-specific)
const startDragLocal = (event: TouchEvent) => {
  isDraggingLocal.value = true
  dragStartPos.value = {
    x: event.touches[0].clientX,
    y: event.touches[0].clientY
  }
  dragStartVideoPos.value = { ...localVideoPosition.value }
}

const onDragLocal = (event: TouchEvent) => {
  if (isDraggingLocal.value) {
    const deltaX = event.touches[0].clientX - dragStartPos.value.x
    const deltaY = event.touches[0].clientY - dragStartPos.value.y

    localVideoPosition.value = {
      x: dragStartVideoPos.value.x + deltaX,
      y: dragStartVideoPos.value.y + deltaY
    }
  }
}

const stopDragLocal = () => {
  isDraggingLocal.value = false
}

// ========== Helper functions (from composable) ==========

const getCallStatusText = () => callStatusText.value
const formatCallDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }
}

// ========== Watchers ==========

watch(
  () => props.callId,
  (newCallId) => {
    if (newCallId && props.isInitiator) {
      startCall()
    }
  },
  { immediate: true }
)

// Sync remote stream
watch(
  rtc.remoteStream,
  (stream) => {
    if (stream && remoteVideoRef.value) {
      remoteVideoRef.value.srcObject = stream
    }
  },
  { immediate: true }
)

// ========== Lifecycle ==========

onMounted(() => {
  if (!props.isInitiator && props.isIncoming) {
    showIncomingSheet.value = true
  }
})

onUnmounted(() => {
  endCall()
})

// ========== Expose methods ==========

defineExpose({
  endCall,
  acceptCall,
  rejectCall
})
</script>

<style scoped lang="scss">
.mobile-single-call {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--hula-black);
  z-index: 1000;
  overflow: hidden;

  &.is-audio {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
}

// Video Layout
.video-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.remote-video-container {
  flex: 1;
  position: relative;
  overflow: hidden;

  .remote-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .remote-overlay-top {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    padding: 16px;
    padding-top: max(16px, env(safe-area-inset-top));
    background: linear-gradient(to bottom, rgba(var(--hula-black-rgb), 0.6), transparent);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;

    .participant-info {
      display: flex;
      align-items: center;
      gap: 12px;

      .participant-details {
        .participant-name {
          color: white;
          font-weight: 600;
          font-size: 16px;
        }

        .call-status {
          color: rgba(var(--hula-white-rgb), 0.7);
          font-size: 12px;
        }
      }
    }

    .call-duration {
      color: white;
      font-size: 14px;
      font-weight: 500;
    }
  }

  .waiting-screen {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(var(--hula-black-rgb), 0.7);

    .caller-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;

      .caller-name {
        color: white;
        font-size: 24px;
        font-weight: 600;
      }

      .calling-text {
        color: white;
        font-size: 16px;
      }
    }
  }
}

.local-video-container {
  position: absolute;
  width: 120px;
  height: 160px;
  bottom: 180px;
  right: 16px;
  background: var(--hula-gray-900);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(var(--hula-black-rgb), 0.3);
  touch-action: none;

  &.dragging {
    opacity: 0.8;
  }

  .local-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.1s ease-out;
  }

  .camera-off-indicator {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(var(--hula-black-rgb), 0.5);
    color: white;
  }
}

.call-controls-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20px;
  padding-bottom: max(20px, env(safe-area-inset-bottom));
  background: linear-gradient(to top, rgba(var(--hula-black-rgb), 0.8), transparent);

  .primary-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .secondary-controls {
    display: flex;
    justify-content: center;
    gap: 8px;
  }
}

// Audio Layout
.audio-layout {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 20px;
}

.pulse-background {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  .pulse-circle {
    position: absolute;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background: rgba(var(--hula-white-rgb), 0.1);
    animation: pulse-audio 2s infinite;

    &:nth-child(2) {
      animation-delay: 0.5s;
    }

    &:nth-child(3) {
      animation-delay: 1s;
    }
  }
}

@keyframes pulse-audio {
  0% {
    transform: scale(1);
    opacity: 0.6;
  }
  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}

.audio-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  width: 100%;
  max-width: 400px;

  .avatar-container {
    animation: float 3s ease-in-out infinite;
  }

  .participant-name-large {
    color: white;
    font-size: 28px;
    font-weight: 600;
    text-align: center;
  }

  .call-info {
    .calling-status {
      display: flex;
      align-items: center;
      gap: 12px;
      color: white;
      font-size: 16px;
    }

    .call-duration-large {
      color: white;
      font-size: 32px;
      font-weight: 300;
    }
  }

  .audio-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 20px;
    margin-top: 40px;
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

// Incoming Call Sheet
.incoming-call-sheet {
  position: absolute;
  inset: 0;
  background: rgba(var(--hula-black-rgb), 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 40px;
  padding-top: max(40px, env(safe-area-inset-top));
  padding-bottom: max(40px, env(safe-area-inset-bottom));
  z-index: 10;

  .sheet-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    width: 100%;
    max-width: 320px;

    .caller-name {
      color: white;
      font-size: 24px;
      font-weight: 600;
    }

    .call-type-text {
      color: rgba(var(--hula-white-rgb), 0.7);
      font-size: 16px;
    }

    .incoming-actions {
      display: flex;
      gap: 40px;
      margin-top: 20px;
    }
  }
}

// Safe area support
@supports (padding: env(safe-area-inset-top)) {
  .remote-overlay-top {
    padding-top: max(16px, env(safe-area-inset-top));
  }

  .call-controls-bottom {
    padding-bottom: max(20px, env(safe-area-inset-bottom));
  }

  .incoming-call-sheet {
    padding-top: max(40px, env(safe-area-inset-top));
    padding-bottom: max(40px, env(safe-area-inset-bottom));
  }
}
</style>
