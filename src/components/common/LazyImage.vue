<script setup lang="ts">
/**
 * Lazy Load Image Component
 * Loads images when they enter the viewport using Intersection Observer
 *
 * @module components/common/LazyImage
 */

import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { matrixThumbnailService } from '@/services/matrixThumbnailService'
import type { LazyLoadOptions } from '@/services/matrixThumbnailService'

interface Props {
  /** MXC URL of the image */
  mxcUrl: string
  /** Alternative text */
  alt?: string
  /** Width in pixels */
  width?: number
  /** Height in pixels */
  height?: number
  /** Thumbnail method */
  method?: 'crop' | 'scale'
  /** Thumbnail size */
  size?: number
  /** Placeholder image */
  placeholder?: string
  /** Lazy load options */
  lazyOptions?: LazyLoadOptions
  /** Fade-in effect duration in ms */
  fadeInDuration?: number
  /** Image fit mode */
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
}

const props = withDefaults(defineProps<Props>(), {
  alt: '',
  width: 256,
  height: 256,
  method: 'crop',
  size: 256,
  fadeInDuration: 300,
  fit: 'cover'
})

const emit = defineEmits<{
  /** Emitted when image starts loading */
  load: []
  /** Emitted when image finishes loading */
  loaded: [event: Event]
  /** Emitted when image fails to load */
  error: [event: Event]
  /** Emitted when image enters viewport */
  inView: []
  /** Emitted when image is cached */
  cached: []
}>()

// Refs
const imageRef = ref<HTMLImageElement | null>(null)
const loaded = ref(false)
const loading = ref(false)
const hasError = ref(false)
const inView = ref(false)
const currentUrl = ref('')
const placeholderUrl = ref(props.placeholder || '')

// Computed
const imageStyle = computed(() => ({
  width: props.width ? `${props.width}px` : undefined,
  height: props.height ? `${props.height}px` : undefined,
  objectFit: props.fit,
  opacity: loaded.value ? 1 : 0,
  transition: `opacity ${props.fadeInDuration}ms ease-in-out`
}))

const shouldLoad = computed(() => {
  return props.mxcUrl && inView.value && !loaded.value && !loading.value
})

/**
 * Get thumbnail URL
 */
function getThumbnailUrl(): string {
  if (!props.mxcUrl) return ''
  return matrixThumbnailService.getThumbnailForWidth(props.mxcUrl, props.size || props.width || 256, props.method)
}

/**
 * Load the image
 */
async function loadImage() {
  if (loading.value || loaded.value || !props.mxcUrl) return

  loading.value = true
  const url = getThumbnailUrl()

  emit('load')

  try {
    // Check cache first
    const isCached = await checkImageCache(url)
    if (isCached) {
      emit('cached')
    }

    // Preload and set source
    const img = await matrixThumbnailService.preloadImage(url)
    currentUrl.value = url
    loaded.value = true
    loading.value = false
    hasError.value = false

    emit('loaded', new Event('load') as Event)
  } catch (error) {
    console.error('[LazyImage] Failed to load image:', error)
    hasError.value = true
    loading.value = false
    emit('error', error as Event)
  }
}

/**
 * Check if image is cached
 */
function checkImageCache(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()

    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)

    // Add a timestamp to bypass cache
    img.src = url + `&t=${Date.now()}`
    setTimeout(() => resolve(false), 100)
  })
}

/**
 * Handle intersection
 */
function handleIntersection(entries: IntersectionObserverEntry[]) {
  for (const entry of entries) {
    if (entry.isIntersecting && !inView.value) {
      inView.value = true
      emit('inView')
      loadImage()
    }
  }
}

/**
 * Setup intersection observer
 */
let observer: IntersectionObserver | null = null

function setupObserver() {
  if (!imageRef.value || typeof IntersectionObserver === 'undefined') {
    // If IntersectionObserver is not available, load immediately
    inView.value = true
    loadImage()
    return
  }

  const options: IntersectionObserverInit = {
    rootMargin: props.lazyOptions?.rootMargin || '50px',
    threshold: props.lazyOptions?.threshold || 0.01
  }

  observer = new IntersectionObserver(handleIntersection, options)
  observer.observe(imageRef.value)
}

/**
 * Cleanup observer
 */
function cleanupObserver() {
  if (observer) {
    observer.disconnect()
    observer = null
  }
}

/**
 * Retry loading
 */
function retry() {
  hasError.value = false
  loaded.value = false
  inView.value = true
  loadImage()
}

/**
 * Reset component state
 */
function reset() {
  loaded.value = false
  loading.value = false
  hasError.value = false
  inView.value = false
  currentUrl.value = ''
  cleanupObserver()
  setupObserver()
}

// Lifecycle
onMounted(() => {
  setupObserver()
})

onUnmounted(() => {
  cleanupObserver()
})

// Watch for URL changes
watch(
  () => props.mxcUrl,
  () => {
    reset()
  }
)

// Expose methods
defineExpose({
  retry,
  reset,
  loadImage
})
</script>

<template>
  <div class="lazy-image-wrapper" :style="{ width: width ? `${width}px` : undefined, height: height ? `${height}px` : undefined }">
    <!-- Placeholder -->
    <img
      v-if="placeholderUrl && !loaded && !hasError"
      :src="placeholderUrl"
      :alt="alt"
      class="lazy-image-placeholder"
      :style="{ width: width ? `${width}px` : undefined, height: height ? `${height}px` : undefined, objectFit: fit }"
    />

    <!-- Actual image -->
    <img
      ref="imageRef"
      :src="currentUrl"
      :alt="alt"
      :style="imageStyle"
      class="lazy-image"
    />

    <!-- Loading indicator -->
    <div v-if="loading && !loaded" class="lazy-image-loading">
      <slot name="loading">
        <div class="loading-spinner" />
      </slot>
    </div>

    <!-- Error state -->
    <div v-if="hasError" class="lazy-image-error">
      <slot name="error" :retry="retry">
        <div class="error-content">
          <div class="error-icon">⚠️</div>
          <button class="retry-button" @click="retry">Retry</button>
        </div>
      </slot>
    </div>
  </div>
</template>

<style scoped lang="scss">
.lazy-image-wrapper {
  position: relative;
  display: inline-block;
  overflow: hidden;
  background-color: var(--color-bg-secondary, #f5f5f5);
}

.lazy-image-placeholder,
.lazy-image {
  display: block;
  width: 100%;
  height: 100%;
}

.lazy-image-placeholder {
  position: absolute;
  inset: 0;
  opacity: 0.5;
  filter: blur(2px);
}

.lazy-image {
  position: relative;
  z-index: 1;
}

.lazy-image-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-secondary, #f5f5f5);
  z-index: 2;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border, #e0e0e0);
  border-top-color: var(--color-primary, #1890ff);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.lazy-image-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-error, #fff2f0);
  z-index: 3;
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  text-align: center;
}

.error-icon {
  font-size: 32px;
}

.retry-button {
  padding: 8px 16px;
  font-size: 14px;
  color: white;
  background-color: var(--color-primary, #1890ff);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--color-primary-hover, #40a9ff);
  }

  &:active {
    transform: scale(0.98);
  }
}
</style>
