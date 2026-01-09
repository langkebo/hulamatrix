/**
 * Array Reactivity Tests
 * 测试数组操作是否能正确触发 Vue 响应式更新
 */

import { describe, it, expect } from 'vitest'
import { ref, computed, nextTick } from 'vue'

describe('Array Reactivity', () => {
  describe('Native Array Methods', () => {
    it('should trigger reactivity when using splice', async () => {
      const array = ref<number[]>([1, 2, 3, 4, 5])
      let computeCount = 0

      const doubled = computed(() => {
        computeCount++
        return array.value.map((x) => x * 2)
      })

      // Access computed to trigger initial computation
      expect(doubled.value).toEqual([2, 4, 6, 8, 10])
      const initialCount = computeCount

      // Modify array using splice
      array.value.splice(2, 1)
      await nextTick()

      // Access computed again to trigger re-computation
      const result = doubled.value

      // Check if reactivity was triggered
      expect(computeCount).toBeGreaterThan(initialCount)
      expect(array.value).toEqual([1, 2, 4, 5])
      expect(result).toEqual([2, 4, 8, 10])
    })

    it('should trigger reactivity when creating new array', async () => {
      const array = ref<number[]>([1, 2, 3, 4, 5])
      let computeCount = 0

      const doubled = computed(() => {
        computeCount++
        return array.value.map((x) => x * 2)
      })

      // Access computed to trigger initial computation
      expect(doubled.value).toEqual([2, 4, 6, 8, 10])
      const initialCount = computeCount

      // Create new array to force reactivity
      const newList = [...array.value]
      newList.splice(2, 1)
      array.value = newList
      await nextTick()

      // Access computed again
      const _result = doubled.value

      // Check if reactivity was triggered
      expect(computeCount).toBeGreaterThan(initialCount)
      expect(array.value).toEqual([1, 2, 4, 5])
    })

    it('should trigger reactivity when using push', async () => {
      const array = ref<number[]>([1, 2, 3])
      let computeCount = 0

      const sum = computed(() => {
        computeCount++
        return array.value.reduce((a, b) => a + b, 0)
      })

      // Access computed to trigger initial computation
      expect(sum.value).toBe(6)
      const initialCount = computeCount

      // Push to array
      array.value.push(4)
      await nextTick()

      // Access computed again
      const result = sum.value

      // Check if reactivity was triggered
      expect(computeCount).toBeGreaterThan(initialCount)
      expect(result).toBe(10)
    })

    it('should trigger reactivity when replacing entire array', async () => {
      const array = ref<number[]>([1, 2, 3, 4, 5])
      let computeCount = 0

      const doubled = computed(() => {
        computeCount++
        return array.value.map((x) => x * 2)
      })

      // Access computed to trigger initial computation
      expect(doubled.value).toEqual([2, 4, 6, 8, 10])
      const initialCount = computeCount

      // Replace entire array
      array.value = [6, 7, 8]
      await nextTick()

      // Access computed again
      const result = doubled.value

      // Check if reactivity was triggered
      expect(computeCount).toBeGreaterThan(initialCount)
      expect(array.value).toEqual([6, 7, 8])
      expect(result).toEqual([12, 14, 16])
    })
  })

  describe('Session Store Array Operations', () => {
    it('should correctly delete session by creating new array', async () => {
      interface SessionItem {
        roomId: string
        name: string
      }

      const sessions = ref<SessionItem[]>([
        { roomId: 'room1', name: 'Room 1' },
        { roomId: 'room2', name: 'Room 2' },
        { roomId: 'room3', name: 'Room 3' }
      ])

      let computeCount = 0
      const roomCount = computed(() => {
        computeCount++
        return sessions.value.length
      })

      // Access computed to trigger initial computation
      expect(roomCount.value).toBe(3)
      const initialCount = computeCount

      // Delete by creating new array (our fix)
      const roomIdToDelete = 'room2'
      const index = sessions.value.findIndex((s) => s.roomId === roomIdToDelete)
      if (index !== -1) {
        const newList = [...sessions.value]
        newList.splice(index, 1)
        sessions.value = newList
      }
      await nextTick()

      // Access computed again
      const result = roomCount.value

      // Verify deletion and reactivity
      expect(computeCount).toBeGreaterThan(initialCount)
      expect(sessions.value.length).toBe(2)
      expect(result).toBe(2)
      expect(sessions.value[0].roomId).toBe('room1')
      expect(sessions.value[1].roomId).toBe('room3')
    })

    it('should correctly update session by creating new array', async () => {
      interface SessionItem {
        roomId: string
        name: string
        unreadCount: number
      }

      const sessions = ref<SessionItem[]>([
        { roomId: 'room1', name: 'Room 1', unreadCount: 0 },
        { roomId: 'room2', name: 'Room 2', unreadCount: 5 }
      ])

      let computeCount = 0
      const totalUnread = computed(() => {
        computeCount++
        return sessions.value.reduce((sum, s) => sum + s.unreadCount, 0)
      })

      // Access computed to trigger initial computation
      expect(totalUnread.value).toBe(5)
      const initialCount = computeCount

      // Update by creating new array (our fix)
      const roomId = 'room1'
      const index = sessions.value.findIndex((s) => s.roomId === roomId)
      if (index !== -1) {
        const newList = [...sessions.value]
        newList[index] = { ...sessions.value[index], unreadCount: 10 }
        sessions.value = newList
      }
      await nextTick()

      // Access computed again
      const result = totalUnread.value

      // Verify update and reactivity
      expect(computeCount).toBeGreaterThan(initialCount)
      expect(sessions.value[0].unreadCount).toBe(10)
      expect(result).toBe(15)
    })

    it('should correctly add session by creating new array', async () => {
      interface SessionItem {
        roomId: string
        name: string
      }

      const sessions = ref<SessionItem[]>([
        { roomId: 'room1', name: 'Room 1' },
        { roomId: 'room2', name: 'Room 2' }
      ])

      let computeCount = 0
      const roomNames = computed(() => {
        computeCount++
        return sessions.value.map((s) => s.name)
      })

      // Access computed to trigger initial computation
      expect(roomNames.value).toEqual(['Room 1', 'Room 2'])
      const initialCount = computeCount

      // Add by creating new array (our fix)
      sessions.value = [...sessions.value, { roomId: 'room3', name: 'Room 3' }]
      await nextTick()

      // Access computed again
      const result = roomNames.value

      // Verify addition and reactivity
      expect(computeCount).toBeGreaterThan(initialCount)
      expect(sessions.value.length).toBe(3)
      expect(result).toEqual(['Room 1', 'Room 2', 'Room 3'])
    })
  })

  describe('Computed Property Chain Reactivity', () => {
    it('should trigger reactivity through computed chain', async () => {
      const source = ref<number[]>([1, 2, 3, 4, 5])

      // Level 1 computed
      const filtered = computed(() => source.value.filter((x) => x > 2))

      // Level 2 computed
      const doubled = computed(() => filtered.value.map((x) => x * 2))

      let level2ComputeCount = 0
      const sum = computed(() => {
        level2ComputeCount++
        return doubled.value.reduce((a, b) => a + b, 0)
      })

      // Access computed to trigger initial computation
      expect(sum.value).toBe(24) // (3 + 4 + 5) * 2 = 24
      const initialCount = level2ComputeCount

      // Modify source using our fix
      const newList = [...source.value]
      newList.splice(0, 1) // Remove first element (1)
      source.value = newList
      await nextTick()

      // Access computed again
      const result = sum.value

      // Verify entire chain updates
      expect(level2ComputeCount).toBeGreaterThan(initialCount)
      // After removing 1: [2, 3, 4, 5], filtered: [3, 4, 5], doubled: [6, 8, 10], sum: 24
      expect(result).toBe(24)
    })
  })

  describe('Performance Considerations', () => {
    it('should handle large arrays efficiently', async () => {
      // Simulate large session list
      const largeArray = ref<number[]>(Array.from({ length: 1000 }, (_, i) => i))

      let computeCount = 0
      const processed = computed(() => {
        computeCount++
        return largeArray.value.filter((x) => x % 2 === 0)
      })

      // Access computed to trigger initial computation
      expect(processed.value.length).toBe(500)
      const initialCount = computeCount

      // Delete middle element using our fix
      const newList = [...largeArray.value]
      newList.splice(500, 1)
      largeArray.value = newList
      await nextTick()

      // Access computed again
      const _result = processed.value

      // Verify correct behavior
      expect(computeCount).toBeGreaterThan(initialCount)
      expect(largeArray.value.length).toBe(999)
    })
  })
})
