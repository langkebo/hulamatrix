<template>
  <n-modal
    :show="visible"
    :mask-closable="true"
    preset="card"
    :style="{ width: '90vw', maxWidth: '1200px' }"
    @close="handleClose"
    @mask-click="handleClose">
    <template #header>
      <n-space align="center" justify="space-between">
        <span class="text-16px font-500">{{ title || '图片预览' }}</span>
        <n-button quaternary circle @click="handleClose">
          <template #icon>
            <svg class="size-20px"><use href="#close"></use></svg>
          </template>
        </n-button>
      </n-space>
    </template>

    <div class="image-preview-container">
      <!-- 加载状态 -->
      <div v-if="loading" class="flex-center" style="height: 400px">
        <n-spin size="large" />
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="flex-center flex-col" style="height: 400px">
        <n-result status="error" title="加载失败" :description="error">
          <template #footer>
            <n-button @click="retry">重试</n-button>
          </template>
        </n-result>
      </div>

      <!-- 图片预览 -->
      <div v-else class="relative">
        <!-- 图片信息栏 -->
        <div class="image-info-bar">
          <n-space>
            <n-text depth="3">{{ imageInfo.name }}</n-text>
            <n-text depth="3">{{ formatFileSize(imageInfo.size) }}</n-text>
            <n-text depth="3">{{ imageInfo.width }} × {{ imageInfo.height }}</n-text>
          </n-space>
          <n-space>
            <n-button text @click="rotateLeft">
              <template #icon>
                <svg class="size-18px rotate-180"><use href="#rotate"></use></svg>
              </template>
            </n-button>
            <n-button text @click="rotateRight">
              <template #icon>
                <svg class="size-18px"><use href="#rotate"></use></svg>
              </template>
            </n-button>
            <n-button text @click="download">
              <template #icon>
                <svg class="size-18px"><use href="#download"></use></svg>
              </template>
            </n-button>
          </n-space>
        </div>

        <!-- 图片展示区 -->
        <div class="image-display-area" ref="imageContainerRef">
          <img
            ref="imageRef"
            :src="currentImageUrl"
            :style="imageStyle"
            :class="['preview-image', { 'contain-mode': fitMode === 'contain' }]"
            @load="handleImageLoad"
            @error="handleImageError"
            draggable="false"
          />
        </div>

        <!-- 缩放控制 -->
        <div class="zoom-controls">
          <n-button-group>
            <n-button @click="zoomOut" :disabled="scale <= 0.1">
              <template #icon>
                <svg class="size-16px"><use href="#minus"></use></svg>
              </template>
            </n-button>
            <n-button @click="resetZoom">重置</n-button>
            <n-button @click="zoomIn" :disabled="scale >= 5">
              <template #icon>
                <svg class="size-16px"><use href="#plus"></use></svg>
              </template>
            </n-button>
          </n-button-group>
          <n-select
            v-model:value="fitMode"
            :options="fitModeOptions"
            style="width: 120px; margin-left: 12px" />
        </div>

        <!-- 导航按钮（多图时） -->
        <template v-if="images.length > 1">
          <n-button
            circle
            class="nav-button prev-button"
            @click="prevImage"
            :disabled="currentIndex === 0">
            <template #icon>
              <svg class="size-24px"><use href="#left"></use></svg>
            </template>
          </n-button>
          <n-button
            circle
            class="nav-button next-button"
            @click="nextImage"
            :disabled="currentIndex === images.length - 1">
            <template #icon>
              <svg class="size-24px"><use href="#right"></use></svg>
            </template>
          </n-button>
          <div class="image-indicator">
            {{ currentIndex + 1 }} / {{ images.length }}
          </div>
        </template>
      </div>
    </div>

    <template #footer>
      <n-space justify="end">
        <n-button @click="handleClose">关闭</n-button>
        <n-button v-if="canDownload" type="primary" @click="download">
          下载图片
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

import { formatFileSize } from '@/utils/fileHelpers'

import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

interface ImageInfo {
  id: string
  name: string
  url: string
  width?: number
  height?: number
  size?: number
  downloadUrl?: string
}

const props = defineProps<{
  visible: boolean
  images: ImageInfo[]
  initialIndex?: number
  title?: string
  canDownload?: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  close: []
}>()

const message = msg

// 状态
const loading = ref(true)
const error = ref('')
const currentIndex = ref(props.initialIndex || 0)
const scale = ref(1)
const rotation = ref(0)
const fitMode = ref<'contain' | 'fill'>('contain')
const imageRef = ref<HTMLImageElement>()
const imageContainerRef = ref<HTMLElement>()

// 计算属性
const currentImage = computed(() => props.images[currentIndex.value] || ({} as ImageInfo))
const currentImageUrl = computed(() => currentImage.value.url || '')
const imageInfo = computed(() => ({
  name: currentImage.value.name || '未知图片',
  size: currentImage.value.size || 0,
  width: currentImage.value.width || 0,
  height: currentImage.value.height || 0
}))

