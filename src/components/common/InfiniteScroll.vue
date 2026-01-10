<!--
  InfiniteScroll Component - Load more content as user scrolls

  Usage:
  <InfiniteScroll
    :has-more="hasMore"
    :loading="loading"
    :threshold="200"
    @load-more="loadMore"
  >
    <div v-for="item in items" :key="item.id">
      {{ item.name }}
    </div>
    <template #loading>
      <n-spin size="small" />
    </template>
    <template #no-more>
      <n-empty description="No more items" size="small" />
    </template>
  </InfiniteScroll>
-->
<template>
  <div
    ref="containerRef"
    class="infinite-scroll"
    :class="{ 'infinite-scroll--disabled': disabled }"
    role="feed"
    :aria-busy="loading">
    <div class="infinite-scroll-content">
      <slot />

      <!-- Sentinel element for intersection detection -->
      <div
        ref="sentinelRef"
        class="infinite-scroll-sentinel"
        :style="{ height: `${sentinelHeight}px` }"
        :aria-hidden="true" />
    </div>

    <!-- Loading State -->
    <div v-if="loading && showLoader" class="infinite-scroll-loading" role="status" aria-live="polite">
      <slot name="loading">
        <div class="default-loading">
          <n-spin :size="spinnerSize" />
          <span v-if="showLoadingText" class="loading-text">{{ loadingText }}</span>
        </div>
      </slot>
    </div>

    <!-- No More State -->
    <div
      v-if="!hasMore && showNoMore && !loading"
      class="infinite-scroll-no-more"
      role="status">
      <slot name="no-more">
        <n-empty :description="noMoreText" size="small" />
      </slot>
    </div>

    <!-- Error State -->
    <div v-if="error && showError" class="infinite-scroll-error" role="alert" aria-live="assertive">
      <slot name="error" :error="error" :retry="() => emit('retry')">
        <div class="error-content">
          <span class="error-message">{{ error.message || $t('infinite_scroll.load_failed') }}</span>
          <n-button size="small" @click="emit('retry')">
            {{ $t('infinite_scroll.retry') }}
          </n-button>
        </div>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { useIntersectionObserver, useScroll, useDebounceFn } from '@vueuse/core'
import { NSpin, NEmpty, NButton } from 'naive-ui'

const props = withDefaults(
  defineProps<{
    hasMore?: boolean
    loading?: boolean
    disabled?: boolean
    threshold?: number
    rootMargin?: string
    sentinelHeight?: number
    showLoader?: boolean
    showNoMore?: boolean
    showError?: boolean
    showLoadingText?: boolean
    loadingText?: string
    noMoreText?: string
    spinnerSize?: 'small' | 'medium' | 'large'
    direction?: 'vertical' | 'horizontal'
    debounceMs?: number
  }>(),
  {
    hasMore: false,
    loading: false,
    disabled: false,
    threshold: 100,
    rootMargin: '0px',
    sentinelHeight: 1,
    showLoader: true,
    showNoMore: true,
    showError: true,
    showLoadingText: true,
    loadingText: 'Loading...',
    noMoreText: 'No more items',
    spinnerSize: 'small',
    direction: 'vertical',
    debounceMs: 200
  }
)

const emit = defineEmits<{
  'load-more': []
  retry: []
}>()

const { t } = useI18n()

// Refs
const containerRef = ref<HTMLElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)

// State
const error = ref<Error | null>(null)
const hasIntersected = ref(false)

// Intersection Observer for sentinel detection
const { isActive: isIntersecting } = useIntersectionObserver(
  sentinelRef,
  (entries) => {
    const entry = entries[0]
    if (entry?.isIntersecting && !hasIntersected.value) {
      hasIntersected.value = true
      triggerLoadMore()
    } else if (!entry?.isIntersecting) {
      hasIntersected.value = false
    }
  },
  {
    threshold: 0,
    rootMargin: `${props.threshold}px`,
    root: null // Use viewport as root
  }
)

// Scroll-based detection as fallback
const { arrivedState, y } = useScroll(containerRef, {
  offset: { bottom: props.threshold },
  throttle: props.debounceMs
})

const isAtBottom = computed(() => {
  if (props.direction === 'horizontal') {
    return arrivedState.right
  }
  return arrivedState.bottom
})

// Watch for scroll position changes
watch(
  () => isAtBottom.value,
  (atBottom) => {
    if (atBottom && props.hasMore && !props.loading && !props.disabled) {
      triggerLoadMoreDebounced()
    }
  }
)

// Debounced load more trigger
const triggerLoadMoreDebounced = useDebounceFn(() => {
  triggerLoadMore()
}, props.debounceMs)

// Methods
const triggerLoadMore = async () => {
  if (!props.hasMore || props.loading || props.disabled) {
    return
  }

  try {
    error.value = null
    emit('load-more')
  } catch (err) {
    error.value = err instanceof Error ? err : new Error(String(err))
  }
}

// Expose methods
defineExpose({
  loadMore: triggerLoadMore,
  reset: () => {
    error.value = null
    hasIntersected.value = false
  },
  scrollToTop: () => {
    containerRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
  }
})
</script>

<style scoped lang="scss">
.infinite-scroll {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.infinite-scroll--disabled {
  pointer-events: none;
}

.infinite-scroll-content {
  position: relative;
}

.infinite-scroll-sentinel {
  width: 100%;
  pointer-events: none;
}

.infinite-scroll-loading,
.infinite-scroll-no-more,
.infinite-scroll-error {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  width: 100%;
}

.default-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.loading-text {
  font-size: 14px;
  color: var(--text-color-3);
}

.error-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-color-2);
  border: 1px solid var(--color-error);
  border-radius: 8px;
}

.error-message {
  font-size: 14px;
  color: var(--text-color-2);
}

// Horizontal mode
.infinite-scroll[data-direction='horizontal'] {
  display: flex;
  flex-direction: row;
  overflow-x: auto;
  overflow-y: hidden;

  .infinite-scroll-content {
    display: flex;
    flex-direction: row;
  }

  .infinite-scroll-sentinel {
    height: 100%;
    width: 1px;
  }

  .infinite-scroll-loading,
  .infinite-scroll-no-more,
  .infinite-scroll-error {
    flex-direction: row;
    width: auto;
    height: 100%;
  }
}
</style>
