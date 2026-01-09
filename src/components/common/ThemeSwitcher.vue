<template>
  <div class="theme-switcher">
    <h3>主题切换</h3>
    <div class="theme-options">
      <!-- 自动模式（跟随系统） -->
      <button
        class="theme-option"
        :class="{ active: currentTheme === 'auto' }"
        @click="setTheme('auto')"
        :aria-label="`当前主题：自动${currentTheme === 'auto' ? '（已选中）' : ''}`">
        <Icon icon="mdi:theme-light-dark" class="theme-icon" />
        <span class="theme-name">自动</span>
        <span class="theme-description">跟随系统设置</span>
      </button>

      <!-- 浅色模式 -->
      <button
        class="theme-option"
        :class="{ active: currentTheme === 'light' }"
        @click="setTheme('light')"
        :aria-label="`当前主题：浅色${currentTheme === 'light' ? '（已选中）' : ''}`">
        <Icon icon="mdi:white-balance-sunny" class="theme-icon" />
        <span class="theme-name">浅色</span>
        <span class="theme-description">明亮清新</span>
      </button>

      <!-- 深色模式 -->
      <button
        class="theme-option"
        :class="{ active: currentTheme === 'dark' }"
        @click="setTheme('dark')"
        :aria-label="`当前主题：深色${currentTheme === 'dark' ? '（已选中）' : ''}`">
        <Icon icon="mdi:moon-waning-crescent" class="theme-icon" />
        <span class="theme-name">深色</span>
        <span class="theme-description">护眼舒适</span>
      </button>
    </div>

    <!-- 主题预览 -->
    <div class="theme-preview">
      <h4>色彩预览</h4>
      <div class="color-palette">
        <div class="color-item">
          <div class="color-swatch brand-primary"></div>
          <span class="color-label">主色</span>
        </div>
        <div class="color-item">
          <div class="color-swatch brand-hover"></div>
          <span class="color-label">悬停</span>
        </div>
        <div class="color-item">
          <div class="color-swatch brand-active"></div>
          <span class="color-label">激活</span>
        </div>
        <div class="color-item">
          <div class="color-swatch success"></div>
          <span class="color-label">成功</span>
        </div>
        <div class="color-item">
          <div class="color-swatch warning"></div>
          <span class="color-label">警告</span>
        </div>
        <div class="color-item">
          <div class="color-swatch error"></div>
          <span class="color-label">错误</span>
        </div>
      </div>
    </div>

    <!-- 高级设置 -->
    <div class="theme-advanced">
      <h4>高级设置</h4>
      <div class="advanced-options">
        <label class="toggle-option">
          <span>减少动画</span>
          <div
            class="toggle-switch"
            :class="{ active: reduceMotion }"
            @click="toggleReduceMotion"
            role="switch"
            :aria-checked="reduceMotion"
            tabindex="0"
            @keydown.enter.prevent="toggleReduceMotion"
            @keydown.space.prevent="toggleReduceMotion"></div>
        </label>
        <label class="toggle-option">
          <span>高对比度</span>
          <div
            class="toggle-switch"
            :class="{ active: highContrast }"
            @click="toggleHighContrast"
            role="switch"
            :aria-checked="highContrast"
            tabindex="0"
            @keydown.enter.prevent="toggleHighContrast"
            @keydown.space.prevent="toggleHighContrast"></div>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Icon } from '@iconify/vue'

// 主题类型
type ThemeMode = 'auto' | 'light' | 'dark'

// 当前主题
const currentTheme = ref<ThemeMode>('auto')

// 高级设置
const reduceMotion = ref(false)
const highContrast = ref(false)

// 设置主题
const setTheme = (theme: ThemeMode) => {
  currentTheme.value = theme
  localStorage.setItem('theme-preference', theme)
  applyTheme(theme)
}

// 应用主题
const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement

  if (theme === 'auto') {
    // 跟随系统主题
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
  } else {
    root.setAttribute('data-theme', theme)
  }

  // 触发自定义事件
  window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme } }))
}

