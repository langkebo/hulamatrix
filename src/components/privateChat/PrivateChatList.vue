<template>
  <div class="private-chat-container flex flex-col h-full">
    <!-- 头部 -->
    <div class="private-chat-header flex items-center p-12px border-b border-[--divider-color]">
      <n-flex align="center" justify="space-between" class="w-full">
        <n-flex align="center" :size="12">
          <div class="private-chat-icon w-40px h-40px rounded-50% bg-[--primary-color] flex-center">
            <svg class="size-20px text-white">
              <use href="#lock"></use>
            </svg>
          </div>
          <div>
            <h3 class="text-16px font-bold text-[--text-color]">{{ t('private_chat.title') }}</h3>
            <p class="text-12px text-[--info-text-color]">{{ t('private_chat.subtitle') }}</p>
          </div>
        </n-flex>
        <n-flex :size="8">
          <n-button quaternary circle @click="handleSearch">
            <template #icon>
              <svg class="size-18px text-[--text-color]">
                <use href="#search"></use>
              </svg>
            </template>
          </n-button>
          <n-button quaternary circle @click="handleCreateSession">
            <template #icon>
              <svg class="size-18px text-[--text-color]">
                <use href="#add"></use>
              </svg>
            </template>
          </n-button>
        </n-flex>
      </n-flex>
    </div>

    <!-- 搜索框 -->
    <div v-if="showSearch" class="p-12px border-b border-[--divider-color]">
      <n-input
        v-model:value="searchQuery"
        :placeholder="t('private_chat.search_placeholder')"
        clearable
        @input="handleSearchInput">
        <template #prefix>
          <svg class="size-16px text-[--info-text-color]">
            <use href="#search"></use>
          </svg>
        </template>
      </n-input>
    </div>

    <!-- 会话列表 -->
    <div class="flex-1 overflow-hidden">
      <n-scrollbar>
        <div v-if="loading" class="flex-center p-24px">
          <n-spin size="small" />
          <span class="ml-8px text-14px text-[--info-text-color]">{{ t('common.loading') }}</span>
        </div>

        <div v-else-if="filteredSessions.length === 0" class="flex-center p-24px">
          <n-empty :description="t('private_chat.no_sessions')">
            <template #extra>
              <n-button type="primary" @click="handleCreateSession">
                {{ t('private_chat.create_session') }}
              </n-button>
            </template>
          </n-empty>
        </div>

        <div v-else class="session-list">
          <div
            v-for="session in filteredSessions"
            :key="session.roomId"
            class="session-item p-12px cursor-pointer hover:bg-[--bg-menu-hover] transition-colors"
            :class="{ 'bg-[--bg-menu-hover]': selectedSessionId === session.roomId }"
            @click="handleSelectSession(session)">
            <n-flex align="center" :size="12">
              <n-avatar
                :size="44"
                round
                :color="themes.content === ThemeEnum.DARK ? '' : '#fff'"
                :src="getSessionAvatar(session)"
                :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'" />
              <div class="flex-1 min-w-0">
                <n-flex justify="space-between" align="center">
                  <span class="font-bold text-14px text-[--text-color] truncate">
                    {{ session.name || getParticipantNames(session) }}
                  </span>
                  <span class="text-12px text-[--info-text-color]">
                    {{ formatTime(session.lastActive || '') }}
                  </span>
                </n-flex>
                <n-flex justify="space-between" align="center" class="mt-4px">
                  <span class="text-12px text-[--info-text-color] truncate flex-1">
                    {{ getLastMessagePreview(session) }}
                  </span>
                  <n-badge
                    v-if="session.unreadCount && session.unreadCount > 0"
                    :value="session.unreadCount"
                    :max="99"
                    class="ml-8px" />
                </n-flex>
              </div>
            </n-flex>
          </div>
        </div>
      </n-scrollbar>
    </div>

    <!-- 创建会话模态框 -->
    <n-modal
      v-model:show="showCreateModal"
      preset="card"
      :title="t('private_chat.create_session')"
      style="width: 480px">
      <div class="create-session-form">
        <div class="mb-16px">
          <label class="block text-14px font-medium text-[--text-color] mb-8px">
            {{ t('private_chat.session_name') }}
          </label>
          <n-input v-model:value="newSessionName" :placeholder="t('private_chat.session_name_placeholder')" />
        </div>
        <div class="mb-16px">
          <label class="block text-14px font-medium text-[--text-color] mb-8px">
            {{ t('private_chat.participants') }}
          </label>
          <n-select
            v-model:value="selectedParticipants"
            multiple
            filterable
            :placeholder="t('private_chat.select_participants')"
            :options="friendOptions" />
        </div>
        <div class="mb-16px">
          <n-flex align="center" :size="8">
            <n-switch v-model:value="isEncrypted" />
            <span class="text-14px text-[--text-color]">{{ t('private_chat.encrypted') }}</span>
          </n-flex>
        </div>
      </div>
      <template #footer>
        <n-flex justify="flex-end" :size="12">
          <n-button @click="showCreateModal = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="creating" @click="handleConfirmCreate">
            {{ t('private_chat.create') }}
          </n-button>
        </n-flex>
      </template>
    </n-modal>

    <!-- 私密聊天详情面板 -->
    <n-drawer v-model:show="showDetailPanel" :width="360" placement="right">
      <n-drawer-content v-if="selectedSession" :title="t('private_chat.session_details')" closable>
        <div class="session-detail">
          <div class="flex-center mb-16px">
            <n-avatar :size="64" round :src="getSessionAvatar(selectedSession)" />
          </div>
          <h4 class="text-16px font-bold text-center text-[--text-color] mb-16px">
            {{ selectedSession.name || getParticipantNames(selectedSession) }}
          </h4>
          <n-divider />
          <div class="detail-info">
            <div class="info-item">
              <span class="info-label">{{ t('private_chat.created_at') }}</span>
              <span class="info-value">{{ formatTime(selectedSession.lastActive || '') }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ t('private_chat.participants_count') }}</span>
              <span class="info-value">{{ selectedSession.memberCount }}</span>
            </div>
          </div>
          <n-divider />
          <n-flex vertical :size="12">
            <n-button block @click="handleOpenChat">
              <template #icon>
                <svg class="size-16px">
                  <use href="#chat"></use>
                </svg>
              </template>
              {{ t('private_chat.open_chat') }}
            </n-button>
            <n-button block type="error" ghost @click="handleCloseSession">
              <template #icon>
                <svg class="size-16px">
                  <use href="#close"></use>
                </svg>
              </template>
              {{ t('private_chat.close_session') }}
            </n-button>
          </n-flex>
        </div>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { ThemeEnum } from '@/enums'
