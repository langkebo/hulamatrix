import { describe, it, expect, vi } from 'vitest'
import * as sdk from 'matrix-js-sdk'
import { safeAutoDiscovery } from '@/integrations/matrix/discovery'

describe('discovery', () => {
  it('safeAutoDiscovery returns homeserverUrl', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ versions: ['v1.1'], unstable_features: {} })
    })
    global.fetch = mockFetch as any
    vi.spyOn(sdk.AutoDiscovery as any, 'findClientConfig').mockResolvedValue({
      'm.homeserver': { base_url: 'https://matrix.example.com' }
    })
    const res = await safeAutoDiscovery('matrix.example.com')
    expect(res.homeserverUrl).toBe('https://matrix.example.com')
  })
})
