<!-- Migration Monitor Panel - Phase 4: WebSocket 迁移监控面板 -->
<template>
  <div class="migration-monitor-panel">
    <div class="panel-header">
      <h3>Phase 4 迁移监控</h3>
      <div class="status-badge" :class="statusClass">
        {{ statusDescription }}
      </div>
    </div>

    <!-- 迁移进度 -->
    <div class="section">
      <div class="section-title">迁移进度</div>
      <div class="progress-card">
        <div class="progress-bar-container">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${stats.migrationProgress}%` }"></div>
          </div>
          <span class="progress-text">{{ stats.migrationProgress.toFixed(1) }}%</span>
        </div>
        <div class="progress-stats">
          <div class="stat">
            <span class="stat-label">总消息数</span>
            <span class="stat-value">{{ stats.totalMessages }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">错误率</span>
            <span class="stat-value" :class="{ error: stats.errorRate > 1 }">
              {{ stats.errorRate.toFixed(2) }}%
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 路由分布 -->
    <div class="section">
      <div class="section-title">路由分布</div>
      <div class="route-distribution">
        <div class="route-item">
          <div class="route-header">
            <span class="route-name">Matrix SDK</span>
            <span class="route-count">{{ stats.messageRoutes.matrix }}</span>
          </div>
          <div class="route-bar">
            <div class="route-fill matrix" :style="{ width: `${getPercentage(stats.messageRoutes.matrix)}%` }"></div>
          </div>
        </div>
        <div class="route-item">
          <div class="route-header">
            <span class="route-name">WebSocket</span>
            <span class="route-count">{{ stats.messageRoutes.websocket }}</span>
          </div>
          <div class="route-bar">
            <div class="route-fill websocket" :style="{ width: `${getPercentage(stats.messageRoutes.websocket)}%` }"></div>
          </div>
        </div>
        <div class="route-item">
          <div class="route-header">
            <span class="route-name">混合模式</span>
            <span class="route-count">{{ stats.messageRoutes.hybrid }}</span>
          </div>
          <div class="route-bar">
            <div class="route-fill hybrid" :style="{ width: `${getPercentage(stats.messageRoutes.hybrid)}%` }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 性能指标 -->
    <div class="section">
      <div class="section-title">性能指标 (平均延迟)</div>
      <div class="performance-grid">
        <div class="perf-card">
          <span class="perf-label">Matrix SDK</span>
          <span class="perf-value">{{ stats.averageLatency.matrix.toFixed(0) }}ms</span>
        </div>
        <div class="perf-card">
          <span class="perf-label">WebSocket</span>
          <span class="perf-value">{{ stats.averageLatency.websocket.toFixed(0) }}ms</span>
        </div>
        <div class="perf-card">
          <span class="perf-label">混合模式</span>
          <span class="perf-value">{{ stats.averageLatency.hybrid.toFixed(0) }}ms</span>
        </div>
      </div>
    </div>

    <!-- 详细报告 -->
    <div class="section" v-if="showDetailed">
      <div class="section-title">详细报告</div>
      <div class="detailed-report">
        <div class="report-section">
          <h4>百分位数延迟</h4>
          <div class="percentile-table">
            <div class="percentile-row header">
              <span>指标</span>
              <span>p50</span>
              <span>p95</span>
              <span>p99</span>
            </div>
            <div class="percentile-row">
              <span>Matrix</span>
              <span>{{ detailedReport.percentiles.p50.matrix.toFixed(0) }}ms</span>
              <span>{{ detailedReport.percentiles.p95.matrix.toFixed(0) }}ms</span>
              <span>{{ detailedReport.percentiles.p99.matrix.toFixed(0) }}ms</span>
            </div>
            <div class="percentile-row">
              <span>WebSocket</span>
              <span>{{ detailedReport.percentiles.p50.websocket.toFixed(0) }}ms</span>
              <span>{{ detailedReport.percentiles.p95.websocket.toFixed(0) }}ms</span>
              <span>{{ detailedReport.percentiles.p99.websocket.toFixed(0) }}ms</span>
            </div>
          </div>
        </div>

        <div class="report-section" v-if="detailedReport.recommendations.length > 0">
          <h4>优化建议</h4>
          <ul class="recommendations">
            <li v-for="(rec, i) in detailedReport.recommendations" :key="i">{{ rec }}</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 控制按钮 -->
    <div class="actions">
      <button class="action-btn" @click="showDetailed = !showDetailed">
        {{ showDetailed ? '隐藏详细报告' : '显示详细报告' }}
      </button>
      <button class="action-btn primary" @click="refreshData">
        刷新数据
      </button>
      <button class="action-btn" @click="copyReport">
        复制报告
      </button>
      <button class="action-btn" @click="exportJSON">
        导出 JSON
      </button>
      <button class="action-btn" @click="exportCSV">
        导出 CSV
      </button>
      <button class="action-btn" @click="triggerFileInput">
        导入数据
      </button>
      <input
        ref="fileInput"
        type="file"
        accept=".json"
        class="hidden-input"
        @change="importFile"
      />
      <button class="action-btn danger" @click="resetStats" :disabled="stats.totalMessages === 0">
        重置统计
      </button>
    </div>

    <!-- 功能开关控制 -->
    <div class="section">
      <div class="section-title">功能开关控制</div>
      <div class="flags-control">
        <div class="flag-item">
          <label>
            <input type="checkbox" v-model="matrixFirstRouting" @change="toggleMatrixFirst">
            <span>MATRIX_FIRST_ROUTING (Matrix SDK 优先)</span>
          </label>
          <span class="flag-status" :class="{ enabled: matrixFirstRouting }">
            {{ matrixFirstRouting ? '启用' : '禁用' }}
          </span>
        </div>
        <div class="flag-item">
          <label>
            <input type="checkbox" v-model="disableWebSocket" @change="toggleWebSocket">
            <span>DISABLE_WEBSOCKET (禁用 WebSocket)</span>
          </label>
          <span class="flag-status" :class="{ enabled: disableWebSocket }">
            {{ disableWebSocket ? '启用' : '禁用' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getMigrationStats, getMigrationReport, resetMigrationStats, migrationMonitor } from '@/utils/migrationMonitor'
import { featureFlags } from '@/config/feature-flags'
import { logger } from '@/utils/logger'

const showDetailed = ref(false)
const stats = ref(getMigrationStats())
const detailedReport = ref(getMigrationReport())
const matrixFirstRouting = ref(featureFlags.isEnabled('MATRIX_FIRST_ROUTING'))
const disableWebSocket = ref(featureFlags.isEnabled('DISABLE_WEBSOCKET'))
const fileInput = ref<HTMLInputElement | null>(null)

let refreshInterval: number | null = null

// 计算状态描述
const statusDescription = computed(() => {
  const progress = stats.value.migrationProgress
  if (progress >= 95) return '迁移完成'
  if (progress >= 75) return '迁移后期'
  if (progress >= 50) return '迁移中期'
  if (progress >= 25) return '迁移初期'
  return '未开始'
})

// 计算状态样式类
const statusClass = computed(() => {
  const progress = stats.value.migrationProgress
  if (progress >= 95) return 'completed'
  if (progress >= 50) return 'in-progress'
  return 'early'
})

// 计算百分比
const getPercentage = (count: number) => {
  const total = stats.value.totalMessages
  if (total === 0) return 0
  return (count / total) * 100
}

// 刷新数据
const refreshData = () => {
  stats.value = getMigrationStats()
  detailedReport.value = getMigrationReport()
  matrixFirstRouting.value = featureFlags.isEnabled('MATRIX_FIRST_ROUTING')
  disableWebSocket.value = featureFlags.isEnabled('DISABLE_WEBSOCKET')
}

// 切换 Matrix 优先路由
const toggleMatrixFirst = () => {
  featureFlags.updateFlag('MATRIX_FIRST_ROUTING', { enabled: matrixFirstRouting.value })
  featureFlags.saveToStorage()
  logger.debug('[MigrationMonitor] MATRIX_FIRST_ROUTING set to:', matrixFirstRouting.value)
  // 需要重新初始化适配器才能生效
  alert('MATRIX_FIRST_ROUTING 已更新。重新加载应用以生效。')
}

// 切换 WebSocket 禁用
const toggleWebSocket = () => {
  featureFlags.updateFlag('DISABLE_WEBSOCKET', { enabled: disableWebSocket.value })
  featureFlags.saveToStorage()
  logger.debug('[MigrationMonitor] DISABLE_WEBSOCKET set to:', disableWebSocket.value)
  // 需要重新初始化适配器才能生效
  alert('DISABLE_WEBSOCKET 已更新。重新加载应用以生效。')
}

// 复制报告
const copyReport = () => {
  const report = {
    timestamp: new Date().toISOString(),
    stats: stats.value,
    detailed: detailedReport.value,
    flags: {
      MATRIX_FIRST_ROUTING: matrixFirstRouting.value,
      DISABLE_WEBSOCKET: disableWebSocket.value
    }
  }
  const text = JSON.stringify(report, null, 2)
  navigator.clipboard.writeText(text).then(() => {
    alert('迁移报告已复制到剪贴板')
  })
}

// 重置统计
const resetStats = () => {
  if (confirm('确定要重置所有迁移统计数据吗？此操作不可撤销。')) {
    resetMigrationStats()
    refreshData()
  }
}

// 导出 JSON
const exportJSON = () => {
  try {
    migrationMonitor.exportToFile()
    alert('迁移报告已导出为 JSON 文件')
  } catch (error) {
    alert('导出失败: ' + (error instanceof Error ? error.message : String(error)))
  }
}

// 导出 CSV
const exportCSV = () => {
  try {
    migrationMonitor.exportToCSVFile()
    alert('迁移报告已导出为 CSV 文件')
  } catch (error) {
    alert('导出失败: ' + (error instanceof Error ? error.message : String(error)))
  }
}

// 导入数据
const importFile = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  migrationMonitor
    .importFromFile(file)
    .then((importedStats) => {
      refreshData()
      alert(`数据导入成功！导入了 ${importedStats.totalMessages} 条记录`)
    })
    .catch((error) => {
      alert('导入失败: ' + (error instanceof Error ? error.message : String(error)))
    })
    .finally(() => {
      // 清空文件选择，允许重复导入同一文件
      target.value = ''
    })
}

// 触发文件选择
const triggerFileInput = () => {
  fileInput.value?.click()
}

// 定期刷新
onMounted(() => {
  refreshData()
  refreshInterval = window.setInterval(refreshData, 5000) // 每 5 秒刷新一次
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped lang="scss">
.migration-monitor-panel {
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg-color, var(--hula-white));
  border-radius: 8px;
  max-width: 600px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;

  &.completed {
    background: var(--hula-brand-primary);
    color: var(--hula-brand-primary);
  }

  &.in-progress {
    background: var(--hula-brand-primary);
    color: var(--hula-brand-primary);
  }

  &.early {
    background: var(--hula-brand-primary);
    color: var(--hula-brand-primary);
  }
}

.section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color-2, var(--hula-gray-700));
  margin-bottom: 12px;
}

.progress-card {
  background: var(--bg-color-soft, var(--hula-brand-primary));
  border-radius: 8px;
  padding: 16px;
}

.progress-bar-container {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--hula-brand-primary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--hula-brand-primary), var(--hula-brand-primary));
  transition: width 0.3s ease;
}

.progress-text {
  font-weight: 600;
  font-size: 16px;
}

.progress-stats {
  display: flex;
  gap: 24px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-color-3, var(--hula-gray-400));
}

.stat-value {
  font-size: 18px;
  font-weight: 600;

  &.error {
    color: var(--hula-brand-primary);
  }
}

.route-distribution {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.route-item {
  background: var(--bg-color-soft, var(--hula-brand-primary));
  border-radius: 8px;
  padding: 12px;
}

.route-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.route-bar {
  height: 6px;
  background: var(--hula-brand-primary);
  border-radius: 3px;
  overflow: hidden;
}

.route-fill {
  height: 100%;
  transition: width 0.3s ease;

  &.matrix {
    background: var(--hula-brand-primary);
  }

  &.websocket {
    background: var(--hula-brand-primary);
  }

  &.hybrid {
    background: var(--hula-brand-primary);
  }
}

.performance-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.perf-card {
  background: var(--bg-color-soft, var(--hula-brand-primary));
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.perf-label {
  font-size: 12px;
  color: var(--text-color-3, var(--hula-gray-400));
}

.perf-value {
  font-size: 20px;
  font-weight: 600;
}

.detailed-report {
  background: var(--bg-color-soft, var(--hula-brand-primary));
  border-radius: 8px;
  padding: 16px;
}

.report-section {
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }

  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
  }
}

.percentile-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.percentile-row {
  display: grid;
  grid-template-columns: 1fr repeat(3, 80px);
  gap: 8px;
  font-size: 13px;

  &.header {
    font-weight: 600;
    color: var(--text-color-2, var(--hula-gray-700));
  }

  span {
    text-align: center;
  }

  span:first-child {
    text-align: left;
  }
}

.recommendations {
  margin: 0;
  padding-left: 20px;

  li {
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--text-color-1, var(--hula-gray-900));
  }
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.action-btn {
  padding: 8px 16px;
  border: 1px solid var(--hula-brand-primary);
  border-radius: 4px;
  background: var(--hula-white);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    border-color: var(--hula-brand-primary);
    color: var(--hula-brand-primary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.primary {
    background: var(--hula-brand-primary);
    border-color: var(--hula-brand-primary);
    color: var(--hula-white);

    &:hover:not(:disabled) {
      background: var(--hula-brand-primary);
      border-color: var(--hula-brand-primary);
      color: var(--hula-white);
    }
  }

  &.danger {
    border-color: var(--hula-brand-primary);
    color: var(--hula-brand-primary);

    &:hover:not(:disabled) {
      background: var(--hula-brand-primary);
      color: var(--hula-white);
    }
  }
}

.flags-control {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.flag-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--bg-color-soft, var(--hula-brand-primary));
  border-radius: 8px;

  label {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    cursor: pointer;

    input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }

    span {
      font-size: 13px;
    }
  }
}

.flag-status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;

  &.enabled {
    background: var(--hula-brand-primary);
    color: var(--hula-brand-primary);
  }

  &:not(.enabled) {
    background: var(--hula-brand-primary);
    color: var(--hula-gray-400);
  }
}

.hidden-input {
  display: none;
}
</style>
