<template>
  <n-card v-if="showPrompt" class="migration-prompt" :bordered="false">
    <div class="prompt-content">
      <div class="prompt-header">
        <n-icon size="24" color="var(--hula-brand-primary)">
          <svg viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5l1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        </n-icon>
        <div class="prompt-title">
          <h3>{{ t('migration.prompt.title') }}</h3>
          <p>{{ t('migration.prompt.subtitle') }}</p>
        </div>
      </div>

      <div class="prompt-body">
        <n-alert type="info" :closable="false">
          {{ t('migration.prompt.description') }}
        </n-alert>

        <div class="benefits">
          <h4>{{ t('migration.prompt.benefits.title') }}:</h4>
          <ul>
            <li v-for="benefit in benefits" :key="benefit">
              {{ benefit }}
            </li>
          </ul>
        </div>

        <div class="options">
          <n-space vertical>
            <n-radio-group v-model:value="selectedOption">
              <n-radio value="later">
                {{ t('migration.prompt.options.later') }}
              </n-radio>
              <n-radio value="now">
                {{ t('migration.prompt.options.now') }}
              </n-radio>
              <n-radio value="schedule">
                {{ t('migration.prompt.options.schedule') }}
              </n-radio>
            </n-radio-group>

            <n-date-picker
              v-if="selectedOption === 'schedule'"
              v-model:value="scheduledTime"
              type="datetime"
              :placeholder="t('migration.prompt.schedule.placeholder')"
              class="full-width" />
          </n-space>
        </div>
      </div>

      <div class="prompt-footer">
        <n-space>
          <n-button @click="handleDismiss" tertiary>
            {{ t('migration.prompt.dismiss') }}
          </n-button>
          <n-button @click="handleDetails" tertiary>
            {{ t('migration.prompt.learn_more') }}
          </n-button>
          <n-button type="primary" @click="handleConfirm" :disabled="selectedOption === 'schedule' && !scheduledTime">
            {{ getConfirmButtonText() }}
          </n-button>
        </n-space>
      </div>
    </div>
  </n-card>

  <!-- 迁移进度对话框 -->
  <MigrationProgress
    v-model="showProgress"
    @migration-completed="handleMigrationCompleted"
    @migration-failed="handleMigrationFailed" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { featureFlags } from '@/config/feature-flags'
import { migrationManager } from '@/adapters/migration-manager'
import MigrationProgress from './MigrationProgress.vue'
import { logger } from '@/utils/logger'

const { t } = useI18n()

// State
const showPrompt = ref(false)
const showProgress = ref(false)
const selectedOption = ref<'later' | 'now' | 'schedule'>('later')
const scheduledTime = ref<number | null>(null)
const dismissed = ref(false)

// 迁移收益列表
const benefits = computed(() => [
  t('migration.prompt.benefits.improved_security'),
  t('migration.prompt.benefits.better_performance'),
  t('migration.prompt.benefits.cross_platform'),
  t('migration.prompt.benefits.decentralized'),
  t('migration.prompt.benefits.end_to_end_encryption')
])

// 获取确认按钮文本
const getConfirmButtonText = () => {
  switch (selectedOption.value) {
    case 'later':
      return t('migration.prompt.confirm.later')
    case 'now':
      return t('migration.prompt.confirm.now')
    case 'schedule':
      return t('migration.prompt.confirm.schedule')
    default:
      return t('migration.prompt.confirm.default')
  }
}

// 检查是否应该显示提示
onMounted(() => {
  checkShouldShowPrompt()
})

const checkShouldShowPrompt = () => {
  // 检查功能标志
  if (!featureFlags.isEnabled('matrix-migration')) {
    return
  }

  // 检查是否已经迁移
  if (localStorage.getItem('migration_completed') === 'true') {
    return
  }

  // 检查是否已经忽略
  const dismissTime = localStorage.getItem('migration_prompt_dismissed')
  if (dismissTime) {
    const daysSinceDismiss = (Date.now() - parseInt(dismissTime, 10)) / (1000 * 60 * 60 * 24)
    if (daysSinceDismiss < 7) {
      return
    }
  }

  // 检查是否有定时迁移
  const scheduled = localStorage.getItem('migration_scheduled')
  if (scheduled) {
    const scheduledTime = parseInt(scheduled, 10)
    if (scheduledTime > Date.now()) {
      // 设置定时器
      setTimeout(() => {
        startMigration()
      }, scheduledTime - Date.now())
      return
    }
  }

  // 显示提示
  showPrompt.value = true
}

