/**
 * Matrix 增强搜索功能集成
 * 基于原有搜索功能进行扩展，提供更丰富的搜索能力
 *
 * 功能特性：
 * - 增强的房间消息搜索
 * - 高级搜索过滤器
 * - 搜索结果高亮
 * - 搜索历史记录
 * - 实时搜索建议
 * - 搜索结果分页
 */

import { matrixClientService } from './client'
import { SearchOrderBy } from 'matrix-js-sdk'
import { logger } from '@/utils/logger'

// Type definitions for Matrix SDK search API
interface SearchFilter {
  rooms?: string[]
  senders?: string[]
  types?: string[]
  not_types?: string[]
  contains_url?: boolean
  limit?: number
}

interface RoomEventsSearch {
  search_term: string
  keys?: string[]
  order_by?: SearchOrderBy
  filter: SearchFilter
}

interface SearchCategories {
  room_events: RoomEventsSearch
}

interface SearchParams {
  search_categories: SearchCategories
  include_context?: boolean
  context_before_limit?: number
  context_after_limit?: number
  next_batch?: string
}

interface SearchResultEvent {
  event_id?: string
  room_id?: string
  sender?: string
  type?: string
  content?: {
    body?: string
    name?: string
    topic?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

interface SearchResult {
  result?: SearchResultEvent
  [key: string]: unknown
}

interface SearchResponse {
  search_results?: SearchResult[]
  results?: SearchResult[]
  next_batch?: string
  [key: string]: unknown
}

interface MatrixUserLike {
  user_id: string
  display_name?: string
  avatar_url?: string
  [key: string]: unknown
}

interface MatrixRoomLike {
  roomId: string
  name?: string
  topic?: string
  getAvatarUrl?(baseUrl: string, width: number, height: number): string | undefined
  [key: string]: unknown
}

interface MatrixClientLike {
  searchRoomEvents?(params: SearchParams): Promise<SearchResponse>
  searchUserDirectory?(options: { term: string; limit?: number }): Promise<SearchUserDirectoryResponse>
  getRooms?(): MatrixRoomLike[]
  getHomeserverUrl?(): string
  [key: string]: unknown
}

interface SearchUserDirectoryResponse {
  results?: MatrixUserLike[]
  limited?: boolean
  [key: string]: unknown
}

interface SearchContext {
  events?: unknown[]
  [key: string]: unknown
}

export interface SearchOptions {
  searchTerm: string
  rooms?: string[]
  senders?: string[]
  types?: string[]
  notTypes?: string[]
  containsUrl?: boolean
  limit?: number
  includeContext?: boolean
  contextBeforeLimit?: number
  contextAfterLimit?: number
  orderBy?: SearchOrderBy
}

export interface SearchSuggestion {
  type: 'user' | 'room' | 'message' | 'tag'
  id: string
  title: string
  subtitle?: string
  avatar?: string
  highlight?: string
}

export interface SearchHistoryItem {
  query: string
  timestamp: number
  resultCount: number
  filters?: Record<string, unknown>
}

export interface EnhancedSearchResult {
  results: SearchResult[]
  totalCount: number
  hasMore: boolean
  nextBatch?: string
  highlights?: string[]
  context?: SearchContext
  searchTime: number
}

/**
 * 基础房间文本搜索（保持向后兼容）
 */
export async function searchRoomText(roomId: string, term: string): Promise<{ results: SearchResult[] }> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) return { results: [] }

  const body: SearchParams = {
    search_categories: {
      room_events: {
        search_term: term,
        filter: { rooms: [roomId] }
      }
    }
  }

  const resp = await client.searchRoomEvents?.(body)
  const results = resp?.search_results || resp?.results || []
  return { results }
}

/**
 * 增强的房间消息搜索
 */
