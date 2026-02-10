<template>
  <div class="private-chat-window flex flex-col h-full">
    <!-- 头部 -->
    <div class="chat-header flex items-center p-12px border-b border-[--divider-color] bg-[--bg-secondary-color]">
      <n-flex align="center" justify="space-between" class="w-full">
        <n-flex align="center" :size="12">
          <n-button quaternary circle @click="handleBack">
            <template #icon>
              <svg class="size-18px text-[--text-color]">
                <use href="#back"></use>
              </svg>
            </template>
          </n-button>
          <div class="private-chat-icon w-36px h-36px rounded-50% bg-[--primary-color] flex-center">
            <svg class="size-18px text-white">
              <use href="#lock"></use>
            </svg>
          </div>
          <div>
            <h3 class="text-16px font-bold text-[--text-color]">
              {{ session?.name || sessionName }}
            </h3>
            <n-flex align="center" :size="4">
              <span class="text-12px text-[--info-text-color]">{{ t('private_chat.encrypted_chat') }}</span>
              <svg class="size-12px text-[--success-color]">
                <use href="#shield"></use>
              </svg>
            </n-flex>
          </div>
        </n-flex>
        <n-flex :size="8">
          <n-button quaternary circle @click="handleSearchMessages">
            <template #icon>
              <svg class="size-18px text-[--text-color]">
                <use href="#search"></use>
              </svg>
            </template>
          </n-button>
          <n-button quaternary circle @click="handleSessionInfo">
            <template #icon>
              <svg class="size-18px text-[--text-color]">
                <use href="#info"></use>
              </svg>
            </template>
          </n-button>
        </n-flex>
      </n-flex>
    </div>

    <!-- 加密提示横幅 -->
    <div class="encryption-banner bg-[--success-bg] p-8px text-center">
      <n-flex align="center" justify="center" :size="8">
        <svg class="size-14px text-[--success-color]">
          <use href="#shield"></use>
        </svg>
        <span class="text-12px text-[--success-text-color]">
          {{ t('private_chat.encryption_notice') }}
        </span>
      </n-flex>
    </div>

    <!-- 消息列表 -->
    <div ref="scrollContainer" class="message-container flex-1 overflow-hidden" @scroll="handleScroll">
      <div class="message-list min-h-full p-12px">
        <div v-if="loading" class="flex-center p-24px">
          <n-spin size="small" />
          <span class="ml-8px text-14px text-[--info-text-color]">{{ t('common.loading') }}</span>
        </div>

        <div v-else-if="messages.length === 0" class="flex-center p-24px">
          <n-empty :description="t('private_chat.no_messages')">
            <template #extra>
              <p class="text-14px text-[--info-text-color]">{{ t('private_chat.send_first_message') }}</p>
            </template>
          </n-empty>
        </div>

        <template v-else>
          <div
            v-for="message in messages"
            :key="message.messageId"
            class="message-item mb-12px"
            :class="{ 'message-own': message.senderId === currentUserId }">
            <n-flex
              :align="'flex-start'"
              :justify="message.senderId === currentUserId ? 'flex-end' : 'flex-start'"
              :size="8">
              <n-avatar v-if="message.senderId !== currentUserId" :size="32" round :src="getAvatar(message.senderId)" />
              <div
                class="message-bubble max-w-70% p-8px rounded-12px"
                :class="[
                  message.senderId === currentUserId
                    ? 'bg-[--primary-color] text-white'
                    : 'bg-[--bg-menu-hover] text-[--text-color]'
                ]">
                <div v-if="message.messageType === 'text'" class="message-content text-14px">
                  {{ message.content }}
                </div>
                <div v-else-if="message.messageType === 'image'" class="message-image">
                  <img :src="message.content" class="max-w-200px rounded-8px" />
                </div>
                <div v-else-if="message.messageType === 'file'" class="message-file flex items-center gap-8px">
                  <svg class="size-20px">
                    <use href="#file"></use>
                  </svg>
                  <span class="text-12px truncate max-w-120px">{{ message.content }}</span>
                </div>
                <div
                  v-else-if="message.messageType === 'audio' || message.messageType === 'voice'"
                  class="message-audio">
                  <n-button quaternary circle size="small">
                    <template #icon>
                      <svg class="size-16px">
                        <use href="#play"></use>
                      </svg>
                    </template>
                  </n-button>
                  <span class="text-12px">{{ Math.round((message.metadata?.duration || 0) / 1000) }}s</span>
                </div>
                <div class="message-time text-10px mt-4px opacity-70">
                  {{ formatTime(message.timestamp) }}
                </div>
              </div>
            </n-flex>
          </div>
        </template>
      </div>
    </div>

    <!-- 搜索面板 -->
    <div v-if="showSearchPanel" class="search-panel p-12px border-t border-[--divider-color] bg-[--bg-color]">
      <n-input
        v-model:value="searchQuery"
        :placeholder="t('private_chat.search_messages')"
        clearable
        @input="handleSearchInput" />
    </div>

    <!-- 输入区域 -->
    <div class="input-area p-12px border-t border-[--divider-color] bg-[--bg-secondary-color]">
      <n-flex :size="8" align="flex-end">
        <n-input
          v-model:value="messageContent"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 4 }"
          :placeholder="t('private_chat.message_placeholder')"
          @keydown.enter.exact.prevent="handleSendMessage" />
        <n-button type="primary" :loading="sending" :disabled="!messageContent.trim()" @click="handleSendMessage">
          <template #icon>
            <svg class="size-16px">
              <use href="#send"></use>
            </svg>
          </template>
        </n-button>
      </n-flex>
    </div>

    <!-- 会话详情面板 -->
    <n-drawer v-model:show="showInfoPanel" :width="360" placement="right">
      <n-drawer-content v-if="session" :title="t('private_chat.session_info')" closable>
        <div class="session-info">
          <div class="flex-center mb-16px">
            <n-avatar :size="64" round :src="getSessionAvatar()" />
          </div>
          <h4 class="text-16px font-bold text-center text-[--text-color] mb-16px">
            {{ session.name || sessionName }}
          </h4>
          <n-divider />
          <div class="session-stats">
            <div class="info-item flex justify-between py-8px">
              <span class="text-[--info-text-color]">{{ t('private_chat.participants_count') }}</span>
              <span class="text-[--text-color]">{{ session.memberCount }}</span>
            </div>
          </div>
          <n-divider />
          <n-button block type="error" ghost @click="handleLeaveSession">
            {{ t('private_chat.leave_session') }}
          </n-button>
        </div>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGroupStore } from '@/stores/group'
