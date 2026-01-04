/**
 * useRoomSearch - Shared room search logic composable
 *
 * This composable extracts common room search logic that can be shared
 * between desktop and mobile room search components.
 *
 * Phase 12 Optimization: Extract shared logic from duplicate components
 */

import { ref, reactive, computed, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { matrixClientService } from '@/integrations/matrix/client'
import { mapRooms, searchRooms, type SearchCriteria, type RoomRow } from '@/views/rooms/search-logic'
import { msg } from '@/utils/SafeUI'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'

export interface RoomSearchOptions {
  platform?: 'desktop' | 'mobile'
}

export interface RoomSearchResult {
  // State
  search: Ref<SearchCriteria>
  searching: Ref<boolean>
  results: Ref<RoomRow[]>
  pagination: {
    page: number
    pageSize: number
    pageCount: number
  }

  // Computed
  pagedResults: Ref<RoomRow[]>
  searchModeOptions: Array<{ label: string; value: SearchCriteria['mode'] }>
  sortOptions: Array<{ label: string; value: SearchCriteria['sortBy'] }>
  filterOptions: Array<{ label: string; value: string }>

  // Methods
  doSearch: () => Promise<void>
  resetSearch: () => void
  joinRoom: (roomId: string) => Promise<void>
}

export function useRoomSearch(options: RoomSearchOptions = {}): RoomSearchResult {
  const { t } = useI18n()
  const router = useRouter()
  const platform = options.platform || 'desktop'

  // Search state
  const search = ref<SearchCriteria>({ query: '', mode: 'fuzzy', sortBy: 'created', filter: [] })
  const searching = ref(false)
  const results = ref<RoomRow[]>([])

  // Pagination
  const pagination = reactive({ page: 1, pageSize: 10, pageCount: 1 })

  // Search options
  const searchModeOptions: Array<{ label: string; value: SearchCriteria['mode'] }> = [
    { label: t('search.exact', '精确'), value: 'exact' },
    { label: t('search.fuzzy', '模糊'), value: 'fuzzy' }
  ]

  const sortOptions: Array<{ label: string; value: SearchCriteria['sortBy'] }> = [
    { label: t('search.created', '创建时间'), value: 'created' },
    { label: t('search.name', '名称'), value: 'name' }
  ]

  // Filter options - mobile has more options
  const filterOptions: Array<{ label: string; value: string }> = [
    { label: t('search.public', '公开房间'), value: 'public' },
    { label: t('search.joined', '已加入'), value: 'joined' },
    ...(platform === 'mobile'
      ? [
          { label: t('search.unread', '未读'), value: 'unread' },
          { label: t('search.invite', '邀请房'), value: 'rule:invite' },
          { label: t('search.knock', '敲门房'), value: 'rule:knock' }
        ]
      : [])
  ]

  // Computed - paged results
  const pagedResults = computed(() => {
    const start = (pagination.page - 1) * pagination.pageSize
    const end = start + pagination.pageSize
    pagination.pageCount = Math.ceil((results.value.length || 1) / pagination.pageSize)
    return results.value.slice(start, end)
  })

  /**
   * Execute room search
   */
  const doSearch = async () => {
    searching.value = true
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        logger.warn('[useRoomSearch] No Matrix client available')
        return
      }

      const rows = mapRooms(client)
      results.value = searchRooms(rows, search.value)
      pagination.page = 1
    } catch (error) {
      logger.error('[useRoomSearch] Search failed:', error)
      msg.error(t('search.failed', '搜索失败'))
    } finally {
      searching.value = false
    }
  }

  /**
   * Reset search to initial state
   */
  const resetSearch = () => {
    search.value = { query: '', mode: 'fuzzy', sortBy: 'created', filter: [] }
    results.value = []
    pagination.page = 1
  }

  /**
   * Join a room
   */
  const joinRoom = async (roomId: string) => {
    const client = matrixClientService.getClient()
    if (!client) {
      msg.error(t('search.noClient', '无客户端连接'))
      return
    }

    try {
      const joinRoomFn = client?.joinRoom as ((roomId: string) => Promise<unknown>) | undefined
      if (joinRoomFn) {
        await joinRoomFn(roomId)
      }

      // Navigate to appropriate route based on platform
      const targetRoute = platform === 'mobile' ? '/mobile/message' : '/message'
      await router.push(targetRoute)

      msg.success(t('search.joined', '已加入房间'))
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      logger.error('[useRoomSearch] Join room failed:', e)
      msg.error(t('search.joinFailed', '加入房间失败：') + message)
    }
  }

  return {
    // State
    search,
    searching,
    results,
    pagination,

    // Computed
    pagedResults,
    searchModeOptions,
    sortOptions,
    filterOptions,

    // Methods
    doSearch,
    resetSearch,
    joinRoom
  }
}

/**
 * Helper function for i18n with fallback
 */
function _t(_key: string, fallback: string): string {
  // Simple i18n placeholder - in real usage, the component's t function should be used
  return fallback
}
