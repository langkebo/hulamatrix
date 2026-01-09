<!-- Mobile Call Settings - Call settings for mobile devices -->
<template>
  <div class="mobile-call-settings">
    <!-- Header -->
    <div class="settings-header">
      <n-button text @click="handleClose">
        <template #icon>
          <n-icon :size="24"><ChevronLeft /></n-icon>
        </template>
      </n-button>
      <h1 class="header-title">通话设置</h1>
      <div class="header-spacer"></div>
    </div>

    <!-- Content -->
    <div class="settings-content">
      <!-- Audio Settings -->
      <div class="settings-section">
        <div class="section-header">
          <n-icon :size="20"><Volume /></n-icon>
          <h3 class="section-title">音频设置</h3>
        </div>

        <!-- Microphone Selection -->
        <div class="setting-item">
          <div class="item-header">
            <span class="item-label">麦克风</span>
            <n-button v-if="availableMicrophones.length > 1" size="small" @click="showMicrophoneSelector = true">
              {{ getMicrophoneLabel() }}
            </n-button>
            <span v-else class="item-value">{{ getMicrophoneLabel() }}</span>
          </div>
        </div>

        <!-- Speaker Selection -->
        <div class="setting-item">
          <div class="item-header">
            <span class="item-label">扬声器</span>
            <n-button v-if="availableSpeakers.length > 1" size="small" @click="showSpeakerSelector = true">
              {{ getSpeakerLabel() }}
            </n-button>
            <span v-else class="item-value">{{ getSpeakerLabel() }}</span>
          </div>
        </div>

        <!-- Input Volume -->
        <div class="setting-item">
          <div class="item-header">
            <span class="item-label">输入音量</span>
            <span class="item-value">{{ audioSettings.inputVolume }}%</span>
          </div>
          <n-slider
            v-model:value="audioSettings.inputVolume"
            :min="0"
            :max="100"
            :step="1"
            @update:value="handleInputVolumeChange" />
          <!-- Audio Visualizer -->
          <div class="audio-visualizer">
            <div
              v-for="(level, index) in audioLevels"
              :key="index"
              class="audio-bar"
              :class="{ active: level > 20 }"
              :style="{ height: `${Math.max(4, level)}px` }"></div>
          </div>
        </div>

        <!-- Audio Enhancements -->
        <div class="setting-item">
          <div class="toggle-item">
            <div class="toggle-info">
              <div class="toggle-label">降噪</div>
              <div class="toggle-desc">减少背景噪音</div>
            </div>
            <n-switch v-model:value="audioSettings.noiseCancellation" @update:value="handleNoiseCancellationChange" />
          </div>
        </div>

        <div class="setting-item">
          <div class="toggle-item">
            <div class="toggle-info">
              <div class="toggle-label">回声消除</div>
              <div class="toggle-desc">减少通话回声</div>
            </div>
            <n-switch v-model:value="audioSettings.echoCancellation" @update:value="handleEchoCancellationChange" />
          </div>
        </div>
      </div>

      <!-- Video Settings -->
      <div v-if="callType === 'video'" class="settings-section">
        <div class="section-header">
          <n-icon :size="20"><Video /></n-icon>
          <h3 class="section-title">视频设置</h3>
        </div>

        <!-- Camera Selection -->
        <div class="setting-item">
          <div class="item-header">
            <span class="item-label">摄像头</span>
            <n-button v-if="availableCameras.length > 1" size="small" @click="showCameraSelector = true">
              {{ getCameraLabel() }}
            </n-button>
            <span v-else class="item-value">{{ getCameraLabel() }}</span>
          </div>
        </div>

        <!-- Video Quality -->
        <div class="setting-item">
          <div class="item-header">
            <span class="item-label">视频质量</span>
            <n-button size="small" @click="showQualitySelector = true">
              {{ getQualityLabel() }}
            </n-button>
          </div>
          <div class="item-desc">更高的质量需要更多的网络带宽</div>
        </div>

        <!-- Video Enhancements -->
        <div class="setting-item">
          <div class="toggle-item">
            <div class="toggle-info">
              <div class="toggle-label">美颜</div>
              <div class="toggle-desc">美化视频画面</div>
            </div>
            <n-switch v-model:value="videoSettings.beautification" @update:value="handleBeautificationChange" />
          </div>
        </div>

        <!-- Beautification Level -->
        <div v-if="videoSettings.beautification" class="setting-item nested">
          <div class="item-header">
            <span class="item-label">美颜强度</span>
            <span class="item-value">{{ videoSettings.beautificationLevel }}%</span>
          </div>
          <n-slider v-model:value="videoSettings.beautificationLevel" :min="0" :max="100" :step="1" />
        </div>
      </div>

      <!-- Network Settings -->
      <div class="settings-section">
        <div class="section-header">
          <n-icon :size="20"><Wifi /></n-icon>
          <h3 class="section-title">网络设置</h3>
        </div>

        <!-- Bandwidth Limit -->
        <div class="setting-item">
          <div class="item-header">
            <span class="item-label">带宽限制</span>
            <n-button size="small" @click="showBandwidthSelector = true">
              {{ getBandwidthLabel() }}
            </n-button>
          </div>
          <div class="item-desc">根据网络状况限制视频带宽</div>
        </div>
      </div>

      <!-- Call Stats -->
      <div v-if="callStats.duration > 0" class="settings-section">
        <div class="section-header">
          <n-icon :size="20"><ChartBar /></n-icon>
          <h3 class="section-title">通话统计</h3>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <n-icon :size="20" color="var(--hula-success)"><Clock /></n-icon>
            <div class="stat-info">
              <div class="stat-label">通话时长</div>
              <div class="stat-value">{{ formatDuration(callStats.duration) }}</div>
            </div>
          </div>

          <div class="stat-card">
            <n-icon :size="20" color="#2080f0"><Database /></n-icon>
            <div class="stat-info">
              <div class="stat-label">数据使用</div>
              <div class="stat-value">{{ formatBytes(callStats.bytesTransferred) }}</div>
            </div>
          </div>

          <div class="stat-card">
            <n-icon :size="20" :color="getLatencyColor(callStats.packetLoss)"><World /></n-icon>
            <div class="stat-info">
              <div class="stat-label">丢包率</div>
              <div class="stat-value">{{ (callStats.packetLoss * 100).toFixed(1) }}%</div>
            </div>
          </div>

          <div class="stat-card">
            <n-icon :size="20" :color="getLatencyColor(callStats.averageLatency)"><Gauge /></n-icon>
            <div class="stat-info">
              <div class="stat-label">延迟</div>
              <div class="stat-value">{{ callStats.averageLatency }}ms</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Actions -->
    <div class="settings-footer">
      <n-button @click="handleReset" block>
        <template #icon>
          <n-icon><Refresh /></n-icon>
        </template>
        重置默认
      </n-button>
      <n-button type="primary" @click="handleSave" block>
        <template #icon>
          <n-icon><DeviceFloppy /></n-icon>
        </template>
        保存设置
      </n-button>
    </div>

    <!-- Device Selector Bottom Sheet -->
    <n-modal v-model:show="showMicrophoneSelector" preset="card" title="选择麦克风" class="w-90-max-w-400px">
      <n-list>
        <n-list-item
          v-for="mic in availableMicrophones"
          :key="mic.value"
          clickable
          @click="selectMicrophone(mic.value)">
          <template #prefix>
            <n-icon><Microphone /></n-icon>
          </template>
          {{ mic.label }}
        </n-list-item>
      </n-list>
    </n-modal>

    <n-modal v-model:show="showSpeakerSelector" preset="card" title="选择扬声器" class="w-90-max-w-400px">
      <n-list>
        <n-list-item
          v-for="speaker in availableSpeakers"
          :key="speaker.value"
          clickable
          @click="selectSpeaker(speaker.value)">
          <template #prefix>
            <n-icon><Volume2 /></n-icon>
          </template>
          {{ speaker.label }}
        </n-list-item>
      </n-list>
    </n-modal>

    <n-modal v-model:show="showCameraSelector" preset="card" title="选择摄像头" class="w-90-max-w-400px">
      <n-list>
        <n-list-item
          v-for="camera in availableCameras"
          :key="camera.value"
          clickable
          @click="selectCamera(camera.value)">
          <template #prefix>
            <n-icon><Camera /></n-icon>
          </template>
          {{ camera.label }}
        </n-list-item>
      </n-list>
    </n-modal>

    <!-- Quality Selector -->
    <n-modal v-model:show="showQualitySelector" preset="card" title="视频质量" class="w-90-max-w-400px">
      <n-radio-group v-model:value="videoSettings.quality" name="quality">
        <n-space vertical>
          <n-radio
            v-for="quality in videoQualityOptions"
            :key="quality.value"
            :value="quality.value"
            @click="selectQuality(quality.value)">
            {{ quality.label }}
          </n-radio>
        </n-space>
      </n-radio-group>
    </n-modal>

    <!-- Bandwidth Selector -->
    <n-modal v-model:show="showBandwidthSelector" preset="card" title="带宽限制" class="w-90-max-w-400px">
      <n-radio-group v-model:value="networkSettings.bandwidthLimit" name="bandwidth">
        <n-space vertical>
          <n-radio
            v-for="bandwidth in bandwidthOptions"
            :key="bandwidth.value"
            :value="bandwidth.value"
            @click="selectBandwidth(bandwidth.value)">
            {{ bandwidth.label }}
          </n-radio>
        </n-space>
      </n-radio-group>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  NButton,
  NIcon,
  NSlider,
  NSwitch,
  NModal,
  NList,
  NListItem,
  NRadioGroup,
  NRadio,
  NSpace,
  useMessage
} from 'naive-ui'
import {
  ChevronLeft,
  Volume,
  Video,
  Wifi,
  ChartBar,
  Clock,
  Database,
  World,
  Gauge,
  Refresh,
  DeviceFloppy,
  Microphone,
  Volume2,
  Camera
} from '@vicons/tabler'
import type { MediaStream } from '@/types/rtc'
import { logger } from '@/utils/logger'

