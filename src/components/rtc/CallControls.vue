<template>
  <div class="call-controls">
    <!-- 通话状态显示 -->
    <div v-if="callStatus" class="call-status">
      <div class="status-indicator" :class="callStatus.state">
        <div class="pulse-dot"></div>
        <span>{{ getCallStatusText() }}</span>
      </div>
      <div v-if="callDuration > 0" class="call-duration">
        {{ formatDuration(callDuration) }}
      </div>
    </div>

    <!-- 通话控制按钮 -->
    <div class="controls-container">
      <!-- 音频控制 -->
      <div class="control-group">
        <n-button
          circle
          :type="isAudioMuted ? 'default' : 'primary'"
          :disabled="!inCall"
          @click="toggleAudio"
          class="control-btn"
          :class="{ muted: isAudioMuted }">
          <Icon :icon="isAudioMuted ? 'mdi:microphone-off' : 'mdi:microphone'" size="20" />
        </n-button>
        <span class="control-label">{{ t('call.audio') }}</span>
      </div>

      <!-- 视频控制 -->
      <div v-if="callType === 'video'" class="control-group">
        <n-button
          circle
          :type="isVideoMuted ? 'default' : 'primary'"
          :disabled="!inCall"
          @click="toggleVideo"
          class="control-btn"
          :class="{ muted: isVideoMuted }">
          <Icon :icon="isVideoMuted ? 'mdi:video-off' : 'mdi:video'" size="20" />
        </n-button>
        <span class="control-label">{{ t('call.video') }}</span>
      </div>

      <!-- 屏幕共享 -->
      <div v-if="callType === 'video'" class="control-group">
        <n-button
          circle
          :type="isScreenSharing ? 'error' : 'default'"
          :disabled="!inCall"
          @click="toggleScreenShare"
          class="control-btn"
          :class="{ sharing: isScreenSharing }">
          <Icon :icon="isScreenSharing ? 'mdi:monitor-share' : 'mdi:monitor-screenshot'" size="20" />
        </n-button>
        <span class="control-label">{{ t('call.screenShare') }}</span>
      </div>

      <!-- 通话控制 -->
      <div class="control-group call-actions">
        <!-- 接听/拒绝按钮 -->
        <template v-if="incomingCall">
          <n-button circle type="success" @click="acceptCall" class="control-btn accept-btn">
            <Icon icon="mdi:phone" size="20" />
          </n-button>
          <n-button circle type="error" @click="handleRejectCall" class="control-btn reject-btn">
            <Icon icon="mdi:phone-hangup" size="20" />
          </n-button>
        </template>

        <!-- 挂断按钮 -->
        <template v-else>
          <n-button circle type="error" :disabled="!inCall" @click="hangupCallAction" class="control-btn hangup-btn">
            <Icon icon="mdi:phone-hangup" size="20" />
          </n-button>
        </template>
      </div>
    </div>

    <!-- 通话质量指示器 -->
    <div v-if="showQualityIndicator && inCall" class="quality-indicator">
      <div class="quality-bars">
        <div v-for="i in 5" :key="i" class="quality-bar" :class="{ active: i <= qualityLevel }"></div>
      </div>
      <span class="quality-text">{{ getQualityText() }}</span>
    </div>

    <!-- 通话统计 -->
    <div v-if="showStats && callStats" class="call-stats">
      <div class="stats-item">
        <Icon icon="mdi:download" size="16" />
        <span>{{ formatBytes(callStats.bytesReceived) }}</span>
      </div>
      <div class="stats-item">
        <Icon icon="mdi:upload" size="16" />
        <span>{{ formatBytes(callStats.bytesSent) }}</span>
      </div>
      <div v-if="callStats.audioLevel !== undefined" class="stats-item">
        <Icon icon="mdi:volume-high" size="16" />
        <span>{{ Math.round(callStats.audioLevel * 100) }}%</span>
      </div>
    </div>

    <!-- 音量指示器 -->
    <div v-if="showVolumeIndicator && inCall" class="volume-indicator">
      <div class="volume-bars">
        <div v-for="i in 10" :key="i" class="volume-bar" :class="{ active: i <= volumeLevel }"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton } from 'naive-ui'
import { Icon } from '@iconify/vue'
import {
  initiateCall,
  hangupCall,
  rejectCall,
  toggleAudioMute,
  toggleVideoMute,
  startScreenShare,
  stopScreenShare,
  checkWebRtcSupport,
  setupMatrixRtcBridge,
  type CallType,
  type CallState,
  type CallStats,
  type MatrixCallEvent
} from '@/integrations/matrix/rtc'
import { useRtcStore } from '@/stores/rtc'
import { flags } from '@/utils/envFlags'

