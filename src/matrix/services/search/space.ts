/**
 * Matrix Space Search Service
 *
 * Provides advanced search functionality for Matrix Spaces
 * Migrated from src/services/spaceSearchService.ts
 */

import { ref, computed } from 'vue'
import { createLogger } from '@/utils/logger'
import { matrixSpacesService } from '@/services/matrixSpacesService'
import type { SpaceInfo } from '@/services/matrixSpacesService'

const logger = createLogger('SpaceSearch')

interface SearchFilters {
  visibility: 'all' | 'public' | 'private'
  encrypted: 'all' | 'encrypted' | 'unencrypted'
  memberCount: [number, number] | null
  joined: 'all' | 'joined' | 'unjoined'
}

interface SearchOptions {
  limit?: number
  fuzzy?: boolean
  filters?: SearchFilters
}

interface SearchResult extends SpaceInfo {
  score: number
  matchReasons: string[]
}

interface SearchSuggestion {
  text: string
  type: 'name' | 'topic' | 'alias' | 'history'
  count: number
}

// Search history
const searchHistory = ref<string[]>([])
const MAX_HISTORY = 10

// Search cache for performance
const searchCache = new Map<string, { results: SearchResult[]; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        )
      }
    }
  }

  return dp[m][n]
}

/**
 * Calculate search relevance score
 */
function calculateScore(space: SpaceInfo, query: string): { score: number; reasons: string[] } {
  const lowerQuery = query.toLowerCase()
  let score = 0
  const reasons: string[] = []

  // Exact name match (highest score)
  if (space.name?.toLowerCase() === lowerQuery) {
    score += 100
    reasons.push('完全匹配名称')
  }
  // Name starts with query
  else if (space.name?.toLowerCase().startsWith(lowerQuery)) {
    score += 80
    reasons.push('名称开头匹配')
  }
  // Name contains query
  else if (space.name?.toLowerCase().includes(lowerQuery)) {
    score += 60
    reasons.push('名称包含')
  }
  // Fuzzy name match
  else if (space.name) {
    const distance = levenshteinDistance(space.name.toLowerCase(), lowerQuery)
    const threshold = Math.max(3, Math.floor(space.name.length * 0.3))
    if (distance <= threshold) {
      score += Math.max(10, 50 - distance * 5)
      reasons.push('相似名称')
    }
  }

  // Topic match
  if (space.topic?.toLowerCase().includes(lowerQuery)) {
    score += 40
    reasons.push('描述匹配')
  }

  // Alias match (not in SpaceInfo, skip for now)
  // if (space.canonicalAlias?.toLowerCase().includes(lowerQuery)) {
  //   score += 30
  //   reasons.push('地址匹配')
  // }

  // Room ID match (low score)
  if (space.roomId?.toLowerCase().includes(lowerQuery)) {
    score += 10
    reasons.push('ID匹配')
  }

  // Boost for joined spaces (not in SpaceInfo, skip for now)
  // if (space.joined) {
  //   score += 5
  // }

  // Boost for spaces with recent activity
  if (space.lastActivity) {
    const daysSinceActivity = (Date.now() - space.lastActivity) / (1000 * 60 * 60 * 24)
    if (daysSinceActivity < 1) score += 3
    else if (daysSinceActivity < 7) score += 2
    else if (daysSinceActivity < 30) score += 1
  }

  // Boost for public spaces
  if (space.joinRule === 'public') {
    score += 2
  }

  return { score, reasons }
}

/**
 * Apply filters to search results
 */
function applyFilters(spaces: SpaceInfo[], filters: SearchFilters): SpaceInfo[] {
  return spaces.filter((space) => {
    // Visibility filter
    if (filters.visibility !== 'all') {
      if (filters.visibility === 'public' && space.joinRule !== 'public') return false
      if (filters.visibility === 'private' && space.joinRule === 'public') return false
    }

    // Encrypted filter
    if (filters.encrypted !== 'all') {
      const isEncrypted = space.encrypted === true
      if (filters.encrypted === 'encrypted' && !isEncrypted) return false
      if (filters.encrypted === 'unencrypted' && isEncrypted) return false
    }

    // Member count filter
    if (filters.memberCount) {
      const [min, max] = filters.memberCount
      const count = space.memberCount ?? 0
      if (count < min || count > max) return false
    }

    // Joined filter (not supported in SpaceInfo, skip for now)
    // if (filters.joined !== 'all') {
    //   if (filters.joined === 'joined' && !space.joined) return false
    //   if (filters.joined === 'unjoined' && space.joined) return false
    // }

    return true
  })
}

/**
 * Enhanced space search
 */
