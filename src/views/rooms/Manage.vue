<template>
  <div class="rooms-manage-container p-16px pr-32px box-border">
    <n-space vertical :size="16">
      <n-alert type="info" :show-icon="true">房间管理</n-alert>
      <n-space wrap>
        <n-select v-model:value="roomId" :options="roomOptions" placeholder="选择房间" class="room-select" />
        <n-button tertiary type="primary" @click="refreshRooms">刷新</n-button>
        <n-input v-model:value="newRoomName" placeholder="新房间名称" class="room-name-input" />
        <n-input v-model:value="newRoomTopic" placeholder="新房间主题" class="room-topic-input" />
        <n-switch v-model:value="newRoomPublic">公开</n-switch>
        <n-button type="primary" @click="onCreateRoom">创建房间</n-button>
      </n-space>

      <div v-if="loading" class="mt-8px">
        <n-skeleton height="44px" class="skeleton-item" :repeat="10" />
      </div>
      <div v-else-if="loadError" class="mt-8px">
        <n-alert type="error" :show-icon="true">{{ loadError }}</n-alert>
        <n-space class="mt-8px">
          <n-button type="primary" @click="retryLoad">重试</n-button>
        </n-space>
      </div>
      <div v-else-if="rooms.length === 0" class="mt-8px">
        <n-result status="404" title="暂无房间" description="创建一个新房间开始交流">
          <template #footer>
            <n-button type="primary" @click="focusCreate">创建房间</n-button>
          </template>
        </n-result>
      </div>
      <n-card title="房间搜索">
        <n-form label-placement="left" label-width="80">
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
          <n-space>
            <n-button type="primary" :loading="searching" @click="doSearch">搜索房间</n-button>
            <n-button tertiary @click="resetSearch">重置</n-button>
          </n-space>
        </n-form>

        <n-list class="mt-12px">
          <n-list-item v-for="row in pagedResults" :key="row.id">
            <div class="flex items-center justify-between">
              <div class="flex-1 truncate">
                <div class="text-14px truncate">{{ row.name }}</div>
                <div class="text-12px text-var(--hula-brand-primary) truncate">{{ row.id }}</div>
              </div>
              <n-button size="small" type="primary" @click="joinRoom(row.id)">加入</n-button>
            </div>
          </n-list-item>
        </n-list>
        <n-pagination
          v-model:page="pagination.page"
          :page-count="pagination.pageCount"
          :page-size="pagination.pageSize" />
      </n-card>
      <n-tabs type="line" animated>
        <n-tab-pane name="info" tab="房间信息">
          <n-form label-placement="left" label-width="100px">
            <n-form-item label="房间名称">
              <n-input v-model:value="name" />
              <n-button class="ml-8px" @click="applyName">保存</n-button>
            </n-form-item>
            <n-form-item label="房间主题">
              <n-input v-model:value="topic" />
              <n-button class="ml-8px" @click="applyTopic">保存</n-button>
            </n-form-item>
            <n-form-item label="房间头像">
              <input type="file" @change="onPickAvatar" accept="image/*" />
            </n-form-item>
            <n-form-item label="加入规则">
              <n-select v-model:value="joinRule" :options="joinRuleOpts" />
              <n-button class="ml-8px" @click="applyJoinRule">保存</n-button>
            </n-form-item>
            <n-form-item label="历史可见范围">
              <n-select v-model:value="historyVisibility" :options="historyOpts" />
              <n-button class="ml-8px" @click="applyHistoryVisibility">保存</n-button>
            </n-form-item>
            <n-form-item label="启用加密">
              <n-switch v-model:value="encryption" />
              <n-button class="ml-8px" @click="applyEncryption">保存</n-button>
            </n-form-item>
            <n-form-item label="房间别名">
              <n-input v-model:value="alias" placeholder="#alias:domain" />
              <n-button class="ml-8px" @click="applyCreateAlias">添加</n-button>
              <n-button class="ml-8px" tertiary @click="applyDeleteAlias">删除</n-button>
            </n-form-item>
            <n-form-item label="目录可见性">
              <n-select v-model:value="directoryVisibility" :options="dirOpts" />
              <n-button class="ml-8px" @click="applyDirectoryVisibility">保存</n-button>
            </n-form-item>
            <n-form-item label="预设状态">
              <n-space align="center" :size="8">
                <n-tag type="success" size="small">{{ presetTag }}</n-tag>
                <n-tag type="info" size="small">目录：{{ directoryVisibility }}</n-tag>
              </n-space>
            </n-form-item>
            <n-form-item label="持久化提示">
              <n-alert type="info" :show-icon="true">
                预设与可见性将持久化到房间状态与目录配置；当前房间：{{ roomId || '未选择' }}
              </n-alert>
            </n-form-item>
            <n-form-item label="权限编辑">
              <n-button @click="openPowerEditor">打开权限编辑器</n-button>
            </n-form-item>
          </n-form>
        </n-tab-pane>
        <n-tab-pane name="members" tab="成员管理">
          <n-space>
            <n-input v-model:value="inviteUserId" placeholder="@user:domain" class="invite-input" />
            <n-button type="primary" @click="onInvite">邀请</n-button>
          </n-space>
          <n-data-table :columns="memberCols" :data="members" class="mt-12px" />
        </n-tab-pane>
        <n-tab-pane name="directory" tab="房间目录">
          <RoomDirectory @join-room="handleDirectoryJoin" @preview-room="handleDirectoryPreview" />
        </n-tab-pane>
        <n-tab-pane name="danger" tab="危险操作">
          <n-space>
            <n-button type="warning" @click="onLeave">离开房间</n-button>
            <n-button type="error" @click="onForget">忘记房间</n-button>
          </n-space>
        </n-tab-pane>
      </n-tabs>
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue'
import { matrixClientService } from '@/integrations/matrix/client'
import {
  setRoomName,
  setRoomTopic,
  setJoinRule,
  setHistoryVisibility,
  setEncryption,
  setRoomAvatar,
  createAlias,
  deleteAlias,
  setDirectoryVisibility,
  getJoinedMembers,
  getAliases,
  getDirectoryVisibility,
  inviteUser,
  kickUser,
  banUser,
  unbanUser,
  leaveRoom,
  forgetRoom,
  createRoomDetailed
} from '@/integrations/matrix/rooms'
import { useRouter } from 'vue-router'
import { useMatrixAuthStore } from '@/stores/matrixAuth'
import { msg } from '@/utils/SafeUI'
import { useDialog } from 'naive-ui'
import { validateAlias } from '@/integrations/matrix/alias'
import { logger, toError } from '@/utils/logger'
import { mapRooms, searchRooms, type SearchCriteria, type RoomRow } from '@/views/rooms/search-logic'
import type { RoomVisibility } from '@/types/matrix'
import RoomDirectory from '@/components/rooms/RoomDirectory.vue'
import { checkAppReady, withAppCheck } from '@/utils/appErrorHandler'
import { appInitMonitor, AppInitPhase } from '@/utils/performanceMonitor'

