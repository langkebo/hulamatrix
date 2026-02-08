/**
 * Vitest 测试设置文件
 *
 * 配置测试环境，包括：
 * - 全局 mocks
 * - 测试超时设置
 * - 环境变量
 */

import { vi, afterAll, afterEach } from 'vitest'

vi.setConfig({
  testTimeout: 10000
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

Object.defineProperty(window, 'Notification', {
  writable: true,
  value: {
    permission: 'default',
    requestPermission: vi.fn().mockResolvedValue('granted')
  }
})

Object.defineProperty(performance, 'memory', {
  writable: true,
  value: {
    usedJSHeapSize: 50 * 1024 * 1024,
    totalJSHeapSize: 100 * 1024 * 1024,
    jsHeapSizeLimit: 2 * 1024 * 1024 * 1024
  }
})

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

afterEach(() => {
  vi.clearAllMocks()
})

afterAll(() => {
  vi.restoreAllMocks()
})

export const createMockMatrixClient = () => ({
  getClient: vi.fn().mockReturnValue({
    getUserId: () => '@test:example.com',
    getRooms: () => [],
    getRoom: vi.fn(),
    getPushRules: vi.fn().mockResolvedValue({}),
    setPushRuleEnabled: vi.fn().mockResolvedValue({}),
    sendEvent: vi.fn().mockResolvedValue({ event_id: '$test' }),
    redactEvent: vi.fn().mockResolvedValue({}),
    sendReadReceipt: vi.fn().mockResolvedValue({})
  })
})

export const createMockRoom = (roomId: string = '!test:example.com') => ({
  roomId,
  name: 'Test Room',
  currentState: {
    getStateEvents: vi.fn().mockReturnValue([])
  },
  getLiveTimeline: vi.fn().mockReturnValue({
    getEvents: vi.fn().mockReturnValue([])
  })
})

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

vi.mock('../../src/services/matrix/MatrixClientService', () => ({
  default: {
    getInstance: () => ({
      getClient: () => null,
      isInitialized: () => false,
      initialize: vi.fn().mockResolvedValue(undefined)
    })
  },
  __esModule: true
}))

vi.mock('../../lib/matrix-sdk', () => ({
  createClient: vi.fn(),
  ClientEvent: {
    SyncToken: 'sync.token',
    Room: 'room'
  },
  AuthType: {
    Password: 'm.login.password',
    Dummy: 'm.login.dummy'
  },
  EventType: {
    Message: 'm.room.message',
    Encrypted: 'm.room.encrypted'
  },
  MatrixError: class MatrixError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'MatrixError'
    }
  },
  EventTimeline: {
    FORWARDS: 'forwards',
    BACKWARDS: 'backwards'
  },
  __esModule: true
}))

vi.mock('@/lib/matrix-sdk', () => ({
  createClient: vi.fn(),
  ClientEvent: {
    SyncToken: 'sync.token',
    Room: 'room'
  },
  AuthType: {
    Password: 'm.login.password',
    Dummy: 'm.login.dummy'
  },
  EventType: {
    Message: 'm.room.message',
    Encrypted: 'm.room.encrypted'
  },
  MatrixError: class MatrixError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'MatrixError'
    }
  },
  EventTimeline: {
    FORWARDS: 'forwards',
    BACKWARDS: 'backwards'
  },
  __esModule: true
}))
