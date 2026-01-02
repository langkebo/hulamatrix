<template>
  <div class="w-full h-[56px] grid grid-cols-[100px_1fr_100px] z-2">
    <div @click="handleBack" class="w-full h-full flex items-center">
      <svg class="iconpark-icon w-24px h-24px ms-16px p-5px"><use href="#fanhui"></use></svg>
      <div
        v-show="props.msgCount ? (props.msgCount > 0 ? true : false) : false"
        class="rounded-15px flex items-center bg-#C7DBD9 px-7px text-14px min-h-20px">
        {{ formattedMsgCount }}
      </div>
    </div>
    <div class="w-full h-full overflow-hidden flex items-center justify-center">
      <div @click="handleRoomNameClick" :class="props.isOfficial ? ['chat-room-name-official'] : ['chat-room-name']">
        <div class="truncate whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">
          {{ props.roomName }}
        </div>
        <svg v-if="props.isOfficial" class="w-18px h-18px iconpark-icon text-#1A9B83"><use href="#auth"></use></svg>
      </div>
    </div>
    <div class="absolute left-0 right-0 top-42px flex justify-center items-center pointer-events-none">
      <div v-if="isTyping" class="typing-hint">
        <span class="dot-online" v-if="onlineCount > 0"></span>
        正在输入…
      </div>
    </div>
    <div class="w-full h-full flex items-center">
      <div v-if="!props.hiddenRight" class="w-full justify-end flex pe-16px">
        <!-- 私密聊天按钮 -->
        <svg
          v-if="!isChannel && !isBotUser"
          @click="handleCreatePrivateChat"
          class="w-24px h-24px iconpark-icon p-5px private-chat-icon">
          <use href="#lock"></use>
        </svg>
        <svg class="w-24px h-24px iconpark-icon p-5px"><use href="#diannao"></use></svg>
        <svg @click="handleMoreClick" class="w-24px h-24px iconpark-icon p-5px"><use href="#more"></use></svg>
      </div>
    </div>
  </div>

  <!-- 私密聊天对话框 -->
  <PrivateChatDialog v-model:show="showPrivateChatDialog" @chat-created="handlePrivateChatCreated" />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import router from '@/router'
import { useTypingStore } from '@/integrations/matrix/typing'
import { useGlobalStore } from '@/stores/global'
import { useUserStore } from '@/stores/user'
import { usePresenceStore } from '@/stores/presence'
import { matrixClientService } from '@/integrations/matrix/client'
//
import PrivateChatDialog from '@/components/rightBox/PrivateChatDialog.vue'
import { IsAllUserEnum, UserType } from '@/enums'
import { logger } from '@/utils/logger'

export interface HeaderBarProps {
  msgCount?: number
  isOfficial?: boolean
  hiddenRight?: boolean
  enableDefaultBackground?: boolean
  enableShadow?: boolean
  roomName?: string | false
}

const props = withDefaults(defineProps<HeaderBarProps>(), {
  isOfficial: true,
  hiddenRight: false,
  enableDefaultBackground: true,
  enableShadow: true,
  roomName: false
})

const emits = defineEmits<(e: 'roomNameClick', payload: HeaderBarProps) => void>()

const handleRoomNameClick = () => {
  emits('roomNameClick', { ...props, msgCount: props.msgCount ?? 0 })
}

const formattedMsgCount = computed(() => {
  if (!props.msgCount) return ''
  return props.msgCount > 100 ? '99+' : `${props.msgCount}`
})

const handleBack = async () => {
  router.back()
}

const handleMoreClick = () => {
  router.push(`/mobile/chatRoom/setting`)
}

// 私密聊天相关
const showPrivateChatDialog = ref(false)
// const privateChatStore = usePrivateChatStore()

const handleCreatePrivateChat = () => {
  showPrivateChatDialog.value = true
}

const handlePrivateChatCreated = async (roomId: string) => {
  try {
    showPrivateChatDialog.value = false
    await router.push(`/mobile/chatRoom/chatMain/${roomId}`)
  } catch (error) {
    logger.error('[HeaderBar] Failed to handle private chat created:', error)
  }
}

// 判断是否为频道或bot用户
const isChannel = computed(() => {
  const currentSession = globalStore.currentSession
  return currentSession?.hotFlag === 1 || currentSession?.roomId === '1'
})

const isBotUser = computed(() => {
  const currentSession = globalStore.currentSession
  return currentSession?.account === UserType.BOT
})

const typingStore = useTypingStore()
const globalStore = useGlobalStore()
const userStore = useUserStore()
const presenceStore = usePresenceStore()

const typingUsers = computed(() => {
  const list = typingStore.get(globalStore.currentSessionRoomId)
  const selfIds = [userStore.userInfo?.uid, userStore.userInfo?.account].filter(Boolean)
  return list.filter((u) => !selfIds.includes(u))
})
const isTyping = computed(() => typingUsers.value.length > 0)
const onlineCount = computed(() => {
  try {
    const client = matrixClientService.getClient()
    const getRoomMethod = client?.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
    const room = getRoomMethod?.(globalStore.currentSessionRoomId)
    // Define RoomMember interface for Matrix SDK
    interface MatrixRoomMember {
      userId: string
      name?: string
      membership?: string
    }
    const getJoinedMembersMethod = room?.getJoinedMembers as (() => MatrixRoomMember[]) | undefined
    const members = getJoinedMembersMethod?.()?.map((m: MatrixRoomMember) => m.userId) || []
    return members.filter((uid: string) => presenceStore.isOnline(uid)).length
  } catch {
    return 0
  }
})
</script>

<style lang="scss" scoped>
.chat-room-name {
  @apply grid items-center;
}

.chat-room-name-official {
  @apply grid grid-cols-[1fr_20px] items-center gap-5px;
}

.typing-hint {
  @apply bg-[rgba(0,0,0,0.15)] text-12px rounded-12px px-8px py-4px backdrop-blur-sm;
  color: var(--chat-text-color);
}
.dot-online {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background-color: #1aaa55;
  margin-right: 6px;
}

.private-chat-icon {
  color: var(--icon-color);
  transition: all 0.2s ease;

  &:active {
    color: #13987f;
    transform: scale(0.95);
  }

  &:hover {
    color: #13987f;
  }
}
</style>
