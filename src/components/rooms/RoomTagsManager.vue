<!--
  Room Tags Manager

  Manage room tags using Matrix SDK's native tag support.
  Uses client.setRoomTag() to assign tags to rooms.

  SDK Integration:
  - client.setRoomTag(roomId, tagName, options) - Set room tag
  - client.roomTags - Get room tags
  - client.deleteRoomTag(roomId, tagName) - Delete room tag
-->
<script setup lang="ts">
import { ref, computed, watch, onMounted, h } from 'vue'
import {
  NCard,
  NButton,
  NSpace,
  NTag,
  NInput,
  NInputNumber,
  NSelect,
  NEmpty,
  useMessage,
  NSpin,
  NDataTable
} from 'naive-ui'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import { useI18n } from 'vue-i18n'
import { setRoomTag, deleteRoomTag } from '@/utils/matrixClientUtils'

interface Props {
  roomId?: string
  mode?: 'manage' | 'assign'
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'manage'
})

const emit = defineEmits<{
  tagAssigned: [roomId: string, tagName: string]
}>()

const message = useMessage()
const { t } = useI18n()

interface RoomTag {
  name: string
  order: number
  rooms: string[]
}

interface TaggedRoom {
  roomId: string
  name: string
  avatar: string
  tags: string[]
}

// State
const loading = ref(false)
const customTags = ref<RoomTag[]>([])
const taggedRooms = ref<TaggedRoom[]>([])
const newTagName = ref('')
const newTagOrder = ref(0.5)

// Default Matrix tags
const defaultTags = computed(() => [
  { label: 'm.favourite', value: 'm.favourite', icon: '⭐' },
  { label: 'm.lowpriority', value: 'm.lowpriority', icon: '⬇️' }
])

const hasCustomTags = computed(() => customTags.value.length > 0)
const hasTaggedRooms = computed(() => taggedRooms.value.length > 0)

/**
 * Load all rooms and their tags using SDK
 */
async function loadRoomTags() {
  loading.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    logger.info('[RoomTagsManager] Loading room tags')

    // Get all rooms
    const rooms =
      (client.getRooms as (() => Array<{ roomId?: string; name?: string; avatarUrl?: string }>) | undefined)?.() || []

    // Collect tagged rooms
    const roomMap = new Map<string, TaggedRoom>()

    for (const room of rooms) {
      const roomId = room.roomId || ''
      const roomName = room.name || roomId
      const avatar = room.avatarUrl || ''

      // Get tags for this room using SDK
      const tags = (client.getRoomTags as ((roomId: string) => Record<string, unknown>) | undefined)?.(roomId) || {}
      const tagNames = Object.keys(tags).filter((tag) => tags[tag])

      if (tagNames.length > 0) {
        roomMap.set(roomId, {
          roomId,
          name: roomName,
          avatar,
          tags: tagNames
        })
      }
    }

    taggedRooms.value = Array.from(roomMap.values())

    // Load custom tags (non-default tags)
    const allTags = new Set<string>()
    taggedRooms.value.forEach((room) => {
      room.tags.forEach((tag) => {
        if (!defaultTags.value.find((dt) => dt.value === tag)) {
          allTags.add(tag)
        }
      })
    })

    customTags.value = Array.from(allTags).map((tag) => ({
      name: tag,
      order: 0.5,
      rooms: taggedRooms.value.filter((r) => r.tags.includes(tag)).map((r) => r.roomId)
    }))

    logger.info('[RoomTagsManager] Room tags loaded:', {
      taggedRooms: taggedRooms.value.length,
      customTags: customTags.value.length
    })
  } catch (error) {
    logger.error('[RoomTagsManager] Failed to load room tags:', error)
    message.error(t('matrix.common.error'))
  } finally {
    loading.value = false
  }
}

/**
 * Create a new custom tag
 */
async function createTag() {
  if (!newTagName.value.trim()) {
    message.warning('Tag name cannot be empty')
    return
  }

  const tagName = `u.custom.${newTagName.value.trim().toLowerCase().replace(/\s+/g, '-')}`

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    logger.info('[RoomTagsManager] Creating tag:', tagName)

    // Add to custom tags list
    customTags.value.push({
      name: tagName,
      order: newTagOrder.value,
      rooms: []
    })

    newTagName.value = ''
    newTagOrder.value = 0.5

    message.success('Tag created')
  } catch (error) {
    logger.error('[RoomTagsManager] Failed to create tag:', error)
    message.error('Failed to create tag')
  }
}

/**
 * Assign a tag to a room
 */
async function assignTagToRoom(roomId: string, tagName: string) {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    logger.info('[RoomTagsManager] Assigning tag to room:', { roomId, tagName })

    // Use SDK's setRoomTag
    await setRoomTag(client, roomId, tagName, {
      order: Math.floor(Date.now() / 1000)
    })

    message.success('Tag assigned')
    emit('tagAssigned', roomId, tagName)

    // Reload tags
    await loadRoomTags()
  } catch (error) {
    logger.error('[RoomTagsManager] Failed to assign tag:', error)
    message.error('Failed to assign tag')
  }
}

/**
 * Remove a tag from a room
 */
async function removeTagFromRoom(roomId: string, tagName: string) {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    logger.info('[RoomTagsManager] Removing tag from room:', { roomId, tagName })

    // Use SDK's deleteRoomTag
    await deleteRoomTag(client, roomId, tagName)

    message.success('Tag removed')

    // Reload tags
    await loadRoomTags()
  } catch (error) {
    logger.error('[RoomTagsManager] Failed to remove tag:', error)
    message.error('Failed to remove tag')
  }
}

/**
 * Delete a custom tag
 */
