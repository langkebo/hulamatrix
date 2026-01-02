/**
 * Matrix Search Service
 * Handles message search, room search, and user search in Matrix
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { matrixRoomManager } from './matrixRoomManager'
import { matrixSpacesService } from './matrixSpacesService'
import { logger } from '@/utils/logger'
import { parseMatrixEvent } from '@/utils/messageUtils'
import type { MatrixEvent as SDKMatrixEvent, MatrixMember } from '@/types/matrix'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Unified Matrix Event type that handles both SDK events and raw event objects
 */
export type MatrixEvent = SDKMatrixEvent | RawMatrixEvent

/**
 * Raw Matrix Event (plain object representation)
 */
export interface RawMatrixEvent {
  event_id?: string
  room_id?: string
  sender?: string
  origin_server_ts?: number
  content?: {
    algorithm?: string
    ciphertext?: string
    body?: string
    msgtype?: string
    [key: string]: unknown
  }
  type?: string
  // Methods that might be available on SDK events
  getType?: () => string
  getContent?: () => Record<string, unknown>
  getRoomId?: () => string
  getSender?: () => string
  getId?: () => string
  getTs?: () => number
  [key: string]: unknown
}

/**
 * Matrix SDK Search Request Body
 */
export interface MatrixSearchRequestBody {
  search_term: string
  order_by?: 'recent' | 'rank'
  limit?: number
  event_context?: number
  filter?: {
    rooms?: string[]
    senders?: string[]
    types?: string[]
    before?: number
    after?: number
    lazy_load_members?: boolean
  }
}

/**
 * Matrix SDK Search Response
 */
export interface MatrixSearchResponse {
  search_categories?: {
    room_events?: MatrixRoomEventsSearchResponse
  }
  room_events?: MatrixRoomEventsSearchResponse
}

/**
 * Matrix Room Events Search Response
 */
export interface MatrixRoomEventsSearchResponse {
  count?: number
  next_batch?: string
  results?: MatrixSearchResultItem[]
  highlights?: string[]
}

/**
 * Matrix Search Result Item
 */
export interface MatrixSearchResultItem {
  result: RawMatrixEvent | SDKMatrixEvent
  rank?: number
  highlights?: string[]
  context?: {
    events_before?: RawMatrixEvent[] | SDKMatrixEvent[]
    events_after?: RawMatrixEvent[] | SDKMatrixEvent[]
  }
}

/**
 * User Directory Search Response
 */
export interface UserDirectorySearchResponse {
  results: UserDirectoryItem[]
  limited?: boolean
}

/**
 * User Directory Item
 */
export interface UserDirectoryItem {
  user_id: string
  display_name?: string
  avatar_url?: string
}

/**
 * Extended Room Summary with member counts
 */
export interface ExtendedRoomSummary {
  roomId: string
  name?: string
  topic?: string
  avatar?: string
  aliases?: string[]
  joinedMemberCount?: number
  invitedMemberCount?: number
  memberCount?: number
}

/**
 * Room-like object for scoring
 */
export interface RoomLike {
  name?: string
  topic?: string
  aliases?: string[]
  roomId?: string
  memberCount?: number
}

/**
 * User-like object for scoring
 */
export interface UserLike {
  user_id?: string
  display_name?: string
  userId?: string
  displayName?: string
}

/**
 * Extended Matrix Client with search methods
 */
export interface MatrixClientExtended {
  search?: (options: {
    body: { search_categories: { room_events: MatrixSearchRequestBody } }
  }) => Promise<MatrixSearchResponse>
  searchUserDirectory?: (options: { limit: number; term: string }) => Promise<UserDirectorySearchResponse>
  getRoom?: (roomId: string) => ExtendedRoomLike | undefined
  getRooms?: () => ExtendedRoomLike[]
  getUserId?: () => string
  baseUrl?: string
}

/**
 * Extended Room object for local search
 */
