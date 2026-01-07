<template>
  <div class="flex flex-col overflow-hidden h-full relative">
    <!-- PrivateChat 提示信息 -->
    <n-flex
      align="center"
      justify="center"
      class="z-999 w-full h-40px rounded-4px text-(12px [--brand-text]) bg-[--brand-bg] flex-shrink-0">
      <svg class="size-16px">
        <use href="#lock"></use>
      </svg>
      {{ t('privateChat.header.encrypted_chat') }}
    </n-flex>

    <!-- 聊天内容 -->
    <div class="flex flex-col flex-1 min-h-0">
      <div
        ref="scrollContainer"
        class="scrollbar-container"
        @scroll="handleScroll">
        <!-- 消息列表 -->
        <div class="message-list min-h-full flex flex-col p-[14px_10px]">
          <!-- 空状态 -->
          <div v-if="!isLoading && messages.length === 0" class="flex-center size-full">
            <n-empty description="暂无消息，开始聊天吧">
              <template #extra>
                <n-button size="small" @click="handleStartChat">发送第一条消息</n-button>
              </template>
            </n-empty>
          </div>

          <!-- 加载状态 -->
          <div v-if="isLoading" class="flex-center size-full">
            <n-spin size="large">
              <template #description>加载消息中...</template>
            </n-spin>
          </div>

          <!-- 消息内容 -->
          <n-flex
            v-for="(message, index) in messages"
            :key="message.message_id"
            vertical
            class="flex-y-center mb-12px"
            :data-message-id="message.message_id"
            :data-message-index="index">
            <!-- 时间分隔符 -->
            <span
              v-if="shouldShowTimeDivider(message, index)"
              class="text-(12px #909090) select-none p-4px mx-auto">
              {{ formatMessageTime(message.created_at) }}
            </span>

            <!-- 消息气泡 -->
            <div
              :class="[
                'w-full box-border min-h-62px flex',
                message.is_own ? 'justify-end' : 'justify-start'
              ]">
              <div
                :class="[
                  'message-bubble max-w-70% p-[10px_14px] rounded-8px',
                  message.is_own
                    ? 'bg-brand text-white'
                    : 'bg-[--chat-bubble-bg] text-[--text-color]'
                ]">
                <!-- 发送者名称（仅群聊或对方消息显示） -->
                <div
                  v-if="!message.is_own"
                  class="text-(12px [--chat-bubble-name]) mb-4px opacity-70">
                  {{ getSenderName(message) }}
                </div>

                <!-- 消息内容 -->
                <div class="text-(14px) break-words">
                  {{ message.content }}
                </div>

                <!-- 时间戳 -->
                <div
                  :class="[
                    'text-(10px) mt-4px opacity-70',
                    message.is_own ? 'text-right' : 'text-left'
                  ]">
                  {{ formatMessageTime(message.created_at) }}
                  <span v-if="message.is_own" class="ml-4px">
                    {{ message.status === 'sent' ? '✓' : message.status === 'delivered' ? '✓✓' : '↺' }}
                  </span>
                </div>
              </div>
            </div>
          </n-flex>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePrivateChatSDKStore, type PrivateChatMessageWithUI } from '@/stores/privateChatSDK'
import { useGlobalStore } from '@/stores/global'
import { extractPrivateChatSessionId } from '@/utils/privateChatMapper'
import { useMitt } from '@/hooks/useMitt'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const privateChatStore = usePrivateChatSDKStore()
const globalStore = useGlobalStore()

const scrollContainer = ref<HTMLElement | null>(null)
const isLoading = ref(false)

// 当前会话消息
const messages = computed(() => {
  const currentSessionId = globalStore.currentSessionRoomId
  if (!currentSessionId) return []

  const sessionId = extractPrivateChatSessionId(currentSessionId)
  if (!sessionId) return []

  return privateChatStore.messages.get(sessionId) || []
})

// 获取发送者名称
const getSenderName = (message: PrivateChatMessageWithUI): string => {
  // 对于 PrivateChat，可以显示发送者 ID 或从用户资料获取显示名称
  return message.sender_id || '未知用户'
}

// 格式化消息时间
const formatMessageTime = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`

  // 显示具体日期
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours().toString().padStart(2, '0')
  const minute = date.getMinutes().toString().padStart(2, '0')
  return `${month}/${day} ${hour}:${minute}`
}

// 判断是否显示时间分隔符（两条消息间隔超过5分钟）
const shouldShowTimeDivider = (message: PrivateChatMessageWithUI, index: number): boolean => {
  if (index === 0) return true
  const prevMessage = messages.value[index - 1]
  if (!prevMessage) return true

  const currentTimestamp = Date.parse(message.created_at)
  const prevTimestamp = Date.parse(prevMessage.created_at)
  const diffMs = currentTimestamp - prevTimestamp

  return diffMs > 5 * 60 * 1000 // 5分钟
}

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    const container = scrollContainer.value
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  })
}

// 处理滚动事件
const handleScroll = () => {
  // 可以在这里实现加载更多消息的逻辑
}

// 开始聊天
const handleStartChat = () => {
  // 聚焦到输入框
  useMitt.emit('focus-input')
}

// 监听当前会话变化，加载消息
watch(
  () => globalStore.currentSessionRoomId,
  async (newRoomId, _oldRoomId) => {
    if (!newRoomId) return

    const sessionId = extractPrivateChatSessionId(newRoomId)
    if (!sessionId) return // 不是 PrivateChat 会话

    // 加载消息
    if (!privateChatStore.messages.has(sessionId)) {
      isLoading.value = true
      try {
        await privateChatStore.fetchMessages(sessionId, 50)
        scrollToBottom()
      } catch (error) {
        logger.error('[PrivateChatMain] Failed to load messages:', error)
      } finally {
        isLoading.value = false
      }
    } else {
      scrollToBottom()
    }
  },
  { immediate: true }
)

// 监听消息变化，自动滚动到底部（如果是用户自己发的消息）
watch(messages, (newMessages) => {
  const lastMessage = newMessages[newMessages.length - 1]
  if (lastMessage && lastMessage.is_own) {
    scrollToBottom()
  }
})

// 组件挂载后滚动到底部
onMounted(() => {
  scrollToBottom()
})
</script>

<style scoped lang="scss">
.scrollbar-container {
  overflow-y: auto;
  overflow-x: hidden;
  height: 100%;
}

.message-list {
  padding: 14px 10px;
}

.message-bubble {
  word-wrap: break-word;
  white-space: pre-wrap;
}
</style>