// Type guard for directory visibility
const isValidDirectoryVisibility = (value: unknown): value is RoomVisibility => {
  return value === 'public' || value === 'private'
}

const client = matrixClientService.getClient()
const roomId = ref<string>('')
const getRoomsMethod = client?.getRooms as (() => Record<string, unknown>[]) | undefined
const rooms = ref<Record<string, unknown>[]>(getRoomsMethod?.() || [])
const page = ref(1)
const pageSize = ref(20)
//
const pagedRooms = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return rooms.value.slice(start, start + pageSize.value)
})
const roomOptions = computed(() =>
  pagedRooms.value.map((r) => ({ label: (r.name || r.roomId) as string, value: r.roomId as string }))
)
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
const e2eeEnabledFlag = computed(() => true) // 简化处理，假设E2EE总是启用
const alias = ref('')
const directoryVisibility = ref<'public' | 'private'>('private')
const dirOpts = [
  { label: '公开', value: 'public' },
  { label: '私有', value: 'private' }
]
const inviteUserId = ref('')
const members = ref<Array<{ userId: string; name?: string }>>([])
//
const router = useRouter()
const dialog = useDialog()
const presetTag = computed(() => (joinRule.value === 'public' ? 'public_chat' : 'private_chat'))
const persistKey = computed(() => (roomId.value ? `matrix-room-config:${roomId.value}` : ''))
const saveRoomConfig = () => {
  if (!persistKey.value) return
  try {
    const val = { preset: presetTag.value, visibility: directoryVisibility.value }
    localStorage.setItem(persistKey.value, JSON.stringify(val))
  } catch {}
}
const loadRoomConfig = () => {
  if (!persistKey.value) return
  try {
    const raw = localStorage.getItem(persistKey.value)
    if (raw) {
      const js = JSON.parse(raw)
      if (js && typeof js === 'object') {
        joinRule.value = js.preset === 'public_chat' ? 'public' : 'invite'
        // Validate directory visibility before assigning
        const visibility = js.visibility || directoryVisibility.value
        directoryVisibility.value = isValidDirectoryVisibility(visibility) ? visibility : directoryVisibility.value
      }
    }
  } catch {}
}

