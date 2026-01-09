<template>
  <n-modal v-model:show="visible" preset="dialog" title="架构迁移" :mask-closable="false">
    <div class="migration-progress">
      <!-- 当前状态 -->
      <div class="status-section">
        <n-steps :current="getStepIndex()" :status="getStatus()" vertical>
          <n-step
            v-for="step in steps"
            :key="step.name"
            :title="step.description"
            :description="getStepDescription(step)" />
        </n-steps>
      </div>

      <!-- 进度条 -->
      <div class="progress-section">
        <n-progress type="line" :percentage="state.progress" :status="getProgressStatus()" :height="24" processing>
          <div class="progress-text">{{ state.progress }}% - {{ state.currentStep }}</div>
        </n-progress>
      </div>

      <!-- 详细信息 -->
      <div class="details-section" v-if="showDetails">
        <n-descriptions :column="1" bordered size="small">
          <n-descriptions-item label="当前阶段">
            {{ getPhaseText(state.phase) }}
          </n-descriptions-item>
          <n-descriptions-item label="开始时间" v-if="state.startTime">
            {{ formatTime(state.startTime) }}
          </n-descriptions-item>
          <n-descriptions-item label="预计剩余时间" v-if="state.estimatedTime">
            {{ getRemainingTime() }}
          </n-descriptions-item>
          <n-descriptions-item label="已迁移房间" v-if="state.migratedRooms.length > 0">
            {{ state.migratedRooms.length }} 个
          </n-descriptions-item>
          <n-descriptions-item label="失败房间" v-if="state.failedRooms.length > 0">
            {{ state.failedRooms.length }} 个
          </n-descriptions-item>
        </n-descriptions>

        <!-- 失败房间列表 -->
        <div v-if="state.failedRooms.length > 0" class="failed-rooms">
          <n-alert type="error" title="迁移失败的房间" closable>
            <n-collapse>
              <n-collapse-item
                v-for="(item, index) in state.failedRooms"
                :key="item.roomId"
                :title="item.roomId"
                :name="index">
                {{ item.error }}
              </n-collapse-item>
            </n-collapse>
          </n-alert>
        </div>
      </div>

      <!-- 错误信息 -->
      <div v-if="state.error" class="error-section">
        <n-alert type="error" :title="t('migration.error.title')">
          {{ state.error }}
        </n-alert>
      </div>
    </div>

    <template #action>
      <n-space>
        <n-button
          v-if="!state.isMigrating && state.phase !== 'completed'"
          @click="handleStart"
          :loading="loading"
          type="primary">
          {{ t('migration.start') }}
        </n-button>

        <n-button v-if="state.isMigrating" @click="handleCancel" :disabled="!canCancel">
          {{ t('migration.cancel') }}
        </n-button>

        <n-button v-if="state.phase === 'completed'" @click="handleClose" type="primary">
          {{ t('migration.close') }}
        </n-button>

        <n-button v-if="!state.isMigrating && state.phase === 'completed'" @click="handleRollback" :loading="loading">
          {{ t('migration.rollback') }}
        </n-button>

        <n-button @click="toggleDetails" :type="showDetails ? 'default' : 'tertiary'">
          {{ showDetails ? t('migration.hide_details') : t('migration.show_details') }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { migrationManager, type MigrationState } from '@/adapters/migration-manager'
import { logger } from '@/utils/logger'

const { t } = useI18n()

// Props
const props = defineProps<{
  modelValue: boolean
}>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'migration-completed': []
  'migration-failed': [error: string]
}>()

// State
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const loading = ref(false)
const showDetails = ref(false)
const state = ref<MigrationState>(migrationManager.getState())

interface MigrationStep {
  name: string
  description: string
}

// 迁移步骤
const steps: MigrationStep[] = [
  { name: 'validate-prerequisites', description: t('migration.steps.prerequisites') },
  { name: 'backup-data', description: t('migration.steps.backup') },
  { name: 'migrate-user-profile', description: t('migration.steps.profile') },
  { name: 'migrate-rooms', description: t('migration.steps.rooms') },
  { name: 'migrate-messages', description: t('migration.steps.messages') },
  { name: 'migrate-files', description: t('migration.steps.files') },
  { name: 'update-settings', description: t('migration.steps.settings') },
  { name: 'verification', description: t('migration.steps.verification') }
]

// 是否可以取消
const canCancel = computed(() => {
  // 只有在 preparation 阶段可以取消
  return state.value.phase === 'preparation'
})

// 监听迁移状态变化
let unsubscribe: (() => void) | null = null

