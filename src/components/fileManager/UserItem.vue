<template>
  <div :class="['user-item', { 'user-item--selected': isSelected }]" @click="handleClick">
    <!-- 头像 -->
    <div class="user-avatar">
      <img
        :src="itemData.avatar || getDefaultAvatar()"
        :alt="itemData.name"
        @error="handleAvatarError"
        class="avatar-img" />
      <!-- 在线状态指示器 -->
      <div v-if="itemData.isOnline" class="online-indicator"></div>
    </div>

    <!-- 信息 -->
    <div class="user-info">
      <div class="user-name" :title="itemData.name">{{ itemData.name }}</div>
      <div v-if="itemData.subtitle" class="user-subtitle" :title="itemData.subtitle">
        {{ itemData.subtitle }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

// Type definitions
interface UserItem {
  name?: string
  nickname?: string
  userName?: string
  remark?: string
  avatar?: string
  isOnline?: boolean
  [key: string]: unknown
}

interface RoomItem {
  roomName?: string
  groupName?: string
  roomAvatar?: string
  avatar?: string
  memberCount?: number
  unreadCount?: number
  activeStatus?: number
  lastMessage?: string
  [key: string]: unknown
}

interface ContactItem {
  name?: string
  avatar?: string
  [key: string]: unknown
}

type Emits = (e: 'click', item: Record<string, unknown>) => void

const props = withDefaults(
  defineProps<{
    user?: UserItem
    room?: RoomItem
    contact?: ContactItem
    isSelected?: boolean
  }>(),
  {
    isSelected: false
  }
)

const emit = defineEmits<Emits>()
const { t } = useI18n()

// 统一的数据格式
interface ItemData {
  name: string
  avatar: string
  isOnline: boolean
  subtitle: string | undefined
  [key: string]: unknown
}

const itemData = computed<ItemData>(() => {
  const item = props.user || props.room || props.contact || {}

  return {
    name: (item.name ||
      item.roomName ||
      item.groupName ||
      item.nickname ||
      item.userName ||
      item.remark ||
      t('fileManager.common.unknown')) as string,
    avatar: (item.avatar || item.roomAvatar || '') as string,
    isOnline: (item.isOnline || item.activeStatus === 1) as boolean,
    subtitle: getSubtitle(item) as string | undefined,
    ...item
  }
})

const getSubtitle = (item: unknown) => {
  const i = item as {
    roomName?: string
    memberCount?: number
    lastMessage?: string
  }
  if (i.roomName) {
    // 群聊显示成员数量
    return i.memberCount ? t('fileManager.userList.memberCount', { count: i.memberCount }) : ''
  }
  if (i.lastMessage) {
    // 会话显示最后一条消息
    return i.lastMessage
  }
  return ''
}

const getDefaultAvatar = () => {
  // 统一使用 logoD.png 作为默认头像，避免闪烁问题
  return '/logoD.png'
}

const handleClick = () => {
  emit('click', itemData.value)
}

const handleAvatarError = (event: Event) => {
  const target = event.target as HTMLImageElement
  const defaultAvatar = getDefaultAvatar()

  // 防止无限循环：如果当前已经是默认头像，就不再尝试更换
  if (target.src.includes('logoD.png') || target.src === defaultAvatar) {
    return
  }

  target.src = defaultAvatar
}
</script>

<style scoped lang="scss">
.user-item {
  display: flex;
  align-items: center;
  padding: 10px 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;

  &:hover:not(&--selected) {
    background-color: #f5f5f5;
  }

  &--selected {
    background-color: #e8f4f1;
    box-shadow: inset 0 0 0 1px #13987f;
  }
}

.user-avatar {
  position: relative;
  margin-right: 12px;
  flex-shrink: 0;
}

.avatar-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--avatar-border-color);
}

.online-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 8px;
  height: 8px;
  background-color: #13987f;
  border-radius: 50%;
  border: 2px solid var(--center-bg-color);
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 14px;
  color: var(--text-color);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-subtitle {
  font-size: 12px;
  color: var(--text-color);
  opacity: 0.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

// 深色主题适配
html[data-theme='dark'] {
  .user-item {
    &:hover:not(&--selected) {
      background-color: #2d2d2d;
    }

    &--selected {
      background-color: rgba(19, 152, 127, 0.2);
      border-color: #13987f;
    }
  }
}
</style>
