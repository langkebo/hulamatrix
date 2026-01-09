<!--
  Room Directory Browser

  Browse and join public Matrix rooms from the server directory.
  Uses Matrix SDK's native getPublicRooms() method.

  SDK Integration:
  - client.getPublicRooms() - Search public rooms
  - client.joinRoom() - Join selected room
-->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { NCard, NSpin, NInput, NButton, NTag, NAvatar, NEmpty, NSpace, NTooltip, useMessage } from 'naive-ui'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import { useI18n } from 'vue-i18n'
import { getPublicRooms, joinRoom, mxcUrlToHttp } from '@/utils/matrixClientUtils'

interface Props {
  /** Initial search term */
  initialSearchTerm?: string
  /** Specific server to search (hs_url) */
  server?: string
  /** Maximum results per page */
  pageSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  pageSize: 20
})

const emit = defineEmits<{
  joinRoom: [roomId: string]
  previewRoom: [roomId: string]
}>()

const message = useMessage()
const { t } = useI18n()

// Local interface for public room data from SDK
interface PublicRoom {
  roomId: string
  name: string
  topic?: string
  avatar?: string
  numJoinedMembers?: number
  worldReadable?: boolean
  guestCanJoin?: boolean
}

// State
const loading = ref(false)
const rooms = ref<PublicRoom[]>([])
const nextBatch = ref<string | undefined>(undefined)
const hasMore = ref(false)
const searchTerm = ref(props.initialSearchTerm || '')
const totalCount = ref(0)

// Computed
const hasRooms = computed(() => rooms.value.length > 0)

/**
 * Load public rooms from directory
 */
async function loadRooms(direction: 'initial' | 'next' = 'initial') {
  if (loading.value) return

  loading.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      message.error('Matrix client not initialized')
      return
    }

    logger.info('[RoomDirectory] Loading public rooms:', {
      searchTerm: searchTerm.value,
      server: props.server,
      direction
    })

    const response = await (
      client.getPublicRooms as (opts?: {
        limit?: number
        since?: string
        server?: string
        filter?: { generic_search_term?: string }
      }) => Promise<{
        chunk?: Array<{
          room_id: string
          name?: string
          aliases?: string[]
          topic?: string
          avatar_url?: string
          num_joined_members?: number
          world_readable?: boolean
          guest_can_join?: boolean
        }>
        next_batch?: string
        total_room_count_estimate?: number
      }>
    )?.({
      limit: props.pageSize,
      since: direction === 'next' ? nextBatch.value : undefined,
      server: props.server,
      filter: searchTerm.value
        ? {
            generic_search_term: searchTerm.value
          }
        : undefined
    })

    const newRooms = (response?.chunk || []).map(
      (room: {
        room_id: string
        name?: string
        aliases?: string[]
        topic?: string
        avatar_url?: string
        num_joined_members?: number
        world_readable?: boolean
        guest_can_join?: boolean
      }) => ({
        roomId: room.room_id,
        name: room.name || room.aliases?.[0] || room.room_id,
        topic: room.topic,
        avatar: room.avatar_url,
        numJoinedMembers: room.num_joined_members || 0,
        worldReadable: room.world_readable || false,
        guestCanJoin: room.guest_can_join || false
      })
    )

    if (direction === 'initial') {
      rooms.value = newRooms
    } else {
      rooms.value.push(...newRooms)
    }

    nextBatch.value = response.next_batch
    hasMore.value = !!response.next_batch
    totalCount.value = response.total_room_count_estimate || newRooms.length

    logger.info('[RoomDirectory] Rooms loaded:', {
      count: newRooms.length,
      total: rooms.value.length
    })
  } catch (error) {
    logger.error('[RoomDirectory] Failed to load rooms:', error)
    message.error('Failed to load room directory')
  } finally {
    loading.value = false
  }
}

/**
 * Search rooms by term
 */
function handleSearch() {
  loadRooms('initial')
}

/**
 * Load more rooms (pagination)
 */
function loadMore() {
  if (hasMore.value && !loading.value) {
    loadRooms('next')
  }
}

/**
 * Join a room
 */
async function handleJoinRoom(roomId: string, roomName: string) {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      message.error('Matrix client not initialized')
      return
    }

    logger.info('[RoomDirectory] Joining room:', { roomId, roomName })

    await joinRoom(client, roomId)

    message.success(`Joined ${roomName}`)
    emit('joinRoom', roomId)

    // Refresh room list to update joined status
    loadRooms('initial')
  } catch (error) {
    logger.error('[RoomDirectory] Failed to join room:', { roomId, error })
    message.error(`Failed to join ${roomName}`)
  }
}

/**
 * Preview room details
 */
function handlePreviewRoom(roomId: string) {
  emit('previewRoom', roomId)
}