// 切换减少动画
const toggleReduceMotion = () => {
  reduceMotion.value = !reduceMotion.value
  document.documentElement.classList.toggle('reduce-motion', reduceMotion.value)
  localStorage.setItem('reduce-motion', String(reduceMotion.value))
}

// 切换高对比度
const toggleHighContrast = () => {
  highContrast.value = !highContrast.value
  document.documentElement.classList.toggle('high-contrast', highContrast.value)
  localStorage.setItem('high-contrast', String(highContrast.value))
}

// 监听系统主题变化
const watchSystemTheme = () => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  const handleChange = (e: MediaQueryListEvent) => {
    if (currentTheme.value === 'auto') {
      const theme = e.matches ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', theme)
    }
  }

  mediaQuery.addEventListener('change', handleChange)

  return () => {
    mediaQuery.removeEventListener('change', handleChange)
  }
}

// 初始化
onMounted(() => {
  // 从 localStorage 读取保存的主题
  const savedTheme = localStorage.getItem('theme-preference') as ThemeMode
  if (savedTheme && ['auto', 'light', 'dark'].includes(savedTheme)) {
    currentTheme.value = savedTheme
  }

  // 从 localStorage 读取高级设置
  const savedReduceMotion = localStorage.getItem('reduce-motion')
  if (savedReduceMotion === 'true') {
    reduceMotion.value = true
    document.documentElement.classList.add('reduce-motion')
  }

  const savedHighContrast = localStorage.getItem('high-contrast')
  if (savedHighContrast === 'true') {
    highContrast.value = true
    document.documentElement.classList.add('high-contrast')
  }

  // 应用初始主题
  applyTheme(currentTheme.value)

  // 监听系统主题变化
  watchSystemTheme()
})

// 导出当前主题供其他组件使用
defineExpose({
  currentTheme,
  setTheme,
  reduceMotion,
  highContrast
})
</script>

<style lang="scss" scoped>
.theme-switcher {
  padding: 24px;
  background: var(--hula-bg-component, var(--hula-brand-primary));
  border-radius: 12px;
  box-shadow: var(--hula-shadow-md, 0 4px 6px rgba(var(--hula-black-rgb), 0.1));

  h3 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 20px;
    color: var(--hula-text-primary, var(--hula-gray-800, var(--hula-brand-primary)));
  }

  h4 {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 12px;
    color: var(--hula-text-secondary, var(--hula-gray-600, var(--hula-brand-primary)));
  }
}

/* 主题选项 */
.theme-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 32px;
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  border: 2px solid var(--hula-border, var(--hula-gray-200, var(--hula-brand-primary)));
  border-radius: 12px;
  background: var(--hula-bg-component, var(--hula-brand-primary));
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  .theme-icon {
    font-size: 32px;
    color: var(--hula-text-secondary, var(--hula-gray-600, var(--hula-brand-primary)));
    transition: color 0.3s ease;
  }

  .theme-name {
    font-size: 16px;
    font-weight: 500;
    color: var(--hula-text-primary, var(--hula-gray-800, var(--hula-brand-primary)));
  }

  .theme-description {
    font-size: 12px;
    color: var(--hula-text-tertiary, var(--hula-gray-500, var(--hula-brand-primary)));
  }

  &:hover {
    border-color: var(--hula-brand-primary, var(--hula-brand-primary));
    background: var(--hula-brand-subtle, rgba(var(--hula-success-rgb), 0.05));
    transform: translateY(-2px);
    box-shadow: var(--hula-shadow-md, 0 4px 6px rgba(var(--hula-black-rgb), 0.1));
  }

  &:active {
    transform: translateY(0);
  }

  &.active {
    border-color: var(--hula-brand-primary, var(--hula-brand-primary));
    background: var(--hula-brand-subtle, rgba(var(--hula-success-rgb), 0.1));
    box-shadow: var(--hula-shadow-brand, 0 4px 12px rgba(var(--hula-success-rgb), 0.2));

    .theme-icon {
      color: var(--hula-brand-primary, var(--hula-brand-primary));
    }

    .theme-name {
      color: var(--hula-brand-primary, var(--hula-brand-primary));
    }
  }
}

