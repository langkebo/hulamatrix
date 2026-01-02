import { describe, it, expect, vi } from 'vitest'

vi.mock('@/integrations/matrix/client', () => {
  return {
    matrixClientService: {
      getClient: () => ({
        searchRoomEvents: vi.fn(async (_body: any) => ({ search_results: [{ result: { event_id: '$e1' } }] }))
      })
    }
  }
})

describe('matrix search adapter', () => {
  it('searchRoomText returns results', async () => {
    const { searchRoomText } = await import('@/integrations/matrix/search')
    const resp = await searchRoomText('!room', 'hello')
    expect(Array.isArray(resp.results)).toBe(true)
    expect(resp.results.length > 0).toBe(true)
  })
})
