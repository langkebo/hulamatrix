<!-- Mobile Message Reply Dialog - Reply to a message on mobile -->
<template>
  <van-popup
    v-model:show="showDialog"
    position="bottom"
    :style="{ height: '70%', borderRadius: '16px 16px 0 0' }"
  >
    <div class="mobile-message-reply-popup">
      <!-- Handle bar -->
      <div class="handle-bar" @click="handleClose"></div>

      <!-- Header -->
      <div class="popup-header">
        <div class="header-title">{{ t('message.reply') }}</div>
        <van-icon name="cross" :size="20" @click="handleClose" />
      </div>

      <!-- Content -->
      <div class="popup-content">
        <div class="mobile-message-reply">
          <!-- Original Message Preview -->
          <div class="original-message">
            <div class="preview-label">{{ t('message.replyingTo') }}</div>
            <div class="preview-content">{{ replyToContent }}</div>
          </div>

          <!-- Reply Input -->
          <div class="reply-section">
            <van-field
              v-model="replyText"
              type="textarea"
              :placeholder="t('message.replyPlaceholder')"
              :autosize="{ minHeight: 80, maxHeight: 200 }"
              :maxlength="maxLength"
              rows="3"
              ref="inputRef"
              @keyup.ctrl.enter="sendReply"
            />
            <div class="char-count">{{ replyText.length }}/{{ maxLength }}</div>
          </div>

          <!-- Info -->
          <div class="reply-info">
            <van-icon name="info-o" :size="14" />
            <span>{{ t('message.replyInfo') }}</span>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="popup-footer">
        <van-button
          type="primary"
          block
          :loading="sending"
          :disabled="!replyText.trim()"
          @click="sendReply"
        >
          <template #icon>
            <van-icon name="send" />
          </template>
          {{ t('message.send') }}
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
  replyToEventId: string
  replyToContent: string
}

const props = defineProps<Props>()

interface Emits {
  'update:show': [value: boolean]
  sent: [data: { eventId: string; content: string }]
}

const emit = defineEmits<Emits>()

const { t } = useI18n()
const message = useMessage()

// State
const sending = ref(false)
const replyText = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const maxLength = 2800

// Computed
const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

// Methods
const handleClose = () => {
  if (sending.value) return
  emit('update:show', false)
  replyText.value = ''
}

const sendReply = async () => {
  if (!replyText.value.trim()) {
    msg.warning(t('message.cannotBeEmpty'))
    return
  }

  sending.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    logger.info('[MobileReply] Sending reply:', {
      replyToEventId: props.replyToEventId,
      roomId: props.roomId,
      content: replyText.value
    })

    // Create message content with reply relation
    const newContent = {
      msgtype: 'm.text',
      body: replyText.value
    }

    // Matrix reply format
    const replyEventContent = {
      'm.relates_to': {
        'm.in_reply_to': {
          event_id: props.replyToEventId
        }
      },
      msgtype: 'm.text',
      body: replyText.value
    }

    await sendMessage(client, props.roomId, replyEventContent, 'm.room.message')

    msg.success(t('message.sent'))
    emit('sent', { eventId: props.replyToEventId, content: replyText.value })
    handleClose()
  } catch (error) {
    logger.error('[MobileReply] Failed to send reply:', error)
    msg.error(t('message.sendFailed') + ': ' + (error instanceof Error ? error.message : String(error)))
  } finally {
    sending.value = false
  }
}

// Watch for dialog open to focus input
watch(
  () => props.show,
  async (show) => {
    if (show) {
      await nextTick()
      inputRef.value?.focus()
    }
  }
)
</script>

<style scoped lang="scss">
.mobile-message-reply-popup {
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
    color: #333;
  }

  .van-icon {
    cursor: pointer;
    color: #666;
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

.mobile-message-reply {
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

  .reply-section {
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

  .reply-info {
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
