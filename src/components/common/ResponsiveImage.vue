<script setup lang="ts">
/**
 * Responsive Image Component
 * Automatically loads appropriate image size based on container dimensions
 *
 * @module components/common/ResponsiveImage
 */

import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { logger } from '@/utils/logger'
import { matrixThumbnailService } from '@/matrix/services/media/thumbnail'
import type { ResponsiveImageOptions } from '@/matrix/services/media/thumbnail'

interface Props {
  /** MXC URL of the image */
  mxcUrl: string
  /** Alternative text */
  alt?: string
  /** Maximum width in pixels */
  maxWidth?: number
  /** Maximum height in pixels */
  maxHeight?: number
  /** Whether to maintain aspect ratio */
  maintainAspectRatio?: boolean
  /** Image fit mode */
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
  /** Responsive image options */
  responsiveOptions?: ResponsiveImageOptions
  /** Initial placeholder */
  placeholder?: string
  /** Loading mode */
  loading?: 'lazy' | 'eager'
  /** Thumbnail method */
  method?: 'crop' | 'scale'
  /** Enable responsive loading */
  responsive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  alt: '',
  maxWidth: 1024,
  maxHeight: 1024,
  maintainAspectRatio: true,
  fit: 'contain',
  loading: 'lazy',
  method: 'scale',
  responsive: true
})

const emit = defineEmits<{
  /** Emitted when image starts loading */
  load: []
  /** Emitted when image finishes loading */
  loaded: [event: Event]
  /** Emitted when image fails to load */
  error: [event: Event]
  /** Emitted when image URL changes */
  urlChanged: [url: string]
}>()

// Refs
const containerRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const currentUrl = ref('')
const isLoading = ref(true)
const hasError = ref(false)
const containerWidth = ref(0)
const containerHeight = ref(0)

// Resize observer
let resizeObserver: ResizeObserver | null = null

// Computed styles
const imageStyle = computed(() => ({
  maxWidth: props.maxWidth ? `${props.maxWidth}px` : undefined,
  maxHeight: props.maxHeight ? `${props.maxHeight}px` : undefined,
  objectFit: props.fit,
  width: '100%',
  height: props.maintainAspectRatio ? 'auto' : '100%'
}))

/**
 * Get appropriate thumbnail URL based on container size
 */
function getThumbnailUrl(): string {
  if (!props.mxcUrl) return props.placeholder || ''

  if (!props.responsive) {
    // Use fixed size
    return matrixThumbnailService.getThumbnailForWidth(props.mxcUrl, props.maxWidth || 512, props.method)
  }

  // Use responsive size
  const width = containerWidth.value || props.maxWidth || 512
  return matrixThumbnailService.getThumbnailForWidth(props.mxcUrl, width, props.method)
}

/**
 * Update container dimensions
 */
function updateContainerDimensions() {
  if (!containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  containerWidth.value = Math.round(rect.width)
  containerHeight.value = Math.round(rect.height)
}

/**
 * Load image
 */
async function loadImage() {
  const url = getThumbnailUrl()
  if (!url || url === currentUrl.value) return

  isLoading.value = true
  hasError.value = false
  emit('load')

  try {
    emit('urlChanged', url)

    // Preload image
    if (props.loading === 'eager') {
      await matrixThumbnailService.preloadImage(url)
    }

    currentUrl.value = url
    isLoading.value = false
  } catch (error) {
    logger.error('[ResponsiveImage] Failed to load image:', error)
    hasError.value = true
    isLoading.value = false
    emit('error', error as Event)
  }
}

/**
 * Handle image load
 */
function handleImageLoad(event: Event) {
  isLoading.value = false
  hasError.value = false
  emit('loaded', event)
}

/**
 * Handle image error
 */
function handleImageError(event: Event) {
  hasError.value = true
  isLoading.value = false
  emit('error', event)
}

/**
 * Setup resize observer
 */
function setupResizeObserver() {
  if (!containerRef.value || typeof ResizeObserver === 'undefined') return

  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === containerRef.value) {
        const newWidth = Math.round(entry.contentRect.width)
        // Only reload if width changes significantly (more than 10%)
        if (Math.abs(newWidth - containerWidth.value) / containerWidth.value > 0.1) {
          updateContainerDimensions()
          loadImage()
        }
      }
    }
  })

  resizeObserver.observe(containerRef.value)
}

/**
 * Cleanup resize observer
 */
function cleanupResizeObserver() {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
}

// Lifecycle
onMounted(() => {
  updateContainerDimensions()
  loadImage()

  if (props.responsive) {
    setupResizeObserver()
  }
})

onUnmounted(() => {
  cleanupResizeObserver()
})

// Watch for prop changes
watch(
  () => props.mxcUrl,
  () => {
    loadImage()
  }
)

watch(
  () => props.maxWidth,
  () => {
    updateContainerDimensions()
    loadImage()
  }
)

// Expose methods
defineExpose({
  loadImage,
  updateContainerDimensions
})
</script>

<template>
  <div
    ref="containerRef"
    class="responsive-image-container"
    :style="{
      maxWidth: maxWidth ? `${maxWidth}px` : undefined,
      maxHeight: maxHeight ? `${maxHeight}px` : undefined
    }">
    <!-- Loading state -->
    <div v-if="isLoading && !currentUrl" class="responsive-image-loading">
      <slot name="loading">
        <div class="loading-spinner" />
      </slot>
    </div>

    <!-- Error state -->
    <div v-if="hasError" class="responsive-image-error">
      <slot name="error">
        <div class="error-icon">❌</div>
        <p class="error-message">Failed to load image</p>
      </slot>
    </div>

    <!-- Image -->
    <img
      v-if="!hasError"
      ref="imageRef"
      :src="currentUrl"
      :alt="alt"
      :style="imageStyle"
      :loading="loading"
      class="responsive-image"
      @load="handleImageLoad"
      @error="handleImageError" />
  </div>
</template>

<style scoped lang="scss">
.responsive-image-container {
  position: relative;
  display: inline-block;
  width: 100%;
  overflow: hidden;
}

.responsive-image {
  display: block;
  width: 100%;
  height: auto;
  transition: opacity 0.3s ease;
}

.responsive-image-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-secondary, var(--hula-brand-primary));
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border, var(--hula-brand-primary));
  border-top-color: var(--color-primary, var(--hula-brand-primary));
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.responsive-image-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-secondary, var(--hula-brand-primary));
  color: var(--color-text-secondary, var(--hula-gray-700));
}

.error-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.error-message {
  margin: 0;
  font-size: 14px;
}
</style>