async function deleteTag(tagName: string) {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    logger.info('[RoomTagsManager] Deleting tag:', tagName)

    // Remove tag from all rooms that have it
    for (const room of taggedRooms.value) {
      if (room.tags.includes(tagName)) {
        await deleteRoomTag(client, room.roomId, tagName)
      }
    }

    message.success('Tag deleted')

    // Reload tags
    await loadRoomTags()
  } catch (error) {
    logger.error('[RoomTagsManager] Failed to delete tag:', error)
    message.error('Failed to delete tag')
  }
}

/**
 * Get tag display name
 */
function getTagName(tagName: string): string {
  const defaultTag = defaultTags.value.find((dt) => dt.value === tagName)
  if (defaultTag) {
    return defaultTag.label
  }
  // Remove "u.custom." prefix
  return tagName.replace('u.custom.', '').replace(/-/g, ' ')
}

/**
 * Get tag icon
 */
function getTagIcon(tagName: string): string {
  const defaultTag = defaultTags.value.find((dt) => dt.value === tagName)
  return defaultTag?.icon || '🏷️'
}

// Table columns for tagged rooms
const columns = computed(() => [
  {
    title: 'Room',
    key: 'name',
    render(row: TaggedRoom) {
      return row.name
    }
  },
  {
    title: 'Tags',
    key: 'tags',
    render(row: TaggedRoom) {
      return row.tags.map((tag) =>
        h(
          NTag,
          { size: 'small', closable: false },
          {
            default: () => `${getTagIcon(tag)} ${getTagName(tag)}`
          }
        )
      )
    }
  },
  {
    title: 'Actions',
    key: 'actions',
    render(row: TaggedRoom) {
      return h(NSpace, { size: 'small' }, () => [
        h(NSelect, {
          size: 'small',
          placeholder: 'Add tag',
          options: [
            ...defaultTags.value,
            ...customTags.value.map((ct) => ({ label: getTagName(ct.name), value: ct.name }))
          ],
          onUpdateValue: (value: string) => assignTagToRoom(row.roomId, value)
        })
      ])
    }
  }
])

// Lifecycle
onMounted(() => {
  loadRoomTags()
})

// Watch for roomId changes
watch(
  () => props.roomId,
  () => {
    if (props.roomId) {
      loadRoomTags()
    }
  }
)
</script>

<template>
  <div class="room-tags-manager">
    <!-- Header -->
    <div class="room-tags-manager__header">
      <h3>{{ t('matrix.roomTags.title', 'Room Tags') }}</h3>
      <NButton secondary size="small" :loading="loading" @click="loadRoomTags">
        {{ t('matrix.common.refresh', 'Refresh') }}
      </NButton>
    </div>

    <!-- Create Tag -->
    <NCard v-if="mode === 'manage'" size="small" class="create-tag-card">
      <template #header>
        <span>Create Custom Tag</span>
      </template>
      <NSpace vertical :size="12">
        <NSpace :size="12">
          <NInput
            v-model:value="newTagName"
            placeholder="Tag name"
            clearable />
          <NInputNumber
            v-model:value="newTagOrder"
            placeholder="Order (0-1)"
            :min="0"
            :max="1"
            :step="0.1"
            style="width: 150px" />
          <NButton type="primary" :disabled="!newTagName.trim()" @click="createTag">
            Create
          </NButton>
        </NSpace>
      </NSpace>
    </NCard>

    <!-- Default Tags -->
    <NCard size="small" class="tags-card">
      <template #header>
        <span>Default Tags</span>
      </template>
      <NSpace :size="8">
        <NTag
          v-for="tag in defaultTags"
          :key="tag.value"
          size="large"
          :bordered="false"
          type="info">
          {{ tag.icon }} {{ tag.label }}
        </NTag>
      </NSpace>
    </NCard>

    <!-- Custom Tags -->
    <NCard v-if="mode === 'manage'" size="small" class="tags-card">
      <template #header>
        <span>Custom Tags</span>
      </template>
      <NSpin :show="loading">
        <NEmpty v-if="!hasCustomTags && !loading" description="No custom tags" size="small" />
        <NSpace v-else :size="8" vertical>
          <div v-for="tag in customTags" :key="tag.name" class="custom-tag-item">
            <NSpace align="center" :size="8">
              <NTag size="large" :bordered="false" type="success">
                🏷️ {{ getTagName(tag.name) }}
              </NTag>
              <span class="tag-count">{{ tag.rooms.length }} rooms</span>
              <NButton size="small" type="error" @click="deleteTag(tag.name)">
                Delete
              </NButton>
            </NSpace>
          </div>
        </NSpace>
      </NSpin>
    </NCard>

    <!-- Tagged Rooms -->
    <NCard size="small" class="rooms-card">
      <template #header>
        <span>Tagged Rooms</span>
      </template>
      <NSpin :show="loading">
        <NEmpty v-if="!hasTaggedRooms && !loading" description="No tagged rooms" size="small" />
        <n-data-table v-else :columns="columns" :data="taggedRooms" :bordered="false" size="small" />
      </NSpin>
    </NCard>
  </div>
</template>

<style scoped>
.room-tags-manager {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.room-tags-manager__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.room-tags-manager__header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.create-tag-card,
.tags-card,
.rooms-card {
  background: #fff;
}

.custom-tag-item {
  padding: 8px;
  background: #f9f9f9;
  border-radius: 6px;
}

.tag-count {
  font-size: 12px;
  color: #999;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .room-tags-manager__header h3 {
    color: #eee;
  }

  .create-tag-card,
  .tags-card,
  .rooms-card {
    background: #2a2a2a;
  }

  .custom-tag-item {
    background: #333;
  }

  .tag-count {
    color: #666;
  }
}
</style>
