import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useEventManager } from '../useEventManager'

describe('useEventManager', () => {
  let eventManager: ReturnType<typeof useEventManager>
  let cleanupFns: Array<() => void>

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = ''
    eventManager = useEventManager()
    cleanupFns = []
  })

  afterEach(() => {
    // Clean up all listeners
    cleanupFns.forEach((fn) => fn())
    eventManager.cleanupAll()
  })

  it('should add event listener', () => {
    const callback = vi.fn()
    const button = document.createElement('button')

    const cleanup = eventManager.addListener(button, 'click', callback)
    cleanupFns.push(cleanup)

    button.click()

    expect(callback).toHaveBeenCalled()
  })

  it('should add multiple listeners for same event', () => {
    const callback1 = vi.fn()
    const callback2 = vi.fn()
    const button = document.createElement('button')

    const cleanup1 = eventManager.addListener(button, 'click', callback1)
    const cleanup2 = eventManager.addListener(button, 'click', callback2)
    cleanupFns.push(cleanup1, cleanup2)

    button.click()

    expect(callback1).toHaveBeenCalled()
    expect(callback2).toHaveBeenCalled()
  })

  it('should clean up all listeners', () => {
    const callback1 = vi.fn()
    const callback2 = vi.fn()
    const button1 = document.createElement('button')
    const button2 = document.createElement('button')

    eventManager.addListener(button1, 'click', callback1)
    eventManager.addListener(button2, 'click', callback2)
    eventManager.cleanupAll()

    button1.click()
    button2.click()

    expect(callback1).not.toHaveBeenCalled()
    expect(callback2).not.toHaveBeenCalled()
  })

  it('should handle window events', () => {
    const callback = vi.fn()

    const cleanup = eventManager.addListener(window, 'resize', callback)
    cleanupFns.push(cleanup)

    window.dispatchEvent(new Event('resize'))

    expect(callback).toHaveBeenCalled()
  })

  it('should handle document events', () => {
    const callback = vi.fn()

    const cleanup = eventManager.addListener(document, 'keydown', callback)
    cleanupFns.push(cleanup)

    document.dispatchEvent(new KeyboardEvent('keydown'))

    expect(callback).toHaveBeenCalled()
  })

  it('should get listener count', () => {
    const callback = vi.fn()
    const button = document.createElement('button')

    expect(eventManager.getListenerCount()).toBe(0)

    const cleanup1 = eventManager.addListener(button, 'click', callback)
    cleanupFns.push(cleanup1)
    expect(eventManager.getListenerCount()).toBe(1)

    const cleanup2 = eventManager.addListener(button, 'mouseover', callback)
    cleanupFns.push(cleanup2)
    expect(eventManager.getListenerCount()).toBe(2)
  })

  it('should add multiple listeners at once', () => {
    const callback = vi.fn()
    const button = document.createElement('button')

    const cleanup = eventManager.addListeners([
      { target: button, type: 'click', listener: callback },
      { target: button, type: 'mouseover', listener: callback }
    ])
    cleanupFns.push(cleanup)

    button.click()
    button.dispatchEvent(new Event('mouseover'))

    expect(callback).toHaveBeenCalledTimes(2)
  })
})