import { msg } from '@/utils/SafeUI'
import { logger, toError } from '@/utils/logger'
import { secureRandomFloat } from '@/utils/secureRandom'

interface Props {
  roomId?: string
  callType?: CallType
  incomingCall?: boolean
  showQualityIndicator?: boolean
  showStats?: boolean
  showVolumeIndicator?: boolean
}

interface Emits {
  (e: 'call-started', callId: string): void
  (e: 'call-ended', callId: string): void
  (e: 'call-accepted', callId: string): void
  (e: 'call-rejected', callId: string): void
  (e: 'mute-changed', type: 'audio' | 'video', muted: boolean): void
  (e: 'screen-share-changed', sharing: boolean): void
  (e: 'quality-changed', level: number): void
}

const props = withDefaults(defineProps<Props>(), {
  callType: 'audio',
  incomingCall: false,
  showQualityIndicator: true,
  showStats: false,
  showVolumeIndicator: false
})

const emit = defineEmits<Emits>()

const { t } = useI18n()
const message = msg
const rtcStore = useRtcStore()

// 响应式数据
const inCall = ref(false)
const isAudioMuted = ref(false)
const isVideoMuted = ref(false)
const isScreenSharing = ref(false)
const callStatus = ref<{ state: CallState; startTime?: number } | null>(null)
const callDuration = ref(0)
const callStats = ref<CallStats | null>(null)
const qualityLevel = ref(5)
const volumeLevel = ref(0)
const currentCallId = ref('')
const durationTimer = ref<NodeJS.Timeout | null>(null)
const statsTimer = ref<NodeJS.Timeout | null>(null)
const volumeTimer = ref<NodeJS.Timeout | null>(null)

// 计算属性
const webrtcSupported = computed(() => checkWebRtcSupport())

// 方法
const getCallStatusText = () => {
  if (!callStatus.value) return ''

  const statusMap = {
    idle: t('call.status.idle'),
    ringing: t('call.status.ringing'),
    connecting: t('call.status.connecting'),
    connected: t('call.status.connected'),
    ended: t('call.status.ended'),
    failed: t('call.status.failed')
  }

  return statusMap[callStatus.value.state] || ''
}

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / k ** i).toFixed(1)) + ' ' + sizes[i]
}

const getQualityText = () => {
  if (qualityLevel.value >= 4) return t('call.quality.excellent')
  if (qualityLevel.value >= 3) return t('call.quality.good')
  if (qualityLevel.value >= 2) return t('call.quality.fair')
  if (qualityLevel.value >= 1) return t('call.quality.poor')
  return t('call.quality.terrible')
}

const toggleAudio = async () => {
  if (!inCall.value) return

  try {
    const muted = toggleAudioMute()
    isAudioMuted.value = !muted
    emit('mute-changed', 'audio', isAudioMuted.value)
  } catch (error) {
    logger.error('Failed to toggle audio:', toError(error))
    message.error(t('call.audioToggleFailed'))
  }
}

const toggleVideo = async () => {
  if (!inCall.value || props.callType !== 'video') return

  try {
    const muted = toggleVideoMute()
    isVideoMuted.value = !muted
    emit('mute-changed', 'video', isVideoMuted.value)
  } catch (error) {
    logger.error('Failed to toggle video:', toError(error))
    message.error(t('call.videoToggleFailed'))
  }
}

// Window全局扩展接口（用于屏幕共享）
interface WindowWithScreenStream extends Window {
  screenStream?: MediaStream
}

const toggleScreenShare = async () => {
  if (!inCall.value || props.callType !== 'video') return

  try {
    if (isScreenSharing.value) {
      // 停止屏幕共享
      const windowWithStream = window as unknown as WindowWithScreenStream
      stopScreenShare(windowWithStream.screenStream as MediaStream)
      isScreenSharing.value = false
      message.success(t('call.screenShareStopped'))
    } else {
      // 开始屏幕共享
      const stream = await startScreenShare()
      if (stream) {
        const windowWithStream = window as unknown as WindowWithScreenStream
        windowWithStream.screenStream = stream
        isScreenSharing.value = true
        message.success(t('call.screenShareStarted'))

        // 监听流结束事件
        stream.getVideoTracks()[0]?.addEventListener('ended', () => {
          isScreenSharing.value = false
          message.info(t('call.screenShareEnded'))
        })
      }
    }
    emit('screen-share-changed', isScreenSharing.value)
  } catch (error) {
    logger.error('Failed to toggle screen share:', toError(error))
    message.error(t('call.screenShareToggleFailed'))
  }
}

