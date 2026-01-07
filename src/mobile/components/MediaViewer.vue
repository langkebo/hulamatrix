<script setup lang="ts">
/**
 * Mobile Media Viewer Component
 * Touch-friendly media viewer with gesture support for mobile devices
 *
 * @module mobile/components/MediaViewer
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import LazyImage from '@/components/common/LazyImage.vue'
import { matrixThumbnailService } from '@/services/matrixThumbnailService'

interface Props {
  /** MXC URL of the media */
  mxcUrl: string
  /** Media type */
  mediaType?: 'image' | 'video' | 'audio' | 'file'
  /** Whether viewer is visible */
  visible?: boolean
  /** Initial index for multiple media */
  index?: number
  /** Total count of media */
  total?: number
  /** Enable zoom */
  zoomable?: boolean
  /** Enable swipe to navigate */
  swipeable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mediaType: 'image',
  visible: false,
  index: 0,
  total: 1,
  zoomable: true,
  swipeable: true
})

const emit = defineEmits<{
  /** Emitted when viewer is closed */
  close: []
  /** Emitted when navigating to next/previous */
  navigate: [direction: 'next' | 'prev']
  /** Emitted when media is loaded */
  loaded: []
  /** Emitted when media fails to load */
  error: [error: Error]
}>()

// Refs
const containerRef = ref<HTMLElement | null>(null)
const mediaRef = ref<HTMLImageElement | HTMLVideoElement | null>(null)

// State
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const isDragging = ref(false)
const startX = ref(0)
const startY = ref(0)
const lastX = ref(0)
const lastY = ref(0)
const swipeStartX = ref(0)
const isZoomed = ref(false)

// Computed
const transformStyle = computed(() => {
  return `scale(${scale.value}) translate(${translateX.value}px, ${translateY.value}px)`
})

const canGoNext = computed(() => props.index < props.total - 1)
const canGoPrev = computed(() => props.index > 0)

/**
 * Reset transform
 */
function resetTransform() {
  scale.value = 1
  translateX.value = 0
  translateY.value = 0
  isZoomed.value = false
}

/**
 * Handle touch start
 */
function handleTouchStart(event: TouchEvent) {
  if (!props.zoomable) return

  if (event.touches.length === 1) {
    // Single touch - prepare for drag or swipe
    isDragging.value = true
    startX.value = event.touches[0].clientX
    startY.value = event.touches[0].clientY
    lastX.value = event.touches[0].clientX
    lastY.value = event.touches[0].clientY

    if (props.swipeable && !isZoomed.value) {
      swipeStartX.value = event.touches[0].clientX
    }
  } else if (event.touches.length === 2) {
    // Pinch to zoom
    const touch1 = event.touches[0]
    const touch2 = event.touches[1]
    const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY)

    // Store initial distance for zoom calculation
    ;(event.target as HTMLElement).dataset.pinchDistance = distance.toString()
  }
}

/**
 * Handle touch move
 */
function handleTouchMove(event: TouchEvent) {
  if (!props.zoomable) return

  if (event.touches.length === 1 && isDragging.value) {
    // Single touch drag
    const deltaX = event.touches[0].clientX - lastX.value
    const deltaY = event.touches[0].clientY - lastY.value

    if (isZoomed.value) {
      // Pan when zoomed
      event.preventDefault()
      translateX.value += deltaX
      translateY.value += deltaY
    } else if (props.swipeable) {
      // Track swipe for navigation
      const swipeDelta = event.touches[0].clientX - swipeStartX.value
      // Visual feedback for swipe
      translateX.value = swipeDelta * 0.5
    }

    lastX.value = event.touches[0].clientX
    lastY.value = event.touches[0].clientY
  } else if (event.touches.length === 2) {
    // Pinch to zoom
    event.preventDefault()

    const touch1 = event.touches[0]
    const touch2 = event.touches[1]
    const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY)

    const initialDistance = parseFloat((event.target as HTMLElement).dataset.pinchDistance || '0')

    if (initialDistance > 0) {
      const newScale = Math.max(1, Math.min(5, (distance / initialDistance) * scale.value))
      scale.value = newScale
      isZoomed.value = newScale > 1
    }
  }
}

/**
 * Handle touch end
 */
function handleTouchEnd(event: TouchEvent) {
  if (!props.zoomable) return

  if (event.touches.length === 0) {
    isDragging.value = false

    if (!isZoomed.value && props.swipeable) {
      // Check for swipe gesture
      const swipeDelta = event.changedTouches[0].clientX - swipeStartX.value
      const swipeThreshold = 50

      if (Math.abs(swipeDelta) > swipeThreshold) {
        // Navigate
        if (swipeDelta > 0 && canGoPrev.value) {
          emit('navigate', 'prev')
        } else if (swipeDelta < 0 && canGoNext.value) {
          emit('navigate', 'next')
        }
      }

      // Reset position
      translateX.value = 0
    }
  }
}

/**
 * Handle double tap to zoom
 */