interface Props {
  callType: 'audio' | 'video'
  localStream?: MediaStream | null
}

type Emits = (e: 'closed') => void

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const message = useMessage()

// Audio settings
const audioSettings = ref({
  microphoneId: '',
  speakerId: '',
  inputVolume: 70,
  noiseCancellation: true,
  echoCancellation: true,
  autoGainControl: true
})

// Video settings
const videoSettings = ref({
  cameraId: '',
  quality: '720p',
  beautification: false,
  beautificationLevel: 50
})

// Network settings
const networkSettings = ref({
  bandwidthLimit: 'auto'
})

// Audio levels visualization
const audioLevels = ref(Array(20).fill(0))

// Device lists
const availableMicrophones = ref<Array<{ label: string; value: string }>>([])
const availableSpeakers = ref<Array<{ label: string; value: string }>>([])
const availableCameras = ref<Array<{ label: string; value: string }>>([])

// Modal states
const showMicrophoneSelector = ref(false)
const showSpeakerSelector = ref(false)
const showCameraSelector = ref(false)
const showQualitySelector = ref(false)
const showBandwidthSelector = ref(false)

// Options
const videoQualityOptions = [
  { label: '流畅 (360p) - 省流量', value: '360p' },
  { label: '标准 (480p) - 推荐', value: '480p' },
  { label: '高清 (720p)', value: '720p' },
  { label: '超清 (1080p) - 高流量', value: '1080p' }
]

