/**
 * MatrixClientService Mock
 *
 * 用于测试的 MatrixClientService mock
 */

import { vi } from 'vitest'

export const mockMatrixClient = {
  getClient: vi.fn().mockReturnValue(null),
  isInitialized: vi.fn().mockReturnValue(false),
  initialize: vi.fn().mockResolvedValue(undefined)
}

export const mockClientInstance = {
  getUserId: () => '@test:example.com',
  getRooms: () => [],
  getRoom: vi.fn(),
  getPushRules: vi.fn().mockResolvedValue({}),
  setPushRuleEnabled: vi.fn().mockResolvedValue({}),
  sendEvent: vi.fn().mockResolvedValue({ event_id: '$test' }),
  redactEvent: vi.fn().mockResolvedValue({}),
  sendReadReceipt: vi.fn().mockResolvedValue({})
}

export default {
  getInstance: () => mockMatrixClient
}
