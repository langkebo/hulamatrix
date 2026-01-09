<!-- Performance Panel - Mobile performance monitoring and testing -->
<template>
  <div class="performance-panel">
    <n-card :bordered="false" class="panel-card">
      <!-- Header -->
      <template #header>
        <div class="card-header">
          <n-icon :size="24">
            <Activity />
          </n-icon>
          <div class="header-text">
            <h3>性能监控</h3>
            <p>实时性能指标和测试工具</p>
          </div>
        </div>
      </template>

      <!-- Toggle Monitoring -->
      <div class="monitor-toggle">
        <n-button :type="isMonitoring ? 'error' : 'primary'" size="large" block @click="toggleMonitoring">
          <template #icon>
            <n-icon>
              <Activity v-if="!isMonitoring" />
              <Flame v-else />
            </n-icon>
          </template>
          {{ isMonitoring ? '停止监控' : '开始监控' }}
        </n-button>
      </div>

      <!-- Metrics Display -->
      <div v-if="isMonitoring || hasMetrics" class="metrics-grid">
        <!-- FPS -->
        <div class="metric-card" :class="getMetricClass('fps', metrics.fps)">
          <div class="metric-icon">
            <n-icon :size="28">
              <Gauge />
            </n-icon>
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ metrics.fps }}</div>
            <div class="metric-label">FPS</div>
          </div>
        </div>

        <!-- Memory -->
        <div class="metric-card" :class="getMemoryClass()">
          <div class="metric-icon">
            <n-icon :size="28">
              <Cpu />
            </n-icon>
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ memoryUsage }}</div>
            <div class="metric-label">内存</div>
          </div>
        </div>

        <!-- Network -->
        <div class="metric-card" :class="getMetricClass('latency', metrics.networkLatency)">
          <div class="metric-icon">
            <n-icon :size="28">
              <Wifi />
            </n-icon>
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ networkLatency }}</div>
            <div class="metric-label">延迟</div>
          </div>
        </div>
      </div>

      <!-- Performance Issues -->
      <div v-if="issues.length > 0" class="issues-section">
        <div class="section-title">
          <n-icon :size="18"><AlertTriangle /></n-icon>
          <span>性能问题</span>
        </div>
        <div class="issues-list">
          <div v-for="(issue, index) in issues" :key="index" class="issue-item" :class="issue.severity">
            <n-icon :size="16">
              <AlertCircle v-if="issue.severity === 'error'" />
              <AlertTriangle v-else-if="issue.severity === 'warning'" />
              <Flame v-else />
            </n-icon>
            <span class="issue-message">{{ issue.message }}</span>
          </div>
        </div>
      </div>

      <!-- Benchmark Tests -->
      <div class="benchmark-section">
        <div class="section-title">
          <n-icon :size="18"><Gauge /></n-icon>
          <span>性能测试</span>
        </div>

        <div class="benchmark-grid">
          <n-button :loading="isRunningBenchmark.render" @click="runRenderBenchmark">
            <template #icon>
              <n-icon><Layout /></n-icon>
            </template>
            渲染测试
          </n-button>

          <n-button :loading="isRunningBenchmark.network" @click="runNetworkBenchmark">
            <template #icon>
              <n-icon><Wifi /></n-icon>
            </template>
            网络测试
          </n-button>

          <n-button :loading="isRunningBenchmark.memory" @click="runMemoryBenchmark">
            <template #icon>
              <n-icon><Database /></n-icon>
            </template>
            内存测试
          </n-button>

          <n-button @click="showSlowComponents = true">
            <template #icon>
              <n-icon><List /></n-icon>
            </template>
            慢组件
          </n-button>
        </div>
      </div>

      <!-- Slow Components Modal -->
      <n-modal v-model:show="showSlowComponents" preset="card" title="慢速组件分析" class="w-90-max-w-400px">
        <div v-if="slowComponents.length === 0" class="empty-state">
          <n-icon :size="48" color="var(--hula-success)">
            <Check />
          </n-icon>
          <p>所有组件渲染速度正常</p>
        </div>

        <div v-else class="slow-components-list">
          <div v-for="(component, index) in slowComponents" :key="index" class="component-item">
            <div class="component-header">
              <span class="component-name">{{ component.name }}</span>
              <span class="component-time">{{ component.avgRenderTime.toFixed(2) }}ms</span>
            </div>
            <div class="component-details">
              <span>渲染次数: {{ component.renderCount }}</span>
              <span>最大: {{ component.maxRenderTime.toFixed(2) }}ms</span>
            </div>
          </div>
        </div>

        <template #footer>
          <n-button block @click="showSlowComponents = false">关闭</n-button>
        </template>
      </n-modal>

      <!-- Report Modal -->
      <n-modal v-model:show="showReport" preset="card" title="性能报告" class="w-90-max-w-500px">
        <pre class="report-content">{{ reportContent }}</pre>

        <template #footer>
          <n-space vertical style="width: 100%">
            <n-button type="primary" block @click="copyReport">
              <template #icon>
                <n-icon><Copy /></n-icon>
              </template>
              复制报告
            </n-button>
            <n-button block @click="showReport = false">关闭</n-button>
          </n-space>
        </template>
      </n-modal>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { NCard, NIcon, NButton, NModal, NSpace, useDialog } from 'naive-ui'
