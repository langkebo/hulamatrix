<template>
  <n-flex vertical :size="40">
    <!-- 一致性检查面板 -->
    <n-card size="small" title="设置同步状态" class="mx-10px bg-[--bg-setting-item]">
      <template #header-extra>
        <n-button size="small" type="primary" secondary @click="checkAllConsistency" :loading="checking">
          重新同步
        </n-button>
      </template>
      <n-collapse>
        <n-collapse-item title="查看后端一致性详情" name="1">
          <n-table size="small" :single-line="false">
            <thead>
              <tr>
                <th>设置项</th>
                <th>本地值</th>
                <th>后端值</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in consistencyReport" :key="item.key">
                <td>{{ item.label }}</td>
                <td>{{ item.local }}</td>
                <td>{{ item.remote }}</td>
                <td>
                  <n-tag :type="item.consistent ? 'success' : 'warning'" size="small">
                    {{ item.consistent ? '已同步' : '不一致' }}
                  </n-tag>
                </td>
              </tr>
            </tbody>
          </n-table>
        </n-collapse-item>
      </n-collapse>
    </n-card>

    <!-- 主题设置 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.general.appearance.title') }}</span>

      <n-flex align="center" :size="20" class="item">
        <n-flex
          vertical
          align="center"
          class="w-120px h-100px"
          :size="0"
          v-for="(item, index) in themeList"
          :key="index">
          <div
            @click="handleThemeChange(item.code)"
            class="size-full rounded-8px cursor-pointer custom-shadow"
            :class="{ 'outline outline-2 outline-[--border-active-color] outline-offset': activeTheme === item.code }">
            <component :is="item.model" />
          </div>
          <span class="text-12px pt-8px color-[--text-color]">{{ item.title }}</span>
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- 字体缩放 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">字体缩放</span>

      <n-flex class="item" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <span>缩放比例</span>
          <span class="text-(12px #909090)">{{ fontScale }}%</span>
        </n-flex>

        <n-slider
          v-model:value="fontScale"
          :min="50"
          :max="150"
          :step="10"
          :marks="{ 80: '80%', 100: '100%', 120: '120%', 150: '150%' }"
          @update:value="handleFontScaleChange" />

        <n-flex :space="8">
          <n-button size="small" secondary @click="handleFontScaleChange(80)">80%</n-button>
          <n-button size="small" secondary @click="handleFontScaleChange(100)">100%</n-button>
          <n-button size="small" secondary @click="handleFontScaleChange(120)">120%</n-button>
          <n-button size="small" secondary @click="handleFontScaleChange(150)">150%</n-button>
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- 布局模式 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">消息布局</span>

      <n-flex class="item" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <span>布局模式</span>
          <n-select
            class="w-140px"
            size="small"
            v-model:value="layoutMode"
            :options="layoutOptions"
            @update:value="handleLayoutChange" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>紧凑布局</span>
          <n-switch size="small" v-model:value="compactLayout" @update:value="handleCompactToggle" />
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- 其他显示选项 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">显示选项</span>

      <n-flex class="item" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <span>显示左侧面板</span>
          <n-switch size="small" v-model:value="showLeftPanel" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>面包屑导航</span>
          <n-switch size="small" v-model:value="showBreadcrumbs" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>URL 预览</span>
          <n-switch size="small" v-model:value="showUrlPreviews" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>自动播放 GIF</span>
          <n-switch size="small" v-model:value="autoplayGifs" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>自动播放视频</span>
          <n-switch size="small" v-model:value="autoplayVideos" />
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- 图片设置 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">图片设置</span>

      <n-flex class="item" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <span>自动下载图片大小</span>
          <n-select
            class="w-140px"
            size="small"
            v-model:value="imageSizeLimit"
            :options="imageSizeOptions"
            @update:value="handleImageSizeChange" />
        </n-flex>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { logger } from '@/utils/logger'
import { useI18n } from 'vue-i18n'
import { NFlex, NSwitch, NButton, NSelect, NSlider, NCard, NCollapse, NCollapseItem, NTable, NTag } from 'naive-ui'
import { useSettingStore } from '@/stores/setting'
import { useTopicsList } from '../settings/model'
import { matrixClientService } from '@/integrations/matrix/client'

const { t } = useI18n()
const settingStore = useSettingStore()
const { themes } = settingStore

// 一致性检查
const checking = ref(false)
const consistencyReport = ref<
  Array<{ key: string; label: string; local: string; remote: string; consistent: boolean }>
>([])