export interface ExtendedRoomLike {
  roomId: string
  name?: string
  timeline?: {
    getEvents?: () => (SDKMatrixEvent | RawMatrixEvent)[]
  }
  getLiveTimeline?: () => { getEvents?: () => (SDKMatrixEvent | RawMatrixEvent)[] }
  getMember?: (userId: string) => MatrixMember | null
  getAvatarUrl?: (
    baseUrl: string,
    width: number,
    height: number,
    resizeMethod: string,
    allowDefault: boolean,
    allowDirectMedia: boolean
  ) => string | undefined
}

/**
 * Helper function to safely get event type
 */
function getEventType(event: SDKMatrixEvent | RawMatrixEvent): string | undefined {
  // Try RawMatrixEvent first (which has optional method and property)
  const raw = event as RawMatrixEvent
  if (raw.getType) return raw.getType()
  if (raw.type) return raw.type

  // Try SDKMatrixEvent - it has getType as a method
  const sdk = event as { getType?: () => string }
  if (sdk.getType) return sdk.getType()

  return undefined
}

/**
 * Helper function to safely get event sender
 */
function getEventSender(event: SDKMatrixEvent | RawMatrixEvent): string {
  // Try RawMatrixEvent first
  const raw = event as RawMatrixEvent
  if (raw.getSender) {
    const result = raw.getSender()
    if (typeof result === 'string') return result
  }
  if (typeof raw.sender === 'string') return raw.sender

  // Try SDKMatrixEvent
  const sdk = event as { getSender?: () => string; sender?: string }
  if (sdk.getSender) return sdk.getSender()
  if (typeof sdk.sender === 'string') return sdk.sender

  return ''
}

/**
 * Helper function to safely get event content
 */
function getEventContent(event: SDKMatrixEvent | RawMatrixEvent): Record<string, unknown> {
  // Try RawMatrixEvent first
  const raw = event as RawMatrixEvent
  if (raw.getContent) return raw.getContent()
  if (raw.content) return raw.content

  // Try SDKMatrixEvent
  const sdk = event as { getContent?: () => Record<string, unknown>; content?: Record<string, unknown> }
  if (sdk.getContent) return sdk.getContent()
  if (sdk.content) return sdk.content

  return {}
}

/**
 * Helper function to safely get event ID
 */
function getEventId(event: SDKMatrixEvent | RawMatrixEvent): string {
  // Try RawMatrixEvent first
  const raw = event as RawMatrixEvent
  if (raw.getId) return raw.getId()
  if (raw.event_id) return raw.event_id

  // Try SDKMatrixEvent
  const sdk = event as { getId?: () => string; event_id?: string }
  if (sdk.getId) return sdk.getId()
  if (sdk.event_id) return sdk.event_id

  return `${Date.now()}`
}

/**
 * Helper function to safely get event timestamp
 */
function getEventTimestamp(event: SDKMatrixEvent | RawMatrixEvent): number {
  // Try RawMatrixEvent first
  const raw = event as RawMatrixEvent
  if (raw.getTs) return raw.getTs()
  if (raw.origin_server_ts) return raw.origin_server_ts

  // Try SDKMatrixEvent
  const sdk = event as { getTs?: () => number; origin_server_ts?: number }
  if (sdk.getTs) return sdk.getTs()
  if (sdk.origin_server_ts) return sdk.origin_server_ts

  return Date.now()
}

export interface SearchOptions {
  /** Search query */
  query: string
  /** Search scope ('all', 'rooms', 'messages') */
  scope?: 'all' | 'rooms' | 'messages'
  /** Room IDs to search in (empty for all rooms) */
  roomIds?: string[]
  /** Sender IDs to filter by */
  senderIds?: string[]
  /** Message types to filter by */
  messageTypes?: string[]
  /** Date range */
  dateRange?: [number, number] | null
  /** Maximum results */
  limit?: number
  /** Result offset for pagination */
  offset?: number
  /** Search order ('recent' or 'relevance') */
  order?: 'recent' | 'relevance'
  /** Include context around matches */
  includeContext?: boolean
  /** Context size (number of messages before/after) */
  contextSize?: number
  /** Search encrypted messages */
  searchEncrypted?: boolean
}

