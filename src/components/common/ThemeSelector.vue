<template>
  <n-dropdown :options="themeOptions" @select="handleThemeSelect" trigger="click">
    <n-button quaternary circle size="small">
      <template #icon>
        <n-icon :component="ThemeIcon" />
      </template>
    </n-button>
  </n-dropdown>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { NButton, NDropdown, NIcon, NText, useMessage } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { useSettingStore } from '@/stores/setting'

const settingStore = useSettingStore()
const message = useMessage()

// 图标组件
const ThemeIcon = Icon
const LightIcon = () => h(Icon, { icon: 'material-symbols:light-mode' })
const DarkIcon = () => h(Icon, { icon: 'material-symbols:dark-mode' })
const DefaultIcon = () => h(Icon, { icon: 'material-symbols:palette' })
const SimpleIcon = () => h(Icon, { icon: 'material-symbols:format-paint' })
const PurpleIcon = () => h(Icon, { icon: 'material-symbols:colorize' })
const BlueIcon = () => h(Icon, { icon: 'material-symbols:water-drop' })

// 主题选项
const themeOptions = computed(() => [
  {
    label: '默认主题',
    key: 'default',
    icon: () => h(NIcon, { component: DefaultIcon }),
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }
    },
    children: [
      {
        label: () =>
          h('div', { style: 'display: flex; align-items: center; gap: 8px' }, [
            h(NIcon, { component: LightIcon }),
            h(NText, null, '亮色模式')
          ]),
        key: 'default-light'
      },
      {
        label: () =>
          h('div', { style: 'display: flex; align-items: center; gap: 8px' }, [
            h(NIcon, { component: DarkIcon }),
            h(NText, null, '暗色模式')
          ]),
        key: 'default-dark'
      }
    ]
  },
  {
    label: '简洁主题',
    key: 'simple',
    icon: () => h(NIcon, { component: SimpleIcon }),
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }
    },
    children: [
      {
        label: () =>
          h('div', { style: 'display: flex; align-items: center; gap: 8px' }, [
            h(NIcon, { component: LightIcon }),
            h(NText, null, '亮色模式')
          ]),
        key: 'simple-light'
      },
      {
        label: () =>
          h('div', { style: 'display: flex; align-items: center; gap: 8px' }, [
            h(NIcon, { component: DarkIcon }),
            h(NText, null, '暗色模式')
          ]),
        key: 'simple-dark'
      }
    ]
  },
  {
    label: '紫色主题',
    key: 'purple',
    icon: () => h(NIcon, { component: PurpleIcon }),
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }
    },
    children: [
      {
        label: () =>
          h('div', { style: 'display: flex; align-items: center; gap: 8px' }, [
            h(NIcon, { component: LightIcon }),
            h(NText, null, '亮色模式')
          ]),
        key: 'purple-light'
      },
      {
        label: () =>
          h('div', { style: 'display: flex; align-items: center; gap: 8px' }, [
            h(NIcon, { component: DarkIcon }),
            h(NText, null, '暗色模式')
          ]),
        key: 'purple-dark'
      }
    ]
  },
  {
    label: '蓝色主题',
    key: 'blue',
    icon: () => h(NIcon, { component: BlueIcon }),
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }
    },
    children: [
      {
        label: () =>
          h('div', { style: 'display: flex; align-items: center; gap: 8px' }, [
            h(NIcon, { component: LightIcon }),
            h(NText, null, '亮色模式')
          ]),
        key: 'blue-light'
      },
      {
        label: () =>
          h('div', { style: 'display: flex; align-items: center; gap: 8px' }, [
            h(NIcon, { component: DarkIcon }),
            h(NText, null, '暗色模式')
          ]),
        key: 'blue-dark'
      }
    ]
  }
])

// 处理主题选择
const handleThemeSelect = (key: string) => {
  const [themeStyle, mode] = key.split('-') as ['default' | 'simple' | 'purple' | 'blue', 'light' | 'dark']

  // 更新主题
  settingStore.setTheme({
    theme: themeStyle,
    darkMode: mode === 'dark'
  })

  // 应用主题到HTML
  document.documentElement.setAttribute('data-theme', mode)
  document.documentElement.setAttribute('data-theme-style', themeStyle)

  // 显示提示
  const themeNames = {
    default: '默认主题',
    simple: '简洁主题',
    purple: '紫色主题',
    blue: '蓝色主题'
  }
  const modeNames = {
    light: '亮色模式',
    dark: '暗色模式'
  }

  message.success(`已切换至 ${themeNames[themeStyle]} - ${modeNames[mode]}`)
}
</script>

<style lang="scss" scoped>
.n-dropdown-menu {
  min-width: 160px;
}
</style>