const loading = ref(false)
const loadError = ref('')
const timeoutHandle = ref<number | null>(null)
const refreshRooms = async () => {
  // 使用统一的应用状态检查
  if (!checkAppReady()) {
    return
  }

  // 使用 withAppCheck 包装整个操作
  await withAppCheck(
    async () => {
      // 添加性能监控
      appInitMonitor.markPhase(AppInitPhase.LOAD_STORES)

      const c = (await ensureMatrixReady()) || matrixClientService.getClient()
      loading.value = true
      try {
        loadError.value = ''
        const getRoomsMethod = c?.getRooms as (() => Record<string, unknown>[]) | undefined
        rooms.value = getRoomsMethod?.() || []
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
    },
    {
      customMessage: '加载房间列表失败'
    }
  )
}
const ensureMatrixReady = async (): Promise<Record<string, unknown> | null> => {
  const c = matrixClientService.getClient()
  if (c) return c
  const auth = useMatrixAuthStore()
  const baseUrl = auth.getHomeserverBaseUrl()
  const token = auth.accessToken
  const uid = auth.userId
  if (baseUrl && token && uid) {
    try {
      await matrixClientService.initialize({ baseUrl, accessToken: token, userId: uid })
      import('@/integrations/matrix/client').then((m) => m.initializeMatrixBridges())
      await matrixClientService.startClient({ initialSyncLimit: 5, pollTimeout: 15000 })
      return matrixClientService.getClient()
    } catch (e) {
      logger.error('连接 Matrix 失败:', toError(e))
      msg.error('连接 Matrix 失败')
      return null
    }
  }
  msg.error('未连接到 Matrix，请先登录')
  return null
}

const search = ref<SearchCriteria>({ query: '', mode: 'fuzzy', sortBy: 'created', filter: [] })
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
  { label: '已加入', value: 'joined' },
  { label: '未读', value: 'unread' },
  { label: '邀请房', value: 'rule:invite' },
  { label: '敲门房', value: 'rule:knock' }
]
const searching = ref(false)
const results = ref<RoomRow[]>([])
const pagination = ref({ page: 1, pageSize: 10, pageCount: 1 })
const pagedResults = computed(() => {
  const start = (pagination.value.page - 1) * pagination.value.pageSize
  const end = start + pagination.value.pageSize
  pagination.value.pageCount = Math.ceil((results.value.length || 1) / pagination.value.pageSize)
  return results.value.slice(start, end)
})
const doSearch = async () => {
  // 使用 withAppCheck 包装整个操作
  await withAppCheck(
    async () => {
      searching.value = true
      try {
        const c = matrixClientService.getClient()
        const rows = mapRooms(c)
        results.value = searchRooms(rows, search.value)
        pagination.value.page = 1
      } finally {
        searching.value = false
      }
    },
    {
      customMessage: '搜索房间失败'
    }
  )
}
const resetSearch = () => {
  search.value = { query: '', mode: 'fuzzy', sortBy: 'created', filter: [] }
  results.value = []
}
const joinRoom = async (id: string) => {
  const c = matrixClientService.getClient()
  try {
    const joinRoomMethod = c?.joinRoom as ((roomId: string) => Promise<Record<string, unknown>>) | undefined
    await joinRoomMethod?.(id)
    router.push('/message')
  } catch (e) {
    const err = e as { message?: string; errcode?: string }
    window.alert('加入房间失败：' + (err?.message || String(e)))
  }
}
const retryLoad = () => {
  loadError.value = ''
  refreshRooms()
}
const focusCreate = () => {
  newRoomName.value = ''
}

