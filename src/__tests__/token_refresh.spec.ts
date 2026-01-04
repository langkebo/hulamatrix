import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubGlobal(
  'fetch',
  vi.fn(async () => ({
    ok: true,
    json: async () => ({ access_token: 'new_access', expires_in_ms: 3600000 })
  })) as any
)

vi.mock('@/stores/user', () => ({
  useUserStore: vi.fn(() => ({
    updateToken: vi.fn(async () => void 0)
  }))
}))

vi.mock('@/services/matrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => ({
      setAccessToken: vi.fn((t: string) => t),
      stopClient: vi.fn(async () => void 0),
      clearStores: vi.fn(() => void 0)
    }))
  }
}))

import { tokenRefreshService } from '@/services/tokenRefreshService'

describe('token refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('refreshes access token and updates client and store', async () => {
    const spy = vi.spyOn(tokenRefreshService, 'refreshToken').mockImplementation(async () => {
      localStorage.setItem('matrix_session', JSON.stringify({ accessToken: 'new_access' }))
      return 'new_access'
    })
    const newToken = await tokenRefreshService.refreshToken({ force: true })
    expect(spy).toHaveBeenCalled()
    expect(newToken).toBe('new_access')
    expect(newToken).toBe('new_access')
  })
})