export async function searchSpaces(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const startTime = performance.now()
  const { limit = 50, filters } = options

  // Empty query returns empty results
  if (!query.trim()) {
    return []
  }

  // Check cache
  const cacheKey = JSON.stringify({ query, options })
  const cached = searchCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug('[SpaceSearch] Cache hit for:', query)
    return cached.results
  }

  try {
    // Get all spaces
    const allSpaces = await matrixSpacesService.searchSpaces('')

    // Apply filters first
    const filteredSpaces = filters ? applyFilters(allSpaces, filters) : allSpaces

    // Calculate scores
    const results: SearchResult[] = []
    for (const space of filteredSpaces) {
      const { score, reasons } = calculateScore(space, query)

      // Only include results with meaningful matches
      if (score > 0) {
        results.push({
          ...space,
          score,
          matchReasons: reasons
        })
      }
    }

    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score)

    // Apply limit
    const limited = results.slice(0, limit)

    // Add to search history
    addToHistory(query)

    // Cache results
    searchCache.set(cacheKey, {
      results: limited,
      timestamp: Date.now()
    })

    // Clean old cache entries
    cleanCache()

    const duration = performance.now() - startTime
    logger.info('[SpaceSearch] Search completed:', {
      query,
      results: limited.length,
      duration: `${duration.toFixed(2)}ms`
    })

    return limited
  } catch (error) {
    logger.error('[SpaceSearch] Search failed:', error as Error)
    return []
  }
}

/**
 * Get search suggestions
 */
export async function getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
  const suggestions: SearchSuggestion[] = []
  const lowerQuery = query.toLowerCase()

  if (!query.trim()) {
    // Return recent history
    return searchHistory.value.slice(0, 5).map((text) => ({
      text,
      type: 'history' as const,
      count: 1
    }))
  }

  try {
    const allSpaces = await matrixSpacesService.searchSpaces('')

    // Name suggestions
    const nameMatches = allSpaces
      .filter((s) => s.name?.toLowerCase().includes(lowerQuery))
      .slice(0, 3)
      .map((s) => ({
        text: s.name || '',
        type: 'name' as const,
        count: 1
      }))
    suggestions.push(...nameMatches)

    // Check if already in suggestions to avoid duplicates
    const seen = new Set(nameMatches.map((s) => s.text.toLowerCase()))

    // Topic suggestions
    for (const space of allSpaces) {
      if (space.topic && space.topic.toLowerCase().includes(lowerQuery)) {
        const suggestion = {
          text: space.topic,
          type: 'topic' as const,
          count: 1
        }
        if (!seen.has(suggestion.text.toLowerCase())) {
          suggestions.push(suggestion)
          seen.add(suggestion.text.toLowerCase())
          if (suggestions.length >= 6) break
        }
      }
    }

    // Alias suggestions (not supported in SpaceInfo)
    // for (const space of allSpaces) {
    //   if (space.canonicalAlias && space.canonicalAlias.toLowerCase().includes(lowerQuery)) {
    //     const suggestion = {
    //       text: space.canonicalAlias,
    //       type: 'alias' as const,
    //       count: 1
    //     }
    //     if (!seen.has(suggestion.text.toLowerCase())) {
    //       suggestions.push(suggestion)
    //       seen.add(suggestion.text.toLowerCase())
    //       if (suggestions.length >= 8) break
    //     }
    //   }
    // }

    return suggestions.slice(0, 8)
  } catch (error) {
    logger.error('[SpaceSearch] Failed to get suggestions:', error as Error)
    return []
  }
}

/**
 * Add query to search history
 */
function addToHistory(query: string): void {
  const trimmed = query.trim()
  if (!trimmed) return

  // Remove if already exists
  const index = searchHistory.value.indexOf(trimmed)
  if (index >= 0) {
    searchHistory.value.splice(index, 1)
  }

  // Add to front
  searchHistory.value.unshift(trimmed)

  // Limit history size
  searchHistory.value = searchHistory.value.slice(0, MAX_HISTORY)

  // Persist to localStorage
  try {
    localStorage.setItem('space-search-history', JSON.stringify(searchHistory.value))
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Load search history from localStorage
 */
export function loadSearchHistory(): string[] {
  try {
    const stored = localStorage.getItem('space-search-history')
    if (stored) {
      searchHistory.value = JSON.parse(stored)
    }
  } catch {
    // Ignore errors
  }
  return searchHistory.value
}

/**
 * Clear search history
 */
export function clearSearchHistory(): void {
  searchHistory.value = []
  try {
    localStorage.removeItem('space-search-history')
  } catch {
    // Ignore errors
  }
}

/**
 * Remove specific item from history
 */
export function removeFromHistory(query: string): void {
  const index = searchHistory.value.indexOf(query)
  if (index >= 0) {
    searchHistory.value.splice(index, 1)
    try {
      localStorage.setItem('space-search-history', JSON.stringify(searchHistory.value))
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Clean old cache entries
 */
function cleanCache(): void {
  const now = Date.now()
  for (const [key, value] of searchCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      searchCache.delete(key)
    }
  }
}

/**
 * Clear search cache
 */
export function clearSearchCache(): void {
  searchCache.clear()
}

/**
 * Get popular search terms
 */
export function getPopularSearchTerms(): string[] {
  // This could be enhanced with actual analytics
  return searchHistory.value.slice(0, 5)
}

/**
 * Create a debounced search function
 */
export function createDebouncedSearch(delay: number = 300) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (query: string, options: SearchOptions, callback: (results: SearchResult[]) => void) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(async () => {
      const results = await searchSpaces(query, options)
      callback(results)
    }, delay)
  }
}

// Export search history for reactive access
export function useSearchHistory() {
  return {
    history: computed(() => searchHistory.value),
    addToHistory,
    removeFromHistory,
    clearHistory: clearSearchHistory,
    loadHistory: loadSearchHistory
  }
}
