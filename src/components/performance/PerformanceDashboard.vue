<template>
  <div class="performance-dashboard">
    <!-- 头部概览 -->
    <div class="dashboard-header">
      <div class="overview-cards">
        <div class="overview-card">
          <div class="card-icon">📊</div>
          <div class="card-content">
            <div class="card-title">总指标数</div>
            <div class="card-value">{{ dashboard?.overview.totalMetrics || 0 }}</div>
          </div>
        </div>

        <div class="overview-card">
          <div class="card-icon">⚡</div>
          <div class="card-content">
            <div class="card-title">活跃分类</div>
            <div class="card-value">{{ dashboard?.overview.activeCategories || 0 }}</div>
          </div>
        </div>

        <div class="overview-card">
          <div class="card-icon">🚨</div>
          <div class="card-content">
            <div class="card-title">活跃警报</div>
            <div class="card-value">{{ activeAlerts.length }}</div>
          </div>
        </div>

        <div class="overview-card health-card">
          <div class="card-icon">❤️</div>
          <div class="card-content">
            <div class="card-title">健康评分</div>
            <div class="card-value" :class="healthScoreClass">{{ healthScore }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 性能指标 -->
    <div class="performance-sections">
      <!-- 搜索性能 -->
      <div class="performance-section">
        <h3 class="section-title">
          <span class="section-icon">🔍</span>
          搜索性能
        </h3>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">平均查询时间</div>
            <div class="metric-value">{{ dashboard?.performance.search.avgQueryTime.toFixed(1) || 0 }}ms</div>
            <div class="metric-status" :class="getMetricStatus('search', 'queryTime')">
              {{ getMetricStatusText('search', 'queryTime') }}
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-label">缓存命中率</div>
            <div class="metric-value">{{ dashboard?.performance.search.cacheHitRate.toFixed(1) || 100 }}%</div>
            <div class="metric-status" :class="getMetricStatus('search', 'cacheHitRate')">
              {{ getMetricStatusText('search', 'cacheHitRate') }}
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-label">成功率</div>
            <div class="metric-value">{{ dashboard?.performance.search.successRate.toFixed(1) || 100 }}%</div>
            <div class="metric-status success">良好</div>
          </div>
        </div>
      </div>

      <!-- RTC性能 -->
      <div class="performance-section">
        <h3 class="section-title">
          <span class="section-icon">📹</span>
          RTC性能
        </h3>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">平均连接时间</div>
            <div class="metric-value">{{ dashboard?.performance.rtc.avgConnectionTime.toFixed(1) || 0 }}ms</div>
            <div class="metric-status" :class="getMetricStatus('rtc', 'connectionTime')">
              {{ getMetricStatusText('rtc', 'connectionTime') }}
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-label">通话质量</div>
            <div class="metric-value">{{ dashboard?.performance.rtc.callQuality.toFixed(1) || 100 }}%</div>
            <div class="metric-status success">优秀</div>
          </div>

          <div class="metric-card">
            <div class="metric-label">丢包率</div>
            <div class="metric-value">{{ dashboard?.performance.rtc.packetLossRate.toFixed(2) || 0 }}%</div>
            <div class="metric-status" :class="getMetricStatus('rtc', 'packetLossRate')">
              {{ getMetricStatusText('rtc', 'packetLossRate') }}
            </div>
          </div>
        </div>
      </div>

      <!-- 反应性能 -->
      <div class="performance-section">
        <h3 class="section-title">
          <span class="section-icon">😊</span>
          反应性能
        </h3>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">平均更新时间</div>
            <div class="metric-value">{{ dashboard?.performance.reactions.avgUpdateTime.toFixed(1) || 0 }}ms</div>
            <div class="metric-status" :class="getMetricStatus('reactions', 'updateTime')">
              {{ getMetricStatusText('reactions', 'updateTime') }}
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-label">同步率</div>
            <div class="metric-value">{{ dashboard?.performance.reactions.syncRate.toFixed(1) || 100 }}%</div>
            <div class="metric-status success">良好</div>
          </div>

          <div class="metric-card">
            <div class="metric-label">错误率</div>
            <div class="metric-value">{{ dashboard?.performance.reactions.errorRate.toFixed(2) || 0 }}%</div>
            <div class="metric-status success">正常</div>
          </div>
        </div>
      </div>

      <!-- 推送性能 -->
      <div class="performance-section">
        <h3 class="section-title">
          <span class="section-icon">📬</span>
          推送性能
        </h3>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">平均处理时间</div>
            <div class="metric-value">{{ dashboard?.performance.push.avgProcessingTime.toFixed(1) || 0 }}ms</div>
            <div class="metric-status" :class="getMetricStatus('push', 'processingTime')">
              {{ getMetricStatusText('push', 'processingTime') }}
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-label">送达率</div>
            <div class="metric-value">{{ dashboard?.performance.push.deliveryRate.toFixed(1) || 100 }}%</div>
            <div class="metric-status success">优秀</div>
          </div>

          <div class="metric-card">
            <div class="metric-label">策略加载时间</div>
            <div class="metric-value">{{ dashboard?.performance.push.policyLoadTime.toFixed(1) || 0 }}ms</div>
            <div class="metric-status success">良好</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 警报面板 -->
    <div class="alerts-section" v-if="activeAlerts.length > 0">
      <h3 class="section-title">
        <span class="section-icon">🚨</span>
        活跃警报
      </h3>
      <div class="alerts-list">
        <div v-for="alert in activeAlerts" :key="alert.id" class="alert-item" :class="`alert-${alert.type}`">
          <div class="alert-content">
            <div class="alert-title">{{ alert.message }}</div>
            <div class="alert-details">
              <span class="alert-category">{{ alert.category }}</span>
              <span class="alert-separator">•</span>
              <span class="alert-metric">{{ alert.metric }}</span>
              <span class="alert-separator">•</span>
              <span class="alert-value">{{ alert.currentValue.toFixed(1) }}</span>
              <span class="alert-separator">•</span>
              <span class="alert-threshold">{{ alert.threshold.toFixed(1) }}</span>
            </div>
          </div>
          <div class="alert-actions">
            <button @click="acknowledgeAlert(alert.id)" class="btn-acknowledge">确认</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="dashboard-actions">
      <button @click="refreshDashboard" class="btn-refresh" :disabled="loading">
        {{ loading ? '刷新中...' : '刷新数据' }}
      </button>
      <button @click="exportMetrics" class="btn-export">导出数据</button>
      <button @click="openSettings" class="btn-settings">设置</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useMetricsStore } from '@/stores/metrics'

