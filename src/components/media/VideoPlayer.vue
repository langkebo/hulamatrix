import { TIME_INTERVALS } from '@/constants' import { msg } from '@/utils/SafeUI'
<template>
  <div class="video-player-container" :class="{ fullscreen: isFullscreen }">
    <!-- 视频播放器 -->
    <video
      ref="videoRef"
      class="video-element"
      :src="src"
      :poster="poster"
      :controls="showControls"
      :autoplay="autoplay"
      :loop="loop"
      :muted="muted"
      :preload="preload"
      @loadstart="handleLoadStart"
      @loadeddata="handleLoadedData"
      @canplay="handleCanPlay"
      @play="handlePlay"
      @pause="handlePause"
      @ended="handleEnded"
      @error="handleError"
      @timeupdate="handleTimeUpdate"
      @progress="handleProgress"
      @volumechange="handleVolumeChange"
      @fullscreenchange="handleFullscreenChange"
      @webkitfullscreenchange="handleFullscreenChange"
      @dblclick="toggleFullscreen"></video>

    <!-- 自定义控制栏 -->
    <div v-if="!showControls" class="custom-controls" :class="{ show: showCustomControls }">
      <div class="controls-left">
        <n-button text @click="togglePlay" class="control-btn">
          <template #icon>
            <svg v-if="!isPlaying" class="size-24px"><use href="#play"></use></svg>
            <svg v-else class="size-24px"><use href="#pause"></use></svg>
          </template>
        </n-button>
        <div class="time-display">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</div>
      </div>

      <div class="controls-center">
        <div class="progress-bar" @click="seekTo" ref="progressBarRef">
          <div class="progress-buffered" :style="{ width: bufferedPercent + '%' }"></div>
          <div class="progress-played" :style="{ width: playedPercent + '%' }"></div>
          <div class="progress-handle" :style="{ left: playedPercent + '%' }" @mousedown="startDragging"></div>
        </div>
      </div>

      <div class="controls-right">
        <n-button text @click="toggleMute" class="control-btn">
          <template #icon>
            <svg v-if="!muted" class="size-20px"><use href="#volume"></use></svg>
            <svg v-else class="size-20px"><use href="#volume-mute"></use></svg>
          </template>
        </n-button>
        <n-slider
          v-model:value="volume"
          :min="0"
          :max="100"
          :step="1"
          class="volume-slider"
          @update:value="updateVolume" />
        <n-button text @click="toggleFullscreen" class="control-btn">
          <template #icon>
            <svg class="size-20px"><use href="#fullscreen"></use></svg>
          </template>
        </n-button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-overlay">
      <n-spin size="large" />
    </div>

    <!-- 错误状态 -->
    <div v-if="error" class="error-overlay">
      <n-result status="error" :title="error" :sub-title="errorDetail">
        <template #footer>
          <n-space>
            <n-button @click="retry">重试</n-button>
            <n-button @click="$emit('close')">关闭</n-button>
          </n-space>
        </template>
      </n-result>
    </div>

    <!-- 播放按钮（初始状态） -->
    <div v-if="!isPlaying && !loading && !error && !hasStarted" class="play-button-overlay" @click="togglePlay">
      <n-button circle size="large" type="primary">
        <template #icon>
          <svg class="size-32px"><use href="#play"></use></svg>
        </template>
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { TIME_INTERVALS } from '@/constants'

const props = defineProps<{
  src: string
  poster?: string
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  showControls?: boolean
  preload?: 'none' | 'metadata' | 'auto'
  width?: number
  height?: number
}>()

const emit = defineEmits<{
  close: []
  play: []
  pause: []
  ended: []
  timeupdate: [currentTime: number]
  progress: [loaded: number, total: number]
}>()

// 元素引用
const videoRef = ref<HTMLVideoElement>()
const progressBarRef = ref<HTMLElement>()

// 状态
const loading = ref(true)
const error = ref('')
const errorDetail = ref('')
const isPlaying = ref(false)
const hasStarted = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const buffered = ref(0)
const volume = ref(100)
const isFullscreen = ref(false)
const showCustomControls = ref(false)
const isDragging = ref(false)

// 计算属性
const bufferedPercent = computed(() => {
  if (duration.value === 0) return 0
  return (buffered.value / duration.value) * 100
})

const playedPercent = computed(() => {
  if (duration.value === 0) return 0
  return (currentTime.value / duration.value) * 100
})

// 格式化时间
const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

// 播放控制
const togglePlay = () => {
  if (!videoRef.value) return

  if (videoRef.value.paused) {
    videoRef.value.play()
  } else {
    videoRef.value.pause()
  }
}

const toggleMute = () => {
  if (!videoRef.value) return
  videoRef.value.muted = !videoRef.value.muted
  volume.value = videoRef.value.muted ? 0 : videoRef.value.volume * 100
}

const updateVolume = (value: number) => {
  if (!videoRef.value) return
  videoRef.value.volume = value / 100
  videoRef.value.muted = value === 0
}

// 进度控制
const seekTo = (event: MouseEvent) => {
  if (!videoRef.value || !progressBarRef.value || isDragging.value) return

  const rect = progressBarRef.value.getBoundingClientRect()
  const percent = ((event.clientX - rect.left) / rect.width) * 100
  const time = (percent / 100) * duration.value
  videoRef.value.currentTime = time
}

const startDragging = (event: MouseEvent) => {
  isDragging.value = true
  document.addEventListener('mousemove', handleDragging)
  document.addEventListener('mouseup', stopDragging)
  event.preventDefault()
}

const handleDragging = (event: MouseEvent) => {
  if (!videoRef.value || !progressBarRef.value) return

  const rect = progressBarRef.value.getBoundingClientRect()
  const percent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100))
  const time = (percent / 100) * duration.value
  videoRef.value.currentTime = time
}

