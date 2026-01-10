<template>
  <div class="dark-mode-toggle">
    <!-- 切换按钮 -->
    <button :class="toggleClasses" @click="toggleDarkMode" :aria-label="isDark ? '切换到亮色模式' : '切换到暗色模式'">
      <transition name="toggle-icon" mode="out-in">
        <!-- 太阳图标（亮色模式） -->
        <Icon v-if="!isDark" key="sun" icon="material-symbols:light-mode" class="toggle-icon" />
        <!-- 月亮图标（暗色模式） -->
        <Icon v-else key="moon" icon="material-symbols:dark-mode" class="toggle-icon" />
      </transition>

      <!-- 涟漪效果 -->
      <span ref="rippleContainer" class="toggle-ripple-container"></span>
    </button>

    <!-- 系统跟随选项 -->
    <div v-if="showSystemOption" class="dark-mode-options">
      <button :class="['option-button', { 'option-button--active': mode === 'system' }]" @click="setMode('system')">
        <Icon icon="material-symbols:computer" />
        <span>跟随系统</span>
      </button>
      <button :class="['option-button', { 'option-button--active': mode === 'light' }]" @click="setMode('light')">
        <Icon icon="material-symbols:light-mode" />
        <span>亮色</span>
      </button>
      <button :class="['option-button', { 'option-button--active': mode === 'dark' }]" @click="setMode('dark')">
        <Icon icon="material-symbols:dark-mode" />
        <span>暗色</span>
      </button>
    </div>

    <!-- 提示信息 -->
    <div v-if="showTooltip" class="dark-mode-tooltip">
      {{ tooltipText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, useTemplateRef } from 'vue'
import { Icon } from '@iconify/vue'
import { useSettingStore } from '@/stores/setting'

type ThemeMode = 'light' | 'dark' | 'system'

interface Props {
  size?: 'small' | 'medium' | 'large'
  variant?: 'button' | 'switch' | 'toggle'
  showTooltip?: boolean
  showSystemOption?: boolean
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  variant: 'button',
  showTooltip: true,
  showSystemOption: false,
  tooltipPosition: 'top'
})

const settingStore = useSettingStore()
const rippleContainer = useTemplateRef<HTMLElement>('rippleContainer')

// 当前模式
const mode = ref<ThemeMode>(settingStore.themeMode || 'system')
const isDark = ref(false)

// 计算属性
const toggleClasses = computed(() => [
  'dark-mode-toggle-button',
  `dark-mode-toggle-button--${props.size}`,
  `dark-mode-toggle-button--${props.variant}`,
  {
    'dark-mode-toggle-button--dark': isDark.value,
    'dark-mode-toggle-button--active': true
  }
])

const tooltipText = computed(() => {
  if (mode.value === 'system') {
    return isDark.value ? '暗色模式（系统）' : '亮色模式（系统）'
  }
  return isDark.value ? '暗色模式' : '亮色模式'
})

// 方法
const checkSystemTheme = () => {
  if (window.matchMedia && mode.value === 'system') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    isDark.value = mediaQuery.matches

    // 监听系统主题变化
    mediaQuery.addEventListener('change', handleSystemThemeChange)
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }
  }
  return () => {}
}

const handleSystemThemeChange = (e: MediaQueryListEvent) => {
  if (mode.value === 'system') {
    isDark.value = e.matches
    applyTheme(e.matches)
  }
}

const applyTheme = (dark: boolean) => {
  // 设置 data-theme-content 属性
  document.documentElement.setAttribute('data-theme-content', dark ? 'dark' : 'light')

  // 设置 meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]')
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', dark ? 'var(--hula-brand-primary)' : 'var(--hula-brand-primary)')
  }

  // 触发自定义事件
  window.dispatchEvent(
    new CustomEvent('theme-change', {
      detail: { mode: dark ? 'dark' : 'light', source: mode.value }
    })
  )
}

const toggleDarkMode = () => {
  createRipple()

  if (mode.value === 'system') {
    // 在系统模式下，切换到相反模式
    setMode(isDark.value ? 'light' : 'dark')
  } else {
    // 在固定模式下，切换主题
    const newMode = isDark.value ? 'light' : 'dark'
    setMode(newMode)
  }
}

const setMode = (newMode: ThemeMode) => {
  mode.value = newMode
  settingStore.setThemeMode(newMode)

  let shouldApplyDark = false

  switch (newMode) {
    case 'dark':
      shouldApplyDark = true
      break
    case 'light':
      shouldApplyDark = false
      break
    case 'system':
      if (window.matchMedia) {
        shouldApplyDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      }
      break
  }

  isDark.value = shouldApplyDark
  applyTheme(shouldApplyDark)

  // 保存到本地存储
  localStorage.setItem('theme-mode', newMode)
}

