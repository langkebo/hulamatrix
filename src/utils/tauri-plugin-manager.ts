/**
 * Tauri插件管理器
 * 统一管理和延迟加载Tauri插件，减少启动时间
 */

import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { logger, toError } from '@/utils/logger'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 文件系统插件接口
 */
export interface FsPlugin {
  readFile: (path: string | URL, options?: unknown) => Promise<Uint8Array | ArrayBuffer>
  writeFile: (path: string | URL, data: Uint8Array | unknown, options?: unknown) => Promise<void>
  exists: (path: string | URL, options?: unknown) => Promise<boolean>
}

/**
 * 对话框插件接口
 */
export interface DialogPlugin {
  ask: (message: string, options?: unknown) => Promise<boolean | string | null>
  save: (options?: unknown) => Promise<string | null>
  open: (options?: unknown) => Promise<string | string[] | null>
}

/**
 * 通知插件接口
 */
export interface NotificationPlugin {
  sendNotification: (title: string, options?: NotificationOptions) => void
}

/**
 * 通知选项
 */
export interface NotificationOptions {
  body?: string
  icon?: string
  sound?: string
}

/**
 * 全局快捷键插件接口
 */
export interface GlobalShortcutPlugin {
  register: (shortcut: string, handler: () => void) => Promise<void>
  unregister: (shortcut: string) => Promise<void>
  isRegistered: (shortcut: string) => Promise<boolean>
}

/**
 * 剪贴板插件接口
 */
export interface ClipboardPlugin {
  readText: () => Promise<string>
  writeText: (text: string) => Promise<void>
}

/**
 * HTTP 插件接口
 */
export interface HttpPlugin {
  fetch: (url: string, options?: RequestInit) => Promise<Response>
}

/**
 * Shell 插件选项
 */
export interface ShellOpenOptions {
  open?: string
}

/**
 * Shell 插件接口
 */
export interface ShellPlugin {
  open: (path: string, options?: ShellOpenOptions) => Promise<void>
}

/**
 * 操作系统插件接口
 */
export interface OsPlugin {
  platform: () => Promise<string>
  version: () => Promise<string>
  arch: () => Promise<string>
  type: () => Promise<string>
  tempdir: () => Promise<string>
}

/**
 * 更新插件接口
 */
export interface UpdaterPlugin {
  check: (options?: { headers?: Record<string, string> }) => Promise<UpdateInfo | null>
  install: () => Promise<void>
}

/**
 * 更新信息
 */
export interface UpdateInfo {
  available: boolean
  currentVersion: string
  latestVersion: string
  body?: string
  date?: string
}

/**
 * 自启动插件接口
 */
export interface AutostartPlugin {
  enable: () => Promise<void>
  disable: () => Promise<void>
  isEnabled: () => Promise<boolean>
}

/**
 * 条形码扫描器插件接口
 */
export interface BarcodeScannerPlugin {
  start: () => Promise<void>
  stop: () => Promise<void>
  scan: () => Promise<string>
}

/**
 * SQL 插件接口
 */
export interface SqlPlugin {
  load: (db: string) => Promise<unknown>
  open: (db: string) => Promise<unknown>
}

/**
 * 插件实例联合类型
 * 使用更宽松的类型以兼容实际 Tauri 插件 API
 */
export type PluginInstance =
  | Partial<FsPlugin>
  | Partial<DialogPlugin>
  | Partial<NotificationPlugin>
  | Partial<GlobalShortcutPlugin>
  | Partial<ClipboardPlugin>
  | Partial<HttpPlugin>
  | Partial<ShellPlugin>
  | Partial<OsPlugin>
  | Partial<UpdaterPlugin>
  | Partial<AutostartPlugin>
  | Partial<BarcodeScannerPlugin>
  | Partial<SqlPlugin>
  | null
  | undefined
  | Record<string, unknown>

/**
 * 插件配置接口
 */
interface PluginConfig {
  name: string
  lazy?: boolean
  required?: boolean
  initFn?: () => Promise<PluginInstance>
  cleanupFn?: (instance: PluginInstance) => void
}

/**
 * WebviewWindow 创建选项类型
 */
export type WebviewWindowOptions = {
  title?: string
  url?: string
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  x?: number
  y?: number
  center?: boolean
  resizable?: boolean
  decorations?: boolean
  transparent?: boolean
  alwaysOnTop?: boolean
  skipTaskbar?: boolean
  [key: string]: unknown
}

