<template>
  <div class="private-chat-footer flex flex-col gap-8px p-[10px_16px_16px_16px] border-t-1px border-[--right-chat-footer-line-color]">
    <!-- 消息自毁设置 -->
    <div v-if="showSelfDestructSettings" class="flex items-center gap-8px px-8px">
      <n-flex :size="8" align="center">
        <span class="text-(12px [--chat-text-color])">消息自毁：</span>
        <n-select
          v-model:value="selfDestructTime"
          :options="selfDestructOptions"
          size="tiny"
          class="self-destruct-select"
          @update:value="handleSelfDestructChange" />
        <n-switch v-model:value="enableSelfDestruct" size="small" />
      </n-flex>
    </div>

    <!-- 输入区域 -->
    <div class="flex items-end gap-8px">
      <!-- 更多操作按钮 -->
      <n-tooltip placement="top">
        <template #trigger>
          <n-button circle size="small" @click="handleMoreActions">
            <template #icon>
              <svg class="size-18px">
                <use href="#plus"></use>
              </svg>
            </template>
          </n-button>
        </template>
        更多
      </n-tooltip>

      <!-- 输入框 -->
      <n-input
        ref="inputRef"
        v-model:value="messageContent"
        type="textarea"
        :autosize="{ minRows: 1, maxRows: 4 }"
        placeholder="输入消息..."
        @keydown="handleKeyDown"
        @focus="handleFocus"
        @blur="handleBlur" />

      <!-- 发送按钮 -->
      <n-button type="primary" :disabled="!canSend" :loading="isSending" @click="handleSend">
        <template #icon>
          <svg class="size-18px">
            <use href="#send"></use>
          </svg>
        </template>
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePrivateChatSDKStore } from '@/stores/privateChatSDK'
import { useGlobalStore } from '@/stores/global'
import { extractPrivateChatSessionId } from '@/utils/privateChatMapper'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const privateChatStore = usePrivateChatSDKStore()
const globalStore = useGlobalStore()

const inputRef = ref<HTMLElement | null>(null)
const messageContent = ref('')
const isSending = ref(false)
const showSelfDestructSettings = ref(false)
const enableSelfDestruct = ref(false)
const selfDestructTime = ref(300) // 默认 5 分钟

// 消息自毁时间选项
const selfDestructOptions = [
  { label: '30秒', value: 30 },
  { label: '1分钟', value: 60 },
  { label: '5分钟', value: 300 },
  { label: '30分钟', value: 1800 },
  { label: '1小时', value: 3600 },
  { label: '1天', value: 86400 }
]

// 是否可以发送
const canSend = computed(() => messageContent.value.trim().length > 0 && !isSending.value)

// 当前会话 ID
const currentSessionId = computed(() => {
  const roomId = globalStore.currentSessionRoomId
  if (!roomId) return null
  return extractPrivateChatSessionId(roomId)
})

// 发送消息
const handleSend = async () => {
  if (!canSend.value || !currentSessionId.value) return

  const content = messageContent.value.trim()
  if (!content) return

  isSending.value = true

  try {
    await privateChatStore.sendMessage(content, 'text')
    messageContent.value = ''
    msg.success(t('privateChat.message_sent'))
  } catch (error) {
    msg.error(t('privateChat.send_failed'))
    logger.error('[PrivateChatFooter] Failed to send message:', error)
  } finally {
    isSending.value = false
  }
}

// 处理键盘事件
const handleKeyDown = (e: KeyboardEvent) => {
  // Enter 发送，Shift+Enter 换行
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

// 更多操作
const handleMoreActions = () => {
  showSelfDestructSettings.value = !showSelfDestructSettings.value
}

// 自毁时间变更
const handleSelfDestructChange = (value: number) => {
  selfDestructTime.value = value
}

// 聚焦
const handleFocus = () => {
  // 通知父组件输入框已聚焦
}

// 失焦
const handleBlur = () => {
  // 通知父组件输入框已失焦
}

// 监听会话变化，清空输入框
watch(currentSessionId, () => {
  messageContent.value = ''
})
</script>

<style scoped lang="scss">
.private-chat-footer {
  background: var(--right-chat-footer-bg);

  .self-destruct-select {
    width: 140px;
  }
}
</style>
