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

  it.skip('adds thread child into reply mapping', async () => {
    const { setupMatrixThreadsBridge } = await import('@/integrations/matrix/threads')
    const { useChatStore } = await import('@/stores/chat')
    const { useGlobalStore } = await import('@/stores/global')
    const { matrixClientService } = await import('@/integrations/matrix/client')
    const { createPinia, setActivePinia } = await import('pinia')
    const pinia = createPinia()
    setActivePinia(pinia)
    const chat = useChatStore()
    const global = useGlobalStore()
    global.updateCurrentSessionRoomId('!room')
    setupMatrixThreadsBridge()
    const ev = {
      getType: () => 'm.room.message',
      getContent: () => ({ 'm.relates_to': { rel_type: 'm.thread', event_id: '$root' } }),
      getId: () => '$child',
      getRoomId: () => '!room'
    }
    ;(matrixClientService as any).getClient().emit('event', ev)
    await new Promise((r) => setTimeout(r, 0))
    const rootValue = (chat.currentReplyMap.value as any)?.['$root']
    expect(typeof rootValue === 'string' && rootValue.includes('$child')).toBe(true)
  })
})
