<template>
  <n-modal
    v-model:show="showDialog"
    preset="dialog"
    :title="$t('message.selfDestruct.createPrivateChat')"
    style="width: 480px; max-width: 90vw"
    @close="handleClose">
    <div class="private-chat-setup">
      <!-- 参与者选择 -->
      <div class="setup-section">
        <h4 class="section-title">
          <Icon icon="mdi:account-multiple" />
          {{ $t('message.selfDestruct.participants') }}
        </h4>
        <UserSelector
          v-model="selectedParticipants"
          :multiple="true"
          :placeholder="$t('message.selfDestruct.selectParticipants')"
          :max="10"
          class="participant-selector" />
        <div class="participant-count">
          {{ selectedParticipants.length }}/10 {{ $t('message.selfDestruct.participants') }}
        </div>
      </div>

      <!-- 聊天名称 -->
      <div class="setup-section">
        <h4 class="section-title">
          <Icon icon="mdi:chat" />
          {{ $t('message.selfDestruct.chatName') }}
        </h4>
        <n-input
          v-model:value="chatName"
          :placeholder="$t('message.selfDestruct.chatNamePlaceholder')"
          :maxlength="20"
          show-count />
      </div>

      <!-- 安全设置 -->
      <div class="setup-section">
        <h4 class="section-title">
          <Icon icon="mdi:shield-check" />
          {{ $t('message.selfDestruct.securitySettings') }}
        </h4>
        <n-radio-group v-model:value="encryptionLevel" class="encryption-options">
          <n-radio value="standard" class="encryption-option">
            <div class="option-content">
              <div class="option-header">
                <Icon icon="mdi:lock" />
                {{ $t('message.selfDestruct.encryptionLevel.standard') }}
              </div>
              <div class="option-desc">{{ $t('message.selfDestruct.standardDesc') }}</div>
            </div>
          </n-radio>
          <n-radio value="high" class="encryption-option">
            <div class="option-content">
              <div class="option-header">
                <Icon icon="mdi:shield-lock" />
                {{ $t('message.selfDestruct.encryptionLevel.high') }}
              </div>
              <div class="option-desc">{{ $t('message.selfDestruct.highDesc') }}</div>
            </div>
          </n-radio>
        </n-radio-group>
      </div>

      <!-- 自毁时间设置 -->
      <div class="setup-section">
        <h4 class="section-title">
          <Icon icon="mdi:timer" />
          {{ $t('message.selfDestruct.defaultSelfDestruct') }}
        </h4>
        <div class="timer-options">
          <n-select
            v-model:value="selfDestructTime"
            :options="selfDestructOptions"
            :placeholder="$t('message.selfDestruct.selectTime')"
            clearable />
          <n-switch
            v-model:value="enableDefaultSelfDestruct"
            :rail-style="railStyle">
            <template #checked>{{ $t('common.enabled') }}</template>
            <template #unchecked>{{ $t('common.disabled') }}</template>
          </n-switch>
        </div>
      </div>

      <!-- 聊天描述 -->
      <div class="setup-section">
        <h4 class="section-title">
          <Icon icon="mdi:text" />
          {{ $t('message.selfDestruct.topic') }}
        </h4>
        <n-input
          v-model:value="chatTopic"
          type="textarea"
          :placeholder="$t('message.selfDestruct.topicPlaceholder')"
          :maxlength="100"
          show-count
          :rows="3" />
      </div>
    </div>

    <template #action>
      <div class="dialog-actions">
        <n-button @click="handleClose" :disabled="creating">
          {{ $t('common.cancel') }}
        </n-button>
        <n-button type="primary" @click="handleCreatePrivateChat" :loading="creating" :disabled="!canCreate">
          {{ $t('message.selfDestruct.createChat') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { usePrivateChatStore } from '@/stores/privateChat'
import { useGroupStore } from '@/stores/group'

import { useI18n } from 'vue-i18n'
import UserSelector from '@/components/common/UserSelector.vue'

import { msg } from '@/utils/SafeUI'
import { logger, toError } from '@/utils/logger' // Props
const props = defineProps<{
  show: boolean
}>()

// Emits
const emit = defineEmits<{
  'update:show': [value: boolean]
  'chat-created': [roomId: string]
}>()

// Composables
const { t } = useI18n()
const privateChatStore = usePrivateChatStore()
const groupStore = useGroupStore()
const message = msg

// 响应式数据
const showDialog = ref(props.show)
const selectedParticipants = ref<string[]>([])
const chatName = ref('')
const encryptionLevel = ref<'standard' | 'high'>('standard')
const selfDestructTime = ref(300) // 默认5分钟
const enableDefaultSelfDestruct = ref(false)
const chatTopic = ref('')
const creating = ref(false)

// 自毁时间选项
const selfDestructOptions = [
  { label: t('message.selfDestruct.timeOptions.30s'), value: 30 },
  { label: t('message.selfDestruct.timeOptions.1m'), value: 60 },
  { label: t('message.selfDestruct.timeOptions.5m'), value: 300 },
  { label: t('message.selfDestruct.timeOptions.30m'), value: 1800 },
  { label: t('message.selfDestruct.timeOptions.1h'), value: 3600 },
  { label: t('message.selfDestruct.timeOptions.1d'), value: 86400 },
  { label: t('message.selfDestruct.timeOptions.1w'), value: 604800 }
]

// 计算属性
const canCreate = computed(() => {
  return selectedParticipants.value.length >= 1 && !creating.value
})

// 方法
const handleClose = () => {
  showDialog.value = false
  emit('update:show', false)
}

const resetForm = () => {
  selectedParticipants.value = []
  chatName.value = ''
  encryptionLevel.value = 'standard'
  selfDestructTime.value = 300
  enableDefaultSelfDestruct.value = false
  chatTopic.value = ''
  creating.value = false
}

const railStyle = ({ checked }: { focused: boolean; checked: boolean }) => {
  return {
    backgroundColor: checked ? '#4ade80' : '#d1d5db'
  }
}

const handleCreatePrivateChat = async () => {
  if (!canCreate.value) return

  creating.value = true

  try {
    const options: {
      name?: string
      encryptionLevel: 'high' | 'standard'
      selfDestructDefault?: number
      topic?: string
    } = {
      encryptionLevel: encryptionLevel.value
    }

    // Only add optional properties if they have values
    if (chatName.value) {
      options.name = chatName.value
    }
    if (enableDefaultSelfDestruct.value) {
      options.selfDestructDefault = selfDestructTime.value
    }
    if (chatTopic.value) {
      options.topic = chatTopic.value
    }

    const roomId = await privateChatStore.createPrivateChat(selectedParticipants.value, options)

    message.success(t('message.selfDestruct.chatCreatedSuccess'))

    // 清空表单
    resetForm()

    // 关闭对话框
    handleClose()

    // 发出成功事件
    emit('chat-created', roomId)
  } catch (error) {
    logger.error('[PrivateChatDialog] Failed to create private chat:', toError(error))
    message.error(t('message.selfDestruct.createChatFailed'))
  } finally {
    creating.value = false
  }
}

// 生成默认聊天名称
const generateDefaultChatName = () => {
  if (selectedParticipants.value.length === 0) return ''

  const names = selectedParticipants.value.slice(0, 3).map((uid) => {
    const user = groupStore.getUserInfo(uid)
    return user?.name || `用户${uid}`
  })

  const suffix = selectedParticipants.value.length > 3 ? ` 等${selectedParticipants.value.length}人` : ''

  return names.join(', ') + suffix
}

// 监听参与者变化，自动生成聊天名称
watch(
  selectedParticipants,
  (newParticipants) => {
    if (!chatName.value && newParticipants.length > 0) {
      chatName.value = generateDefaultChatName()
    }
  },
  { immediate: true }
)

// 监听props.show变化
watch(
  () => props.show,
  (newShow) => {
    showDialog.value = newShow
    if (!newShow) {
      resetForm()
    }
  }
)
</script>

<style scoped lang="scss">
.private-chat-setup {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 4px 0;
}

.setup-section {
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
    color: #333;

    .iconify {
      font-size: 16px;
      color: #666;
    }
  }

  .participant-selector {
    margin-bottom: 8px;
  }

  .participant-count {
    font-size: 12px;
    color: #666;
    text-align: right;
  }

  .encryption-options {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .encryption-option {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      transition: all 0.2s ease;

      &:hover {
        border-color: #13987f;
        background-color: rgba(19, 152, 127, 0.05);
      }

      &.n-radio--checked {
        border-color: #13987f;
        background-color: rgba(19, 152, 127, 0.1);
      }

      .option-content {
        margin-left: 24px;

        .option-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          margin-bottom: 4px;

          .iconify {
            font-size: 16px;
          }
        }

        .option-desc {
          font-size: 12px;
          color: #666;
          line-height: 1.4;
        }
      }
    }
  }

  .timer-options {
    display: flex;
    align-items: center;
    gap: 12px;

    .n-select {
      flex: 1;
    }
  }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  width: 100%;
}

// 响应式设计
@media (max-width: 640px) {
  .private-chat-setup {
    gap: 16px;
  }

  .timer-options {
    flex-direction: column;
    align-items: stretch !important;
  }

  .dialog-actions {
    flex-direction: column;

    .n-button {
      width: 100%;
    }
  }
}
</style>
