/**
 * Matrix测试标准化模板
 * 提供统一的测试模式和工具函数
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createMatrixClientServiceMock,
  createMockRoom,
  createMockEvent,
  createMockRTCPeerConnection,
  createMockMediaDevices,
  createMockStore,
  setupTestEnvironment,
  cleanupMockEnvironment
} from './matrix-mocks'

/**
 * 创建标准的Matrix测试描述块
 */
export const createMatrixTestSuite = (
  suiteName: string,
  testDefinitions: {
    [key: string]: {
      description: string
      timeout?: number
      testFn: (context: MatrixTestContext) => Promise<void> | void
    }
  }
) => {
  describe(suiteName, () => {
    let context: MatrixTestContext

    beforeEach(async () => {
      // 设置测试环境
      const { pinia } = await setupTestEnvironment()

      // 创建mock client service
      const mockClient = createMatrixClientServiceMock()
      vi.doMock('@/integrations/matrix/client', () => ({
        matrixClientService: mockClient
      }))

      // 创建测试上下文
      context = {
        mockClient,
        pinia,
        mockRoom: createMockRoom(),
        mockEvent: createMockEvent(),
        mockRTCConnection: createMockRTCPeerConnection(),
        mockMediaDevices: createMockMediaDevices(),
        cleanup: () => cleanupMockEnvironment()
      }

      // 设置全局Mock
      ;(globalThis as any).Worker = class MockWorker {
        onmessage: any = null
        onerror: any = null
        postMessage = vi.fn()
        terminate = vi.fn()
        addEventListener = vi.fn()
        removeEventListener = vi.fn()
        dispatchEvent = vi.fn()
      } as any

      ;(globalThis as any).RTCPeerConnection = context.mockRTCConnection
      ;(globalThis as any).navigator = {
        mediaDevices: context.mockMediaDevices,
        userAgent: 'vitest'
      } as any
    })

    afterEach(() => {
      context?.cleanup?.()
    })

    // 运行所有测试
    for (const [_key, testDef] of Object.entries(testDefinitions)) {
      const testName = testDef.description
      const timeout = testDef.timeout || 5000

      it(testName, { timeout }, async () => {
        await testDef.testFn(context)
      })
    }
  })
}

/**
 * Matrix测试上下文接口
 */
export interface MatrixTestContext {
  mockClient: any
  pinia: any
  mockRoom: any
  mockEvent: any
  mockRTCConnection: any
  mockMediaDevices: any
  cleanup?: () => void
}

/**
 * 创建异步测试等待函数
 */
export const waitFor = (
  condition: () => boolean,
  timeout = 5000,
  message = 'Condition not met within timeout'
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()

    const check = () => {
      if (condition()) {
        resolve()
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(message))
      } else {
        setTimeout(check, 50)
      }
    }

    check()
  })
}

/**
 * 创建Matrix事件触发器
 */
export const triggerMatrixEvent = (context: MatrixTestContext, eventType: string, eventData?: any) => {
  context.mockClient.triggerEvent(eventType, eventData || {})
}

/**
 * 验证Matrix客户端调用
 */
export const expectMatrixClientCalled = (context: MatrixTestContext, method: string, ...args: unknown[]) => {
  expect(context.mockClient[method]).toHaveBeenCalledWith(...args)
}

/**
 * 创建Mock Store的辅助函数
 */
export const createStore = (storeName: string, overrides: any = {}, context?: MatrixTestContext) => {
  return createMockStore(storeName, {
    _pinia: context?.pinia,
    ...overrides
  })
}

/**
 * 标准化的Matrix消息测试模式
 */
export const createMatrixMessageTest = (testName: string, testFn: (context: MatrixTestContext) => Promise<void>) => {
  return {
    description: testName,
    testFn: async (context: MatrixTestContext) => {
      // 设置默认的房间和事件
      const room = createMockRoom({
        roomId: '!test:message:example.com'
      })
      context.mockClient.getRoom.mockReturnValue(room)

      // 运行用户测试函数
      await testFn(context)
    }
  }
}

/**
 * 标准化的Matrix搜索测试模式
 */
export const createMatrixSearchTest = (testName: string, testFn: (context: MatrixTestContext) => Promise<void>) => {
  return {
    description: testName,
    testFn: async (context: MatrixTestContext) => {
      // 设置搜索结果的默认返回
      context.mockClient.searchRoomEvents.mockResolvedValue({
        results: []
      })

      // 运行用户测试函数
      await testFn(context)
    }
  }
}

/**
 * 标准化的Matrix RTC测试模式
 */
export const createMatrixRTCTest = (testName: string, testFn: (context: MatrixTestContext) => Promise<void>) => {
  return {
    description: testName,
    testFn: async (context: MatrixTestContext) => {
      // 重置RTC mocks
      context.mockRTCConnection.mockClear()
      context.mockMediaDevices.getUserMedia.mockClear()
      context.mockMediaDevices.getDisplayMedia.mockClear()

      // 设置默认值
      context.mockMediaDevices.getUserMedia.mockResolvedValue({
        getTracks: vi.fn(() => [{ enabled: true, stop: vi.fn() }])
      })

      // 运行用户测试函数
      await testFn(context)
    }
  }
}

/**
 * 标准化的Matrix Push Rules测试模式
 */
export const createMatrixPushRulesTest = (testName: string, testFn: (context: MatrixTestContext) => Promise<void>) => {
  return {
    description: testName,
    testFn: async (context: unknown) => {
      // 获取实际的客户端mock (context.mockClient是服务，需要getClient获取客户端)
      const client = (context as MatrixTestContext).mockClient.getClient()

      // 设置默认的推送规则
      client.getPushRules.mockResolvedValue({
        global: {
          override: [],
          content: [],
          room: [],
          sender: [],
          underride: []
        },
        device: {}
      })

      // 运行用户测试函数
      await testFn(context as MatrixTestContext)
    }
  }
}
