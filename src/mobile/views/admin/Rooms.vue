<template>
  <div class="mobile-admin-rooms">
    <!-- Header -->
    <van-nav-bar :title="t('admin.rooms.title')" left-arrow @click-left="handleBack">
      <template #right>
        <van-icon name="plus" @click="handleCreateRoom" />
      </template>
    </van-nav-bar>

    <!-- Search -->
    <van-search v-model="searchQuery" :placeholder="t('admin.rooms.search_placeholder')" @input="handleSearch" />

    <!-- Filters -->
    <van-dropdown-menu>
      <van-dropdown-item v-model="roomTypeFilter" :options="roomTypeOptions" @change="handleFilterChange" />
      <van-dropdown-item v-model="sortOption" :options="sortOptions" @change="handleFilterChange" />
    </van-dropdown-menu>

    <!-- Room List -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list v-model:loading="loading" :finished="finished" :finished-text="t('common.no_more')" @load="onLoad">
        <van-cell v-for="room in filteredRooms" :key="room.roomId" is-link @click="handleViewRoom(room)">
          <template #title>
            <div class="room-name">{{ room.name || room.roomId }}</div>
            <div class="room-id">{{ room.roomId }}</div>
          </template>
          <template #icon>
            <van-image round width="40" height="40" :src="getRoomAvatar(room)" />
          </template>
          <template #right-icon>
            <van-space>
              <van-tag :type="roomTypeColor(room.type)">{{ roomTypeLabel(room.type) }}</van-tag>
              <van-tag :type="room.joined ? 'success' : 'default'">
                {{ room.joined ? '已加入' : '未加入' }}
              </van-tag>
            </van-space>
          </template>
          <template #label>
            <div class="room-info">
              <span>{{ room.memberCount }} 成员</span>
              <span v-if="room.topic" class="room-topic">{{ room.topic }}</span>
            </div>
          </template>
        </van-cell>
      </van-list>
    </van-pull-refresh>

    <!-- Empty State -->
    <van-empty v-if="filteredRooms.length === 0 && !loading" :description="t('admin.rooms.no_rooms')" />

    <!-- Room Detail Sheet -->
    <van-action-sheet v-model:show="showRoomSheet" :title="selectedRoom?.name || selectedRoom?.roomId">
      <div class="room-detail">
        <van-cell-group>
          <van-cell title="房间 ID" :value="selectedRoom?.roomId" />
          <van-cell title="房间名称" :value="selectedRoom?.name || '-'" />
          <van-cell title="房间类型">
            <template #value>
              <van-tag :type="roomTypeColor(selectedRoom?.type)">
                {{ roomTypeLabel(selectedRoom?.type) }}
              </van-tag>
            </template>
          </van-cell>
          <van-cell title="成员数量" :value="selectedRoom?.memberCount.toString()" />
          <van-cell title="创建者" :value="selectedRoom?.creator || '-'" />
          <van-cell title="加入状态">
            <template #value>
              <van-tag :type="selectedRoom?.joined ? 'success' : 'default'">
                {{ selectedRoom?.joined ? '已加入' : '未加入' }}
              </van-tag>
            </template>
          </van-cell>
          <van-cell title="创建时间" :value="formatTimestamp(selectedRoom?.creationTs)" />
        </van-cell-group>

        <van-space direction="vertical" class="room-actions">
          <van-button v-if="!selectedRoom?.joined" type="primary" block @click="handleJoinRoom(selectedRoom)">
            加入房间
          </van-button>
          <van-button v-if="selectedRoom?.joined" type="warning" block @click="handleLeaveRoom(selectedRoom)">
            离开房间
          </van-button>
          <van-button type="danger" block @click="handleDeleteRoom(selectedRoom)">删除房间</van-button>
        </van-space>
      </div>
    </van-action-sheet>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { showToast, showLoadingToast, closeToast, showConfirmDialog } from 'vant'
import { logger } from '@/utils/logger'
import { adminClient } from '@/services/adminClient'
import { joinRoom, leaveRoom } from '@/integrations/matrix/rooms'

const { t } = useI18n()
const router = useRouter()

interface Room {
  roomId: string
  name?: string
  topic?: string
  type: 'room' | 'space' | 'dm'
  memberCount: number
  creator?: string
  joined: boolean
  creationTs: number
  avatarUrl?: string
}

