/**
 * Core Store - Search State Management
 * Handles message, user, and room search functionality
 */

import { ref, type Ref } from 'vue'
import { logger } from '@/utils/logger'
import type {
  SearchState,
  UserProfile,
  MatrixUserDirectoryResponse,
  MatrixUserDirectoryResult,
  MatrixPublicRoomsResponse,
  MatrixPublicRoom,
  RoomSearchResult
} from './types'

/**
 * Search state manager
 */
export class SearchStateManager {
  /** Search state */
  search: Ref<SearchState>

  /** Matrix client reference - use any to accommodate extended Matrix SDK types */
  private getClient: () => any

  /** Users map reference */
  private getUsers: () => Map<string, UserProfile>

  /** Rooms map reference */
  private getRooms: () => Map<
    string,
    { id: string; name: string; avatar?: string; type: string; members: string[]; topic?: string; unreadCount: number }
  >

  constructor(
    getClient: () => any,
    getUsers: () => Map<string, UserProfile>,
    getRooms: () => Map<
      string,
      {
        id: string
        name: string
        avatar?: string
        type: string
        members: string[]
        topic?: string
        unreadCount: number
      }
    >
  ) {
    this.getClient = getClient
    this.getUsers = getUsers
    this.getRooms = getRooms
    this.search = ref<SearchState>({
      query: '',
      results: [],
      filters: {},
      loading: false,
      history: []
    })
  }

  /**
   * Perform search
   */
  async performSearch(query: string): Promise<void> {
    this.search.value.query = query
    this.search.value.loading = true

    try {
      const client = this.getClient()
      if (!client || !query.trim()) {
        this.search.value.results = []
        return
      }

      // Prepare search parameters
      const searchParams = {
        term: query,
        search_term: query,
        order: 'recent',
        limit: 50
      } as Record<string, unknown>

      // Add room filters
      if (this.search.value.filters.roomIds && this.search.value.filters.roomIds.length > 0) {
        searchParams.filter = {
          rooms: this.search.value.filters.roomIds
        }
      }

      // Add sender filters
      if (this.search.value.filters.userIds && this.search.value.filters.userIds.length > 0) {
        searchParams.filter = {
          ...(searchParams.filter as Record<string, unknown>),
          senders: this.search.value.filters.userIds
        }
      }

      // Execute search
      const searchRoomEventsFn = (
        client as unknown as {
          searchRoomEvents?(opts: Record<string, unknown>): Promise<{ results?: unknown[] }>
        }
      ).searchRoomEvents

      const results = (await searchRoomEventsFn?.(searchParams)) ?? { results: [] }

      // Process search results
      const hits = results.results || []
      this.search.value.results = hits.map((r: unknown) => {
        const searchResult = r as {
          result?: { event_id?: string; room_id?: string; content?: { body?: string }; origin_server_ts?: number }
          rank?: number
        }
        const event = searchResult.result ?? {}
        const room = (client as { getRoom?(roomId: string): { roomId?: string; name?: string } | null })?.getRoom?.(
          event.room_id ?? ''
        )

        let highlightedContent = event.content?.body || ''
        if (searchResult.rank && searchResult.rank > 0) {
          highlightedContent = this.highlightSearchTerms(event.content?.body || '', query)
        }

        return {
          id: event.event_id ?? '',
          type: 'message' as const,
          title: room?.name || event.room_id || '',
          content: highlightedContent,
          roomId: event.room_id ?? '',
          timestamp: event.origin_server_ts ?? Date.now()
        }
      })

      // Add to search history
      if (query.trim() && !this.search.value.history.includes(query)) {
        this.search.value.history.unshift(query)
        if (this.search.value.history.length > 20) {
          this.search.value.history.pop()
        }
      }
    } catch (error) {
      logger.error('[SearchState] Search failed:', error)
      this.search.value.results = []
      if (error instanceof Error) {
        if (error.message.includes('not supported')) {
          logger.warn('[SearchState] Search not supported on this homeserver')
        }
      }
    } finally {
      this.search.value.loading = false
    }
  }

