import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Tauri invoke to prevent actual native calls
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock the auth module
vi.mock('@/integrations/matrix/auth', () => ({
  buildTokenRefreshFunction: vi.fn()
}))

// Track createClient calls
const createClientMock = vi.fn()

// Mock matrix-js-sdk completely to prevent any real network calls
const mockClient = {
  loginWithPassword: vi.fn().mockResolvedValue({
    access_token: 'mock-token',
    user_id: '@testuser:matrix.example.com',
    device_id: 'mock-device-id',
    home_server: 'matrix.example.com'
  }),
  startClient: vi.fn().mockResolvedValue(undefined),
  stopClient: vi.fn().mockResolvedValue(undefined),
  removeAllListeners: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn()
}

vi.mock('matrix-js-sdk', () => ({
  createClient: createClientMock,
  AutoDiscovery: {
    findClientConfig: vi.fn().mockResolvedValue({
      'm.homeserver': { base_url: 'https://matrix.example.com' }
    })
  }
}))

// Set up mock to return mockClient
createClientMock.mockImplementation(() => mockClient)

describe('matrix client service', () => {
  beforeEach(async () => {
    // Reset all mocks before each test
    vi.clearAllMocks()
    // Reset the mock implementation
    createClientMock.mockImplementation(() => mockClient)

    // Reset the service before each test
    const { matrixClientService } = await import('@/integrations/matrix/client')
    try {
      await matrixClientService.stopClient()
    } catch (_error) {
      // Ignore errors if client is not initialized
    }
  })

  it('login with password returns tokens', async () => {
    // Import after mocking to ensure mocks are applied
    const { matrixClientService } = await import('@/integrations/matrix/client')

    matrixClientService.setBaseUrl('https://matrix.example.com')

    const res = await matrixClientService.loginWithPassword('testuser', 'testpass')

    expect(res).toBeDefined()
    expect(res.access_token).toBe('mock-token')
    expect(res.user_id).toBe('@testuser:matrix.example.com')
    expect(res.device_id).toBe('mock-device-id')
    expect(res.home_server).toBe('matrix.example.com')
  })

  it('throws error when baseUrl is not set', async () => {
    const { matrixClientService } = await import('@/integrations/matrix/client')

    // Reset to ensure no baseUrl is set
    matrixClientService.setBaseUrl('')

    await expect(matrixClientService.loginWithPassword('user', 'pass')).rejects.toThrow('Matrix baseUrl is not set')
  })

  it('reuses existing client when already initialized', async () => {
    const { matrixClientService } = await import('@/integrations/matrix/client')

    matrixClientService.setBaseUrl('https://matrix.example.com')

    // First login
    const res1 = await matrixClientService.loginWithPassword('user1', 'pass1')
    const client1 = matrixClientService.getClient()

    // Second login should reuse the same client
    const res2 = await matrixClientService.loginWithPassword('user2', 'pass2')
    const client2 = matrixClientService.getClient()

    // Same client instance should be returned
    expect(client1).toBe(client2)

    // Both logins should succeed
    expect(res1).toBeDefined()
    expect(res2).toBeDefined()
  })
})
