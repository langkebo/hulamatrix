<template>
  <div class="call-settings">
    <div class="settings-header">
      <h3>通话设置</h3>
      <n-button quaternary circle @click="$emit('closed')">
        <template #icon>
          <n-icon><X /></n-icon>
        </template>
      </n-button>
    </div>

    <div class="settings-content">
      <!-- 音频设置 -->
      <div class="settings-section">
        <h4>音频设置</h4>

        <!-- 麦克风选择 -->
        <div class="setting-item">
          <label>麦克风</label>
          <n-select
            v-model:value="audioSettings.microphoneId"
            :options="availableMicrophones"
            placeholder="选择麦克风"
            @update:value="changeMicrophone" />
          <div class="setting-description">选择用于通话的麦克风设备</div>
        </div>

        <!-- 扬声器选择 -->
        <div class="setting-item">
          <label>扬声器</label>
          <n-select
            v-model:value="audioSettings.speakerId"
            :options="availableSpeakers"
            placeholder="选择扬声器"
            @update:value="changeSpeaker" />
          <div class="setting-description">选择用于播放音频的输出设备</div>
        </div>

        <!-- 音量调节 -->
        <div class="setting-item">
          <label>输入音量</label>
          <div class="volume-control">
            <n-slider
              v-model:value="audioSettings.inputVolume"
              :min="0"
              :max="100"
              :step="1"
              @update:value="changeInputVolume" />
            <span class="volume-value">{{ audioSettings.inputVolume }}%</span>
          </div>
          <div class="audio-visualizer">
            <div
              v-for="(level, index) in audioLevels"
              :key="index"
              class="audio-bar"
              :class="{ active: level > 0 }"
              :style="{ height: `${level}%` }"></div>
          </div>
        </div>

        <!-- 音频效果 -->
        <div class="setting-item">
          <label>音频增强</label>
          <div class="toggle-group">
            <n-switch v-model:value="audioSettings.noiseCancellation" @update:value="toggleNoiseCancellation">
              <template #checked>已开启</template>
              <template #unchecked>已关闭</template>
            </n-switch>
            <span class="toggle-label">降噪</span>
          </div>
          <div class="toggle-group">
            <n-switch v-model:value="audioSettings.echoCancellation" @update:value="toggleEchoCancellation">
              <template #checked>已开启</template>
              <template #unchecked>已关闭</template>
            </n-switch>
            <span class="toggle-label">回声消除</span>
          </div>
          <div class="toggle-group">
            <n-switch v-model:value="audioSettings.autoGainControl" @update:value="toggleAutoGainControl">
              <template #checked>已开启</template>
              <template #unchecked>已关闭</template>
            </n-switch>
            <span class="toggle-label">自动增益</span>
          </div>
        </div>
      </div>

      <!-- 视频设置 -->
      <div class="settings-section" v-if="callType === 'video'">
        <h4>视频设置</h4>

        <!-- 摄像头选择 -->
        <div class="setting-item">
          <label>摄像头</label>
          <n-select
            v-model:value="videoSettings.cameraId"
            :options="availableCameras"
            placeholder="选择摄像头"
            @update:value="changeCamera" />
          <div class="setting-description">选择用于视频通话的摄像头设备</div>
        </div>

        <!-- 视频分辨率 -->
        <div class="setting-item">
          <label>视频质量</label>
          <n-select
            v-model:value="videoSettings.quality"
            :options="videoQualityOptions"
            @update:value="changeVideoQuality" />
          <div class="setting-description">更高的质量需要更多的网络带宽</div>
        </div>

        <!-- 视频效果 -->
        <div class="setting-item">
          <label>视频增强</label>
          <div class="toggle-group">
            <n-switch v-model:value="videoSettings.beautification" @update:value="toggleBeautification">
              <template #checked>已开启</template>
              <template #unchecked>已关闭</template>
            </n-switch>
            <span class="toggle-label">美颜</span>
          </div>
          <div class="toggle-group">
            <n-switch v-model:value="videoSettings.backgroundBlur" @update:value="toggleBackgroundBlur">
              <template #checked>已开启</template>
              <template #unchecked>已关闭</template>
            </n-switch>
            <span class="toggle-label">背景虚化</span>
          </div>
        </div>

        <!-- 美颜设置 -->
        <div v-if="videoSettings.beautification" class="setting-sub-item">
          <label>美颜强度</label>
          <n-slider
            v-model:value="videoSettings.beautificationLevel"
            :min="0"
            :max="100"
            :step="1"
            @update:value="changeBeautificationLevel" />
        </div>
      </div>

      <!-- 网络设置 -->
      <div class="settings-section">
        <h4>网络设置</h4>

        <!-- 服务器选择 -->
        <div class="setting-item">
          <label>连接服务器</label>
          <n-select v-model:value="networkSettings.server" :options="serverOptions" @update:value="changeServer" />
          <div class="setting-description">选择延迟最低的媒体服务器</div>
        </div>

        <!-- 带宽限制 -->
        <div class="setting-item">
          <label>带宽限制</label>
          <n-select
            v-model:value="networkSettings.bandwidthLimit"
            :options="bandwidthOptions"
            @update:value="changeBandwidthLimit" />
          <div class="setting-description">根据网络状况限制视频带宽</div>
        </div>
      </div>

      <!-- 通话记录 -->
      <div class="settings-section">
        <h4>通话统计</h4>

        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-label">通话时长</div>
            <div class="stat-value">{{ formatDuration(callStats.duration) }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">数据使用</div>
            <div class="stat-value">{{ formatBytes(callStats.bytesTransferred) }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">丢包率</div>
            <div class="stat-value">{{ (callStats.packetLoss * 100).toFixed(1) }}%</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">平均延迟</div>
            <div class="stat-value">{{ callStats.averageLatency }}ms</div>
          </div>
        </div>
      </div>

      <!-- 快捷键 -->
      <div class="settings-section">
        <h4>快捷键</h4>

        <div class="shortcuts-list">
          <div class="shortcut-item">
            <span class="shortcut-key">Space</span>
            <span class="shortcut-desc">静音/取消静音</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-key">V</span>
            <span class="shortcut-desc">开启/关闭摄像头</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-key">S</span>
            <span class="shortcut-desc">开启/关闭屏幕共享</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-key">R</span>
            <span class="shortcut-desc">开始/停止录制</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-key">Esc</span>
            <span class="shortcut-desc">退出全屏</span>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-footer">
      <n-space>
        <n-button @click="resetToDefaults">重置默认</n-button>
        <n-button type="primary" @click="saveSettings">保存设置</n-button>
      </n-space>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { NButton, NIcon, NSelect, NSlider, NSwitch, NSpace } from 'naive-ui'
import { X } from '@vicons/tabler'
import type { MediaStream, MediaStreamTrack } from '@/types/rtc'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'
import { secureRandomFloat } from '@/utils/secureRandom'

interface Props {
  callType: 'audio' | 'video'
  localStream?: MediaStream | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  closed: []
}>()

const message = msg
//

// 音频设置
const audioSettings = ref({
  microphoneId: '',
  speakerId: '',
  inputVolume: 70,
  outputVolume: 80,
  noiseCancellation: true,
  echoCancellation: true,
  autoGainControl: true
})

// 视频设置
const videoSettings = ref({
  cameraId: '',
  quality: '720p',
  frameRate: 30,
  beautification: false,
  backgroundBlur: false,
  beautificationLevel: 50
})

// 网络设置
const networkSettings = ref({
  server: 'auto',
  bandwidthLimit: 'auto'
})

// 音频级别可视化
const audioLevels = ref(Array(20).fill(0))

// 设备列表
const availableMicrophones = ref<Array<{ label: string; value: string }>>([])
const availableSpeakers = ref<Array<{ label: string; value: string }>>([])
const availableCameras = ref<Array<{ label: string; value: string }>>([])

// 选项列表
const videoQualityOptions = [
  { label: '流畅 (360p)', value: '360p' },
  { label: '标准 (480p)', value: '480p' },
  { label: '高清 (720p)', value: '720p' },
  { label: '超清 (1080p)', value: '1080p' }
]

const serverOptions = [
  { label: '自动选择', value: 'auto' },
  { label: '亚洲服务器', value: 'asia' },
  { label: '欧洲服务器', value: 'europe' },
  { label: '美洲服务器', value: 'america' }
]

const bandwidthOptions = [
  { label: '自动', value: 'auto' },
  { label: '低 (500kbps)', value: 'low' },
  { label: '中 (1Mbps)', value: 'medium' },
  { label: '高 (2Mbps)', value: 'high' }
]

// 通话统计
const callStats = ref({
  duration: 0,
  bytesTransferred: 0,
  packetLoss: 0,
  averageLatency: 0
})

// 音频分析器
let audioAnalyzer: AnalyserNode | null = null
let animationFrame: number | null = null

// ========== 方法 ==========

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

    // 设置默认选择
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

  // 计算音频级别
  const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
  const normalizedLevel = Math.min(100, (average / 255) * 100)

  // 更新可视化
  const barCount = audioLevels.value.length
  const activeBars = Math.floor((normalizedLevel / 100) * barCount)

  audioLevels.value = Array(barCount)
    .fill(0)
    .map((_, index) => {
      if (index < activeBars) {
        return secureRandomFloat() * 100
      }
      return 0
    })

  animationFrame = requestAnimationFrame(updateAudioLevels)
}

// ========== 事件处理 ==========

const changeMicrophone = async (deviceId: string) => {
  try {
    if (props.localStream) {
      const audioTracks = props.localStream.getAudioTracks()
      if (audioTracks.length > 0) {
        const constraints = {
          audio: {
            deviceId: { exact: deviceId },
            ...getAudioConstraints()
          }
        }

        const newStream = await navigator.mediaDevices.getUserMedia(constraints)
        audioTracks.forEach((track: MediaStreamTrack) => track.stop())

        // 替换音频轨道
        newStream.getAudioTracks().forEach((track: MediaStreamTrack) => {
          props.localStream?.addTrack(track)
        })
      }
    }
  } catch (error) {
    logger.error('Failed to change microphone:', error)
    message.error('切换麦克风失败')
  }
}

const changeSpeaker = (_deviceId: string) => {
  // 扬声器设置通常在 HTML 元素上处理
  message.success('扬声器已更改')
}

const changeCamera = async (deviceId: string) => {
  try {
    if (props.localStream && props.callType === 'video') {
      const videoTracks = props.localStream.getVideoTracks()
      if (videoTracks.length > 0) {
        const constraints = {
          video: {
            deviceId: { exact: deviceId },
            ...getVideoConstraints()
          }
        }

        const newStream = await navigator.mediaDevices.getUserMedia(constraints)
        videoTracks.forEach((track: MediaStreamTrack) => track.stop())

        // 替换视频轨道
        newStream.getVideoTracks().forEach((track: MediaStreamTrack) => {
          props.localStream?.addTrack(track)
        })
      }
    }
  } catch (error) {
    logger.error('Failed to change camera:', error)
    message.error('切换摄像头失败')
  }
}

const changeInputVolume = (_volume: number) => {}

const changeVideoQuality = (quality: string) => {
  // 视频质量设置需要在重新建立连接时应用
  message.info(`视频质量已设置为 ${quality}`)
}

const getAudioConstraints = () => ({
  noiseSuppression: audioSettings.value.noiseCancellation,
  echoCancellation: audioSettings.value.echoCancellation,
  autoGainControl: audioSettings.value.autoGainControl
})

const getVideoConstraints = () => {
  const qualityMap = {
    '360p': { width: 640, height: 360 },
    '480p': { width: 854, height: 480 },
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 }
  }

  return {
    ...qualityMap[videoSettings.value.quality as keyof typeof qualityMap],
    frameRate: videoSettings.value.frameRate
  }
}

