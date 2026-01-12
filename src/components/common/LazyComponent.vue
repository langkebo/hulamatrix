<template>
  <component :is="loadedComponent" v-if="shouldRender" v-bind="$attrs" />
  <slot v-else name="fallback">
    <div class="lazy-component-fallback">
      <slot name="skeleton">
        <Skeleton :width="skeletonWidth" :height="skeletonHeight" variant="rectangular" />
      </slot>
    </div>
  </slot>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch, type Component } from 'vue'
import Skeleton from './Skeleton.vue'

interface Props {
  /**
   * Async component loader
   */
  component: () => Promise<Component>
  /**
   * Delay before showing component (ms)
   */
  delay?: number
  /**
   * Timeout for loading (ms)
   */
  timeout?: number
  /**
   * Skeleton placeholder width
   */
  skeletonWidth?: string
  /**
   * Skeleton placeholder height
   */
  skeletonHeight?: string
  /**
   * Load component immediately (skip lazy loading)
   */
  immediate?: boolean
  /**
   * Load component when element intersects viewport
   */
  loadOnVisible?: boolean
  /**
   * Intersection threshold (0-1)
   */
  threshold?: number
}

const props = withDefaults(defineProps<Props>(), {
  delay: 200,
  timeout: 10000,
  skeletonWidth: '100%',
  skeletonHeight: '200px',
  immediate: false,
  loadOnVisible: false,
  threshold: 0.01
})

const emit = defineEmits<{
  (e: 'loaded', component: Component): void
  (e: 'error', error: unknown): void
  (e: 'loading'): void
  (e: 'timeout'): void
}>()

const shouldRender = ref(false)
const loadedComponent = ref<Component | null>(null)
const isLoading = ref(false)
const rootRef = ref<HTMLElement>()

let loadTimeout: ReturnType<typeof setTimeout> | null = null
let delayTimeout: ReturnType<typeof setTimeout> | null = null
let intersectionObserver: IntersectionObserver | null = null

const loadComponent = async () => {
  if (isLoading.value || loadedComponent.value) return

  isLoading.value = true
  emit('loading')

  try {
    const component = await props.component()
    loadedComponent.value = component
    shouldRender.value = true
    emit('loaded', component)
  } catch (error) {
    emit('error', error)
    throw error
  } finally {
    isLoading.value = false
  }
}

// Setup intersection observer for viewport detection
const setupIntersectionObserver = () => {
  if (typeof IntersectionObserver === 'undefined' || !props.loadOnVisible) {
    return
  }

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          triggerLoad()
          intersectionObserver?.disconnect()
        }
      })
    },
    {
      threshold: props.threshold,
      rootMargin: '50px'
    }
  )

  if (rootRef.value) {
    intersectionObserver.observe(rootRef.value)
  }
}

const triggerLoad = () => {
  // Apply delay
  if (props.delay > 0) {
    delayTimeout = setTimeout(() => {
      loadComponent()

      // Set timeout for error handling
      if (props.timeout > 0) {
        loadTimeout = setTimeout(() => {
          if (isLoading.value) {
            emit('timeout')
          }
        }, props.timeout)
      }
    }, props.delay)
  } else {
    loadComponent()
  }
}

onMounted(() => {
  if (props.immediate) {
    shouldRender.value = true
    loadComponent()
  } else if (props.loadOnVisible) {
    setupIntersectionObserver()
  } else {
    triggerLoad()
  }
})

// Cleanup
import { onBeforeUnmount } from 'vue'

onBeforeUnmount(() => {
  if (delayTimeout) clearTimeout(delayTimeout)
  if (loadTimeout) clearTimeout(loadTimeout)
  intersectionObserver?.disconnect()
})

// Expose methods
defineExpose({
  load: loadComponent,
  isLoading,
  isLoaded: computed(() => loadedComponent.value !== null)
})
</script>

<style scoped lang="scss">
.lazy-component-fallback {
  width: 100%;
  min-height: 100px;
}

// Respect reduced motion
@media (prefers-reduced-motion: reduce) {
  .lazy-component-fallback {
    * {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
}
</style>