const metricsStore = useMetricsStore()

// 计算属性
const dashboard = computed(() => metricsStore.dashboard)
const loading = computed(() => metricsStore.loading)
const activeAlerts = computed(() => metricsStore.activeAlerts)
const healthScore = computed(() => metricsStore.healthScore)
const performanceThresholds = computed(() => metricsStore.performanceThresholds)

const healthScoreClass = computed(() => {
  const score = healthScore.value
  if (score >= 90) return 'health-excellent'
  if (score >= 70) return 'health-good'
  if (score >= 50) return 'health-warning'
  return 'health-critical'
})

// 方法
const refreshDashboard = async () => {
  await metricsStore.updateDashboard()
}

const exportMetrics = () => {
  const data = metricsStore.exportMetrics()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `performance-metrics-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const acknowledgeAlert = (alertId: string) => {
  metricsStore.acknowledgeAlert(alertId)
}

const openSettings = () => {
  // 打开设置对话框的逻辑
}

const getMetricStatus = (category: string, metric: string) => {
  if (!dashboard.value) return 'unknown'

  const thresholds = performanceThresholds.value[category as keyof typeof performanceThresholds.value]
  if (!thresholds) return 'unknown'

  const categoryData = dashboard.value.performance[category as keyof typeof dashboard.value.performance]
  if (!categoryData) return 'unknown'

  // 类型安全地获取metric值
  const value = Number((categoryData as Record<string, number>)[metric] ?? 0)
  const threshold = Number(thresholds[metric as keyof typeof thresholds] ?? 0)

  if (category === 'search' && metric === 'cacheHitRate') {
    return value >= threshold ? 'success' : 'warning'
  }

  if (category === 'rtc' && metric === 'packetLossRate') {
    return value <= threshold ? 'success' : 'warning'
  }

  return value <= threshold ? 'success' : 'warning'
}

const getMetricStatusText = (category: string, metric: string) => {
  const status = getMetricStatus(category, metric)
  const statusTexts = {
    success: '正常',
    warning: '警告',
    error: '错误',
    unknown: '未知'
  }
  return statusTexts[status as keyof typeof statusTexts] || '未知'
}

// 生命周期
onMounted(() => {
  metricsStore.initialize()
})

onUnmounted(() => {
  // 清理定时器等
})
</script>

<style scoped>
.performance-dashboard {
  padding: 20px;
  background: var(--bg-color);
  border-radius: 12px;
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  margin-bottom: 32px;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.overview-card {
  display: flex;
  align-items: center;
  padding: 20px;
  background: var(--card-bg);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.overview-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(var(--hula-black-rgb), 0.1);
}

.card-icon {
  font-size: 24px;
  margin-right: 16px;
}

.card-content {
  flex: 1;
}

.card-title {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.card-value {
  font-size: 24px;
  font-weight: bold;
  color: var(--text-primary);
}

.health-card .card-value.health-excellent {
  color: var(--hula-brand-primary);
}

.health-card .card-value.health-good {
  color: var(--hula-brand-primary);
}

.health-card .card-value.health-warning {
  color: var(--hula-brand-primary);
}

.health-card .card-value.health-critical {
  color: var(--hula-brand-primary);
}

.performance-sections {
  margin-bottom: 32px;
}

.performance-section {
  margin-bottom: 32px;
}

.section-title {
  display: flex;
  align-items: center;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.section-icon {
  margin-right: 8px;
  font-size: 20px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.metric-card {
  padding: 20px;
  background: var(--card-bg);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(var(--hula-black-rgb), 0.1);
}

.metric-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.metric-value {
  font-size: 20px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.metric-status {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
}

.metric-status.success {
  background: var(--hula-brand-primary);
  color: var(--hula-brand-primary);
  border: 1px solid var(--hula-brand-primary);
}

.metric-status.warning {
  background: var(--hula-brand-primary);
  color: var(--hula-brand-primary);
  border: 1px solid var(--hula-brand-primary);
}

.metric-status.error {
  background: var(--hula-brand-primary);
  color: var(--hula-brand-primary);
  border: 1px solid var(--hula-brand-primary);
}

.alerts-section {
  margin-bottom: 32px;
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.alert-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
}

.alert-item.alert-warning {
  border-left-color: var(--hula-brand-primary);
  background: var(--hula-brand-primary);
}

.alert-item.alert-error {
  border-left-color: var(--hula-brand-primary);
  background: var(--hula-brand-primary);
}

.alert-content {
  flex: 1;
}

.alert-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.alert-details {
  font-size: 12px;
  color: var(--text-secondary);
}

.alert-category {
  font-weight: 500;
}

.alert-separator {
  margin: 0 4px;
}

.alert-value {
  font-weight: bold;
  color: var(--text-primary);
}

.alert-threshold {
  font-weight: bold;
  color: var(--text-secondary);
}

.alert-actions {
  margin-left: 16px;
}

.btn-acknowledge {
  padding: 6px 12px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s;
}

.btn-acknowledge:hover {
  background: var(--primary-hover);
}

.dashboard-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn-refresh,
.btn-export,
.btn-settings {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-refresh {
  background: var(--primary-color);
  color: white;
}

.btn-refresh:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-export {
  background: var(--success-color);
  color: white;
}

.btn-export:hover {
  background: var(--success-hover);
}

.btn-settings {
  background: var(--secondary-color);
  color: white;
}

.btn-settings:hover {
  background: var(--secondary-hover);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .performance-dashboard {
    padding: 16px;
  }

  .overview-cards {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .dashboard-actions {
    flex-direction: column;
  }

  .btn-refresh,
  .btn-export,
  .btn-settings {
    width: 100%;
  }
}
</style>
