/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSearchHistory, formatSearchTime, getSearchTypeLabel } from '@/composables/useSearchHistory'

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}))

describe('useSearchHistory', () => {
  // Create localStorage mock once
  const localStorageMock = {
    store: {} as Record<string, string>,
    getItem: (key: string) => localStorageMock.store[key] || null,
    setItem: (key: string, value: string) => {
      localStorageMock.store[key] = value
    },
    clear: () => {
      localStorageMock.store = {}
    },
    removeItem: (key: string) => {
      delete localStorageMock.store[key]
    },
    get length() {
      return Object.keys(localStorageMock.store).length
    },
    key: (index: number) => Object.keys(localStorageMock.store)[index] || null
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset localStorage
    localStorageMock.clear()
    // Set up global localStorage mock
    vi.stubGlobal('localStorage', localStorageMock)
    // Clear the module-level state using the composable's clearHistory method
    const { clearHistory, updateSettings } = useSearchHistory()
    clearHistory()
    updateSettings({
      maxItems: 50,
      retentionDays: 30,
      saveMessageSearch: true,
      saveUserSearch: true,
      saveRoomSearch: true
    })
  })

  describe('Initialization', () => {
    it('should initialize with default settings', () => {
      const { settings } = useSearchHistory()

      expect(settings.value.maxItems).toBe(50)
      expect(settings.value.retentionDays).toBe(30)
      expect(settings.value.saveMessageSearch).toBe(true)
      expect(settings.value.saveUserSearch).toBe(true)
      expect(settings.value.saveRoomSearch).toBe(true)
    })

    it('should initialize with empty history', () => {
      const { searchHistory, historyCount } = useSearchHistory()

      expect(searchHistory.value).toEqual([])
      expect(historyCount.value).toBe(0)
    })
  })

  describe('Adding history items', () => {
    it('should add a message search to history', () => {
      const { addHistory, searchHistory, historyCount } = useSearchHistory()

      addHistory('test query', 'message')

      expect(historyCount.value).toBe(1)
      expect(searchHistory.value[0].query).toBe('test query')
      expect(searchHistory.value[0].type).toBe('message')
    })

    it('should add a user search to history', () => {
      const { addHistory, searchHistory } = useSearchHistory()

      addHistory('john', 'user')

      expect(searchHistory.value[0].query).toBe('john')
      expect(searchHistory.value[0].type).toBe('user')
    })

    it('should add a room search to history', () => {
      const { addHistory, searchHistory } = useSearchHistory()

      addHistory('general', 'room')

      expect(searchHistory.value[0].query).toBe('general')
      expect(searchHistory.value[0].type).toBe('room')
    })

    it('should trim whitespace from queries', () => {
      const { addHistory, searchHistory } = useSearchHistory()

      addHistory('  test query  ', 'message')

      expect(searchHistory.value[0].query).toBe('test query')
    })

    it('should include roomId when provided', () => {
      const { addHistory, searchHistory } = useSearchHistory()

      addHistory('test', 'message', '!room:matrix.org')

      expect(searchHistory.value[0].roomId).toBe('!room:matrix.org')
    })

    it('should include resultCount when provided', () => {
      const { addHistory, searchHistory } = useSearchHistory()

      addHistory('test', 'message', undefined, 42)

      expect(searchHistory.value[0].resultCount).toBe(42)
    })

    it('should remove duplicate queries', () => {
      const { addHistory, searchHistory } = useSearchHistory()

      addHistory('test', 'message')
      addHistory('other', 'message')
      addHistory('test', 'message')

      expect(searchHistory.value.length).toBe(2)
      expect(searchHistory.value[0].query).toBe('test')
    })

    it('should respect maxItems limit', () => {
      const { updateSettings, addHistory, searchHistory } = useSearchHistory()

      updateSettings({ maxItems: 3 })

      addHistory('query1', 'message')
      addHistory('query2', 'message')
      addHistory('query3', 'message')
      addHistory('query4', 'message')

      expect(searchHistory.value.length).toBe(3)
      expect(searchHistory.value.map((i) => i.query)).toEqual(['query4', 'query3', 'query2'])
    })

    it('should not add history when saveMessageSearch is false', () => {
      const { updateSettings, addHistory, searchHistory } = useSearchHistory()

      updateSettings({ saveMessageSearch: false })
      addHistory('test', 'message')

      expect(searchHistory.value.length).toBe(0)
    })

    it('should not add history when saveUserSearch is false', () => {
      const { updateSettings, addHistory, searchHistory } = useSearchHistory()

      updateSettings({ saveUserSearch: false })
      addHistory('john', 'user')

      expect(searchHistory.value.length).toBe(0)
    })

    it('should not add history when saveRoomSearch is false', () => {
      const { updateSettings, addHistory, searchHistory } = useSearchHistory()

      updateSettings({ saveRoomSearch: false })
      addHistory('general', 'room')

      expect(searchHistory.value.length).toBe(0)
    })
  })

  describe('Removing history items', () => {
    it('should remove a specific history item by id', () => {
      const { addHistory, removeHistory, searchHistory } = useSearchHistory()

      addHistory('query1', 'message')
      addHistory('query2', 'message')
      const itemId = searchHistory.value[1].id // Remove the older item (query1)

      removeHistory(itemId)

      expect(searchHistory.value.length).toBe(1)
      expect(searchHistory.value[0].query).toBe('query2') // Most recent remains
    })

    it('should clear all history', () => {
      const { addHistory, clearHistory, searchHistory } = useSearchHistory()

      addHistory('query1', 'message')
      addHistory('query2', 'message')
      clearHistory()

      expect(searchHistory.value.length).toBe(0)
    })

    it('should clear history by type', () => {
      const { addHistory, clearHistoryByType, searchHistory } = useSearchHistory()

      addHistory('msg1', 'message')
      addHistory('msg2', 'message')
      addHistory('user1', 'user')
      addHistory('room1', 'room')

      clearHistoryByType('message')

      expect(searchHistory.value.length).toBe(2)
      expect(searchHistory.value.every((item) => item.type !== 'message')).toBe(true)
    })
  })

  describe('Cleaning old history', () => {
    it('should remove items older than retention period', () => {
      vi.useFakeTimers()
      const { addHistory, cleanOldHistory, searchHistory } = useSearchHistory()

      vi.setSystemTime(new Date('2024-01-01'))
      addHistory('old', 'message')

      vi.setSystemTime(new Date('2024-02-01'))
      addHistory('new', 'message')

      const { updateSettings } = useSearchHistory()
      updateSettings({ retentionDays: 15 })
      cleanOldHistory()

      expect(searchHistory.value.length).toBe(1)
      expect(searchHistory.value[0].query).toBe('new')

      vi.useRealTimers()
    })

    it('should keep all items when retention is 0', () => {
      vi.useFakeTimers()
      const { addHistory, cleanOldHistory, searchHistory, updateSettings } = useSearchHistory()

      vi.setSystemTime(new Date('2024-01-01'))
      addHistory('old', 'message')

      vi.setSystemTime(new Date('2024-02-01'))
      updateSettings({ retentionDays: 0 })
      cleanOldHistory()

      expect(searchHistory.value.length).toBe(1)

      vi.useRealTimers()
    })
  })

  describe('Querying history', () => {
    beforeEach(() => {
      const { addHistory } = useSearchHistory()
      addHistory('apple', 'message')
      addHistory('banana', 'message')
      addHistory('app', 'user')
      addHistory('orange', 'room')
    })

    it('should get history by type', () => {
      const { getHistoryByType } = useSearchHistory()

      const messageHistory = getHistoryByType('message')
      expect(messageHistory.length).toBe(2)
      expect(messageHistory.every((item) => item.type === 'message')).toBe(true)
    })

    it('should get all history when type is "all"', () => {
      const { getHistoryByType } = useSearchHistory()

      const allHistory = getHistoryByType('all')
      expect(allHistory.length).toBe(4)
    })

    it('should get recent history with limit', () => {
      const { getRecentHistory } = useSearchHistory()

      const recent = getRecentHistory(2)
      expect(recent.length).toBe(2)
    })

    it('should search within history', () => {
      const { searchWithinHistory } = useSearchHistory()

      const results = searchWithinHistory('app')
      expect(results.length).toBe(2)
      expect(results.every((item) => item.query.includes('app'))).toBe(true)
    })

    it('should get suggestions based on query', () => {
      const { getSuggestions } = useSearchHistory()

      const suggestions = getSuggestions('app')
      expect(suggestions).toEqual(expect.arrayContaining(['app', 'apple']))
    })

    it('should return empty suggestions for empty query', () => {
      const { getSuggestions } = useSearchHistory()

      const suggestions = getSuggestions('   ')
      expect(suggestions).toEqual([])
    })

    it('should limit suggestions', () => {
      const { getSuggestions } = useSearchHistory()

      const suggestions = getSuggestions('', 2)
      expect(suggestions.length).toBeLessThanOrEqual(2)
    })
  })

  describe('Computed properties', () => {
    beforeEach(() => {
      const { addHistory } = useSearchHistory()
      addHistory('msg1', 'message')
      addHistory('msg2', 'message')
      addHistory('user1', 'user')
      addHistory('room1', 'room')
    })

    it('should count total history', () => {
      const { historyCount } = useSearchHistory()
      expect(historyCount.value).toBe(4)
    })

    it('should count message searches', () => {
      const { messageSearchCount } = useSearchHistory()
      expect(messageSearchCount.value).toBe(2)
    })

    it('should count user searches', () => {
      const { userSearchCount } = useSearchHistory()
      expect(userSearchCount.value).toBe(1)
    })

    it('should count room searches', () => {
      const { roomSearchCount } = useSearchHistory()
      expect(roomSearchCount.value).toBe(1)
    })

    it('should return recent searches', () => {
      const { recentSearches } = useSearchHistory()
      expect(recentSearches.value.length).toBe(4)
    })
  })

  describe('Settings management', () => {
    it('should update settings', () => {
      const { updateSettings, settings } = useSearchHistory()

      // Get current values
      const _originalMax = settings.value.maxItems
      const _originalRetention = settings.value.retentionDays

      // Update with different values
      updateSettings({ maxItems: 100, retentionDays: 60 })

      // Check that settings were updated
      expect(settings.value.maxItems).toBe(100)
      expect(settings.value.retentionDays).toBe(60)
    })
  })

  describe('Error handling', () => {
    it('should handle localStorage errors when saving', () => {
      const { addHistory } = useSearchHistory()
      const localStorage = globalThis.localStorage as any
      const originalSetItem = localStorage.setItem
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage full')
      })

      // Should not throw
      expect(() => addHistory('test', 'message')).not.toThrow()

      localStorage.setItem = originalSetItem
    })
  })
})

