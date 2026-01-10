<template>
  <transition
    :name="animationName"
    @before-enter="onBeforeEnter"
    @enter="onEnter"
    @after-enter="onAfterEnter"
    @leave="onLeave"
    @after-leave="onAfterLeave">
    <slot />
  </transition>
</template>

<script setup lang="ts">
import { ref } from 'vue'

export type SelfDestructAnimationType = 'dissolve' | 'burn' | 'shred' | 'quantum' | 'fade'

interface Props {
  type?: SelfDestructAnimationType
  duration?: number
}

const props = withDefaults(defineProps<Props>(), {
  type: 'dissolve',
  duration: 500
})

const emit = defineEmits<{
  (e: 'start'): void
  (e: 'complete'): void
}>()

// Track animation state
const isAnimating = ref(false)

const animationName = computed(() => `self-destruct-${props.type}`)

const onBeforeEnter = (el: Element) => {
  isAnimating.value = true
  emit('start')

  const element = el as HTMLElement

  // Set initial state based on animation type
  switch (props.type) {
    case 'dissolve':
      element.style.opacity = '1'
      element.style.filter = 'blur(0px)'
      element.style.transform = 'scale(1)'
      break

    case 'burn':
      element.style.opacity = '1'
      element.style.filter = 'brightness(1) blur(0px)'
      element.style.transform = 'scale(1)'
      break

    case 'shred':
      element.style.clipPath = 'inset(0% 0% 0% 0%)'
      break

    case 'quantum':
      element.style.opacity = '1'
      element.style.transform = 'scale(1) rotate(0deg)'
      element.style.filter = 'hue-rotate(0deg)'
      break

    case 'fade':
      element.style.opacity = '1'
      break
  }
}

const onEnter = (el: Element, done: () => void) => {
  const element = el as HTMLElement

  // Apply animation styles
  element.style.transition = `all ${props.duration}ms ease-in`

  // Force reflow to ensure transition happens
  element.offsetHeight

  // Trigger animation
  switch (props.type) {
    case 'dissolve':
      element.style.opacity = '0'
      element.style.filter = 'blur(10px)'
      element.style.transform = 'scale(0.8)'
      break

    case 'burn':
      element.style.opacity = '0'
      element.style.filter = 'brightness(2) blur(5px)'
      element.style.transform = 'scale(1.1)'
      // Add red tint for burning effect
      element.style.color = '#ff4444'
      break

    case 'shred':
      // Animate clip path from bottom to top
      setTimeout(() => {
        element.style.transition = `clip-path ${props.duration}ms cubic-bezier(0.4, 0, 0.2, 1)`
        element.style.clipPath = 'inset(100% 0% 0% 0%)'
      }, 10)
      break

    case 'quantum':
      element.style.opacity = '0'
      element.style.transform = 'scale(0) rotate(180deg)'
      element.style.filter = 'hue-rotate(180deg)'
      break

    case 'fade':
      element.style.opacity = '0'
      break
  }

  // Call done after animation completes
  setTimeout(() => {
    done()
  }, props.duration)
}

const onAfterEnter = () => {
  isAnimating.value = false
  emit('complete')
}

const onLeave = () => {
  // Additional leave animations if needed
}

const onAfterLeave = (el: Element) => {
  const element = el as HTMLElement
  // Clean up inline styles
  element.style.opacity = ''
  element.style.filter = ''
  element.style.transform = ''
  element.style.clipPath = ''
  element.style.transition = ''
}
</script>

<script lang="ts">
import { computed } from 'vue'

export default {
  name: 'SelfDestructAnimation'
}
</script>

<style scoped lang="scss">
// ============================================
// Dissolve Animation
// ============================================
.self-destruct-dissolve-enter-active {
  transition: all 0.5s ease-in;
}

.self-destruct-dissolve-leave-active {
  transition: all 0.3s ease-out;
}

.self-destruct-dissolve-enter-from {
  opacity: 1;
  filter: blur(0px);
  transform: scale(1);
}

.self-destruct-dissolve-leave-to {
  opacity: 0;
  filter: blur(10px);
  transform: scale(0.8);
}

// ============================================
// Burn Animation
// ============================================
.self-destruct-burn-enter-active {
  transition: all 0.8s ease-in;
}

.self-destruct-burn-leave-active {
  transition: all 0.4s ease-out;
}

.self-destruct-burn-enter-from {
  opacity: 1;
  filter: brightness(1) blur(0px);
  transform: scale(1);
  color: currentColor;
}

.self-destruct-burn-leave-to {
  opacity: 0;
  filter: brightness(2) blur(5px);
  transform: scale(1.1);
  color: #ff4444;
}

// ============================================
// Shred Animation
// ============================================
.self-destruct-shred-enter-active {
  transition: clip-path 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.self-destruct-shred-leave-active {
  transition: clip-path 0.3s ease-out;
}

.self-destruct-shred-enter-from {
  clip-path: inset(0% 0% 0% 0%);
}

.self-destruct-shred-leave-to {
  clip-path: inset(100% 0% 0% 0%);
}

// ============================================
// Quantum Animation
// ============================================
.self-destruct-quantum-enter-active {
  transition: all 0.7s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.self-destruct-quantum-leave-active {
  transition: all 0.3s ease-out;
}

.self-destruct-quantum-enter-from {
  opacity: 1;
  transform: scale(1) rotate(0deg);
  filter: hue-rotate(0deg);
}

.self-destruct-quantum-leave-to {
  opacity: 0;
  transform: scale(0) rotate(180deg);
  filter: hue-rotate(180deg);
}

// ============================================
// Fade Animation
// ============================================
.self-destruct-fade-enter-active {
  transition: opacity 0.3s ease-in;
}

.self-destruct-fade-leave-active {
  transition: opacity 0.2s ease-out;
}

.self-destruct-fade-enter-from {
  opacity: 1;
}

.self-destruct-fade-leave-to {
  opacity: 0;
}

// ============================================
// Shared Styles
// ============================================
.self-destruct-message {
  // Ensure smooth animation
  will-change: opacity, transform, filter, clip-path;
  backface-visibility: hidden;
  perspective: 1000px;
}

// Add glow effect for quantum animation
.self-destruct-quantum-leave-active {
  box-shadow: 0 0 20px rgba(74, 144, 226, 0.6);
}

// Add particle effect hint for dissolve
.self-destruct-dissolve-leave-active {
  background-image: radial-gradient(circle at center, transparent 0%, rgba(255, 255, 255, 0.1) 100%);
}

// Add ember effect for burn
.self-destruct-burn-leave-active {
  box-shadow: 0 0 30px rgba(255, 68, 68, 0.4), inset 0 0 20px rgba(255, 100, 0, 0.2);
}
</style>