watch(roomId, async (rid) => {
  if (!rid) return
  members.value = await getJoinedMembers(rid).then((list) =>
    list.map((u: string | { userId: string }) => (typeof u === 'string' ? { userId: u } : u))
  )
  const getRoomMethod = client?.getRoom as
    | ((roomId: string) => {
        name?: string
        currentState?: { getStateEvents?: (type: string) => unknown[] }
      } | null)
    | undefined
  const room = getRoomMethod?.(rid)
  name.value = room?.name || ''
  const stateEvents = room?.currentState?.getStateEvents?.('m.room.topic')
  const topicEvent = stateEvents?.[0] as Record<string, unknown> | undefined
  const getContentMethod = topicEvent?.getContent as (() => { topic?: string }) | undefined
  topic.value = (getContentMethod?.()?.topic as string) || ''
  const aliases = await getAliases(rid)
  alias.value = aliases?.[0] || ''
  const v = await getDirectoryVisibility(rid)
  // Validate and set directory visibility
  directoryVisibility.value = isValidDirectoryVisibility(v) ? v : 'private'
  // 尝试加载本地持久化标识
  loadRoomConfig()
})

const isForbidden = (e: unknown) =>
  String(
    ((e as Record<string, unknown>) && (e as Record<string, unknown>).errcode) ||
      (e as { message?: string })?.message ||
      ''
  ).includes('M_FORBIDDEN')
const applyName = async () => {
  if (!roomId.value) return
  try {
    await setRoomName(roomId.value, name.value)
    msg.success('已更新房间名')
  } catch (e) {
    logger.warn('更新房间名失败:', toError(e))
    msg.error(isForbidden(e) ? '权限不足，无法更新房间名' : '更新房间名失败')
  }
}
const applyTopic = async () => {
  if (!roomId.value) return
  try {
    await setRoomTopic(roomId.value, topic.value)
    msg.success('已更新主题')
  } catch (e) {
    logger.warn('更新主题失败:', toError(e))
    msg.error(isForbidden(e) ? '权限不足，无法更新主题' : '更新主题失败')
  }
}
const applyJoinRule = async () => {
  if (!roomId.value) return
  try {
    await setJoinRule(roomId.value, joinRule.value)
    msg.success('已更新加入规则')
    saveRoomConfig()
  } catch (e) {
    logger.warn('更新加入规则失败:', toError(e))
    msg.error(isForbidden(e) ? '权限不足，无法更新加入规则' : '更新加入规则失败')
  }
}
const applyHistoryVisibility = async () => {
  if (!roomId.value) return
  try {
    await setHistoryVisibility(roomId.value, historyVisibility.value)
    msg.success('已更新历史可见范围')
  } catch (e) {
    logger.warn('更新历史可见范围失败:', toError(e))
    msg.error(isForbidden(e) ? '权限不足，无法更新历史可见范围' : '更新历史可见范围失败')
  }
}
const applyEncryption = async () => {
  if (!roomId.value) return
  if (!e2eeEnabledFlag.value) {
    msg.error('加密功能未启用')
    return
  }
  try {
    await setEncryption(roomId.value, encryption.value)
    msg.success('已更新加密设置')
  } catch (e) {
    msg.error('加密设置失败，已回退')
    encryption.value = false
  }
}
const onPickAvatar = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const f = target.files?.[0]
  if (!f || !roomId.value) return
  try {
    await setRoomAvatar(roomId.value, f)
    msg.success('已更新头像')
  } catch (err) {
    msg.error('头像上传失败，请更换图片重试')
  }
}
const applyCreateAlias = async () => {
  if (!roomId.value) return
  const v = validateAlias(alias.value)
  if (!v.valid) {
    msg.error(v.reason || '别名格式错误')
    return
  }
  try {
    await createAlias(roomId.value, alias.value)
    msg.success('已添加别名')
  } catch (e) {
    msg.error('添加别名失败，可能与现有别名冲突')
  }
}
const applyDeleteAlias = async () => {
  if (!alias.value) return
  await deleteAlias(alias.value)
  msg.success('已删除别名')
}
const applyDirectoryVisibility = async () => {
  if (!roomId.value) return
  try {
    await setDirectoryVisibility(roomId.value, directoryVisibility.value)
    msg.success('已更新目录可见性')
    saveRoomConfig()
  } catch (e) {
    msg.error('更新目录可见性失败，请稍后重试')
  }
}
const openPowerEditor = () => {
  router.push('/admin')
}

