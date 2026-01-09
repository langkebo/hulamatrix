<template>
  <div class="matrix-chat-header">
    <!-- 用户信息区 -->
    <div class="user-info">
      <n-avatar
        v-bind="roomAvatar !== undefined ? { src: roomAvatar } : {}"
        :fallback-src="'/default-room-avatar.png'"
        round
        :size="32">
        <n-icon v-if="isSpace" :component="Users" size="16" />
      </n-avatar>
      <div class="room-details">
        <h3 class="room-name">{{ roomName }}</h3>
        <p v-if="roomTopic" class="room-topic">{{ roomTopic }}</p>
        <div class="room-meta">
          <n-tag v-if="isEncrypted" type="success" size="small">
            <n-icon :component="Lock" size="12" />
            加密
          </n-tag>
          <span v-if="memberCount" class="member-count">{{ memberCount }} 成员</span>
        </div>
      </div>
    </div>

    <!-- 状态指示器 -->
    <div v-if="isTyping" class="typing-indicator">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="typing-text">正在输入...</span>
    </div>

    <!-- Matrix通话按钮 -->
    <div v-if="!isBot && !isSpace" class="call-controls">
      <!-- 语音通话 -->
      <n-tooltip trigger="hover" placement="bottom">
        <template #trigger>
          <n-button circle quaternary size="small" :loading="isVoiceCallStarting" @click="startVoiceCall">
            <n-icon :component="Phone" size="18" />
          </n-button>
        </template>
        语音通话
      </n-tooltip>

      <!-- 视频通话 -->
      <n-tooltip trigger="hover" placement="bottom">
        <template #trigger>
          <n-button circle quaternary size="small" :loading="isVideoCallStarting" @click="startVideoCall">
            <n-icon :component="Video" size="18" />
          </n-button>
        </template>
        视频通话
      </n-tooltip>

      <!-- 屏幕共享 -->
      <n-tooltip v-if="supportsScreenShare" trigger="hover" placement="bottom">
        <template #trigger>
          <n-button circle quaternary size="small" :loading="isScreenSharing" @click="toggleScreenShare">
            <n-icon :component="DeviceDesktop" size="18" />
          </n-button>
        </template>
        {{ isScreenSharing ? '停止共享' : '屏幕共享' }}
      </n-tooltip>
    </div>

    <!-- 设置按钮 -->
    <n-dropdown :options="headerMenuOptions" placement="bottom-end" @select="handleMenuAction">
      <n-button quaternary circle size="small">
        <n-icon :component="DotsVertical" size="18" />
      </n-button>
    </n-dropdown>

    <!-- Matrix优化通话组件 -->
    <MatrixCallOptimized
      :room-id="roomId"
      :compact="true"
      @call-started="handleCallStarted"
      @call-ended="handleCallEnded" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { NAvatar, NTag, NTooltip, NButton, NIcon, NDropdown, useMessage } from 'naive-ui'
import {
  Users,
  Lock,
  Phone,
  Video,
  DeviceDesktop,
  DotsVertical,
  Settings,
  InfoCircle,
  Search,
  Bell,
  Users as PeopleOutline
} from '@vicons/tabler'
import { matrixCallService, CallState, type MatrixCall } from '@/services/matrixCallService'
import { matrixRoomManager } from '@/matrix/services/room/manager'
import MatrixCallOptimized from './MatrixCallOptimized.vue'
import type { MatrixRoom, MatrixMember } from '@/types/matrix'
import { useUserStore } from '@/stores/user'

interface Props {
  roomId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  showSettings: []
  showSearch: []
  showNotifications: []
  showMemberList: []
}>()

const message = useMessage()

// State
const roomInfo = ref<MatrixRoom | null>(null)
const members = ref<MatrixMember[]>([])
const isVoiceCallStarting = ref(false)
const isVideoCallStarting = ref(false)
const isScreenSharing = ref(false)
const supportsScreenShare = ref(false)

// Computed
const roomName = computed(() => roomInfo.value?.name || '未知房间')
const roomTopic = computed(() => roomInfo.value?.topic || '')
const roomAvatar = computed(() => roomInfo.value?.avatar)
const isEncrypted = computed(() => roomInfo.value?.encrypted || false)
const isSpace = computed(() => roomInfo.value?.type === 'm.space')
const isGroup = computed(() => {
  if (!roomInfo.value) return false
  const memberCount = members.value.length
  return memberCount > 2
})
const isBot = computed(() => {
  // 检查当前用户是否是机器人
  if (!roomInfo.value || !members.value.length) return false

  const userStore = useUserStore()
  const currentUserId = userStore.userInfo?.uid

  if (!currentUserId) return false

  // 查找当前用户的成员信息
  const currentMember = members.value.find((m) => m.userId === currentUserId)
  if (!currentMember) return false

  // 检查成员是否是机器人（通过显示名称后缀或特定标识）
  // Matrix 机器人通常有以下特征：
  // 1. 显示名称以 "BOT" 结尾
  // 2. 用户 ID 包含特定模式（如 ":bot."）
  const displayName = currentMember.displayName || currentMember.userId
  const hasBotSuffix = displayName.toUpperCase().endsWith('BOT')
  const hasBotPattern = currentMember.userId.includes(':bot:') || currentMember.userId.includes('-bot:')

  return hasBotSuffix || hasBotPattern
})
const memberCount = computed(() => members.value.length)
const isTyping = ref(false)

