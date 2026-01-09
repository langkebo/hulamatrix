<template>
  <div class="call-interface" :class="{ 'is-minimized': isMinimized, 'is-fullscreen': isFullscreen }">
    <!-- 主通话界面 -->
    <div v-if="!isMinimized" class="call-main">
      <!-- 视频区域 -->
      <div class="video-area">
        <!-- 远程视频 -->
        <div class="remote-video-container" v-if="callType === 'video' || remoteStream">
          <video
            ref="remoteVideoRef"
            class="remote-video"
            :srcObject="remoteStream"
            autoplay
            playsinline
            muted
          />

          <!-- 远程用户信息叠加层 -->
          <div class="remote-overlay">
            <div class="participant-info">
              <n-avatar
                :src="remoteParticipant?.avatar || ''"
                :size="48"
                round
                :fallback="remoteParticipant?.name?.charAt(0) || '?'"
              />
              <div class="participant-details">
                <div class="participant-name">{{ remoteParticipant?.name || 'Unknown' }}</div>
                <div class="call-status">{{ getCallStatusText() }}</div>
              </div>
            </div>

            <!-- 网络质量指示器 -->
            <div class="network-quality">
              <n-tag
                :type="networkQuality.type"
                size="small"
                round
              >
                {{ networkQuality.text }}
              </n-tag>
            </div>
          </div>
        </div>

        <!-- 本地视频画中画 -->
        <div
          v-if="callType === 'video' && localStream && !isLocalVideoHidden"
          class="local-video-container"
          :class="{ 'dragging': isDraggingLocal }"
          @mousedown="startDragLocalVideo"
        >
          <video
            ref="localVideoRef"
            class="local-video"
            :srcObject="localStream"
            autoplay
            playsinline
            muted
          />
          <div class="local-video-controls">
            <n-button
              quaternary
              circle
              size="tiny"
              @click="toggleLocalVideo"
            >
              <template #icon>
                <n-icon><EyeOff /></n-icon>
              </template>
            </n-button>
          </div>
        </div>

        <!-- 音频通话时的用户头像 -->
        <div v-else-if="callType === 'audio'" class="audio-call-display">
          <div class="participant-avatar">
            <n-avatar
              :src="remoteParticipant?.avatar || ''"
              :size="120"
              round
              :fallback="remoteParticipant?.name?.charAt(0) || '?'
            "
            />
          </div>
          <div class="participant-name">{{ remoteParticipant?.name || 'Unknown' }}</div>
          <div class="call-duration">{{ formatCallDuration(callDuration) }}</div>
        </div>

        <!-- 等待接听界面 -->
        <div v-if="callState === 'calling'" class="calling-screen">
          <div class="calling-animation">
            <n-spin size="large" />
          </div>
          <div class="calling-text">正在呼叫 {{ remoteParticipant?.name }}...</div>
        </div>
      </div>

      <!-- 控制面板 -->
      <div class="control-panel">
        <div class="primary-controls">
          <!-- 麦克风开关 -->
          <n-button
            :type="isMuted ? 'error' : 'default'"
            circle
            size="large"
            @click="toggleMicrophone"
            :disabled="!localStream"
          >
            <template #icon>
              <n-icon>
                <MicrophoneOff v-if="isMuted" />
                <Microphone v-else />
              </n-icon>
            </template>
          </n-button>

          <!-- 摄像头开关 (仅视频通话) -->
          <n-button
            v-if="callType === 'video'"
            :type="isCameraOff ? 'error' : 'default'"
            circle
            size="large"
            @click="toggleCamera"
            :disabled="!localStream"
          >
            <template #icon>
              <n-icon>
                <VideoOff v-if="isCameraOff" />
                <Video v-else />
              </n-icon>
            </template>
          </n-button>

          <!-- 结束通话 -->
          <n-button
            type="error"
            circle
            size="large"
            @click="endCall"
          >
            <template #icon>
              <n-icon><PhoneOff /></n-icon>
            </template>
          </n-button>

          <!-- 切换摄像头 (仅移动端视频通话) -->
  <n-button
            v-if="callType === 'video' && isMobile()"
            quaternary
            circle
            size="large"
            @click="switchCamera"
            :disabled="!localStream"
          >
            <template #icon>
              <n-icon><CameraRotate /></n-icon>
            </template>
          </n-button>
        </div>

        <div class="secondary-controls">
          <!-- 扬声器开关 -->
          <n-button
            quaternary
            circle
            @click="toggleSpeaker"
            :type="isSpeakerOn ? 'default' : 'warning'"
          >
            <template #icon>
              <n-icon>
                <Volume v-if="!isSpeakerOn" />
                <Volume2 v-else />
              </n-icon>
            </template>
          </n-button>

          <!-- 屏幕共享 -->
          <n-button
            v-if="callType === 'video' && !isMobile"
            quaternary
            circle
            @click="toggleScreenShare"
            :type="isScreenSharing ? 'primary' : 'default'"
            :loading="isTogglingScreenShare"
          >
            <template #icon>
              <n-icon><DeviceComputerCamera /></n-icon>
            </template>
          </n-button>

          <!-- 录制 -->
          <n-button
            quaternary
            circle
            @click="toggleRecording"
            :type="isRecording ? 'error' : 'default'"
            :loading="isTogglingRecording"
          >
            <template #icon>
              <n-icon><Radio /></n-icon>
            </template>
          </n-button>

          <!-- 通话设置 -->
          <n-button
            quaternary
            circle
            @click="showCallSettings = true"
          >
            <template #icon>
              <n-icon><Settings /></n-icon>
            </template>
          </n-button>

          <!-- 最小化 -->
          <n-button
            quaternary
            circle
            @click="minimizeCall"
          >
            <template #icon>
              <n-icon><ArrowsDiagonalMinimize2 /></n-icon>
            </template>
          </n-button>

          <!-- 全屏 -->
          <n-button
            quaternary
            circle
            @click="toggleFullscreen"
          >
            <template #icon>
              <n-icon>
                <Minimize v-if="isFullscreen" />
                <ArrowsMaximize v-else />
              </n-icon>
            </template>
          </n-button>
        </div>
      </div>
    </div>

    <!-- 最小化通话窗口 -->
    <div v-else class="minimized-call">
      <div class="minimized-content" @click="restoreCall">
        <div class="call-icon">
          <n-icon size="20">
            <Phone v-if="callType === 'audio'" />
            <Video v-else />
          </n-icon>
        </div>
        <div class="call-info">
          <div class="participant-name">{{ remoteParticipant?.name || '通话中' }}</div>
          <div class="call-duration">{{ formatCallDuration(callDuration) }}</div>
        </div>
      </div>
      <n-button
        quaternary
        circle
        size="small"
        @click.stop="endCall"
      >
        <template #icon>
          <n-icon><PhoneOff /></n-icon>
        </template>
      </n-button>
    </div>

    <!-- 通话设置抽屉 -->
    <n-drawer
      v-model:show="showCallSettings"
      :width="400"
      placement="right"
    >
      <CallSettings
        :call-type="callType"
        :local-stream="localStream"
        @closed="showCallSettings = false"
      />
    </n-drawer>

    <!-- 录制指示器 -->
    <div v-if="isRecording" class="recording-indicator">
      <n-icon color="var(--hula-brand-primary)"><Radio /></n-icon>
      <span>录制中</span>
    </div>

    <!-- 网络状态通知移除 -->
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

