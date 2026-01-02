<template>
  <div
    ref="containerRef"
    class="pull-refresh-container"
    :class="{ 'is-pulling': isPulling, 'is-refreshing': isRefreshing }"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd">
    <!-- Pull Indicator -->
    <div class="pull-indicator" :style="{ transform: `translateY(${Math.min(pullDistance, maxDistance)}px)` }">
      <div v-if="isRefreshing" class="loading-spinner">
        <n-spin size="small" />
      </div>
      <div v-else class="pull-icon">
        <n-icon
          :size="24"
          :style="{
            transform: `rotate(${Math.min((pullDistance / maxDistance) * 180, 180)}deg)`
          }">
          <Refresh />
        </n-icon>
      </div>
      <div class="pull-text">
        <template v-if="isRefreshing">
          {{ refreshingText || '正在刷新...' }}
        </template>
        <template v-else-if="pullDistance >= triggerDistance">
          {{ releaseText || '释放立即刷新' }}
        </template>
        <template v-else-if="pullDistance > 5">
          {{ pullingText || '下拉刷新' }}
        </template>
      </div>
    </div>

    <!-- Content -->
    <div
      class="pull-content"
      :style="{ transform: `translateY(${Math.max(0, Math.min(pullDistance, maxDistance))}px)` }">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NIcon, NSpin } from 'naive-ui'
import { Refresh } from '@vicons/tabler'

interface Props {
  triggerDistance?: number
  maxDistance?: number
  pullingText?: string
  releaseText?: string
  refreshingText?: string
}

type Emits = (e: 'refresh') => void

const props = withDefaults(defineProps<Props>(), {
  triggerDistance: 60,
  maxDistance: 100
})

const emit = defineEmits<Emits>()

const containerRef = ref<HTMLElement>()
const isPulling = ref(false)
const isRefreshing = ref(false)
const pullDistance = ref(0)
const startY = ref(0)
const currentY = ref(0)

const triggerDistance = computed(() => props.triggerDistance)
const maxDistance = computed(() => props.maxDistance)

const handleTouchStart = (e: TouchEvent) => {
  if (isRefreshing.value) return

  const target = e.target as HTMLElement
  const scrollable = findScrollableParent(target)

  if (scrollable && scrollable.scrollTop <= 0) {
    isPulling.value = true
    startY.value = e.touches[0].clientY
  }
}

const handleTouchMove = (e: TouchEvent) => {
  if (!isPulling.value || isRefreshing.value) return

  currentY.value = e.touches[0].clientY
  const distance = currentY.value - startY.value

  if (distance > 0) {
    // Use resistance factor for smooth pull effect
    const resistance = 0.4
    pullDistance.value = Math.min(distance * resistance, maxDistance.value)
    e.preventDefault()
  }
}

const handleTouchEnd = () => {
  if (!isPulling.value) return

  if (pullDistance.value >= triggerDistance.value && !isRefreshing.value) {
    // Trigger refresh
    isRefreshing.value = true
    pullDistance.value = triggerDistance.value
    emit('refresh')

    // Reset after animation
    setTimeout(() => {
      pullDistance.value = 0
      isRefreshing.value = false
    }, 1000)
  } else {
    // Snap back
    pullDistance.value = 0
  }

  isPulling.value = false
  startY.value = 0
  currentY.value = 0
}

const findScrollableParent = (element: HTMLElement | null): HTMLElement | null => {
  if (!element || element === document.body) {
    return null
  }

  const style = window.getComputedStyle(element)
  const overflowY = style.overflowY

  if ((overflowY === 'auto' || overflowY === 'scroll') && element.scrollHeight > element.clientHeight) {
    return element
  }

  return findScrollableParent(element.parentElement)
}

// Expose refresh method
defineExpose({
  refresh: () => emit('refresh')
})
</script>

<style lang="scss" scoped>
.pull-refresh-container {
  position: relative;
  overflow: hidden;

  &.is-pulling .pull-content {
    transition: transform 0.1s ease-out;
  }

  &.is-refreshing .pull-content {
    transition: transform 0.3s ease-out;
  }
}

.pull-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  pointer-events: none;
  will-change: transform;
}

.pull-icon {
  color: var(--text-color-3);
  transition: transform 0.2s ease-out;
}

.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.pull-text {
  font-size: 12px;
  color: var(--text-color-3);
}

.pull-content {
  transition: transform 0.3s ease-out;
  will-change: transform;
}
</style>
