<template>
  <div class="performance-monitor">
    <n-card title="性能监控面板" size="small" :bordered="false">
      <n-space vertical size="small">
        <!-- 核心指标 -->
        <n-grid cols="2 s:3 m:4" responsive="screen" :x-gap="12" :y-gap="12">
          <n-grid-item>
            <n-statistic label="FCP" :value="metrics.fcp" suffix="ms" />
          </n-grid-item>
          <n-grid-item>
            <n-statistic label="LCP" :value="metrics.lcp" suffix="ms" />
          </n-grid-item>
          <n-grid-item>
            <n-statistic label="FID" :value="metrics.fid" suffix="ms" />
          </n-grid-item>
          <n-grid-item>
            <n-statistic label="CLS" :value="metrics.cls" :precision="3" />
          </n-grid-item>
        </n-grid>

        <!-- 分隔线 -->
        <n-divider />

        <!-- 资源指标 -->
        <n-grid cols="2 s:3" responsive="screen" :x-gap="12" :y-gap="12">
          <n-grid-item>
            <n-statistic
              label="内存使用"
              :value="formatBytes(metrics.memoryUsage || 0)"
              :value-style="{ color: memoryColor }"
            />
          </n-grid-item>
          <n-grid-item>
            <n-statistic
              label="帧率"
              :value="metrics.frameRate"
              suffix="fps"
              :value-style="{ color: frameRateColor }"
            />
          </n-grid-item>
          <n-grid-item>
            <n-statistic label="资源数量" :value="metrics.resourceCount" />
          </n-grid-item>
          <n-grid-item>
            <n-statistic label="慢资源" :value="metrics.slowResources" />
          </n-grid-item>
        </n-grid>

        <!-- 网络指标 -->
        <n-descriptions title="网络信息" size="small" :column="2">
          <n-descriptions-item label="连接类型">
            {{ metrics.connectionType }}
          </n-descriptions-item>
          <n-descriptions-item label="带宽">
            {{ metrics.effectiveBandwidth }} Mbps
          </n-descriptions-item>
          <n-descriptions-item label="延迟">
            {{ metrics.rtt }} ms
          </n-descriptions-item>
          <n-descriptions-item label="API响应时间">
            {{ metrics.apiResponseTime }} ms
          </n-descriptions-item>
        </n-descriptions>

        <!-- 错误统计 -->
        <n-alert v-if="hasErrors" type="warning" title="检测到错误">
          <n-space>
            <span>错误: {{ metrics.errorCount }}</span>
            <span>警告: {{ metrics.warningCount }}</span>
          </n-space>
        </n-alert>

        <!-- 自定义指标 -->
        <n-collapse>
          <n-collapse-item title="自定义指标">
            <n-space vertical size="small">
              <n-statistic label="消息渲染时间" :value="metrics.messageRenderTime" suffix="ms" />
              <n-statistic label="同步持续时间" :value="metrics.syncDuration" suffix="ms" />
            </n-space>
          </n-collapse-item>
        </n-collapse>

        <!-- 操作按钮 -->
        <n-space>
          <n-button size="small" @click="refresh">刷新</n-button>
          <n-button size="small" @click="exportData">导出数据</n-button>
          <n-button size="small" type="error" @click="clearData">清除数据</n-button>
        </n-space>
      </n-space>
    </n-card>

    <!-- 图表对话框 -->
    <n-modal v-model:show="showChart" preset="card" class="chart-modal" title="性能趋势图">
      <div ref="chartRef" class="chart-container"></div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { usePerformanceMonitor } from '@/utils/extended-performance-monitor'
import type { PerformanceMetrics } from '@/utils/extended-performance-monitor'

const perfMonitor = usePerformanceMonitor()
const metrics = ref<PerformanceMetrics>({
  fcp: 0,
  lcp: 0,
  fid: 0,
  ttfb: 0,
  cls: 0,
  domContentLoaded: 0,
  loadComplete: 0,
  firstPaint: 0,
  firstContentfulPaint: 0,
  resourceCount: 0,
  totalResourceSize: 0,
  slowResources: 0,
  memoryUsage: 0,
  memoryLimit: 0,
  memoryPressure: 'low',
  frameRate: 0,
  droppedFrames: 0,
  connectionType: 'unknown',
  effectiveBandwidth: 0,
  rtt: 0,
  errorCount: 0,
  warningCount: 0,
  apiResponseTime: 0,
  messageRenderTime: 0,
  syncDuration: 0,
  timestamp: Date.now()
})

let updateTimer: number

// 计算属性
const hasErrors = computed(() => (metrics.value.errorCount || 0) > 0 || (metrics.value.warningCount || 0) > 0)

const memoryColor = computed(() => {
  const pressure = metrics.value.memoryPressure
  if (pressure === 'high') return 'var(--error-color)'
  if (pressure === 'medium') return 'var(--warning-color)'
  return 'var(--success-color)'
})

const frameRateColor = computed(() => {
  const fps = metrics.value.frameRate || 0
  if (fps < 30) return 'var(--error-color)'
  if (fps < 50) return 'var(--warning-color)'
  return 'var(--success-color)'
})

// 图表相关
const showChart = ref(false)
const chartRef = ref<HTMLElement>()

// 刷新数据
const refresh = () => {
  metrics.value = { ...metrics.value, ...perfMonitor.getMetrics() }
}

// 格式化字节
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`
}

// 导出数据
const exportData = () => {
  const data = {
    timestamp: Date.now(),
    metrics: metrics.value,
    userAgent: navigator.userAgent,
    url: window.location.href
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `performance-metrics-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// 清除数据
const clearData = () => {
  // Clear performance entries
  if ('performance' in window && 'clearResourceTimings' in performance) {
    performance.clearResourceTimings()
  }

  // Refresh metrics
  refresh()
}

// 生命周期
onMounted(() => {
  // 初始加载
  refresh()

  // 定期更新
  updateTimer = window.setInterval(refresh, 5000)
})

onUnmounted(() => {
  if (updateTimer) {
    clearInterval(updateTimer)
  }
})
</script>

<style scoped lang="scss">
.performance-monitor {
  :deep(.n-statistic .n-statistic-value .n-statistic-value__content) {
    font-size: 18px;
  }

  :deep(.n-descriptions) {
    .n-descriptions-table-content {
      font-weight: 500;
    }
  }

  .chart-modal {
    width: 800px;
  }

  .chart-container {
    height: 400px;
  }
}
</style>