describe('formatSearchTime', () => {
  it('should return "刚刚" for very recent times', () => {
    const now = Date.now()
    expect(formatSearchTime(now)).toBe('刚刚')
  })

  it('should return minutes ago', () => {
    const time = Date.now() - 30 * 60000
    expect(formatSearchTime(time)).toBe('30分钟前')
  })

  it('should return hours ago', () => {
    const time = Date.now() - 5 * 3600000
    expect(formatSearchTime(time)).toBe('5小时前')
  })

  it('should return days ago for recent days', () => {
    const time = Date.now() - 3 * 86400000
    expect(formatSearchTime(time)).toBe('3天前')
  })

  it('should return date string for older times', () => {
    const time = Date.now() - 10 * 86400000
    const result = formatSearchTime(time)
    // Should be a date string
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{2,4}/)
  })
})

describe('getSearchTypeLabel', () => {
  it('should return correct label for message type', () => {
    expect(getSearchTypeLabel('message')).toBe('消息')
  })

  it('should return correct label for user type', () => {
    expect(getSearchTypeLabel('user')).toBe('用户')
  })

  it('should return correct label for room type', () => {
    expect(getSearchTypeLabel('room')).toBe('房间')
  })

  it('should return correct label for all type', () => {
    expect(getSearchTypeLabel('all')).toBe('全部')
  })
})
