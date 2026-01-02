<!-- Mobile Message Reply Dialog - Reply to a message on mobile -->
<template>
  <n-modal
    v-model:show="showDialog"
    preset="card"
    :title="t('message.reply')"
    :style="{ width: '90%', maxWidth: '500px' }"
    @close="handleClose"
  >
    <div class="mobile-message-reply">
      <!-- Original Message Preview -->
      <div class="original-message">
        <div class="preview-label">{{ t('message.replyingTo') }}</div>
        <div class="preview-content">{{ replyToContent }}</div>
      </div>

      <!-- Reply Input -->
      <div class="reply-section">
        <n-input
          v-model:value="replyText"
          type="textarea"
          :placeholder="t('message.replyPlaceholder')"
          :autosize="{ minRows: 3, maxRows: 8 }"
          :maxlength="maxLength"
          show-count
          size="large"
          ref="inputRef"
          @keyup.enter.ctrl="sendReply"
        />
      </div>

      <!-- Info -->
      <n-alert type="info" :show-icon="true" class="reply-info">
        <template #icon>
          <n-icon><InfoCircle /></n-icon>
        </template>
        {{ t('message.replyInfo') }}
      </n-alert>

      <!-- Actions -->
      <template #footer>
        <n-space vertical>
          <n-button
            type="primary"
            block
            size="large"
            :loading="sending"
            :disabled="!replyText.trim()"
            @click="sendReply"
          >
            <template #icon>
              <n-icon><Send /></n-icon>
            </template>
            {{ t('message.send') }}
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
import { Send, InfoCircle } from '@vicons/tabler'
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
  }

  .reply-info {
    margin-bottom: 12px;
    font-size: 12px;
  }
}
</style>
