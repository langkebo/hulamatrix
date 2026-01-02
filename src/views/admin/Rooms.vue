<template>
  <div class="admin-rooms">
    <n-page-header :title="t('admin.rooms.title')" @back="handleBack">
      <template #extra>
        <n-input
          v-model:value="searchQuery"
          :placeholder="t('admin.rooms.search_placeholder')"
          clearable
          style="width: 240px">
          <template #prefix>
            <n-icon><Search /></n-icon>
          </template>
        </n-input>
      </template>
    </n-page-header>

    <n-card :bordered="false">
      <n-data-table
        :columns="columns"
        :data="filteredRooms"
        :loading="loading"
        :pagination="pagination"
        :row-key="(row: Room) => row.roomId"
        striped>
        <template #empty>
          <n-empty :description="t('admin.rooms.no_rooms')" />
        </template>
      </n-data-table>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NPageHeader,
  NIcon,
  NInput,
  NCard,
  NDataTable,
  NEmpty,
  NTag,
  NAvatar,
  NButton,
  useMessage,
  useDialog
} from 'naive-ui'
import { Search, Hash, Trash } from '@vicons/tabler'
import { adminClient } from '@/services/adminClient'
import { logger } from '@/utils/logger'

interface Room {
  roomId: string
  name?: string
  topic?: string
  canonicalAlias?: string
  memberCount: number
  stateEvents: number
}

const { t } = useI18n()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const searchQuery = ref('')
const rooms = ref<Room[]>([])

const pagination = ref({
  page: 1,
  pageSize: 20
})

const filteredRooms = computed(() => {
  if (!searchQuery.value) return rooms.value

  const query = searchQuery.value.toLowerCase()
  return rooms.value.filter(
    (room) =>
      room.roomId.toLowerCase().includes(query) ||
      room.name?.toLowerCase().includes(query) ||
      room.topic?.toLowerCase().includes(query) ||
      room.canonicalAlias?.toLowerCase().includes(query)
  )
})

const columns = [
  {
    title: t('admin.rooms.table.avatar'),
    key: 'avatar',
    width: 60,
    render: (row: Room) => {
      return h(
        NAvatar,
        {
          round: true,
          size: 32,
          name: row.name || row.canonicalAlias || row.roomId
        },
        {
          default: () => h(NIcon, null, { default: () => h(Hash) })
        }
      )
    }
  },
  {
    title: t('admin.rooms.table.room_id'),
    key: 'roomId',
    width: 200
  },
  {
    title: t('admin.rooms.table.name'),
    key: 'name',
    width: 150,
    render: (row: Room) => row.name || row.canonicalAlias || '-'
  },
  {
    title: t('admin.rooms.table.topic'),
    key: 'topic',
    width: 200,
    render: (row: Room) => row.topic || '-'
  },
  {
    title: t('admin.rooms.table.members'),
    key: 'memberCount',
    width: 80
  },
  {
    title: t('admin.rooms.table.actions'),
    key: 'actions',
    width: 80,
    render: (row: Room) => {
      return h(
        NButton,
        {
          size: 'small',
          type: 'error',
          quaternary: true,
          onClick: () => handleDeleteRoom(row)
        },
        {
          default: () => h(NIcon, null, { default: () => h(Trash) })
        }
      )
    }
  }
]

onMounted(async () => {
  await loadRooms()
})

async function loadRooms() {
  loading.value = true
  try {
    const result = await adminClient.listRooms({ from: 0, limit: 100 })
    // Map AdminRoom to Room interface
    rooms.value = (result.rooms || []).map((ar) => ({
      roomId: ar.room_id,
      name: ar.name,
      topic: ar.name,
      canonicalAlias: ar.canonical_alias,
      memberCount: ar.joined_members,
      stateEvents: ar.state_events || 0
    }))
  } catch (error) {
    logger.error('[AdminRooms] Failed to load rooms:', error)
    message.error(t('admin.error.load_rooms_failed'))
  } finally {
    loading.value = false
  }
}

function handleDeleteRoom(room: Room) {
  dialog.error({
    title: t('admin.rooms.confirm_delete'),
    content: t('admin.rooms.confirm_delete_content', {
      roomId: room.roomId,
      name: room.name || room.canonicalAlias || room.roomId
    }),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await adminClient.deleteRoom(room.roomId)
        message.success(t('admin.rooms.deleted'))
        await loadRooms()
      } catch (error) {
        logger.error('[AdminRooms] Failed to delete room:', error)
        message.error(t('admin.error.delete_room_failed'))
      }
    }
  })
}

function handleBack() {
  router.back()
}
</script>

<style lang="scss" scoped>
.admin-rooms {
  padding: 24px;
}
</style>
