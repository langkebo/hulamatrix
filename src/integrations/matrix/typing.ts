/**
 * Matrix Typing Bridge
 * SDK Integration: Uses RoomEvent.Typing for typing notifications
 *
 * @see docs/matrix-sdk/08-presence-typing.md
 */

import { matrixClientService } from './client'
import { defineStore } from 'pinia'

export const useTypingStore = defineStore('typing', {
  state: () => ({
    map: {} as Record<string, string[]>
  }),
  actions: {
    set(roomId: string, userIds: string[]) {
      this.map[roomId] = userIds
    },
    get(roomId: string) {
      return this.map[roomId] || []
    }
  }
})

interface MatrixClientLike {
  on?(event: string, handler: (...args: unknown[]) => void): void
  getUserId?(): string
  [key: string]: unknown
}

interface RoomLike {
  roomId: string
  getMember?(userId: string): { displayName?: string } | null
}

interface MatrixEventLike {
  getContent?<T = unknown>(): T
  getRoomId?(): string
  [key: string]: unknown
}

/**
 * Setup Matrix typing event listener using SDK's RoomEvent.Typing
 *
 * SDK API:
 * - Event: RoomEvent.Typing or 'Room.typing'
 * - Content: { user_ids: string[] }
 */
export function setupMatrixTypingBridge() {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) return

  const store = useTypingStore()
  const currentUserId = client.getUserId?.()

  // Listen to SDK's Room.typing event
  // According to SDK docs: client.on(RoomEvent.Typing, (event, room) => {...})
  client.on?.('Room.typing', (...args: unknown[]) => {
    const event = args[0] as MatrixEventLike
    const room = args[1] as RoomLike

    const content = event?.getContent?.<{ user_ids: string[] }>()
    const roomId = room?.roomId || event?.getRoomId?.()

    if (content?.user_ids && roomId) {
      // Filter out current user from typing list
      const typingUsers = content.user_ids.filter((id) => id !== currentUserId)
      store.set(roomId, typingUsers)
    }
  })
}