const searchQuery = ref('')
const roomTypeFilter = ref<'all' | 'room' | 'space' | 'dm'>('all')
const sortOption = ref<'name' | 'members' | 'newest'>('newest')
const loading = ref(false)
const refreshing = ref(false)
const finished = ref(false)
const rooms = ref<Room[]>([])
const showRoomSheet = ref(false)
const selectedRoom = ref<Room | null>(null)
const nextToken = ref<string | undefined>(undefined)
const totalCount = ref(0)

// Admin API response interface
interface AdminRoomResponse {
  room_id: string
  name?: string
  topic?: string
  joined_members?: number
  num_joined_members?: number
  created_ts?: number
  creator?: string
  avatar_url?: string
  joined_local_members?: number
  canonical_alias?: string
}

// Transform AdminRoom to Room interface
function transformAdminRoom(adminRoom: AdminRoomResponse): Room {
  // Determine room type based on properties
  const isSpace = adminRoom.room_id.startsWith('!') && adminRoom.name?.toLowerCase().includes('space')
  const isDM = adminRoom.joined_members === 2

  return {
    roomId: adminRoom.room_id,
    name: adminRoom.name || undefined,
    topic: adminRoom.topic || undefined,
    type: isDM ? 'dm' : isSpace ? 'space' : 'room',
    memberCount: adminRoom.joined_members || adminRoom.num_joined_members || 0,
    creator: adminRoom.creator,
    joined: (adminRoom.joined_local_members ?? 0) > 0,
    creationTs: (adminRoom.created_ts ?? 0) * 1000, // Convert to milliseconds
    avatarUrl: adminRoom.avatar_url || undefined
  }
}

const roomTypeOptions = [
  { text: '全部', value: 'all' },
  { text: '房间', value: 'room' },
  { text: '空间', value: 'space' },
  { text: '私聊', value: 'dm' }
]

const sortOptions = [
  { text: '最新创建', value: 'newest' },
  { text: '成员数量', value: 'members' },
  { text: '房间名称', value: 'name' }
]

const filteredRooms = computed(() => {
  let result = rooms.value

  // Filter by type
  if (roomTypeFilter.value !== 'all') {
    result = result.filter((room) => room.type === roomTypeFilter.value)
  }

  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (room) => room.roomId.toLowerCase().includes(query) || (room.name && room.name.toLowerCase().includes(query))
    )
  }

  // Sort
  result = [...result].sort((a, b) => {
    switch (sortOption.value) {
      case 'name':
        return (a.name || a.roomId).localeCompare(b.name || b.roomId)
      case 'members':
        return b.memberCount - a.memberCount
      case 'newest':
        return b.creationTs - a.creationTs
      default:
        return 0
    }
  })

  return result
})

function roomTypeLabel(type?: string): string {
  const labels: Record<string, string> = {
    room: '房间',
    space: '空间',
    dm: '私聊'
  }
  return labels[type || ''] || '未知'
}

function roomTypeColor(type?: string): 'primary' | 'success' | 'warning' | 'danger' {
  const colors: Record<string, 'primary' | 'success' | 'warning' | 'danger'> = {
    room: 'primary',
    space: 'success',
    dm: 'warning'
  }
  return colors[type || ''] || 'default'
}

async function onLoad() {
  try {
    // Call AdminClient API to load rooms
    // NOTE: order_by doesn't support 'creation_ts', using 'joined_members' as proxy for activity
    const result = await adminClient.listRooms({
      from: 0,
      limit: 50,
      order_by: sortOption.value === 'name' ? 'name' : 'joined_members',
      dir: sortOption.value === 'newest' ? 'b' : 'f'
    })

    // Transform admin rooms to our Room interface
    const transformedRooms = result.rooms.map(transformAdminRoom)
    rooms.value = [...rooms.value, ...transformedRooms]

    // Update pagination state
    nextToken.value = result.next_batch
    totalCount.value = result.total_rooms
    finished.value = !result.next_batch

    loading.value = false
  } catch (error) {
    logger.error('[MobileAdminRooms] Failed to load rooms:', error)
    showToast.fail('加载房间列表失败')
    loading.value = false
  }
}

