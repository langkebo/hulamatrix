/** * TabItem - 移动端导航标签项组件 */
<template>
  <div class="tab-item" :class="{ active }" @click="handleClick">
    <!-- 徽章 -->
    <div v-if="badge !== undefined && badge > 0" class="tab-badge">
      {{ badge > 99 ? '99+' : badge }}
    </div>

    <!-- 图标容器 -->
    <div class="icon-container">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="currentColor">
        <path v-if="icon === 'message'" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
        <path
          v-else-if="icon === 'users'"
          d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5S5.67 15 8 15s7-1.17 7-3.5S10.33 9 8 9zm8 0c-2.33 0-7 1.17-7 3.5S13.67 15 16 15s7-1.17 7-3.5S18.33 9 16 9z" />
        <path
          v-else-if="icon === 'grid'"
          d="M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM10 4h4v4h-4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4z" />
        <path
          v-else-if="icon === 'user-friends'"
          d="M15 12c2.21 0 4-1.79 4-4v-2c0-2.21-1.79-4-4-4s-4 1.79-4 4v2c0 2.21 1.79 4 4 4zm-2-4c0-1.1-.9-2-2-2V4c0 1.1.9 2 2 2V8zm-7.5 2c.83 0 1.5-.67 1.5-1.5S6.33 7 5.5 7 5 6.33 5.5 7 5.5 6.33 5 7 5.5 7c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S8.67 7 9.5 7c0 .83.67 1.5 1.5 1.5s-.67 1.5-1.5 1.5S10.33 9 9.5 9z" />
        <path
          v-else-if="icon === 'user'"
          d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    </div>

    <!-- 标签文本 -->
    <span class="tab-label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  icon: string
  label: string
  active?: boolean
  badge?: number
}

defineProps<Props>()

const emit = defineEmits<{
  click: []
}>()

function handleClick() {
  emit('click')
}
</script>

<style scoped>
.tab-item {
  position: relative;
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--hula-spacing-xs);
  cursor: pointer;
  transition: color 0.2s ease;
}

.icon-container {
  width: var(--hula-spacing-xl);
  height: var(--hula-spacing-xl);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-icon {
  width: var(--hula-spacing-xl);
  height: var(--hula-spacing-xl);
  color: var(--mobile-text-tertiary);
  transition: color 0.2s ease;
}

.tab-label {
  font-size: var(--hula-text-xs);
  color: var(--mobile-text-tertiary);
  font-weight: var(--font-medium);
  transition: color 0.2s ease;
}

/* 激活状态 */
.tab-item.active .tab-icon {
  color: var(--mobile-accent-primary);
}

.tab-item.active .tab-label {
  color: var(--mobile-accent-primary);
}

/* 徽章 */
.tab-badge {
  position: absolute;
  top: var(--hula-spacing-xs);
  right: 25%;
  min-width: var(--hula-spacing-md);
  height: var(--hula-spacing-md);
  padding: 0 var(--hula-spacing-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--mobile-error);
  color: white;
  font-size: var(--hula-text-xs);
  font-weight: var(--font-semibold);
  border-radius: var(--radius-full);
}
</style>