export interface SearchResult {
  /** Event ID */
  eventId: string
  /** Room ID */
  roomId: string
  /** Room name */
  roomName?: string
  /** Room avatar */
  roomAvatar?: string
  /** Sender ID */
  senderId: string
  /** Sender name */
  senderName?: string
  /** Sender avatar */
  senderAvatar?: string
  /** Message content (parsed event) */
  content: unknown
  /** Formatted content with highlights */
  formattedContent?: string
  /** Timestamp */
  timestamp: number
  /** Relevance score */
  score: number
  /** Match highlights */
  highlights?: string[]
  /** Context messages */
  context?: {
    before: (RawMatrixEvent | SDKMatrixEvent)[]
    after: (RawMatrixEvent | SDKMatrixEvent)[]
  }
  /** Is encrypted message */
  encrypted: boolean
}

export interface RoomSearchResult {
  /** Room ID */
  roomId: string
  /** Room name */
  name?: string
  /** Room topic */
  topic?: string
  /** Room avatar */
  avatar?: string
  /** Member count */
  memberCount?: number
  /** Relevance score */
  score: number
  /** Match type */
  matchType: 'name' | 'topic' | 'alias' | 'member'
  /** Matching members */
  matchingMembers?: string[]
}

export interface UserSearchResult {
  /** User ID */
  userId: string
  /** Display name */
  displayName?: string
  /** Avatar URL */
  avatar?: string
  /** Presence status */
  presence?: 'online' | 'offline' | 'unavailable'
  /** Last active ago */
  lastActiveAgo?: number
  /** Relevance score */
  score: number
  /** Match type */
  matchType: 'display_name' | 'user_id' | 'email'
}

export interface SearchResponse {
  /** Total results count */
  count: number
  /** Has more results */
  hasMore: boolean
  /** Next batch token */
  nextBatch?: string
  /** Results */
  results: SearchResult[]
}

interface CachedSearchResponse extends SearchResponse {
  timestamp: number
}

/**
 * Matrix Search Service
 */
export class MatrixSearchService {
  private static instance: MatrixSearchService
  private searchCache = new Map<string, CachedSearchResponse>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  static getInstance(): MatrixSearchService {
    if (!MatrixSearchService.instance) {
      MatrixSearchService.instance = new MatrixSearchService()
    }
    return MatrixSearchService.instance
  }