import { NButton, NIcon, NAvatar, NTag, NSpin, NDrawer } from 'naive-ui'

import {
  Microphone,
  MicrophoneOff,
  Video,
  VideoOff,
  PhoneOff,
  CameraRotate,
  Volume2,
  Volume,
  DeviceComputerCamera,
  Radio,
  Settings,
  ArrowsDiagonalMinimize2,
  ArrowsMaximize,
  Minimize,
  Phone,
  EyeOff
} from '@vicons/tabler'

import type { MediaStream } from '@/types/rtc'
import { usePlatformConstants } from '@/utils/PlatformConstants'
import { msg } from '@/utils/SafeUI'
import { CallTypeEnum } from '@/enums'
import CallSettings from './CallSettings.vue'
import { logger } from '@/utils/logger'
import { useCallControls } from '@/composables'

interface Props {
  roomId: string
  callId: string
  callType: 'audio' | 'video'
  isInitiator: boolean
  remoteParticipant?: { userId: string; name?: string; avatar?: string }
}

// HTMLVideoElement setSinkId类型扩展（实验性API）
type HTMLVideoElementWithSinkId = HTMLVideoElement & {
  setSinkId?: (sinkId: string) => Promise<void>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'call-ended': [callId: string]
  'call-state-changed': [state: string]
}>()

