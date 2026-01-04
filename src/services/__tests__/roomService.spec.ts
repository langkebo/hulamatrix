import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RoomService, POWER_LEVELS } from '../roomService'

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

// Mock SafeUI
vi.mock('@/utils/SafeUI', () => ({
  msg: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

describe('RoomService', () => {
  let roomService: RoomService
  let mockClient: any

  beforeEach(() => {
    mockClient = {
      getRoom: vi.fn(),
      getStateEvent: vi.fn(),
      sendStateEvent: vi.fn().mockResolvedValue({ event_id: 'ev1' }),
      setPowerLevel: vi.fn(),
      baseUrl: 'https://matrix.org'
    }
    roomService = new RoomService(mockClient)
  })

  describe('updatePowerLevels', () => {
    it('should update power levels for multiple users', async () => {
      const roomId = '!room:example.com'
      const updates = {
        '@user1:example.com': 50,
        '@user2:example.com': 100
      }

      // Mock getRoom to return null so it fetches from server
      mockClient.getRoom.mockReturnValue({
        getStateEvent: vi.fn().mockReturnValue({
          users: {
            '@existing:example.com': 0
          },
          users_default: 0,
          events: {},
          events_default: 0,
          state_default: 50,
          ban: 50,
          kick: 50,
          redact: 50,
          invite: 0
        })
      })

      await roomService.updatePowerLevels(roomId, updates)

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
        roomId,
        'm.room.power_levels',
        '',
        expect.objectContaining({
          users: expect.objectContaining({
            '@existing:example.com': 0,
            '@user1:example.com': 50,
            '@user2:example.com': 100
          })
        })
      )
    })

    it('should handle missing state event by using defaults', async () => {
      const roomId = '!room:example.com'
      mockClient.getRoom.mockReturnValue({}) // No getStateEvent method
      mockClient.getStateEvent.mockRejectedValue(new Error('Not found'))

      await roomService.updatePowerLevels(roomId, { '@user1:example.com': 50 })

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
        roomId,
        'm.room.power_levels',
        '',
        expect.objectContaining({
          users: {
            '@user1:example.com': 50
          },
          users_default: POWER_LEVELS.DEFAULT
        })
      )
    })
  })

  describe('setUserPowerLevel', () => {
    it('should delegate to updatePowerLevels', async () => {
      const spy = vi.spyOn(roomService, 'updatePowerLevels').mockResolvedValue(undefined)
      await roomService.setUserPowerLevel('!r:id', '@u:id', 100)
      expect(spy).toHaveBeenCalledWith('!r:id', { '@u:id': 100 })
    })
  })
})
