<template>
  <div class="p-16px">
    <n-space align="center" :size="8" class="mb-10px">
      <n-button tertiary :type="type === 'user' ? 'primary' : 'default'" @click="setType('user')">找好友</n-button>
      <n-button tertiary :type="type === 'matrix' ? 'primary' : 'default'" @click="setType('matrix')">
        企业目录
      </n-button>
    </n-space>
    <n-space v-if="type === 'user'" align="center" :size="8" class="mb-10px">
      <div class="sort-label">排序：</div>
      <n-radio-group v-model:value="sortMode" size="small">
        <n-radio-button value="recent">按最近互动</n-radio-button>
        <n-radio-button value="name">按昵称</n-radio-button>
      </n-radio-group>
      <div class="sort-label ml-8px">标签：</div>
      <n-select v-model:value="selectedTag" :options="tagOptions" clearable size="small" style="min-width: 140px" />
    </n-space>
    <n-space align="center" :size="8" class="mb-10px">
      <n-input
        v-model:value="keyword"
        size="medium"
        :placeholder="type === 'user' ? '输入昵称搜索好友' : '输入用户名或邮箱搜索'"
        clearable />
      <n-button type="primary" @click="handleSearch">搜索</n-button>
    </n-space>
    <n-space align="center" :size="8" class="mb-12px">
      <n-input v-model:value="mxid" size="medium" placeholder="输入完整 MXID 如 @user:matrix.example.com" clearable />
      <n-button tertiary type="primary" @click="startDmByMxid">直接发起私聊</n-button>
    </n-space>
    <n-spin v-if="loading" size="small">搜索中…</n-spin>
    <n-empty v-else-if="items.length === 0" description="暂无结果" />
    <template v-else>
      <template v-if="type === 'user'">
        <div v-if="onlineItems.length" class="section-title">在线</div>
        <n-list v-if="onlineItems.length">
          <n-list-item v-for="item in onlineItems" :key="'on-' + item.uid">
            <n-space align="center" :size="12" class="w-full">
              <n-avatar :src="item.avatar || '/logoD.png'" :fallback-src="'/logoD.png'" round :size="36" />
              <div class="flex-1">
                <div class="name">
                  {{ item.name || item.uid }}
                  <span class="status">
                    <span class="status-dot online"></span>
                    在线
                  </span>
                </div>
                <div class="account">账号：{{ item.account || item.uid }}</div>
              </div>
              <n-button tertiary type="primary" size="small" @click="addFriend(item)">添加</n-button>
            </n-space>
          </n-list-item>
        </n-list>
        <div v-if="offlineItems.length" class="section-title mt-12px">离线</div>
        <n-list v-if="offlineItems.length">
          <n-list-item v-for="item in offlineItems" :key="'off-' + item.uid">
            <n-space align="center" :size="12" class="w-full">
              <n-avatar :src="item.avatar || '/logoD.png'" :fallback-src="'/logoD.png'" round :size="36" />
              <div class="flex-1">
                <div class="name">
                  {{ item.name || item.uid }}
                  <span class="status">
                    <span class="status-dot offline"></span>
                    离线
                  </span>
                </div>
                <div class="account">账号：{{ item.account || item.uid }}</div>
              </div>
              <n-button tertiary type="primary" size="small" @click="addFriend(item)">添加</n-button>
            </n-space>
          </n-list-item>
        </n-list>
      </template>
      <template v-else>
        <n-list>
          <n-list-item v-for="item in items" :key="item.uid">
            <n-space align="center" :size="12" class="w-full">
              <n-avatar :src="item.avatar || '/logoD.png'" :fallback-src="'/logoD.png'" round :size="36" />
              <div class="flex-1">
                <div class="name">{{ item.name || item.uid }}</div>
                <div class="account">账号：{{ item.account || item.uid }}</div>
              </div>
              <n-button v-if="type === 'matrix'" tertiary type="primary" size="small" @click="startMatrixDm(item)">
                开始聊天
              </n-button>
              <n-button v-else tertiary type="primary" size="small" @click="addFriend(item)">添加</n-button>
            </n-space>
          </n-list-item>
        </n-list>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import router from '@/router'
