<!--
ChatListVirtualList - 专为 ChatList 设计的虚拟滚动组件

特性：
- 简化的虚拟滚动，适用于会话列表
- 支持 ContextMenu 包装
- 保持滚动位置
- 高度自适应
-->
<template>
  <div
    ref="containerRef"
    class="chat-virtual-list-container"
    :style="{ maxHeight: maxHeight }"
    @scroll.passive="handleScroll">
    <div ref="phantomRef" class="chat-virtual-list-phantom"></div>
    <div ref="contentRef" class="chat-virtual-list-content" :style="{ transform: `translateY(${offset}px)` }">
      <slot v-for="item in visibleItems" :key="item.roomId" :item="item.session" :index="item.index"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { SessionItem } from '@/services/types'

interface Props {
  /** 会话列表 */
  sessions: SessionItem[]
  /** 每项的预估高度（像素） */
  estimatedItemHeight?: number
  /** 缓冲区大小（额外渲染的上下项目数） */
  bufferSize?: number
  /** 最大高度 */
  maxHeight?: string
}

const props = withDefaults(defineProps<Props>(), {
  estimatedItemHeight: 80,
  bufferSize: 5,
  maxHeight: 'calc(100vh / var(--page-scale, 1) - 120px)'
})

const emit = defineEmits<{
  scroll: [event: Event]
}>()

// 常量
const ESTIMATED_HEIGHT = props.estimatedItemHeight
const BUFFER_SIZE = props.bufferSize

// 引用
const containerRef = ref<HTMLElement | null>(null)
const phantomRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)

// 状态
const offset = ref(0)
const scrollTop = ref(0)
const viewportHeight = ref(0)
const itemHeights = ref<Map<string, number>>(new Map())

// 计算可见范围
const visibleRange = computed(() => {
  const totalHeight = props.sessions.length * ESTIMATED_HEIGHT
  const startNode = Math.floor(scrollTop.value / ESTIMATED_HEIGHT)
  const visibleNodeCount = Math.ceil(viewportHeight.value / ESTIMATED_HEIGHT)

  const start = Math.max(0, startNode - BUFFER_SIZE)
  const end = Math.min(props.sessions.length, startNode + visibleNodeCount + BUFFER_SIZE)

  return { start, end }
})

// 可见项目
const visibleItems = computed(() => {
  const items = []
  for (let i = visibleRange.value.start; i < visibleRange.value.end; i++) {
    if (props.sessions[i]) {
      items.push({
        roomId: props.sessions[i].roomId,
        session: props.sessions[i],
        index: i
      })
    }
  }
  return items
})

// 幽灵元素高度
const phantomHeight = computed(() => {
  return props.sessions.length * ESTIMATED_HEIGHT
})

// 更新偏移量
const updateOffset = () => {
  offset.value = visibleRange.value.start * ESTIMATED_HEIGHT
}

// 更新 phantom 高度
const updatePhantom = () => {
  if (phantomRef.value) {
    phantomRef.value.style.height = `${phantomHeight.value}px`
  }
}

// 滚动处理
const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  scrollTop.value = target.scrollTop
  viewportHeight.value = target.clientHeight
  updateOffset()
  emit('scroll', event)
}

// ResizeObserver 监听项目高度变化
let resizeObserver: ResizeObserver | null = null

const setupResizeObserver = () => {
  if (!containerRef.value) return

  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      viewportHeight.value = entry.contentRect.height
    }
    updateOffset()
  })

  resizeObserver.observe(containerRef.value)
}

const cleanupResizeObserver = () => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
}

// 生命周期
onMounted(() => {
  nextTick(() => {
    if (containerRef.value) {
      viewportHeight.value = containerRef.value.clientHeight
      updatePhantom()
      updateOffset()
      setupResizeObserver()
    }
  })
})

onUnmounted(() => {
  cleanupResizeObserver()
})

// 监听数据变化
watch(
  () => props.sessions.length,
  () => {
    updatePhantom()
    updateOffset()
  }
)
</script>

<style scoped lang="scss">
.chat-virtual-list-container {
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
}

.chat-virtual-list-phantom {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  z-index: -1;
}

.chat-virtual-list-content {
  position: relative;
  will-change: transform;
}
</style>