import { useSettingStore } from '@/stores/setting'
import { useGroupStore } from '@/stores/group'
import ChatroomService, { type Chatroom } from '@/services/matrix/ChatroomService'
import FriendsService from '@/services/matrix/FriendsService'
import { formatTime, formatTtl } from '@/utils/ComputedTime'

const { t } = useI18n()
const settingStore = useSettingStore()
const groupStore = useGroupStore()
const { themes } = storeToRefs(settingStore)

const loading = ref(true)
const sessions = ref<Chatroom[]>([])
const selectedSessionId = ref<string | null>(null)
const searchQuery = ref('')
const showSearch = ref(false)
const showCreateModal = ref(false)
const showDetailPanel = ref(false)
const selectedSession = ref<Chatroom | null>(null)
const newSessionName = ref('')
const selectedParticipants = ref<string[]>([])
const isEncrypted = ref(true)
const creating = ref(false)
const friendOptions = ref<{ label: string; value: string }[]>([])

const filteredSessions = computed(() => {
  if (!searchQuery.value) {
    return sessions.value
  }
  const query = searchQuery.value.toLowerCase()
  return sessions.value.filter((session) => {
    const name = session.name?.toLowerCase() || ''
    // Chatroom doesn't list participants directly in search usually,
    // but we can try matching room name or topic
    return name.includes(query)
  })
})