/* 色彩预览 */
.theme-preview {
  margin-bottom: 32px;
  padding: 20px;
  background: var(--hula-bg-tertiary, var(--hula-gray-50, var(--hula-brand-primary)));
  border-radius: 12px;
}

.color-palette {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.color-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.color-swatch {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  box-shadow: var(--hula-shadow-sm, 0 1px 2px rgba(var(--hula-black-rgb), 0.05));
  transition: transform 0.3s ease;

  &:hover {
    transform: scale(1.1);
  }

  &.brand-primary {
    background: var(--hula-brand-primary, var(--hula-brand-primary));
  }

  &.brand-hover {
    background: var(--hula-brand-hover, var(--hula-brand-primary));
  }

  &.brand-active {
    background: var(--hula-brand-active, var(--hula-brand-primary));
  }

  &.success {
    background: var(--hula-success, var(--hula-brand-primary));
  }

  &.warning {
    background: var(--hula-warning, var(--hula-brand-primary));
  }

  &.error {
    background: var(--hula-error, var(--hula-brand-primary));
  }
}

.color-label {
  font-size: 12px;
  color: var(--hula-text-secondary, var(--hula-gray-600, var(--hula-brand-primary)));
}

/* 高级设置 */
.theme-advanced {
  padding: 20px;
  background: var(--hula-bg-tertiary, var(--hula-gray-50, var(--hula-brand-primary)));
  border-radius: 12px;
}

.advanced-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toggle-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;

  span {
    font-size: 14px;
    color: var(--hula-text-primary, var(--hula-gray-800, var(--hula-brand-primary)));
  }
}

.toggle-switch {
  position: relative;
  width: 48px;
  height: 26px;
  background: var(--hula-gray-300, var(--hula-brand-primary));
  border-radius: 9999px;
  cursor: pointer;
  transition: background 0.3s ease;
  flex-shrink: 0;

  &::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    background: var(--hula-white);
    border-radius: 50%;
    transition: transform 0.3s ease;
    box-shadow: 0 2px 4px rgba(var(--hula-black-rgb), 0.2);
  }

  &.active {
    background: var(--hula-brand-primary, var(--hula-brand-primary));

    &::after {
      transform: translateX(22px);
    }
  }

  &:hover {
    filter: brightness(0.95);
  }
}

/* 无障碍优化 */
button:focus-visible,
.toggle-switch:focus-visible {
  outline: 2px solid var(--hula-brand-primary, var(--hula-brand-primary));
  outline-offset: 2px;
}

/* 减少动画模式 */
.reduce-motion {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* 高对比度模式 */
.high-contrast {
  --hula-border: var(--hula-brand-primary);
  --hula-gray-200: var(--hula-brand-primary);
  --hula-gray-500: var(--hula-brand-primary);

  .theme-option {
    border-width: 3px;
  }

  .color-swatch {
    box-shadow: 0 0 0 2px var(--hula-brand-primary);
  }
}

/* 暗色模式适配 */
[data-theme='dark'] {
  .theme-switcher {
    background: var(--hula-pc-bg-elevated, var(--hula-brand-primary));
  }

  .theme-option {
    background: var(--hula-pc-bg-secondary, var(--hula-brand-primary));
    border-color: var(--hula-pc-border, var(--hula-brand-primary));
  }

  .theme-preview,
  .theme-advanced {
    background: var(--hula-pc-bg-tertiary, var(--hula-brand-primary));
  }

  .toggle-switch {
    background: var(--hula-gray-600, var(--hula-brand-primary));
  }
}

/* 响应式适配 */
@media (max-width: 768px) {
  .theme-switcher {
    padding: 16px;
  }

  .theme-options {
    grid-template-columns: 1fr;
  }

  .color-palette {
    justify-content: center;
  }
}
</style>
