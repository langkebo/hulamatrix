<template>
  <div class="space-rooms">
    <!-- 搜索和操作栏 -->
    <div class="rooms-header">
      <n-input
        v-model:value="searchQuery"
        size="small"
        placeholder="搜索房间..."
        clearable>
        <template #prefix>
          <n-icon><Search /></n-icon>
        </template>
      </n-input>

      <n-button
        v-if="isAdmin"
        type="primary"
        size="small"
        @click="$emit('create-room')">
        <template #icon>
          <n-icon><Plus /></n-icon>
        </template>
        创建房间
      </n-button>
    </div>

    <!-- 房间列表 -->
    <div class="rooms-list">
      <div v-if="filteredRooms.length === 0" class="empty-state">
        <n-empty description="暂无房间" size="small" />
      </div>

      <div
        v-for="room in filteredRooms"
        :key="room.id"
        class="room-item"
        @click="$emit('view-room', room)">
        <div class="room-avatar">
          <n-avatar :size="48" round>
            <n-icon><Hash /></n-icon>
          </n-avatar>
          <n-badge
            v-if="room.isFavorite"
            type="warning"
            dot
            :bottom="2"
            :right="2" />
        </div>

        <div class="room-info">
          <div class="room-name">
            {{ room.name }}
            <n-tag
              v-if="room.type === 'space'"
              size="tiny"
              type="info">
              空间
            </n-tag>
          </div>

          <div v-if="room.topic" class="room-topic">
            {{ room.topic }}
          </div>

          <div class="room-meta">
            <span class="room-members">
              <n-icon><Users /></n-icon>
              {{ room.memberCount || 0 }}
            </span>
            <span class="room-activity">
              {{ formatLastActivity(room.lastActivity) }}
            </span>
          </div>
        </div>

        <n-dropdown
          :options="getRoomActions(room)"
          @select="(action) => $emit('room-action', { action, room })"
          placement="bottom-end"
          @click.stop>
          <n-button circle size="small" quaternary>
            <template #icon>
              <n-icon><DotsVertical /></n-icon>
            </template>
          </n-button>
        </n-dropdown>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, type Component } from 'vue'
import { NInput, NButton, NIcon, NAvatar, NTag, NBadge, NEmpty, NDropdown } from 'naive-ui'
import { Search, Plus, Hash, Users, DotsVertical } from '@vicons/tabler'
import type { Room } from './types'
import type { RoomAction } from './types'

interface Props {
  rooms: Room[]
  isAdmin?: boolean
}

interface Emits {
  (e: 'create-room'): void
  (e: 'view-room', room: Room): void
  (e: 'room-action', payload: { action: RoomAction; room: Room }): void
}

const props = withDefaults(defineProps<Props>(), {
  isAdmin: false
})

const emit = defineEmits<Emits>()

const searchQuery = ref('')

const filteredRooms = computed(() => {
  if (!searchQuery.value) return props.rooms

  const query = searchQuery.value.toLowerCase()
  return props.rooms.filter(room =>
    room.name.toLowerCase().includes(query) ||
    (room.topic && room.topic.toLowerCase().includes(query))
  )
})

const formatLastActivity = (timestamp?: number): string => {
  if (!timestamp) return '未知'

  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`

  return '更早'
}

const getRoomActions = (room: Room) => {
  return [
    {
      label: '查看房间',
      key: 'view'
    },
    {
      label: room.isFavorite ? '取消收藏' : '收藏',
      key: 'favorite'
    },
    {
      label: '房间设置',
      key: 'settings',
      disabled: !props.isAdmin
    },
    {
      label: '离开房间',
      key: 'leave',
      disabled: !room.isJoined
    }
  ]
}
</script>

<style lang="scss" scoped>
.space-rooms {
  padding: 24px;

  .rooms-header {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;

    .n-input {
      flex: 1;
    }
  }

  .rooms-list {
    .room-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      margin-bottom: 8px;
      background: var(--bg-setting-item);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: var(--bg-msg-hover);
      }

      .room-avatar {
        position: relative;
        flex-shrink: 0;
      }

      .room-info {
        flex: 1;
        min-width: 0;

        .room-name {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 15px;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .room-topic {
          font-size: 13px;
          color: var(--text-color-2);
          margin-bottom: 8px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .room-meta {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: var(--text-color-3);

          span {
            display: flex;
            align-items: center;
            gap: 4px;
          }
        }
      }
    }

    .empty-state {
      padding: 40px 0;
      text-align: center;
    }
  }
}
</style>
