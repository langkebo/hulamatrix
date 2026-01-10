<template>
  <div class="spaces-page p-16px box-border flex">
    <TreeSidebar />
    <div class="flex-1 pl-16px">
      <n-page-header title="空间管理">
        <template #extra>
          <n-space>
            <n-button type="primary" @click="openCreate">创建空间</n-button>
            <n-button tertiary @click="refresh">刷新</n-button>
          </n-space>
        </template>
      </n-page-header>

      <n-card size="small" class="mt-12px" hoverable>
        <n-form label-placement="left" label-width="80">
          <n-grid cols="1 s:2 m:4" x-gap="12" y-gap="8">
            <n-form-item label="关键字">
              <n-input v-model:value="search.query" placeholder="房间名称/ID" clearable />
            </n-form-item>
            <n-form-item label="模式">
              <n-select v-model:value="search.mode" :options="searchModeOptions" />
            </n-form-item>
            <n-form-item label="排序">
              <n-select v-model:value="search.sortBy" :options="sortOptions" />
            </n-form-item>
            <n-form-item label="筛选">
              <n-select v-model:value="search.filter" multiple :options="filterOptions" />
            </n-form-item>
          </n-grid>
          <n-space>
            <n-button type="primary" :loading="searching" @click="doSearch">搜索房间</n-button>
            <n-button tertiary @click="resetSearch">重置</n-button>
          </n-space>
        </n-form>
      </n-card>

      <n-alert v-if="error" type="warning" :show-icon="true" class="mt-12px">{{ error }}</n-alert>

      <SpaceList
        class="mt-16px"
        :spaces="userSpaces"
        :loading="isLoading"
        @view="(s) => view(s.id)"
        @create-room="(s) => openCreateRoom(s.id)"
        @invite="(s) => invite(s.id)"
        @leave="(s) => handleLeaveSpace(s.id)" />

      <n-card size="small" class="mt-16px" hoverable>
        <template #header>房间搜索结果</template>
        <n-data-table :columns="columns" :data="pagedResults" :pagination="pagination" />
      </n-card>

      <n-modal v-model:show="showCreate" preset="card" title="创建空间" class="w-480px">
        <n-form :model="createForm" :rules="rules" label-placement="left" label-width="80">
          <n-form-item label="名称" path="name"><n-input v-model:value="createForm.name" /></n-form-item>
          <n-form-item label="主题" path="topic"><n-input v-model:value="createForm.topic" /></n-form-item>
          <n-form-item label="公开"><n-switch v-model:value="createForm.isPublic" /></n-form-item>
        </n-form>
        <template #footer>
          <n-space justify="end">
            <n-button @click="showCreate = false">取消</n-button>
            <n-button type="primary" :loading="isLoading" @click="doCreate">创建</n-button>
          </n-space>
        </template>
      </n-modal>

      <n-modal v-model:show="showCreateRoom" preset="card" title="创建房间" class="w-520px">
        <n-form :model="createRoomForm" :rules="roomRules" label-placement="left" label-width="100">
          <n-form-item label="房间名称" path="name"><n-input v-model:value="createRoomForm.name" /></n-form-item>
          <n-form-item label="类型">
            <n-select v-model:value="createRoomForm.type" :options="roomTypeOptions" />
          </n-form-item>
          <n-form-item label="最大人数">
            <n-input-number v-model:value="createRoomForm.maxMembers" :min="1" :max="10000" />
          </n-form-item>
          <n-form-item label="密码保护">
            <n-input v-model:value="createRoomForm.password" type="password" placeholder="留空则不启用" />
          </n-form-item>
        </n-form>
        <template #footer>
          <n-space justify="end">
            <n-button @click="showCreateRoom = false">取消</n-button>
            <n-button type="primary" :loading="isLoading" @click="doCreateRoom">创建</n-button>
          </n-space>
        </template>
      </n-modal>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, h } from 'vue'
import { useRouter } from 'vue-router'
import { useMatrixSpaces } from '@/hooks/useMatrixSpaces'
import { matrixClientService } from '@/integrations/matrix/client'
import TreeSidebar from '@/components/spaces/TreeSidebar.vue'
import SpaceList from '@/components/spaces/SpaceList.vue'

// Type definitions for search results and room data
interface SearchResultItem {
  id: string
  name: string
  created: number
  joined: boolean
  public: boolean
}

interface MatrixClientLike {
  joinRoom(roomId: string): Promise<unknown>
  [key: string]: unknown
}

interface RoomData {
  name: string
  type: string
  maxMembers?: number
  password?: string
}

const router = useRouter()
const { isLoading, error, userSpaces, initializeSpaces, refreshSpaces, createSpace, createRoomInSpace } =
  useMatrixSpaces()

const showCreate = ref(false)
const createForm = ref({ name: '', topic: '', isPublic: false })
const rules = {
  name: { required: true, message: '请输入名称' }
}

const openCreate = () => (showCreate.value = true)
const doCreate = async () => {
  if (!createForm.value.name) return
  const sp = await createSpace({ ...createForm.value })
  if (sp?.id) {
    showCreate.value = false
    router.push({ path: '/spaces', query: { spaceId: sp.id } })
  }
}

const refresh = async () => {
  await refreshSpaces()
}

const view = (spaceId: string) => {
  router.push({ path: '/spaces', query: { spaceId } })
}