const bandwidthOptions = [
  { label: '自动 - 根据网络状况调整', value: 'auto' },
  { label: '低 (500kbps) - 省流量', value: 'low' },
  { label: '中 (1Mbps)', value: 'medium' },
  { label: '高 (2Mbps)', value: 'high' }
]

// Call stats
const callStats = ref({
  duration: 0,
  bytesTransferred: 0,
  packetLoss: 0,
  averageLatency: 0
})

// Audio analyzer
let audioAnalyzer: AnalyserNode | null = null
let animationFrame: number | null = null

// Computed
const getMicrophoneLabel = () => {
  const mic = availableMicrophones.value.find((m) => m.value === audioSettings.value.microphoneId)
  return mic?.label || '选择麦克风'
}

const getSpeakerLabel = () => {
  const speaker = availableSpeakers.value.find((s) => s.value === audioSettings.value.speakerId)
  return speaker?.label || '选择扬声器'
}

const getCameraLabel = () => {
  const camera = availableCameras.value.find((c) => c.value === videoSettings.value.cameraId)
  return camera?.label || '选择摄像头'
}

const getQualityLabel = () => {
  const quality = videoQualityOptions.find((q) => q.value === videoSettings.value.quality)
  return quality?.label || '720p'
}

const getBandwidthLabel = () => {
  const bandwidth = bandwidthOptions.find((b) => b.value === networkSettings.value.bandwidthLimit)
  return bandwidth?.label || '自动'
}

