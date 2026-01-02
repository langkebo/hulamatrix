import { describe, it, expect } from 'vitest'
import { averageBetweenStrings, nextString, prevString } from '@/integrations/matrix/order-utils'

describe('order-utils', () => {
  it('generates next string', () => {
    expect(nextString('A')).toBe('B')
  })
  it('generates prev string', () => {
    expect(prevString('B')).toBe('A')
  })
  it('averages between strings', () => {
    const mid = averageBetweenStrings('A', 'C')
    expect(typeof mid).toBe('string')
    expect(mid.length).toBeGreaterThan(0)
  })
})
