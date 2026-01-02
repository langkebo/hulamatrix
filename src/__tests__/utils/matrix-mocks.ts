/**
 * Matrix测试统一Mock模板
 * 提供标准化的Matrix相关测试mock配置
 */

import { vi } from 'vitest'

// 基础Matrix Room对象
export const createMockRoom = (overrides: any = {}) => ({
  roomId: '!test:room.example.com',
  name: 'Test Room',
  topic: 'Test Topic',
  getMyMembership: vi.fn(() => 'join'),
  getJoinedMembers: vi.fn(() => [
    { userId: '@user1:example.com', membership: 'join' },
    { userId: '@user2:example.com', membership: 'join' }
  ]),
  getAvatarUrl: vi.fn(() => 'mxc://example.com/avatar'),
  getLastEvent: vi.fn(() => null),
  getLiveTimeline: vi.fn(() => ({
    getEvents: vi.fn(() => [])
  })),
  ...overrides
})

// Matrix Client Mock
export const createMatrixClientMock = (overrides: any = {}) => {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {}

  const client = {
    // 基础方法
    getUserId: vi.fn(() => '@test:example.com'),
    getHomeserverUrl: vi.fn(() => 'https://matrix.example.com'),
    getRoom: vi.fn(),
    getRooms: vi.fn(() => []),

    // 事件监听
    on: vi.fn((name: string, cb: (...args: unknown[]) => void) => {
      listeners[name] = listeners[name] || []
      listeners[name].push(cb)
    }),
    off: vi.fn((name: string, cb: (...args: unknown[]) => void) => {
      if (listeners[name]) {
        listeners[name] = listeners[name].filter((listener) => listener !== cb)
      }
    }),

    // 事件发送
    emit: vi.fn((name: string, ...args: unknown[]) => {
      if (listeners[name]) {
        listeners[name].forEach((cb) => cb(...args))
      }
    }),

    // 推送规则相关
    getPushRules: vi.fn().mockResolvedValue({
      global: {
        override: [],
        content: [],
        room: [],
        sender: [],
        underride: []
      },
      device: {}
    }),
    setPushRuleEnabled: vi.fn().mockResolvedValue(undefined),
    addPushRule: vi.fn().mockResolvedValue(undefined),
    deletePushRule: vi.fn().mockResolvedValue(undefined),

    // 搜索相关
    searchRoomEvents: vi.fn(),
    searchUserDirectory: vi.fn(),

    // 房间操作
    sendEvent: vi.fn().mockResolvedValue({ event_id: '$test:event' }),
    sendTextMessage: vi.fn(),
    sendReadReceipt: vi.fn(),

    // WebRTC相关
    createCall: vi.fn(),

    // 持久化
    startClient: vi.fn(),
    stopClient: vi.fn(),

    ...overrides
  }

  // 添加事件触发器
  client.triggerEvent = (name: string, ...args: unknown[]) => {
    client.emit(name, ...args)
  }

  return client
}

// Matrix Client Service Mock
export const createMatrixClientServiceMock = (clientOverrides?: any) => {
  const client = createMatrixClientMock(clientOverrides)

  return {
    getClient: vi.fn(() => client),
    setBaseUrl: vi.fn(),
    getBaseUrl: vi.fn(() => 'https://matrix.example.com'),
    registerWithPassword: vi.fn().mockResolvedValue({
      access_token: 'test-token',
      user_id: '@test:example.com',
      device_id: 'test-device'
    }),
    initialize: vi.fn(),
    startClient: vi.fn(),
    stopClient: vi.fn(),
    logout: vi.fn()
  }
}

// Room事件Mock
export const createMockEvent = (overrides: any = {}) => ({
  event_id: '$test:event:example.com',
  room_id: '!test:room.example.com',
  sender: '@test:example.com',
  type: 'm.room.message',
  origin_server_ts: Date.now(),
  content: {
    msgtype: 'm.text',
    body: 'Test message'
  },
  ...overrides
})

// WebRTC Mock
export const createMockRTCPeerConnection = () => {
  const mockCreateOffer = vi.fn().mockResolvedValue({
    type: 'offer',
    sdp: 'test-sdp'
  })
  const mockCreateAnswer = vi.fn().mockResolvedValue({
    type: 'answer',
    sdp: 'test-answer-sdp'
  })
  const mockSetLocalDescription = vi.fn().mockResolvedValue(undefined)
  const mockSetRemoteDescription = vi.fn().mockResolvedValue(undefined)
  const mockAddTrack = vi.fn()
  const mockGetStats = vi.fn().mockResolvedValue(
    new Map([
      [
        'inbound-rtp-video',
        {
          type: 'inbound-rtp',
          mediaType: 'video',
          bytesReceived: 1000,
          packetsReceived: 10
        }
      ],
      [
        'outbound-rtp-video',
        {
          type: 'outbound-rtp',
          mediaType: 'video',
          bytesSent: 500,
          packetsSent: 5
        }
      ]
    ])
  )

  return vi.fn().mockImplementation(() => ({
    createOffer: mockCreateOffer,
    setLocalDescription: mockSetLocalDescription,
    createAnswer: mockCreateAnswer,
    setRemoteDescription: mockSetRemoteDescription,
    addTrack: mockAddTrack,
    getStats: mockGetStats
  }))
}

// Mock MediaDevices
export const createMockMediaDevices = () => ({
  getUserMedia: vi.fn().mockResolvedValue({
    getTracks: vi.fn(() => [{ enabled: true, stop: vi.fn() }])
  }),
  getDisplayMedia: vi.fn().mockResolvedValue({
    getTracks: vi.fn(() => [{ stop: vi.fn() }])
  })
})

// Mock Store实例
export const createMockStore = (storeName: string, overrides: any = {}) => {
  return {
    // 通用store属性
    $id: Symbol(storeName),
    $onAction: vi.fn(),
    $patch: vi.fn(),
    $reset: vi.fn(),
    $subscribe: vi.fn(),
    $state: {},

    ...overrides
  }
}

// Pinia Mock
export const createPiniaMock = () => {
  const stores = new Map()

  return {
    install: vi.fn(),
    use: vi.fn((id) => {
      if (!stores.has(id)) {
        stores.set(id, createMockStore(String(id)))
      }
      return stores.get(id)
    }),
    _s: stores,
    get activePinia() {
      return { _s: stores }
    },
    setActivePinia: vi.fn()
  }
}

// 测试工具函数
export const setupTestEnvironment = async () => {
  const { createPinia, setActivePinia } = await import('pinia')
  const pinia = createPinia()
  setActivePinia(pinia)

  return { pinia }
}

// 清理函数
export const cleanupMockEnvironment = () => {
  vi.clearAllMocks()
  vi.clearAllTimers()
  vi.useRealTimers()
}
