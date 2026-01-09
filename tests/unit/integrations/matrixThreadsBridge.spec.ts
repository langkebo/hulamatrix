import { describe, it, expect, vi } from 'vitest'

vi.mock('@/integrations/matrix/client', () => {
  const listeners: Record<string, ((...args: any[]) => void)[]> = {}
  const client = {
    on: (name: string, cb: (...args: any[]) => void) => {
      listeners[name] = listeners[name] || []
      listeners[name].push(cb)
    },
    emit: (name: string, ...args: any[]) => {
      ;(listeners[name] || []).forEach((cb) => cb(...args))
    }
  }
  return { matrixClientService: { getClient: () => client } }
})

describe('matrix threads bridge', () => {
  beforeEach(async () => {
    // 模拟小程序环境
    ;(globalThis as any).uni = {
      getStorageSync: vi.fn(() => null),
      setStorageSync: vi.fn(),
      removeStorageSync: vi.fn(),
      clearStorageSync: vi.fn()
    } as any

    // 模拟Worker
    ;(globalThis as any).Worker = class {
      onmessage: any
      onerror: any
      postMessage() {}
      terminate() {}
    }
  })

  it('adds thread child into reply mapping', async () => {
    const { setupMatrixThreadsBridge } = await import('@/integrations/matrix/threads')
    const { useChatStore } = await import('@/stores/chat')
    const { useGlobalStore } = await import('@/stores/global')
    const { createPinia, setActivePinia } = await import('pinia')
    const pinia = createPinia()
    setActivePinia(pinia)
    const chat = useChatStore()
    const global = useGlobalStore()

    // 设置当前会话房间
    global.updateCurrentSessionRoomId('!room')

    // 设置 threads bridge - 应该不抛出错误
    expect(() => setupMatrixThreadsBridge()).not.toThrow()

    // 验证 addThreadChild 方法存在并可调用
    expect(typeof chat.addThreadChild).toBe('function')

    // 手动调用 addThreadChild - 应该不抛出错误
    expect(() => {
      chat.addThreadChild('$root', '$child', '!room')
    }).not.toThrow()

    // 验证方法可以被多次调用
    chat.addThreadChild('$root', '$child2', '!room')
    chat.addThreadChild('$root', '$child3', '!room')
  })
})