// Methods
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }
}

const formatBytes = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

const getLatencyColor = (value: number) => {
  if (value < 100) return 'var(--hula-success)'
  if (value < 300) return 'var(--hula-warning)'
  return 'var(--hula-error)'
}

const loadDevices = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()

    availableMicrophones.value = devices
      .filter((device) => device.kind === 'audioinput')
      .map((device) => ({
        label: device.label || `麦克风 ${device.deviceId.slice(0, 8)}`,
        value: device.deviceId
      }))

    availableSpeakers.value = devices
      .filter((device) => device.kind === 'audiooutput')
      .map((device) => ({
        label: device.label || `扬声器 ${device.deviceId.slice(0, 8)}`,
        value: device.deviceId
      }))

    availableCameras.value = devices
      .filter((device) => device.kind === 'videoinput')
      .map((device) => ({
        label: device.label || `摄像头 ${device.deviceId.slice(0, 8)}`,
        value: device.deviceId
      }))

    // Set defaults
    if (availableMicrophones.value.length > 0 && !audioSettings.value.microphoneId) {
      audioSettings.value.microphoneId = availableMicrophones.value[0]?.value || ''
    }

    if (availableSpeakers.value.length > 0 && !audioSettings.value.speakerId) {
      audioSettings.value.speakerId = availableSpeakers.value[0]?.value || ''
    }

    if (availableCameras.value.length > 0 && !videoSettings.value.cameraId) {
      videoSettings.value.cameraId = availableCameras.value[0]?.value || ''
    }
  } catch (error) {
    logger.error('Failed to load devices:', error)
  }
}

const setupAudioAnalyzer = () => {
  if (props.localStream) {
    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(props.localStream)
    audioAnalyzer = audioContext.createAnalyser()
    audioAnalyzer.fftSize = 256

    source.connect(audioAnalyzer)
    updateAudioLevels()
  }
}

const updateAudioLevels = () => {
  if (!audioAnalyzer) return

  const dataArray = new Uint8Array(audioAnalyzer.frequencyBinCount)
  audioAnalyzer.getByteFrequencyData(dataArray)

  // Calculate average audio level
  const sum = dataArray.reduce((a, b) => a + b, 0)
  const average = sum / dataArray.length

  // Update visualizer - create wave effect
  const barCount = audioLevels.value.length
  const mid = Math.floor(barCount / 2)

  audioLevels.value = Array(barCount)
    .fill(0)
    .map((_, index) => {
      const distance = Math.abs(index - mid)
      const maxDist = mid
      const intensity = Math.max(0, 1 - distance / maxDist)
      const randomVar = Math.random() * 10
      return Math.min(100, average * intensity * 0.8 + randomVar)
    })

  animationFrame = requestAnimationFrame(updateAudioLevels)
}

// Event handlers
const handleClose = () => {
  emit('closed')
}

const handleInputVolumeChange = () => {
  // Volume change handling
}

const handleNoiseCancellationChange = () => {
  message.success(audioSettings.value.noiseCancellation ? '降噪已开启' : '降噪已关闭')
}

const handleEchoCancellationChange = () => {
  message.success(audioSettings.value.echoCancellation ? '回声消除已开启' : '回声消除已关闭')
}

const handleBeautificationChange = () => {
  message.success(videoSettings.value.beautification ? '美颜已开启' : '美颜已关闭')
}

const selectMicrophone = (deviceId: string) => {
  audioSettings.value.microphoneId = deviceId
  showMicrophoneSelector.value = false
  message.success('麦克风已更改')
}

const selectSpeaker = (deviceId: string) => {
  audioSettings.value.speakerId = deviceId
  showSpeakerSelector.value = false
  message.success('扬声器已更改')
}

const selectCamera = (deviceId: string) => {
  videoSettings.value.cameraId = deviceId
  showCameraSelector.value = false
  message.success('摄像头已更改')
}

const selectQuality = (quality: string) => {
  videoSettings.value.quality = quality
  showQualitySelector.value = false
  message.info(`视频质量已设置为 ${quality}`)
}

