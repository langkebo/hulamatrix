<!--
  TransitionWrapper - 统一的过渡动画包装组件

  提供一致的页面和组件切换动画效果
  支持多种过渡模式

  使用示例:
  <TransitionWrapper transition-name="slide-fade" mode="out-in">
    <component :is="currentComponent" />
  </TransitionWrapper>
-->
<template>
  <Transition
    :name="transitionName"
    :mode="transitionMode"
    :appear="appear"
    @before-enter="handleBeforeEnter"
    @enter="handleEnter"
    @after-enter="handleAfterEnter"
    @before-leave="handleBeforeLeave"
    @leave="handleLeave"
    @after-leave="handleAfterLeave">
    <slot />
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

/**
 * Props 定义
 */
interface Props {
  /** 过渡动画名称 */
  transitionName?: 'fade' | 'slide-fade' | 'slide' | 'scale' | 'custom'
  /** 过渡模式 */
  transitionMode?: 'in-out' | 'out-in' | 'default'
  /** 是否在初始渲染时使用过渡 */
  appear?: boolean
  /** 是否禁用动画（用于辅助功能） */
  disabled?: boolean
  /** 自定义过渡名称（当 transitionName 为 'custom' 时使用） */
  customTransitionName?: string
}

const props = withDefaults(defineProps<Props>(), {
  transitionName: 'fade',
  transitionMode: 'default',
  appear: true,
  disabled: false,
  customTransitionName: ''
})

/**
 * Emits
 */
interface Emits {
  (e: 'before-enter', el: Element): void
  (e: 'enter', el: Element, done: () => void): void
  (e: 'after-enter', el: Element): void
  (e: 'before-leave', el: Element): void
  (e: 'leave', el: Element, done: () => void): void
  (e: 'after-leave', el: Element): void
}

const emit = defineEmits<Emits>()

/**
 * 计算实际的过渡名称
 */
const actualTransitionName = ref<string>(props.transitionName)

watch(
  () => props.transitionName,
  (newName) => {
    actualTransitionName.value = newName === 'custom' ? props.customTransitionName : newName
  },
  { immediate: true }
)

/**
 * 检查是否应该禁用动画
 */
const shouldDisableAnimation = ref(false)

// 检查用户的减少动画偏好设置
if (typeof window !== 'undefined' && window.matchMedia) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  shouldDisableAnimation.value = prefersReducedMotion.matches || props.disabled

  prefersReducedMotion.addEventListener('change', (e) => {
    shouldDisableAnimation.value = e.matches || props.disabled
  })
}

/**
 * 事件处理函数
 */
function handleBeforeEnter(el: Element) {
  if (shouldDisableAnimation.value) return
  emit('before-enter', el)
}

function handleEnter(el: Element, done: () => void) {
  if (shouldDisableAnimation.value) {
    done()
    return
  }
  emit('enter', el, done)
}

function handleAfterEnter(el: Element) {
  emit('after-enter', el)
}

function handleBeforeLeave(el: Element) {
  if (shouldDisableAnimation.value) return
  emit('before-leave', el)
}

function handleLeave(el: Element, done: () => void) {
  if (shouldDisableAnimation.value) {
    done()
    return
  }
  emit('leave', el, done)
}

function handleAfterLeave(el: Element) {
  emit('after-leave', el)
}

// 暴露方法供父组件调用
defineExpose({
  setDisabled: (disabled: boolean) => {
    shouldDisableAnimation.value = disabled
  }
})
</script>

<style scoped lang="scss">
// ============================================================================
// 淡入淡出过渡
// ============================================================================

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-fast, 0.15s) ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// ============================================================================
// 滑动淡入淡出过渡
// ============================================================================

.slide-fade-enter-active {
  transition: all var(--transition-base, 0.3s) cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-fade-leave-active {
  transition: all var(--transition-base, 0.3s) cubic-bezier(0.4, 0, 1, 1);
}

.slide-fade-enter-from {
  transform: translateX(20px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateX(-20px);
  opacity: 0;
}

// ============================================================================
// 滑动过渡
// ============================================================================

.slide-enter-active,
.slide-leave-active {
  transition: transform var(--transition-base, 0.3s) cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-enter-from {
  transform: translateX(100%);
}

.slide-leave-to {
  transform: translateX(-100%);
}

// 垂直滑动
.slide-vertical-enter-active,
.slide-vertical-leave-active {
  transition: transform var(--transition-base, 0.3s) cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-vertical-enter-from {
  transform: translateY(20px);
  opacity: 0;
}

.slide-vertical-leave-to {
  transform: translateY(-20px);
  opacity: 0;
}

// ============================================================================
// 缩放过渡
// ============================================================================

.scale-enter-active,
.scale-leave-active {
  transition: all var(--transition-base, 0.3s) cubic-bezier(0.4, 0, 0.2, 1);
}

.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

// ============================================================================
// 弹跳缩放过渡
// ============================================================================

.bounce-enter-active {
  animation: bounce-in var(--transition-base, 0.3s) cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.bounce-leave-active {
  animation: bounce-in var(--transition-base, 0.3s) reverse;
}

@keyframes bounce-in {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

// ============================================================================
// 翻转过渡
// ============================================================================

.flip-enter-active,
.flip-leave-active {
  transition: all var(--transition-base, 0.3s);
  transform-style: preserve-3d;
}

.flip-enter-from,
.flip-leave-to {
  transform: perspective(400px) rotateY(90deg);
  opacity: 0;
}

// ============================================================================
// 辅助功能 - 尊重用户的减少动画偏好
// ============================================================================

@media (prefers-reduced-motion: reduce) {
  .fade-enter-active,
  .fade-leave-active,
  .slide-fade-enter-active,
  .slide-fade-leave-active,
  .slide-enter-active,
  .slide-leave-active,
  .slide-vertical-enter-active,
  .slide-vertical-leave-active,
  .scale-enter-active,
  .scale-leave-active,
  .bounce-enter-active,
  .bounce-leave-active,
  .flip-enter-active,
  .flip-leave-active {
    transition: none;
    animation: none;
  }

  .fade-enter-from,
  .fade-leave-to,
  .slide-fade-enter-from,
  .slide-fade-leave-to,
  .slide-enter-from,
  .slide-leave-to,
  .slide-vertical-enter-from,
  .slide-vertical-leave-to,
  .scale-enter-from,
  .scale-leave-to {
    opacity: 1;
    transform: none;
  }
}
</style>
