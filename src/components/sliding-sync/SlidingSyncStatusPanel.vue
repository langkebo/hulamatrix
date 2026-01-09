<!--
  SlidingSyncStatusPanel Component
  Display Sliding Sync status and diagnostics
-->
<template>
  <div class="sliding-sync-status-panel">
    <n-card title="Sliding Sync 状态" size="small">
      <template #header-extra>
        <n-switch v-model:value="enabled" :disabled="!canToggle" @update:value="handleToggle" />
      </template>

      <!-- Status Badge -->
      <div class="status-section">
        <div class="status-item">
          <span class="label">状态:</span>
          <n-tag :type="statusTagType" :bordered="false" size="small">
            {{ statusText }}
          </n-tag>
        </div>

        <div class="status-item">
          <span class="label">模式:</span>
          <n-tag :bordered="false" size="small">
            {{ syncModeText }}
          </n-tag>
        </div>
      </div>

      <!-- Connection Info -->
      <n-collapse v-if="showDetails">
        <n-collapse-item title="连接信息" name="connection">
          <div class="info-grid">
            <div class="info-item">
              <span class="label">代理 URL:</span>
              <span class="value">{{ proxyUrl || '未配置' }}</span>
            </div>
            <div class="info-item">
              <span class="label">生命周期:</span>
              <span class="value">{{ lifecycleState }}</span>
            </div>
            <div class="info-item">
              <span class="label">初始化:</span>
              <n-icon
                :component="isInitialized ? CircleCheck : CircleX"
                :color="isInitialized ? 'var(--hula-brand-primary)' : 'var(--hula-brand-primary)'" />
            </div>
            <div class="info-item">
              <span class="label">运行中:</span>
              <n-icon
                :component="isRunning ? CircleCheck : CircleX"
                :color="isRunning ? 'var(--hula-brand-primary)' : 'var(--hula-brand-primary)'" />
            </div>
          </div>
        </n-collapse-item>

        <!-- Server Capabilities -->
        <n-collapse-item title="服务器能力" name="capabilities">
          <div class="capabilities-list">
            <div class="capability-item">
              <span class="capability-name">Sliding Sync:</span>
              <n-tag :type="capabilities.slidingSync ? 'success' : 'default'" size="tiny">
                {{ capabilities.slidingSync ? '支持' : '不支持' }}
              </n-tag>
            </div>
            <div class="capability-item">
              <span class="capability-name">传统同步:</span>
              <n-tag :type="capabilities.traditionalSync ? 'success' : 'default'" size="tiny">
                {{ capabilities.traditionalSync ? '支持' : '不支持' }}
              </n-tag>
            </div>
            <div class="capability-item">
              <span class="capability-name">懒加载:</span>
              <n-tag :type="capabilities.lazyLoading ? 'success' : 'default'" size="tiny">
                {{ capabilities.lazyLoading ? '支持' : '不支持' }}
              </n-tag>
            </div>
            <div class="capability-item">
              <span class="capability-name">E2EE:</span>
              <n-tag :type="capabilities.e2ee ? 'success' : 'default'" size="tiny">
                {{ capabilities.e2ee ? '支持' : '不支持' }}
              </n-tag>
            </div>
          </div>
        </n-collapse-item>

        <!-- Cache Stats -->
        <n-collapse-item title="缓存统计" name="cache">
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-value">{{ cacheStats.hits }}</span>
              <span class="stat-label">命中次数</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ cacheStats.misses }}</span>
              <span class="stat-label">未命中</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ cacheStats.size }}</span>
              <span class="stat-label">缓存大小</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ hitRate }}%</span>
              <span class="stat-label">命中率</span>
            </div>
          </div>
        </n-collapse-item>

        <!-- Event Stats -->
        <n-collapse-item title="事件统计" name="events">
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-value">{{ eventStats.eventsReceived }}</span>
              <span class="stat-label">接收事件</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ eventStats.eventsEmitted }}</span>
              <span class="stat-label">发出事件</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ eventStats.eventsDeduplicated }}</span>
              <span class="stat-label">去重事件</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ eventStats.deduplicationRate }}%</span>
              <span class="stat-label">去重率</span>
            </div>
          </div>
        </n-collapse-item>

        <!-- List Stats -->
        <n-collapse-item title="列表统计" name="lists">
          <div v-for="(listData, listName) in listStats" :key="listName" class="list-stat-item">
            <div class="list-name">{{ listName }}</div>
            <div class="list-count">{{ listData.count }} 房间</div>
          </div>
        </n-collapse-item>
      </n-collapse>

      <!-- Error Display -->
      <n-alert v-if="error" type="error" title="错误" :description="error" closable @close="handleClearError" />

      <!-- Actions -->
      <template #footer>
        <div class="actions">
          <n-button size="small" @click="handleRefresh" :loading="refreshing">刷新状态</n-button>
          <n-button size="small" @click="showDetails = !showDetails">
            {{ showDetails ? '隐藏详情' : '显示详情' }}
          </n-button>
          <n-button size="small" type="error" @click="handleReset">重置</n-button>
        </div>
      </template>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSlidingSyncStore } from '@/stores/slidingSync'