const startCall = async () => {
  if (!props.roomId || !webrtcSupported.value) return

  try {
    const success = await initiateCall(props.roomId, props.callType)
    if (success) {
      inCall.value = true
      callStatus.value = { state: 'connecting', startTime: Date.now() }
      startDurationTimer()
      startStatsTimer()
      message.success(t('call.started'))
    } else {
      message.error(t('call.startFailed'))
    }
  } catch (error) {
    logger.error('Failed to start call:', toError(error))
    message.error(t('call.startFailed'))
  }
}

const acceptCall = async () => {
  try {
    // 这里需要根据实际的通话邀请信息来接听
    // 实际实现中应该从RTC store获取通话邀请信息
    message.success(t('call.accepted'))
    emit('call-accepted', currentCallId.value)
  } catch (error) {
    logger.error('Failed to accept call:', toError(error))
    message.error(t('call.acceptFailed'))
  }
}

const handleRejectCall = async () => {
  try {
    await rejectCall(props.roomId!, currentCallId.value)
    message.info(t('call.rejected'))
    emit('call-rejected', currentCallId.value)
    resetCallState()
  } catch (error) {
    logger.error('Failed to reject call:', toError(error))
    message.error(t('call.rejectFailed'))
  }
}

const hangupCallAction = async () => {
  if (!props.roomId || !currentCallId.value) return

  try {
    await hangupCall(props.roomId, currentCallId.value)
    message.info(t('call.ended'))
    emit('call-ended', currentCallId.value)
    resetCallState()
  } catch (error) {
    logger.error('Failed to hangup call:', error)
    message.error(t('call.hangupFailed'))
  }
}

const resetCallState = () => {
  inCall.value = false
  isAudioMuted.value = false
  isVideoMuted.value = false
  isScreenSharing.value = false
  callStatus.value = null
  callDuration.value = 0
  callStats.value = null
  qualityLevel.value = 5
  volumeLevel.value = 0
  currentCallId.value = ''

  // 清理定时器
  if (durationTimer.value) {
    clearInterval(durationTimer.value)
    durationTimer.value = null
  }

  if (statsTimer.value) {
    clearInterval(statsTimer.value)
    statsTimer.value = null
  }

  if (volumeTimer.value) {
    clearInterval(volumeTimer.value)
    volumeTimer.value = null
  }
}

const startDurationTimer = () => {
  if (durationTimer.value) clearInterval(durationTimer.value)

  durationTimer.value = setInterval(() => {
    if (callStatus.value?.startTime) {
      callDuration.value = Math.floor((Date.now() - callStatus.value.startTime) / 1000)
    }
  }, 1000)
}

const startStatsTimer = () => {
  if (statsTimer.value) clearInterval(statsTimer.value)

  statsTimer.value = setInterval(async () => {
    // 这里需要实际的 peer connection 来获取统计信息
    // const stats = await getCallStats(peerConnection)
    // callStats.value = stats

    // 模拟统计数据
    callStats.value = {
      roomId: props.roomId || '',
      callId: currentCallId.value,
      duration: callDuration.value,
      state: 'connected',
      localCandidates: 0,
      remoteCandidates: 0,
      bytesReceived: secureRandomFloat() * 1000000,
      bytesSent: secureRandomFloat() * 1000000,
      packetsReceived: secureRandomFloat() * 10000,
      packetsSent: secureRandomFloat() * 10000
    }
  }, 2000)
}

const startVolumeTimer = () => {
  if (volumeTimer.value) clearInterval(volumeTimer.value)

  volumeTimer.value = setInterval(() => {
    // 模拟音量变化
    volumeLevel.value = Math.floor(secureRandomFloat() * 10)
  }, 100)
}

const handleCallEvent = (event: MatrixCallEvent) => {
  switch (event.type) {
    case 'invite':
      currentCallId.value = event.content.call_id
      callStatus.value = { state: 'ringing' }
      break
    case 'answer':
      callStatus.value = { state: 'connected', startTime: Date.now() }
      inCall.value = true
      startDurationTimer()
      startStatsTimer()
      startVolumeTimer()
      break
    case 'hangup':
    case 'reject':
      resetCallState()
      break
  }
}

// 暴露方法给父组件
defineExpose({
  startCall,
  hangupCall: hangupCallAction,
  acceptCall,
  rejectCall,
  toggleAudio,
  toggleVideo,
  toggleScreenShare
})