import {
  Activity,
  Gauge,
  Cpu,
  AlertTriangle,
  AlertCircle,
  Flame,
  Layout,
  Wifi,
  Database,
  List,
  Check,
  Copy
} from '@vicons/tabler'
import { usePerformanceMonitor, type PerformanceIssue } from '@/utils/performanceMonitor'
import { msg } from '@/utils/SafeUI'

const {
  isMonitoring,
  metrics,
  startMonitoring,
  stopMonitoring,
  analyze,
  getReport,
  getSlowComponents,
  measureNetworkLatency
} = usePerformanceMonitor()

const showSlowComponents = ref(false)
const showReport = ref(false)
const hasMetrics = ref(false)
const issues = ref<PerformanceIssue[]>([])

const isRunningBenchmark = ref({
  render: false,
  network: false,
  memory: false
})

const slowComponents = computed(() => getSlowComponents())

const reportContent = computed(() => getReport())

const memoryUsage = computed(() => {
  if (!metrics.value.memory) return 'N/A'
  const mb = metrics.value.memory.used / (1024 * 1024)
  return `${mb.toFixed(1)}MB`
})

const networkLatency = computed(() => {
  return `${metrics.value.networkLatency.toFixed(0)}ms`
})

// Update issues periodically
let issuesInterval: number | null = null

const updateIssues = () => {
  const report = analyze()
  issues.value = report.issues
  hasMetrics.value = true
}

const toggleMonitoring = () => {
  if (isMonitoring.value) {
    stopMonitoring()
    if (issuesInterval) {
      clearInterval(issuesInterval)
      issuesInterval = null
    }
  } else {
    startMonitoring()
    issuesInterval = window.setInterval(updateIssues, 2000) as unknown as number
  }
}

const getMetricClass = (type: string, value: number) => {
  if (type === 'fps') {
    if (value >= 55) return 'good'
    if (value >= 40) return 'warning'
    return 'danger'
  }
  if (type === 'latency') {
    if (value < 100) return 'good'
    if (value < 300) return 'warning'
    return 'danger'
  }
  return ''
}

const getMemoryClass = () => {
  if (!metrics.value.memory) return ''
  const percent = (metrics.value.memory.used / metrics.value.memory.limit) * 100
  if (percent < 60) return 'good'
  if (percent < 80) return 'warning'
  return 'danger'
}

const runRenderBenchmark = async () => {
  isRunningBenchmark.value.render = true

  try {
    // Simulate render test
    const start = performance.now()

    // Create and render many elements
    const container = document.createElement('div')
    for (let i = 0; i < 1000; i++) {
      const div = document.createElement('div')
      div.textContent = `Item ${i}`
      container.appendChild(div)
    }

    const end = performance.now()
    const duration = end - start

    msg.success(`渲染测试完成: ${duration.toFixed(2)}ms`)
  } catch (error) {
    msg.error('渲染测试失败')
  } finally {
    isRunningBenchmark.value.render = false
  }
}

