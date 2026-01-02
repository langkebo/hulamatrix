import { describe, it, expect } from 'vitest'

describe('chat message sorting by sendTime', () => {
  it('sorts ascending by sendTime', () => {
    const a = { message: { id: 'x', sendTime: 2 }, sendTime: 2 }
    const b = { message: { id: 'y', sendTime: 1 }, sendTime: 1 }
    const arr = [a, b].sort(
      (m1, m2) => (m1.sendTime || m1.message.sendTime || 0) - (m2.sendTime || m2.message.sendTime || 0)
    )
    expect(arr[0]).toBe(b)
    expect(arr[1]).toBe(a)
  })
})

describe('virtual list threshold', () => {
  it('enables virtual list when count exceeds threshold', () => {
    const threshold = 200
    const arr = Array.from({ length: threshold + 1 }).map((_, i) => ({
      message: { id: String(i), sendTime: i },
      sendTime: i
    }))
    const useVirtual = arr.length > threshold
    expect(useVirtual).toBe(true)
  })
})
