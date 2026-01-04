<template>
  <n-config-provider
    :theme-overrides="themeOverrides"
    :theme="globalTheme"
    :locale="currentNaiveLocale"
    :date-locale="currentNaiveDateLocale">
    <n-loading-bar-provider>
      <n-dialog-provider>
        <n-notification-provider :max="notificMax || 3">
          <n-message-provider :max="messageMax || 3">
            <n-modal-provider>
              <slot></slot>
              <naive-provider-content />
            </n-modal-provider>
          </n-message-provider>
        </n-notification-provider>
      </n-dialog-provider>
    </n-loading-bar-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import {
  darkTheme,
  dateEnUS,
  dateZhCN,
  enUS,
  type GlobalThemeOverrides,
  type NDateLocale,
  type NLocale,
  type GlobalTheme,
  lightTheme,
  zhCN,
  useLoadingBar,
  useDialog,
  useNotification,
  useModal,
  useMessage
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { computed, ref, watchEffect, defineComponent, h } from 'vue'
import { ThemeEnum } from '@/enums'
import { useSettingStore } from '@/stores/setting.ts'
import { hulaThemeOverrides, getNaiveUITheme } from '@/styles/theme/naive-theme'

const { notificMax, messageMax } = defineProps<{
  notificMax?: number
  messageMax?: number
}>()
defineOptions({ name: 'NaiveProvider' })
const settingStore = useSettingStore()
const themes = computed(() => settingStore.themes)
const { locale } = useI18n()

type NaiveLocalePack = {
  locale: NLocale
  dateLocale: NDateLocale
}

const naiveLocaleMap: Record<string, NaiveLocalePack> = {
  'zh-CN': { locale: zhCN, dateLocale: dateZhCN },
  zh: { locale: zhCN, dateLocale: dateZhCN },
  'en-US': { locale: enUS, dateLocale: dateEnUS },
  en: { locale: enUS, dateLocale: dateEnUS }
}

const defaultNaiveLocalePack = naiveLocaleMap['zh-CN']!
const resolveNaiveLocale = (lang: string): NaiveLocalePack => naiveLocaleMap[lang] ?? defaultNaiveLocalePack
const currentNaiveLocale = computed(() => resolveNaiveLocale(locale.value).locale)
const currentNaiveDateLocale = computed(() => resolveNaiveLocale(locale.value).dateLocale)
/**监听深色主题颜色变化*/
const globalTheme = ref<GlobalTheme>(getNaiveUITheme(themes.value.content === ThemeEnum.DARK) || lightTheme)
const prefers = matchMedia('(prefers-color-scheme: dark)')
// 定义不需要显示消息提示的窗口
const noMessageWindows = ['tray', 'notify', 'capture', 'update', 'checkupdate']

/** 跟随系统主题模式切换主题 */
const followOS = () => {
  const isDarkMode = prefers.matches
  globalTheme.value = getNaiveUITheme(isDarkMode) || (isDarkMode ? darkTheme : lightTheme)
  document.documentElement.dataset.theme = isDarkMode ? ThemeEnum.DARK : ThemeEnum.LIGHT
  themes.value.content = isDarkMode ? ThemeEnum.DARK : ThemeEnum.LIGHT
}

watchEffect(() => {
  if (themes.value.pattern === ThemeEnum.OS) {
    followOS()
    themes.value.pattern = ThemeEnum.OS
    prefers.addEventListener('change', followOS)
  } else {
    // 判断content是否是深色还是浅色
    const isDarkMode = themes.value.content === ThemeEnum.DARK
    document.documentElement.dataset.theme = isDarkMode ? ThemeEnum.DARK : ThemeEnum.LIGHT
    globalTheme.value = getNaiveUITheme(isDarkMode) || (isDarkMode ? darkTheme : lightTheme)
    prefers.removeEventListener('change', followOS)
  }
})

// 使用统一的 HuLa 主题覆盖配置
const themeOverrides = computed<GlobalThemeOverrides>(() => hulaThemeOverrides)

// 挂载naive组件的方法至window, 以便在路由钩子函数和请求函数里面调用
const registerNaiveTools = () => {
  window.$loadingBar = useLoadingBar()
  window.$dialog = useDialog()
  window.$notification = useNotification()
  window.$modal = useModal()

  // 获取原始的消息对象
  const originalMessage = useMessage()

  // 创建一个空的消息对象，用于禁用消息的窗口
  const noOpMessage = {
    info: () => {},
    success: () => {},
    warning: () => {},
    error: () => {},
    loading: () => ({
      destroy: () => {},
      type: 'loading'
    }),
    create: () => ({
      destroy: () => {},
      type: 'info'
    }),
    destroyAll: () => {}
  } as unknown as ReturnType<typeof useMessage>

  // 检查当前路由是否需要禁用消息
  const shouldDisableMessage = () => {
    try {
      const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
      if (!isTauri) return false
      const w = getCurrentWebviewWindow()
      const label = w.label || ''
      return noMessageWindows.includes(label)
    } catch {
      return false
    }
  }

  // 设置消息对象
  window.$message = shouldDisableMessage() ? noOpMessage : originalMessage
}

const NaiveProviderContent = defineComponent({
  name: 'NaiveProviderContent',
  setup() {
    registerNaiveTools()
  },
  render() {
    return h('div')
  }
})
</script>
<style>
.n-popover {
  zoom: var(--page-scale, 1);
}

.n-dropdown-menu {
  zoom: var(--page-scale, 1);
}

.n-tooltip {
  zoom: var(--page-scale, 1);
}

.n-modal {
  zoom: var(--page-scale, 1);
}

.n-drawer {
  zoom: var(--page-scale, 1);
}

.n-notification {
  zoom: var(--page-scale, 1);
}

.n-message {
  zoom: var(--page-scale, 1);
}

.n-date-picker-panel {
  zoom: var(--page-scale, 1);
}

.n-time-picker-panel {
  zoom: var(--page-scale, 1);
}

.n-cascader-menu {
  zoom: var(--page-scale, 1);
}

.n-select-menu {
  zoom: var(--page-scale, 1);
}

.n-popselect {
  zoom: var(--page-scale, 1);
}

.n-popselect-panel {
  zoom: var(--page-scale, 1);
}

.n-base-select-menu {
  zoom: var(--page-scale, 1);
}
</style>