const fitModeOptions = [
  { label: '适应窗口', value: 'contain' },
  { label: '填充窗口', value: 'fill' }
]

const imageStyle = computed(() => ({
  transform: `scale(${scale.value}) rotate(${rotation.value}deg)`
}))

// 方法
const handleClose = () => {
  emit('update:visible', false)
  emit('close')
}

const loadCurrentImage = async () => {
  loading.value = true
  error.value = ''
  scale.value = 1
  rotation.value = 0

  if (!currentImageUrl.value) {
    error.value = '图片地址无效'
    loading.value = false
    return
  }

  // 预加载图片
  const img = new Image()
  img.onload = () => {
    loading.value = false
    // 更新图片尺寸信息
    if (currentImage.value) {
      currentImage.value.width = img.width
      currentImage.value.height = img.height
    }
  }
  img.onerror = () => {
    error.value = '图片加载失败'
    loading.value = false
  }
  img.src = currentImageUrl.value
}

const retry = () => {
  loadCurrentImage()
}

const handleImageLoad = () => {
  loading.value = false
  nextTick(() => {
    centerImage()
  })
}

const handleImageError = () => {
  error.value = '图片加载失败'
  loading.value = false
}

const centerImage = () => {
  if (!imageRef.value || !imageContainerRef.value) return

  const container = imageContainerRef.value
  const scrollLeft = (container.scrollWidth - container.clientWidth) / 2
  const scrollTop = (container.scrollHeight - container.clientHeight) / 2

  container.scrollTo({
    left: scrollLeft,
    top: scrollTop,
    behavior: 'smooth'
  })
}

const zoomIn = () => {
  scale.value = Math.min(scale.value * 1.2, 5)
  nextTick(centerImage)
}

const zoomOut = () => {
  scale.value = Math.max(scale.value / 1.2, 0.1)
  nextTick(centerImage)
}

const resetZoom = () => {
  scale.value = 1
  nextTick(centerImage)
}

const rotateLeft = () => {
  rotation.value -= 90
}

const rotateRight = () => {
  rotation.value += 90
}

const prevImage = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
    loadCurrentImage()
  }
}

const nextImage = () => {
  if (currentIndex.value < props.images.length - 1) {
    currentIndex.value++
    loadCurrentImage()
  }
}

const download = async () => {
  if (!currentImageUrl.value) {
    message.error('没有可下载的图片')
    return
  }

  try {
    const url = currentImage.value.downloadUrl || currentImageUrl.value
    const response = await fetch(url)
    const blob = await response.blob()

    const downloadUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = currentImage.value.name || 'image.jpg'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(downloadUrl)

    message.success('下载成功')
  } catch (error) {
    logger.error('下载失败:', error)
    message.error('下载失败')
  }
}

// 键盘事件处理
const handleKeydown = (e: KeyboardEvent) => {
  if (!props.visible) return

  switch (e.key) {
    case 'Escape':
      handleClose()
      break
    case 'ArrowLeft':
      if (props.images.length > 1) prevImage()
      break
    case 'ArrowRight':
      if (props.images.length > 1) nextImage()
      break
    case '+':
    case '=':
      e.preventDefault()
      zoomIn()
      break
    case '-':
    case '_':
      e.preventDefault()
      zoomOut()
      break
    case '0':
      e.preventDefault()
      resetZoom()
      break
  }
}

// 监听 visible 变化
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      currentIndex.value = props.initialIndex || 0
      loadCurrentImage()
      document.addEventListener('keydown', handleKeydown)
    } else {
      document.removeEventListener('keydown', handleKeydown)
    }
  }
)

// 监听图片变化
watch(currentIndex, () => {
  loadCurrentImage()
})

// 生命周期
onMounted(() => {
  if (props.visible) {
    loadCurrentImage()
    document.addEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.image-preview-container {
  position: relative;
  min-height: 400px;
  max-height: 80vh;
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-info-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: var(--n-card-color);
  border-bottom: 1px solid var(--n-border-color);
  position: sticky;
  top: 0;
  z-index: 10;
}

.image-display-area {
  overflow: auto;
  width: 100%;
  height: calc(80vh - 200px);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: var(--n-modal-color);
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  transition: transform 0.3s ease;
  cursor: move;
  user-select: none;
  -webkit-user-drag: none;
}

.preview-image.contain-mode {
  object-fit: contain;
}

.zoom-controls {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.6);
  padding: 8px 16px;
  border-radius: 20px;
  backdrop-filter: blur(10px);
}

.nav-button {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
}

.prev-button {
  left: 20px;
}

.next-button {
  right: 20px;
}

.image-indicator {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
}

/* 滚动条样式 */
.image-display-area::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.image-display-area::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

.image-display-area::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.image-display-area::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}
</style>