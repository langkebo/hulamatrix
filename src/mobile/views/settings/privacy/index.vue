<template>
  <SettingsLayout :title="t('setting.privacy.title')">
    <div class="privacy-settings">
      <!-- Privacy Actions Section -->
      <div class="settings-section">
        <div class="section-title">{{ t('setting.privacy.actions') }}</div>

        <!-- Target Type Selection -->
        <div class="settings-card">
          <div class="target-type-selector">
            <div
              v-for="type in targetTypeOptions"
              :key="type.value"
              :class="['type-option', { 'type-option--active': form.targetType === type.value }]"
              @click="form.targetType = type.value">
              <div class="type-option__label">{{ type.label }}</div>
            </div>
          </div>
        </div>

        <!-- Target ID Input -->
        <div class="settings-item">
          <div class="item-content">
            <div class="item-label">{{ t('setting.privacy.target_id') }}</div>
          </div>
          <n-input
            v-model:value="form.targetId"
            :placeholder="t('setting.privacy.target_id_placeholder')"
            clearable
            class="target-id-input"
            size="medium" />
        </div>

        <!-- Action Selection -->
        <div class="settings-item">
          <div class="item-content">
            <div class="item-label">{{ t('setting.privacy.action') }}</div>
          </div>
          <n-select
            v-model:value="form.action"
            :options="actionOptions"
            class="action-select"
            size="medium" />
        </div>

        <!-- Reason Input (for reports) -->
        <div v-if="form.action === 'report'" class="settings-item">
          <div class="item-content">
            <div class="item-label">{{ t('setting.privacy.reason') }}</div>
          </div>
        </div>
        <div v-if="form.action === 'report'" class="settings-card">
          <n-input
            v-model:value="form.reason"
            type="textarea"
            :placeholder="t('setting.privacy.reason_placeholder')"
            :autosize="{ minRows: 3, maxRows: 5 }" />
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <n-button type="primary" block size="large" @click="submit" :loading="submitting">
          {{ t('setting.privacy.submit') }}
        </n-button>
        <n-button block size="large" @click="reset">
          {{ t('setting.privacy.reset') }}
        </n-button>
      </div>

      <!-- Link to Privacy Management -->
      <div class="settings-section">
        <div class="settings-item" @click="goToManage">
          <div class="item-content">
            <div class="item-label">{{ t('setting.privacy.manage_blocked') }}</div>
            <div class="item-description">{{ t('setting.privacy.manage_blocked_desc') }}</div>
          </div>
          <Icon name="chevron-right" :size="16" />
        </div>
      </div>
    </div>
  </SettingsLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NInput, NSelect, NButton, useMessage } from 'naive-ui'
import { useRouter } from 'vue-router'
import SettingsLayout from '#/views/settings/SettingsLayout.vue'
import Icon from '#/components/icons/Icon.vue'
import { blockUser, unblockUser, blockRoom, unblockRoom, reportUser, reportRoom } from '@/integrations/synapse/privacy'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const message = useMessage()
const router = useRouter()

const submitting = ref(false)
const form = ref({
  targetType: 'user',
  targetId: '',
  action: 'block',
  reason: ''
})

const targetTypeOptions = [
  { label: t('setting.privacy.target_type_user'), value: 'user' },
  { label: t('setting.privacy.target_type_room'), value: 'room' }
]

const actionOptions = [
  { label: t('setting.privacy.action_block'), value: 'block' },
  { label: t('setting.privacy.action_unblock'), value: 'unblock' },
  { label: t('setting.privacy.action_report'), value: 'report' }
]

const submit = async () => {
  const ttype = form.value.targetType
  const action = form.value.action
  const id = form.value.targetId.trim()

  if (!id) {
    message.error(t('setting.privacy.error_empty_id'))
    return
  }

  submitting.value = true
  try {
    if (ttype === 'user' && action === 'block') await blockUser(id)
    else if (ttype === 'user' && action === 'unblock') await unblockUser(id)
    else if (ttype === 'user' && action === 'report') await reportUser(id, form.value.reason || '')
    else if (ttype === 'room' && action === 'block') await blockRoom(id)
    else if (ttype === 'room' && action === 'unblock') await unblockRoom(id)
    else if (ttype === 'room' && action === 'report') await reportRoom(id, form.value.reason || '')

    message.success(t('setting.privacy.success'))
    form.value.targetId = ''
    form.value.reason = ''
  } catch (error) {
    logger.error('Privacy action failed:', error)
    message.error(t('setting.privacy.error_failed'))
  } finally {
    submitting.value = false
  }
}

const reset = () => {
  form.value = {
    targetType: 'user',
    targetId: '',
    action: 'block',
    reason: ''
  }
}

const goToManage = () => {
  router.push('/mobile/settings/privacy/manage')
}
</script>

<style lang="scss" scoped>
.privacy-settings {
  padding: 0;
}

.settings-section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 12px;
  font-weight: 500;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 4px 8px;
}

.settings-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.target-type-selector {
  display: flex;
  gap: 12px;
}

.type-option {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  border: 2px solid #f0f0f0;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;

  &:active {
    transform: scale(0.98);
  }

  &--active {
    border-color: var(--primary-color);
    background: rgba(var(--primary-rgb, 19, 158, 127), 0.05);

    .type-option__label {
      color: var(--primary-color);
      font-weight: 500;
    }
  }

  &__label {
    font-size: 14px;
    color: #666;
  }
}

.settings-item {
  background: white;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:active {
    background: #f5f5f5;
  }

  &:last-child {
    margin-bottom: 0;
  }

  .item-content {
    flex: 1;
    min-width: 0;
  }

  .item-label {
    font-size: 16px;
    color: #333;
    margin-bottom: 2px;
  }

  .item-description {
    font-size: 12px;
    color: #999;
  }
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;

  .n-button {
    flex-shrink: 0;
  }
}

.target-id-input {
  width: 200px;
}

.action-select {
  width: 140px;
}
</style>
