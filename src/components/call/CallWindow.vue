<template>
  <n-modal
    v-model:show="show"
    :mask-closable="false"
    :closable="false"
    :auto-focus="false"
    class="call-window-modal"
    :style="{ width: isMinimized ? '320px' : '800px', height: isMinimized ? '60px' : '600px' }">
    <template #header>
      <n-flex align="center" justify="space-between" class="w-full">
        <n-flex align="center" :size="12">
          <n-tag :type="callState === 'connected' ? 'success' : 'warning'" size="small">
            {{ t('call.state.' + callState) }}
          </n-tag>
          <span class="text-14px font-medium">{{ callDuration }}</span>
        </n-flex>
        <n-flex :size="8">
          <n-button size="small" text @click="toggleMinimize">
            <svg class="w-16px h-16px">
              <use :href="isMinimized ? '#maximize' : '#minimize'"></use>
            </svg>
          </n-button>
          <n-button size="small" text @click="toggleFullscreen">
            <svg class="w-16px h-16px">
              <use :href="isFullscreen ? '#compress' : '#expand'"></use>
            </svg>
          </n-button>
          <n-button size="small" text @click="handleEndCall">
            <svg class="w-16px h-16px text-red-500">
              <use href="#phone-x"></use>
            </svg>
          </n-button>
        </n-flex>
      </n-flex>
    </template>

    <div v-if="!isMinimized" class="call-window-content">
      <n-flex :size="0" class="h-full">
        <div class="remote-video-container flex-1">
          <video
            ref="remoteVideoRef"
            autoplay
            playsinline
            class="remote-video"
            :class="{ 'hidden': !remoteStream }" />
          <n-empty v-if="!remoteStream" :description="t('call.waiting_for_remote')" size="large" />
        </div>

        <div class="local-video-container" :class="{ 'hidden': !localStream }">
          <video
            ref="localVideoRef"
            autoplay
            muted
            playsinline
            class="local-video" />
        </div>
      </n-flex>

      <div class="call-controls">
        <n-flex justify="center" :size="16">
          <n-button circle :type="micEnabled ? 'default' : 'error'" @click="toggleMic">
            <template #icon>
              <svg class="w-20px h-20px">
                <use :href="micEnabled ? '#mic' : '#mic-off'"></use>
              </svg>
            </template>
          </n-button>

          <n-button circle :type="cameraEnabled ? 'default' : 'error'" @click="toggleCamera">
            <template #icon>
              <svg class="w-20px h-20px">
                <use :href="cameraEnabled ? '#video' : '#video-off'"></use>
              </svg>
            </template>
          </n-button>

          <n-button circle @click="toggleScreenShare" :disabled="!screenShareSupported">
            <template #icon>
              <svg class="w-20px h-20px">
                <use :href="isScreenSharing ? '#screen-share-on' : '#screen-share'"></use>
              </svg>
            </template>
          </n-button>

          <n-button circle @click="toggleChat">
            <template #icon>
              <svg class="w-20px h-20px">
                <use href="#message"></use>
              </svg>
            </template>
          </n-button>

          <n-button circle type="error" @click="handleEndCall">
            <template #icon>
              <svg class="w-20px h-20px">
                <use href="#phone-x"></use>
              </svg>
            </template>
          </n-button>
        </n-flex>

        <n-flex v-if="showChat" justify="center" :size="8" class="mt-4">
          <n-input
            v-model:value="chatMessage"
            :placeholder="t('call.type_message')"
            @keyup.enter="sendChatMessage" />
          <n-button type="primary" @click="sendChatMessage">
            {{ t('call.send') }}
          </n-button>
        </n-flex>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  show: boolean
  roomId?: string
  userId?: string
  isVideo: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isVideo: true
})

const emit = defineEmits<{
  (e: 'end'): void
  (e: 'minimize'): void
  (e: 'fullscreen'): void
  (e: 'chat', message: string): void
}>()

const { t } = useI18n()

const remoteVideoRef = ref<HTMLVideoElement>()
const localVideoRef = ref<HTMLVideoElement>()