// 创建涟漪效果
const createRipple = () => {
  if (!rippleContainer.value) return

  const button = rippleContainer.value.parentElement as HTMLElement
  const rect = button.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)

  const ripple = document.createElement('span')
  ripple.className = 'toggle-ripple'
  ripple.style.width = ripple.style.height = '0px'
  ripple.style.left = '50%'
  ripple.style.top = '50%'

  rippleContainer.value.appendChild(ripple)

  requestAnimationFrame(() => {
    ripple.style.width = ripple.style.height = `${size * 2}px`
    ripple.style.marginLeft = `-${size}px`
    ripple.style.marginTop = `-${size}px`
  })

  setTimeout(() => {
    ripple.style.opacity = '0'
    setTimeout(() => {
      if (rippleContainer.value && rippleContainer.value.contains(ripple)) {
        rippleContainer.value.removeChild(ripple)
      }
    }, 600)
  }, 400)
}

// 生命周期
let cleanupSystemTheme: (() => void) | null = null

onMounted(() => {
  // 从本地存储恢复模式
  const savedMode = localStorage.getItem('theme-mode') as ThemeMode
  if (savedMode && ['light', 'dark', 'system'].includes(savedMode)) {
    mode.value = savedMode
  }

  // 应用初始主题
  cleanupSystemTheme = checkSystemTheme()

  // 检查是否支持减少动画
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.setAttribute('data-reduced-motion', 'true')
  }
})

onUnmounted(() => {
  if (cleanupSystemTheme) {
    cleanupSystemTheme()
  }
})
</script>

<style lang="scss" scoped>
.dark-mode-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

// 切换按钮
.dark-mode-toggle-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;

  // 尺寸
  &--small {
    width: 32px;
    height: 32px;
  }

  &--medium {
    width: 40px;
    height: 40px;
  }

  &--large {
    width: 48px;
    height: 48px;
  }

  // 变体
  &--button {
    background: var(--bg-color-secondary);
    border: 1px solid var(--border-color);

    &:hover {
      background: var(--hover-bg);
      opacity: 0.9;
    }

    // 暗色模式下的特殊样式
    &--dark {
      background: var(--bg-color-elevated);
      border-color: var(--border-color-dark);

      &:hover {
        background: var(--enhanced-bg-hover);
      }
    }
  }

  &--switch {
    background: var(--bg-color-elevated);
    border: 2px solid var(--border-color);
    padding: 4px;

    &--dark {
      background: var(--primary-color);
      border-color: var(--primary-color);
    }
  }

  &--toggle {
    background: linear-gradient(145deg, var(--hula-brand-primary), var(--hula-brand-primary));
    box-shadow:
      2px 2px 4px rgba(var(--hula-black-rgb), 0.1),
      -2px -2px 4px rgba(var(--hula-white-rgb), 0.9);

    &--dark {
      background: linear-gradient(145deg, var(--hula-brand-primary), var(--hula-brand-primary));
      box-shadow:
        inset 2px 2px 4px rgba(var(--hula-black-rgb), 0.3),
        inset -2px -2px 4px rgba(var(--hula-white-rgb), 0.1);
    }
  }

  // 图标
  .toggle-icon {
    width: 20px;
    height: 20px;
    transition: all 0.3s ease;

    svg {
      width: 100%;
      height: 100%;
    }
  }
}

// 选项组
.dark-mode-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: var(--popover-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  min-width: 140px;
}

.option-button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-color);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--hover-bg);
  }

  &--active {
    background: var(--primary-bg);
    color: var(--primary-color);
  }

  svg {
    width: 16px;
    height: 16px;
  }

  span {
    flex: 1;
    text-align: left;
  }
}

// 工具提示
.dark-mode-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
  padding: 4px 8px;
  background: var(--tooltip-bg);
  color: var(--tooltip-text);
  font-size: 12px;
  white-space: nowrap;
  border-radius: 4px;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;

  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: var(--tooltip-bg);
  }
}

.dark-mode-toggle:hover .dark-mode-tooltip {
  opacity: 1;
  visibility: visible;
}

// 涟漪效果
.toggle-ripple-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
}

.toggle-ripple {
  position: absolute;
  border-radius: 50%;
  background: rgba(var(--hula-white-rgb), 0.5);
  transform: translate(-50%, -50%);
  transition: all 0.6s ease;

  [data-theme-content='dark'] & {
    background: rgba(var(--hula-white-rgb), 0.2);
  }
}

// 动画
.toggle-icon-enter-active,
.toggle-icon-leave-active {
  transition: all 0.3s ease;
}

.toggle-icon-enter-from {
  opacity: 0;
  transform: rotate(-180deg);
}

.toggle-icon-leave-to {
  opacity: 0;
  transform: rotate(180deg);
}

// 减少动画
@media (prefers-reduced-motion: reduce) {
  .dark-mode-toggle-button,
  .toggle-icon,
  .toggle-ripple {
    transition: none !important;
    animation: none !important;
  }
}

// 暗色模式适配
[data-theme-content='dark'] {
  .dark-mode-toggle-button {
    color: var(--text-color);
  }

  .dark-mode-options {
    background: var(--popover-bg);
    border-color: var(--border-color-dark);
  }

  .option-button {
    color: var(--text-color);

    &:hover {
      background: var(--hover-bg);
    }
  }
}
</style>
