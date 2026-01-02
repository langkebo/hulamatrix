import { describe, it, expect, vi } from 'vitest'
import { mxcToHttp } from '@/integrations/matrix/mxc'
import { matrixClientService } from '@/integrations/matrix/client'

describe('mxcToHttp', () => {
  it('falls back to unauthenticated v3 when no client', () => {
    const url = mxcToHttp('mxc://server/id')
    expect(url).toContain('/_matrix/media/v3/')
  })

  it('uses client.mxcUrlToHttp when available (authenticated)', () => {
    const mockClient = {
      mxcUrlToHttp: vi.fn().mockReturnValue('https://hs/_matrix/client/v1/media/download/server/id')
    }
    ;(matrixClientService as any).client = mockClient
    const url = mxcToHttp('mxc://server/id', { authenticated: true })
    expect(url).toContain('/_matrix/client/v1/media/')
  })
})
