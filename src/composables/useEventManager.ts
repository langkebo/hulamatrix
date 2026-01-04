/**
 * 统一的事件管理器
 * 用于自动管理事件监听器的添加和清理，防止内存泄漏
 */

import { onUnmounted } from 'vue'

interface EventListener {
  target: EventTarget
  type: string
  listener: EventListenerOrEventListenerObject
  options?: boolean | AddEventListenerOptions
}

type CleanupFunction = () => void

export const useEventManager = () => {
  const listeners = new Set<EventListener>()
  const cleanupFunctions = new Set<CleanupFunction>()

  /**
   * 添加事件监听器
   * @param target 监听目标
   * @param type 事件类型
   * @param listener 监听器函数
   * @param options 选项
   * @returns 清理函数
   */
  const addListener = (
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): CleanupFunction => {
    target.addEventListener(type, listener, options)

    const listenerObj: EventListener =
      options === undefined ? { target, type, listener } : { target, type, listener, options }
    listeners.add(listenerObj)

    // 返回清理函数
    const cleanup = () => {
      target.removeEventListener(type, listener, options as EventListenerOptions)
      listeners.delete(listenerObj)
    }

    cleanupFunctions.add(cleanup)
    return cleanup
  }

  /**
   * 批量添加事件监听器
   * @param listenersArray 监听器数组
   */
  const addListeners = (
    listenersArray: Array<{
      target: EventTarget
      type: string
      listener: EventListenerOrEventListenerObject
      options?: boolean | AddEventListenerOptions
    }>
  ): CleanupFunction => {
    const cleanups: CleanupFunction[] = []

    listenersArray.forEach(({ target, type, listener, options }) => {
      cleanups.push(addListener(target, type, listener, options))
    })

    // 返回批量清理函数
    return () => {
      cleanups.forEach((cleanup) => cleanup())
    }
  }

  /**
   * 清理所有事件监听器
   */
  const cleanupAll = () => {
    cleanupFunctions.forEach((cleanup) => cleanup())
    listeners.clear()
    cleanupFunctions.clear()
  }

  /**
   * 获取当前监听器数量
   */
  const getListenerCount = () => listeners.size

  const addWindowListener = (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): CleanupFunction => addListener(window, type, listener, options)

  const addDocumentListener = (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): CleanupFunction => addListener(document, type, listener, options)

  // 自动在组件卸载时清理
  try {
    onUnmounted(() => cleanupAll())
  } catch {}

  return {
    addListener,
    addListeners,
    cleanupAll,
    getListenerCount,
    addWindowListener,
    addDocumentListener
  }
}