const checkAllConsistency = async () => {
  // 检查 Matrix 是否启用
  if (import.meta.env.VITE_MATRIX_ENABLED !== 'on') {
    logger.warn('[Appearance] Matrix 功能未启用，跳过一致性检查')
    consistencyReport.value = []
    return
  }

  // 检查客户端是否已初始化
  if (!matrixClientService.isClientInitialized()) {
    logger.warn('[Appearance] Matrix 客户端未初始化，跳过一致性检查')
    consistencyReport.value = []
    return
  }

  checking.value = true
  try {
    const report = []

    // Theme
    const remoteTheme = await matrixClientService.getAccountSetting('appearance.theme')
    report.push({
      key: 'theme',
      label: '主题',
      local: settingStore.themes.content,
      remote: String(remoteTheme || '未设置'),
      consistent: String(remoteTheme || '') === String(settingStore.themes.content)
    })

    // Font Scale
    const remoteFont = await matrixClientService.getAccountSetting('appearance.fontScale')
    report.push({
      key: 'fontScale',
      label: '字体缩放',
      local: String(settingStore.page.fontScale),
      remote: String(remoteFont || '未设置'),
      consistent: String(remoteFont) === String(settingStore.page.fontScale)
    })

    // Layout Mode
    const remoteLayout = await matrixClientService.getAccountSetting('appearance.layoutMode')
    report.push({
      key: 'layoutMode',
      label: '布局模式',
      local: settingStore.chat.layoutMode,
      remote: String(remoteLayout || '未设置'),
      consistent: String(remoteLayout) === String(settingStore.chat.layoutMode)
    })

    // Compact Layout
    const remoteCompact = await matrixClientService.getAccountSetting('appearance.compactLayout')
    report.push({
      key: 'compactLayout',
      label: '紧凑布局',
      local: settingStore.chat.compactLayout ? '开启' : '关闭',
      remote: remoteCompact === undefined ? '未设置' : remoteCompact ? '开启' : '关闭',
      consistent: remoteCompact === undefined ? false : Boolean(remoteCompact) === settingStore.chat.compactLayout
    })

    // Image Size
    const remoteImage = await matrixClientService.getAccountSetting('appearance.imageSizeLimit')
    report.push({
      key: 'imageSizeLimit',
      label: '图片大小',
      local: settingStore.chat.imageSizeLimit,
      remote: String(remoteImage || '未设置'),
      consistent: String(remoteImage) === String(settingStore.chat.imageSizeLimit)
    })

    consistencyReport.value = report
  } catch (error) {
    logger.error('[Appearance] 一致性检查失败:', error)
    consistencyReport.value = []
  } finally {
    checking.value = false
  }
}

onMounted(() => {
  checkAllConsistency()
})

// 主题
const activeTheme = ref(themes.pattern)
const themeList = useTopicsList()

const handleThemeChange = (code: string) => {
  if (code === activeTheme.value) return
  activeTheme.value = code
  settingStore.toggleTheme(code)
  setTimeout(checkAllConsistency, 1000)
}

// 字体缩放
const fontScale = computed({
  get: () => settingStore.page.fontScale,
  set: (val: number) => {
    settingStore.setFontScale(val)
    document.documentElement.style.fontSize = `${val}%`
    setTimeout(checkAllConsistency, 1000)
  }
})

const handleFontScaleChange = (value: number) => {
  fontScale.value = value
}

// 布局模式
const layoutMode = computed({
  get: () => settingStore.chat.layoutMode,
  set: (val: string) => {
    settingStore.setLayoutMode(val)
    setTimeout(checkAllConsistency, 1000)
  }
})
const layoutOptions = [
  { label: '默认', value: 'default' },
  { label: '标准三栏', value: 'standard' },
  { label: 'IR 布局', value: 'ir' },
  { label: '分组布局', value: 'group' }
]

const handleLayoutChange = (value: string) => {
  layoutMode.value = value
}

// 紧凑布局
const compactLayout = computed({
  get: () => settingStore.chat.compactLayout,
  set: (val: boolean) => {
    settingStore.setCompactLayout(val)
    setTimeout(checkAllConsistency, 1000)
  }
})

const handleCompactToggle = (value: boolean) => {
  compactLayout.value = value
}

// 显示选项 (暂时未接入 Store，保留本地 Ref)
const showLeftPanel = ref(true)
const showBreadcrumbs = ref(true)
const showUrlPreviews = ref(true)
const autoplayGifs = ref(true)
const autoplayVideos = ref(false)

// 图片设置
const imageSizeLimit = computed({
  get: () => settingStore.chat.imageSizeLimit,
  set: (val: string) => {
    settingStore.setImageSizeLimit(val)
    setTimeout(checkAllConsistency, 1000)
  }
})
const imageSizeOptions = [
  { label: '自动', value: 'auto' },
  { label: '小', value: 'small' },
  { label: '中', value: 'medium' },
  { label: '大', value: 'large' },
  { label: '原图', value: 'original' }
]

const handleImageSizeChange = (value: string) => {
  imageSizeLimit.value = value
}
</script>

<style scoped lang="scss">
.item {
  @apply bg-[--bg-setting-item] rounded-12px size-full box-border border-(solid 1px [--line-color]) custom-shadow;
  padding: var(--pad-container-x);
  font-size: clamp(12px, 2vw, 14px);
}
</style>
