/**
 * 全局测试设置文件
 * 为所有测试提供通用的mock和配置
 */

import { vi } from 'vitest'

// CRITICAL: Mock Vue Router FIRST before any imports that might use it
// This prevents lazy loading issues in tests
vi.mock('@/router', () => ({
  default: {
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    currentRoute: { value: { path: '/', name: 'home' } },
    addRoute: vi.fn(),
    removeRoute: vi.fn(),
    hasRoute: vi.fn(),
    getRoutes: vi.fn(() => []),
    resolve: vi.fn(() => ({ href: '/' })),
    isReady: vi.fn(() => Promise.resolve())
  }
}))

import { config } from '@vue/test-utils'
import { logger } from '@/utils/logger'

;(globalThis as any).fetch = vi.fn(async () => {
  return {
    ok: false,
    status: 599,
    statusText: 'Mocked fetch in tests',
    url: 'http://localhost:3000/__mock_fetch__',
    headers: { get: () => '' },
    json: async () => ({}),
    text: async () => ''
  } as any
})

// 全局Vue测试工具配置
config.global.stubs = {
  // 可以在这里添加全局的组件stub
} as any

// 模拟小程序环境
;(globalThis as any).uni = {
  getStorageSync: vi.fn(() => null),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  clearStorageSync: vi.fn(),
  getSystemInfoSync: vi.fn(() => ({
    platform: 'h5',
    version: '1.0.0'
  })),
  navigateTo: vi.fn(),
  navigateBack: vi.fn(),
  redirectTo: vi.fn(),
  switchTab: vi.fn(),
  reLaunch: vi.fn(),
  preloadPage: vi.fn(),
  showToast: vi.fn(),
  hideToast: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
  showModal: vi.fn(),
  hideModal: vi.fn(),
  showActionSheet: vi.fn(),
  showNavigationBarLoading: vi.fn(),
  hideNavigationBarLoading: vi.fn(),
  navigateToMiniProgram: vi.fn(),
  requestPayment: vi.fn(),
  login: vi.fn(),
  getUserInfo: vi.fn(),
  request: vi.fn(),
  uploadFile: vi.fn(),
  downloadFile: vi.fn()
} as any

// 模拟浏览器API
declare global {
  var localStorage: Storage
  var sessionStorage: Storage
}

;(globalThis as any).localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

;(globalThis as any).sessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

// 模拟Worker
;(globalThis as any).Worker = class {
  onmessage: any = null
  onerror: any = null
  postMessage = vi.fn()
  terminate = vi.fn()
  addEventListener = vi.fn()
  removeEventListener = vi.fn()
  dispatchEvent = vi.fn()
}

// 模拟navigator
;(globalThis as any).navigator = {
  userAgent: 'vitest',
  platform: 'test',
  language: 'en',
  languages: ['en']
}

// 模拟window对象的其他属性
;(globalThis as any).requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => setTimeout(cb, 16))
;(globalThis as any).cancelAnimationFrame = vi.fn()

// 模拟console方法以避免测试输出污染
const originalConsole = { ...console }
;(globalThis as any).console = {
  ...originalConsole,
  // 保留error和warn，但可以按需要调整
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn()
}

// 在所有测试之前运行
beforeEach(async () => {
  // 设置 Pinia 测试环境
  const { createPinia, setActivePinia } = await import('pinia')
  const pinia = createPinia()
  setActivePinia(pinia)

  // 清除所有mock调用历史，但保留mock实现
  vi.clearAllMocks()

  // 重置localStorage（jsdom 提供真实的 localStorage 实现）
  localStorage.clear()
  sessionStorage.clear()
})

// 在所有测试之后运行
afterEach(() => {
  // 清理定时器
  vi.clearAllTimers()
})

// Mock Tauri APIs
;(globalThis as any).__TAURI__ = {
  invoke: vi.fn(async () => undefined),
  listen: vi.fn(async () => undefined),
  emit: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn()
}

// Mock PlatformConstants
vi.mock('@/utils/PlatformConstants', () => {
  const isMac = () => true
  const isWindows = () => false
  const isLinux = () => false
  const isAndroid = () => false
  const isIOS = () => false
  const isDesktop = () => true
  const isMobile = () => false
  const isCompatibility = () => false
  const getOSType = () => 'macos' as const
  const getPlatformType = () => 'desktop' as const
  const Platform = {
    isMac,
    isWindows,
    isLinux,
    isAndroid,
    isIOS,
    isDesktop,
    isMobile,
    isCompatibility,
    getOSType,
    getPlatformType
  }
  return {
    isMac,
    isWindows,
    isLinux,
    isAndroid,
    isIOS,
    isDesktop,
    isMobile,
    isCompatibility,
    getOSType,
    getPlatformType,
    Platform,
    usePlatformConstants: () => Platform,
    initializePlatform: () => {}
  }
})

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => undefined)
}))

// Enhanced Tauri API mocks for window/webview access
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    label: 'test-window',
    title: 'Test',
    url: 'http://localhost:3000',
    metadata: { test: true }
  }))
}))

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: vi.fn(() => ({
    label: 'test-webview'
  }))
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: vi.fn(() => ({
    label: 'test-webview-window',
    title: 'Test Window',
    url: 'http://localhost:3000',
    metadata: { test: true },
    listen: vi.fn(),
    emit: vi.fn()
  })),
  WebviewWindow: {
    getCurrent: vi.fn(() => ({
      label: 'home',
      title: 'Home',
      url: 'http://localhost:3000'
    }))
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: (...args: any[]) => {
    // eslint-disable-next-line no-console
    logger.info('[tauri-log]', ...args)
  },
  debug: (...args: any[]) => logger.debug('[tauri-log]', ...args),
  error: (...args: any[]) => logger.error('[tauri-log]', ...args),
  warn: (...args: any[]) => logger.warn('[tauri-log]', ...args)
}))

