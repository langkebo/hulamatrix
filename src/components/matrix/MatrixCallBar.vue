<template>
  <div class="matrix-call-bar" :class="{ active: call.isActive }" @click="$emit('click')">
    <!-- 通话图标 -->
    <div class="call-icon">
      <n-icon
        :component="call.type === 'video' ? Video : Phone"
        :size="20"
        :color="call.isActive ? 'var(--n-success-color)' : 'var(--n-warning-color)'" />
    </div>

    <!-- 通话信息 -->
    <div class="call-info">
      <div class="call-title">
        <span>{{ call.type === 'video' ? '视频通话' : '语音通话' }}</span>
        <n-tag :type="getCallStateTagType(call.state)" size="small" round>
          {{ getCallStateText(call.state) }}
        </n-tag>
      </div>
      <div class="call-details">
        <span class="call-duration">{{ formatDuration(call.duration) }}</span>
        <span v-if="call.participantCount > 0" class="call-participants">{{ call.participantCount }} 位参与者</span>
      </div>
    </div>

    <!-- 通话控制按钮 -->
    <div class="call-controls" @click.stop>
      <!-- 静音按钮 -->
      <n-button quaternary circle size="small" :type="call.isMuted ? 'error' : 'default'" @click="handleToggleMute">
        <n-icon :component="call.isMuted ? MicrophoneOff : Microphone" />
      </n-button>

      <!-- 摄像头开关（仅视频通话） -->
      <n-button
        v-if="call.type === 'video'"
        quaternary
        circle
        size="small"
        :type="call.isCameraOff ? 'error' : 'default'"
        @click="handleToggleCamera">
        <n-icon :component="call.isCameraOff ? CameraOff : Camera" />
      </n-button>

      <!-- 扬声器切换 -->
      <n-button
        quaternary
        circle
        size="small"
        :type="call.isSpeakerOn ? 'primary' : 'default'"
        @click="handleToggleSpeaker">
        <n-icon :component="call.isSpeakerOn ? Volume : Volume2" />
      </n-button>

      <!-- 分割线 -->
      <n-divider vertical />

      <!-- 接听按钮（仅邀请中） -->
      <n-button v-if="call.state === 'invite_received'" type="success" circle size="small" @click="handleAccept">
        <n-icon :component="PhoneIncoming" />
      </n-button>

      <!-- 拒绝按钮（仅邀请中） -->
      <n-button v-if="call.state === 'invite_received'" type="error" circle size="small" @click="handleReject">
        <n-icon :component="PhoneIncoming" />
      </n-button>

      <!-- 结束通话按钮 -->
      <n-button v-else type="error" circle size="small" @click="handleEnd">
        <n-icon :component="PhoneOff" />
      </n-button>
    </div>

    <!-- 通话质量指示器 -->
    <div class="call-quality" v-if="call.isActive && call.quality">
      <n-tooltip>
        <template #trigger>
          <n-icon :component="getQualityIcon(call.quality)" :size="16" :color="getQualityColor(call.quality)" />
        </template>
        {{ getQualityText(call.quality) }}
      </n-tooltip>
    </div>

    <!-- 录制指示器 -->
    <div v-if="call.isRecording" class="call-recording">
      <n-tooltip>
        <template #trigger>
          <n-icon :component="Radio" color="var(--n-error-color)" size="16">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite" />
          </n-icon>
        </template>
        通话录制中
      </n-tooltip>
    </div>

    <!-- 屏幕共享指示器 -->
    <div v-if="call.isScreenSharing" class="call-screen-share">
      <n-tooltip>
        <template #trigger>
          <n-icon :component="DeviceDesktop" color="var(--n-primary-color)" size="16" />
        </template>
        正在共享屏幕
      </n-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NIcon, NTag, NButton, NDivider, NTooltip } from 'naive-ui'
import {
  Video,
  Phone,
  Microphone,
  MicrophoneOff,
  Camera,
  CameraOff,
  Volume,
  Volume2,
  PhoneOff,
  Wifi,
  WifiOff,
  Radio,
  DeviceDesktop,
  PhoneIncoming
} from '@vicons/tabler'
import { matrixCallService, MatrixCall } from '@/services/matrixCallService'

// Public interface for MatrixCall that only includes properties accessible from templates
// This avoids the issue with private methods not being included in ref type inference
interface MatrixCallProps {
  callId: string
  roomId: string
  type: 'voice' | 'video'
  isInitiator: boolean
  state: string
  startTime?: number
  endTime?: number
  inviteEvent?: unknown
  duration: number
  participantCount: number
  isMuted: boolean
  isCameraOff: boolean
  isSpeakerOn: boolean
  isRecording: boolean
  isScreenSharing: boolean
  quality?: 'excellent' | 'good' | 'poor' | 'very_poor'
  isActive: boolean
  isActiveMethod(): boolean
  [key: string]: unknown
}

interface Props {
  call: MatrixCallProps
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: []
}>()

// TagColor type union for Naive UI tags (string literals that n-tag accepts)
type TagColorType = 'default' | 'error' | 'info' | 'primary' | 'success' | 'warning'

