<!--
  Message Edit Dialog

  Allow editing previously sent messages using Matrix SDK's
  m.new_content event relationship for message editing.

  SDK Integration:
  - client.sendMessage() with m.relates_to for edits
-->
<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { NModal, NInput, NButton, NSpace, NSpin, NCard, useMessage } from 'naive-ui'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import { useI18n } from 'vue-i18n'
import { sendMessage } from '@/utils/matrixClientUtils'

interface Props {
  show: boolean
  roomId: string
  eventId: string
  originalContent: string
  eventType?: string
}

const props = withDefaults(defineProps<Props>(), {
  eventType: 'm.room.message'
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  edited: [eventId: string, newContent: string]
  cancel: []
}>()

const message = useMessage()
const { t } = useI18n()

// State
const editing = ref(false)
const editContent = ref(props.originalContent)
const inputRef = ref<HTMLInputElement | null>(null)

/**
 * Convert plain text to Matrix message content
 */
function createMessageContent(text: string): Record<string, unknown> {
  return {
    msgtype: 'm.text',
    body: text
  }
}

/**
 * Send edited message using SDK's m.new_content
 */
async function saveEdit() {
  if (!editContent.value.trim()) {
    message.warning(t('matrix.messageEdit.cannotBeEmpty'))
    return
  }

  if (editContent.value === props.originalContent) {
    // No changes, just close
    closeDialog()
    return
  }

  editing.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    logger.info('[MessageEditDialog] Editing message:', {
      eventId: props.eventId,
      roomId: props.roomId,
      originalContent: props.originalContent,
      newContent: editContent.value
    })

    // Create the new content
    const newContent = createMessageContent(editContent.value)

    // Matrix message edit format uses m.relates_to with rel_type: m.replace
    const editEventContent = {
      'm.new_content': newContent,
      body: editContent.value, // Fallback for clients that don't support edits
      'm.relates_to': {
        rel_type: 'm.replace',
        event_id: props.eventId
      },
      msgtype: 'm.text'
    }

    // Send the edit event
    await sendMessage(client, props.roomId, editEventContent, 'm.room.message')

    logger.info('[MessageEditDialog] Message edited successfully')

    message.success(t('matrix.messageEdit.editedSuccess'))

    emit('edited', props.eventId, editContent.value)
    closeDialog()
  } catch (error) {
    logger.error('[MessageEditDialog] Failed to edit message:', error)
    message.error(t('matrix.messageEdit.editFailed'))
  } finally {
    editing.value = false
  }
}

/**
 * Cancel editing
 */
function cancelEdit() {
  emit('cancel')
  closeDialog()
}

/**
 * Close dialog
 */
function closeDialog() {
  emit('update:show', false)
}

/**
 * Handle keyboard shortcuts
 */
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    // Cmd+Enter or Ctrl+Enter to save
    event.preventDefault()
    saveEdit()
  } else if (event.key === 'Escape') {
    // Escape to cancel
    event.preventDefault()
    cancelEdit()
  }
}

// Watch for show changes to focus input
watch(
  () => props.show,
  async (show) => {
    if (show) {
      // Reset content when opening
      editContent.value = props.originalContent
      // Focus input after render
      await nextTick()
      inputRef.value?.focus()
      inputRef.value?.select()
    }
  }
)
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="t('matrix.messageEdit.title')"
    class="w-600px"
    :mask-closable="false"
    :closable="!editing"
    @update:show="closeDialog">
    <div class="message-edit-dialog">
      <!-- Original Message -->
      <div class="message-edit-dialog__original">
        <div class="label">{{ t('matrix.messageEdit.originalMessage') }}:</div>
        <div class="content">{{ originalContent }}</div>
      </div>

      <!-- Edit Input -->
      <div class="message-edit-dialog__edit">
        <div class="label">{{ t('matrix.messageEdit.editTo') }}:</div>
        <NInput
          ref="inputRef"
          v-model:value="editContent"
          type="textarea"
          :placeholder="t('matrix.messageEdit.placeholder')"
          :rows="6"
          :disabled="editing"
          @keydown="handleKeydown" />
      </div>

      <!-- Hints -->
      <div class="message-edit-dialog__hints">
        <NSpace vertical :size="4">
          <div class="hint">
            <kbd>Ctrl</kbd>
            +
            <kbd>Enter</kbd>
            {{ t('matrix.messageEdit.ctrlEnterToSave') }}
          </div>
          <div class="hint">
            <kbd>Esc</kbd>
            {{ t('matrix.messageEdit.escToCancel') }}
          </div>
        </NSpace>
      </div>
    </div>

    <!-- Actions -->
    <template #footer>
      <NSpace justify="end">
        <NButton :disabled="editing" @click="cancelEdit">{{ t('matrix.messageEdit.cancel') }}</NButton>
        <NButton type="primary" :disabled="!editContent.trim()" :loading="editing" @click="saveEdit">
          <template #icon>
            <span v-if="!editing">✓</span>
          </template>
          {{ editing ? t('matrix.messageEdit.saving') : t('matrix.messageEdit.save') }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.message-edit-dialog {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.message-edit-dialog__original,
.message-edit-dialog__edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label {
  font-size: 13px;
  font-weight: 500;
  color: var(--hula-gray-700);
}

.message-edit-dialog__original .content {
  padding: 12px;
  background: var(--hula-gray-100, var(--hula-brand-primary));
  border-radius: 6px;
  font-size: 14px;
  color: var(--hula-gray-900);
  white-space: pre-wrap;
  word-break: break-word;
}

.message-edit-dialog__hints {
  display: flex;
  justify-content: flex-end;
}

.hint {
  font-size: 12px;
  color: var(--hula-gray-400);
  display: flex;
  align-items: center;
  gap: 4px;
}

.hint kbd {
  padding: 2px 6px;
  background: var(--hula-gray-200);
  border: 1px solid var(--hula-gray-300);
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .label {
    color: var(--hula-gray-400);
  }

  .message-edit-dialog__original .content {
    background: var(--hula-gray-800, var(--hula-brand-primary));
    color: var(--hula-gray-200);
  }

  .hint {
    color: var(--hula-gray-700);
  }

  .hint kbd {
    background: var(--hula-gray-900);
    border-color: var(--hula-gray-700);
  }
}
</style>