const stopDragging = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDragging)
  document.removeEventListener('mouseup', stopDragging)
}

// 全屏控制
const toggleFullscreen = () => {
  if (!videoRef.value) return

  if (!document.fullscreenElement) {
    videoRef.value.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

// 事件处理
const handleLoadStart = () => {
  loading.value = true
  error.value = ''
  errorDetail.value = ''
}

const handleLoadedData = () => {
  if (videoRef.value) {
    duration.value = videoRef.value.duration
  }
}

const handleCanPlay = () => {
  loading.value = false
  if (props.autoplay) {
    videoRef.value?.play()
  }
}

const handlePlay = () => {
  isPlaying.value = true
  hasStarted.value = true
  emit('play')
}

const handlePause = () => {
  isPlaying.value = false
  emit('pause')
}

const handleEnded = () => {
  isPlaying.value = false
  emit('ended')
  if (props.loop && videoRef.value) {
    videoRef.value.currentTime = 0
    videoRef.value.play()
  }
}

const handleError = () => {
  loading.value = false
  if (videoRef.value?.error) {
    const videoError = videoRef.value.error
    error.value = getVideoErrorMessage(videoError.code)
    errorDetail.value = videoError.message
  } else {
    error.value = '视频播放失败'
    errorDetail.value = '未知错误'
  }
}

const handleTimeUpdate = () => {
  if (videoRef.value) {
    currentTime.value = videoRef.value.currentTime
    emit('timeupdate', currentTime.value)
  }
}

const handleProgress = () => {
  if (videoRef.value && videoRef.value.buffered.length > 0) {
    const bufferedEnd = videoRef.value.buffered.end(videoRef.value.buffered.length - 1)
    buffered.value = bufferedEnd
    emit('progress', bufferedEnd, duration.value)
  }
}

const handleVolumeChange = () => {
  if (videoRef.value) {
    volume.value = videoRef.value.muted ? 0 : videoRef.value.volume * 100
  }
}

const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
}

const getVideoErrorMessage = (code: number): string => {
  switch (code) {
    case 1:
      return '视频加载被中止'
    case 2:
      return '网络错误'
    case 3:
      return '视频解码错误'
    case 4:
      return '视频格式不支持或不兼容'
    default:
      return '视频播放错误'
  }
}

const retry = () => {
  if (videoRef.value) {
    videoRef.value.load()
  }
}

// 显示/隐藏自定义控制栏
let hideControlsTimer: NodeJS.Timeout | null = null

const showCustomControlsPanel = () => {
  showCustomControls.value = true
  if (hideControlsTimer) {
    clearTimeout(hideControlsTimer)
  }
  hideControlsTimer = setTimeout(() => {}, TIME_INTERVALS.TOAST_DURATION)
}

const handleMouseMove = () => {
  showCustomControlsPanel()
}

// 键盘事件
const handleKeydown = (event: KeyboardEvent) => {
  switch (event.key) {
    case ' ':
    case 'k':
      event.preventDefault()
      togglePlay()
      break
    case 'ArrowRight':
      event.preventDefault()
      if (videoRef.value) {
        videoRef.value.currentTime = Math.min(videoRef.value.currentTime + 5, duration.value)
      }
      break
    case 'ArrowLeft':
      event.preventDefault()
      if (videoRef.value) {
        videoRef.value.currentTime = Math.max(videoRef.value.currentTime - 5, 0)
      }
      break
    case 'ArrowUp':
      event.preventDefault()
      updateVolume(Math.min(volume.value + 10, 100))
      break
    case 'ArrowDown':
      event.preventDefault()
      updateVolume(Math.max(volume.value - 10, 0))
      break
    case 'm':
      event.preventDefault()
      toggleMute()
      break
    case 'f':
      event.preventDefault()
      toggleFullscreen()
      break
    case 'Escape':
      if (isFullscreen.value) {
        document.exitFullscreen()
      } else {
        emit('close')
      }
      break
  }
}

// 监听器
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('mousemove', handleMouseMove)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('mousemove', handleMouseMove)
  if (hideControlsTimer) {
    clearTimeout(hideControlsTimer)
  }
  // Clean up dragging event listeners in case component unmounts while dragging
  if (isDragging.value) {
    document.removeEventListener('mousemove', handleDragging)
    document.removeEventListener('mouseup', stopDragging)
  }
})

// 监听属性变化
watch(
  () => props.muted,
  (value) => {
    if (videoRef.value) {
      videoRef.value.muted = value
    }
  }
)
</script>

<style scoped>
.video-player-container {
  position: relative;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.video-player-container.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
}

.video-element {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
}

.custom-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  padding: 20px;
  opacity: 0;
  transition: opacity 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.custom-controls.show {
  opacity: 1;
}

.control-btn {
  color: white;
}

.time-display {
  color: white;
  font-size: 12px;
  margin: 0 12px;
  min-width: 100px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
  cursor: pointer;
  position: relative;
  margin: 0 16px;
}

.progress-buffered {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 3px;
}

.progress-played {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: #18a058;
  border-radius: 3px;
}

.progress-handle {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  cursor: grab;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.progress-handle:active {
  cursor: grabbing;
}

.controls-left,
.controls-center,
.controls-right {
  display: flex;
  align-items: center;
}

.controls-center {
  flex: 1;
}

.loading-overlay,
.error-overlay,
.play-button-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.play-button-overlay {
  background: transparent;
  cursor: pointer;
}

.play-button-overlay:hover .n-button {
  transform: scale(1.1);
}

.volume-slider {
  width: 80px;
  margin: 0 8px;
}
</style>