// Methods
const getCallStateTagType = (state: string): TagColorType => {
  const types: Record<string, TagColorType> = {
    invite_sent: 'warning',
    invite_received: 'info',
    ringing: 'info',
    connected: 'success',
    ended: 'default',
    failed: 'error'
  }
  return types[state] || 'default'
}

const getCallStateText = (state: string) => {
  const texts = {
    invite_sent: '邀请中',
    invite_received: '来电',
    ringing: '响铃中',
    connected: '通话中',
    ended: '已结束',
    failed: '失败'
  }
  return texts[state as keyof typeof texts] || state
}

const formatDuration = (duration: number): string => {
  if (duration < 0) return '--:--'

  const hours = Math.floor(duration / 3600)
  const minutes = Math.floor((duration % 3600) / 60)
  const seconds = duration % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

const getQualityIcon = (quality: string) => {
  const icons = {
    excellent: Wifi,
    good: Wifi,
    poor: WifiOff,
    very_poor: Wifi
  }
  return icons[quality as keyof typeof icons] || Wifi
}

const getQualityColor = (quality: string) => {
  const colors = {
    excellent: 'var(--n-success-color)',
    good: 'var(--n-success-color)',
    poor: 'var(--n-warning-color)',
    very_poor: 'var(--n-error-color)'
  }
  return colors[quality as keyof typeof colors] || 'var(--n-text-color-3)'
}

const getQualityText = (quality: string) => {
  const texts = {
    excellent: '连接质量极佳',
    good: '连接质量良好',
    poor: '连接质量较差',
    very_poor: '连接质量很差'
  }
  return texts[quality as keyof typeof texts] || '连接质量未知'
}

const handleToggleMute = async () => {
  try {
    if (props.call.isMuted) {
      await matrixCallService.unmuteMic(props.call.callId)
    } else {
      await matrixCallService.muteMic(props.call.callId)
    }
  } catch (error) {}
}

const handleToggleCamera = async () => {
  try {
    if (props.call.isCameraOff) {
      await matrixCallService.enableCamera(props.call.callId)
    } else {
      await matrixCallService.disableCamera(props.call.callId)
    }
  } catch (error) {}
}

const handleToggleSpeaker = async () => {
  try {
    if (props.call.isSpeakerOn) {
      await matrixCallService.disableSpeaker(props.call.callId)
    } else {
      await matrixCallService.enableSpeaker(props.call.callId)
    }
  } catch (error) {}
}

const handleAccept = async () => {
  try {
    await matrixCallService.acceptCall(props.call.callId)
  } catch (error) {}
}

const handleReject = async () => {
  try {
    await matrixCallService.rejectCall(props.call.callId)
  } catch (error) {}
}

const handleEnd = async () => {
  try {
    await matrixCallService.endCall(props.call.callId)
  } catch (error) {}
}
</script>

<style scoped>
.matrix-call-bar {
  display: flex;
  align-items: center;
  gap: var(--hula-spacing-md);
  padding: var(--hula-spacing-xs) var(--hula-spacing-md);
  margin: 0 calc(var(--hula-spacing-md) * -1) var(--hula-spacing-md) calc(var(--hula-spacing-md) * -1);
  background: var(--n-hover-color);
  border: 1px solid var(--n-border-color);
  border-radius: var(--hula-radius-sm);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.matrix-call-bar:hover {
  background: var(--n-color-pressed);
  opacity: 0.95;
  box-shadow: 0 2px 8px rgba(var(--hula-black-rgb), 0.1);
}

.matrix-call-bar.active {
  background: rgba(var(--n-success-color-rgb), 0.1);
  border-color: var(--n-success-color);
}

.call-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--hula-spacing-xl);
  height: var(--hula-spacing-xl);
  background: var(--n-color);
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(var(--hula-black-rgb), 0.1);
}

.call-info {
  flex: 1;
  min-width: 0;
}

.call-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.call-title span {
  font-weight: 500;
  font-size: 14px;
}

.call-details {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.call-duration {
  font-variant-numeric: tabular-nums;
}

.call-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.call-quality,
.call-recording,
.call-screen-share {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-left: 8px;
}

/* 动画效果 */
@keyframes pulse {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}

.matrix-call-bar.active .call-icon {
  animation: pulse 2s infinite;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .matrix-call-bar {
    padding: 6px 12px;
    margin: 0 -12px 12px -12px;
  }

  .call-icon {
    width: 32px;
    height: 32px;
  }

  .call-title span {
    font-size: 13px;
  }

  .call-details {
    font-size: 11px;
  }

  .call-controls {
    gap: 2px;
  }
}

/* 通话中的脉冲动画 */
.matrix-call-bar.active {
  position: relative;
}

.matrix-call-bar.active::before {
  content: '';
  position: absolute;
  inset: -1px;
  background: linear-gradient(45deg, transparent 30%, rgba(var(--n-success-color-rgb), 0.3) 50%, transparent 70%);
  border-radius: 8px;
  animation: shimmer 2s infinite;
  pointer-events: none;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%) rotate(45deg);
  }
  100% {
    transform: translateX(200%) rotate(45deg);
  }
}
</style>
