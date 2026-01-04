<template>
  <div class="matrix-room-list">
    <!-- Search Bar -->
    <div class="search-bar">
      <n-input
        v-model:value="searchQuery"
        placeholder="搜索房间..."
        clearable
        @input="handleSearch"
      >
        <template #prefix>
          <n-icon :component="Search" />
        </template>
      </n-input>
    </div>

    <!-- Spaces Section -->
    <div v-if="spaces.length > 0" class="spaces-section">
      <div class="section-header">
        <span>工作空间</span>
        <n-button
          quaternary
          size="tiny"
          @click="toggleSpacesExpanded"
        >
          <n-icon
            :component="spacesExpanded ? ChevronDown : ChevronRight"
          />
        </n-button>
      </div>

      <n-collapse-transition :show="spacesExpanded">
        <div class="spaces-list">
          <div
            v-for="space in filteredSpaces"
            :key="space.roomId"
            class="space-item"
            @click="selectSpace(space)"
          >
            <n-avatar
              v-bind="space.avatar !== undefined ? { src: space.avatar } : {}"
              :fallback-src="'/default-avatar.png'"
              round
              size="small"
            >
              <n-icon :component="Users" />
            </n-avatar>
            <div class="space-info">
              <span class="space-name">{{ space.name || '未命名空间' }}</span>
              <span class="member-count">{{ space.memberCount || 0 }} 成员</span>
            </div>
          </div>
        </div>
      </n-collapse-transition>
    </div>

    <!-- Rooms Section -->
    <div class="rooms-section">
      <div class="section-header">
        <span>房间</span>
        <n-button
          quaternary
          size="tiny"
          @click="createRoom"
        >
          <n-icon :component="Plus" />
        </n-button>
      </div>

      <div class="rooms-list">
        <!-- Direct Messages -->
        <div v-if="dmRooms.length > 0" class="room-group">
          <div class="group-header">私信</div>
          <div
            v-for="room in filteredDMRooms"
            :key="room.roomId"
            class="room-item dm"
            :class="{ active: selectedRoomId === room.roomId }"
            @click="selectRoom(room)"
          >
            <n-avatar
              v-bind="room.avatar !== undefined ? { src: room.avatar } : {}"
              :fallback-src="'/default-avatar.png'"
              round
              size="small"
            >
              {{ getDMInitials(room) }}
            </n-avatar>
            <div class="room-info">
              <span class="room-name">{{ getDMDisplayName(room) }}</span>
              <span class="last-message">{{ getLastMessagePreview(room) }}</span>
            </div>
            <div class="room-meta">
              <span class="timestamp">{{ formatTimestamp(room.lastEvent as ExtendedMatrixEvent | null | undefined) }}</span>
              <n-badge
                v-if="(room.unreadCount || 0) > 0"
                :value="room.unreadCount || 0"
                :max="99"
                type="error"
              />
            </div>
          </div>
        </div>

        <!-- Group Rooms -->
        <div v-if="groupRooms.length > 0" class="room-group">
          <div class="group-header">群组</div>
          <div
            v-for="room in filteredGroupRooms"
            :key="room.roomId"
            class="room-item group"
            :class="{ active: selectedRoomId === room.roomId }"
            @click="selectRoom(room)"
          >
            <n-avatar
              v-bind="room.avatar !== undefined ? { src: room.avatar } : {}"
              :fallback-src="'/default-avatar.png'"
              round
              size="small"
            >
              <n-icon :component="Users" />
            </n-avatar>
            <div class="room-info">
              <span class="room-name">{{ room.name || '未命名群组' }}</span>
              <span class="last-message">{{ getLastMessagePreview(room) }}</span>
            </div>
            <div class="room-meta">
              <span class="timestamp">{{ formatTimestamp(room.lastEvent as ExtendedMatrixEvent | null | undefined) }}</span>
              <n-badge
                v-if="(room.unreadCount || 0) > 0"
                :value="room.unreadCount || 0"
                :max="99"
                type="error"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <n-spin size="small" />
      <span>加载中...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="!hasRooms" class="empty-state">
      <n-icon size="48" :component="MessageCircle" />
      <p>还没有加入任何房间</p>
      <n-button @click="createRoom">创建房间</n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NInput, NIcon, NButton, NAvatar, NBadge, NCollapseTransition, NSpin, useMessage } from 'naive-ui'
import { Search, ChevronDown, ChevronRight, Users, Plus, MessageCircle } from '@vicons/tabler'
import { matrixSpacesService } from '@/services/matrixSpacesService'
import { matrixRoomManager } from '@/services/matrixRoomManager'
import { matrixClientService } from '@/integrations/matrix/client'
import { usePrivateChatStore } from '@/stores/privateChat'
import type { MatrixRoom, SpaceInfo, MatrixEvent, MatrixRoomMember } from '@/types/matrix'
import { logger } from '@/utils/logger'
import {
  toRoomWithMeta,
  toRoomsWithMeta,
  getEventTimestamp,
  getEventType,
  getEventContent,
  getMemberDisplayName,
  type ExtendedMatrixRoom,
  type ExtendedMatrixEvent,
  type ExtendedMatrixRoomMember
} from '@/utils/matrixTypeAdapter'

