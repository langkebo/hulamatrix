<template>
  <div class="rooms-manage-mobile p-12px">
    <n-space vertical :size="12">
      <n-select v-model:value="roomId" :options="roomOptions" placeholder="选择房间" />
      <div v-if="loading" class="mt-8px"><n-skeleton height="40px" :repeat="8" /></div>
      <div v-else-if="loadError" class="mt-8px">
        <n-alert type="error" :show-icon="true">{{ loadError }}</n-alert>
        <n-button class="mt-8px" type="primary" @click="retryLoad">重试</n-button>
      </div>
      <div v-else-if="rooms.length === 0" class="mt-8px">
        <n-result status="404" title="暂无房间" description="创建一个新房间开始交流">
          <template #footer><n-button type="primary" @click="focusCreate">创建房间</n-button></template>
        </n-result>
      </div>
      <n-input v-model:value="name" placeholder="房间名称" />
      <n-input v-model:value="topic" placeholder="房间主题" />
      <n-select v-model:value="joinRule" :options="joinRuleOpts" />
      <n-select v-model:value="historyVisibility" :options="historyOpts" />
      <n-switch v-model:value="encryption">加密</n-switch>
      <n-input v-model:value="alias" placeholder="#alias:domain" />
      <n-select v-model:value="directoryVisibility" :options="dirOpts" />
      <n-button type="primary" @click="applyAll">保存设置</n-button>
      <n-divider>成员管理</n-divider>
      <n-input v-model:value="inviteUserId" placeholder="@user:domain" />
      <n-button type="primary" @click="onInvite">邀请</n-button>
      <n-list>
        <n-list-item v-for="m in members" :key="m.userId">
          <div class="flex items-center justify-between">
            <span>{{ m.name || m.userId }}</span>
            <n-space>
              <n-button size="small" @click="onKick(m.userId)">移除</n-button>
              <n-button size="small" @click="onBan(m.userId)">封禁</n-button>
              <n-button size="small" @click="onUnban(m.userId)">解封</n-button>
            </n-space>
          </div>
        </n-list-item>
      </n-list>
      <n-divider>危险操作</n-divider>
      <n-space>
        <n-button type="warning" @click="onLeave">离开</n-button>
        <n-button type="error" @click="onForget">忘记</n-button>
      </n-space>
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { matrixClientService } from '@/integrations/matrix/client'
import {
  setRoomName,
  setRoomTopic,
  setJoinRule,
  setHistoryVisibility,
  setEncryption,
  createAlias,
  setDirectoryVisibility,
  getJoinedMembers,
  inviteUser,
  kickUser,
  banUser,
  unbanUser,
  leaveRoom,
  forgetRoom
} from '@/integrations/matrix/rooms'
import { useMatrixAuthStore } from '@/stores/matrixAuth'
import { flags } from '@/utils/envFlags'
import { validateAlias } from '@/integrations/matrix/alias'
import type { MatrixClient } from 'matrix-js-sdk'

import { msg } from '@/utils/SafeUI'

/** Basic room interface */
interface Room {
  roomId: string
  name?: string
  [key: string]: unknown
}

const client = matrixClientService.getClient()
// Safely get rooms from the client
const getRoomsMethod = typeof client?.getRooms === 'function' ? client.getRooms.bind(client) : undefined
const rawRooms = getRoomsMethod ? getRoomsMethod() : []
// Convert raw Room objects to our simplified interface
const rooms = ref<Room[]>(
  rawRooms.map((r: { roomId: string; name?: string; [key: string]: unknown }) => ({ ...r, name: r.name }))
)
const roomId = ref('')
const roomOptions = computed(() => rooms.value.map((r) => ({ label: r.name || r.roomId, value: r.roomId })))
const name = ref('')
const topic = ref('')
const joinRule = ref<'public' | 'invite'>('invite')
const joinRuleOpts = [
  { label: '公开', value: 'public' },
  { label: '邀请', value: 'invite' }
]
const historyVisibility = ref<'world_readable' | 'shared' | 'invited' | 'joined'>('shared')
const historyOpts = [
  { label: '全网可读', value: 'world_readable' },
  { label: '成员共享', value: 'shared' },
  { label: '受邀可读', value: 'invited' },
  { label: '已加入可读', value: 'joined' }
]
const encryption = ref(false)
const alias = ref('')
const directoryVisibility = ref<'public' | 'private'>('private')
const dirOpts = [
  { label: '公开', value: 'public' },
  { label: '私有', value: 'private' }
]
const members = ref<Array<{ userId: string; name?: string }>>([])
const inviteUserId = ref('')

const loading = ref(false)
const loadError = ref('')
const timeoutHandle = ref<number | null>(null)