const message = msg
const { isMobile } = usePlatformConstants()

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
  toggleMicrophone,
  toggleCamera,
  toggleSpeaker: toggleSpeakerBase,
  toggleLocalVideo,
  switchCamera
} = useCallControls({
  roomId: props.roomId,
  remoteUserId: props.remoteParticipant?.userId || '',
  callType: props.callType,
  isInitiator: props.isInitiator
})

// Desktop-specific state
const isMinimized = ref(false)
const isFullscreen = ref(false)
const showCallSettings = ref(false)

// Desktop-specific features
const isScreenSharing = ref(false)
const isRecording = ref(false)
const isTogglingScreenShare = ref(false)
const isTogglingRecording = ref(false)

// 录制相关状态
const mediaRecorder = ref<MediaRecorder | null>(null)
const recordedChunks = ref<Blob[]>([])
const recordingStartTime = ref(0)

// UI state
const isDraggingLocal = ref(false)
const localVideoPosition = ref({ x: 20, y: 20 })
const dragOffset = { x: 0, y: 0 }

// Video refs
const remoteVideoRef = ref<HTMLVideoElement>()
const localVideoRef = ref<HTMLVideoElement>()

// Network quality
const networkQuality = { type: 'default' as const, text: '检测中' }

// ========== Desktop-specific methods ==========

const startCall = async () => {
  await startCallBase()

  // Set local video element source
  if (localVideoRef.value && localStream.value) {
    localVideoRef.value.srcObject = localStream.value
  }

  emit('call-state-changed', 'connected')
}

const endCall = async () => {
  // Stop recording
  if (isRecording.value) {
    await stopRecording()
  }

  // Stop screen share
  if (isScreenSharing.value) {
    await stopScreenShare()
  }

  await endCallBase()
  emit('call-ended', props.callId)
}

const toggleSpeaker = () => {
  toggleSpeakerBase(remoteVideoRef)
}

// ========== 屏幕共享 (Desktop-specific) ==========

const toggleScreenShare = async () => {
  if (isScreenSharing.value) {
    await stopScreenShare()
  } else {
    await startScreenShare()
  }
}

const startScreenShare = async () => {
  try {
    isTogglingScreenShare.value = true
    await rtc.startScreenShare()
    if (localVideoRef.value) {
      localVideoRef.value.srcObject = rtc.localStream.value
      isScreenSharing.value = true
      message.success('屏幕共享已开启')
    }
  } catch (error) {
    logger.error('Failed to start screen share:', error)
    message.error('无法开启屏幕共享')
  } finally {
    isTogglingScreenShare.value = false
  }
}

