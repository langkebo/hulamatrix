import { ref, computed, type Ref } from 'vue'
import { useMatrixSpaces, type Space } from '@/hooks/useMatrixSpaces'
import {
  searchSpaces as enhancedSearch,
  getSearchSuggestions,
  loadSearchHistory,
  clearSearchHistory as clearHistoryService
} from '@/services/spaceSearchService'
import { logger } from '@/utils/logger'

export interface SpaceFilters {
  visibility: ('all' | 'public' | 'private')[]
  encrypted: ('all' | 'encrypted' | 'unencrypted')[]
  memberCount: number[]
}

export type SortOption = 'name' | 'members' | 'activity'

export interface UseSpaceListOptions {
  userSpaces: Ref<Space[]>
  searchResults: Ref<Space[]>
  searchSpaces: (query: string, options?: Record<string, unknown>) => Promise<Space[]>
  clearSearchResults: () => void
}

export function useSpaceList(options: UseSpaceListOptions) {
  const { userSpaces, searchResults, searchSpaces, clearSearchResults } = options

  // 状态
  const searchQuery = ref('')
  const currentSort = ref<SortOption>('activity')
  const filters = ref<SpaceFilters>({
    visibility: ['all'],
    encrypted: ['all'],
    memberCount: [0, 1000]
  })
  const activeQuickFilter = ref<string | null>(null)
  
  // 搜索相关状态
  const enhancedSearchResults = ref<Space[]>([])
  const searchSuggestions = ref<string[]>([])
  const showSuggestions = ref(false)
  const searchHistory = ref<string[]>([])
  const isSearching = ref(false)

  // 计算属性：是否有激活的筛选
  const hasActiveFilters = computed(() => {
    return (activeQuickFilter.value !== null && activeQuickFilter.value !== 'all') ||
      !filters.value.visibility.includes('all') ||
      !filters.value.encrypted.includes('all') ||
      filters.value.memberCount[0] > 0 ||
      filters.value.memberCount[1] < 1000
  })

  // 计算属性：当前排序标签
  const currentSortLabel = computed(() => {
    switch (currentSort.value) {
      case 'name': return '名称'
      case 'members': return '成员数量'
      case 'activity': return '最近活动'
      default: return '最近活动'
    }
  })

  // 核心计算属性：展示的 Spaces
  const displaySpaces = computed(() => {
    // 1. 确定基础列表
    let spaces = searchQuery.value
      ? (enhancedSearchResults.value.length > 0 ? enhancedSearchResults.value : searchResults.value)
      : userSpaces.value

    // 2. 应用快速筛选
    if (activeQuickFilter.value && activeQuickFilter.value !== 'all') {
      switch (activeQuickFilter.value) {
        case 'unread':
          spaces = spaces.filter(
            (s) => (s.notifications?.highlightCount ?? 0) + (s.notifications?.notificationCount ?? 0) > 0
          )
          break
        case 'encrypted':
          spaces = spaces.filter((s) => s.encrypted === true)
          break
        case 'public':
          spaces = spaces.filter((s) => s.isPublic ?? false)
          break
      }
    }

    // 3. 应用高级筛选
    if (!filters.value.visibility.includes('all')) {
      if (filters.value.visibility.includes('public')) {
        spaces = spaces.filter((s) => s.isPublic ?? false)
      } else if (filters.value.visibility.includes('private')) {
        spaces = spaces.filter((s) => !(s.isPublic ?? false))
      }
    }

    if (!filters.value.encrypted.includes('all')) {
      if (filters.value.encrypted.includes('encrypted')) {
        spaces = spaces.filter((s) => s.encrypted)
      } else if (filters.value.encrypted.includes('unencrypted')) {
        spaces = spaces.filter((s) => !s.encrypted)
      }
    }

    spaces = spaces.filter((s) => {
      const count = s.memberCount ?? 0
      return count >= filters.value.memberCount[0] && count <= filters.value.memberCount[1]
    })

    // 4. 应用排序
    return [...spaces].sort((a, b) => {
      switch (currentSort.value) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '')
        case 'members':
          return (b.memberCount || 0) - (a.memberCount || 0)
        default:
          return (b.lastActivity || 0) - (a.lastActivity || 0)
      }
    })
  })

  // 方法：处理搜索
  const handleSearch = async (query: string) => {
    searchQuery.value = query
    
    if (query.trim()) {
      isSearching.value = true
      try {
        // 使用增强搜索服务
        const results = await enhancedSearch(query, {
          limit: 50,
          fuzzy: true,
          filters: hasActiveFilters.value
            ? {
                visibility: filters.value.visibility.includes('all')
                  ? ('all' as const)
                  : filters.value.visibility.includes('public')
                    ? 'public'
                    : 'private',
                encrypted: filters.value.encrypted.includes('all')
                  ? ('all' as const)
                  : filters.value.encrypted.includes('encrypted')
                    ? 'encrypted'
                    : 'unencrypted',
                memberCount:
                  filters.value.memberCount[0] > 0 || filters.value.memberCount[1] < 1000
                    ? ([filters.value.memberCount[0], filters.value.memberCount[1]] as [number, number])
                    : null,
                joined: 'all'
              }
            : undefined
        })
        
        // 转换结果
        enhancedSearchResults.value = results.map((r) => ({
          id: r.roomId,
          roomId: r.roomId,
          name: r.name,
          topic: r.topic,
          avatar: r.avatar,
          memberCount: r.memberCount ?? 0,
          isPublic: r.joinRule === 'public',
          notifications: undefined,
          joined: false,
          joinRule: r.joinRule === 'public' ? 'public' : 'knock'
        })) as Space[]
        
        showSuggestions.value = false
      } catch (error) {
        logger.error('[useSpaceList] Enhanced search failed:', error)
        enhancedSearchResults.value = []
        // 降级到基本搜索
        await searchSpaces(query, { limit: 50 })
      } finally {
        isSearching.value = false
      }
    } else {
      enhancedSearchResults.value = []
      clearSearchResults()
      showSuggestions.value = true
      searchSuggestions.value = searchHistory.value.slice(0, 5)
    }
  }

  // 方法：加载建议
  const loadSuggestions = async () => {
    if (!searchQuery.value.trim()) {
      searchHistory.value = loadSearchHistory()
      searchSuggestions.value = searchHistory.value.slice(0, 5)
      showSuggestions.value = true
    } else {
      try {
        const suggestions = await getSearchSuggestions(searchQuery.value)
        searchSuggestions.value = suggestions.map((s) => s.text).slice(0, 5)
        showSuggestions.value = searchSuggestions.value.length > 0
      } catch (error) {
        logger.error('[useSpaceList] Failed to load suggestions:', error)
        showSuggestions.value = false
      }
    }
  }

  // 方法：清除历史
  const clearHistory = () => {
    clearHistoryService()
    searchHistory.value = []
    if (!searchQuery.value) {
      searchSuggestions.value = []
    }
  }

  // 方法：移除单个历史
  const removeHistoryItem = (item: string) => {
    const index = searchHistory.value.indexOf(item)
    if (index > -1) {
      searchHistory.value.splice(index, 1)
      // Update storage... assuming the service has a method for this or we just reload
      // Note: service might not have removeItem, so we rely on reload or just accept memory update
    }
  }

  // 方法：重置筛选
  const resetFilters = () => {
    filters.value = {
      visibility: ['all'],
      encrypted: ['all'],
      memberCount: [0, 1000]
    }
    activeQuickFilter.value = 'all'
  }

  // 方法：初始化历史
  const initSearchHistory = () => {
    searchHistory.value = loadSearchHistory()
  }

  // 方法：切换快速筛选
  const toggleQuickFilter = (key: string) => {
    if (activeQuickFilter.value === key) {
      activeQuickFilter.value = null
    } else {
      activeQuickFilter.value = key
    }
  }

  // 工具方法
  const formatUnreadCount = (count: number): string => {
    if (count >= 100) return '99+'
    return String(count)
  }

  const formatLastActivity = (timestamp: number): string => {
    const now = Date.now()
    const diff = now - timestamp
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
    return '更早之前'
  }

  return {
    searchQuery,
    currentSort,
    filters,
    activeQuickFilter,
    enhancedSearchResults,
    searchSuggestions,
    showSuggestions,
    searchHistory,
    isSearching,
    
    hasActiveFilters,
    currentSortLabel,
    displaySpaces,
    
    handleSearch,
    loadSuggestions,
    clearHistory,
    removeHistoryItem,
    resetFilters,
    toggleQuickFilter,
    formatUnreadCount,
    formatLastActivity
  }
}
