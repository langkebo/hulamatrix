import { describe, it, expect, vi, beforeEach } from 'vitest'
import { safeAutoDiscovery } from '@/integrations/matrix/discovery'
import { matrixServerDiscovery } from '@/integrations/matrix/server-discovery'

// Mock the matrixServerDiscovery module
vi.mock('@/integrations/matrix/server-discovery', () => ({
  matrixServerDiscovery: {
    discover: vi.fn()
  }
}))

describe('discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('safeAutoDiscovery returns homeserverUrl', async () => {
    // Mock the discover method to return a valid result
    vi.mocked(matrixServerDiscovery.discover).mockResolvedValue({
      homeserverUrl: 'https://matrix.example.com',
      identityServerUrl: undefined,
      slidingSyncUrl: undefined,
      capabilities: {
        versions: ['v1.1'],
        unstableFeatures: {}
      },
      rawConfig: {
        'm.homeserver': { base_url: 'https://matrix.example.com' }
      },
      discovered: true,
      timestamp: Date.now()
    })

    const res = await safeAutoDiscovery('matrix.example.com')
    expect(res.homeserverUrl).toBe('https://matrix.example.com')
    expect(matrixServerDiscovery.discover).toHaveBeenCalledWith('matrix.example.com', {
      timeout: 10000,
      skipCache: false,
      validateCapabilities: true
    })
  })

  it('safeAutoDiscovery handles errors', async () => {
    // Mock the discover method to throw an error
    vi.mocked(matrixServerDiscovery.discover).mockRejectedValue(new Error('Network error'))

    await expect(safeAutoDiscovery('matrix.example.com')).rejects.toThrow('服务发现失败: Network error')
  })
})