export async function searchRoomMessagesEnhanced(
  roomId: string,
  searchTerm: string,
  options: Partial<SearchOptions> = {}
): Promise<EnhancedSearchResult> {
  const startTime = Date.now()
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) {
    return {
      results: [],
      totalCount: 0,
      hasMore: false,
      searchTime: 0
    }
  }

  try {
    const searchParams: SearchParams = {
      search_categories: {
        room_events: {
          search_term: searchTerm,
          keys: options.types || ['content.body', 'content.name'],
          order_by: options.orderBy || SearchOrderBy.Recent,
          filter: (() => {
            const f: SearchFilter = {
              rooms: [roomId],
              limit: options.limit || 50
            }
            if (options.senders !== undefined) f.senders = options.senders
            if (options.types !== undefined) f.types = options.types
            if (options.notTypes !== undefined) f.not_types = options.notTypes
            if (options.containsUrl !== undefined) f.contains_url = options.containsUrl
            return f
          })()
        }
      },
      include_context: options.includeContext || true,
      context_before_limit: options.contextBeforeLimit || 3,
      context_after_limit: options.contextAfterLimit || 3
    }

    const response = await client.searchRoomEvents?.(searchParams)
    const results = response?.search_results || response?.results || []
    const limited = results.slice(0, options.limit || 50)
    const searchTime = Date.now() - startTime

    // 生成高亮
    const highlights = generateHighlights(searchTerm, results)

    const result: EnhancedSearchResult = {
      results: limited,
      totalCount: limited.length,
      hasMore: results.length > limited.length,
      highlights,
      searchTime
    }
    if (response?.next_batch !== undefined) result.nextBatch = response.next_batch
    return result
  } catch (error) {
    logger.error('Enhanced room search failed:', error)
    return {
      results: [],
      totalCount: 0,
      hasMore: false,
      searchTime: Date.now() - startTime
    }
  }
}

/**
 * 全局消息搜索
 */
export async function searchGlobalMessages(searchTerm: string, options: SearchOptions): Promise<EnhancedSearchResult> {
  const startTime = Date.now()
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) {
    return {
      results: [],
      totalCount: 0,
      hasMore: false,
      searchTime: 0
    }
  }

  try {
    const searchParams: SearchParams = {
      search_categories: {
        room_events: {
          search_term: searchTerm,
          keys: ['content.body', 'content.name', 'content.topic'],
          order_by: options.orderBy || SearchOrderBy.Recent,
          filter: (() => {
            const f: SearchFilter = {
              limit: options.limit || 100
            }
            if (options.rooms !== undefined) f.rooms = options.rooms
            if (options.senders !== undefined) f.senders = options.senders
            f.types = options.types || ['m.room.message']
            if (options.notTypes !== undefined) f.not_types = options.notTypes
            if (options.containsUrl !== undefined) f.contains_url = options.containsUrl
            return f
          })()
        }
      },
      include_context: options.includeContext || true,
      context_before_limit: options.contextBeforeLimit || 2,
      context_after_limit: options.contextAfterLimit || 2
    }

    const response = await client.searchRoomEvents?.(searchParams)
    const results = response?.search_results || response?.results || []
    const limited = results.slice(0, options.limit || 100)
    const searchTime = Date.now() - startTime

    // 生成高亮
    const highlights = generateHighlights(searchTerm, results)

    const result: EnhancedSearchResult = {
      results: limited,
      totalCount: limited.length,
      hasMore: results.length > limited.length,
      highlights,
      searchTime
    }
    if (response?.next_batch !== undefined) result.nextBatch = response.next_batch
    return result
  } catch (error) {
    logger.error('Global search failed:', error)
    return {
      results: [],
      totalCount: 0,
      hasMore: false,
      searchTime: Date.now() - startTime
    }
  }
}

/**
 * 用户目录搜索
 */
export async function searchUsers(searchTerm: string, limit: number = 10): Promise<SearchSuggestion[]> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) return []

  try {
    const response = await client.searchUserDirectory?.({
      term: searchTerm,
      limit
    })

    const suggestions: SearchSuggestion[] = (response?.results || []).map((user: MatrixUserLike) => {
      const suggestion: SearchSuggestion = {
        type: 'user',
        id: user.user_id,
        title: user.display_name || user.user_id,
        subtitle: user.user_id
      }
      if (user.avatar_url !== undefined) suggestion.avatar = user.avatar_url
      return suggestion
    })

    return suggestions
  } catch (error) {
    logger.error('User search failed:', error)
    return []
  }
}

/**
 * 获取搜索建议
 */
