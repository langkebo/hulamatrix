/** * NavItem - PC端导航图标组件 * 圆形背景，支持徽章和提示点 */
<template>
  <div class="nav-item" :class="{ active }" @click="handleClick" @mouseenter="handleHover" @mouseleave="handleLeave">
    <!-- 徽章 -->
    <div v-if="badge !== undefined && badge > 0" class="nav-badge">
      {{ badge > 99 ? '99+' : badge }}
    </div>

    <!-- 提示点 -->
    <div v-if="dot" class="nav-dot"></div>

    <!-- 图标容器 -->
    <div class="icon-container">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
        <path
          v-if="icon === 'user'"
          d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        <path v-else-if="icon === 'message'" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
        <path
          v-else-if="icon === 'compass'"
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z" />
        <path v-else-if="icon === 'bookmark'" d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7-3V5c0-1.1-.9-2-2-2z" />
        <path
          v-else-if="icon === 'settings'"
          d="M19.14 12.94c.04-.3.06-.61.06-.94c.06-.32-.02-.66-.12-.98c-.1-.32-.26-.6-.46-.82c-.2-.22-.38-.4-.65-.49c-.27-.09-.54-.06-.8.1c-.26.16-.47.37-.61.65c-.14.28-.19.6-.14.96c.05.36.19.68.41.94c.22.26.48.44.78.5c.3.06.62-.02.94-.12c.32-.1.6-.26.82-.46c.22-.2.4-.38.49-.65c.09-.27.06-.54-.1-.8c-.16-.26-.37-.47-.65-.61c-.28-.14-.6-.19-.96-.14c-.36.05-.68.19-.94.41c-.26-.22-.44-.48-.5-.78c-.06-.3.02-.62.12-.94c.1-.32.26-.6.46-.82c.2-.22.38-.4.65-.49c.27-.09.54-.06.8.1c.26.16.47.37.61.65c.14.28.19.6.14.96c-.05.36-.19.68-.41.94c-.22-.26-.48-.44-.78-.5c-.3-.06-.62.02-.94.12c-.32.1-.6.26-.82.46c-.22.2-.4.38-.49.65c-.09.27-.06.54.1.8c.16.26.37.47.65.61c.28.14.6.19.96.14c.36.05.68-.19.94-.41c.26-.22.44-.48.5-.78zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
        <path v-else-if="icon === 'menu'" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
      </svg>
    </div>

    <!-- Tooltip -->
    <div v-if="showTooltip" class="tooltip">
      {{ label }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  icon: string
  label: string
  active?: boolean
  badge?: number
  dot?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: []
}>()

const showTooltip = ref(false)

function handleClick() {
  emit('click')
}

function handleHover() {
  showTooltip.value = true
}

function handleLeave() {
  showTooltip.value = false
}
</script>

<style scoped>
.nav-item {
  position: relative;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.nav-item.active {
  background: var(--pc-accent-primary);
}

.icon-container {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-icon {
  width: 24px;
  height: 24px;
  color: var(--pc-text-primary);
}

.nav-item.active .nav-icon {
  color: white;
}

/* 徽章 */
.nav-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--pc-error);
  color: white;
  font-size: 10px;
  font-weight: var(--font-semibold);
  border-radius: var(--radius-full);
  border: 2px solid var(--pc-bg-primary);
}

/* 提示点 */
.nav-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  background: var(--pc-error);
  border-radius: 50%;
  border: 2px solid var(--pc-bg-primary);
}

/* Tooltip */
.tooltip {
  position: absolute;
  left: 70px;
  top: 50%;
  transform: translateY(-50%);
  padding: var(--space-xs) var(--space-sm);
  background: var(--pc-bg-elevated);
  color: var(--pc-text-primary);
  font-size: var(--font-sm);
  white-space: nowrap;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-dark-md);
  pointer-events: none;
  opacity: 0;
  animation: tooltipFadeIn 0.2s ease;
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateY(-50%) translateX(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(-50%) translateX(0);
  }
}

.tooltip::before {
  content: '';
  position: absolute;
  left: -4px;
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-right: 4px solid var(--pc-bg-elevated);
}
</style>
