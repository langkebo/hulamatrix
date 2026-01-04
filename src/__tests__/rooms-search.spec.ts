import { describe, it, expect } from 'vitest'
import { searchRooms, mapRooms } from '@/views/rooms/search-logic'

describe('rooms search logic', () => {
  const mockClient = {
    getRooms: () => [
      {
        roomId: '!a:server',
        name: 'Alpha',
        getJoinRule: () => 'public',
        getMyMembership: () => 'join',
        getCreatedAt: () => 1000,
        getUnreadNotificationCount: () => 2
      },
      {
        roomId: '!b:server',
        name: 'Beta',
        getJoinRule: () => 'invite',
        getMyMembership: () => 'leave',
        getCreatedAt: () => 2000,
        getUnreadNotificationCount: () => 0
      },
      {
        roomId: '!c:server',
        name: 'Gamma',
        getJoinRule: () => 'public',
        getMyMembership: () => 'join',
        getCreatedAt: () => 1500,
        getUnreadNotificationCount: () => 5
      }
    ]
  }

  it('maps rooms correctly', () => {
    const rows = mapRooms(mockClient)
    expect(rows.length).toBe(3)
    expect(rows[0]).toHaveProperty('id')
    expect(rows[0]).toHaveProperty('name')
  })

  it('supports fuzzy search by name', () => {
    const rows = mapRooms(mockClient)
    const result = searchRooms(rows, { query: 'a', mode: 'fuzzy', sortBy: 'name', filter: [] })
    expect(result.some((r) => r.name === 'Alpha')).toBe(true)
    expect(result.some((r) => r.name === 'Gamma')).toBe(true)
  })

  it('filters public/joined', () => {
    const rows = mapRooms(mockClient)
    const result = searchRooms(rows, { query: '', mode: 'fuzzy', sortBy: 'created', filter: ['public', 'joined'] })
    expect(result.every((r) => r.public && r.joined)).toBe(true)
  })

  it('filters by join rule and unread', () => {
    const rows = mapRooms(mockClient)
    const result = searchRooms(rows, { query: '', mode: 'fuzzy', sortBy: 'created', filter: ['rule:invite', 'unread'] })
    // only Beta is invite but unread=0, so empty
    expect(result.length).toBe(0)
    const result2 = searchRooms(rows, { query: '', mode: 'fuzzy', sortBy: 'created', filter: ['unread'] })
    expect(result2.every((r) => (r.unread || 0) > 0)).toBe(true)
  })

  it('exact match by id', () => {
    const rows = mapRooms(mockClient)
    const result = searchRooms(rows, { query: '!b:server', mode: 'exact', sortBy: 'name', filter: [] })
    expect(result.length).toBe(1)
    expect(result[0].id).toBe('!b:server')
  })
})
