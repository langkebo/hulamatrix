<template>
  <div
    class="voice-container select-none cursor-pointer"
    :class="{ playing: audioPlayback.isPlaying.value, loading: audioPlayback.loading.value }"
    @click="audioPlayback.togglePlayback">
    <!-- 语音图标 -->
    <div class="voice-icon select-none cursor-pointer">
      <img
        v-if="audioPlayback.loading.value"
        class="loading-icon"
        :style="{ color: voiceIconColor }"
        src="@/assets/img/loading.svg"
        alt="loading" />
      <svg v-else-if="audioPlayback.isPlaying.value" :style="{ color: voiceIconColor }">
        <use href="#pause-one"></use>
      </svg>
      <svg v-else :style="{ color: voiceIconColor }">
        <use href="#play"></use>
      </svg>
    </div>

    <!-- 音浪波形 -->
    <div
      class="waveform-container select-none cursor-pointer"
      :style="{ width: `${waveformRenderer.waveformWidth.value}px` }">
      <canvas
        ref="waveformCanvas"
        class="waveform-canvas"
        :style="{ color: voiceIconColor }"
        :width="waveformRenderer.waveformWidth.value"
        height="24"
        @click.stop="handleSeekToPosition"
        @mousedown.stop="dragControl.handleDragStart"
        @touchstart.stop="dragControl.handleDragStart"
        @pointerdown.stop></canvas>
      <div
        class="scan-line"
        :class="{ active: audioPlayback.isPlaying.value, dragging: dragControl.isDragging.value }"
        :style="{
          left: `${waveformRenderer.scanLinePosition.value}px`,
          background: `linear-gradient(to bottom, transparent, ${voiceIconColor}, transparent)`,
          boxShadow:
            audioPlayback.isPlaying.value || dragControl.isDragging.value ? `0 0 8px ${voiceIconColor}50` : 'none'
        }"></div>

      <!-- 时间预览提示 -->
      <div
        v-if="dragControl.showTimePreview.value"
        class="time-preview"
        :style="{
          left: `${waveformRenderer.scanLinePosition.value}px`,
          color: isCurrentUser ? 'var(--hula-white)' : isDarkMode ? 'var(--hula-white)' : 'var(--hula-black)',
          backgroundColor: isCurrentUser
            ? 'var(--hula-brand-primary)'
            : isDarkMode
              ? 'var(--hula-brand-primary)'
              : 'var(--hula-white)',
          border: isCurrentUser
            ? 'none'
            : isDarkMode
              ? '1px solid var(--hula-brand-primary)'
              : '1px solid var(--hula-brand-primary)'
        }">
        {{ formatTime(dragControl.previewTime.value) }}
      </div>
    </div>

    <!-- 语音时长 -->
    <div class="voice-second select-none cursor-pointer" :style="{ color: voiceIconColor }">
      {{ formatTime(second) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ThemeEnum } from '@/enums'
import { useAudioFileManager } from '@/hooks/useAudioFileManager'
import { useAudioPlayback } from '@/hooks/useAudioPlayback'
import { useVoiceDragControl } from '@/hooks/useVoiceDragControl'
import { useWaveformRenderer } from '@/hooks/useWaveformRenderer'
import type { VoiceBody } from '@/services/types'
import { useSettingStore } from '@/stores/setting'
import type { EncryptedFile } from '@/integrations/matrix/mediaCrypto'

// Extended VoiceBody type with encrypted file support
interface VoiceBodyWithEncryption extends VoiceBody {
  file?: EncryptedFile
  [key: string]: unknown
}
import { fileService } from '@/services/file-service'
import { convertFileSrc } from '@tauri-apps/api/core'
import { appDataDir, join, resourceDir } from '@tauri-apps/api/path'
import { BaseDirectory, exists, mkdir, writeFile } from '@tauri-apps/plugin-fs'
import { detectRemoteFileType } from '@/utils/PathUtil'
import { md5FromString } from '@/utils/Md5Util'
import { useUserStore } from '@/stores/user'
import { isMobile } from '@/utils/PlatformConstants'
import { logger, toError } from '@/utils/logger'

const props = defineProps<{
  body: VoiceBodyWithEncryption
  fromUserUid: string
}>()

const settingStore = useSettingStore()
const userStore = useUserStore()
const themes = computed(() => settingStore.themes)

// 使用messageId作为音频ID，确保唯一性
const audioId = props.body.url
const waveformCanvas = ref<HTMLCanvasElement | null>(null)

// 判断是否为深色模式
const isDarkMode = computed(() => {
  return themes.value.content === ThemeEnum.DARK
})

// 判断是否为当前用户发送的消息
const isCurrentUser = computed(() => {
  return props.fromUserUid === userStore.userInfo?.uid
})

// 计算语音图标颜色
const voiceIconColor = computed(() => {
  if (isCurrentUser.value) {
    return 'var(--hula-white)'
  } else {
    return isDarkMode.value ? 'var(--hula-white)' : 'var(--hula-black)'
  }
})

// 音频时长
const second = computed(() => props.body.second || 0)
// 音频文件管理
const fileManager = useAudioFileManager(userStore.userInfo?.uid as string)
// 音频播放控制
const audioPlayback = useAudioPlayback(audioId, (_currentTime: number, _progress: number) => {
  // 时间更新回调，用于重绘波形
  waveformRenderer.drawWaveformThrottled()
})

// 拖拽控制
const dragControl = useVoiceDragControl(
  waveformCanvas,
  second,
  audioPlayback.isPlaying,
  (time: number) => {
    audioPlayback.seekToTime(time)
    waveformRenderer.drawWaveformImmediate()
  },
  async (shouldPlay: boolean) => {
    if (shouldPlay) {
      await audioPlayback.togglePlayback()
    } else {
      if (audioPlayback.audioElement.value) {
        audioPlayback.audioElement.value.pause()
        audioPlayback.isPlaying.value = false
      }
    }
  }
)

// 波形渲染
const waveformRenderer = useWaveformRenderer(
  second,
  audioPlayback.playbackProgress,
  dragControl.isDragging,
  dragControl.previewTime,
  () => getWaveformColors()
)

// 计算波形颜色状态
const getWaveformColors = () => {
  const baseColor = isCurrentUser.value
    ? 'var(--hula-brand-primary)'
    : isDarkMode.value
      ? 'var(--hula-brand-primary)'
      : 'var(--hula-brand-primary)'

  // 已播放区域颜色（始终完全不透明）
  const playedColor = baseColor

  // 未播放区域颜色（根据播放状态调整透明度）
  let unplayedOpacity: number
  if (audioPlayback.isPlaying.value || dragControl.isDragging.value) {
    unplayedOpacity = 0.3
  } else {
    unplayedOpacity = 1.0
  }

  const unplayedColor = `${baseColor}${Math.round(unplayedOpacity * 255)
    .toString(16)
    .padStart(2, '0')}`

  return { playedColor, unplayedColor }
}

// 格式化时间
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 点击波形跳转到指定位置
const handleSeekToPosition = (event: MouseEvent) => {
  if (!audioPlayback.audioElement.value || !waveformCanvas.value || dragControl.isDragging.value) return

  const rect = waveformCanvas.value.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const progress = Math.max(0, Math.min(1, clickX / rect.width))
  const targetTime = progress * audioPlayback.audioElement.value.duration

  audioPlayback.seekToTime(targetTime)
  waveformRenderer.drawWaveformImmediate()
}

watch(isDarkMode, () => {
  waveformRenderer.shouldUpdateCache.value = true
  waveformRenderer.drawWaveform()
})

watch(audioPlayback.isPlaying, () => {
  waveformRenderer.shouldUpdateCache.value = true
  waveformRenderer.drawWaveform()
})

// 组件挂载
onMounted(async () => {
  try {
    // 设置Canvas引用
    waveformRenderer.waveformCanvas.value = waveformCanvas.value

    // 加载音频波形数据
    const enc: EncryptedFile | undefined = props.body?.file
    if (enc) {
      const cipherUrl = enc.url || props.body.url
      const result = await fileService.downloadWithResumeAndDecrypt(cipherUrl, enc)
      const plain = result.data
      await waveformRenderer.generateWaveformData(plain.buffer)
      // 写入本地缓存
      try {
        const userStore = useUserStore()
        const dir = await userStore.getUserRoomDir()
        const folder = await join(dir, 'audio')
        const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
        const ok = await exists(folder, { baseDir })
        if (!ok) await mkdir(folder, { baseDir, recursive: true })
        const extInfo = await detectRemoteFileType({ url: cipherUrl, fileSize: plain.length })
        const ext = extInfo?.ext || 'm4a'
        const name = `${await md5FromString(cipherUrl)}.${ext}`
        const rel = await join(folder, name)
        await writeFile(rel, plain, { baseDir })
        const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
        const abs = await join(baseDirPath, rel)
        const url = convertFileSrc(abs)
        await audioPlayback.createAudioElement(url, audioId, second.value)
      } catch {
        const blobUrl = URL.createObjectURL(new Blob([plain.buffer as unknown as ArrayBuffer]))
        await audioPlayback.createAudioElement(blobUrl, audioId, second.value)
      }
    } else {
      const audioBuffer = await fileManager.loadAudioWaveform(props.body.url)
      await waveformRenderer.generateWaveformData(audioBuffer)
      const audioUrl = await fileManager.getAudioUrl(props.body.url)
      await audioPlayback.createAudioElement(audioUrl, audioId, second.value)
    }
  } catch (error) {
    logger.error('组件初始化失败:', toError(error))
  }
})
onUnmounted(() => {
  audioPlayback.cleanup()
  dragControl.cleanup()
  fileManager.cleanup()
})
</script>

<style scoped lang="scss">
.voice-container {
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 18px;
  cursor: pointer;
  transition: all 0.2s ease;
  &.loading {
    cursor: wait;
    opacity: 0.7;
  }
}

.voice-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color, var(--hula-gray-900));

  svg {
    width: 18px;
    height: 18px;

    &.loading-icon {
      animation: spin 1s linear infinite;
    }
  }
}

.waveform-container {
  position: relative;
  height: 24px;
  display: flex;
  align-items: center;
  cursor: pointer;
  // 扩展触摸区域（移动端优化）
  padding: 4px 0;
  margin: -4px 0;

  .waveform-canvas {
    width: 100%;
    height: 100%;
    border-radius: 4px;
    user-select: none;
    -webkit-user-select: none;
  }

  .scan-line {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    border-radius: 1px;
    opacity: 0;
    transition: all 0.1s ease;
    pointer-events: none;
    z-index: 1;

    &.active {
      opacity: 0.8;
    }

    &.dragging {
      opacity: 1;
      width: 4px; // 拖拽时加宽
      transition: none; // 禁用过渡效果，实现即时响应
    }
  }

  .time-preview {
    position: absolute;
    top: -28px;
    transform: translateX(-50%);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 2;
    box-shadow: 0 2px 8px rgba(var(--hula-black-rgb), 0.2);
    animation: fadeIn 0.2s ease;
  }
}

.voice-second {
  font-size: 12px;
  white-space: nowrap;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes fadeIn {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(-4px);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