onMounted(() => {
  unsubscribe = migrationManager.addListener((newState) => {
    state.value = newState

    // 迁移完成
    if (newState.phase === 'completed' && !newState.isMigrating) {
      emit('migration-completed')
    }

    // 迁移失败
    if (newState.error && !newState.isMigrating) {
      emit('migration-failed', newState.error)
    }
  })
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})

// 获取当前步骤索引
const getStepIndex = () => {
  const stepNames = steps.map((s) => s.name)
  const currentStepName = steps.find((s) => state.value.currentStep.includes(s.description))?.name

  if (!currentStepName) {
    return 1
  }

  const index = stepNames.indexOf(currentStepName)
  return index + 1
}

// 获取步骤状态
const getStatus = () => {
  if (state.value.error) return 'error'
  if (state.value.phase === 'completed') return 'finish'
  if (state.value.isMigrating) return 'process'
  return 'wait'
}

// 获取进度条状态
const getProgressStatus = () => {
  if (state.value.error) return 'error'
  if (state.value.phase === 'completed') return 'success'
  return 'default'
}

// 获取步骤描述
const getStepDescription = (step: MigrationStep) => {
  if (state.value.phase === 'completed') {
    return t('migration.steps.completed')
  }

  if (state.value.currentStep.includes(step.description)) {
    return t('migration.steps.in_progress')
  }

  // 根据阶段判断步骤状态
  const stepIndex = steps.indexOf(step)
  const currentIndex = getStepIndex() - 1

  if (stepIndex < currentIndex) {
    return t('migration.steps.completed')
  }

  return ''
}

// 获取阶段文本
const getPhaseText = (phase: string) => {
  const phaseMap: Record<string, string> = {
    preparation: t('migration.phases.preparation'),
    'data-migration': t('migration.phases.data_migration'),
    'service-migration': t('migration.phases.service_migration'),
    verification: t('migration.phases.verification'),
    completed: t('migration.phases.completed')
  }
  return phaseMap[phase] || phase
}

// 格式化时间
const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString()
}

// 获取剩余时间
const getRemainingTime = () => {
  if (!state.value.startTime || !state.value.estimatedTime) {
    return '-'
  }

  const elapsed = Date.now() - state.value.startTime
  const remaining = state.value.estimatedTime - elapsed

  if (remaining <= 0) {
    return t('migration.soon')
  }

  const minutes = Math.ceil(remaining / 60000)
  return t('migration.remaining_minutes', { count: minutes })
}

// 开始迁移
const handleStart = async () => {
  loading.value = true

  try {
    await migrationManager.startMigration({
      strategy: 'balanced',
      rollback: true,
      timeout: 300000 // 5 minutes
    })
  } catch (error) {
    logger.error('[MigrationProgress] Start failed:', error)
  } finally {
    loading.value = false
  }
}

// 取消迁移
const handleCancel = async () => {
  loading.value = true

  try {
    // 调用 migrationManager 的取消方法
    await migrationManager.cancelMigration()

    // 关闭对话框
    visible.value = false

    logger.info('[MigrationProgress] Migration cancelled successfully')
  } catch (error) {
    logger.error('[MigrationProgress] Cancel failed:', error)
  } finally {
    loading.value = false
  }
}

// 关闭对话框
const handleClose = () => {
  visible.value = false
}

// 回滚迁移
const handleRollback = async () => {
  loading.value = true

  try {
    // 调用 migrationManager 的回滚方法
    await migrationManager.rollbackMigration()

    // 关闭对话框
    visible.value = false

    logger.info('[MigrationProgress] Migration rolled back successfully')
  } catch (error) {
    logger.error('[MigrationProgress] Rollback failed:', error)
  } finally {
    loading.value = false
  }
}

// 切换详细信息显示
const toggleDetails = () => {
  showDetails.value = !showDetails.value
}
</script>

<style lang="scss" scoped>
.migration-progress {
  min-width: 600px;
  max-width: 800px;

  .status-section {
    margin-bottom: 24px;
  }

  .progress-section {
    margin: 24px 0;

    .progress-text {
      font-size: 14px;
      font-weight: 500;
    }
  }

  .details-section {
    margin-top: 24px;
  }

  .failed-rooms {
    margin-top: 16px;
    max-height: 300px;
    overflow-y: auto;
  }

  .error-section {
    margin-top: 16px;
  }
}

:deep(.n-steps) {
  .n-step {
    &.n-step--current {
      .n-step-node {
        .n-step-node-inner {
          .n-step-node-icon {
            color: var(--primary-color);
          }
        }
      }
    }
  }
}
</style>