interface RoomWithMeta extends MatrixRoom {
  unreadCount?: number
  lastEvent?: unknown
  members?: ExtendedMatrixRoomMember[]
  isDirectMessage?: boolean
}

const router = useRouter()
const message = useMessage()
const privateChatStore = usePrivateChatStore()

// State
const loading = ref(false)
const searchQuery = ref('')
const selectedRoomId = ref<string | null>(null)
const spacesExpanded = ref(true)
const spaces = ref<SpaceInfo[]>([])
const rooms = ref<RoomWithMeta[]>([])

// Computed
const filteredSpaces = computed(() => {
  if (!searchQuery.value) return spaces.value

  const query = searchQuery.value.toLowerCase()
  return spaces.value.filter(
    (space) => space.name?.toLowerCase().includes(query) || space.topic?.toLowerCase().includes(query)
  )
})

const dmRooms = computed(() => {
  return rooms.value.filter((room) => room.isDirectMessage)
})

const groupRooms = computed(() => {
  return rooms.value.filter((room) => !room.isDirectMessage)
})

const filteredDMRooms = computed(() => {
  if (!searchQuery.value) return dmRooms.value

  const query = searchQuery.value.toLowerCase()
  return dmRooms.value.filter((room) => {
    const displayName = getDMDisplayName(room).toLowerCase()
    return displayName.includes(query)
  })
})

const filteredGroupRooms = computed(() => {
  if (!searchQuery.value) return groupRooms.value

  const query = searchQuery.value.toLowerCase()
  return groupRooms.value.filter(
    (room) => room.name?.toLowerCase().includes(query) || room.topic?.toLowerCase().includes(query)
  )
})

const hasRooms = computed(() => {
  return rooms.value.length > 0 || spaces.value.length > 0
})

