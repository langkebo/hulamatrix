<template>
  <div class="settings-skeleton" :class="{ 'is-loading': loading }">
    <!-- 标题骨架 -->
    <div v-if="showTitle" class="skeleton-title">
      <n-skeleton :width="titleWidth" :height="24" :sharp="false" />
    </div>

    <!-- 内容骨架 -->
    <div class="skeleton-content">
      <template v-for="i in rows" :key="i">
        <!-- 单行骨架 -->
        <div v-if="variant === 'text'" class="skeleton-row">
          <n-skeleton :width="getRandomWidth()" :height="16" :sharp="false" />
        </div>

        <!-- 按钮骨架 -->
        <div v-else-if="variant === 'button'" class="skeleton-button">
          <n-skeleton :width="80" :height="32" :sharp="false" />
        </div>

        <!-- 输入框骨架 -->
        <div v-else-if="variant === 'input'" class="skeleton-input">
          <n-skeleton :width="'100%'" :height="36" :sharp="false" />
        </div>

        <!-- 开关骨架 -->
        <div v-else-if="variant === 'switch'" class="skeleton-switch">
          <n-skeleton :width="200" :height="16" :sharp="false" />
          <n-skeleton :width="40" :height="24" :sharp="false" />
        </div>

        <!-- 卡片骨架 -->
        <div v-else-if="variant === 'card'" class="skeleton-card">
          <div class="skeleton-avatar">
            <n-skeleton :width="40" :height="40" :sharp="false" circle />
          </div>
          <div class="skeleton-card-content">
            <n-skeleton :width="'60%'" :height="16" :sharp="false" />
            <n-skeleton :width="'40%'" :height="14" :sharp="false" />
          </div>
        </div>

        <!-- 设置项骨架 -->
        <div v-else-if="variant === 'setting'" class="skeleton-setting">
          <n-skeleton :width="120" :height="16" :sharp="false" />
          <n-skeleton :width="40" :height="24" :sharp="false" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 设置页面骨架屏组件
 *
 * 用于设置页面加载时显示占位内容
 * 按照 HuLamatrix 的 UI 风格实现
 */

import { NSkeleton } from 'naive-ui'

interface Props {
  /** 是否加载中 */
  loading?: boolean
  /** 显示标题 */
  showTitle?: boolean
  /** 标题宽度 */
  titleWidth?: number | string
  /** 骨架行数 */
  rows?: number
  /** 骨架变体 */
  variant?: 'text' | 'button' | 'input' | 'switch' | 'card' | 'setting'
}

withDefaults(defineProps<Props>(), {
  loading: true,
  showTitle: false,
  titleWidth: 200,
  rows: 3,
  variant: 'text'
})

// 生成随机宽度
function getRandomWidth(): string {
  const minWidth = 60
  const maxWidth = 100
  const width = Math.floor(Math.random() * (maxWidth - minWidth + 1)) + minWidth
  return `${width}%`
}
</script>

<style scoped lang="scss">
.settings-skeleton {
  &.is-loading {
    animation: fadeIn 0.3s ease-in-out;
  }
}

.skeleton-title {
  padding: 12px 0;
  margin-bottom: 16px;
}

.skeleton-content {
  padding: 16px;
  background: var(--bg-setting-item);
  border: 1px solid var(--line-color);
  border-radius: 12px;

  & > div:not(:last-child) {
    margin-bottom: 12px;
  }
}

.skeleton-row,
.skeleton-button,
.skeleton-input,
.skeleton-switch,
.skeleton-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.skeleton-switch,
.skeleton-setting {
  gap: 12px;
}

.skeleton-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;

  &-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
