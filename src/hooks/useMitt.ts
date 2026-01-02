import { getCurrentScope, onUnmounted } from 'vue'
import mitt from 'mitt'
import type { MittEnum } from '@/enums'

/**
 * Mitt 事件映射类型
 * 使用索引签名支持任意事件名称和数据类型
 */
type MittEvents = Record<string, unknown>

const mittInstance = mitt<MittEvents>()

export const useMitt = {
  on: (event: MittEnum | string, handler: unknown) => {
    mittInstance.on(event, handler as (...args: unknown[]) => void)
    // 仅当在有效的响应式作用域中时才注册清理
    if (getCurrentScope()) {
      onUnmounted(() => {
        mittInstance.off(event, handler as (...args: unknown[]) => void)
      })
    }
  },
  emit: (event: MittEnum | string, data?: unknown) => {
    mittInstance.emit(event, data)
  },
  off: (event: MittEnum | string, handler: unknown) => {
    mittInstance.off(event, handler as (...args: unknown[]) => void)
  }
}
