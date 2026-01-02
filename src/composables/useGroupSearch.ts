/**
 * 群搜索功能的 Composable
 * 提供响应式的群搜索功能
 */

import { ref, computed, watch } from 'vue'
import { useGroupStore } from '@/stores/group'
import { useMessage } from 'naive-ui'
import { getRoomSearchHistory, clearRoomSearchHistory } from '@/services/roomSearchService'
import type { GroupListReq } from '@/services/types'
import { logger } from '@/utils/logger'

export interface GroupSearchOptions {
  query?: string
  limit?: number
  roomTypes?: ('public' | 'private' | 'direct')[]
  memberCountRange?: {
    min?: number
    max?: number
  }
  sortBy?: 'name' | 'member_count' | 'activity'
}

export interface GroupSearchState {
  loading: boolean
  query: string
  results: GroupListReq[]
  hasSearched: boolean
  suggestions: string[]
  history: string[]
}

export function useGroupSearch() {
  const groupStore = useGroupStore()
  const message = useMessage()

  // 响应式状态
  const state = ref<GroupSearchState>({
    loading: false,
    query: '',
    results: [],
    hasSearched: false,
    suggestions: [],
    history: []
  })

  // 计算属性
  const hasResults = computed(() => state.value.results.length > 0)
  const hasQuery = computed(() => !!state.value.query.trim())
  const isEmpty = computed(() => state.value.hasSearched && !hasResults.value)

  // 搜索已加入的群
  const searchJoinedGroups = async (options: GroupSearchOptions = {}) => {
    state.value.loading = true
    state.value.query = options.query || ''
    state.value.hasSearched = true

    try {
      const searchOptions: GroupSearchOptions = {
        limit: options.limit || 20,
        sortBy: options.sortBy || 'activity'
      }

      if (options.query !== undefined) searchOptions.query = options.query
      if (options.roomTypes) searchOptions.roomTypes = options.roomTypes
      if (options.memberCountRange) searchOptions.memberCountRange = options.memberCountRange

      const results = await groupStore.searchGroups(searchOptions)

      state.value.results = results
    } catch (error) {
      logger.error('搜索群组失败:', error)
      message.error('搜索群组失败，请重试')
      state.value.results = []
    } finally {
      state.value.loading = false
    }
  }

  // 搜索公开群
  const searchPublicGroups = async (options: { query?: string; limit?: number; server?: string } = {}) => {
    state.value.loading = true
    state.value.query = options.query || ''
    state.value.hasSearched = true

    try {
      const searchOptions: { query?: string; limit?: number; server?: string } = {
        limit: options.limit || 20
      }

      if (options.query !== undefined) searchOptions.query = options.query
      if (options.server) searchOptions.server = options.server

      const results = await groupStore.searchPublicGroups(searchOptions)

      state.value.results = results
    } catch (error) {
      logger.error('搜索公开群组失败:', error)
      message.error('搜索公开群组失败，请重试')
      state.value.results = []
    } finally {
      state.value.loading = false
    }
  }

  // 获取搜索建议
  const getSuggestions = async (query: string) => {
    if (!query || query.length < 2) {
      state.value.suggestions = []
      return
    }

    try {
      const suggestions = await groupStore.getGroupSearchSuggestions(query, 5)
      state.value.suggestions = suggestions
    } catch (error) {
      logger.error('获取搜索建议失败:', error)
      state.value.suggestions = []
    }
  }

  // 加载搜索历史
  const loadHistory = () => {
    state.value.history = getRoomSearchHistory(10)
  }

  // 清空搜索历史
  const clearHistory = () => {
    clearRoomSearchHistory()
    state.value.history = []
    message.success('搜索历史已清空')
  }

  // 清空搜索结果
  const clearResults = () => {
    state.value.query = ''
    state.value.results = []
    state.value.hasSearched = false
    state.value.suggestions = []
  }

  // 选择搜索建议
  const selectSuggestion = (suggestion: string) => {
    state.value.query = suggestion
    searchJoinedGroups({ query: suggestion })
  }

  // 防抖搜索
  let searchTimer: NodeJS.Timeout | null = null
  const debouncedSearch = (query: string, delay: number = 500) => {
    if (searchTimer) {
      clearTimeout(searchTimer)
    }

    searchTimer = setTimeout(() => {
      if (query.trim()) {
        searchJoinedGroups({ query })
      }
    }, delay)
  }

  // 高级搜索
  const advancedSearch = async (options: GroupSearchOptions) => {
    state.value.loading = true
    state.value.query = options.query || ''
    state.value.hasSearched = true

    try {
      const results = await groupStore.searchGroups(options)
      state.value.results = results
    } catch (error) {
      logger.error('高级搜索失败:', error)
      message.error('搜索失败，请重试')
      state.value.results = []
    } finally {
      state.value.loading = false
    }
  }

  // 监听查询变化以获取建议
  watch(
    () => state.value.query,
    (newQuery) => {
      if (newQuery && newQuery.length >= 2) {
        getSuggestions(newQuery)
      } else {
        state.value.suggestions = []
      }
    }
  )

  // 初始化时加载历史
  loadHistory()

  return {
    // 状态
    state,
    // 计算属性
    hasResults,
    hasQuery,
    isEmpty,
    // 方法
    searchJoinedGroups,
    searchPublicGroups,
    getSuggestions,
    loadHistory,
    clearHistory,
    clearResults,
    selectSuggestion,
    debouncedSearch,
    advancedSearch
  }
}

// 默认导出
export default useGroupSearch