class TauriPluginManager {
  private plugins = new Map<string, PluginConfig>()
  private instances = new Map<string, PluginInstance>()
  private initialized = new Set<string>()
  private pendingInits = new Map<string, Promise<PluginInstance>>()

  /** 注册插件 */
  register(config: PluginConfig) {
    this.plugins.set(config.name, config)
  }

  /** 初始化插件 */
  async init(pluginName: string): Promise<PluginInstance> {
    // 如果已经初始化，直接返回实例
    if (this.instances.has(pluginName)) {
      return this.instances.get(pluginName)
    }

    // 如果正在初始化，等待完成
    if (this.pendingInits.has(pluginName)) {
      return this.pendingInits.get(pluginName)
    }

    const config = this.plugins.get(pluginName)
    if (!config) {
      throw new Error(`Plugin ${pluginName} not registered`)
    }

    // 如果配置了初始化函数，执行它
    if (config.initFn) {
      const initPromise = this.initializePlugin(config)
      this.pendingInits.set(pluginName, initPromise)

      try {
        const instance = await initPromise
        this.instances.set(pluginName, instance)
        this.initialized.add(pluginName)
        this.pendingInits.delete(pluginName)
        return instance
      } catch (error) {
        this.pendingInits.delete(pluginName)
        throw error
      }
    }

    return null
  }

  /** 实际初始化插件 */
  private async initializePlugin(config: PluginConfig): Promise<PluginInstance> {
    try {
      const instance = await config.initFn!()
      return instance
    } catch (error) {
      logger.error(`[TauriPluginManager] Failed to initialize ${config.name}:`, toError(error))
      throw error
    }
  }

  /** 获取插件实例 */
  get(pluginName: string): PluginInstance | undefined {
    return this.instances.get(pluginName)
  }

  /** 检查插件是否已初始化 */
  isInitialized(pluginName: string): boolean {
    return this.initialized.has(pluginName)
  }

  /** 批量初始化必需的插件 */
  async initRequired(): Promise<void> {
    const requiredPlugins = Array.from(this.plugins.values()).filter((config) => config.required && !config.lazy)

    await Promise.all(requiredPlugins.map((config) => this.init(config.name)))
  }

  /** 清理插件 */
  async cleanup(pluginName?: string): Promise<void> {
    if (pluginName) {
      const config = this.plugins.get(pluginName)
      const instance = this.instances.get(pluginName)

      if (config && instance && config.cleanupFn) {
        await config.cleanupFn(instance)
      }

      this.instances.delete(pluginName)
      this.initialized.delete(pluginName)
      this.pendingInits.delete(pluginName)
    } else {
      // 清理所有插件
      for (const [name, config] of this.plugins) {
        const instance = this.instances.get(name)
        if (instance && config.cleanupFn) {
          await config.cleanupFn(instance)
        }
      }

      this.instances.clear()
      this.initialized.clear()
      this.pendingInits.clear()
    }
  }

  /** 获取统计信息 */
  getStats() {
    return {
      registered: this.plugins.size,
      initialized: this.initialized.size,
      pending: this.pendingInits.size
    }
  }
}

/** 创建全局插件管理器实例 */
const pluginManager = new TauriPluginManager()

// 注册常用插件
pluginManager.register({
  name: 'fs',
  required: true,
  lazy: false,
  initFn: async () => {
    const { readFile, writeFile, exists } = await import('@tauri-apps/plugin-fs')
    return { readFile, writeFile, exists }
  }
})

pluginManager.register({
  name: 'dialog',
  required: false,
  lazy: true,
  initFn: async () => {
    const { ask, save, open } = await import('@tauri-apps/plugin-dialog')
    return { ask, save, open }
  }
})

pluginManager.register({
  name: 'notification',
  required: false,
  lazy: true,
  initFn: async () => {
    const { sendNotification } = await import('@tauri-apps/plugin-notification')
    return { sendNotification }
  }
})

pluginManager.register({
  name: 'globalShortcut',
  required: false,
  lazy: true,
  initFn: async () => {
    const { register, unregister, isRegistered } = await import('@tauri-apps/plugin-global-shortcut')
    return { register, unregister, isRegistered }
  }
})

pluginManager.register({
  name: 'clipboard',
  required: false,
  lazy: true,
  initFn: async () => {
    const { readText, writeText } = await import('@tauri-apps/plugin-clipboard-manager')
    return { readText, writeText }
  }
})

pluginManager.register({
  name: 'http',
  required: false,
  lazy: true,
  initFn: async () => {
    const { fetch } = await import('@tauri-apps/plugin-http')
    return { fetch }
  }
})

