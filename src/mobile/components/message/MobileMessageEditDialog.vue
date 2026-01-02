<!-- Mobile Message Edit Dialog - Edit previously sent messages -->
<template>
  <n-modal
    v-model:show="showDialog"
    preset="card"
    :title="t('message.edit.editMessage')"
    :style="{ width: '90%', maxWidth: '500px' }"
    @close="handleClose"
  >
    <div class="mobile-message-edit">
      <!-- Original Message Preview -->
      <div class="original-message">
        <div class="preview-label">{{ t('message.edit.originalMessage') }}</div>
        <div class="preview-content">{{ originalContent }}</div>
      </div>

      <!-- Edit Input -->
      <div class="edit-section">
        <n-input
          v-model:value="editContent"
          type="textarea"
          :placeholder="t('message.edit.placeholder')"
          :autosize="{ minRows: 3, maxRows: 8 }"
          :maxlength="maxLength"
          show-count
          size="large"
          ref="inputRef"
          @keyup.enter.ctrl="saveEdit"
        />
      </div>

      <!-- Edit History -->
      <div v-if="editHistory.length > 0" class="edit-history">
        <div class="history-header">
          <span class="history-label">{{ t('message.edit.editHistory') }}</span>
          <n-button text size="small" @click="showHistory = !showHistory">
            {{ showHistory ? t('common.hide') : t('common.show') }}
          </n-button>
        </div>
        <div v-if="showHistory" class="history-list">
          <div
            v-for="(edit, index) in editHistory"
            :key="index"
            class="history-item"
          >
            <span class="history-time">{{ formatTime(edit.timestamp) }}</span>
            <span class="history-content">{{ edit.content }}</span>
          </div>
        </div>
      </div>

      <!-- Info -->
      <n-alert type="info" :show-icon="true" class="edit-info">
        <template #icon>
          <n-icon><InfoCircle /></n-icon>
        </template>
        {{ t('message.edit.info') }}
      </n-alert>

      <!-- Actions -->
      <template #footer>
        <n-space vertical>
          <n-button
            type="primary"
            block
            size="large"
            :loading="saving"
            :disabled="!editContent.trim() || editContent === originalContent"
            @click="saveEdit"
          >
            <template #icon>
              <n-icon><Check /></n-icon>
            </template>
            {{ t('message.edit.save') }}
          </n-button>
          <n-button block @click="handleClose">
            {{ t('common.cancel') }}
          </n-button>
        </n-space>
      </template>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NInput, NButton, NSpace, NAlert, NIcon, useMessage } from 'naive-ui'
import { Check, InfoCircle } from '@vicons/tabler'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import { sendMessage } from '@/utils/matrixClientUtils'
import { msg } from '@/utils/SafeUI'

interface Props {
  show: boolean
  roomId: string
  eventId: string
  originalContent: string
  eventType?: string
  editHistory?: Array<{ timestamp: number; content: string }>
}

const props = withDefaults(defineProps<Props>(), {
  eventType: 'm.room.message',
  editHistory: () => []
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  edited: [eventId: string, newContent: string]
}>()

const { t } = useI18n()
const message = useMessage()

// State
const saving = ref(false)
const editContent = ref(props.originalContent)
const showHistory = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const maxLength = 2800 // Matrix limit for text messages

// Computed
const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

// Methods
const handleClose = () => {
  if (saving.value) return
  emit('update:show', false)
}

function createMessageContent(text: string): Record<string, unknown> {
  return {
    msgtype: 'm.text',
    body: text
  }
}

async function saveEdit() {
  if (!editContent.value.trim()) {
    msg.warning(t('message.edit.cannotBeEmpty'))
    return
  }

  if (editContent.value === props.originalContent) {
    handleClose()
    return
  }

  saving.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    logger.info('[MobileMessageEdit] Editing message:', {
      eventId: props.eventId,
      roomId: props.roomId,
      originalContent: props.originalContent,
      newContent: editContent.value
    })

    const newContent = createMessageContent(editContent.value)

    // Matrix message edit format
    const editEventContent = {
      'm.new_content': newContent,
      body: editContent.value,
      'm.relates_to': {
        rel_type: 'm.replace',
        event_id: props.eventId
      },
      msgtype: 'm.text'
    }

    await sendMessage(client, props.roomId, editEventContent, 'm.room.message')

    msg.success(t('message.edit.success'))
    emit('edited', props.eventId, editContent.value)
    handleClose()
  } catch (error) {
    logger.error('[MobileMessageEdit] Failed to edit message:', error)
    msg.error(t('message.edit.error') + ': ' + (error instanceof Error ? error.message : String(error)))
  } finally {
    saving.value = false
  }
}

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

// Watch for dialog open to focus input
watch(
  () => props.show,
  async (show) => {
    if (show) {
      editContent.value = props.originalContent
      await nextTick()
      inputRef.value?.focus()
    }
  }
)
</script>

<style scoped lang="scss">
.mobile-message-edit {
  .original-message {
    margin-bottom: 16px;
    padding: 12px;
    background: var(--bg-color);
    border-radius: 8px;

    .preview-label {
      font-size: 12px;
      color: var(--text-color-3);
      margin-bottom: 6px;
    }

    .preview-content {
      font-size: 13px;
      color: var(--text-color-2);
      padding: 8px;
      background: var(--card-color);
      border-radius: 4px;
      border-left: 2px solid var(--primary-color);
    }
  }

  .edit-section {
    margin-bottom: 16px;
  }

  .edit-history {
    margin-bottom: 16px;
    padding: 12px;
    background: var(--bg-color);
    border-radius: 8px;

    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .history-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-color-1);
      }
    }

    .history-list {
      .history-item {
        display: flex;
        gap: 8px;
        padding: 6px 0;
        border-bottom: 1px solid var(--divider-color);

        &:last-child {
          border-bottom: none;
        }

        .history-time {
          font-size: 11px;
          color: var(--text-color-3);
          min-width: 120px;
        }

        .history-content {
          font-size: 12px;
          color: var(--text-color-2);
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }
  }

  .edit-info {
    margin-bottom: 12px;
    font-size: 12px;
  }
}
</style>
