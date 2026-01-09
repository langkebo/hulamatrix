<!-- Mobile Message Forward Dialog - Forward a message on mobile -->
<template>
  <n-modal
    v-model:show="showDialog"
    preset="card"
    :title="t('message.forward')"
    class="w-90-max-w-500px"
    @close="handleClose">
    <div class="mobile-message-forward">
      <!-- Original Message Preview -->
      <div class="original-message">
        <div class="preview-label">{{ t('message.forwarding') }}</div>
        <div class="preview-content">{{ content }}</div>
      </div>

      <!-- Room Selection -->
      <div class="room-selection">
        <div class="section-label">{{ t('message.selectRoom') }}</div>

        <!-- Search -->
        <div class="search-section">
          <n-input v-model:value="searchQuery" :placeholder="t('message.searchRooms')" clearable @input="handleSearch">
            <template #prefix>
              <n-icon><Search /></n-icon>
            </template>
          </n-input>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="loading-state">
          <n-spin size="medium" />
          <p>{{ t('message.loadingRooms') }}</p>
        </div>

        <!-- Room List -->
        <div v-else-if="filteredRooms.length > 0" class="room-list">
          <div
            v-for="room in filteredRooms"
            :key="room.roomId"
            class="room-item"
            :class="{ selected: selectedRoomId === room.roomId }"
            @click="selectRoom(room.roomId)">
            <n-avatar :src="room.avatar" :size="40" round>
              <template #fallback>
                <span>{{ room.name?.[0] || '?' }}</span>
              </template>
            </n-avatar>
            <div class="room-info">
              <div class="room-name">{{ room.name }}</div>
              <div class="room-members">{{ room.memberCount || 0 }} {{ t('message.members') }}</div>
            </div>
            <n-icon v-if="selectedRoomId === room.roomId" :size="20" color="var(--hula-success)">
              <Check />
            </n-icon>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <n-icon :size="48" color="var(--hula-gray-300)">
            <Search />
          </n-icon>
          <p>{{ searchQuery ? t('message.noRoomsFound') : t('message.noRooms') }}</p>
        </div>
      </div>

      <!-- Actions -->
      <template #footer>
        <n-space vertical>
          <n-button
            type="primary"
            block
            size="large"
            :loading="sending"
            :disabled="!selectedRoomId"
            @click="forwardMessage">
            <template #icon>
              <n-icon><Send /></n-icon>
            </template>
            {{ t('message.forward') }}
          </n-button>
          <n-button block @click="handleClose">
            {{ t('common.cancel') }}
          </n-button>
        </n-space>
      </template>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NInput, NButton, NSpace, NIcon, NSpin, NAvatar, useMessage } from 'naive-ui'
import { Search, Check, Send } from '@vicons/tabler'
import { matrixClientService } from '@/integrations/matrix/client'
import { sendMessage } from '@/utils/matrixClientUtils'
import { useChatStore } from '@/stores/chat'
import { logger } from '@/utils/logger'
import { msg } from '@/utils/SafeUI'

interface Props {
  show: boolean
  roomId: string
  eventId: string
  content: string
}

interface RoomInfo {
  roomId: string
  name: string
  avatar: string
  memberCount?: number
}

const props = defineProps<Props>()

interface Emits {
  'update:show': [value: boolean]
  forwarded: [data: { toRoomId: string; eventId: string }]
}

const emit = defineEmits<Emits>()

const { t } = useI18n()
const message = useMessage()
const chatStore = useChatStore()

// State
const loading = ref(false)
const sending = ref(false)
const searchQuery = ref('')
const selectedRoomId = ref('')
const availableRooms = ref<RoomInfo[]>([])

// Computed
const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const filteredRooms = computed(() => {
  if (!searchQuery.value) {
    return availableRooms.value.filter((r) => r.roomId !== props.roomId)
  }

  const query = searchQuery.value.toLowerCase()
  return availableRooms.value.filter((r) => r.roomId !== props.roomId && r.name.toLowerCase().includes(query))
})

// Methods
const handleClose = () => {
  if (sending.value) return
  emit('update:show', false)
  selectedRoomId.value = ''
  searchQuery.value = ''
}