const ensureMatrixReady = async (): Promise<MatrixClient | null> => {
  const c = matrixClientService.getClient()
  if (c) return c as unknown as MatrixClient
  const auth = useMatrixAuthStore()
  const baseUrl = auth.getHomeserverBaseUrl()
  const token = auth.accessToken
  const uid = auth.userId
  if (baseUrl && token && uid) {
    try {
      await matrixClientService.initialize({ baseUrl, accessToken: token, userId: uid })
      import('@/integrations/matrix/client').then((m) => m.initializeMatrixBridges())
      await matrixClientService.startClient({ initialSyncLimit: 5, pollTimeout: 15000 })
      const client = matrixClientService.getClient()
      return client ? (client as unknown as MatrixClient) : null
    } catch (e) {
      msg.error?.('连接 Matrix 失败')
      return null
    }
  }
  msg.error?.('未连接到 Matrix，请先登录')
  return null
}

const refreshRooms = async () => {
  const c = (await ensureMatrixReady()) || matrixClientService.getClient()
  loading.value = true
  try {
    loadError.value = ''
    // Safely get rooms from the client
    const getRoomsMethod = typeof c?.getRooms === 'function' ? c.getRooms.bind(c) : undefined
    const rawRooms = getRoomsMethod ? getRoomsMethod() : []
    // Convert raw Room objects to our simplified interface
    rooms.value = rawRooms.map((r: { roomId: string; name?: string; [key: string]: unknown }) => ({
      ...r,
      name: r.name
    }))
    if (timeoutHandle.value) {
      clearTimeout(timeoutHandle.value)
      timeoutHandle.value = null
    }
    timeoutHandle.value = window.setTimeout(() => {
      if (loading.value) {
        loading.value = false
        loadError.value = '加载房间超时'
      }
    }, 15000)
  } finally {
    loading.value = false
  }
}
const retryLoad = () => {
  loadError.value = ''
  void refreshRooms()
}
const focusCreate = () => {
  name.value = ''
}

watch(roomId, async (rid) => {
  if (!rid) return
  members.value = await getJoinedMembers(rid).then((list) => list.map((u) => ({ userId: u })))
  // Safely get room from the client
  const getRoomMethod = typeof client?.getRoom === 'function' ? client.getRoom.bind(client) : undefined
  const room = getRoomMethod ? getRoomMethod(rid) : null
  name.value = room?.name || ''
})

const applyAll = async () => {
  if (!roomId.value) return
  await setRoomName(roomId.value, name.value)
  await setRoomTopic(roomId.value, topic.value)
  await setJoinRule(roomId.value, joinRule.value)
  await setHistoryVisibility(roomId.value, historyVisibility.value)
  if (flags.matrixE2eeEnabled) {
    try {
      await setEncryption(roomId.value, encryption.value)
    } catch {
      encryption.value = false
      msg.error('加密设置失败，已回退')
    }
  } else if (encryption.value) {
    msg.error('加密功能未启用')
    encryption.value = false
  }
  if (alias.value) {
    const v = validateAlias(alias.value)
    if (!v.valid) {
      msg.error(v.reason || '别名格式错误')
      return
    }
    try {
      await createAlias(roomId.value, alias.value)
    } catch {
      msg.error('添加别名失败，可能与现有别名冲突')
    }
  }
  try {
    await setDirectoryVisibility(roomId.value, directoryVisibility.value)
  } catch {
    msg.error('更新目录可见性失败，请稍后重试')
  }
  msg.success('已保存')
}

const onInvite = async () => {
  if (!roomId.value || !inviteUserId.value) return
  await inviteUser(roomId.value, inviteUserId.value)
  msg.success('已邀请')
  members.value = await getJoinedMembers(roomId.value).then((list) => list.map((u) => ({ userId: u })))
}
const onKick = async (uid: string) => {
  if (!roomId.value || !uid) return
  await kickUser(roomId.value, uid)
  msg.success('已移除')
  members.value = await getJoinedMembers(roomId.value).then((list) => list.map((u) => ({ userId: u })))
}
const onBan = async (uid: string) => {
  if (!roomId.value || !uid) return
  await banUser(roomId.value, uid)
  msg.success('已封禁')
}
const onUnban = async (uid: string) => {
  if (!roomId.value || !uid) return
  await unbanUser(roomId.value, uid)
  msg.success('已解封')
}
const onLeave = async () => {
  if (!roomId.value) return
  await leaveRoom(roomId.value)
  msg.success('已离开房间')
}
const onForget = async () => {
  if (!roomId.value) return
  await forgetRoom(roomId.value)
  msg.success('已忘记房间')
}

onMounted(() => {
  void refreshRooms()
})
</script>

<style scoped>
.rooms-manage-mobile {
  max-width: 720px;
  margin: 0 auto;
}
@media (max-width: 480px) {
  .rooms-manage-mobile {
    padding: 8px;
  }
}
</style>