const onInvite = async () => {
  // 使用 withAppCheck 包装整个操作
  await withAppCheck(
    async () => {
      if (!roomId.value || !inviteUserId.value) return
      await inviteUser(roomId.value, inviteUserId.value)
      msg.success('已邀请')
      members.value = await getJoinedMembers(roomId.value).then((list) =>
        list.map((u: string | { userId: string }) => (typeof u === 'string' ? { userId: u } : u))
      )
    },
    {
      customMessage: '邀请成员失败'
    }
  )
}
const onKick = async (uid: string) => {
  if (!roomId.value || !uid) return
  await kickUser(roomId.value, uid)
  msg.success('已移除')
  members.value = await getJoinedMembers(roomId.value).then((list) =>
    list.map((u: string | { userId: string }) => (typeof u === 'string' ? { userId: u } : u))
  )
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

const newRoomName = ref('')
const newRoomTopic = ref('')
const newRoomPublic = ref(false)
const onCreateRoom = async () => {
  // 使用 withAppCheck 包装整个操作
  await withAppCheck(
    async () => {
      const c = await ensureMatrixReady()
      if (!c) return
      const res = await createRoomDetailed({
        name: newRoomName.value,
        topic: newRoomTopic.value,
        isPublic: newRoomPublic.value
      })
      msg.success(`房间创建成功（${res.preset}/${res.visibility}）`)
      refreshRooms()
      roomId.value = String(res.roomId)
      joinRule.value = res.preset === 'public_chat' ? 'public' : 'invite'
      // Validate and set directory visibility
      directoryVisibility.value = isValidDirectoryVisibility(res.visibility) ? res.visibility : 'private'
    },
    {
      customMessage: '创建房间失败'
    }
  )
}

const memberCols = [
  {
    title: '成员',
    key: 'userId',
    render(row: { userId: string; name?: string }) {
      return row.name || row.userId
    }
  },
  {
    title: '操作',
    key: 'ops',
    render(row: { userId: string }) {
      return h('div', { class: 'flex gap-8px' }, [
        h('button', { class: 'n-button n-button--error', onClick: () => onKick(row.userId) }, '移除'),
        h('button', { class: 'n-button n-button--warning', onClick: () => onBan(row.userId) }, '封禁'),
        h('button', { class: 'n-button', onClick: () => onUnban(row.userId) }, '解封')
      ])
    }
  }
]

// Room Directory handlers
const handleDirectoryJoin = async (roomIdValue: string) => {
  try {
    const c = matrixClientService.getClient()
    const joinRoomMethod = c?.joinRoom as ((roomId: string) => Promise<Record<string, unknown>>) | undefined
    await joinRoomMethod?.(roomIdValue)
    msg.success('已加入房间')
    refreshRooms()
    // Switch to the joined room
    router.push('/message')
  } catch (e) {
    const err = e as { message?: string }
    logger.error('加入房间失败:', toError(e))
    msg.error('加入房间失败：' + (err?.message || String(e)))
  }
}

const handleDirectoryPreview = async (roomIdValue: string) => {
  try {
    // 使用 Matrix SDK 的房间预览功能（无需加入即可查看公共信息）
    const { matrixClientService } = await import('@/integrations/matrix/client')
    const client = matrixClientService.getClient()

    if (!client) {
      msg.error('Matrix 客户端未初始化')
      return
    }

    // 类型安全的 getStateEvent 调用
    const getStateEvent = async (eventType: string, stateKey: string = ''): Promise<Record<string, unknown> | null> => {
      try {
        const result = await (
          client as {
            getStateEvent: (roomId: string, type: string, key: string) => Promise<unknown>
          }
        ).getStateEvent(roomIdValue, eventType, stateKey)
        return result as Record<string, unknown> | null
      } catch {
        return null
      }
    }

    // 尝试获取房间的公共状态
    const roomState = await getStateEvent('m.room.name', '')
    const roomTopic = await getStateEvent('m.room.topic', '')
    const roomAvatar = await getStateEvent('m.room.avatar', '')
    const roomJoinRules = await getStateEvent('m.room.join_rules', '')

    // 构建预览信息
    const previewInfo = {
      roomId: roomIdValue,
      name: (roomState as { name?: string })?.name || roomIdValue,
      topic: (roomTopic as { topic?: string })?.topic || '暂无主题',
      avatar: (roomAvatar as { url?: string })?.url || '',
      joinRule: (roomJoinRules as { join_rule?: string })?.join_rule || 'unknown',
      isPublic: (roomJoinRules as { join_rule?: string })?.join_rule === 'public'
    }

    // 显示预览对话框
    dialog.info({
      title: '房间预览',
      content: () => {
        return h('div', { class: 'room-preview' }, [
          h('p', { class: 'preview-item' }, [h('strong', '房间名称：'), previewInfo.name]),
          h('p', { class: 'preview-item' }, [h('strong', '房间主题：'), previewInfo.topic]),
          h('p', { class: 'preview-item' }, [h('strong', '房间ID：'), roomIdValue]),
          h('p', { class: 'preview-item' }, [h('strong', '访问类型：'), previewInfo.isPublic ? '公开房间' : '私有房间'])
        ])
      },
      positiveText: '关闭',
      onPositiveClick: () => {
        logger.info('[RoomDirectory] Room preview closed', { roomId: roomIdValue })
      }
    })

    logger.info('[RoomDirectory] Room preview shown', { roomId: roomIdValue, previewInfo })
  } catch (error) {
    logger.error('[RoomDirectory] Failed to preview room:', error)
    msg.error('无法预览房间，可能房间不存在或没有权限')
  }
}

onMounted(() => {
  // 使用统一的应用状态检查
  if (checkAppReady()) {
    refreshRooms()
  }
})
</script>

<style scoped>
.room-select {
  min-width: clamp(220px, 40vw, 360px);
}

.room-name-input,
.room-topic-input {
  min-width: clamp(180px, 30vw, 320px);
}

.skeleton-item {
  border-radius: 8px;
}

.invite-input {
  min-width: clamp(200px, 35vw, 360px);
}

.rooms-manage-container {
  max-width: 1440px;
  width: 100%;
  margin: 0 auto;
  min-height: 100vh;
  overflow-y: auto;
}
@media (max-width: 768px) {
  .rooms-manage-container {
    padding: 12px;
  }
}
@media (max-width: 480px) {
  .rooms-manage-container {
    padding: 8px;
  }
}
</style>
