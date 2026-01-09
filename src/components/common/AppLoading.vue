<!--
  全局应用加载状态组件
  当应用正在初始化或用户正在登录时显示
-->
<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="app-loading">
        <div class="loading-backdrop" />
        <div class="loading-content">
          <n-spin size="large" :stroke="loadingColor" />
          <p class="loading-text">{{ text }}</p>
          <p v-if="showSubText" class="loading-subtext" :class="{ 'has-error': hasError }">
            {{ subText }}
          </p>
          <n-progress
            v-if="showProgress"
            type="line"
            :percentage="progress"
            :status="hasError ? 'error' : 'success'"
            :show-indicator="false"
            class="loading-progress" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStateStore } from '@/stores/appState'
import { AppState } from '@/enums'

const appStateStore = useAppStateStore()

// 是否显示加载状态
const show = computed(() => {
  // 在初始化或登录中时显示
  return appStateStore.isInitializing || appStateStore.isLoggingIn
})

// 主要文本
const text = computed(() => {
  switch (appStateStore.state) {
    case AppState.INITIALIZING:
      return '应用初始化中...'
    case AppState.LOGGING_IN:
      return '登录中...'
    case AppState.LOGGED_IN:
      return '加载中...'
    default:
      return '加载中...'
  }
})

// 是否显示次要文本
const showSubText = computed(() => !!appStateStore.error)

// 次要文本（错误信息）
const subText = computed(() => {
  if (appStateStore.error) {
    return `初始化失败: ${appStateStore.error}`
  }
  return ''
})

// 是否有错误
const hasError = computed(() => appStateStore.state === AppState.ERROR)

// 加载动画颜色
const loadingColor = computed<string>(() => {
  return hasError.value ? 'var(--hula-brand-primary)' : 'var(--hula-brand-primary)'
})

// 显示进度条（可选，未来可以添加实际进度）
const showProgress = ref(false)

// 进度百分比（未来可以实现）
const progress = ref(0)
</script>

<style scoped>
.app-loading {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.loading-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(var(--hula-black-rgb), 0.75);
  backdrop-filter: blur(4px);
}

.loading-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 48px;
  background: var(--n-color);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(var(--hula-black-rgb), 0.3);
  max-width: 400px;
  width: 90%;
}

.loading-text {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--n-text-color);
  text-align: center;
}

.loading-subtext {
  margin: 0;
  font-size: 13px;
  color: var(--n-text-color-3);
  text-align: center;
  max-width: 300px;
  line-height: 1.5;
}

.loading-subtext.has-error {
  color: var(--hula-brand-primary);
}

.loading-progress {
  width: 100%;
  margin-top: 8px;
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 暗色模式适配 */
.dark .loading-content {
  background: rgba(24, 24, 28, 0.95);
  border: 1px solid rgba(var(--hula-white-rgb), 0.1);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .loading-content {
    padding: 24px 32px;
    margin: 16px;
  }

  .loading-text {
    font-size: 14px;
  }

  .loading-subtext {
    font-size: 12px;
  }
}
</style>