  /**
   * Search users
   */
  async searchUsers(query: string): Promise<UserProfile[]> {
    const client = this.getClient()
    if (!client || !query.trim()) {
      return []
    }

    try {
      // Search in known users first
      const users = this.getUsers()
      const knownUsers = Array.from(users.values()).filter(
        (user) =>
          user.displayName?.toLowerCase().includes(query.toLowerCase()) ||
          user.userId.toLowerCase().includes(query.toLowerCase())
      )

      // If homeserver supports user directory search, execute remote search
      try {
        const userDirectoryResults = (await client.searchUserDirectory({
          term: query,
          limit: 20
        })) as unknown as MatrixUserDirectoryResponse

        const remoteUsers = (userDirectoryResults.results || []).map((result: MatrixUserDirectoryResult) => {
          return {
            userId: result.user_id,
            displayName: result.display_name || result.user_id,
            avatarUrl: result.avatar_url || '',
            presence: 'offline' as const
          }
        })

        // Merge results, deduplicate
        const allUsers: UserProfile[] = [...knownUsers]
        remoteUsers.forEach((remote: UserProfile) => {
          if (!allUsers.find((u) => u.userId === remote.userId)) {
            const user = { ...remote }
            if (user.lastActive === undefined) {
              delete user.lastActive
            }
            allUsers.push(user)
          }
        })

        return allUsers.slice(0, 20)
      } catch (error) {
        logger.warn('[SearchState] User directory search not supported:', error)
        return knownUsers
      }
    } catch (error) {
      logger.error('[SearchState] Failed to search users:', error)
      return []
    }
  }

  /**
   * Search rooms
   */
  async searchRooms(query: string, knownRoomsFn?: () => RoomSearchResult[]): Promise<RoomSearchResult[]> {
    const client = this.getClient()
    if (!client || !query.trim()) {
      return []
    }

    try {
      // Search in known rooms
      const knownRooms: RoomSearchResult[] = knownRoomsFn
        ? knownRoomsFn()
        : Array.from(this.getRooms().values())
            .filter(
              (room) =>
                room.name?.toLowerCase().includes(query.toLowerCase()) ||
                room.id.toLowerCase().includes(query.toLowerCase())
            )
            .map((room) => ({
              id: room.id,
              name: room.name,
              avatar: room.avatar || '',
              type: room.type === 'dm' ? 'dm' : 'private',
              memberCount: room.members.length,
              topic: room.topic || '',
              lastMessage: null,
              unreadCount: room.unreadCount
            }))

      // If homeserver supports public room directory, execute remote search
      try {
        const publicRoomResults = (await client.publicRooms({
          limit: 20,
          filter: {
            generic_search_term: query
          }
        })) as unknown as MatrixPublicRoomsResponse

        const remoteRooms = (publicRoomResults.chunk || []).map(
          (room: MatrixPublicRoom): RoomSearchResult => ({
            id: room.room_id,
            name: room.name || room.room_id,
            avatar: room.avatar_url || '',
            type: room.world_readable && room.guest_can_join ? 'public' : 'private',
            memberCount: room.num_joined_members || 0,
            topic: room.topic || '',
            lastMessage: null,
            unreadCount: 0
          })
        )

        // Merge results, deduplicate
        const allRooms = [...knownRooms]
        remoteRooms.forEach((remote: RoomSearchResult) => {
          if (!allRooms.find((r) => r.id === remote.id)) {
            allRooms.push(remote)
          }
        })

        return allRooms.slice(0, 20)
      } catch (error) {
        logger.warn('[SearchState] Public room directory search not supported:', error)
        return knownRooms
      }
    } catch (error) {
      logger.error('[SearchState] Failed to search rooms:', error)
      return []
    }
  }

  /**
   * Highlight search terms
   */
  highlightSearchTerms(text: string, query: string): string {
    if (!text || !query) return text

    const terms = query.split(/\s+/).filter((term) => term.length > 0)
    let highlighted = text

    terms.forEach((term) => {
      const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi')
      highlighted = highlighted.replace(regex, '<mark>$1</mark>')
    })

    return highlighted
  }

  /**
   * Escape regex special characters
   */
  escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * Clear search history
   */
  clearSearchHistory(): void {
    this.search.value.history = []
  }

  /**
   * Clear search results
   */
  clearSearchResults(): void {
    this.search.value.results = []
  }

  /**
   * Set search filters
   */
  setSearchFilters(filters: Partial<SearchState['filters']>): void {
    Object.assign(this.search.value.filters, filters)
  }
}
