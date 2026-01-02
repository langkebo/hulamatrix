<template>
  <n-flex vertical :size="12" class="p-16px">
    <n-card title="报表与策略配置" size="small">
      <n-space>
        <n-button type="primary" @click="metrics.exportCsv()">导出报表（CSV）</n-button>
        <n-button tertiary @click="metrics.load()">刷新</n-button>
      </n-space>
      <n-divider>输出设备选择</n-divider>
      <n-space vertical :size="8" class="max-w-640px">
        <n-alert type="info" :show-icon="true">
          根据历史点击与失败率，自动禁用输出选择入口以降低失败体验；也可手动覆盖。
        </n-alert>
        <n-space align="center" :size="8">
          <span class="text-12px">最小点击数</span>
          <n-input-number v-model:value="minClicks" :min="0" />
          <span class="text-12px">最大失败率（%）</span>
          <n-input-number v-model:value="maxFailRate" :min="0" :max="100" />
          <n-button size="small" type="primary" @click="saveThreshold">保存阈值</n-button>
        </n-space>
        <n-space align="center" :size="8">
          <span class="text-12px">覆盖模式</span>
          <n-radio-group v-model:value="overrideMode">
            <n-radio value="auto">自动</n-radio>
            <n-radio value="on">强制开启</n-radio>
            <n-radio value="off">强制关闭</n-radio>
          </n-radio-group>
          <n-button size="small" @click="saveOverride">保存覆盖</n-button>
        </n-space>
        <n-alert type="success" :show-icon="true">
          汇总：点击 {{ sum.click }} · 成功 {{ sum.success }} · 失败 {{ sum.failed }} · 不支持 {{ sum.unsupported }} ·
          成功率 {{ sum.successRate }}% · 失败率 {{ sum.failRate }}%
        </n-alert>
      </n-space>
    </n-card>
  </n-flex>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useMetricsStore } from '@/stores/metrics'

import { msg } from '@/utils/SafeUI'
import { NFlex, NCard, NSpace, NButton, NDivider, NAlert, NInputNumber, NRadioGroup, NRadio } from 'naive-ui'

const metrics = useMetricsStore()
metrics.load()
const feature = 'output-select'
const sum = metrics.summaryFor(feature)
const minClicks = ref<number>(metrics.thresholds[feature]?.clicks ?? 20)
const maxFailRate = ref<number>(metrics.thresholds[feature]?.failRate ?? 60)
const overrideMode = ref<'on' | 'off' | 'auto'>(metrics.getOverride(feature))

const saveThreshold = () => {
  metrics.setThreshold(feature, Number(minClicks.value || 0), Number(maxFailRate.value || 0))
  msg.success?.('已保存阈值')
}
const saveOverride = () => {
  metrics.setOverride(feature, overrideMode.value)
  msg.success?.('已保存覆盖模式')
}
</script>
