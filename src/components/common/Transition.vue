<template>
  <transition
    :name="transitionName"
    :mode="mode"
    :appear="appear"
    :duration="transitionDuration"
    @before-enter="handleBeforeEnter"
    @enter="handleEnter"
    @after-enter="handleAfterEnter"
    @enter-cancelled="handleEnterCancelled"
    @before-leave="handleBeforeLeave"
    @leave="handleLeave"
    @after-leave="handleAfterLeave"
    @leave-cancelled="handleLeaveCancelled">
    <slot />
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { easings } from '@/utils/animations'

interface Props {
  // 预定义的过渡动画名称
  name?: 'fade' | 'slide' | 'scale' | 'bounce' | 'rotate' | 'flip' | string
  // 自定义过渡名称
  customName?: string | undefined
  // 滑动方向（仅当name为'slide'时有效）
  direction?: 'up' | 'down' | 'left' | 'right'
  // 过渡模式
  mode?: 'default' | 'out-in' | 'in-out'
  // 是否在初始渲染时应用过渡
  appear?: boolean
  // 持续时间
  duration?: number | { enter: number; leave: number }
  // 缓动函数
  easing?: keyof typeof easings | string
  // 延迟
  delay?: number
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'default',
  appear: false
})

const emit = defineEmits<{
  beforeEnter: [el: Element]
  enter: [el: Element, done: () => void]
  afterEnter: [el: Element]
  enterCancelled: [el: Element]
  beforeLeave: [el: Element]
  leave: [el: Element, done: () => void]
  afterLeave: [el: Element]
  leaveCancelled: [el: Element]
}>()

// 计算过渡名称
const transitionName = computed((): string => {
  if (props.customName) return props.customName

  if (!props.name) return 'fade'

  let baseName = ''
  let direction = ''

  switch (props.name) {
    case 'fade':
      baseName = 'fade'
      break
    case 'slide':
      baseName = 'slide'
      direction = props.direction || 'up'
      break
    case 'scale':
      baseName = 'scale'
      break
    case 'bounce':
      baseName = 'bounce'
      break
    case 'rotate':
      baseName = 'rotate'
      break
    case 'flip':
      baseName = 'flip'
      break
    default:
      baseName = 'fade'
  }

  return direction ? `${baseName}-${direction}` : baseName
})

// 计算过渡持续时间
const transitionDuration = computed(() => {
  if (props.duration) return props.duration

  const durationMap = {
    fade: { enter: 150, leave: 150 },
    slide: { enter: 300, leave: 300 },
    scale: { enter: 300, leave: 300 },
    bounce: { enter: 500, leave: 300 },
    rotate: { enter: 300, leave: 300 },
    flip: { enter: 600, leave: 600 }
  }

  return durationMap[props.name as keyof typeof durationMap] || durationMap.fade
})

// 事件处理器
const handleBeforeEnter = (el: Element) => {
  emit('beforeEnter', el)
}

const handleEnter = (el: Element, done: () => void) => {
  emit('enter', el, done)
}

const handleAfterEnter = (el: Element) => {
  emit('afterEnter', el)
}

const handleEnterCancelled = (el: Element) => {
  emit('enterCancelled', el)
}

const handleBeforeLeave = (el: Element) => {
  emit('beforeLeave', el)
}

const handleLeave = (el: Element, done: () => void) => {
  emit('leave', el, done)
}

const handleAfterLeave = (el: Element) => {
  emit('afterLeave', el)
}

const handleLeaveCancelled = (el: Element) => {
  emit('leaveCancelled', el)
}
</script>

<style lang="scss" scoped>
// 淡入淡出
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-duration) var(--transition-easing);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// 滑动动画
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all var(--transition-duration) var(--transition-easing);
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all var(--transition-duration) var(--transition-easing);
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.slide-left-enter-active,
.slide-left-leave-active {
  transition: all var(--transition-duration) var(--transition-easing);
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: all var(--transition-duration) var(--transition-easing);
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.slide-right-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

// 缩放动画
.scale-enter-active,
.scale-leave-active {
  transition: all var(--transition-duration) var(--transition-easing);
}

.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

// 弹跳动画
.bounce-enter-active {
  animation: bounce-in var(--transition-duration) var(--transition-easing);
}

.bounce-leave-active {
  animation: bounce-out var(--transition-duration) var(--transition-easing);
}

@keyframes bounce-in {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  50% {
    transform: scale(1.05);
  }
  70% {
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes bounce-out {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.3);
  }
}

// 旋转动画
.rotate-enter-active,
.rotate-leave-active {
  transition: all var(--transition-duration) var(--transition-easing);
}

.rotate-enter-from {
  opacity: 0;
  transform: rotate(-180deg);
}

.rotate-leave-to {
  opacity: 0;
  transform: rotate(180deg);
}

// 翻转动画
.flip-enter-active {
  animation: flip-in var(--transition-duration) var(--transition-easing);
}

.flip-leave-active {
  animation: flip-out var(--transition-duration) var(--transition-easing);
}

@keyframes flip-in {
  from {
    transform: perspective(400px) rotateX(-90deg);
    opacity: 0;
  }
  40% {
    transform: perspective(400px) rotateX(-10deg);
  }
  70% {
    transform: perspective(400px) rotateX(10deg);
  }
  to {
    transform: perspective(400px) rotateX(0deg);
    opacity: 1;
  }
}

@keyframes flip-out {
  from {
    transform: perspective(400px) rotateX(0deg);
    opacity: 1;
  }
  to {
    transform: perspective(400px) rotateX(90deg);
    opacity: 0;
  }
}

// 自定义属性
:root {
  --transition-duration: 300ms;
  --transition-easing: cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
