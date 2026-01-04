<template>
  <div class="private-chat-button-wrapper">
    <!-- 私密聊天按钮 -->
    <n-button
      v-if="!isMobile()"
      type="primary"
      size="small"
      @click="openPrivateChatDialog"
      class="private-chat-btn"
      :disabled="!canCreatePrivateChat">
      <Icon icon="mdi:lock" class="lock-icon" />
      {{ $t('message.selfDestruct.createPrivateChat') }}
    </n-button>

    <!-- 移动端私密聊天按钮 -->
    <div v-else class="mobile-private-chat-btn" @click="openPrivateChatDialog" :class="{ active: isPrivateChatActive }">
      <Icon icon="mdi:lock" />
    </div>

    <!-- 私密聊天设置对话框 -->
    <PrivateChatDialog v-model:show="showPrivateChatDialog" @chat-created="handleChatCreated" />

    <!-- 自毁时间设置弹窗 -->
    <n-dropdown
      v-if="showSelfDestructDropdown"
      :options="selfDestructOptions"
      @select="handleSelfDestructTimeSelect"
      @clickoutside="closeSelfDestructDropdown"
      placement="top-start"
      class="self-destruct-dropdown" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
import { logger } from '@/utils/logger'
import { usePrivateChatStore } from '@/stores/privateChat'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'

import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { isMobile } from '@/utils/PlatformConstants'

import { msg } from '@/utils/SafeUI'
import PrivateChatDialog from './PrivateChatDialog.vue'

// Composables
const { t } = useI18n()
const privateChatStore = usePrivateChatStore()
const globalStore = useGlobalStore()
const groupStore = useGroupStore()
const router = useRouter()
const message = msg

// 响应式数据
const showPrivateChatDialog = ref(false)
const showSelfDestructDropdown = ref(false)
const isPrivateChatActive = ref(false)

// 自毁时间选项
const selfDestructOptions = [
  { label: t('message.selfDestruct.timeOptions.30s'), key: 30 },
  { label: t('message.selfDestruct.timeOptions.1m'), key: 60 },
  { label: t('message.selfDestruct.timeOptions.5m'), key: 300 },
  { label: t('message.selfDestruct.timeOptions.30m'), key: 1800 },
  { label: t('message.selfDestruct.timeOptions.1h'), key: 3600 },
  { label: t('message.selfDestruct.timeOptions.1d'), key: 86400 },
  { label: t('message.selfDestruct.timeOptions.1w'), key: 604800 }
]

// 计算属性
const canCreatePrivateChat = computed(() => {
  // 检查是否有可以邀请的用户
  if (globalStore.currentSession?.type === 2) {
    // 群聊
    return groupStore.userList.length > 1 // 除了自己至少还有1个用户
  }
  return true // 私聊也可以创建私密聊天
})

//

// 方法
const openPrivateChatDialog = () => {
  showPrivateChatDialog.value = true
}

const handleChatCreated = async (roomId: string) => {
  try {
    // 切换到新创建的私密聊天
    await globalStore.updateCurrentSessionRoomId(roomId)

    // 如果是移动端，跳转到聊天页面
    if (isMobile()) {
      router.push(`/mobile/chatRoom/chatMain/${roomId}`)
    }

    message.success(t('message.selfDestruct.chatCreatedSuccess'))
  } catch (error) {
    logger.error(
      '[PrivateChatButton] Failed to handle chat created:',
      error instanceof Error ? error : new Error(String(error))
    )
    message.error(t('message.selfDestruct.createChatFailed'))
  }
}

const handleSelfDestructTimeSelect = (key: number) => {
  // 设置当前会话的默认自毁时间
  const currentRoomId = globalStore.currentSessionRoomId
  if (currentRoomId && privateChatStore.isPrivateChat(currentRoomId)) {
    // 这里可以实现设置默认自毁时间的逻辑
    logger.debug('Setting self-destruct time:', key, 'PrivateChatButton')
  }

  closeSelfDestructDropdown()
}

const closeSelfDestructDropdown = () => {
  showSelfDestructDropdown.value = false
}

// 处理键盘快捷键
const handleKeydown = (event: KeyboardEvent) => {
  // Alt + P 快速创建私密聊天
  if (event.altKey && event.key === 'p') {
    event.preventDefault()
    openPrivateChatDialog()
  }
}

// 监听当前会话变化
const handleSessionChange = () => {
  const currentRoomId = globalStore.currentSessionRoomId
  isPrivateChatActive.value = currentRoomId ? privateChatStore.isPrivateChat(currentRoomId) : false
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  handleSessionChange()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// 暴露方法给父组件
defineExpose({
  openPrivateChatDialog,
  closeSelfDestructDropdown
})
</script>

<style scoped lang="scss">
.private-chat-button-wrapper {
  display: inline-flex;
  align-items: center;
}

.private-chat-btn {
  display: flex;
  align-items: center;
  gap: 6px;

  .lock-icon {
    font-size: 14px;
  }
}

.mobile-private-chat-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(19, 152, 127, 0.1);
  color: #13987f;
  cursor: pointer;
  transition: all 0.2s ease;

  .iconify {
    font-size: 18px;
  }

  &:hover {
    background: rgba(19, 152, 127, 0.2);
  }

  &.active {
    background: #13987f;
    color: white;
  }
}

.self-destruct-dropdown {
  :deep(.n-dropdown-menu) {
    min-width: 120px;
  }
}

// 响应式适配
@media (max-width: 768px) {
  .private-chat-btn {
    font-size: 12px;
    padding: 6px 12px;

    .lock-icon {
      font-size: 12px;
    }
  }
}
</style>