const runNetworkBenchmark = async () => {
  isRunningBenchmark.value.network = true

  try {
    const latency = await measureNetworkLatency()

    if (latency >= 0) {
      msg.success(`网络延迟: ${latency.toFixed(0)}ms`)
    } else {
      msg.warning('网络测试失败 - 请检查连接')
    }
  } catch (error) {
    msg.error('网络测试失败')
  } finally {
    isRunningBenchmark.value.network = false
  }
}

const runMemoryBenchmark = async () => {
  isRunningBenchmark.value.memory = true

  try {
    const perf = performance as { memory?: { usedJSHeapSize: number } }
    const before = perf.memory?.usedJSHeapSize || 0

    // Allocate memory
    const arrays: number[][] = []
    for (let i = 0; i < 100; i++) {
      arrays.push(new Array(10000).fill(Math.random()))
    }

    const after = perf.memory?.usedJSHeapSize || 0
    const allocated = ((after - before) / (1024 * 1024)).toFixed(2)

    msg.success(`分配内存: ${allocated}MB`)

    // Cleanup
    arrays.length = 0
  } catch (error) {
    msg.error('内存测试失败')
  } finally {
    isRunningBenchmark.value.memory = false
  }
}

const copyReport = async () => {
  try {
    await navigator.clipboard.writeText(reportContent.value)
    msg.success('报告已复制到剪贴板')
  } catch {
    msg.error('复制失败')
  }
}

onUnmounted(() => {
  if (issuesInterval) {
    clearInterval(issuesInterval)
  }
})
</script>

<style scoped lang="scss">
.performance-panel {
  .panel-card {
    margin: 16px;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 12px;

    .header-text {
      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      p {
        margin: 4px 0 0 0;
        font-size: 13px;
        color: var(--text-color-3);
      }
    }
  }
}

.monitor-toggle {
  margin-bottom: 16px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;

  .metric-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 8px;
    background: var(--bg-color);
    border-radius: 12px;
    border: 1px solid transparent;

    &.good {
      background: rgba(var(--hula-success-rgb), 0.1);
      border-color: rgba(var(--hula-success-rgb), 0.3);
    }

    &.warning {
      background: rgba(var(--hula-warning-rgb), 0.1);
      border-color: rgba(var(--hula-warning-rgb), 0.3);
    }

    &.danger {
      background: rgba(var(--hula-error-rgb), 0.1);
      border-color: rgba(var(--hula-error-rgb), 0.3);
    }

    .metric-icon {
      margin-bottom: 8px;
      color: var(--text-color-1);
    }

    .metric-content {
      text-align: center;

      .metric-value {
        font-size: 20px;
        font-weight: 700;
        line-height: 1;
      }

      .metric-label {
        font-size: 11px;
        color: var(--text-color-3);
        margin-top: 4px;
      }
    }
  }
}

.issues-section {
  margin-bottom: 16px;

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
  }

  .issues-list {
    .issue-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: var(--bg-color);
      border-radius: 8px;
      margin-bottom: 6px;

      &.warning {
        background: rgba(var(--hula-warning-rgb), 0.1);
        color: var(--hula-warning);
      }

      &.error {
        background: rgba(var(--hula-error-rgb), 0.1);
        color: var(--hula-error);
      }

      &.critical {
        background: rgba(var(--hula-error-rgb), 0.15);
        color: var(--hula-error);
      }

      .issue-message {
        font-size: 13px;
        flex: 1;
      }
    }
  }
}

.benchmark-section {
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
  }

  .benchmark-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;

  p {
    margin-top: 16px;
    color: var(--text-color-2);
  }
}

.slow-components-list {
  .component-item {
    padding: 12px;
    background: var(--bg-color);
    border-radius: 8px;
    margin-bottom: 8px;

    .component-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;

      .component-name {
        font-weight: 600;
        font-size: 14px;
      }

      .component-time {
        font-size: 13px;
        color: var(--error-color);
      }
    }

    .component-details {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: var(--text-color-3);
    }
  }
}

.report-content {
  background: var(--bg-color);
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
