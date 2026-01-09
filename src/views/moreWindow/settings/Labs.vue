<template>
  <n-flex vertical :size="40">
    <!-- 实验室说明 -->
    <n-alert type="warning" title="实验性功能警告">
      <template #header>
        <n-flex align="center" :size="8">
          <svg class="size-18px text-orange-500"><use href="#alert-triangle"></use></svg>
          <span>实验性功能警告</span>
        </n-flex>
      </template>
      以下功能正在开发中，可能不稳定。启用后可能会影响应用性能或稳定性。
    </n-alert>

    <!-- 功能开关列表 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">实验性功能</span>

      <n-flex class="item" :size="12" vertical>
        <div v-for="feature in labFeatures" :key="feature.key">
          <n-flex align="center" justify="space-between" class="py-8px">
            <n-flex vertical :size="4" class="flex-1">
              <n-flex align="center" :size="8">
                <span class="text-14px font-600">{{ feature.label }}</span>
                <n-tag v-if="feature.new" size="small" type="success">新</n-tag>
                <n-tag v-if="feature.beta" size="small" type="warning">测试版</n-tag>
              </n-flex>
              <span v-if="feature.description" class="text-(12px var(--hula-brand-primary))">{{ feature.description }}</span>
            </n-flex>

            <n-switch
              size="small"
              :value="isFeatureEnabled(feature.key)"
              :disabled="feature.disabled"
              @update:value="(value) => handleFeatureToggle(feature.key, value)" />
          </n-flex>

          <span class="w-full h-1px bg-[--line-color]"></span>
        </div>
      </n-flex>
    </n-flex>

    <!-- 开发者选项 -->
    <n-collapse>
      <n-collapse-item title="开发者选项" name="developer">
        <n-flex class="item" :size="12" vertical>
          <n-flex align="center" justify="space-between">
            <span>调试模式</span>
            <n-switch size="small" v-model:value="debugMode" />
          </n-flex>

          <span class="w-full h-1px bg-[--line-color]"></span>

          <n-flex align="center" justify="space-between">
            <span>性能监控</span>
            <n-switch size="small" v-model:value="performanceMonitoring" />
          </n-flex>

          <span class="w-full h-1px bg-[--line-color]"></span>

          <n-flex align="center" justify="space-between">
            <span>详细日志</span>
            <n-switch size="small" v-model:value="verboseLogging" />
          </n-flex>

          <span class="w-full h-1px bg-[--line-color]"></span>

          <n-flex align="center" justify="space-between">
            <span>显示渲染统计</span>
            <n-switch size="small" v-model:value="showRenderStats" />
          </n-flex>
        </n-flex>
      </n-collapse-item>
    </n-collapse>

    <!-- 功能重置 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">重置选项</span>

      <n-flex class="item" :size="12" vertical>
        <n-text depth="3" class="text-(12px var(--hula-brand-primary))">
          将所有设置重置为默认值（此操作不可撤销）
        </n-text>

        <n-space>
          <n-button size="small" @click="handleResetLabs">重置实验室功能</n-button>
          <n-button size="small" type="error" ghost @click="handleResetAll">重置所有设置</n-button>
        </n-space>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  NFlex,
  NSwitch,
  NTag,
  NSpace,
  NButton,
  NCollapse,
  NCollapseItem,
  NAlert,
  NText,
  useDialog,
  useMessage
} from 'naive-ui'

const dialog = useDialog()
const message = useMessage()

// 开发者选项状态
const debugMode = ref(false)
const performanceMonitoring = ref(false)
const verboseLogging = ref(false)
const showRenderStats = ref(false)

// 实验室功能定义
const labFeatures = computed(() => [
  {
    key: 'feature_thread',
    label: '话题线程',
    description: '支持在消息中创建话题线程，让讨论更有条理',
    new: true,
    beta: false,
    disabled: false
  },
  {
    key: 'feature_video_rooms',
    label: '视频房间',
    description: '支持多人视频通话和屏幕共享',
    new: false,
    beta: true,
    disabled: false
  },
  {
    key: 'feature_spaces',
    label: '空间',
    description: '将相关房间组织到空间中',
    new: false,
    beta: false,
    disabled: false
  },
  {
    key: 'feature_location_sharing',
    label: '位置分享',
    description: '与联系人分享您的实时位置',
    new: true,
    beta: true,
    disabled: false
  },
  {
    key: 'feature_voice_messages',
    label: '语音消息',
    description: '录制和发送语音消息',
    new: false,
    beta: false,
    disabled: false
  },
  {
    key: 'feature_custom_tags',
    label: '自定义标签',
    description: '为房间创建自定义标签进行分类',
    new: true,
    beta: false,
    disabled: false
  },
  {
    key: 'feature_force_rotation',
    label: '媒体旋转',
    description: '强制按方向正确显示图片和视频',
    new: false,
    beta: false,
    disabled: false
  }
])

// 当前启用的实验室功能
const enabledFeatures = ref<Set<string>>(new Set())

// 方法

function isFeatureEnabled(key: string): boolean {
  return enabledFeatures.value.has(key)
}

async function handleFeatureToggle(key: string, enabled: boolean): Promise<void> {
  if (enabled) {
    enabledFeatures.value.add(key)
  } else {
    enabledFeatures.value.delete(key)
  }

  const feature = labFeatures.value.find((f) => f.key === key)
  if (feature) {
    message.success(enabled ? `${feature.label} 已启用` : `${feature.label} 已禁用`)
  }
}

async function handleResetLabs(): Promise<void> {
  dialog.warning({
    title: '重置实验室功能',
    content: '确定要将所有实验室功能重置为默认状态吗？',
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: () => {
      enabledFeatures.value.clear()
      message.success('实验室功能已重置')
    }
  })
}

async function handleResetAll(): Promise<void> {
  dialog.warning({
    title: '重置所有设置',
    content: '确定要将所有设置重置为默认值吗？此操作不可撤销。',
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: () => {
      message.success('所有设置已重置')
    }
  })
}
</script>

<style scoped lang="scss">
.item {
  @apply bg-[--bg-setting-item] rounded-12px size-full box-border border-(solid 1px [--line-color]) custom-shadow;
  padding: var(--pad-container-x);
  font-size: clamp(12px, 2vw, 14px);
}
</style>
