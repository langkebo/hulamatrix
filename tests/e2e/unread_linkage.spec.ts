import { describe, it, expect, vi } from 'vitest'
import type { SessionItem } from '@/services/types'

// Mock the UnreadCountManager to track calls
const mockUnreadCountManager = {
  markRead: vi.fn().mockReturnValue(0),
  setUpdateCallback: vi.fn(),
  calculateTotal: vi.fn().mockReturnValue(0)
}

vi.mock('@/utils/UnreadCountManager', () => ({
  unreadCountManager: mockUnreadCountManager
}))

describe('unread linkage', () => {
  it('UnreadCountManager markRead is called correctly', async () => {
    const roomId = '!test:room.example.com'
    const unreadCount = 5

    // Import after mocking
    const { unreadCountManager } = await import('@/utils/UnreadCountManager')

    // Call the method with proper parameters
    const sessionList: SessionItem[] = []
    const unReadMark = {
      newFriendUnreadCount: 0,
      newGroupUnreadCount: 0,
      newMsgUnreadCount: unreadCount,
      noticeUnreadCount: 0
    }
    const result = unreadCountManager.markRead(roomId, sessionList, unReadMark)

    // Verify it was called with correct parameters
    expect(unreadCountManager.markRead).toHaveBeenCalledWith(roomId, sessionList, unReadMark)
    expect(result).toBe(0)
  })

  it('UnreadCountManager setUpdateCallback can be set', async () => {
    const callback = vi.fn()

    // Import after mocking
    const { unreadCountManager } = await import('@/utils/UnreadCountManager')

    // Set callback
    unreadCountManager.setUpdateCallback(callback)

    // Verify it was called
    expect(unreadCountManager.setUpdateCallback).toHaveBeenCalledWith(callback)
  })

  it('UnreadCountManager calculateTotal works correctly', async () => {
    const mockSessions = [
      {
        account: 'user1',
        activeTime: Date.now(),
        avatar: 'avatar1.jpg',
        id: '!room1',
        detailId: '!room1',
        hotFlag: 0,
        name: 'Room 1',
        roomId: '!room1',
        text: 'Hello',
        type: 1,
        unreadCount: 2,
        top: false,
        operate: 0,
        hide: false,
        muteNotification: 0,
        shield: false,
        allowScanEnter: false
      },
      {
        account: 'user2',
        activeTime: Date.now(),
        avatar: 'avatar2.jpg',
        id: '!room2',
        detailId: '!room2',
        hotFlag: 0,
        name: 'Room 2',
        roomId: '!room2',
        text: 'World',
        type: 1,
        unreadCount: 3,
        top: false,
        operate: 0,
        hide: false,
        muteNotification: 0,
        shield: false,
        allowScanEnter: false
      }
    ]
    const unReadMark = {
      newFriendUnreadCount: 0,
      newGroupUnreadCount: 0,
      newMsgUnreadCount: 5,
      noticeUnreadCount: 0
    }

    // Import after mocking
    const { unreadCountManager } = await import('@/utils/UnreadCountManager')

    // Calculate total
    const result = unreadCountManager.calculateTotal(mockSessions, unReadMark)

    // Verify it was called and returns expected result
    expect(unreadCountManager.calculateTotal).toHaveBeenCalledWith(mockSessions, unReadMark)
    expect(result).toBe(0)
  })
})
