<template>
  <div class="p-12px">
    <n-space vertical>
      <n-input v-model:value="filter" placeholder="搜索房间" clearable />
      <n-list>
        <n-list-item v-for="room in filteredRooms" :key="room.roomId" @click="enterRoom(room)" class="cursor-pointer">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-8px">
              <n-avatar size="small">{{ room.name?.[0] || '#' }}</n-avatar>
              <div class="flex flex-col">
                <span class="text-14px">{{ room.name || room.roomId }}</span>
                <span class="text-12px text-#888">成员 {{ room.getJoinedMemberCount?.() ?? 0 }}</span>
              </div>
            </div>
            <div class="flex items-center gap-8px">
              <n-button size="small" @click.stop="manageRoom(room)" tertiary>管理</n-button>
              <n-button size="small" type="primary">进入</n-button>
            </div>
          </div>
        </n-list-item>
      </n-list>
      <div v-if="!client" class="text-12px text-#888">未连接到服务器</div>
      <div v-if="client && rooms.length === 0" class="text-12px text-#888">暂无房间</div>
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { matrixClientService } from '@/integrations/matrix/client'
import { useGlobalStore } from '@/stores/global'
import { useRouter } from 'vue-router'

/** Basic room interface for mobile rooms list */
interface Room {
  roomId: string
  name?: string
  getJoinedMemberCount?(): number
  [key: string]: unknown
}

const router = useRouter()
const global = useGlobalStore()

const client = matrixClientService.getClient()
const rooms = ref<Room[]>([])
const filter = ref('')

const refreshRooms = () => {
  const c = matrixClientService.getClient()
  if (!c) return
  const getRoomsMethod = c.getRooms as (() => Room[]) | undefined
  rooms.value = getRoomsMethod?.() || []
}

const filteredRooms = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return rooms.value
  return rooms.value.filter((r) => (r.name || r.roomId || '').toLowerCase().includes(q))
})

const enterRoom = (room: Room) => {
  if (!room?.roomId) return
  global.updateCurrentSessionRoomId(room.roomId)
  router.push('/mobile/chatRoom')
}

const manageRoom = (room: Room) => {
  if (!room?.roomId) return
  router.push('/mobile/rooms/manage')
}

onMounted(() => {
  refreshRooms()
  const c = matrixClientService.getClient()
  if (!c) return
  const onMethod = c.on as ((event: string, handler: (...args: unknown[]) => void) => void) | undefined
  onMethod?.('Room', () => refreshRooms())
  onMethod?.('deleteRoom', () => refreshRooms())
})
</script>

<style scoped></style>