// Methods
const loadSpacesAndRooms = async () => {
  loading.value = true
  try {
    // Load spaces
    await matrixSpacesService.initialize()
    spaces.value = matrixSpacesService.getSpaces().map((space) => {
      const result: SpaceInfo = {
        roomId: space.roomId,
        name: space.name,
        joined: true
      }
      if (space.avatar !== undefined) {
        result.avatar = space.avatar
      }
      if (space.topic !== undefined) {
        result.topic = space.topic
      }
      if (space.memberCount !== undefined) {
        result.memberCount = space.memberCount
      }
      result.rooms = space.children?.map((child) => child.roomId) || []
      return result
    })

    // Load rooms
    const roomList = await matrixRoomManager.getJoinedRooms()
    const roomsWithMeta: RoomWithMeta[] = []

    // Get Matrix client for accessing room methods
    const client = matrixClientService.getClient()
    const getUserIdMethod = client?.getUserId as (() => string) | undefined
    const currentUserId = getUserIdMethod?.() || ''

    // Get m.direct mapping for DM detection
    const getAccountDataMethod = client?.getAccountData as
      | ((eventType: string) => Promise<Record<string, string[]>>)
      | undefined
    let directRooms: Record<string, string[]> = {}

    try {
      directRooms = (await getAccountDataMethod?.('m.direct')) || {}
    } catch {
      // m.direct might not exist
    }

    for (const roomId of roomList) {
      const summary = matrixRoomManager.getRoomSummary(roomId)
      if (!summary) continue // Skip if summary is null

      const members = await matrixRoomManager.getRoomMembers(roomId)

      // Get unread count from Matrix room
      let unreadCount = 0
      try {
        const clientExtended = client as unknown as {
          getRoom?: (roomId: string) => { getUnreadNotificationCount?: () => number } | null
        }
        const room = clientExtended?.getRoom?.(roomId)
        if (room?.getUnreadNotificationCount) {
          unreadCount = room.getUnreadNotificationCount() || 0
        }
      } catch {
        unreadCount = 0
      }

      // Determine if this is a direct message room
      // Check: 1. In m.direct list, 2. Has only 2 members (user + other), 3. Not a space
      let isDirectMessage = false
      const isSpace = summary.type === 'm.space'

      // Check if room is in m.direct for current user
      for (const [userId, roomIds] of Object.entries(directRooms)) {
        if (userId === currentUserId && roomIds.includes(roomId)) {
          isDirectMessage = true
          break
        }
      }

      // Alternative check: if not a space and has exactly 2 members, it might be a DM
      if (!isSpace && !isDirectMessage && members.length === 2) {
        // Check if one of the members is the current user
        const hasCurrentUser = members.some((m) => m.userId === currentUserId)
        if (hasCurrentUser) {
          isDirectMessage = true
        }
      }

      roomsWithMeta.push({
        ...summary,
        roomId: roomId,
        unreadCount,
        members,
        isDirectMessage
      } as RoomWithMeta)
    }

    rooms.value = roomsWithMeta
  } catch (error) {
    message.error('加载房间列表失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  // Search is handled by computed properties
}

const toggleSpacesExpanded = () => {
  spacesExpanded.value = !spacesExpanded.value
}

const selectSpace = (space: SpaceInfo) => {
  // Navigate to space view
  router.push({
    name: 'space',
    params: { spaceId: space.roomId }
  })
}

const selectRoom = (room: RoomWithMeta) => {
  selectedRoomId.value = room.roomId

  // Navigate to room
  router.push({
    name: 'room',
    params: { roomId: room.roomId }
  })
}

const createRoom = async () => {
  try {
    // 使用 matrixClientService 创建房间
    const client = matrixClientService.getClient()
    if (!client) {
      message.error('Matrix 客户端未初始化')
      return
    }

    // 创建一个新的普通房间
    const createRoomMethod = (
      client as {
        createRoom: (options: {
          name: string
          topic: string
          preset: string
          room_alias_name?: string
          visibility: string
          initial_state?: Array<{
            type: string
            state_key: string
            content: Record<string, unknown>
          }>
        }) => Promise<{ room_id: string }>
      }
    ).createRoom

    const response = await createRoomMethod({
      name: '新房间',
      topic: '创建于 ' + new Date().toLocaleString('zh-CN'),
      preset: 'private_chat', // 私有聊天
      room_alias_name: '', // 可选：房间别名
      visibility: 'private', // 私有房间
      initial_state: [
        {
          type: 'm.room.encryption',
          state_key: '',
          content: {
            algorithm: 'm.megolm.v1.aes-sha2'
          }
        }
      ]
    })

    const roomId = response?.room_id || ''
    if (!roomId) {
      message.error('创建房间失败：未返回房间ID')
      return
    }

    message.success('房间创建成功')

    // 导航到新创建的房间
    router.push({
      name: 'room',
      params: { roomId }
    })

    logger.info('[MatrixRoomList] Room created successfully', { roomId })
  } catch (error) {
    logger.error('[MatrixRoomList] Failed to create room:', error)
    message.error('创建房间失败')
  }
}

const getDMInitials = (room: RoomWithMeta): string => {
  const member = room.members?.[0]
  if (!member) return '?'

  const displayName = getMemberDisplayName(member)
  const names = displayName.split(' ')
  if (names.length >= 2) {
    return names[0][0] + names[1][0]
  }
  return displayName.substring(0, 2).toUpperCase()
}

const getDMDisplayName = (room: RoomWithMeta): string => {
  const member = room.members?.[0]
  if (!member) return 'Unknown'
  return getMemberDisplayName(member)
}

const getLastMessagePreview = (room: RoomWithMeta): string => {
  if (!room.lastEvent) return '暂无消息'

  const eventType = getEventType(room.lastEvent)
  const content = getEventContent(room.lastEvent)

  switch (eventType) {
    case 'm.text':
    case 'm.room.message':
      return (content.body as string) || '文本消息'
    case 'm.image':
      return '[图片]'
    case 'm.video':
      return '[视频]'
    case 'm.audio':
      return '[语音]'
    case 'm.file':
      return '[文件]'
    default:
      return '消息'
  }
}

const formatTimestamp = (event: ExtendedMatrixEvent | null | undefined): string => {
  const timestamp = getEventTimestamp(event)
  if (!timestamp) return ''

  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // Today
  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // This week
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString('zh-CN', {
      weekday: 'short'
    })
  }

  // This year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    })
  }

  // Older
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Lifecycle
onMounted(() => {
  loadSpacesAndRooms()
})
</script>

<style scoped>
.matrix-room-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--n-color);
}

.search-bar {
  padding: 12px;
  border-bottom: 1px solid var(--n-border-color);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--n-text-color-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.spaces-section {
  border-bottom: 1px solid var(--n-border-color);
}

.spaces-list,
.rooms-list {
  padding: 4px 0;
}

.space-item,
.room-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.space-item:hover,
.room-item:hover {
  background: var(--n-hover-color);
}

.room-item.active {
  background: var(--n-pressed-color);
}

.space-info,
.room-info {
  flex: 1;
  min-width: 0;
}

.space-name,
.room-name {
  display: block;
  font-weight: 500;
  color: var(--n-text-color-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-count {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.last-message {
  display: block;
  font-size: 12px;
  color: var(--n-text-color-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.timestamp {
  font-size: 11px;
  color: var(--n-text-color-3);
}

.room-group {
  margin-bottom: 8px;
}

.group-header {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--n-text-color-3);
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  color: var(--n-text-color-3);
}

.loading-state span,
.empty-state p {
  margin: 0;
}
</style>