  /**
   * Search messages
   */
  async searchMessages(options: SearchOptions): Promise<SearchResponse> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixSearchService] Searching messages', options)

      // Generate cache key
      const cacheKey = this.generateCacheKey('messages', options)

      // Check cache first
      const cached = this.getCachedResult(cacheKey)
      if (cached) {
        logger.debug('[MatrixSearchService] Returning cached results')
        return cached
      }

      // Prepare search request
      const searchBody = this.buildSearchRequest(options)

      // Perform search using extended client type
      const extendedClient = client as unknown as MatrixClientExtended
      const response: MatrixSearchResponse =
        (await (extendedClient.search?.({
          body: {
            search_categories: {
              room_events: searchBody
            }
          }
        }) as Promise<MatrixSearchResponse>)) || {}

      // Process results
      const results = await this.processSearchResults(
        response.search_categories?.room_events || response.room_events || {},
        options
      )

      const re = response.search_categories?.room_events || response.room_events || {}
      const searchResponse: SearchResponse = (() => {
        const result: SearchResponse = {
          count: re.count || 0,
          hasMore: !!re.next_batch,
          results
        }
        if (re.next_batch !== undefined) result.nextBatch = re.next_batch
        return result
      })()

      // Cache results
      this.setCachedResult(cacheKey, searchResponse)

      logger.info('[MatrixSearchService] Search completed', {
        count: searchResponse.count,
        hasMore: searchResponse.hasMore
      })

      return searchResponse
    } catch (error) {
      logger.error('[MatrixSearchService] Failed to search messages:', error)

      // Fallback to local search
      return this.localSearch(options)
    }
  }

  /**
   * Search rooms
   */
  async searchRooms(query: string, limit = 20): Promise<RoomSearchResult[]> {
    try {
      logger.info('[MatrixSearchService] Searching rooms', { query })

      const results: RoomSearchResult[] = []
      const lowerQuery = query.toLowerCase()

      // Search through joined rooms
      const rooms = await matrixRoomManager.getJoinedRooms()

      for (const roomId of rooms) {
        const summary = matrixRoomManager.getRoomSummary(roomId) as ExtendedRoomSummary | null
        if (!summary) continue

        const score = this.calculateRoomScore(summary, lowerQuery)
        if (score > 0) {
          const result: RoomSearchResult = {
            roomId: summary.roomId as string,
            name: (summary.name || summary.roomId) as string,
            memberCount: (summary.joinedMemberCount || 0) + (summary.invitedMemberCount || 0),
            score,
            matchType: this.getRoomMatchType(summary, lowerQuery)
          }
          if (summary.topic !== undefined) result.topic = summary.topic
          if (summary.avatar !== undefined) result.avatar = summary.avatar
          results.push(result)
        }
      }

      // Search through spaces
      const spaces = matrixSpacesService.getSpaces()
      for (const space of spaces) {
        const score = this.calculateRoomScore(space, lowerQuery)
        if (score > 0) {
          const result: RoomSearchResult = {
            roomId: space.roomId,
            name: space.name,
            score,
            matchType: this.getRoomMatchType(space, lowerQuery)
          }
          if (space.memberCount !== undefined) result.memberCount = space.memberCount
          if (space.topic !== undefined) result.topic = space.topic
          if (space.avatar !== undefined) result.avatar = space.avatar
          results.push(result)
        }
      }

      // Sort by score and limit
      results.sort((a, b) => b.score - a.score)
      return results.slice(0, limit)
    } catch (error) {
      logger.error('[MatrixSearchService] Failed to search rooms:', error)
      return []
    }
  }

  /**
   * Search users
   */
  async searchUsers(query: string, limit = 20): Promise<UserSearchResult[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixSearchService] Searching users', { query })

      // Use Matrix user directory search
      const extendedClient = client as unknown as MatrixClientExtended
      const response: UserDirectorySearchResponse = (await (extendedClient.searchUserDirectory?.({
        limit,
        term: query
      }) as Promise<UserDirectorySearchResponse>)) || { results: [] }

      const results: UserSearchResult[] = (response.results || []).map((user: UserDirectoryItem) => {
        const result: UserSearchResult = {
          userId: user.user_id,
          presence: 'offline', // User directory doesn't include presence
          score: this.calculateUserScore(user, query),
          matchType: this.getUserMatchType(user, query)
        }
        if (user.display_name !== undefined) result.displayName = user.display_name
        if (user.avatar_url !== undefined) result.avatar = user.avatar_url
        return result
      })

      // Sort by score
      results.sort((a, b) => b.score - a.score)

      logger.info('[MatrixSearchService] User search completed', {
        count: results.length
      })

      return results
    } catch (error) {
      logger.error('[MatrixSearchService] Failed to search users:', error)

      // Fallback: search through room members
      return this.searchRoomMembers(query, limit)
    }
  }

  /**
   * Search within a specific room
   */
  async searchInRoom(roomId: string, options: Omit<SearchOptions, 'roomIds'>): Promise<SearchResponse> {
    return this.searchMessages({
      ...options,
      roomIds: [roomId]
    })
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSearchSuggestions(partial: string, limit = 5): Promise<string[]> {
    try {
      logger.debug('[MatrixSearchService] Getting suggestions', { partial })

      // Get recent search terms from local storage
      const recentSearches = this.getRecentSearches()
      const matching: string[] = []

      // Find matches in recent searches
      for (const term of recentSearches) {
        if (term.toLowerCase().includes(partial.toLowerCase()) && !matching.includes(term)) {
          matching.push(term)
          if (matching.length >= limit) break
        }
      }

      // Get room name suggestions
      if (matching.length < limit) {
        const rooms = await this.searchRooms(partial, limit - matching.length)
        for (const room of rooms) {
          if (room.name && !matching.includes(room.name)) {
            matching.push(room.name)
          }
        }
      }

      return matching.slice(0, limit)
    } catch (error) {
      logger.error('[MatrixSearchService] Failed to get suggestions:', error)
      return []
    }
  }

  /**
   * Save search term to recent searches
   */
  saveSearchTerm(term: string): void {
    try {
      const recent = this.getRecentSearches()

      // Remove if already exists
      const index = recent.indexOf(term)
      if (index > -1) {
        recent.splice(index, 1)
      }

      // Add to beginning
      recent.unshift(term)

      // Keep only last 20
      recent.splice(20)

      // Save to localStorage
      localStorage.setItem('matrix_recent_searches', JSON.stringify(recent))

      logger.debug('[MatrixSearchService] Search term saved', { term })
    } catch (error) {
      logger.error('[MatrixSearchService] Failed to save search term:', error)
    }
  }

  /**
   * Get recent searches
   */
  getRecentSearches(): string[] {
    try {
      const saved = localStorage.getItem('matrix_recent_searches')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  }

  /**
   * Clear search history
   */
  clearSearchHistory(): void {
    try {
      localStorage.removeItem('matrix_recent_searches')
      this.searchCache.clear()
      logger.info('[MatrixSearchService] Search history cleared')
    } catch (error) {
      logger.error('[MatrixSearchService] Failed to clear search history:', error)
    }
  }

  /**
   * Build search request body
   */
  private buildSearchRequest(options: SearchOptions): MatrixSearchRequestBody {
    const searchBody: MatrixSearchRequestBody = {
      search_term: options.query,
      order_by: options.order === 'recent' ? 'recent' : 'rank',
      limit: options.limit || 50,
      event_context: options.includeContext ? options.contextSize || 1 : 0
    }

    // Add room filter
    if (options.roomIds && options.roomIds.length > 0) {
      searchBody.filter = {
        rooms: options.roomIds
      }
    }

    // Add sender filter
    if (options.senderIds && options.senderIds.length > 0) {
      searchBody.filter = {
        ...searchBody.filter,
        senders: options.senderIds
      }
    }

    // Add message type filter
    if (options.messageTypes && options.messageTypes.length > 0) {
      searchBody.filter = {
        ...searchBody.filter,
        types: options.messageTypes
      }
    }

    // Add date range
    if (options.dateRange) {
      searchBody.filter = {
        ...searchBody.filter,
        ...this.buildDateFilter(options.dateRange)
      }
    }

    return searchBody
  }

  /**
   * Build date filter
   */
  private buildDateFilter(dateRange: [number, number]): { before?: number; after?: number } {
    const filter: { before?: number; after?: number } = {}

    if (dateRange[0]) {
      filter.before = dateRange[0] / 1000
    }

    if (dateRange[1]) {
      filter.after = dateRange[1] / 1000
    }

    return filter
  }

  /**
   * Process search results
   */
  private async processSearchResults(
    results: MatrixRoomEventsSearchResponse,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const processed: SearchResult[] = []

    for (const result of results.results || []) {
      try {
        const event = result.result as RawMatrixEvent
        // Adapt event to messageUtils.MatrixEventLike
        const adaptedEvent = (() => {
          const adaptedResult: {
            getContent?: <T = Record<string, unknown>>() => T
            content?: Record<string, unknown>
            getSender?: () => string
            sender?: string
            getRoomId?: () => string
            roomId?: string
            getId?: () => string
            eventId?: string
            getTs?: () => number
          } = {}
          if (event.event_id !== undefined) adaptedResult.eventId = event.event_id
          if (event.content !== undefined) adaptedResult.content = event.content
          if (event.room_id !== undefined) adaptedResult.roomId = event.room_id
          if (event.getContent) {
            const getContent = event.getContent
            if (getContent) adaptedResult.getContent = <T = Record<string, unknown>>() => getContent() as T
          }
          if (event.getSender) {
            const getSender = event.getSender
            if (getSender) adaptedResult.getSender = () => getSender()
          }
          if (typeof event.sender === 'string') adaptedResult.sender = event.sender
          if (event.getRoomId) {
            const getRoomId = event.getRoomId
            if (getRoomId) adaptedResult.getRoomId = () => getRoomId()
          }
          if (event.getId) {
            const getId = event.getId
            if (getId) adaptedResult.getId = () => getId()
          }
          if (event.getTs) adaptedResult.getTs = event.getTs
          return adaptedResult
        })()
        const parsedEvent = parseMatrixEvent(adaptedEvent)

        // Get room info - RawMatrixEvent supports both direct property and method
        const roomId = event.getRoomId?.() || event.room_id || ''
        const room = await matrixRoomManager.getRoomSummary(roomId)

        // Get sender info - ensure senderId is a string
        const senderId = event.getSender?.() || (typeof event.sender === 'string' ? event.sender : '')
        const member = roomId && senderId ? await getMember(roomId, senderId) : null

        // Extract sender name from sender ID or member
        let senderName = member?.displayName || ''
        if (!senderName && senderId) {
          const parts = senderId.split(':')
          if (parts[0]) {
            senderName = parts[0].substring(1) // Remove leading @
          }
        }

        const searchResult: SearchResult = {
          eventId: event.getId?.() || event.event_id || '',
          roomId: roomId,
          roomName: room?.name,
          roomAvatar: room?.avatar,
          senderId: senderId,
          senderName: senderName || '',
          senderAvatar: member?.avatarUrl,
          content: parsedEvent || {},
          formattedContent: this.highlightSearchTerms(
            (parsedEvent as { body?: { text?: string } })?.body?.text || '',
            options.query
          ),
          timestamp: event.getTs?.() || event.origin_server_ts || 0,
          score: result.rank || 0,
          highlights: result.highlights || [],
          context: result.context
            ? {
                before: (result.context.events_before || []) as (RawMatrixEvent | SDKMatrixEvent)[],
                after: (result.context.events_after || []) as (RawMatrixEvent | SDKMatrixEvent)[]
              }
            : undefined,
          encrypted: !!(
            (event.getContent?.() || event.content)?.algorithm && (event.getContent?.() || event.content)?.ciphertext
          )
        } as SearchResult

        processed.push(searchResult)
      } catch (error) {
        logger.error('[MatrixSearchService] Failed to process search result:', error)
      }
    }

    return processed
  }

  /**
   * Local search fallback
   */
  private async localSearch(options: SearchOptions): Promise<SearchResponse> {
    try {
      logger.info('[MatrixSearchService] Performing local search')

      const results: SearchResult[] = []
      const client = matrixClientService.getClient()
      if (!client) {
        return { count: 0, hasMore: false, results: [] }
      }

      const extendedClient = client as unknown as MatrixClientExtended
      const rooms: ExtendedRoomLike[] = options.roomIds
        ? options.roomIds
            .map((id) => extendedClient.getRoom?.(id))
            .filter((r): r is ExtendedRoomLike => r !== undefined)
        : extendedClient.getRooms?.() || []

      const lowerQuery = options.query.toLowerCase()

      for (const room of rooms) {
        const timeline = room.getLiveTimeline?.() || room.timeline
        const events = timeline?.getEvents?.() || []

        for (const event of events) {
          // Use helper functions to safely get event properties
          const eventType = getEventType(event)
          if (eventType !== 'm.room.message') continue

          const senderId = getEventSender(event)
          const userId = extendedClient.getUserId?.()
          if (senderId && userId && senderId === userId) continue // Skip own messages

          const content = getEventContent(event)
          const body = ((content as { body?: string }).body || '').toLowerCase()

          if (body.includes(lowerQuery)) {
            // Adapt event to messageUtils.MatrixEventLike
            // Use RawMatrixEvent methods which are defined as optional
            const rawEvent = event as RawMatrixEvent
            const adaptedEvent = (() => {
              const adaptedResult: {
                getContent?: <T = Record<string, unknown>>() => T
                content?: Record<string, unknown>
                getSender?: () => string
                sender?: string
                getRoomId?: () => string
                roomId?: string
                getId?: () => string
                eventId?: string
                getTs?: () => number
              } = {}
              if (rawEvent.event_id !== undefined) adaptedResult.eventId = rawEvent.event_id
              if (rawEvent.content !== undefined) adaptedResult.content = rawEvent.content
              if (rawEvent.room_id !== undefined) adaptedResult.roomId = rawEvent.room_id
              if (rawEvent.getContent) {
                const getContent = rawEvent.getContent
                if (getContent) adaptedResult.getContent = <T = Record<string, unknown>>() => getContent() as T
              }
              if (rawEvent.getSender) {
                const getSender = rawEvent.getSender
                if (getSender) adaptedResult.getSender = () => getSender()
              }
              if (typeof rawEvent.sender === 'string') adaptedResult.sender = rawEvent.sender
              if (rawEvent.getRoomId) {
                const getRoomId = rawEvent.getRoomId
                if (getRoomId) adaptedResult.getRoomId = () => getRoomId()
              }
              if (rawEvent.getId) {
                const getId = rawEvent.getId
                if (getId) adaptedResult.getId = () => getId()
              }
              if (rawEvent.getTs) adaptedResult.getTs = rawEvent.getTs
              return adaptedResult
            })()
            const parsedEvent = parseMatrixEvent(adaptedEvent)
            const member = senderId ? room.getMember?.(senderId) : null

            const baseUrl: string = extendedClient?.baseUrl || ''
            const eventId = getEventId(event)
            const timestamp = getEventTimestamp(event)

            // Extract sender name from sender ID or member
            let senderName = member?.displayName || ''
            if (!senderName && senderId) {
              const parts = senderId.split(':')
              if (parts[0]) {
                senderName = parts[0].substring(1) // Remove leading @
              }
            }

            const result: SearchResult = {
              eventId: eventId,
              roomId: room.roomId,
              senderId: senderId,
              senderName: senderName || '',
              content: parsedEvent,
              timestamp: timestamp,
              score: 1.0,
              encrypted: false
            }
            if (room.name !== undefined) result.roomName = room.name
            if (room.getAvatarUrl !== undefined) {
              const avatar = room.getAvatarUrl(baseUrl, 64, 64, 'crop', true, true)
              if (avatar !== undefined) result.roomAvatar = avatar
            }
            if (member?.avatarUrl !== undefined) result.senderAvatar = member.avatarUrl
            const formatted = this.highlightSearchTerms((content as { body?: string }).body || '', options.query)
            if (formatted !== undefined) result.formattedContent = formatted
            results.push(result)
          }
        }
      }

      // Sort by timestamp
      results.sort((a, b) => b.timestamp - a.timestamp)

      // Apply limit
      if (options.limit) {
        results.splice(options.limit)
      }

      return {
        count: results.length,
        hasMore: false,
        results
      }
    } catch (error) {
      logger.error('[MatrixSearchService] Local search failed:', error)
      return { count: 0, hasMore: false, results: [] }
    }
  }

  /**
   * Search room members (fallback for user search)
   */
  private async searchRoomMembers(query: string, limit: number): Promise<UserSearchResult[]> {
    const results: UserSearchResult[] = []
    const lowerQuery = query.toLowerCase()
    const seen = new Set<string>()

    try {
      const rooms = await matrixRoomManager.getJoinedRooms()

      for (const roomId of rooms.slice(0, 10)) {
        // Limit to first 10 rooms
        const members = await matrixRoomManager.getRoomMembers(roomId)

        for (const member of members) {
          if (seen.has(member.userId)) continue

          const score = this.calculateMemberScore(member, lowerQuery)
          if (score > 0) {
            results.push(
              (() => {
                const result: UserSearchResult = {
                  userId: member.userId,
                  score,
                  matchType: member.displayName?.toLowerCase().includes(lowerQuery) ? 'display_name' : 'user_id'
                }
                if (member.displayName !== undefined) result.displayName = member.displayName
                if (member.avatarUrl !== undefined) result.avatar = member.avatarUrl
                if (
                  member.presence === 'online' ||
                  member.presence === 'offline' ||
                  member.presence === 'unavailable'
                ) {
                  result.presence = member.presence
                }
                if (member.lastActiveAgo !== undefined) result.lastActiveAgo = member.lastActiveAgo
                return result
              })()
            )

            seen.add(member.userId)
          }
        }
      }
    } catch (error) {
      logger.error('[MatrixSearchService] Failed to search room members:', error)
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  /**
   * Calculate room search score
   */
  private calculateRoomScore(room: RoomLike, query: string): number {
    let score = 0

    if (room.name?.toLowerCase().includes(query)) {
      score += 10
    }

    if (room.topic?.toLowerCase().includes(query)) {
      score += 5
    }

    // Check aliases
    if (room.aliases) {
      for (const alias of room.aliases) {
        if (alias.toLowerCase().includes(query)) {
          score += 3
          break
        }
      }
    }

    return score
  }

  /**
   * Get room match type
   */
  private getRoomMatchType(room: RoomLike, query: string): 'name' | 'topic' | 'alias' | 'member' {
    if (room.name?.toLowerCase().includes(query)) return 'name'
    if (room.topic?.toLowerCase().includes(query)) return 'topic'

    if (room.aliases) {
      for (const alias of room.aliases) {
        if (alias.toLowerCase().includes(query)) return 'alias'
      }
    }

    return 'name'
  }

  /**
   * Calculate user search score
   */
  private calculateUserScore(user: UserLike | UserDirectoryItem, query: string): number {
    let score = 0
    const lowerQuery = query.toLowerCase()

    // Handle both user directory items and room member objects
    const displayName = user.display_name || (user as UserLike).displayName
    const userId = user.user_id || (user as UserLike).userId

    if (displayName?.toLowerCase().includes(lowerQuery)) {
      score += 10
    }

    if (userId?.toLowerCase().includes(lowerQuery)) {
      score += 5
    }

    return score
  }

  /**
   * Get user match type
   */
  private getUserMatchType(user: UserLike | UserDirectoryItem, query: string): 'display_name' | 'user_id' | 'email' {
    const lowerQuery = query.toLowerCase()

    // Handle both user directory items and room member objects
    const displayName = user.display_name || (user as UserLike).displayName
    const userId = user.user_id || (user as UserLike).userId

    if (displayName?.toLowerCase().includes(lowerQuery)) {
      return 'display_name'
    }

    if (userId?.toLowerCase().includes(lowerQuery)) {
      return 'user_id'
    }

    return 'display_name'
  }

  /**
   * Calculate member search score
   */
  private calculateMemberScore(member: MatrixMember, query: string): number {
    let score = 0

    if (member.displayName?.toLowerCase().includes(query)) {
      score += 10
    }

    if (member.userId.toLowerCase().includes(query)) {
      score += 5
    }

    return score
  }

  /**
   * Highlight search terms in text
   */
  private highlightSearchTerms(text: string, query: string): string {
    if (!query) return text

    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi')
    return text.replace(regex, '<mark>$1</mark>')
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(type: string, options: SearchOptions): string {
    const key = {
      type,
      query: options.query,
      roomIds: options.roomIds?.sort(),
      senderIds: options.senderIds?.sort(),
      messageTypes: options.messageTypes?.sort(),
      limit: options.limit,
      offset: options.offset,
      order: options.order
    }

    return btoa(JSON.stringify(key))
  }

  /**
   * Get cached result
   */
  private getCachedResult(key: string): SearchResponse | null {
    const cached = this.searchCache.get(key)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached
    }

    this.searchCache.delete(key)
    return null
  }

  /**
   * Set cached result
   */
  private setCachedResult(key: string, result: SearchResponse): void {
    // Store timestamp for cache TTL
    const cached: CachedSearchResponse = { ...result, timestamp: Date.now() }
    this.searchCache.set(key, cached)

    // Clean old cache entries
    this.cleanCache()
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now()
    for (const [key, value] of this.searchCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.searchCache.delete(key)
      }
    }
  }
}

// Helper function to get room members
async function getMember(roomId: string, userId: string): Promise<MatrixMember | null> {
  try {
    const members = await matrixRoomManager.getRoomMembers(roomId)
    return members.find((m) => m.userId === userId) || null
  } catch {
    return null
  }
}

// Export singleton instance
export const matrixSearchService = MatrixSearchService.getInstance()