/**
 * Get avatar URL with proper size
 */
function getAvatarUrl(room: PublicRoom): string {
  if (!room.avatar) return ''
  const client = matrixClientService.getClient()
  if (!client) return room.avatar

  // Use SDK's mxcUrlToHttp for proper URL conversion
  return mxcUrlToHttp(client, room.avatar, 80, 80) || room.avatar
}

// Lifecycle
onMounted(() => {
  loadRooms('initial')
})

// Watch for prop changes
watch(
  () => props.server,
  () => {
    loadRooms('initial')
  }
)
</script>

<template>
  <div class="room-directory">
    <!-- Search Bar -->
    <div class="room-directory__search">
      <NInput
        v-model:value="searchTerm"
        type="text"
        :placeholder="t('matrix.roomDirectory.searchPlaceholder')"
        clearable
        @keyup.enter="handleSearch">
        <template #prefix>
          <span class="icon">🔍</span>
        </template>
        <template #suffix>
          <NButton secondary type="primary" :disabled="loading" @click="handleSearch">{{ t('matrix.roomDirectory.searchRooms') }}</NButton>
        </template>
      </NInput>
    </div>

    <!-- Results Count -->
    <div v-if="hasRooms" class="room-directory__count">{{ t('matrix.roomDirectory.foundRooms', { count: totalCount }) }}</div>

    <!-- Room List -->
    <div class="room-directory__list">
      <NSpin :show="loading && rooms.length === 0">
        <!-- Empty State -->
        <NEmpty v-if="!hasRooms && !loading" :description="t('matrix.roomDirectory.noRooms')">
          <template #icon>
            <span class="empty-icon">🏠</span>
          </template>
          <template #extra>
            <NButton size="small" @click="handleSearch">{{ t('matrix.roomDirectory.refresh') }}</NButton>
          </template>
        </NEmpty>

        <!-- Room Cards -->
        <div v-else class="room-list">
          <NCard v-for="room in rooms" :key="room.roomId" class="room-card" hoverable size="small">
            <template #cover>
              <div v-if="room.avatar" class="room-card__avatar">
                <NAvatar :src="getAvatarUrl(room)" :size="80" round />
              </div>
            </template>

            <div class="room-card__content">
              <!-- Room Name -->
              <div class="room-card__name">
                {{ room.name }}
              </div>

              <!-- Room Topic -->
              <div v-if="room.topic" class="room-card__topic">
                {{ room.topic }}
              </div>

              <!-- Room Tags -->
              <div class="room-card__tags">
                <NTag v-if="room.worldReadable" type="info" size="small">{{ t('matrix.roomDirectory.public') }}</NTag>
                <NTag v-if="room.guestCanJoin" type="success" size="small">{{ t('matrix.roomDirectory.guestsAllowed') }}</NTag>
                <NTag type="default" size="small">{{ t('matrix.roomDirectory.members', { count: room.numJoinedMembers || 0 }) }}</NTag>
              </div>

              <!-- Actions -->
              <div class="room-card__actions">
                <NButton size="small" type="default" @click="handlePreviewRoom(room.roomId)">{{ t('matrix.roomDirectory.preview') }}</NButton>
                <NButton size="small" type="primary" @click="handleJoinRoom(room.roomId, room.name)">{{ t('matrix.roomDirectory.joinRoom') }}</NButton>
              </div>
            </div>
          </NCard>
        </div>
      </NSpin>
    </div>

    <!-- Load More -->
    <div v-if="hasMore" class="room-directory__load-more">
      <NButton secondary :loading="loading" @click="loadMore">{{ t('matrix.roomDirectory.loadMore') }}</NButton>
    </div>
  </div>
</template>

<style scoped>
.room-directory {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  max-height: 100%;
  overflow-y: auto;
}

.room-directory__search {
  position: sticky;
  top: 0;
  z-index: 10;
}

.room-directory__count {
  font-size: 14px;
  color: #999;
  text-align: center;
}

.room-directory__list {
  flex: 1;
  min-height: 200px;
}

.room-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.room-card {
  display: flex;
  flex-direction: column;
}

.room-card__avatar {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
  background: linear-gradient(135deg, var(--hula-brand-primary) 0%, var(--hula-brand-primary) 100%);
}

.room-card__content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.room-card__name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.room-card__topic {
  font-size: 13px;
  color: #666;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 36px;
}

.room-card__tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.room-card__actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.room-card__actions :deep(.n-button) {
  flex: 1;
}

.room-directory__load-more {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

.empty-icon {
  font-size: 48px;
}

.icon {
  font-size: 18px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .room-card__name {
    color: #eee;
  }

  .room-card__topic {
    color: #aaa;
  }
}
</style>
