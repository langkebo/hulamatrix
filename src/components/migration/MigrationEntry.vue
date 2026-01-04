<template>
  <div class="migration-entry">
    <!-- 主应用中的迁移提示 -->
    <MigrationPrompt ref="promptRef" />

    <!-- 设置页面中的迁移入口 -->
    <template v-if="showSettingsEntry">
      <n-divider>
        <span class="divider-text">{{ t('migration.settings.title') }}</span>
      </n-divider>

      <div class="settings-section">
        <div class="section-header">
          <h4>{{ t('migration.settings.section_title') }}</h4>
          <n-tag
            v-if="currentArchitecture === 'matrix'"
            type="success"
            size="small"
          >
            {{ t('migration.settings.status.migrated') }}
          </n-tag>
          <n-tag
            v-else-if="isMigrating"
            type="warning"
            size="small"
          >
            {{ t('migration.settings.status.migrating') }}
          </n-tag>
          <n-tag
            v-else
            type="default"
            size="small"
          >
            {{ t('migration.settings.status.websocket') }}
          </n-tag>
        </div>

        <div class="section-content">
          <p class="description">{{ t('migration.settings.description') }}</p>

          <!-- 迁移进度 -->
          <div v-if="isMigrating" class="migration-progress-mini">
            <n-progress
              type="line"
              :percentage="progress"
              :height="8"
              processing
            />
            <p class="progress-text">{{ currentStep }}</p>
          </div>

          <!-- 迁移统计 -->
          <div v-if="stats.totalRooms > 0" class="migration-stats">
            <n-space size="small">
              <span>{{ t('migration.stats.total_rooms') }}: {{ stats.totalRooms }}</span>
              <span>{{ t('migration.stats.migrated') }}: {{ stats.migratedRooms }}</span>
              <span v-if="stats.failedRooms > 0" class="failed">
                {{ t('migration.stats.failed') }}: {{ stats.failedRooms }}
              </span>
            </n-space>
          </div>

          <!-- 操作按钮 -->
          <div class="actions">
            <n-space>
              <n-button
                v-if="!isMigrating && !isCompleted && canMigrate"
                type="primary"
                @click="handleStartMigration"
                :loading="isLoading"
              >
                {{ t('migration.settings.start') }}
              </n-button>

              <n-button
                v-if="isMigrating"
                @click="handleViewDetails"
              >
                {{ t('migration.settings.view_details') }}
              </n-button>

              <n-button
                v-if="isCompleted"
                @click="handleViewReport"
              >
                {{ t('migration.settings.view_report') }}
              </n-button>

              <n-button
                @click="handleLearnMore"
                text
                type="primary"
              >
                {{ t('migration.settings.learn_more') }}
              </n-button>
            </n-space>
          </div>

          <!-- 迁移历史 -->
          <div v-if="migrationHistory.length > 0" class="migration-history">
            <n-collapse>
              <n-collapse-item :title="t('migration.settings.history.title')" name="history">
                <n-timeline>
                  <n-timeline-item
                    v-for="item in migrationHistory"
                    :key="item.date"
                    :type="getHistoryItemType(item.status)"
                    :title="formatHistoryDate(item.date)"
                  >
                    <span :class="`status-${item.status}`">
                      {{ getHistoryStatusText(item.status) }}
                    </span>
                    <div v-if="item.details" class="history-details">
                      {{ item.details }}
                    </div>
                  </n-timeline-item>
                </n-timeline>
              </n-collapse-item>
            </n-collapse>
          </div>
        </div>
      </div>
    </template>

    <!-- 状态栏中的迁移指示器 -->
    <div v-if="showStatusIndicator && isMigrating" class="status-indicator">
      <n-spin size="small" />
      <span>{{ t('migration.status.indicator', { progress }) }}</span>
    </div>

    <!-- 迁移详情对话框 -->
    <MigrationProgress
      v-model="showDetailsDialog"
      @migration-completed="handleMigrationCompleted"
      @migration-failed="handleMigrationFailed"
    />

    <!-- 迁移报告对话框 -->
    <n-modal v-model:show="showReportDialog" preset="dialog" title="迁移报告">
      <div class="migration-report">
        <n-alert type="success" :closable="false">
          {{ t('migration.report.success_message') }}
        </n-alert>

        <div class="report-content">
          <n-descriptions :column="2" bordered size="small">
            <n-descriptions-item label="迁移时间">
              {{ formatReportDate() }}
            </n-descriptions-item>
            <n-descriptions-item label="迁移耗时">
              {{ getMigrationDuration() }}
            </n-descriptions-item>
            <n-descriptions-item label="房间总数">
              {{ stats.totalRooms }}
            </n-descriptions-item>
            <n-descriptions-item label="成功迁移">
              {{ stats.migratedRooms }}
            </n-descriptions-item>
            <n-descriptions-item label="失败房间">
              {{ stats.failedRooms }}
            </n-descriptions-item>
            <n-descriptions-item label="成功率">
              {{ stats.successRate }}%
            </n-descriptions-item>
          </n-descriptions>
        </div>
      </div>

      <template #action>
        <n-space>
          <n-button @click="showReportDialog = false">
            关闭
          </n-button>
          <n-button type="primary" @click="handleExportReport">
            导出报告
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMigration } from '@/hooks/useMigration'
import MigrationPrompt from './MigrationPrompt.vue'
import MigrationProgress from './MigrationProgress.vue'
import { logger } from '@/utils/logger'

