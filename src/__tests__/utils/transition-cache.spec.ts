import { describe, it, expect } from 'vitest'
import { TransitionCacheManager } from '@/utils/transition-cache'

describe('transition-cache', () => {
  it('returns matrix first then websocket fallback', () => {
    const c = new TransitionCacheManager()
    c.setWebSocket('k', 'v')
    expect(c.get('k')).toBe('v')
    c.setMatrix('k', 'm')
    expect(c.get('k')).toBe('m')
  })
})
