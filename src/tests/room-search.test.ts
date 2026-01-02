/**
 * 群/房间搜索功能测试
 * 测试房间搜索服务和适配器功能
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  searchJoinedRooms,
  searchPublicRooms,
  getRoomSearchSuggestions,
  saveRoomSearchHistory,
  setRoomSearchClient,
  clearRoomSearchHistory,
  filterRoomsByTag,
  type RoomSearchOptions
} from '@/services/roomSearchService'
import type { Room } from 'matrix-js-sdk'

// Mock Matrix Client
const mockClient = {
  getRooms: vi.fn(),
  publicRooms: vi.fn(),
  getUserId: vi.fn().mockReturnValue('@user:example.org'),
  getHomeserverUrl: vi.fn().mockReturnValue('https://matrix.example.org')
}

// Mock localStorage
const mockLocalStorage = {
  data: {} as Record<string, string>,
  getItem: vi.fn((key: string) => mockLocalStorage.data[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage.data[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage.data[key]
  }),
  clear: vi.fn(() => {
    mockLocalStorage.data = {}
  })
}

vi.stubGlobal('localStorage', mockLocalStorage)

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

describe('Room Search Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.clear()
    // Set up the client
    setRoomSearchClient(mockClient as any)
  })

  afterEach(() => {
    mockLocalStorage.clear()
  })

  describe('searchJoinedRooms', () => {
    it('应该搜索已加入的房间', async () => {
      const mockRooms: Room[] = [
        {
          roomId: '!room1:example.org',
          name: 'Test Room 1',
          getAvatarUrl: vi.fn().mockReturnValue('https://example.org/avatar1.jpg'),
          getJoinedMemberCount: vi.fn().mockReturnValue(5),
          getInvitedMemberCount: vi.fn().mockReturnValue(0),
          tags: { 'm.favourite': true },
          getJoinRule: vi.fn().mockReturnValue('public')
        } as any,
        {
          roomId: '!room2:example.org',
          name: 'Chat Room',
          getAvatarUrl: vi.fn().mockReturnValue('https://example.org/avatar2.jpg'),
          getJoinedMemberCount: vi.fn().mockReturnValue(10),
          getInvitedMemberCount: vi.fn().mockReturnValue(2),
          tags: {},
          getJoinRule: vi.fn().mockReturnValue('private')
        } as any
      ]

      mockClient.getRooms.mockReturnValue(mockRooms)

      const results = await searchJoinedRooms({ query: 'Test' })

      expect(results).toHaveLength(1)
      expect(results[0].roomId).toBe('!room1:example.org')
      expect(results[0].name).toBe('Test Room 1')
    })

    it('应该支持按成员数量筛选', async () => {
      const mockRooms: Room[] = [
        {
          roomId: '!room1:example.org',
          name: 'Small Room',
          getJoinedMemberCount: vi.fn().mockReturnValue(3),
          getInvitedMemberCount: vi.fn().mockReturnValue(0)
        } as any,
        {
          roomId: '!room2:example.org',
          name: 'Large Room',
          getJoinedMemberCount: vi.fn().mockReturnValue(15),
          getInvitedMemberCount: vi.fn().mockReturnValue(5)
        } as any
      ]

      mockClient.getRooms.mockReturnValue(mockRooms)

      const options: RoomSearchOptions = {
        memberCountRange: { min: 10 }
      }
      const results = await searchJoinedRooms(options)

      expect(results).toHaveLength(1)
      expect(results[0].roomId).toBe('!room2:example.org')
    })

    it('应该支持按房间类型筛选', async () => {
      const mockRooms: Room[] = [
        {
          roomId: '!room1:example.org',
          name: 'Public Room',
          getJoinRule: vi.fn().mockReturnValue('public'),
          getJoinedMemberCount: vi.fn().mockReturnValue(10),
          getInvitedMemberCount: vi.fn().mockReturnValue(0),
          tags: {},
          getAvatarUrl: vi.fn().mockReturnValue('')
        } as any,
        {
          roomId: '!room2:example.org',
          name: 'Private Room',
          getJoinRule: vi.fn().mockReturnValue('invite'),
          getJoinedMemberCount: vi.fn().mockReturnValue(5),
          getInvitedMemberCount: vi.fn().mockReturnValue(0),
          tags: {},
          getAvatarUrl: vi.fn().mockReturnValue('')
        } as any
      ]

      mockClient.getRooms.mockReturnValue(mockRooms)

      const options: RoomSearchOptions = {
        roomTypes: ['public']
      }
      const results = await searchJoinedRooms(options)

      expect(results).toHaveLength(1)
      expect(results[0].roomId).toBe('!room1:example.org')
    })
  })

  describe('searchPublicRooms', () => {
    it('应该搜索公开房间', async () => {
      const mockPublicRooms = [
        {
          room_id: '!public1:example.org',
          name: 'Public Room 1',
          topic: 'Public topic',
          num_joined_members: 20,
          avatar_url: 'https://example.org/avatar1.jpg',
          world_readable: true
        },
        {
          room_id: '!public2:example.org',
          name: 'Public Room 2',
          topic: 'Another public topic',
          num_joined_members: 50,
          avatar_url: 'https://example.org/avatar2.jpg',
          world_readable: true
        }
      ]

      mockClient.publicRooms.mockResolvedValue({
        chunk: mockPublicRooms
      })

      const results = await searchPublicRooms({
        query: 'Public',
        limit: 10
      })

      expect(mockClient.publicRooms).toHaveBeenCalledWith({
        limit: 10,
        include_all_networks: false,
        threshold: 0.5,
        server: 'https://matrix.example.org',
        filter: {
          generic_search_term: 'Public'
        }
      })
      expect(results).toHaveLength(2)
    })

    it('应该支持服务器筛选', async () => {
      mockClient.publicRooms.mockResolvedValue({
        chunk: []
      })

      await searchPublicRooms({
        server: 'matrix.example.org'
      })

      expect(mockClient.publicRooms).toHaveBeenCalledWith({
        include_all_networks: false,
        limit: 50,
        threshold: 0.5,
        server: 'matrix.example.org'
      })
    })
  })

  describe('getRoomSearchSuggestions', () => {
    it('应该获取搜索建议', async () => {
      const mockRooms: Room[] = [
        {
          roomId: '!room1:example.org',
          name: 'Development Team',
          getJoinedMemberCount: vi.fn().mockReturnValue(10),
          getInvitedMemberCount: vi.fn().mockReturnValue(0),
          tags: {},
          getAvatarUrl: vi.fn().mockReturnValue('')
        } as any,
        {
          roomId: '!room2:example.org',
          name: 'Design Team',
          getJoinedMemberCount: vi.fn().mockReturnValue(8),
          getInvitedMemberCount: vi.fn().mockReturnValue(0),
          tags: {},
          getAvatarUrl: vi.fn().mockReturnValue('')
        } as any,
        {
          roomId: '!room3:example.org',
          name: 'Marketing Team',
          getJoinedMemberCount: vi.fn().mockReturnValue(12),
          getInvitedMemberCount: vi.fn().mockReturnValue(0),
          tags: {},
          getAvatarUrl: vi.fn().mockReturnValue('')
        } as any
      ]

      mockClient.getRooms.mockReturnValue(mockRooms)

      // Mock publicRooms to return empty array for this test
      mockClient.publicRooms.mockResolvedValue({ chunk: [] })

      const suggestions = await getRoomSearchSuggestions('Team')

      expect(suggestions).toContain('Development Team')
      expect(suggestions).toContain('Design Team')
      expect(suggestions).toContain('Marketing Team')
    })
  })

  describe('filterRoomsByTag', () => {
    it('应该根据标签筛选房间', async () => {
      const mockRooms: Room[] = [
        {
          roomId: '!room1:example.org',
          name: 'Favourite Room',
          tags: { 'm.favourite': true },
          getJoinedMemberCount: vi.fn().mockReturnValue(10),
          getInvitedMemberCount: vi.fn().mockReturnValue(0),
          getAvatarUrl: vi.fn().mockReturnValue('')
        } as any,
        {
          roomId: '!room2:example.org',
          name: 'Normal Room',
          tags: {},
          getJoinedMemberCount: vi.fn().mockReturnValue(5),
          getInvitedMemberCount: vi.fn().mockReturnValue(0),
          getAvatarUrl: vi.fn().mockReturnValue('')
        } as any
      ]

      mockClient.getRooms.mockReturnValue(mockRooms)

      const filtered = await filterRoomsByTag('m.favourite')

      expect(filtered).toHaveLength(1)
      expect(filtered[0].roomId).toBe('!room1:example.org')
    })
  })

  describe('Search History', () => {
    it('应该保存搜索历史', async () => {
      saveRoomSearchHistory('test query')

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'room_search_history',
        expect.stringContaining('test query')
      )
    })

    it('应该清除搜索历史', async () => {
      mockLocalStorage.getItem.mockReturnValue('["old query"]')

      clearRoomSearchHistory()

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('room_search_history')
    })
  })
})
