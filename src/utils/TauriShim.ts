import { isTauri } from '@tauri-apps/api/core'

const isTauriContext = () => isTauri()

class MockWebviewWindow {
  label = 'browser'
  async minimize() {}
  async maximize() {}
  async unmaximize() {}
  async show() {}
  async hide() {}
  async close() {}
  async setAlwaysOnTop(_top: boolean) {}
  async isMaximized() {
    return false
  }
  async isFullscreen() {
    return false
  }
  async setFullscreen(_fullscreen: boolean) {}
  async onResized(_handler: () => void) {
    return () => {}
  }
  async onCloseRequested(_handler: (event: any) => Promise<void> | void) {
    return () => {}
  }
  async onDragDropEvent(_handler: (event: any) => void) {
    return () => {}
  }
  async outerSize() {
    return { width: 0, height: 0 }
  }
  async setPosition(_position: any) {}
  async unminimize() {}
  async setFocus() {}
}

const mockWindow = new MockWebviewWindow()

export const safeGetCurrentWindow = () => {
  return getWebviewWindow()
}

export const safeGetCurrentWebviewWindow = async () => {
  const win = getWebviewWindow()
  if (win.label !== 'browser') {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    return getCurrentWebviewWindow()
  }
  return Promise.resolve(win)
}

export const isDesktop = () => isTauriContext()

let WebviewWindowImpl: any = null
let _getCurrentWebviewWindowImpl: any = null

export const initTauriApis = async () => {
  if (!isTauriContext()) return
  if (WebviewWindowImpl) return
  const webviewWindow = await import('@tauri-apps/api/webviewWindow')
  WebviewWindowImpl = webviewWindow.WebviewWindow
  _getCurrentWebviewWindowImpl = webviewWindow.getCurrentWebviewWindow
}

export const getWebviewWindow = () => {
  if (!isTauriContext()) return mockWindow
  if (!WebviewWindowImpl) return mockWindow
  return WebviewWindowImpl.getCurrent()
}

export const getWebviewWindowByLabel = async (label: string) => {
  if (!isTauriContext()) return mockWindow
  if (!WebviewWindowImpl) {
    await initTauriApis()
    if (!WebviewWindowImpl) return mockWindow
  }
  return WebviewWindowImpl.getByLabel(label)
}