// Minimal browser APIs for performance tests
;(globalThis as any).Notification = () => {}

// Enhanced performance mock with more precise timing
let performanceOffset = 0
const performanceMarks = new Map<string, number>()

;(globalThis as any).performance = (globalThis as any).performance || {
  now: () => {
    // Simulate high-resolution timestamp with microsecond precision
    return Date.now() * 1000 + performanceOffset
  },
  mark: (name: string) => {
    performanceMarks.set(name, Date.now() * 1000 + performanceOffset)
  },
  measure: (_name: string, startMark?: string, endMark?: string) => {
    const startTime = startMark ? performanceMarks.get(startMark) || 0 : 0
    const endTime = endMark
      ? performanceMarks.get(endMark) || Date.now() * 1000 + performanceOffset
      : Date.now() * 1000 + performanceOffset
    return endTime - startTime
  },
  // Memory API for memory usage tests
  memory: {
    usedJSHeapSize: 10 * 1024 * 1024, // 10MB initial
    totalJSHeapSize: 20 * 1024 * 1024, // 20MB total
    jsHeapSizeLimit: 2048 * 1024 * 1024 // 2GB limit
  },
  // Add time travel for testing
  timeTravel: (ms: number) => {
    performanceOffset += ms * 1000
  }
}

// Mock Matrix SDK
vi.mock('matrix-js-sdk', () => ({
  createClient: vi.fn(() => ({
    login: vi.fn(() =>
      Promise.resolve({
        access_token: 'mock-token',
        user_id: '@u:matrix.org',
        device_id: 'mock-device'
      })
    ),
    startClient: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getRooms: vi.fn(() => []),
    getRoom: vi.fn(() => ({
      name: 'Mock Room',
      getAvatarUrl: vi.fn(() => ''),
      isDirectRoom: vi.fn(() => false),
      getJoinedMemberCount: vi.fn(() => 2),
      hasEncryptionState: vi.fn(() => false),
      getUnreadNotificationCount: vi.fn(() => 0)
    })),
    getJoinedRooms: vi.fn(() =>
      Promise.resolve({
        joined_rooms: ['!room1:example.org']
      })
    ),
    getProfileInfo: vi.fn(() =>
      Promise.resolve({
        displayname: 'Test User',
        avatar_url: ''
      })
    ),
    sendEvent: vi.fn(() => Promise.resolve({})),
    sendStateEvent: vi.fn(() => Promise.resolve({})),
    sendTextMessage: vi.fn(() => Promise.resolve({})),
    sendReadReceipt: vi.fn(() => Promise.resolve()),
    sendTypingEvent: vi.fn(() => Promise.resolve()),
    joinRoom: vi.fn(() => Promise.resolve({})),
    leaveRoom: vi.fn(() => Promise.resolve({})),
    invite: vi.fn(() => Promise.resolve({})),
    setAccountData: vi.fn(() => Promise.resolve({}))
  })),
  AutoDiscovery: {
    findClientConfig: vi.fn(async (serverName: string) => ({
      'm.homeserver': { base_url: `https://${serverName}` }
    }))
  },
  default: {
    createClient: vi.fn(() => ({
      startClient: vi.fn(),
      on: vi.fn(),
      off: vi.fn()
    }))
  }
}))

// Ensure matrixClientService has a client in test env
// 提供一个可用的本地事件总线客户端（不注入到服务，供个别测试直接使用）
const __listeners: Record<string, ((...args: any[]) => void)[]> = {}
export const __mockClient = {
  sendEvent: vi.fn(async () => ({})),
  redactEvent: vi.fn(async () => ({})),
  relations: vi.fn(async () => ({ events: [] })),
  getUserId: vi.fn(() => '@u:matrix.org'),
  on: vi.fn((event: string, handler: (...args: any[]) => void) => {
    __listeners[event] = __listeners[event] || []
    __listeners[event].push(handler)
  }),
  off: vi.fn((event: string, handler: (...args: any[]) => void) => {
    const arr = __listeners[event]
    if (!arr) return
    const i = arr.indexOf(handler)
    if (i >= 0) arr.splice(i, 1)
  }),
  emit: vi.fn((event: string, ...args: any[]) => {
    const arr = __listeners[event] || []
    for (const fn of arr) {
      try {
        fn(...args)
      } catch {}
    }
  })
} as any

// Mock Naive UI components
vi.mock('naive-ui', () => ({
  NButton: { template: '<button><slot /></button>' },
  NInput: { template: '<input />' },
  NModal: { template: '<div><slot /></div>' },
  NCard: { template: '<div><slot /></div>' },
  NSpace: { template: '<div><slot /></div>' },
  NFlex: { template: '<div><slot /></div>' },
  NBadge: { template: '<div><slot /></div>' },
  NIcon: { template: '<div><slot /></div>' },
  NSpin: { template: '<div><slot /></div>' },
  NResult: { template: '<div><slot /></div>' },
  NMessageProvider: { template: '<div><slot /></div>' },
  NNotificationProvider: { template: '<div><slot /></div>' },
  NDialogProvider: { template: '<div><slot /></div>' },
  NModalProvider: { template: '<div><slot /></div>' },
  useMessage: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  }),
  useDialog: () => ({
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn()
  })
}))