let lastTapTime = 0
function handleDoubleTap(event: TouchEvent) {
  if (!props.zoomable) return

  const currentTime = Date.now()
  const tapInterval = currentTime - lastTapTime

  if (tapInterval < 300 && tapInterval > 0) {
    // Double tap detected
    event.preventDefault()

    if (isZoomed.value) {
      resetTransform()
    } else {
      // Zoom in on tap position
      const touch = event.touches[0]
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const x = touch.clientX - rect.left - rect.width / 2
      const y = touch.clientY - rect.top - rect.height / 2

      scale.value = 2
      translateX.value = -x * 0.5
      translateY.value = -y * 0.5
      isZoomed.value = true
    }

    lastTapTime = 0
  } else {
    lastTapTime = currentTime
  }
}

/**
 * Go to next media
 */
function goNext() {
  if (canGoNext.value) {
    resetTransform()
    emit('navigate', 'next')
  }
}

/**
 * Go to previous media
 */
function goPrev() {
  if (canGoPrev.value) {
    resetTransform()
    emit('navigate', 'prev')
  }
}

/**
 * Close viewer
 */
function close() {
  resetTransform()
  emit('close')
}

/**
 * Handle keyboard events
 */
function handleKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Escape':
      close()
      break
    case 'ArrowLeft':
      goPrev()
      break
    case 'ArrowRight':
      goNext()
      break
    case '+':
    case '=':
      if (props.zoomable) {
        scale.value = Math.min(5, scale.value * 1.2)
        isZoomed.value = true
      }
      break
    case '-':
      if (props.zoomable) {
        scale.value = Math.max(1, scale.value / 1.2)
        if (scale.value === 1) isZoomed.value = false
      }
      break
  }
}

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// Watch for prop changes
watch(
  () => props.mxcUrl,
  () => {
    resetTransform()
  }
)
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        ref="containerRef"
        class="mobile-media-viewer"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <!-- Top bar -->
        <div class="media-viewer-header">
          <button class="icon-button" @click="close">
            <span class="icon">✕</span>
          </button>
          <div class="media-counter">
            {{ index + 1 }} / {{ total }}
          </div>
          <div class="spacer" />
        </div>

        <!-- Media container -->
        <div
          class="media-container"
          :style="{ transform: transformStyle }"
          @dblclick="handleDoubleTap($event as unknown as TouchEvent)"
        >
          <!-- Image -->
          <LazyImage
            v-if="mediaType === 'image'"
            ref="mediaRef"
            :mxc-url="mxcUrl"
            class="media-content"
            @loaded="emit('loaded')"
            @error="emit('error', $event as unknown as Error)"
          />

          <!-- Video -->
          <video
            v-else-if="mediaType === 'video'"
            ref="mediaRef"
            :src="mxcUrl"
            class="media-content"
            controls
            @loadeddata="emit('loaded')"
            @error="emit('error', $event as unknown as Error)"
          />

          <!-- Audio -->
          <audio
            v-else-if="mediaType === 'audio'"
            ref="mediaRef"
            :src="mxcUrl"
            class="media-content"
            controls
            @loadeddata="emit('loaded')"
            @error="emit('error', $event as unknown as Error)"
          />

          <!-- File (download only) -->
          <div v-else class="file-content">
            <div class="file-icon">📄</div>
            <p class="file-message">File attachment</p>
          </div>
        </div>

        <!-- Navigation buttons -->
        <Transition name="slide">
          <button
            v-if="canGoPrev"
            class="nav-button prev"
            @click="goPrev"
          >
            <span class="icon">‹</span>
          </button>
        </Transition>

        <Transition name="slide">
          <button
            v-if="canGoNext"
            class="nav-button next"
            @click="goNext"
          >
            <span class="icon">›</span>
          </button>
        </Transition>

        <!-- Zoom controls -->
        <div v-if="zoomable && isZoomed" class="zoom-controls">
          <button class="icon-button" @click="resetTransform">
            <span class="icon">⟲</span>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.mobile-media-viewer {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  background-color: #000;
  touch-action: none;
}

.media-viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.5), transparent);
}

.icon-button {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: white;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  backdrop-filter: blur(10px);

  &:active {
    transform: scale(0.95);
  }
}

.media-counter {
  font-size: 14px;
  color: white;
  font-weight: 500;
}

.spacer {
  width: 40px;
}

.media-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: transform 0.2s ease-out;
  transform-origin: center center;
}

.media-content {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.file-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: white;
}

.file-icon {
  font-size: 64px;
}

.file-message {
  margin: 0;
  font-size: 16px;
}

.nav-button {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: white;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition: opacity 0.3s, transform 0.2s;

  &:active {
    transform: translateY(-50%) scale(0.95);
  }

  &.prev {
    left: 16px;
  }

  &.next {
    right: 16px;
  }
}

.zoom-controls {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
}

.icon {
  user-select: none;
}

// Transitions
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-50%) scale(0.8);
}
</style>