import { sendFriendRequest, listFriendsWithPresenceAndActivity } from '@/integrations/matrix/friendsManager'
import { getAllTags, addTag, getUserTags } from '@/integrations/matrix/friendsTags'
import { useMatrixAuthStore } from '@/stores/matrixAuth'
import { useGlobalStore } from '@/stores/global'
import { searchDirectory, getOrCreateDirectRoom, updateDirectMapping } from '@/integrations/matrix/contacts'
import { matrixClientService } from '@/integrations/matrix/client'
import { useMatrixAuth } from '@/hooks/useMatrixAuth'
import { msg } from '@/utils/SafeUI'

// Type definitions
interface FriendPresenceRow {
  userId: string
  display_name?: string
  avatar_url?: string
  presence?: string
  activeTime?: number
}

interface DirectoryUserRow {
  user_id?: string
  userId?: string
  display_name?: string
  displayName?: string
  avatar_url?: string
  last_active_ts?: number
}

interface SearchItem {
  uid: string
  name: string
  avatar: string
  account: string
  presence?: string
  activeTime?: number
  lastActiveTs?: number
  tags?: string[]
}

const globalStore = useGlobalStore()
const type = ref<'user' | 'matrix'>('user')
const keyword = ref('')
const items = ref<SearchItem[]>([])
const loading = ref(false)
const mxid = ref('')
const sortMode = ref<'recent' | 'name'>('recent')
const selectedTag = ref<string | null>(null)
const tagOptions = computed(() => getAllTags().map((t) => ({ label: t, value: t })))

const setType = (t: 'user' | 'matrix') => {
  type.value = t
  items.value = []
}

const doSearch = async () => {
  const key = keyword.value.trim()
  if (!key || key.length < 2) {
    items.value = []
    return
  }
  loading.value = true
  try {
    if (type.value === 'user') {
      const rows: FriendPresenceRow[] = await listFriendsWithPresenceAndActivity().catch(() => [])
      items.value = rows.map((u: FriendPresenceRow) => ({
        uid: u.userId,
        name: u.display_name || u.userId,
        avatar: u.avatar_url || '',
        account: u.userId,
        presence: u.presence || 'offline',
        activeTime: u.activeTime || 0,
        tags: getUserTags(u.userId)
      }))
      if (selectedTag.value)
        items.value = items.value.filter((i) => (i.tags || []).includes(selectedTag.value as string))
    } else {
      const client = matrixClientService.getClient()
      if (!client) {
        msg.warning('Matrix 未登录，无法搜索目录')
        items.value = []
      } else {
        const rows: DirectoryUserRow[] = await searchDirectory(key)
        items.value = rows.map((u: DirectoryUserRow) => ({
          uid: u.user_id || u.userId || '',
          name: u.display_name || u.displayName || u.user_id || '',
          avatar: u.avatar_url || '',
          account: u.user_id || '',
          lastActiveTs: u.last_active_ts || 0
        }))
      }
    }
  } catch (e: unknown) {
    const m = e instanceof Error ? e.message : String(e)
    msg.error(`搜索失败：${m}`)
    items.value = []
  } finally {
    loading.value = false
  }
}

const handleSearch = useDebounceFn(doSearch, 300)

const addFriend = async (item: SearchItem) => {
  const uid = item.account || item.uid
  try {
    await sendFriendRequest(uid)
    msg.success('好友请求已发送')
    if (selectedTag.value) addTag(uid, selectedTag.value as string)
  } catch (e: unknown) {
    const m = e instanceof Error ? e.message : String(e)
    msg.error(`发送请求失败：${m}`)
  }
}

