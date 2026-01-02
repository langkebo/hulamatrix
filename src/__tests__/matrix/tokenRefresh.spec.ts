import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildTokenRefreshFunction } from '@/integrations/matrix/auth'

describe('token refresh function', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('refreshes via /_matrix/client/v3/refresh and returns new tokens', async () => {
    const baseUrl = 'https://matrix.example.org'
    const refreshToken = 'r1'
    const newAccess = 'a2'
    const newRefresh = 'r2'
    const expires = 3600000

    const mockFetch = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: newAccess, refresh_token: newRefresh, expires_in_ms: expires })
    } as any)

    const fn = buildTokenRefreshFunction(baseUrl)
    const res = await fn(refreshToken)
    expect(mockFetch).toHaveBeenCalled()
    expect(res.access_token).toBe(newAccess)
    expect(res.refresh_token).toBe(newRefresh)
    expect(res.expires_in_ms).toBe(expires)
  })
})