// 已由弹窗创建房间替代

const invite = (spaceId: string) => {
  const uid = prompt('输入要邀请的用户ID（如 @user:cjystx.top）') || ''
  if (!uid) return
  // 邀请在具体页实现，这里仅导航到空间页
  router.push({ path: '/spaces', query: { spaceId, invite: uid } })
}

const handleLeaveSpace = async (spaceId: string) => {
  try {
    const { leaveSpace } = useMatrixSpaces()
    await leaveSpace(spaceId)
    await refreshSpaces()
  } catch (e: unknown) {
    window.alert('退出空间失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

onMounted(async () => {
  await initializeSpaces()
  await refreshSpaces()
})

// ===== 房间搜索 =====
const search = ref({ query: '', mode: 'fuzzy', sortBy: 'created', filter: [] as string[] })
const searchModeOptions = [
  { label: '精确', value: 'exact' },
  { label: '模糊', value: 'fuzzy' }
]
const sortOptions = [
  { label: '创建时间', value: 'created' },
  { label: '名称', value: 'name' }
]
const filterOptions = [
  { label: '公开房间', value: 'public' },
  { label: '已加入', value: 'joined' }
]
const searching = ref(false)
const results = ref<SearchResultItem[]>([])

const doSearch = async () => {
  searching.value = true
  try {
    const client = matrixClientService.getClient()
    type MatrixRoom = {
      roomId?: string
      name?: string
      getDefaultRoomName?: () => string
      getCreatedAt?: () => number
      getLastLiveTimestamp?: () => number
      getMyMembership?: () => string
      getJoinRule?: () => string
    }
    const rooms = (client as { getRooms?: () => MatrixRoom[] } | null)?.getRooms?.() || []
    const q = search.value.query.trim().toLowerCase()
    const mode = search.value.mode
    const filtered = rooms
      .map((r) => ({
        id: r.roomId,
        name: r.name || r.getDefaultRoomName?.() || r.roomId,
        created: r.getCreatedAt?.() || r.getLastLiveTimestamp?.() || Date.now(),
        joined: r.getMyMembership?.() === 'join',
        public: r.getJoinRule?.() === 'public'
      }))
      .filter((row) => {
        const match =
          !q ||
          (mode === 'exact'
            ? row.name?.toLowerCase() === q || row.id === q
            : String(row.name).toLowerCase().includes(q) || String(row.id).toLowerCase().includes(q))
        const f = search.value.filter
        const okPublic = !f.includes('public') || row.public
        const okJoined = !f.includes('joined') || row.joined
        return match && okPublic && okJoined
      })
    const sorted = filtered.sort((a, b) =>
      search.value.sortBy === 'created' ? b.created - a.created : String(a.name).localeCompare(String(b.name))
    )
    results.value = sorted as SearchResultItem[]
    pagination.page = 1
  } finally {
    searching.value = false
  }
}
const resetSearch = () => {
  search.value = { query: '', mode: 'fuzzy', sortBy: 'created', filter: [] }
  results.value = []
}

const columns = [
  { title: '房间名', key: 'name' },
  { title: '房间ID', key: 'id' },
  { title: '创建时间', key: 'created', render: (row: SearchResultItem) => new Date(row.created).toLocaleString() },
  {
    title: '操作',
    key: 'action',
    render: (row: SearchResultItem) => {
      return h('n-space', {}, [
        h(
          'n-button',
          {
            size: 'small',
            type: 'primary',
            onClick: () => joinRoom(row.id)
          },
          '加入'
        )
      ])
    }
  }
]
const pagination = reactive({ page: 1, pageSize: 10, pageCount: 1 })
const pagedResults = computed(() => {
  const start = (pagination.page - 1) * pagination.pageSize
  const end = start + pagination.pageSize
  pagination.pageCount = Math.ceil((results.value.length || 1) / pagination.pageSize)
  return results.value.slice(start, end)
})

const joinRoom = async (roomId: string) => {
  const client = matrixClientService.getClient() as MatrixClientLike | null
  try {
    if (!client) throw new Error('Matrix client not initialized')
    await client.joinRoom(roomId)
    router.push('/message')
  } catch (e: unknown) {
    window.alert('加入房间失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

// ===== 在空间内创建房间 =====
const showCreateRoom = ref(false)
const targetSpaceId = ref('')
const roomTypeOptions = [
  { label: '文本', value: 'text' },
  { label: '公告', value: 'announcement' }
]
const createRoomForm = ref({ name: '', type: 'text', maxMembers: null as number | null, password: '' })
const roomRules = { name: { required: true, message: '请输入房间名称' } }
const openCreateRoom = (spaceId: string) => {
  targetSpaceId.value = spaceId
  showCreateRoom.value = true
}
const doCreateRoom = async () => {
  if (!createRoomForm.value.name || !targetSpaceId.value) return
  const roomData: RoomData = {
    name: createRoomForm.value.name,
    type: createRoomForm.value.type
  }
  if (createRoomForm.value.maxMembers !== null) {
    roomData.maxMembers = createRoomForm.value.maxMembers
  }
  if (createRoomForm.value.password) {
    roomData.password = createRoomForm.value.password
  }
  await createRoomInSpace(targetSpaceId.value, roomData)
  showCreateRoom.value = false
}
</script>

<style scoped>
.spaces-page {
  padding-right: 24px;
}
</style>
