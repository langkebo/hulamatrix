import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  searchRoomMessagesEnhanced,
  searchGlobalMessages,
  getSearchSuggestions,
  advancedSearch,
  getSearchHistory,
  addToSearchHistory,
  clearSearchHistory,
  highlightSearchTerms,
  type EnhancedSearchResult,
  type SearchOptions,
  type SearchSuggestion,
  type SearchHistoryItem
} from '@/integrations/matrix/search'
import { flags } from '@/utils/envFlags'
import { logger, toError } from '@/utils/logger'

/** Search result type */
type SearchResult = EnhancedSearchResult['results'][number]

/** Search statistics */
interface SearchStats {
  totalResults: number
  searchTime: number
  cacheHits: number
  cacheMisses: number
}

/** Extended search options with global and roomId */
interface ExtendedSearchOptions extends SearchOptions {
  global?: boolean
  roomId?: string
}

/** Cache entry */
interface CacheEntry {
  result: EnhancedSearchResult['results']
  timestamp: number
}

export interface SearchState {
  query: string
  results: SearchResult[]
  suggestions: SearchSuggestion[]
  history: SearchHistoryItem[]
  stats: SearchStats | null
  loading: boolean
  error: string | null
  currentPage: number
  hasMore: boolean
  searchTime: number
  lastSearchOptions: SearchOptions | null
  nextBatch: string | null
  lastSearchSource: 'advanced' | 'global' | 'room' | null
  lastRoomId: string | null
}

export interface SearchFilters {
  scope: string[]
  timeRange: string
  messageTypes: string[]
  senders: string[]
  rooms: string[]
  containsUrl: boolean
}

export interface SearchAnalytics {
  totalSearches: number
  averageSearchTime: number
  popularQueries: Array<{ query: string; count: number }>
  searchTrends: Array<{ date: string; count: number }>
  resultClicks: number
  mostSearchedRooms: Array<{ roomId: string; count: number }>
  mostSearchedUsers: Array<{ userId: string; count: number }>
}