// 处理忽略
const handleDismiss = () => {
  dismissed.value = true
  showPrompt.value = false

  // 记录忽略时间
  localStorage.setItem('migration_prompt_dismissed', Date.now().toString())

  logger.info('[MigrationPrompt] Migration prompt dismissed')
}

// 处理查看详情
const handleDetails = () => {
  // 打开详情页面或对话框
  window.open('/docs/matrix-sdk/migration-guide', '_blank')
}

// 处理确认
const handleConfirm = async () => {
  switch (selectedOption.value) {
    case 'later':
      // 稍后提醒
      localStorage.setItem('migration_prompt_dismissed', Date.now().toString())
      showPrompt.value = false
      break

    case 'now':
      // 立即开始
      await startMigration()
      break

    case 'schedule':
      // 定时迁移
      if (scheduledTime.value) {
        localStorage.setItem('migration_scheduled', scheduledTime.value.toString())
        showPrompt.value = false

        // 设置定时器
        setTimeout(() => {
          startMigration()
        }, scheduledTime.value - Date.now())
      }
      break
  }
}

// 开始迁移
const startMigration = async () => {
  logger.info('[MigrationPrompt] Starting migration')

  // 检查是否可以迁移
  if (!migrationManager.canMigrate()) {
    logger.warn('[MigrationPrompt] Migration cannot be started')
    return
  }

  // 显示进度对话框
  showProgress.value = true
  showPrompt.value = false

  try {
    // 开始迁移
    await migrationManager.startMigration({
      strategy: 'balanced',
      rollback: true,
      timeout: 600000 // 10 minutes
    })
  } catch (error) {
    logger.error('[MigrationPrompt] Migration failed:', error)
    // 错误处理已在 MigrationProgress 中处理
  }
}

// 处理迁移完成
const handleMigrationCompleted = () => {
  showProgress.value = false

  // 清理相关存储
  localStorage.removeItem('migration_scheduled')
  localStorage.removeItem('migration_prompt_dismissed')

  logger.info('[MigrationPrompt] Migration completed successfully')

  // 刷新页面或显示成功提示
  window.location.reload()
}

// 处理迁移失败
const handleMigrationFailed = (error: string) => {
  showProgress.value = false
  logger.error('[MigrationPrompt] Migration failed:', error)

  // 显示错误提示
  // 这里可以添加错误通知逻辑
}

// 暴露方法供外部调用
defineExpose({
  showPrompt: () => {
    showPrompt.value = true
  },
  startMigration
})
</script>

<style lang="scss" scoped>
.migration-prompt {
  margin: 16px;
  background: linear-gradient(135deg, var(--hula-brand-primary) 0%, var(--hula-brand-primary) 100%);

  .prompt-content {
    padding: 8px;

    .prompt-header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 16px;

      .prompt-title {
        h3 {
          margin: 0 0 4px 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--text-color);
        }

        p {
          margin: 0;
          font-size: 14px;
          color: var(--text-color-2);
        }
      }
    }

    .prompt-body {
      .benefits {
        margin: 16px 0;

        h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
          font-weight: 500;
        }

        ul {
          margin: 0;
          padding-left: 20px;

          li {
            margin-bottom: 4px;
            font-size: 13px;
            color: var(--text-color-2);
          }
        }
      }

      .options {
        margin: 20px 0;
        padding: 16px;
        background: rgba(var(--hula-white-rgb), 0.8);
        border-radius: 8px;
      }
    }

    .prompt-footer {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid rgba(var(--hula-black-rgb), 0.1);
    }
  }
}

:deep(.n-card) {
  .n-card__content {
    padding: 0;
  }
}

.full-width {
  width: 100%;
}
</style>