async function onRefresh() {
  try {
    finished.value = false
    nextToken.value = undefined
    rooms.value = []
    totalCount.value = 0

    const result = await adminClient.listRooms({
      from: 0,
      limit: 50,
      order_by: sortOption.value === 'name' ? 'name' : 'joined_members',
      dir: sortOption.value === 'newest' ? 'b' : 'f'
    })

    const transformedRooms = result.rooms.map(transformAdminRoom)
    rooms.value = transformedRooms
    nextToken.value = result.next_batch
    totalCount.value = result.total_rooms
    finished.value = !result.next_batch

    refreshing.value = false
    showToast.success('刷新成功')
  } catch (error) {
    logger.error('[MobileAdminRooms] Failed to refresh rooms:', error)
    showToast.fail('刷新失败')
    refreshing.value = false
  }
}

function handleSearch() {
  // Search is handled by computed property
}

function handleFilterChange() {
  // Filter is handled by computed property
}

function handleBack() {
  router.back()
}

function handleCreateRoom() {
  // Navigate to the room creation page in the settings
  router.push('/mobile/rooms/manage')
}

function handleViewRoom(room: Room) {
  selectedRoom.value = room
  showRoomSheet.value = true
}

async function handleJoinRoom(room: Room | null) {
  if (!room) return
  showRoomSheet.value = false

  try {
    showLoadingToast({
      message: '加入房间中...',
      forbidClick: true,
      duration: 0
    })

    // Join room using Matrix client (user operation, not admin)
    await joinRoom(room.roomId)

    room.joined = true
    closeToast()
    showToast.success('加入成功')
  } catch (error) {
    logger.error('[MobileAdminRooms] Failed to join room:', error)
    closeToast()
    showToast.fail('加入失败')
  }
}

async function handleLeaveRoom(room: Room | null) {
  if (!room) return
  showRoomSheet.value = false

  try {
    showConfirmDialog({
      title: '离开房间',
      message: `确认要离开 ${room.name || room.roomId} 吗？`
    })
      .then(async () => {
        showLoadingToast({
          message: '离开房间中...',
          forbidClick: true,
          duration: 0
        })

        // Leave room using Matrix client (user operation, not admin)
        await leaveRoom(room.roomId)

        room.joined = false
        closeToast()
        showToast.success('已离开房间')
      })
      .catch(() => {
        // User cancelled
      })
  } catch (error) {
    logger.error('[MobileAdminRooms] Failed to leave room:', error)
    showToast.fail('操作失败')
  }
}

async function handleDeleteRoom(room: Room | null) {
  if (!room) return
  showRoomSheet.value = false

  try {
    showConfirmDialog({
      title: '删除房间',
      message: `确认要删除 ${room.name || room.roomId} 吗？此操作不可撤销。`
    })
      .then(async () => {
        showLoadingToast({
          message: '删除中...',
          forbidClick: true,
          duration: 0
        })

        // Call AdminClient API to delete room
        await adminClient.deleteRoom(room.roomId, { block: false, purge: false })

        // Remove from local state
        rooms.value = rooms.value.filter((r) => r.roomId !== room.roomId)
        totalCount.value--

        closeToast()
        showToast.success('删除成功')
      })
      .catch(() => {
        // User cancelled
      })
  } catch (error) {
    logger.error('[MobileAdminRooms] Failed to delete room:', error)
    showToast.fail('删除失败')
  }
}

function getRoomAvatar(room: Room): string {
  if (room.avatarUrl) {
    return room.avatarUrl
  }
  // Generate avatar from room ID
  const roomId = room.roomId
  const avatarUrl = `https://picsum.photos/seed/${roomId}/40/40`
  return avatarUrl
}

function formatTimestamp(timestamp?: number): string {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN')
}

onMounted(() => {
  onLoad()
})
</script>

<style scoped>
.mobile-admin-rooms {
  min-height: 100vh;
  background-color: var(--hula-gray-50);
}

.room-name {
  font-weight: 500;
  font-size: 15px;
}

.room-id {
  font-size: 12px;
  color: var(--hula-gray-400);
  margin-top: 2px;
}

.room-info {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--hula-gray-400);
}

.room-topic {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.room-detail {
  padding: 16px;
}

.room-actions {
  padding: 16px;
  width: 100%;
}
</style>