const toggleNoiseCancellation = (_enabled: boolean) => {
  // 重新应用音频约束
  changeMicrophone(audioSettings.value.microphoneId)
}

const toggleEchoCancellation = (_enabled: boolean) => {
  changeMicrophone(audioSettings.value.microphoneId)
}

const toggleAutoGainControl = (_enabled: boolean) => {
  changeMicrophone(audioSettings.value.microphoneId)
}

const toggleBeautification = (enabled: boolean) => {
  // 美颜功能需要额外的处理
  message.info(enabled ? '美颜已开启' : '美颜已关闭')
}

const toggleBackgroundBlur = (enabled: boolean) => {
  // 背景虚化需要额外的处理
  message.info(enabled ? '背景虚化已开启' : '背景虚化已关闭')
}

const changeBeautificationLevel = (_level: number) => {
  // 美颜级别调整
}

const changeServer = (server: string) => {
  // 服务器选择处理
  message.info(`已选择 ${server} 服务器`)
}

const changeBandwidthLimit = (limit: string) => {
  // 带宽限制处理
  message.info(`带宽限制已设置为 ${limit}`)
}

const resetToDefaults = () => {
  audioSettings.value = {
    microphoneId: availableMicrophones.value[0]?.value || '',
    speakerId: availableSpeakers.value[0]?.value || '',
    inputVolume: 70,
    outputVolume: 80,
    noiseCancellation: true,
    echoCancellation: true,
    autoGainControl: true
  }

  videoSettings.value = {
    cameraId: availableCameras.value[0]?.value || '',
    quality: '720p',
    frameRate: 30,
    beautification: false,
    backgroundBlur: false,
    beautificationLevel: 50
  }

  networkSettings.value = {
    server: 'auto',
    bandwidthLimit: 'auto'
  }

  message.success('设置已重置为默认值')
}