const startMatrixDm = async (item: SearchItem) => {
  try {
    const auth = useMatrixAuthStore()
    const domain = (() => {
      try {
        return new URL(auth.getHomeserverBaseUrl() || '').host
      } catch {
        return (auth.getHomeserverBaseUrl() || '').replace(/^https?:\/\//, '')
      }
    })()
    const target = item.account || `@${item.uid}:${domain}`
    const roomId = await getOrCreateDirectRoom(target)
    if (!roomId) {
      msg.error('无法创建会话')
      return
    }
    try {
      await updateDirectMapping(target, roomId)
    } catch {}
    globalStore.updateCurrentSessionRoomId(roomId)
    router.push('/mobile/chatRoom/chatMain')
  } catch (e: unknown) {
    const m = e instanceof Error ? e.message : String(e)
    msg.error(`创建会话失败：${m}`)
  }
}

const formatMxid = (raw: string) => {
  const s = raw.trim()
  if (!s) return ''
  if (s.startsWith('@') && s.includes(':')) return s
  const { store } = useMatrixAuth()
  if (!store.getHomeserverBaseUrl()) store.setDefaultBaseUrlFromEnv()
  let host = ''
  try {
    const parsed = new URL(store.getHomeserverBaseUrl() || '').host
    host = parsed || host
  } catch {}
  const core = s.replace(/^@/, '')
  return `@${core.includes(':') ? core.split(':')[0] : core}:${host}`
}

const ensureMatrixReady = async () => {
  let client = matrixClientService.getClient()
  const { store } = useMatrixAuth()
  if (!client) {
    if (!store.getHomeserverBaseUrl()) store.setDefaultBaseUrlFromEnv()
    const base = store.getHomeserverBaseUrl() || ''
    await matrixClientService.initialize({ baseUrl: base, accessToken: store.accessToken, userId: store.userId })
    await matrixClientService.startClient({ initialSyncLimit: 5, pollTimeout: 15000 })
    client = matrixClientService.getClient()
  }
  return client
}

const startDmByMxid = async () => {
  try {
    const target = formatMxid(mxid.value)
    if (!target || !target.startsWith('@') || !target.includes(':')) {
      msg.warning('请输入完整的 MXID，如 @user:domain')
      return
    }
    await ensureMatrixReady()
    const roomId = await getOrCreateDirectRoom(target)
    if (!roomId) {
      msg.error('无法创建会话')
      return
    }
    try {
      await updateDirectMapping(target, roomId)
    } catch {}
    globalStore.updateCurrentSessionRoomId(roomId)
    router.push('/mobile/chatRoom/chatMain')
  } catch (e: unknown) {
    const m = e instanceof Error ? e.message : String(e)
    msg.error(`创建会话失败：${m}`)
  }
}

const normalizeName = (s: string) => (s || '').toLocaleLowerCase()
const recentValue = (i: { activeTime?: number; lastActiveTs?: number }) => Number(i.activeTime || i.lastActiveTs || 0)
const sortByMode = (arr: SearchItem[]) => {
  const a = [...arr]
  if (sortMode.value === 'name') {
    a.sort((x, y) => normalizeName(x.name || x.uid || '').localeCompare(normalizeName(y.name || y.uid || '')))
  } else {
    a.sort(
      (x, y) =>
        recentValue(y) - recentValue(x) ||
        normalizeName(x.name || x.uid || '').localeCompare(normalizeName(y.name || y.uid || ''))
    )
  }
  return a
}
const onlineItems = computed(() => sortByMode(items.value.filter((i) => (i.presence || 'offline') === 'online')))
const offlineItems = computed(() => sortByMode(items.value.filter((i) => (i.presence || 'offline') !== 'online')))
</script>

<style scoped>
.name {
  font-size: 14px;
  color: var(--text-color);
}
.account {
  font-size: 12px;
  color: var(--chat-text-color);
}
.section-title {
  font-size: 13px;
  color: var(--text-color);
  font-weight: 600;
  margin: 6px 0;
}
.status {
  margin-left: 8px;
  font-size: 12px;
  color: var(--chat-text-color);
}
.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}
.status-dot.online {
  background: #18a058;
}
.status-dot.offline {
  background: #c0c4cc;
}
.sort-label {
  font-size: 12px;
  color: var(--chat-text-color);
}
</style>
