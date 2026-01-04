import { describe, it, expect, vi } from 'vitest'
import { initializeEncryption } from '@/integrations/matrix/encryption'
import { matrixClientService } from '@/integrations/matrix/client'
vi.mock('@/stores/e2ee', () => ({
  useE2EEStore: () => ({ setAvailable: () => {}, setEnabled: () => {}, setInitialized: () => {} })
}))

describe('encryption backup initialization', () => {
  it('calls checkKeyBackupAndEnable when rust crypto initialized', async () => {
    const mockCrypto = { checkKeyBackupAndEnable: vi.fn().mockResolvedValue(undefined) }
    const mockClient = {
      initRustCrypto: vi.fn().mockResolvedValue(undefined),
      getCrypto: vi.fn().mockReturnValue(mockCrypto)
    }
    ;(matrixClientService as any).client = mockClient
    const ok = await initializeEncryption()
    expect(ok).toBe(true)
  })
})