import { slidingSyncFallback } from '@/services/slidingSyncFallback'
import { slidingSyncCache } from '@/services/slidingSyncCacheService'
import { slidingSyncEventAggregator } from '@/services/slidingSyncEventAggregator'
import { logger } from '@/utils/logger'
import { NCard, NTag, NIcon, NSwitch, NCollapse, NCollapseItem, NAlert, NButton } from 'naive-ui'
import { CircleCheck, CircleX } from '@vicons/tabler'

// Props
interface Props {
  canToggle?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canToggle: true
})

// Store
const store = useSlidingSyncStore()

// State
const refreshing = ref(false)
const showDetails = ref(false)

// Computed
const enabled = computed({
  get: () => slidingSyncFallback.isSlidingSync(),
  set: (_value: boolean) => {
    if (!props.canToggle) return
    // Toggle is handled by handleToggle
  }
})

const isReady = computed(() => store.isReady)
const isInitialized = computed(() => store.isInitialized)
const isRunning = computed(() => store.isRunning)
const error = computed(() => store.error)
const proxyUrl = computed(() => store.proxyUrl)
const lifecycleState = computed(() => store.lifecycleState)

const syncMode = computed(() => slidingSyncFallback.getMode())
const capabilities = computed(() => slidingSyncFallback.getCapabilities())

const statusTagType = computed(() => {
  if (error.value) return 'error'
  if (isReady.value) return 'success'
  return 'warning'
})

const statusText = computed(() => {
  if (error.value) return '错误'
  if (isReady.value) return '运行中'
  if (isInitialized.value) return '已初始化'
  return '未初始化'
})

const syncModeText = computed(() => {
  const modeMap = {
    'sliding-sync': 'Sliding Sync',
    traditional: '传统同步',
    hybrid: '混合模式'
  }
  return modeMap[syncMode.value] || syncMode.value
})

const cacheStats = computed(() => slidingSyncCache.getStats())

const eventStats = computed(() => slidingSyncEventAggregator.getStats())

const hitRate = computed(() => {
  return Math.round(slidingSyncCache.getHitRate() * 100)
})

const listStats = computed(() => {
  return {
    all_rooms: {
      count: store.counts.all_rooms || 0
    },
    direct_messages: {
      count: store.counts.direct_messages || 0
    },
    favorites: {
      count: store.counts.favorites || 0
    },
    unread: {
      count: store.counts.unread || 0
    }
  }
})

// Methods
const handleToggle = async (value: boolean) => {
  if (value) {
    // Enable Sliding Sync
    try {
      await store.initialize()
      await store.start()
      logger.info('[StatusPanel] Sliding Sync enabled')
    } catch (err) {
      logger.error('[StatusPanel] Failed to enable Sliding Sync:', err)
    }
  } else {
    // Disable Sliding Sync (fallback to traditional)
    store.stop()
    logger.info('[StatusPanel] Sliding Sync disabled')
  }
}

const handleRefresh = async () => {
  refreshing.value = true
  try {
    await slidingSyncFallback.detectCapabilities()
    logger.info('[StatusPanel] Status refreshed')
  } catch (err) {
    logger.error('[StatusPanel] Failed to refresh status:', err)
  } finally {
    refreshing.value = false
  }
}

const handleReset = () => {
  store.reset()
  slidingSyncCache.clear()
  slidingSyncEventAggregator.resetStats()
  logger.info('[StatusPanel] Reset complete')
}

const handleClearError = () => {
  store.clearError()
}

// Lifecycle
onMounted(() => {
  logger.debug('[StatusPanel] Mounted')
})
</script>

<style lang="scss" scoped>
.sliding-sync-status-panel {
  padding: 16px;
}

.status-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;

  .label {
    font-weight: 500;
    color: var(--n-text-color-2);
  }
}

.info-grid,
.capabilities-list,
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.info-item,
.capability-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: var(--n-color-modal);
  border-radius: 4px;

  .label,
  .capability-name {
    font-size: 13px;
    color: var(--n-text-color-2);
  }

  .value {
    font-size: 13px;
    color: var(--n-text-color-1);
    font-weight: 500;
  }
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px;
  background-color: var(--n-color-modal);
  border-radius: 4px;

  .stat-value {
    font-size: 20px;
    font-weight: 600;
    color: var(--n-text-color-1);
  }

  .stat-label {
    font-size: 12px;
    color: var(--n-text-color-3);
  }
}

.list-stat-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: var(--n-color-modal);
  border-radius: 4px;
  margin-bottom: 8px;

  .list-name {
    font-size: 13px;
    color: var(--n-text-color-2);
  }

  .list-count {
    font-size: 13px;
    font-weight: 500;
    color: var(--n-text-color-1);
  }
}

.actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