const saveSettings = () => {
  // 保存设置到本地存储
  localStorage.setItem('call-audio-settings', JSON.stringify(audioSettings.value))
  localStorage.setItem('call-video-settings', JSON.stringify(videoSettings.value))
  localStorage.setItem('call-network-settings', JSON.stringify(networkSettings.value))

  message.success('设置已保存')
  emit('closed')
}

// ========== 生命周期 ==========

onMounted(() => {
  loadDevices()

  // 监听设备变化
  navigator.mediaDevices.addEventListener('devicechange', loadDevices)

  // 设置音频分析器
  if (props.localStream) {
    setupAudioAnalyzer()
  }

  // 加载保存的设置
  const savedAudioSettings = localStorage.getItem('call-audio-settings')
  const savedVideoSettings = localStorage.getItem('call-video-settings')
  const savedNetworkSettings = localStorage.getItem('call-network-settings')

  if (savedAudioSettings) {
    Object.assign(audioSettings.value, JSON.parse(savedAudioSettings))
  }

  if (savedVideoSettings) {
    Object.assign(videoSettings.value, JSON.parse(savedVideoSettings))
  }

  if (savedNetworkSettings) {
    Object.assign(networkSettings.value, JSON.parse(savedNetworkSettings))
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

<style lang="scss" scoped>
.call-settings {
  height: 100%;
  display: flex;
  flex-direction: column;

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid var(--border-color);

    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--text-color-1);
    }
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .settings-section {
    margin-bottom: 32px;

    h4 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-1);
    }
  }

  .setting-item {
    margin-bottom: 20px;

    label {
      display: block;
      font-weight: 500;
      color: var(--text-color-1);
      margin-bottom: 8px;
    }

    .setting-description {
      font-size: 12px;
      color: var(--text-color-3);
      margin-top: 4px;
    }

    .volume-control {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;

      .volume-value {
        min-width: 40px;
        text-align: right;
        font-size: 12px;
        color: var(--text-color-2);
      }
    }

    .audio-visualizer {
      display: flex;
      align-items: flex-end;
      gap: 2px;
      height: var(--hula-spacing-xl);

      .audio-bar {
        width: calc(var(--hula-spacing-xs) * 1);
        background: var(--border-color);
        border-radius: calc(var(--hula-spacing-xs) * 0.5);
        transition: background 0.1s ease, height 0.1s ease;

        &.active {
          background: var(--primary-color);
        }
      }
    }

    .toggle-group {
      display: flex;
      align-items: center;
      gap: var(--hula-spacing-md);
      margin-bottom: var(--hula-spacing-sm);

      .toggle-label {
        font-size: var(--hula-text-sm);
        color: var(--text-color-2);
      }
    }
  }

  .setting-sub-item {
    margin-left: 24px;
    margin-bottom: 16px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;

    .stat-item {
      padding: 16px;
      background: var(--card-color);
      border-radius: 8px;
      border: 1px solid var(--border-color);

      .stat-label {
        font-size: 12px;
        color: var(--text-color-3);
        margin-bottom: 4px;
      }

      .stat-value {
        font-size: 18px;
        font-weight: 600;
        color: var(--text-color-1);
      }
    }
  }

  .shortcuts-list {
    .shortcut-item {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;

      .shortcut-key {
        min-width: 60px;
        padding: 4px 8px;
        background: var(--bg-color-hover);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
        text-align: center;
        color: var(--text-color-2);
      }

      .shortcut-desc {
        color: var(--text-color-2);
        font-size: 14px;
      }
    }
  }

  .settings-footer {
    padding: 20px;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
  }
}

// 响应式设计
@media (max-width: 480px) {
  .call-settings {
    .stats-grid {
      grid-template-columns: 1fr;
    }

    .volume-control {
      flex-direction: column;
      align-items: stretch;

      .volume-value {
        text-align: center;
      }
    }
  }
}
</style>
