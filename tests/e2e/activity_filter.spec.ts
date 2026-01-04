import { test, expect } from '@playwright/test'
import { matrixClientService } from '@/integrations/matrix/client'
import { listFriendsWithPresenceAndActivity } from '@/integrations/matrix/friendsManager'

test('activity filter considers types and onlyWithMe', async () => {
  const now = Date.now()
  const friendId = '@friend:example.com'
  const meId = '@me:example.com'
  const mockRoom = {
    getLiveTimeline: () => ({
      getEvents: () => [
        { getTs: () => now - 5000, getType: () => 'm.room.message', getSender: () => friendId },
        { getTs: () => now - 3000, getType: () => 'm.reaction', getSender: () => meId },
        { getTs: () => now - 1000, getType: () => 'm.room.member', getSender: () => '@third:example.com' }
      ]
    })
  }
  ;(matrixClientService as any).client = {
    getUserId: () => meId,
    getRoom: () => mockRoom,
    getAccountData: () => ({ getContent: () => ({ [friendId]: ['!dm:example.com'] }) })
  }
  const rows = await listFriendsWithPresenceAndActivity({
    allowedTypes: ['m.room.message', 'm.reaction'],
    onlyWithMe: true
  })
  const it = rows.find((r) => r.userId === friendId)
  expect(!!it).toBe(true)
  expect(it!.activeTime).toBeGreaterThan(0)
})
