/**
 * Search History Composable - Shared search history state management
 *
 * Provides a centralized way to manage search history across the app.
 * Integrates with MobileSearchHistory component for UI.
 */

import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'

// ==================== Types ====================

export type SearchType = 'message' | 'user' | 'room' | 'all'

export interface SearchHistoryItem {
  id: string
  query: string
  type: SearchType
  timestamp: number
  roomId?: string
  resultCount?: number
}

export interface SearchHistorySettings {
  maxItems: number
  retentionDays: number
  saveMessageSearch: boolean
  saveUserSearch: boolean
  saveRoomSearch: boolean
}

// ==================== State ====================

const STORAGE_KEY = 'hula:search-history'
const SETTINGS_KEY = 'hula:search-history-settings'

const searchHistory = ref<SearchHistoryItem[]>([])
const settings = ref<SearchHistorySettings>({
  maxItems: 50,
  retentionDays: 30,
  saveMessageSearch: true,
  saveUserSearch: true,
  saveRoomSearch: true
})

// ==================== Composable ====================

export function useSearchHistory() {
  // ==================== State Management ====================

  /**
   * Load search history from localStorage
   */
  const loadHistory = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as SearchHistoryItem[]

        // Filter out old items based on retention policy
        const cutoffTime =
          settings.value.retentionDays > 0 ? Date.now() - settings.value.retentionDays * 24 * 60 * 60 * 1000 : 0

        searchHistory.value = parsed.filter((item) => item.timestamp >= cutoffTime)

        // Trim to max items
        if (searchHistory.value.length > settings.value.maxItems) {
          searchHistory.value = searchHistory.value.slice(0, settings.value.maxItems)
        }
      }
    } catch (error) {
      logger.error('[useSearchHistory] Failed to load history:', error)
      searchHistory.value = []
    }
  }

  /**
   * Save search history to localStorage
   */
  const saveHistory = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(searchHistory.value))
    } catch (error) {
      logger.error('[useSearchHistory] Failed to save history:', error)
    }
  }

  /**
   * Load settings from localStorage
   */
  const loadSettings = () => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY)
      if (stored) {
        settings.value = { ...settings.value, ...JSON.parse(stored) }
      }
    } catch (error) {
      logger.error('[useSearchHistory] Failed to load settings:', error)
    }
  }

  /**
   * Save settings to localStorage
   */
  const saveSettings = () => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings.value))
    } catch (error) {
      logger.error('[useSearchHistory] Failed to save settings:', error)
    }
  }

  // ==================== History Operations ====================

  /**
   * Add a search query to history
   */
  const addHistory = (query: string, type: SearchType, roomId?: string, resultCount?: number) => {
    // Check if this type of search should be saved
    switch (type) {
      case 'message':
        if (!settings.value.saveMessageSearch) return
        break
      case 'user':
        if (!settings.value.saveUserSearch) return
        break
      case 'room':
        if (!settings.value.saveRoomSearch) return
        break
    }

    const newItem: SearchHistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      query: query.trim(),
      type,
      timestamp: Date.now(),
      roomId,
      resultCount
    }

    // Remove duplicate queries (keep newest)
    searchHistory.value = searchHistory.value.filter((item) => item.query !== query)

    // Add new item at the beginning
    searchHistory.value.unshift(newItem)

    // Trim to max items
    if (searchHistory.value.length > settings.value.maxItems) {
      searchHistory.value = searchHistory.value.slice(0, settings.value.maxItems)
    }

    saveHistory()
    logger.info('[useSearchHistory] Added history item:', { query, type })
  }

  /**
   * Remove a history item
   */
  const removeHistory = (itemId: string) => {
    searchHistory.value = searchHistory.value.filter((item) => item.id !== itemId)
    saveHistory()
  }

  /**
   * Clear all history
   */
  const clearHistory = () => {
    searchHistory.value = []
    saveHistory()
  }

  /**
   * Clear history by type
   */
  const clearHistoryByType = (type: SearchType) => {
    searchHistory.value = searchHistory.value.filter((item) => item.type !== type)
    saveHistory()
  }

  /**
   * Clean old history items based on retention policy
   */
  const cleanOldHistory = () => {
    if (settings.value.retentionDays === 0) return // Keep forever

    const cutoffTime = Date.now() - settings.value.retentionDays * 24 * 60 * 60 * 1000
    const beforeCount = searchHistory.value.length
    searchHistory.value = searchHistory.value.filter((item) => item.timestamp >= cutoffTime)

    if (searchHistory.value.length !== beforeCount) {
      saveHistory()
      logger.info('[useSearchHistory] Cleaned old history:', {
        removed: beforeCount - searchHistory.value.length
      })
    }
  }

  // ==================== Queries ====================

  /**
   * Get history by type
   */
  const getHistoryByType = (type: SearchType): SearchHistoryItem[] => {
    if (type === 'all') {
      return searchHistory.value.sort((a, b) => b.timestamp - a.timestamp)
    }
    return searchHistory.value.filter((item) => item.type === type).sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Get recent history (limited count)
   */
  const getRecentHistory = (count: number = 10): SearchHistoryItem[] => {
    return searchHistory.value.slice(0, count)
  }

  /**
   * Search within history
   */
  const searchWithinHistory = (query: string): SearchHistoryItem[] => {
    const lowerQuery = query.toLowerCase()
    return searchHistory.value.filter((item) => item.query.toLowerCase().includes(lowerQuery))
  }

  /**
   * Get suggestions based on query
   */
  const getSuggestions = (query: string, limit: number = 5): string[] => {
    if (!query.trim()) return []

    const lowerQuery = query.toLowerCase()
    const suggestions = searchHistory.value
      .filter((item) => item.query.toLowerCase().includes(lowerQuery))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map((item) => item.query)

    return [...new Set(suggestions)] // Remove duplicates
  }

  // ==================== Settings Management ====================

  /**
   * Update settings
   */
  const updateSettings = (newSettings: Partial<SearchHistorySettings>) => {
    settings.value = { ...settings.value, ...newSettings }
    saveSettings()
    // Reapply retention policy
    loadHistory()
  }

  // ==================== Computed ====================

  const historyCount = computed(() => searchHistory.value.length)

  const messageSearchCount = computed(() => searchHistory.value.filter((item) => item.type === 'message').length)

  const userSearchCount = computed(() => searchHistory.value.filter((item) => item.type === 'user').length)

  const roomSearchCount = computed(() => searchHistory.value.filter((item) => item.type === 'room').length)

  const recentSearches = computed(() => getRecentHistory(10))

  // ==================== Initialization ====================

  // Load settings and history on first use
  if (searchHistory.value.length === 0) {
    loadSettings()
    loadHistory()
  }

  return {
    // State
    searchHistory,
    settings,

    // Computed
    historyCount,
    messageSearchCount,
    userSearchCount,
    roomSearchCount,
    recentSearches,

    // Methods
    addHistory,
    removeHistory,
    clearHistory,
    clearHistoryByType,
    cleanOldHistory,
    getHistoryByType,
    getRecentHistory,
    searchWithinHistory,
    getSuggestions,
    loadHistory,
    saveHistory,
    loadSettings,
    saveSettings,
    updateSettings
  }
}

// ==================== Utilities ====================

/**
 * Format timestamp to relative time
 */
export function formatSearchTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`

  const date = new Date(timestamp)
  return date.toLocaleDateString()
}

/**
 * Get search type label
 */
export function getSearchTypeLabel(type: SearchType): string {
  const labels: Record<SearchType, string> = {
    message: '消息',
    user: '用户',
    room: '房间',
    all: '全部'
  }
  return labels[type] || type
}
