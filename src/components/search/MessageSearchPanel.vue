<template>
  <n-card :title="t('search.title')" :bordered="false" class="search-panel">
    <n-form :model="searchForm" label-placement="top" label-width="auto">
      <n-form-item :label="t('search.query')">
        <n-input
          v-model:value="searchForm.query"
          :placeholder="t('search.enter_query')"
          clearable
          @keyup.enter="handleSearch">
          <template #prefix>
            <svg class="w-16px h-16px text-gray-400">
              <use href="#search"></use>
            </svg>
          </template>
          <template #suffix>
            <n-button
              type="primary"
              size="small"
              :loading="searching"
              @click="handleSearch">
              {{ t('search.search') }}
            </n-button>
          </template>
        </n-input>
      </n-form-item>

      <n-form-item :label="t('search.filters')">
        <n-flex :size="12">
          <n-select
            v-model:value="searchForm.roomId"
            :options="roomOptions"
            :placeholder="t('search.all_rooms')"
            clearable
            style="width: 200px" />
          
          <n-select
            v-model:value="searchForm.sender"
            :options="senderOptions"
            :placeholder="t('search.all_senders')"
            clearable
            style="width: 200px" />
          
          <n-select
            v-model:value="searchForm.timeRange"
            :options="timeRangeOptions"
            :placeholder="t('search.all_time')"
            clearable
            style="width: 150px" />
        </n-flex>
      </n-form-item>
    </n-form>

    <n-divider style="margin: 8px 0" />

    <n-spin :show="searching">
      <n-empty v-if="searchResults.length === 0 && !searching" :description="t('search.no_results')" />

      <n-list v-else hoverable clickable>
        <n-list-item v-for="result in searchResults" :key="result.eventId" @click="handleResultClick(result)">
          <n-thing>
            <template #header>
              <n-flex align="center" justify="space-between">
                <n-flex align="center" :size="8">
                  <n-avatar
                    :size="32"
                    :src="getAvatarUrl(result.sender)"
                    :name="getDisplayName(result.sender)" />
                  <span class="text-14px font-medium">{{ getDisplayName(result.sender) }}</span>
                </n-flex>
                <span class="text-12px text-gray-500">{{ formatTimestamp(result.timestamp) }}</span>
              </n-flex>
            </template>
            <template #description>
              <n-flex vertical :size="4">
                <span class="text-12px text-gray-600">{{ getRoomName(result.roomId) }}</span>
                <div class="search-result-content" v-html="highlightText(result.content, searchForm.query)"></div>
              </n-flex>
            </template>
          </n-thing>
        </n-list-item>
      </n-list>

      <n-flex v-if="hasMore" justify="center" class="mt-4">
        <n-button @click="handleLoadMore" :loading="loadingMore">
          {{ t('search.load_more') }}
        </n-button>
      </n-flex>
    </n-spin>
  </n-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import MatrixMessageService from '@/services/matrix/MatrixMessageService'
import MatrixClientService from '@/services/matrix/MatrixClientService'

const { t } = useI18n()
const messageService = MatrixMessageService.getInstance()
const clientService = MatrixClientService.getInstance()

const searchForm = ref({
  query: '',
  roomId: null as string | null,
  sender: null as string | null,
  timeRange: null as string | null
})

const searching = ref(false)
const loadingMore = ref(false)
const searchResults = ref<any[]>([])
const hasMore = ref(false)

const roomOptions = ref<Array<{ label: string; value: string }>>([])
const senderOptions = ref<Array<{ label: string; value: string }>>([])

const timeRangeOptions = [
  { label: t('search.today'), value: 'today' },
  { label: t('search.this_week'), value: 'week' },
  { label: t('search.this_month'), value: 'month' },
  { label: t('search.all_time'), value: 'all' }
]

const loadRooms = async () => {
  try {
    const client = clientService.getClient()
    if (!client) return

    const rooms = client.getRooms()
    roomOptions.value = rooms.map((room) => ({
      label: room.name || room.roomId,
      value: room.roomId
    }))
  } catch (error) {
    console.error('Failed to load rooms:', error)
  }
}

const loadSenders = async () => {
  try {
    const client = clientService.getClient()
    if (!client) return

    const userId = client.getUserId()
    if (!userId) return

    const users = await client.getUsers()
    senderOptions.value = users.map((user) => ({
      label: user.displayName || user.userId,
      value: user.userId
    }))
  } catch (error) {
    console.error('Failed to load senders:', error)
  }
}

const handleSearch = async () => {
  if (!searchForm.value.query.trim()) {
    window.$message.warning(t('search.enter_query'))
    return
  }

  try {
    searching.value = true
    const results = await messageService.searchMessages({
      query: searchForm.value.query,
      roomId: searchForm.value.roomId || undefined,
      limit: 50
    })

    searchResults.value = results
    hasMore.value = results.length >= 50
  } catch (error) {
    console.error('Failed to search messages:', error)
    window.$message.error(t('search.search_failed'))
  } finally {
    searching.value = false
  }
}

const handleLoadMore = async () => {
  if (loadingMore.value || !hasMore.value) return

  try {
    loadingMore.value = true
    const lastResult = searchResults.value[searchResults.value.length - 1]
    const results = await messageService.searchMessages({
      query: searchForm.value.query,
      roomId: searchForm.value.roomId || undefined,
      after: lastResult?.eventId,
      limit: 50
    })

    searchResults.value = [...searchResults.value, ...results]
    hasMore.value = results.length >= 50
  } catch (error) {
    console.error('Failed to load more results:', error)
    window.$message.error(t('search.load_more_failed'))
  } finally {
    loadingMore.value = false
  }
}

const handleResultClick = (result: any) => {
  const client = clientService.getClient()
  if (!client) return

  console.log('[MessageSearchPanel] Navigate to room:', result.roomId)
}

const getDisplayName = (userId: string): string => {
  const client = clientService.getClient()
  if (!client) return userId

  const user = client.getUser(userId)
  return user?.displayName || userId
}

const getAvatarUrl = (userId: string): string => {
  const client = clientService.getClient()
  if (!client) return ''

  const user = client.getUser(userId)
  return user?.avatarUrl || ''
}

const getRoomName = (roomId: string): string => {
  const client = clientService.getClient()
  if (!client) return roomId

  const room = client.getRoom(roomId)
  return room?.name || roomId
}

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) {
    return t('search.just_now')
  } else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return t('search.minutes_ago', { minutes })
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return t('search.hours_ago', { hours })
  } else if (diff < 604800000) {
    const days = Math.floor(diff / 86400000)
    return t('search.days_ago', { days })
  } else {
    return date.toLocaleDateString()
  }
}

const highlightText = (content: any, query: string): string => {
  if (!content || !query) return ''

  const text = typeof content === 'string' ? content : content.body || ''
  if (!text) return ''

  const regex = new RegExp(`(${query})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

onMounted(() => {
  loadRooms()
  loadSenders()
})
</script>

<style scoped>
.search-panel {
  background: var(--bg-color);
}

.search-result-content {
  font-size: 14px;
  color: var(--text-color);
  max-height: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.search-result-content :deep(mark) {
  background-color: #ffeb3b;
  padding: 0 2px;
  border-radius: 2px;
}
</style>