export async function getSearchSuggestions(query: string, limit: number = 5): Promise<SearchSuggestion[]> {
  if (query.length < 2) return []

  const suggestions: SearchSuggestion[] = []

  // 搜索用户
  try {
    const userSuggestions = await searchUsers(query, Math.floor(limit / 3))
    suggestions.push(...userSuggestions)
  } catch (error) {
    logger.warn('User suggestions failed:', error)
  }

  // 搜索房间
  try {
    const roomSuggestions = await searchRooms(query, Math.floor(limit / 3))
    suggestions.push(...roomSuggestions)
  } catch (error) {
    logger.warn('Room suggestions failed:', error)
  }

  // 从搜索历史中获取建议
  const historySuggestions = getHistorySuggestions(query, Math.floor(limit / 3))
  suggestions.push(...historySuggestions)

  return suggestions.slice(0, limit)
}

/**
 * 搜索房间
 */
async function searchRooms(searchTerm: string, limit: number): Promise<SearchSuggestion[]> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) return []

  try {
    const rooms = client.getRooms?.() || []
    const suggestions: SearchSuggestion[] = []

    rooms
      .filter((room: MatrixRoomLike) => {
        const name = room.name || ''
        const topic = room.topic || ''
        return (
          name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          topic.toLowerCase().includes(searchTerm.toLowerCase())
        )
      })
      .slice(0, limit)
      .forEach((room: MatrixRoomLike) => {
        const suggestion: SearchSuggestion = {
          type: 'room',
          id: room.roomId,
          title: room.name || room.roomId
        }
        if (room.topic !== undefined) suggestion.subtitle = room.topic
        const avatarUrl = room.getAvatarUrl?.(client.getHomeserverUrl?.() || '', 64, 64)
        if (avatarUrl !== undefined) suggestion.avatar = avatarUrl
        suggestions.push(suggestion)
      })

    return suggestions
  } catch (error) {
    logger.error('Room search failed:', error)
    return []
  }
}

/**
 * 从搜索历史获取建议
 */
function getHistorySuggestions(query: string, limit: number): SearchSuggestion[] {
  const history = getSearchHistory()
  const suggestions: SearchSuggestion[] = []

  history
    .filter((item) => item.query.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
    .forEach((item) => {
      suggestions.push({
        type: 'tag',
        id: item.query,
        title: item.query,
        subtitle: `${item.resultCount} results`,
        highlight: highlightSearchTerms(item.query, query)
      })
    })

  return suggestions
}

/**
 * 高级搜索过滤器
 */
export async function advancedSearch(options: SearchOptions): Promise<EnhancedSearchResult> {
  const startTime = Date.now()
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) {
    return {
      results: [],
      totalCount: 0,
      hasMore: false,
      searchTime: 0
    }
  }

  try {
    const searchParams: SearchParams = {
      search_categories: {
        room_events: {
          search_term: options.searchTerm,
          keys: ['content.body', 'content.name', 'content.topic'],
          order_by: options.orderBy || SearchOrderBy.Recent,
          filter: (() => {
            const f: SearchFilter = {
              limit: options.limit || 100
            }
            if (options.rooms !== undefined) f.rooms = options.rooms
            if (options.senders !== undefined) f.senders = options.senders
            if (options.types !== undefined) f.types = options.types
            if (options.notTypes !== undefined) f.not_types = options.notTypes
            if (options.containsUrl !== undefined) f.contains_url = options.containsUrl
            return f
          })()
        }
      },
      include_context: options.includeContext || true,
      context_before_limit: options.contextBeforeLimit || 3,
      context_after_limit: options.contextAfterLimit || 3
    }

    const response = await client.searchRoomEvents?.(searchParams)
    const results = response?.search_results || response?.results || []
    const limited = results.slice(0, options.limit || 100)
    const searchTime = Date.now() - startTime

    // 生成高亮
    const highlights = generateHighlights(options.searchTerm, results)

    const result: EnhancedSearchResult = {
      results: limited,
      totalCount: limited.length,
      hasMore: results.length > limited.length,
      highlights,
      searchTime
    }
    if (response?.next_batch !== undefined) result.nextBatch = response.next_batch
    return result
  } catch (error) {
    logger.error('Advanced search failed:', error)
    return {
      results: [],
      totalCount: 0,
      hasMore: false,
      searchTime: Date.now() - startTime
    }
  }
}