// 生命周期
onMounted(() => {
  if (flags.matrixRtcEnabled && webrtcSupported.value) {
    // 设置Matrix RTC桥接
    setupMatrixRtcBridge(undefined, handleCallEvent)
  } else if (!webrtcSupported.value) {
    message.warning(t('call.webrtcNotSupported'))
  }
})

onUnmounted(() => {
  resetCallState()
})

// 监听RTC store变化
watch(
  () => rtcStore.status,
  (newStatus) => {
    if (newStatus === 'incoming') {
      callStatus.value = { state: 'ringing' }
      currentCallId.value = rtcStore.roomId
    } else if (newStatus === 'ongoing') {
      callStatus.value = { state: 'connected', startTime: Date.now() }
      inCall.value = true
      startDurationTimer()
      startStatsTimer()
      startVolumeTimer()
    } else if (newStatus === 'ended') {
      resetCallState()
    }
  }
)
</script>

<style scoped>
.call-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: rgba(var(--hula-black-rgb), 0.8);
  border-radius: 12px;
  color: white;
}

.call-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--hula-brand-primary);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

.status-indicator.connecting .pulse-dot {
  background: var(--hula-brand-primary);
}

.status-indicator.ringing .pulse-dot {
  background: var(--hula-brand-primary);
}

.status-indicator.ended .pulse-dot {
  background: var(--hula-brand-primary);
  animation: none;
}

.call-duration {
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.controls-container {
  display: flex;
  align-items: center;
  gap: 24px;
}

.control-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.control-btn {
  width: var(--hula-spacing-xl) !important;
  height: var(--hula-spacing-xl) !important;
  backdrop-filter: blur(10px);
  background: rgba(var(--hula-white-rgb), 0.1);
  border: 1px solid rgba(var(--hula-white-rgb), 0.2);
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
}

.control-btn:hover {
  background: rgba(var(--hula-white-rgb), 0.2);
  opacity: 0.95;
}

.control-btn.muted {
  background: rgba(var(--hula-error-rgb), 0.2);
  border-color: rgba(var(--hula-error-rgb), 0.4);
}

.control-btn.sharing {
  background: rgba(var(--hula-warning-rgb), 0.2);
  border-color: rgba(var(--hula-warning-rgb), 0.4);
}

.control-label {
  font-size: var(--hula-text-xs);
  color: rgba(var(--hula-white-rgb), 0.7);
}

.call-actions {
  display: flex;
  gap: var(--hula-spacing-md);
}

.accept-btn {
  background: rgba(var(--hula-success-rgb), 0.2);
  border-color: rgba(var(--hula-success-rgb), 0.4);
}

.accept-btn:hover {
  background: rgba(var(--hula-success-rgb), 0.3);
}

.reject-btn,
.hangup-btn {
  background: rgba(var(--hula-error-rgb), 0.2);
  border-color: rgba(var(--hula-error-rgb), 0.4);
}

.reject-btn:hover,
.hangup-btn:hover {
  background: rgba(var(--hula-error-rgb), 0.3);
}

.quality-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.quality-bars {
  display: flex;
  gap: 2px;
}

.quality-bar {
  width: 4px;
  height: 16px;
  background: rgba(var(--hula-white-rgb), 0.2);
  border-radius: 2px;
  transition: all 0.3s ease;
}

.quality-bar.active {
  background: var(--hula-brand-primary);
}

.quality-bar.active:nth-child(4),
.quality-bar.active:nth-child(5) {
  background: var(--hula-brand-primary);
}

.quality-text {
  font-size: 12px;
  color: rgba(var(--hula-white-rgb), 0.7);
}

.call-stats {
  display: flex;
  gap: 16px;
}

.stats-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgba(var(--hula-white-rgb), 0.7);
}

.volume-indicator {
  margin-top: 8px;
}

.volume-bars {
  display: flex;
  gap: 1px;
}

.volume-bar {
  width: 3px;
  height: 20px;
  background: rgba(var(--hula-white-rgb), 0.2);
  border-radius: 1px;
  transition: all 0.1s ease;
}

.volume-bar.active {
  background: var(--hula-brand-primary);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .call-controls {
    padding: 16px;
  }

  .controls-container {
    gap: 16px;
  }

  .control-btn {
    width: 48px !important;
    height: 48px !important;
  }

  .control-label {
    font-size: 11px;
  }

  .call-stats {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
import { secureRandomFloat } from '@/utils/secureRandom'