const { t } = useI18n()

// Props
const props = defineProps<{
  /**
   * 是否显示设置页面入口
   */
  showSettingsEntry?: boolean

  /**
   * 是否显示状态栏指示器
   */
  showStatusIndicator?: boolean
}>()

// State
const promptRef = ref()
const showDetailsDialog = ref(false)
const showReportDialog = ref(false)

// 使用迁移 Hook
const {
  state,
  isMigrating,
  isCompleted,
  canMigrate,
  progress,
  currentStep,
  stats,
  currentArchitecture,
  isLoading,
  startMigration,
  getMigrationHistory,
  recordMigrationHistory
} = useMigration({
  autoShowPrompt: false // 手动控制提示显示
})

// 迁移历史
const migrationHistory = computed(() => getMigrationHistory())

// 生命周期
onMounted(() => {
  // 如果允许自动显示提示
  if (props.showSettingsEntry === false) {
    const { checkShouldShowPrompt } = useMigration()
    if (checkShouldShowPrompt()) {
      promptRef.value?.showPrompt()
    }
  }
})

// 处理开始迁移
const handleStartMigration = async () => {
  try {
    await startMigration({
      strategy: 'balanced',
      rollback: true
    })

    recordMigrationHistory('success')
  } catch (error) {
    logger.error('[MigrationEntry] Migration failed:', error)
    recordMigrationHistory('failed', error instanceof Error ? error.message : String(error))
  }
}

// 处理查看详情
const handleViewDetails = () => {
  showDetailsDialog.value = true
}

// 处理查看报告
const handleViewReport = () => {
  showReportDialog.value = true
}

// 处理迁移完成
const handleMigrationCompleted = () => {
  showDetailsDialog.value = false
  logger.info('[MigrationEntry] Migration completed successfully')
}

// 处理迁移失败
const handleMigrationFailed = (error: string) => {
  showDetailsDialog.value = false
  logger.error('[MigrationEntry] Migration failed:', error)
}

// 处理了解更多
const handleLearnMore = () => {
  window.open('/docs/matrix-sdk/migration-guide', '_blank')
}

// 处理导出报告
const handleExportReport = () => {
  const report = {
    migrationDate: new Date().toISOString(),
    architecture: currentArchitecture.valueOf(),
    stats: stats.value,
    state: state.value
  }

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `migration-report-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)

  logger.info('[MigrationEntry] Migration report exported')
}

// 获取历史项类型
const getHistoryItemType = (status: string) => {
  switch (status) {
    case 'success':
      return 'success'
    case 'failed':
      return 'error'
    case 'cancelled':
      return 'warning'
    default:
      return 'info'
  }
}

// 获取历史状态文本
const getHistoryStatusText = (status: string) => {
  switch (status) {
    case 'success':
      return t('migration.history.success')
    case 'failed':
      return t('migration.history.failed')
    case 'cancelled':
      return t('migration.history.cancelled')
    default:
      return status
  }
}

// 格式化历史日期
const formatHistoryDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString()
}

// 格式化报告日期
const formatReportDate = () => {
  if (state.value.startTime) {
    return new Date(state.value.startTime).toLocaleString()
  }
  return '-'
}

// 获取迁移耗时
const getMigrationDuration = () => {
  if (!state.value.startTime) {
    return '-'
  }

  const endTime = state.value.startTime + (state.value.estimatedTime || 0)
  const duration = endTime - state.value.startTime

  const minutes = Math.floor(duration / 60000)
  const seconds = Math.floor((duration % 60000) / 1000)

  return `${minutes}分${seconds}秒`
}
</script>

<style lang="scss" scoped>
.migration-entry {
  .settings-section {
    margin: 20px 0;
    padding: 20px;
    background: var(--card-color);
    border-radius: 8px;

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      h4 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
    }

    .section-content {
      .description {
        margin: 0 0 16px 0;
        color: var(--text-color-2);
        font-size: 14px;
      }

      .migration-progress-mini {
        margin: 16px 0;

        .progress-text {
          margin-top: 8px;
          font-size: 13px;
          color: var(--text-color-2);
        }
      }

      .migration-stats {
        margin: 16px 0;
        padding: 12px;
        background: var(--body-color);
        border-radius: 6px;

        .failed {
          color: var(--error-color);
        }
      }

      .actions {
        margin-top: 16px;
      }

      .migration-history {
        margin-top: 24px;

        .status-success {
          color: var(--success-color);
        }

        .status-failed {
          color: var(--error-color);
        }

        .status-cancelled {
          color: var(--warning-color);
        }

        .history-details {
          margin-top: 4px;
          font-size: 12px;
          color: var(--text-color-3);
        }
      }
    }
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--card-color);
    border-radius: 20px;
    font-size: 13px;
    color: var(--text-color);
  }

  .migration-report {
    .report-content {
      margin-top: 20px;
    }
  }
}

.divider-text {
  font-size: 14px;
  color: var(--text-color-2);
}
</style>