// Header menu options
const headerMenuOptions = computed(() => {
  const options = [
    {
      label: '房间设置',
      key: 'settings',
      type: 'render' as const,
      icon: () => Settings
    },
    {
      label: '搜索消息',
      key: 'search',
      type: 'render' as const,
      icon: () => Search
    },
    {
      label: '通知历史',
      key: 'notifications',
      type: 'render' as const,
      icon: () => Bell
    }
  ]

  if (isGroup.value) {
    options.push({
      label: '成员列表',
      key: 'members',
      type: 'render' as const,
      icon: () => PeopleOutline
    })
  }

  if (!isSpace.value) {
    options.push({
      label: '房间信息',
      key: 'info',
      type: 'render' as const,
      icon: () => InfoCircle
    })
  }

  return options
})

// Methods
const loadRoomInfo = async () => {
  try {
    // Get room summary
    const summary = matrixRoomManager.getRoomSummary(props.roomId)
    if (summary) {
      roomInfo.value = {
        roomId: summary.roomId || '',
        name: summary.name || '',
        topic: summary.topic || '',
        avatar: summary.avatar || '',
        type: summary.type || '',
        encrypted: summary.encrypted || false,
        joinRule: summary.joinRule || 'public',
        guestAccess: summary.guestAccess || 'forbidden',
        historyVisibility: summary.historyVisibility || 'shared',
        memberCount: summary.memberCount || 0,
        isSpace: summary.type === 'm.space'
      }
    }

    // Get room members
    members.value = await matrixRoomManager.getRoomMembers(props.roomId)
  } catch (error) {}
}

const startVoiceCall = async () => {
  if (isVoiceCallStarting.value || isVideoCallStarting.value) return

  isVoiceCallStarting.value = true
  try {
    await matrixCallService.startCall({
      roomId: props.roomId,
      type: 'voice'
    })
  } catch (error) {
    message.error('发起语音通话失败')
  } finally {
    isVoiceCallStarting.value = false
  }
}

const startVideoCall = async () => {
  if (isVoiceCallStarting.value || isVideoCallStarting.value) return

  isVideoCallStarting.value = true
  try {
    await matrixCallService.startCall({
      roomId: props.roomId,
      type: 'video'
    })
  } catch (error) {
    message.error('发起视频通话失败')
  } finally {
    isVideoCallStarting.value = false
  }
}

const toggleScreenShare = async () => {
  try {
    if (isScreenSharing.value) {
      // Stop screen sharing
      const activeCall = matrixCallService.getActiveCall(props.roomId)
      if (activeCall) {
        matrixCallService.stopScreenShare(activeCall.callId)
      }
      isScreenSharing.value = false
    } else {
      // Start screen sharing
      const activeCall = matrixCallService.getActiveCall(props.roomId)
      if (activeCall) {
        await matrixCallService.startScreenShare(activeCall.callId)
        isScreenSharing.value = true
      } else {
        message.warning('请先发起通话')
      }
    }
  } catch (error) {
    message.error('屏幕共享失败')
  }
}

const handleMenuAction = (key: string) => {
  switch (key) {
    case 'settings':
      emit('showSettings')
      break
    case 'search':
      emit('showSearch')
      break
    case 'notifications':
      emit('showNotifications')
      break
    case 'members':
      emit('showMemberList')
      break
    case 'info':
      // Show room info
      break
  }
}

const handleCallStarted = (call: MatrixCall) => {
  message.success(`${call.type === 'video' ? '视频' : '语音'}通话已开始`)
}

const handleCallEnded = (_call: MatrixCall) => {
  message.info('通话已结束')
  isScreenSharing.value = false
}

const checkScreenShareSupport = () => {
  supportsScreenShare.value = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)
}

// Event handlers
const handleCallEvent = (event: CustomEvent) => {
  const { call } = event.detail

  // Update screen sharing state when screen sharing ends
  if (call.state === CallState.ENDED) {
    isScreenSharing.value = false
  }
}

// Lifecycle
onMounted(async () => {
  await loadRoomInfo()
  checkScreenShareSupport()
  window.addEventListener('matrixCallStateChanged', handleCallEvent as EventListener)
})

onUnmounted(() => {
  window.removeEventListener('matrixCallStateChanged', handleCallEvent as EventListener)
})
</script>

<style scoped>
.matrix-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--n-border-color);
  background: var(--n-color);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.room-details {
  flex: 1;
  min-width: 0;
}

.room-name {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--n-text-color-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-topic {
  margin: 0 0 4px 0;
  font-size: 12px;
  color: var(--n-text-color-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-count {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: var(--n-primary-color);
  color: white;
  border-radius: 12px;
  font-size: 12px;
}

.dot {
  width: 4px;
  height: 4px;
  background: white;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dot:nth-child(3) {
  animation-delay: 0.4s;
}

.typing-text {
  color: white;
}

.call-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Typing animation */
@keyframes typing {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}

/* Responsive */
@media (max-width: 768px) {
  .matrix-chat-header {
    padding: 8px 12px;
  }

  .user-info {
    gap: 8px;
  }

  .room-name {
    font-size: 14px;
  }

  .call-controls {
    gap: 4px;
  }

  .typing-indicator {
    padding: 2px 8px;
  }
}
</style>