export async function searchNextBatchAdvanced(
  nextBatch: string,
  options: SearchOptions
): Promise<EnhancedSearchResult> {
  const startTime = Date.now()
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) {
    return {
      results: [],
      totalCount: 0,
      hasMore: false,
      searchTime: 0
    }
  }

  try {
    const searchParams: SearchParams = {
      search_categories: {
        room_events: {
          search_term: options.searchTerm,
          keys: ['content.body', 'content.name', 'content.topic'],
          order_by: options.orderBy || SearchOrderBy.Recent,
          filter: (() => {
            const f: SearchFilter = {
              limit: options.limit || 100
            }
            if (options.rooms !== undefined) f.rooms = options.rooms
            if (options.senders !== undefined) f.senders = options.senders
            if (options.types !== undefined) f.types = options.types
            if (options.notTypes !== undefined) f.not_types = options.notTypes
            if (options.containsUrl !== undefined) f.contains_url = options.containsUrl
            return f
          })()
        }
      },
      next_batch: nextBatch,
      include_context: options.includeContext || true,
      context_before_limit: options.contextBeforeLimit || 3,
      context_after_limit: options.contextAfterLimit || 3
    }

    const response = await client.searchRoomEvents?.(searchParams)
    const results = response?.search_results || response?.results || []
    const limited = results.slice(0, options.limit || 100)
    const searchTime = Date.now() - startTime

    const highlights = generateHighlights(options.searchTerm, results)

    const result: EnhancedSearchResult = {
      results: limited,
      totalCount: limited.length,
      hasMore: results.length > limited.length,
      highlights,
      searchTime
    }
    if (response?.next_batch !== undefined) result.nextBatch = response.next_batch
    return result
  } catch (error) {
    logger.error('Advanced next batch search failed:', error)
    return {
      results: [],
      totalCount: 0,
      hasMore: false,
      searchTime: Date.now() - startTime
    }
  }
}

export async function searchNextBatchRoom(
  roomId: string,
  nextBatch: string,
  options: SearchOptions
): Promise<EnhancedSearchResult> {
  const startTime = Date.now()
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) {
    return {
      results: [],
      totalCount: 0,
      hasMore: false,
      searchTime: 0
    }
  }

  try {
    const searchParams: SearchParams = {
      search_categories: {
        room_events: {
          search_term: options.searchTerm,
          keys: ['content.body', 'content.name', 'content.topic'],
          order_by: options.orderBy || SearchOrderBy.Recent,
          filter: (() => {
            const f: SearchFilter = {
              rooms: [roomId],
              limit: options.limit || 50
            }
            if (options.senders !== undefined) f.senders = options.senders
            if (options.types !== undefined) f.types = options.types
            if (options.notTypes !== undefined) f.not_types = options.notTypes
            if (options.containsUrl !== undefined) f.contains_url = options.containsUrl
            return f
          })()
        }
      },
      next_batch: nextBatch,
      include_context: options.includeContext || true,
      context_before_limit: options.contextBeforeLimit || 3,
      context_after_limit: options.contextAfterLimit || 3
    }

    const response = await client.searchRoomEvents?.(searchParams)
    const results = response?.search_results || response?.results || []
    const limited = results.slice(0, options.limit || 50)
    const searchTime = Date.now() - startTime

    const highlights = generateHighlights(options.searchTerm, results)

    const result: EnhancedSearchResult = {
      results: limited,
      totalCount: limited.length,
      hasMore: results.length > limited.length,
      highlights,
      searchTime
    }
    if (response?.next_batch !== undefined) result.nextBatch = response.next_batch
    return result
  } catch (error) {
    logger.error('Room next batch search failed:', error)
    return {
      results: [],
      totalCount: 0,
      hasMore: false,
      searchTime: Date.now() - startTime
    }
  }
}