import MatrixClientService from '@/services/matrix/MatrixClientService'
import ChatroomService, { type Chatroom, type ChatroomMessage } from '@/services/matrix/ChatroomService'
import { formatTime } from '@/utils/ComputedTime'

const { t } = useI18n()
const groupStore = useGroupStore()

const props = defineProps<{
  session: Chatroom
}>()

const emit = defineEmits<(e: 'close') => void>()

const loading = ref(true)
const sending = ref(false)
const messages = ref<ChatroomMessage[]>([])
const messageContent = ref('')
const currentUserId = ref('')
const scrollContainer = ref<HTMLElement | null>(null)
const showSearchPanel = ref(false)
const searchQuery = ref('')
const showInfoPanel = ref(false)
const sessionName = ref('')

const loadMessages = async () => {
  loading.value = true
  try {
    messages.value = await ChatroomService.getInstance().getMessages(props.session.roomId, { limit: 50 })
    await nextTick()
    scrollToBottom()
  } catch (error) {
    console.error('[PrivateChatWindow] Failed to load messages:', error)
  } finally {
    loading.value = false
  }
}

const handleSendMessage = async () => {
  if (!messageContent.value.trim() || sending.value) return

  sending.value = true
  const content = messageContent.value
  messageContent.value = ''

  try {
    await ChatroomService.getInstance().sendMessage(props.session.roomId, {
      body: content,
      msgtype: 'm.text'
    })
    await loadMessages()
  } catch (error) {
    console.error('[PrivateChatWindow] Failed to send message:', error)
    messageContent.value = content
    window.$message.error(t('private_chat.send_failed'))
  } finally {
    sending.value = false
  }
}

const handleBack = () => {
  emit('close')
}

const handleSearchMessages = () => {
  showSearchPanel.value = !showSearchPanel.value
  if (!showSearchPanel.value) {
    searchQuery.value = ''
  }
}

const handleSearchInput = async () => {
  if (!searchQuery.value) return
  try {
    messages.value = await ChatroomService.getInstance().searchMessages(props.session.roomId, searchQuery.value)
  } catch (error) {
    console.error('[PrivateChatWindow] Failed to search messages:', error)
  }
}

const handleSessionInfo = () => {
  showInfoPanel.value = true
}

const handleLeaveSession = async () => {
  window.$dialog.warning({
    title: t('private_chat.leave_session_confirm'),
    content: t('private_chat.leave_session_confirm_content'),
    positiveText: t('private_chat.leave_session'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await ChatroomService.getInstance().leaveRoom(props.session.roomId)
        window.$message.success(t('private_chat.leave_success'))
        emit('close')
      } catch (error) {
        console.error('[PrivateChatWindow] Failed to leave session:', error)
        window.$message.error(t('private_chat.leave_failed'))
      }
    }
  })
}

const scrollToBottom = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
  }
}

const handleScroll = () => {}

const getAvatar = (userId: string): string => {
  const user = groupStore.getUserInfo(userId)
  return user?.avatar || ''
}

const getParticipantName = (userId: string): string => {
  const user = groupStore.getUserInfo(userId)
  return user?.name || userId
}

const getSessionAvatar = (): string => {
  return props.session.avatarUrl || ''
}

onMounted(async () => {
  const clientService = MatrixClientService.getInstance()
  const client = clientService.getClient()
  currentUserId.value = client?.getUserId() || ''

  sessionName.value = props.session.name || 'Chat'

  await loadMessages()
})

watch(
  () => props.session,
  async () => {
    await loadMessages()
  }
)
</script>

<style lang="scss" scoped>
.private-chat-window {
  background: var(--bg-color);
}

.encryption-banner {
  background: var(--success-bg);
}

.message-bubble {
  word-break: break-word;
}

.message-own {
  .message-bubble {
    border-bottom-right-radius: 4px;
  }
}

.participant-item {
  border-bottom: 1px solid var(--divider-color);

  &:last-child {
    border-bottom: none;
  }
}
</style>