const selectBandwidth = (bandwidth: string) => {
  networkSettings.value.bandwidthLimit = bandwidth
  showBandwidthSelector.value = false
  message.info(`带宽限制已设置为 ${bandwidth}`)
}

const handleReset = () => {
  audioSettings.value = {
    microphoneId: availableMicrophones.value[0]?.value || '',
    speakerId: availableSpeakers.value[0]?.value || '',
    inputVolume: 70,
    noiseCancellation: true,
    echoCancellation: true,
    autoGainControl: true
  }

  videoSettings.value = {
    cameraId: availableCameras.value[0]?.value || '',
    quality: '720p',
    beautification: false,
    beautificationLevel: 50
  }

  networkSettings.value = {
    bandwidthLimit: 'auto'
  }

  message.success('设置已重置为默认值')
}

const handleSave = () => {
  // Save to localStorage
  localStorage.setItem('mobile-call-audio-settings', JSON.stringify(audioSettings.value))
  localStorage.setItem('mobile-call-video-settings', JSON.stringify(videoSettings.value))
  localStorage.setItem('mobile-call-network-settings', JSON.stringify(networkSettings.value))

  message.success('设置已保存')
  emit('closed')
}

// Lifecycle
onMounted(() => {
  loadDevices()

  // Listen for device changes
  navigator.mediaDevices.addEventListener('devicechange', loadDevices)

  // Setup audio analyzer
  if (props.localStream) {
    setupAudioAnalyzer()
  }

  // Load saved settings
  try {
    const savedAudio = localStorage.getItem('mobile-call-audio-settings')
    const savedVideo = localStorage.getItem('mobile-call-video-settings')
    const savedNetwork = localStorage.getItem('mobile-call-network-settings')

    if (savedAudio) {
      Object.assign(audioSettings.value, JSON.parse(savedAudio))
    }

    if (savedVideo) {
      Object.assign(videoSettings.value, JSON.parse(savedVideo))
    }

    if (savedNetwork) {
      Object.assign(networkSettings.value, JSON.parse(savedNetwork))
    }
  } catch (error) {
    logger.error('Failed to load saved settings:', error)
  }
})

onUnmounted(() => {
  navigator.mediaDevices.removeEventListener('devicechange', loadDevices)

  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
  }

  if (audioAnalyzer) {
    audioAnalyzer.disconnect()
  }
})

watch(
  () => props.localStream,
  (newStream) => {
    if (newStream) {
      setupAudioAnalyzer()
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.mobile-call-settings {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-color);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  padding-top: max(16px, env(safe-area-inset-top));
  background: var(--card-color);
  border-bottom: 1px solid var(--border-color);

  .header-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .header-spacer {
    width: 32px;
  }
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.settings-section {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--card-color);
  border-radius: 16px;

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;

    .section-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
  }
}

.setting-item {
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }

  &.nested {
    margin-left: 24px;
    padding-left: 16px;
    border-left: 2px solid var(--divider-color);
  }

  .item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;

    .item-label {
      font-size: 15px;
      font-weight: 500;
      color: var(--text-color-1);
    }

    .item-value {
      font-size: 14px;
      color: var(--text-color-2);
    }
  }

  .item-desc {
    font-size: 12px;
    color: var(--text-color-3);
    margin-top: 4px;
  }
}

.toggle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--bg-color);
  border-radius: 12px;

  .toggle-info {
    flex: 1;

    .toggle-label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-color-1);
      margin-bottom: 2px;
    }

    .toggle-desc {
      font-size: 12px;
      color: var(--text-color-3);
    }
  }
}

.audio-visualizer {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 32px;
  margin-top: 8px;

  .audio-bar {
    flex: 1;
    background: var(--border-color);
    border-radius: 2px;
    transition: height 0.1s ease;

    &.active {
      background: var(--primary-color);
    }
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;

  .stat-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--bg-color);
    border-radius: 12px;

    .stat-info {
      flex: 1;

      .stat-label {
        font-size: 11px;
        color: var(--text-color-3);
        margin-bottom: 2px;
      }

      .stat-value {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-color-1);
      }
    }
  }
}

.settings-footer {
  padding: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  background: var(--card-color);
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 12px;
}

// Safe area support
@supports (padding: env(safe-area-inset-bottom)) {
  .settings-footer {
    padding-bottom: max(16px, env(safe-area-inset-bottom));
  }
}
</style>