export const useSearchStore = defineStore('search', () => {
  // 状态
  const state = ref<SearchState>({
    query: '',
    results: [],
    suggestions: [],
    history: [],
    stats: null,
    loading: false,
    error: null,
    currentPage: 0,
    hasMore: false,
    searchTime: 0,
    lastSearchOptions: null,
    nextBatch: null,
    lastSearchSource: null,
    lastRoomId: null
  })

  const filters = ref<SearchFilters>({
    scope: ['messages'],
    timeRange: 'all',
    messageTypes: ['text'],
    senders: [],
    rooms: [],
    containsUrl: false
  })

  const analytics = ref<SearchAnalytics | null>(null)
  const searchSettings = ref({
    maxResults: 50,
    cacheExpiry: 5 * 60 * 1000, // 5分钟
    enableAnalytics: true,
    enableHistory: true,
    enableSuggestions: true,
    debounceTime: 300
  })

  // 计算属性
  const query = computed(() => state.value.query)
  const results = computed(() => state.value.results)
  const suggestions = computed(() => state.value.suggestions)
  const history = computed(() => state.value.history)
  const loading = computed(() => state.value.loading)
  const error = computed(() => state.value.error)
  const hasResults = computed(() => state.value.results.length > 0)
  const hasMore = computed(() => state.value.hasMore)
  const searchTime = computed(() => state.value.searchTime)

  // 缓存
  const cache = ref<Map<string, CacheEntry>>(new Map())

  // 搜索方法
  const search = async (searchQuery: string, options: Partial<ExtendedSearchOptions> = {}) => {
    if (!flags.matrixSearchEnabled) return

    // 防抖处理
    if (searchQuery === state.value.query && state.value.loading) return

    state.value.query = searchQuery
    state.value.loading = true
    state.value.error = null
    state.value.currentPage = 0

    try {
      const startTime = Date.now()
      let result: EnhancedSearchResult

      // 构建搜索选项
      const searchOptions: SearchOptions = {
        searchTerm: searchQuery,
        types: (getMessageTypes() || []).filter(Boolean) as string[],
        containsUrl: options.containsUrl || filters.value.containsUrl,
        limit: options.limit || searchSettings.value.maxResults,
        includeContext: options.includeContext || true,
        ...(options.rooms
          ? { rooms: options.rooms }
          : filters.value.rooms.length > 0
            ? { rooms: filters.value.rooms }
            : {}),
        ...(options.senders
          ? { senders: options.senders }
          : filters.value.senders.length > 0
            ? { senders: filters.value.senders }
            : {})
      }

      // 检查缓存
      const cacheKey = generateCacheKey(searchOptions)
      const cached = cache.value.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < searchSettings.value.cacheExpiry) {
        state.value.results = cached.result
        state.value.searchTime = Date.now() - startTime
        state.value.hasMore = false
        return
      }

      // 执行搜索
      if (options.global) {
        result = await searchGlobalMessages(searchQuery, searchOptions)
        state.value.lastSearchSource = 'global'
        state.value.lastRoomId = null
      } else if (options.roomId) {
        result = await searchRoomMessagesEnhanced(options.roomId, searchQuery, options)
        state.value.lastSearchSource = 'room'
        state.value.lastRoomId = options.roomId
        searchOptions.rooms = [options.roomId]
      } else {
        result = await advancedSearch(searchOptions)
        state.value.lastSearchSource = 'advanced'
        state.value.lastRoomId = null
      }

      // 更新状态
      state.value.results = result.results || []
      state.value.hasMore = result.hasMore || false
      state.value.searchTime = Date.now() - startTime
      state.value.lastSearchOptions = searchOptions
      state.value.nextBatch = result.nextBatch || null

      // 缓存结果
      cache.value.set(cacheKey, {
        result: result.results || [],
        timestamp: Date.now()
      })

      // 更新统计
      if (searchSettings.value.enableAnalytics) {
        updateAnalytics(searchQuery, state.value.results.length, state.value.searchTime)
      }

      // 添加到历史
      if (searchSettings.value.enableHistory && searchQuery.trim()) {
        addToSearchHistory(searchQuery, state.value.results.length, searchOptions as unknown as Record<string, unknown>)
        loadHistory()
      }
    } catch (err) {
      logger.error('Search failed:', toError(err))
      state.value.error = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      state.value.loading = false
    }
  }

  const searchRoom = async (roomId: string, searchQuery: string) => {
    await search(searchQuery, { roomId })
  }

  const searchGlobal = async (searchQuery: string) => {
    await search(searchQuery, { global: true })
  }

  const loadMoreResults = async () => {
    if (!state.value.hasMore || !state.value.lastSearchOptions || state.value.loading) return

    state.value.loading = true

    try {
      if (!state.value.nextBatch) return
      if (state.value.lastSearchSource === 'room' && state.value.lastRoomId) {
        const { searchNextBatchRoom } = await import('@/integrations/matrix/search')
        const next = await searchNextBatchRoom(
          state.value.lastRoomId,
          state.value.nextBatch,
          state.value.lastSearchOptions
        )
        state.value.results = [...state.value.results, ...(next.results || [])]
        state.value.hasMore = next.hasMore || false
        state.value.nextBatch = next.nextBatch || null
      } else if (state.value.lastSearchSource === 'global') {
        const { searchNextBatchGlobal } = await import('@/integrations/matrix/search')
        const next = await searchNextBatchGlobal(state.value.nextBatch, state.value.lastSearchOptions)
        state.value.results = [...state.value.results, ...(next.results || [])]
        state.value.hasMore = next.hasMore || false
        state.value.nextBatch = next.nextBatch || null
      } else {
        const { searchNextBatchAdvanced } = await import('@/integrations/matrix/search')
        const next = await searchNextBatchAdvanced(state.value.nextBatch, state.value.lastSearchOptions)
        state.value.results = [...state.value.results, ...(next.results || [])]
        state.value.hasMore = next.hasMore || false
        state.value.nextBatch = next.nextBatch || null
      }
      state.value.currentPage++
    } finally {
      state.value.loading = false
    }
  }

  // 搜索建议
  const loadSuggestions = async (query: string) => {
    if (!flags.matrixSearchEnabled || !searchSettings.value.enableSuggestions) return

    if (query.length < 2) {
      state.value.suggestions = []
      return
    }

    try {
      state.value.suggestions = await getSearchSuggestions(query, 5)
    } catch (err) {
      logger.error('Failed to load suggestions:', toError(err))
    }
  }

  // 历史管理
  const loadHistory = async () => {
    if (!searchSettings.value.enableHistory) return

    try {
      state.value.history = getSearchHistory(20)
    } catch (err) {
      logger.error('Failed to load search history:', toError(err))
    }
  }

  const clearHistory = async () => {
    try {
      clearSearchHistory()
      state.value.history = []
    } catch (err) {
      logger.error('Failed to clear search history:', toError(err))
    }
  }

  const searchFromHistory = (item: SearchHistoryItem) => {
    state.value.query = item.query
    search(item.query, item.filters || {})
  }

  // 过滤器管理
  const updateFilters = (newFilters: Partial<SearchFilters>) => {
    filters.value = { ...filters.value, ...newFilters }
  }

  const resetFilters = () => {
    filters.value = {
      scope: ['messages'],
      timeRange: 'all',
      messageTypes: ['text'],
      senders: [],
      rooms: [],
      containsUrl: false
    }
  }

  // 缓存管理
  const clearCache = () => {
    cache.value.clear()
  }

  const generateCacheKey = (options: SearchOptions): string => {
    return JSON.stringify({
      query: options.searchTerm,
      rooms: options.rooms,
      senders: options.senders,
      types: options.types,
      containsUrl: options.containsUrl,
      limit: options.limit
    })
  }

  const getMessageTypes = () => {
    const typeMap: { [key: string]: string } = {
      text: 'm.room.message',
      image: 'm.room.message',
      video: 'm.room.message',
      file: 'm.room.message',
      audio: 'm.room.message'
    }

    return filters.value.messageTypes.map((type) => typeMap[type]).filter(Boolean)
  }

  // 高亮文本
  const highlightText = (text: string, query: string) => {
    return highlightSearchTerms(text, query)
  }

  // 结果处理
  const selectResult = (result: SearchResult) => {
    // 更新统计
    if (searchSettings.value.enableAnalytics) {
      updateClickAnalytics(result)
    }

    // 发射选择事件
    return result
  }

  const exportResults = (format: 'json' | 'csv' = 'json') => {
    if (state.value.results.length === 0) return

    const exportData = {
      query: state.value.query,
      timestamp: new Date().toISOString(),
      totalResults: state.value.results.length,
      searchTime: state.value.searchTime,
      results: state.value.results
    }

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      })
      downloadFile(blob, `search-results-${Date.now()}.json`)
    } else if (format === 'csv') {
      const csv = convertToCSV(state.value.results)
      const blob = new Blob([csv], { type: 'text/csv' })
      downloadFile(blob, `search-results-${Date.now()}.csv`)
    }
  }

  const convertToCSV = (results: SearchResult[]): string => {
    if (results.length === 0) return ''

    const firstResult = results[0]
    if (!firstResult) return ''

    const headers = Object.keys(firstResult)
    const csvContent = [
      headers.join(','),
      ...results.map((result) =>
        headers.map((header) => JSON.stringify((result as Record<string, unknown>)[header] || '')).join(',')
      )
    ].join('\n')

    return csvContent
  }

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // 分析统计
  const updateAnalytics = (query: string, _resultCount: number, searchTime: number) => {
    if (!searchSettings.value.enableAnalytics) return

    // 初始化分析数据
    if (!analytics.value) {
      analytics.value = {
        totalSearches: 0,
        averageSearchTime: 0,
        popularQueries: [],
        searchTrends: [],
        resultClicks: 0,
        mostSearchedRooms: [],
        mostSearchedUsers: []
      }
    }

    const analyticsData = analytics.value

    // 更新基础统计
    analyticsData.totalSearches++
    analyticsData.averageSearchTime =
      (analyticsData.averageSearchTime * (analyticsData.totalSearches - 1) + searchTime) / analyticsData.totalSearches

    // 更新热门查询
    const existingQuery = analyticsData.popularQueries.find((q) => q.query === query)
    if (existingQuery) {
      existingQuery.count++
    } else {
      analyticsData.popularQueries.push({ query, count: 1 })
    }
    analyticsData.popularQueries.sort((a, b) => b.count - a.count)
    analyticsData.popularQueries = analyticsData.popularQueries.slice(0, 20)

    // 更新搜索趋势
    const today = new Date().toISOString().split('T')[0]
    const existingTrend = analyticsData.searchTrends.find((t) => t.date === (today || ''))
    if (existingTrend) {
      existingTrend.count++
    } else {
      analyticsData.searchTrends.push({ date: today || '', count: 1 })
    }

    // 保留最近30天的趋势
    analyticsData.searchTrends = analyticsData.searchTrends.filter((t) => {
      const trendDate = new Date(t.date)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return trendDate >= thirtyDaysAgo
    })
  }

  const updateClickAnalytics = (result: SearchResult) => {
    if (!analytics.value) return

    analytics.value.resultClicks++

    // 更新房间搜索统计
    const resultRecord = result as Record<string, unknown>
    if (resultRecord.room_id) {
      const existingRoom = analytics.value.mostSearchedRooms.find((r) => r.roomId === resultRecord.room_id)
      if (existingRoom) {
        existingRoom.count++
      } else {
        analytics.value.mostSearchedRooms.push({ roomId: String(resultRecord.room_id), count: 1 })
      }
      analytics.value.mostSearchedRooms.sort((a, b) => b.count - a.count)
    }

    // 更新用户搜索统计
    if (resultRecord.sender) {
      const existingUser = analytics.value.mostSearchedUsers.find((u) => u.userId === resultRecord.sender)
      if (existingUser) {
        existingUser.count++
      } else {
        analytics.value.mostSearchedUsers.push({ userId: String(resultRecord.sender), count: 1 })
      }
      analytics.value.mostSearchedUsers.sort((a, b) => b.count - a.count)
    }
  }

  // 初始化
  const initialize = async () => {
    if (flags.matrixSearchEnabled) {
      await loadHistory()

      // 定期清理缓存
      setInterval(() => {
        const now = Date.now()
        for (const [key, value] of cache.value.entries()) {
          if (now - value.timestamp > searchSettings.value.cacheExpiry) {
            cache.value.delete(key)
          }
        }
      }, 60000) // 每分钟清理一次
    }
  }

  // 重置状态
  const reset = () => {
    state.value = {
      query: '',
      results: [],
      suggestions: [],
      history: [],
      stats: null,
      loading: false,
      error: null,
      currentPage: 0,
      hasMore: false,
      searchTime: 0,
      lastSearchOptions: null,
      nextBatch: null,
      lastSearchSource: null,
      lastRoomId: null
    }
    resetFilters()
    clearCache()
  }

  return {
    // 状态
    query,
    results,
    suggestions,
    history,
    loading,
    error,
    hasResults,
    hasMore,
    searchTime,
    filters,
    analytics: computed(() => analytics.value),

    // 方法
    search,
    searchRoom,
    searchGlobal,
    loadMoreResults,
    loadSuggestions,
    loadHistory,
    clearHistory,
    searchFromHistory,
    updateFilters,
    resetFilters,
    clearCache,
    highlightText,
    selectResult,
    exportResults,
    initialize,
    reset
  }
})
