<!-- Mobile Message Edit Dialog - Edit previously sent messages -->
<template>
  <van-popup v-model:show="showDialog" position="bottom" :style="{ height: '80%', borderRadius: '16px 16px 0 0' }">
    <div class="mobile-message-edit-popup">
      <!-- Handle bar -->
      <div class="handle-bar" @click="handleClose"></div>

      <!-- Header -->
      <div class="popup-header">
        <div class="header-title">{{ t('message.edit.editMessage') }}</div>
        <van-icon name="cross" :size="20" @click="handleClose" />
      </div>

      <!-- Content -->
      <div class="popup-content">
        <div class="mobile-message-edit">
          <!-- Original Message Preview -->
          <div class="original-message">
            <div class="preview-label">{{ t('message.edit.originalMessage') }}</div>
            <div class="preview-content">{{ originalContent }}</div>
          </div>

          <!-- Edit Input -->
          <div class="edit-section">
            <van-field
              v-model="editContent"
              type="textarea"
              :placeholder="t('message.edit.placeholder')"
              :autosize="{ minHeight: 80, maxHeight: 200 }"
              :maxlength="maxLength"
              rows="3"
              ref="inputRef"
              @keyup.ctrl.enter="saveEdit" />
            <div class="char-count">{{ editContent.length }}/{{ maxLength }}</div>
          </div>

          <!-- Edit History -->
          <div v-if="editHistory.length > 0" class="edit-history">
            <div class="history-header">
              <span class="history-label">{{ t('message.edit.editHistory') }}</span>
              <van-button type="primary" size="small" plain @click="showHistory = !showHistory">
                {{ showHistory ? t('common.hide') : t('common.show') }}
              </van-button>
            </div>
            <div v-if="showHistory" class="history-list">
              <div v-for="(edit, index) in editHistory" :key="index" class="history-item">
                <span class="history-time">{{ formatTime(edit.timestamp) }}</span>
                <span class="history-content">{{ edit.content }}</span>
              </div>
            </div>
          </div>

          <!-- Info -->
          <div class="edit-info">
            <van-icon name="info-o" :size="14" />
            <span>{{ t('message.edit.info') }}</span>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="popup-footer">
        <van-button
          type="primary"
          block
          :loading="saving"
          :disabled="!editContent.trim() || editContent === originalContent"
          @click="saveEdit">
          <template #icon>
            <van-icon name="success" />
          </template>
          {{ t('message.edit.save') }}
        </van-button>
        <van-button block @click="handleClose">
          {{ t('common.cancel') }}
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from '@/utils/vant-adapter'
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
.mobile-message-edit-popup {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  margin: 8px auto;
  flex-shrink: 0;
  cursor: pointer;
  transition: background 0.2s;

  &:active {
    background: #d0d0d0;
  }
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;

  .header-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--hula-gray-900);
  }

  .van-icon {
    cursor: pointer;
    color: var(--hula-gray-700);
    padding: 8px;

    &:active {
      opacity: 0.6;
    }
  }
}

.popup-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.popup-footer {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

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
    position: relative;

    .char-count {
      position: absolute;
      bottom: -20px;
      right: 0;
      font-size: 11px;
      color: var(--text-color-3);
    }
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
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    background: #e6f7ff;
    border: 1px solid #91d5ff;
    border-radius: 6px;
    font-size: 12px;
    color: #0050b3;

    .van-icon {
      color: #1890ff;
      flex-shrink: 0;
    }
  }
}
</style>
