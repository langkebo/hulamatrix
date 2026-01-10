<!--
  CollapseTransition Component - Smooth height transition for collapsible content

  Usage:
  <CollapseTransition>
    <div v-if="expanded">
      Collapsible content here
    </div>
  </CollapseTransition>
-->
<template>
  <transition
    :name="transitionName"
    @enter="onEnter"
    @after-enter="onAfterEnter"
    @leave="onLeave"
    @after-leave="onAfterLeave">
    <slot />
  </transition>
</template>

<script setup lang="ts">
import { ref, type VNode } from 'vue'

interface Props {
  transitionName?: string
  duration?: number
  easing?: string
}

const props = withDefaults(defineProps<Props>(), {
  transitionName: 'collapse',
  duration: 300,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
})

// Store original height for restoration
const originalHeight = ref<string | null>(null)

const onEnter = (el: Element, done: () => void) => {
  const htmlEl = el as HTMLElement

  // Store original height if set
  if (htmlEl.style.height) {
    originalHeight.value = htmlEl.style.height
  }

  // Force reflow
  htmlEl.offsetHeight

  // Set initial state
  htmlEl.style.height = '0'
  htmlEl.style.overflow = 'hidden'
  htmlEl.style.transition = `height ${props.duration}ms ${props.easing}`

  // Start animation
  requestAnimationFrame(() => {
    htmlEl.style.height = htmlEl.scrollHeight + 'px'
  })

  // Call done when animation completes
  setTimeout(done, props.duration)
}

const onAfterEnter = (el: Element) => {
  const htmlEl = el as HTMLElement
  // Clean up
  htmlEl.style.height = originalHeight.value || 'auto'
  htmlEl.style.overflow = ''
  htmlEl.style.transition = ''
  originalHeight.value = null
}

const onLeave = (el: Element, done: () => void) => {
  const htmlEl = el as HTMLElement
  // Set up for collapse
  htmlEl.style.height = htmlEl.scrollHeight + 'px'
  htmlEl.style.overflow = 'hidden'
  htmlEl.style.transition = `height ${props.duration}ms ${props.easing}`

  // Force reflow
  htmlEl.offsetHeight

  // Start collapse
  requestAnimationFrame(() => {
    htmlEl.style.height = '0'
  })

  // Call done when animation completes
  setTimeout(done, props.duration)
}

const onAfterLeave = (el: Element) => {
  const htmlEl = el as HTMLElement
  // Clean up
  htmlEl.style.height = ''
  htmlEl.style.overflow = ''
  htmlEl.style.transition = ''
}
</script>

<style scoped lang="scss">
// Fallback CSS transition for when JavaScript fails
.collapse-enter-active,
.collapse-leave-active {
  transition:
    height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  height: 0 !important;
  opacity: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
}
</style>