const stopScreenShare = async () => {
  try {
    isTogglingScreenShare.value = true
    await rtc.stopScreenShare()

    // Restore camera video
    if (props.callType === 'video' && localStream.value && localVideoRef.value) {
      localVideoRef.value.srcObject = localStream.value
    }

    isScreenSharing.value = false
    message.info('屏幕共享已停止')
  } catch (error) {
    logger.error('Failed to stop screen share:', error)
  } finally {
    isTogglingScreenShare.value = false
  }
}

// ========== 录制功能 (Desktop-specific) ==========

const toggleRecording = async () => {
  if (isRecording.value) {
    await stopRecording()
  } else {
    await startRecording()
  }
}

const startRecording = async () => {
  try {
    isTogglingRecording.value = true

    // 检查是否有可用的流
    if (!remoteStream.value && !localStream.value) {
      message.warning('没有可用的视频流进行录制')
      return
    }

    // 创建合成流（包含远程和本地流）
    const streamsToRecord: MediaStream[] = []
    if (remoteStream.value) streamsToRecord.push(remoteStream.value)
    if (localStream.value) streamsToRecord.push(localStream.value)

    // 使用第一个流作为基础，然后添加其他流的轨道
    const combinedStream = new MediaStream()
    streamsToRecord.forEach((stream) => {
      stream.getTracks().forEach((track) => {
        combinedStream.addTrack(track)
      })
    })

    // 创建 MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm'

    mediaRecorder.value = new MediaRecorder(combinedStream, { mimeType })

    // 设置事件监听
    recordedChunks.value = []
    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.value.push(event.data)
      }
    }

    mediaRecorder.value.onstop = () => {
      // 创建 Blob 并触发下载
      const blob = new Blob(recordedChunks.value, { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `call-recording-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(url)

      logger.info('[CallInterface] 录制已保存', { size: blob.size, duration: Date.now() - recordingStartTime.value })
    }

    // 开始录制
    mediaRecorder.value.start(1000) // 每秒保存一次数据块
    recordingStartTime.value = Date.now()
    isRecording.value = true

    logger.info('[CallInterface] 录制已开始', { mimeType, tracks: combinedStream.getTracks().length })
    message.success('录制已开始')
  } catch (error) {
    logger.error('[CallInterface] Failed to start recording:', error)
    message.error('无法开始录制')
  } finally {
    isTogglingRecording.value = false
  }
}

const stopRecording = async () => {
  try {
    isTogglingRecording.value = true

    if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
      mediaRecorder.value.stop()
      const duration = Date.now() - recordingStartTime.value
      logger.info('[CallInterface] 录制已停止', { duration })
    }

    isRecording.value = false
    message.success('录制已停止')
  } catch (error) {
    logger.error('[CallInterface] Failed to stop recording:', error)
  } finally {
    isTogglingRecording.value = false
  }
}

// ========== UI控制 (Desktop-specific) ==========

const minimizeCall = () => {
  isMinimized.value = true
}

const restoreCall = () => {
  isMinimized.value = false
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value

  if (isFullscreen.value) {
    document.documentElement.requestFullscreen?.()
  } else {
    document.exitFullscreen?.()
  }
}

const startDragLocalVideo = (event: MouseEvent) => {
  isDraggingLocal.value = true
  dragOffset.x = event.clientX - localVideoPosition.value.x
  dragOffset.y = event.clientY - localVideoPosition.value.y

  document.addEventListener('mousemove', onDragLocalVideo)
  document.addEventListener('mouseup', stopDragLocalVideo)
}

const onDragLocalVideo = (event: MouseEvent) => {
  if (isDraggingLocal.value) {
    localVideoPosition.value = {
      x: event.clientX - dragOffset.x,
      y: event.clientY - dragOffset.y
    }
  }
}

const stopDragLocalVideo = () => {
  isDraggingLocal.value = false
  document.removeEventListener('mousemove', onDragLocalVideo)
  document.removeEventListener('mouseup', stopDragLocalVideo)
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

// ========== 监听器 ==========

watch(
  () => props.callId,
  (newCallId) => {
    if (newCallId) {
      startCall()
    }
  },
  { immediate: true }
)

// ========== 生命周期 ==========

onMounted(() => {
  // Sync remote stream display
  watch(
    rtc.remoteStream,
    (s) => {
      if (s && remoteVideoRef.value) {
        remoteVideoRef.value.srcObject = s
        try {
          const sinkId = localStorage.getItem('voice_audio_output') || ''
          const el = remoteVideoRef.value as unknown as HTMLVideoElementWithSinkId
          if (el && typeof el.setSinkId === 'function' && sinkId) {
            void el.setSinkId(sinkId)
          }
        } catch {}
      }
    },
    { immediate: true }
  )
})

onUnmounted(() => {
  endCall()
})
</script>

<style lang="scss" scoped>
.call-interface {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-color);
  z-index: 1000;
  display: flex;
  flex-direction: column;

  &.is-minimized {
    position: fixed;
    bottom: 20px;
    right: 20px;
    top: auto;
    left: auto;
    width: 280px;
    height: 80px;
    background: var(--card-color);
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  }

  &.is-fullscreen {
    background: #000;
  }
}

.call-main {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.video-area {
  flex: 1;
  position: relative;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;

  .remote-video-container {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;

    .remote-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .remote-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      background: linear-gradient(to bottom, rgba(0,0,0,0.5), transparent);

      .participant-info {
        display: flex;
        align-items: center;
        gap: 12px;

        .participant-details {
          .participant-name {
            color: white;
            font-weight: 600;
            font-size: 18px;
            margin-bottom: 4px;
          }

          .call-status {
            color: rgba(255, 255, 255, 0.8);
            font-size: 14px;
          }
        }
      }

      .network-quality {
        position: absolute;
        top: 20px;
        right: 20px;
      }
    }
  }

  .local-video-container {
    position: absolute;
    width: 160px;
    height: 120px;
    bottom: 120px;
    right: 20px;
    background: var(--card-color);
    border-radius: 8px;
    overflow: hidden;
    cursor: move;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    transition: transform 0.1s ease;

    &.dragging {
      cursor: grabbing;
    }

    .local-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .local-video-controls {
      position: absolute;
      top: 8px;
      right: 8px;
      opacity: 0;
      transition: opacity 0.2s ease;

      &:hover {
        opacity: 1;
      }
    }

    &:hover .local-video-controls {
      opacity: 1;
    }
  }

  .audio-call-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;

    .participant-avatar {
      animation: pulse 2s infinite;
    }

    .participant-name {
      font-size: 24px;
      font-weight: 600;
      color: var(--text-color-1);
    }

    .call-duration {
      font-size: 18px;
      color: var(--text-color-2);
    }
  }

  .calling-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;

    .calling-text {
      font-size: 18px;
      color: var(--text-color-1);
    }
  }
}

.control-panel {
  background: var(--card-color);
  border-top: 1px solid var(--border-color);
  padding: 20px;

  .primary-controls {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-bottom: 16px;
  }

  .secondary-controls {
    display: flex;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
  }
}

.minimized-call {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 12px;

  .minimized-content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;

    .call-icon {
      width: 40px;
      height: 40px;
      background: var(--primary-color);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .call-info {
      .participant-name {
        font-weight: 600;
        color: var(--text-color-1);
        margin-bottom: 4px;
      }

      .call-duration {
        font-size: 12px;
        color: var(--text-color-3);
      }
    }
  }
}

.recording-indicator {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(240, 160, 32, 0.9);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  z-index: 10;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

// 响应式设计
@media (max-width: 768px) {
  .call-interface:not(.is-minimized) {
    .local-video-container {
      width: 120px;
      height: 90px;
      bottom: 140px;
      right: 16px;
    }

    .control-panel {
      padding: 16px;

      .primary-controls {
        gap: 12px;
      }

      .secondary-controls {
        gap: 8px;
      }
    }
  }
}
</style>