const loadRooms = async () => {
  loading.value = true
  try {
    // Get rooms from chat store
    const sessions = chatStore.sessionList

    availableRooms.value = sessions.map((session) => ({
      roomId: session.roomId,
      name: session.name || session.roomId,
      avatar: session.avatar || '',
      memberCount: 0 // Can be fetched from room state if needed
    }))

    logger.info('[MobileForward] Rooms loaded:', { count: availableRooms.value.length })
  } catch (error) {
    logger.error('[MobileForward] Failed to load rooms:', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  // Filter is handled by computed property
}

const selectRoom = (roomId: string) => {
  selectedRoomId.value = roomId
}

const forwardMessage = async () => {
  if (!selectedRoomId.value) {
    msg.warning(t('message.selectRoomFirst'))
    return
  }

  sending.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    logger.info('[MobileForward] Forwarding message:', {
      fromRoom: props.roomId,
      toRoom: selectedRoomId.value,
      eventId: props.eventId
    })

    // Get the original event content
    const originalEvent = await getOriginalEvent()
    if (!originalEvent) {
      throw new Error('Original event not found')
    }

    // Forward the message by sending it to the new room
    await sendMessage(client, selectedRoomId.value, originalEvent, 'm.room.message')

    msg.success(t('message.forwarded'))
    emit('forwarded', { toRoomId: selectedRoomId.value, eventId: props.eventId })
    handleClose()
  } catch (error) {
    logger.error('[MobileForward] Failed to forward message:', error)
    msg.error(t('message.forwardFailed') + ': ' + (error instanceof Error ? error.message : String(error)))
  } finally {
    sending.value = false
  }
}

const getOriginalEvent = async (): Promise<Record<string, unknown> | null> => {
  try {
    const client = matrixClientService.getClient()
    if (!client) return null

    const clientLike = client as {
      getRoom?: (
        roomId: string
      ) => { findEventById?: (eventId: string) => { getContent?: () => Record<string, unknown> } } | null
    }

    const room = clientLike.getRoom?.(props.roomId)
    if (!room) return null

    const event = room.findEventById?.(props.eventId)
    if (!event) return null

    const getContentMethod = event.getContent as (() => Record<string, unknown>) | undefined
    return getContentMethod ? getContentMethod() : null
  } catch (error) {
    logger.error('[MobileForward] Failed to get original event:', error)
    return null
  }
}

// Watch for dialog open to load rooms
watch(
  () => props.show,
  (show) => {
    if (show) {
      loadRooms()
    }
  }
)
</script>

<style scoped lang="scss">
.mobile-message-forward {
  .original-message {
    margin-bottom: 16px;
    padding: 12px;
    background: var(--bg-color);
    border-radius: 8px;

    .preview-label {
      font-size: 12px;
      color: var(--text-color-3);
      margin-bottom: 6px;
    }

    .preview-content {
      font-size: 13px;
      color: var(--text-color-2);
      padding: 8px;
      background: var(--card-color);
      border-radius: 4px;
      border-left: 2px solid var(--primary-color);
    }
  }

  .room-selection {
    .section-label {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-color-1);
      margin-bottom: 12px;
    }

    .search-section {
      margin-bottom: 12px;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
      gap: 12px;

      p {
        color: var(--text-color-3);
        margin: 0;
      }
    }

    .room-list {
      max-height: 300px;
      overflow-y: auto;

      .room-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--bg-color);
        border-radius: 8px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;

        &:active {
          background: var(--item-hover-bg);
        }

        &.selected {
          background: rgba(var(--hula-success-rgb), 0.1);
          border: 1px solid rgba(var(--hula-success-rgb), 0.3);
        }

        .room-info {
          flex: 1;
          min-width: 0;

          .room-name {
            font-size: 14px;
            font-weight: 500;
            color: var(--text-color-1);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .room-members {
            font-size: 12px;
            color: var(--text-color-3);
          }
        }
      }
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;

      p {
        color: var(--text-color-3);
        margin: 12px 0 0 0;
      }
    }
  }
}
</style>
