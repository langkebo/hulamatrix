import { describe, it, expect, vi } from 'vitest'
import { useMatrixAuthStore } from '@/stores/matrixAuth'
import { AutoDiscovery } from 'matrix-js-sdk'

// Type for the AutoDiscovery class with static methods
type AutoDiscoveryClass = {
  findClientConfig: (domain: string) => Promise<Record<string, { base_url: string }>>
}

describe('useMatrixAuth service discovery login init', () => {
  it('applies custom server via discovery', async () => {
    vi.spyOn(AutoDiscovery as unknown as AutoDiscoveryClass, 'findClientConfig').mockResolvedValue({
      'm.homeserver': { base_url: 'https://matrix.example.com' }
    })
    const store = useMatrixAuthStore()
    store.setCustomServer('matrix.example.com')
    await store.discover()
    expect(store.getHomeserverBaseUrl()).toEqual(expect.stringContaining('matrix'))
  })
})