pluginManager.register({
  name: 'shell',
  required: false,
  lazy: true,
  initFn: async () => {
    const { open } = await import('@tauri-apps/plugin-shell')
    return { open }
  }
})

pluginManager.register({
  name: 'os',
  required: true,
  lazy: false,
  initFn: async () => {
    const { platform, version, arch } = await import('@tauri-apps/plugin-os')
    return { platform, version, arch }
  }
})

pluginManager.register({
  name: 'updater',
  required: false,
  lazy: true,
  initFn: async () => {
    const updaterMod = await import('@tauri-apps/plugin-updater')
    const { check, install } = updaterMod as unknown as UpdaterPlugin
    return { check, install }
  }
})

pluginManager.register({
  name: 'autostart',
  required: false,
  lazy: true,
  initFn: async () => {
    const { enable, disable, isEnabled } = await import('@tauri-apps/plugin-autostart')
    return { enable, disable, isEnabled }
  }
})

pluginManager.register({
  name: 'barcodeScanner',
  required: false,
  lazy: true,
  initFn: async () => {
    const scannerMod = await import('@tauri-apps/plugin-barcode-scanner')
    const { start, stop, scan } = scannerMod as unknown as BarcodeScannerPlugin
    return { start, stop, scan }
  }
})

pluginManager.register({
  name: 'sql',
  required: false,
  lazy: true,
  initFn: async () => {
    const sqlMod = await import('@tauri-apps/plugin-sql')
    const { load, open } = sqlMod as unknown as SqlPlugin
    return { load, open }
  }
})

/** 导出便捷函数 */
export async function initTauriPlugins() {
  try {
    // 只初始化必需的插件
    await pluginManager.initRequired()
  } catch (error) {
    logger.error('[Tauri] Failed to initialize plugins:', toError(error))
  }
}

export async function useTauriPlugin(pluginName: string) {
  try {
    return await pluginManager.init(pluginName)
  } catch (error) {
    logger.error(`[Tauri] Failed to use plugin ${pluginName}:`, toError(error))
    throw error
  }
}

export function getTauriPlugin(pluginName: string) {
  return pluginManager.get(pluginName)
}

export function isTauriPluginReady(pluginName: string): boolean {
  return pluginManager.isInitialized(pluginName)
}

/** 延迟加载的文件系统操作 */
export async function useFilesystem() {
  const fs = await useTauriPlugin('fs')
  return fs
}

/** 延迟加载的对话框 */
export async function useDialog() {
  const dialog = await useTauriPlugin('dialog')
  return dialog
}

/** 延迟加载的通知 */
export async function useNotification() {
  const notification = await useTauriPlugin('notification')
  return notification
}

/** 延迟加载的剪贴板 */
export async function useClipboard() {
  const clipboard = await useTauriPlugin('clipboard')
  return clipboard
}

/** 延迟加载的Shell */
export async function useShell() {
  const shell = await useTauriPlugin('shell')
  return shell
}

/** 延迟加载的操作系统信息 */
export async function useOS() {
  const os = await useTauriPlugin('os')
  return os
}

/** 延迟加载的更新管理器 */
export async function useUpdater() {
  const updater = await useTauriPlugin('updater')
  return updater
}

/** 延迟加载的自动启动 */
export async function useAutostart() {
  const autostart = await useTauriPlugin('autostart')
  return autostart
}

/** 窗口管理工具 */
export class WindowManager {
  private windows = new Map<string, WebviewWindow>()

  /** 创建窗口 */
  async create(label: string, options?: WebviewWindowOptions) {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const window = new WebviewWindow(label, options)
    this.windows.set(label, window)
    return window
  }

  /** 获取窗口 */
  get(label: string): WebviewWindow | undefined {
    return this.windows.get(label)
  }

  /** 关闭窗口 */
  async close(label: string) {
    const window = this.windows.get(label)
    if (window) {
      await window.close()
      this.windows.delete(label)
    }
  }

  /** 关闭所有窗口 */
  async closeAll() {
    const promises = Array.from(this.windows.values()).map((w) => w.close())
    await Promise.all(promises)
    this.windows.clear()
  }

  /** 获取所有窗口标签 */
  getLabels(): string[] {
    return Array.from(this.windows.keys())
  }
}

/** 创建全局窗口管理器 */
export const windowManager = new WindowManager()

// 导出插件管理器实例（供高级使用）
export { pluginManager }
