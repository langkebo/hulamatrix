/**
 * 测试工具函数
 * 帮助测试文件适应新的 Store 结构
 */

import { createPinia, setActivePinia } from 'pinia'
import type { MatrixClient } from 'matrix-js-sdk'

// Mock Matrix Client
export const createMockMatrixClient = (overrides: Partial<MatrixClient> = {}) => {
  return {
    getUserId: () => '@test:example.org',
    getProfileInfo: () =>
      Promise.resolve({
        displayname: 'Test User',
        avatar_url: ''
      }),
    getJoinedRooms: () =>
      Promise.resolve({
        joined_rooms: ['!room1:example.org', '!room2:example.org']
      }),
    getRoom: (roomId: string) => ({
      roomId,
      name: `Room ${roomId}`,
      getAvatarUrl: () => '',
      isDirectRoom: () => false,
      getJoinedMemberCount: () => 2,
      hasEncryptionState: () => false,
      getUnreadNotificationCount: () => 0
    }),
    sendEvent: () => Promise.resolve({}),
    on: () => {},
    off: () => {},
    login: () =>
      Promise.resolve({
        access_token: 'mock-token',
        user_id: '@test:example.org',
        device_id: 'mock-device'
      }),
    sync: () => Promise.resolve(),
    ...overrides
  } as unknown as MatrixClient
}

// 创建测试用的 Pinia 实例
export function createTestPinia() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return pinia
}

// 测试数据生成器
export class TestDataGenerator {
  static createUser(overrides: Partial<any> = {}) {
    return {
      uid: 'user-1',
      username: 'testuser',
      avatar: '',
      displayName: 'Test User',
      status: 'online',
      ...overrides
    }
  }

  static createRoom(overrides: Partial<any> = {}) {
    return {
      id: '!room1:example.org',
      name: 'Test Room',
      avatar: '',
      type: (overrides.type ?? 'group') as 'dm' | 'group' | 'space',
      memberCount: 2,
      topic: 'Test Topic',
      isEncrypted: false,
      unreadCount: 0,
      ...overrides
    }
  }

  static createMessage(overrides: Partial<any> = {}) {
    return {
      id: 'msg-1',
      roomId: '!room1:example.org',
      sender: '@user1:example.org',
      content: { body: 'Test message' },
      timestamp: Date.now(),
      type: 'm.text',
      status: 'sent' as 'sent',
      ...overrides
    }
  }

  static createNotification(overrides: Partial<any> = {}) {
    return {
      id: 'notif-1',
      type: (overrides.type ?? 'message') as 'message' | 'group' | 'friend' | 'system',
      title: 'New Message',
      content: 'You have a new message',
      timestamp: Date.now(),
      read: false,
      priority: (overrides.priority ?? 'normal') as 'normal' | 'high' | 'low',
      ...overrides
    }
  }

  static createMediaFile(overrides: Partial<any> = {}) {
    return {
      id: 'media-1',
      type: 'image',
      name: 'test.jpg',
      size: 1024,
      url: 'https://example.com/test.jpg',
      mimeType: 'image/jpeg',
      ...overrides
    }
  }
}

// 测试环境设置
export async function setupTestEnvironment() {
  // 创建 Pinia
  const pinia = createTestPinia()

  // Mock Tauri API
  ;(global as any).__TAURI__ = {
    invoke: () => Promise.resolve(),
    listen: () => Promise.resolve()
  }

  // Mock fetch API
  global.fetch = vi.fn()

  return { pinia }
}

// 测试清理
export async function cleanupTestEnvironment() {
  // 清理 Pinia
  const pinia = getActivePinia()
  if (pinia) {
    pinia._s.forEach((store: any) => {
      if (store && typeof store.$dispose === 'function') store.$dispose()
    })
  }

  // 清理 mocks
  vi.clearAllMocks()
}

// 性能测试工具
export class PerformanceTestHelper {
  private startTime: number = 0
  private measures: Array<{ name: string; duration: number }> = []

  start(label: string) {
    void label
    this.startTime = performance.now()
  }

  end(label: string): number {
    const duration = performance.now() - this.startTime
    this.measures.push({ name: label, duration })
    return duration
  }

  measure<T>(label: string, fn: () => T): { result: T; duration: number } {
    this.start(label)
    const result = fn()
    const duration = this.end(label)
    // Create a wrapper object that always has duration
    return { result, duration }
  }

  // Convenience method for functions without return value
  measureDuration(label: string, fn: () => void): number {
    this.start(label)
    fn()
    return this.end(label)
  }

  async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    this.start(label)
    const result = await fn()
    const duration = this.end(label)
    // Return result with duration property
    return { result, duration }
  }

  getReport() {
    return {
      totalMeasures: this.measures.length,
      averageDuration:
        this.measures.length > 0 ? this.measures.reduce((sum, m) => sum + m.duration, 0) / this.measures.length : 0,
      slowestMeasure:
        this.measures.length > 0
          ? this.measures.reduce((max, m) => (m.duration > max.duration ? m : max))
          : { name: 'none', duration: 0 },
      measures: this.measures
    }
  }

  assertPerformance(label: string, maxDuration: number) {
    const measure = this.measures.find((m) => m.name === label)
    if (measure && measure.duration > maxDuration) {
      throw new Error(`Performance assertion failed: ${label} took ${measure.duration}ms, expected < ${maxDuration}ms`)
    }
  }
}

// 异步测试辅助函数
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new Error('Condition not met within timeout')
}

// Convenience functions for creating test data
export const createTestUser = TestDataGenerator.createUser
export const createTestRoom = TestDataGenerator.createRoom
export const createTestMessage = TestDataGenerator.createMessage
export const createTestMessages = (count: number, overrides: Partial<any> = {}) => {
  return Array.from({ length: count }, (_, i) =>
    TestDataGenerator.createMessage({
      id: `msg-${i}`,
      content: { body: `Test message ${i}` },
      ...overrides
    })
  )
}
export const createTestNotification = TestDataGenerator.createNotification

// 事件触发辅助
export function createEventEmitter() {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>()

  return {
    on(event: string, callback: (...args: unknown[]) => void) {
      if (!listeners.has(event)) {
        listeners.set(event, [])
      }
      listeners.get(event)!.push(callback)
    },

    off(event: string, callback: (...args: unknown[]) => void) {
      const eventListeners = listeners.get(event)
      if (eventListeners) {
        const index = eventListeners.indexOf(callback)
        if (index > -1) {
          eventListeners.splice(index, 1)
        }
      }
    },

    emit(event: string, ...args: unknown[]) {
      const eventListeners = listeners.get(event)
      if (eventListeners) {
        eventListeners.forEach((callback) => callback(...args))
      }
    }
  }
}

// 导入类型
type ActivePinia = any

function getActivePinia(): ActivePinia | undefined {
  return (globalThis as any).__pinia
}