const loadSessions = async () => {
  loading.value = true
  try {
    const result = await ChatroomService.getInstance().getChatrooms(1, 100)
    sessions.value = result.items.filter((r) => r.isDirect) // Only show direct chats
  } catch (error) {
    console.error('[PrivateChatList] Failed to load sessions:', error)
  } finally {
    loading.value = false
  }
}

const loadFriends = async () => {
  try {
    const result = await FriendsService.getInstance().getFriends()
    const friends = result.items
    friendOptions.value = friends.map((friend) => ({
      label: friend.displayName || friend.userId,
      value: friend.userId
    }))
  } catch (error) {
    console.error('[PrivateChatList] Failed to load friends:', error)
  }
}

const handleSearch = () => {
  showSearch.value = !showSearch.value
  if (!showSearch.value) {
    searchQuery.value = ''
  }
}

const handleSearchInput = () => {}

const handleCreateSession = () => {
  newSessionName.value = ''
  selectedParticipants.value = []
  showCreateModal.value = true
}

const handleConfirmCreate = async () => {
  if (selectedParticipants.value.length === 0) {
    window.$message.warning(t('private_chat.select_participants_warning'))
    return
  }

  creating.value = true
  try {
    const roomId = await ChatroomService.getInstance().createRoom({
      invite: selectedParticipants.value,
      name: newSessionName.value || undefined,
      isEncrypted: isEncrypted.value,
      isDirect: true
    })
    window.$message.success(t('private_chat.create_success'))
    showCreateModal.value = false
    await loadSessions()
    const session = sessions.value.find((s) => s.roomId === roomId)
    if (session) {
      selectedSessionId.value = roomId
      selectedSession.value = session
      showDetailPanel.value = true
    }
  } catch (error) {
    console.error('[PrivateChatList] Failed to create session:', error)
    window.$message.error(t('private_chat.create_failed'))
  } finally {
    creating.value = false
  }
}

const handleSelectSession = (session: Chatroom) => {
  selectedSessionId.value = session.roomId
  selectedSession.value = session
  showDetailPanel.value = true
}

const handleOpenChat = () => {
  if (selectedSession.value) {
    // Map Chatroom back to PrivateChatSession interface for compatibility if needed by parent
    // Or update parent to accept Chatroom
    emit('openChat', selectedSession.value as any)
    showDetailPanel.value = false
  }
}

const handleCloseSession = async () => {
  if (!selectedSession.value) return

  window.$dialog.warning({
    title: t('private_chat.close_session_confirm'),
    content: t('private_chat.close_session_confirm_content'),
    positiveText: t('private_chat.close_session'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await ChatroomService.getInstance().leaveRoom(selectedSession.value!.roomId)
        window.$message.success(t('private_chat.close_session_success'))
        showDetailPanel.value = false
        selectedSession.value = null
        await loadSessions()
      } catch (error) {
        console.error('[PrivateChatList] Failed to close session:', error)
        window.$message.error(t('private_chat.close_session_failed'))
      }
    }
  })
}

const getSessionAvatar = (session: Chatroom): string => {
  return session.avatarUrl || ''
}

const getParticipantNames = (session: Chatroom): string => {
  return session.name || 'Chat'
}

const getLastMessagePreview = (session: Chatroom): string => {
  return session.lastMessage || t('private_chat.no_messages')
}

const emit = defineEmits<(e: 'openChat', session: any) => void>()

onMounted(async () => {
  await loadSessions()
  await loadFriends()
})

watch(showDetailPanel, (val) => {
  if (!val) {
    selectedSession.value = null
  }
})
</script>

<style lang="scss" scoped>
.private-chat-container {
  background: var(--bg-color);
}

.private-chat-header {
  background: var(--bg-secondary-color);
}

.session-item {
  border-bottom: 1px solid var(--divider-color);
}

.detail-info {
  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;

    .info-label {
      color: var(--info-text-color);
      font-size: 14px;
    }

    .info-value {
      color: var(--text-color);
      font-size: 14px;
    }
  }
}
</style>