export async function searchNextBatchGlobal(nextBatch: string, options: SearchOptions): Promise<EnhancedSearchResult> {
  const startTime = Date.now()
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) {
    return {
      results: [],
      totalCount: 0,
      hasMore: false,
      searchTime: 0
    }
  }

  try {
    const searchParams: SearchParams = {
      search_categories: {
        room_events: {
          search_term: options.searchTerm,
          keys: ['content.body', 'content.name', 'content.topic'],
          order_by: options.orderBy || SearchOrderBy.Recent,
          filter: (() => {
            const f: SearchFilter = {
              limit: options.limit || 100
            }
            if (options.rooms !== undefined) f.rooms = options.rooms
            if (options.senders !== undefined) f.senders = options.senders
            f.types = options.types || ['m.room.message']
            if (options.notTypes !== undefined) f.not_types = options.notTypes
            if (options.containsUrl !== undefined) f.contains_url = options.containsUrl
            return f
          })()
        }
      },
      next_batch: nextBatch,
      include_context: options.includeContext || true,
      context_before_limit: options.contextBeforeLimit || 2,
      context_after_limit: options.contextAfterLimit || 2
    }

    const response = await client.searchRoomEvents?.(searchParams)
    const results = response?.search_results || response?.results || []
    const limited = results.slice(0, options.limit || 100)
    const searchTime = Date.now() - startTime

    const highlights = generateHighlights(options.searchTerm, results)

    const result: EnhancedSearchResult = {
      results: limited,
      totalCount: limited.length,
      hasMore: results.length > limited.length,
      highlights,
      searchTime
    }
    if (response?.next_batch !== undefined) result.nextBatch = response.next_batch
    return result
  } catch (error) {
    logger.error('Global next batch search failed:', error)
    return {
      results: [],
      totalCount: 0,
      hasMore: false,
      searchTime: Date.now() - startTime
    }
  }
}

/**
 * 获取搜索历史
 */
export function getSearchHistory(limit: number = 20): SearchHistoryItem[] {
  try {
    const saved = localStorage.getItem('matrix_search_history')
    const history: SearchHistoryItem[] = saved ? JSON.parse(saved) : []
    return history.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit)
  } catch (error) {
    logger.warn('Failed to load search history:', error)
    return []
  }
}

/**
 * 添加搜索历史
 */
export function addToSearchHistory(query: string, resultCount: number, filters?: Record<string, unknown>): void {
  try {
    const history = getSearchHistory(50) // 获取更多历史记录

    // 移除相同的查询
    const filteredHistory = history.filter((item) => item.query !== query)

    // 添加新查询到开头
    const historyItem: SearchHistoryItem = {
      query,
      timestamp: Date.now(),
      resultCount
    }
    if (filters !== undefined) historyItem.filters = filters
    filteredHistory.unshift(historyItem)

    // 限制历史记录数量
    const limitedHistory = filteredHistory.slice(0, 50)

    localStorage.setItem('matrix_search_history', JSON.stringify(limitedHistory))
  } catch (error) {
    logger.warn('Failed to save search history:', error)
  }
}

/**
 * 清空搜索历史
 */
export function clearSearchHistory(): void {
  try {
    localStorage.removeItem('matrix_search_history')
  } catch (error) {
    logger.warn('Failed to clear search history:', error)
  }
}

/**
 * 高亮搜索关键词
 */
export function highlightSearchTerms(text: string, query: string): string {
  if (!text || !query) return text

  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

/**
 * 生成搜索高亮
 */
function generateHighlights(searchTerm: string, results: SearchResult[]): string[] {
  const highlights: string[] = []

  results.forEach((result: SearchResult) => {
    const content = result.result?.content
    if (content?.body) {
      const highlighted = highlightSearchTerms(content.body, searchTerm)
      if (highlighted.includes('<mark>')) {
        highlights.push(highlighted)
      }
    }
  })

  return highlights.slice(0, 5) // 只返回前5个高亮结果
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 搜索统计
 */
export function getSearchStats(results: SearchResult[], searchTime: number) {
  const roomResults: { [roomId: string]: number } = {}
  const senderResults: { [senderId: string]: number } = {}
  const typeResults: { [type: string]: number } = {}

  results.forEach((result: SearchResult) => {
    const event = result.result

    if (!event) return

    // 统计房间结果
    const roomId = event.room_id
    if (roomId) {
      roomResults[roomId] = (roomResults[roomId] || 0) + 1
    }

    // 统计发送者结果
    const senderId = event.sender
    if (senderId) {
      senderResults[senderId] = (senderResults[senderId] || 0) + 1
    }

    // 统计类型结果
    const type = event.type
    if (type) {
      typeResults[type] = (typeResults[type] || 0) + 1
    }
  })

  return {
    totalResults: results.length,
    roomResults,
    senderResults,
    typeResults,
    searchTime,
    averageTimePerResult: results.length > 0 ? searchTime / results.length : 0
  }
}