const callState = ref<'idle' | 'ringing' | 'connected' | 'ended'>('idle')
const callDuration = ref('00:00')
const micEnabled = ref(true)
const cameraEnabled = ref(true)
const isScreenSharing = ref(false)
const showChat = ref(false)
const chatMessage = ref('')

const isMinimized = ref(false)
const isFullscreen = ref(false)

const remoteStream = ref<MediaStream | null>(null)
const localStream = ref<MediaStream | null>(null)

const screenShareSupported = computed(() => {
  return 'getDisplayMedia' in navigator.mediaDevices
})

let callStartTime: number | null = null
let durationInterval: number | null = null

const updateDuration = () => {
  if (!callStartTime) return

  const now = Date.now()
  const diff = Math.floor((now - callStartTime) / 1000)

  const minutes = Math.floor(diff / 60)
  const seconds = diff % 60

  callDuration.value = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const startDurationTimer = () => {
  callStartTime = Date.now()
  durationInterval = window.setInterval(updateDuration, 1000)
}

const stopDurationTimer = () => {
  if (durationInterval) {
    clearInterval(durationInterval)
    durationInterval = null
  }
  callStartTime = null
}

const toggleMic = async () => {
  if (localStream.value) {
    const audioTrack = localStream.value.getAudioTracks()[0]
    if (audioTrack) {
      micEnabled.value = !audioTrack.enabled
      audioTrack.enabled = micEnabled.value
    }
  }
}

const toggleCamera = async () => {
  if (localStream.value) {
    const videoTrack = localStream.value.getVideoTracks()[0]
    if (videoTrack) {
      cameraEnabled.value = !videoTrack.enabled
      videoTrack.enabled = cameraEnabled.value
    }
  }
}

const toggleScreenShare = async () => {
  try {
    console.warn('[CallWindow] Screen share not fully implemented')
  } catch (error) {
    console.error('Failed to toggle screen share:', error)
    window.$message.error(t('call.screen_share_failed'))
  }
}

const toggleChat = () => {
  showChat.value = !showChat.value
}

const sendChatMessage = () => {
  if (!chatMessage.value.trim()) return

  emit('chat', chatMessage.value)
  chatMessage.value = ''
}

const handleEndCall = () => {
  stopDurationTimer()

  if (localStream.value) {
    localStream.value.getTracks().forEach((track) => track.stop())
    localStream.value = null
  }

  if (remoteStream.value) {
    remoteStream.value.getTracks().forEach((track) => track.stop())
    remoteStream.value = null
  }

  callState.value = 'ended'
  emit('end')
}

const toggleMinimize = () => {
  isMinimized.value = !isMinimized.value
  emit('minimize')
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  emit('fullscreen')
}

watch(
  () => props.show,
  (newShow) => {
    if (newShow) {
      callState.value = 'ringing'
      setTimeout(() => {
        if (callState.value === 'ringing') {
          callState.value = 'connected'
          startDurationTimer()
        }
      }, 3000)
    } else {
      stopDurationTimer()
      callState.value = 'idle'
      callDuration.value = '00:00'
    }
  }
)

onBeforeUnmount(() => {
  stopDurationTimer()

  if (localStream.value) {
    localStream.value.getTracks().forEach((track) => track.stop())
  }

  if (remoteStream.value) {
    remoteStream.value.getTracks().forEach((track) => track.stop())
  }
})
</script>

<style scoped>
.call-window-modal {
  background: var(--bg-color);
}

.call-window-content {
  display: flex;
  flex-direction: column;
  height: calc(100% - 60px);
}

.remote-video-container {
  position: relative;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remote-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.local-video-container {
  position: absolute;
  bottom: 120px;
  right: 20px;
  width: 200px;
  height: 150px;
  background: #000;
  border: 2px solid #fff;
  border-radius: 8px;
  overflow: hidden;
}

.local-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.call-controls {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  padding: 16px 24px;
  border-radius: 50px;
  backdrop-filter: blur(10px);
}

.hidden {
  display: none;
}
</style>
