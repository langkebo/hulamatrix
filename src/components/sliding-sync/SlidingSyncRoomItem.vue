<!--
  SlidingSyncRoomItem Component
  Individual room item for Sliding Sync room list
-->
<template>
  <div
    class="sliding-sync-room-item"
    :class="{ active, unread: hasUnread }"
    @click="handleClick"
  >
    <!-- Avatar -->
    <div class="room-avatar">
      <n-avatar
        v-if="room.avatar_url"
        :src="room.avatar_url"
        :fallback-src="fallbackAvatar"
        round
        size="medium"
      />
      <n-avatar
        v-else
        round
        size="medium"
        :style="{ backgroundColor: avatarColor }"
      >
        {{ initials }}
      </n-avatar>

      <!-- Online Status (for DMs) -->
      <div
        v-if="room.is_dm && isOnline"
        class="online-indicator"
      />
    </div>

    <!-- Room Info -->
    <div class="room-info">
      <div class="room-header">
        <span class="room-name">{{ displayName }}</span>
        <span class="timestamp">{{ formattedTime }}</span>
      </div>

      <div class="room-preview">
        <!-- Typing Indicator -->
        <div v-if="isTyping" class="typing-indicator">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>

        <!-- Last Message -->
        <span v-else-if="lastMessage" class="last-message">
          {{ lastMessage }}
        </span>

        <span v-else class="no-message">暂无消息</span>

        <!-- Unread Badge -->
        <n-badge
          v-if="hasUnread"
          :value="unreadCount"
          :max="99"
          :type="unreadHighlight ? 'error' : 'default'"
          class="unread-badge"
        />
      </div>
    </div>

    <!-- Room Tags -->
    <div v-if="showTags && tags.length > 0" class="room-tags">
      <n-tag
        v-for="tag in tags"
        :key="tag"
        size="tiny"
        :bordered="false"
      >
        {{ tag }}
      </n-tag>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MSC3575RoomData } from '@/types/sliding-sync'
import { NAvatar, NBadge, NTag } from 'naive-ui'
import { logger } from '@/utils/logger'

// Props
interface Props {
  room: MSC3575RoomData
  selected?: boolean
  showTags?: boolean
  currentUserId?: string
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  showTags: false,
  currentUserId: ''
})

// Emits
type Emits = (e: 'select', room: MSC3575RoomData) => void

const emit = defineEmits<Emits>()

// Computed
const active = computed(() => props.selected)

const displayName = computed(() => {
  return props.room.name || '未命名房间'
})

const initials = computed(() => {
  const name = displayName.value
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const avatarColor = computed(() => {
  const colors = [
    '#f56c6c',
    '#e6a23c',
    '#409eff',
    '#67c23a',
    '#909399',
    '#c71585',
    '#ff69b4',
    '#cd5c5c',
    '#ffa500',
    '#8b4513'
  ]
  const index = displayName.value.charCodeAt(0) % colors.length
  return colors[index]
})

const fallbackAvatar = computed(() => {
  // Generate a consistent avatar based on room name
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName.value)}`
})

const hasUnread = computed(() => {
  return (props.room.notification_count || 0) > 0
})

const unreadCount = computed(() => {
  return props.room.notification_count || 0
})

const unreadHighlight = computed(() => {
  return (props.room.highlight_count || 0) > 0
})

const formattedTime = computed(() => {
  if (!props.room.updated) return ''

  const now = Date.now()
  const diff = now - props.room.updated
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`

  const date = new Date(props.room.updated)
  return date.toLocaleDateString()
})

const lastMessage = computed(() => {
  // This would typically come from timeline data
  // For now, we'll use the room topic as a placeholder
  return props.room.topic || ''
})

const isOnline = computed(() => {
  // For DM rooms, check if the other user is online
  return props.room.is_online || false
})

const isTyping = computed(() => {
  // This would come from typing notifications
  return false
})

const tags = computed(() => {
  const tagList: string[] = []

  if (props.room.is_dm) {
    tagList.push('私信')
  }

  if (props.room.tags?.includes('m.favourite')) {
    tagList.push('收藏')
  }

  if (props.room.is_encrypted) {
    tagList.push('加密')
  }

  return tagList
})

// Methods
const handleClick = () => {
  emit('select', props.room)
}
</script>

<style lang="scss" scoped>
.sliding-sync-room-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  cursor: pointer;
  border-radius: 8px;
  transition: background-color 0.2s;
  position: relative;

  &:hover {
    background-color: var(--n-hover-color);
  }

  &.active {
    background-color: var(--n-active-color);
  }

  &.unread {
    .room-name {
      font-weight: 600;
    }
  }
}

.room-avatar {
  position: relative;
  flex-shrink: 0;

  .online-indicator {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 12px;
    height: 12px;
    background-color: #52c41a;
    border: 2px solid var(--n-color);
    border-radius: 50%;
  }
}

.room-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.room-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.room-name {
  flex: 1;
  font-size: 14px;
  color: var(--n-text-color-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timestamp {
  font-size: 11px;
  color: var(--n-text-color-3);
  flex-shrink: 0;
}

.room-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.typing-indicator {
  display: flex;
  gap: 3px;

  .dot {
    width: 6px;
    height: 6px;
    background-color: var(--n-text-color-3);
    border-radius: 50%;
    animation: typing 1.4s infinite ease-in-out;

    &:nth-child(1) { animation-delay: 0s; }
    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}

.last-message {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-message {
  font-style: italic;
  opacity: 0.6;
}

.unread-badge {
  flex-shrink: 0;
}

.room-tags {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
</style>
