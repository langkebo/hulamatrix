import { logger } from '@/utils/logger'

import { computed, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { LogicalSize } from '@tauri-apps/api/dpi'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { UserAttentionType } from '@tauri-apps/api/window'

import { assign } from 'es-toolkit/compat'
import { CallTypeEnum, EventEnum, RoomTypeEnum } from '@/enums'
import { useGlobalStore } from '@/stores/global'
import { isCompatibility, isDesktop, isMac, isWindows } from '@/utils/PlatformConstants'
import { msg } from '@/utils/SafeUI'

/** 判断是兼容的系统 */
const isCompatibilityMode = computed(() => isCompatibility())

// Mac 端用于模拟父窗口禁用态的透明蒙层
const MAC_MODAL_OVERLAY_ID = 'mac-modal-overlay'
// 记录当前已经打开模态窗口的 label，方便在最后一个关闭时移除蒙层
const activeMacModalLabels = new Set<string>()

// 创建或复用蒙层 DOM
const ensureMacOverlayElement = () => {
  if (typeof document === 'undefined') return
  if (document.getElementById(MAC_MODAL_OVERLAY_ID)) return
  const overlay = document.createElement('div')
  overlay.id = MAC_MODAL_OVERLAY_ID
  assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '9999',
    backgroundColor: 'transparent',
    pointerEvents: 'auto',
    width: '100vw',
    height: '100vh',
    userSelect: 'none',
    cursor: 'not-allowed'
  })
  const mountPoint = document.body ?? document.documentElement
  mountPoint?.appendChild(overlay)
}

// 移除蒙层
const removeMacOverlayElement = () => {
  if (typeof document === 'undefined') return
  document.getElementById(MAC_MODAL_OVERLAY_ID)?.remove()
}

// 记录当前窗口并展示蒙层
const attachMacModalOverlay = (label: string) => {
  if (!isMac()) return
  activeMacModalLabels.add(label)
  ensureMacOverlayElement()
}

// 解除当前窗口的蒙层记录，如果没有其他窗口则移除蒙层
const detachMacModalOverlay = (label: string) => {
  if (!isMac()) return
  activeMacModalLabels.delete(label)
  if (activeMacModalLabels.size === 0) {
    removeMacOverlayElement()
  }
}

export const useWindow = () => {
  const globalStore = useGlobalStore()
  /**
   * 创建窗口
   * @param title 窗口标题
   * @param label 窗口名称
   * @param width 窗口宽度
   * @param height 窗口高度
   * @param wantCloseWindow 创建后需要关闭的窗口
   * @param resizable 调整窗口大小
   * @param minW 窗口最小宽度
   * @param minH 窗口最小高度
   * @param transparent 是否透明
   * @param visible 是否显示
   * @param queryParams URL查询参数
   * */
  const createWebviewWindow = async (
    title: string,
    label: string,
    width: number,
    height: number,
    wantCloseWindow?: string,
    resizable = false,
    minW = 330,
    minH = 495,
    transparent?: boolean,
    visible = true,
    queryParams?: Record<string, string | number | boolean>
  ) => {
    // 移动端不支持窗口管理，直接返回空对象
    if (!isDesktop()) {
      return null
    }

    // 首先检查窗口是否已存在
    const existingWindow = await WebviewWindow.getByLabel(label)
    if (existingWindow) {
      logger.debug('窗口已存在，聚焦到现有窗口', { label }, 'useWindow')
      await checkWinExist(label)
      return existingWindow
    }

    const originalLabel = label
    const isMultiMsgWindow = originalLabel.includes(EventEnum.MULTI_MSG)

    const checkLabel = () => {
      /** 如果是打开独立窗口就截取label中的固定label名称 */
      if (label.includes(EventEnum.ALONE)) {
        return label.replace(/\d/g, '')
      } else {
        return label
      }
    }

    // 对于multiMsg类型的窗口，保留原始label用于窗口标识，但URL路由统一指向 /multiMsg
    label = isMultiMsgWindow ? originalLabel : checkLabel()

    // 构建URL，包含查询参数
    let url = isMultiMsgWindow ? `/${EventEnum.MULTI_MSG}` : `/${label.split('--')[0]}`

    if (queryParams && Object.keys(queryParams).length > 0) {
      const searchParams = new URLSearchParams()
      Object.entries(queryParams).forEach(([key, value]) => {
        searchParams.append(key, String(value))
      })
      url += `?${searchParams.toString()}`
    }

    const webview = new WebviewWindow(label, {
      title: title,
      url: url,
      fullscreen: false,
      resizable: resizable,
      center: true,
      width: width,
      height: height,
      minHeight: minH,
      minWidth: minW,
      skipTaskbar: false,
      decorations: !isCompatibilityMode.value,
      transparent: transparent || isCompatibilityMode.value,
      titleBarStyle: 'overlay', // mac覆盖标签栏
      hiddenTitle: true, // mac隐藏标题栏
      visible: visible
    })

    await webview.once('tauri://created', async () => {
      if (wantCloseWindow) {
        const win = await WebviewWindow.getByLabel(wantCloseWindow)
        win?.close()
      }
    })

    await webview.once('tauri://error', async (e) => {
      logger.warn('窗口创建失败', { error: e, label }, 'useWindow')
      // 窗口可能已存在，尝试获取现有窗口
      await checkWinExist(label)
    })

    return webview
  }

  /**
   * 向指定标签的窗口发送载荷（payload），可用于窗口之间通信。
   *
   * @param windowLabel - 要发送载荷的窗口标签，通常是在创建窗口时指定的 label。
   * @param payload - 要发送的 JSON 数据对象，不限制字段内容。
   * @returns 返回一个 Promise，表示调用 Rust 后端命令的完成情况。
   */
  const sendWindowPayload = async (windowLabel: string, payload: unknown) => {
    // 移动端不支持窗口管理
    if (!isDesktop()) {
      return Promise.resolve()
    }
    logger.debug('新窗口的载荷：', { payload, component: 'useWindow' })
    return invoke<void>('push_window_payload', {
      label: windowLabel,
      // 这个payload只要是json就能传，不限制字段
      payload
    })
  }

  /**
   * 获取指定窗口的当前载荷（payload），用于初始化窗口时获取传递的数据。
   *
   * @param windowLabel - 要获取载荷的窗口标签。
   * @returns 返回一个 Promise，解析后为泛型 T，表示窗口中保存的 payload 数据。
   * 可以通过泛型指定返回的结构类型。
   *
   * @example
   * interface MyPayload {
   *   userId: string;
   *   token: string;
   * }
   *
   * const payload = await getWindowPayload<MyPayload>('my-window')
   */
  const getWindowPayload = async <T>(windowLabel: string, once: boolean = true) => {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
    if (!isDesktop() || !isTauri) {
      return Promise.resolve({} as T)
    }
    return await invoke<T>('get_window_payload', { label: windowLabel, once })
  }

  /**
   * 注册指定窗口的载荷更新事件监听器。当该窗口的 payload 被更新时触发回调。
   *
   * @param this - 可选的绑定上下文对象，内部通过 `Function.prototype.call` 使用。
   * @param windowLabel - 窗口标签，用于构造监听的事件名称 `${label}:update`。
   * @param callback - 在 payload 更新时调用的函数，回调参数为 `TauriEvent<T>`。
   * @returns 返回一个 Promise，解析后为 `UnlistenFn`（一个函数），调用它可以注销监听器。
   *
   * @example
   * const unlisten = await getWindowPayloadListener<MyPayload>('my-window', (event) => {
   * })
   *
   * // 需要时手动取消监听
   * unlisten()
   */
  // async function getWindowPayloadListener<T>(this: unknown, windowLabel: string, callback: (event: unknown) => void) {
  //   const listenLabel = `${windowLabel}:update`

  //   return addListener(
  //     listen<T>(listenLabel, (event) => {
  //       callback.call(this, event)
  //     })
  //   )
  // }

  /**
   * 创建模态子窗口
   * @param title 窗口标题
   * @param label 窗口标识
   * @param width 窗口宽度
   * @param height 窗口高度
   * @param parent 父窗口
   * @param payload 传递给子窗口的数据
   * @returns 创建的窗口实例或已存在的窗口实例
   */
  const createModalWindow = async (
    title: string,
    label: string,
    width: number,
    height: number,
    parent: string,
    payload?: Record<string, unknown>,
    options?: {
      minWidth?: number
      minHeight?: number
    }
  ) => {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
    if (!isDesktop() || !isTauri) {
      return null
    }

    let existingWindow: WebviewWindow | null = null
    let parentWindow: WebviewWindow | null = null

    try {
      // 检查窗口是否已存在
      existingWindow = await WebviewWindow.getByLabel(label)

      if (existingWindow) {
        logger.debug('模态窗口已存在，激活现有窗口', { label }, 'useWindow')

        if (isMac()) {
          attachMacModalOverlay(label)
        }

        // 激活现有窗口
        await checkWinExist(label)

        // 请求用户注意
        try {
          await existingWindow.requestUserAttention(UserAttentionType.Critical)
        } catch (e) {
          logger.warn('请求用户注意失败:', { error: e, label, component: 'useWindow' })
        }

        return existingWindow
      }

      // 获取父窗口引用
      parentWindow = parent ? await WebviewWindow.getByLabel(parent) : null
    } catch (error) {
      logger.error('检查模态窗口是否存在时出错', { error, label, parent }, 'useWindow')
      return null
    }

    // 创建新窗口
    const modalWindow = new WebviewWindow(label, {
      url: `/${label}`,
      title: title,
      width: width,
      height: height,
      resizable: false,
      center: true,
      minWidth: options?.minWidth ?? 500,
      minHeight: options?.minHeight ?? 500,
      focus: true,
      minimizable: false,
      parent: parentWindow ? parentWindow : parent,
      decorations: !isCompatibilityMode.value,
      transparent: isCompatibilityMode.value,
      titleBarStyle: 'overlay', // mac覆盖标签栏
      hiddenTitle: true, // mac隐藏标题栏
      visible: false
    })

    // 监听窗口创建完成事件
    modalWindow.once('tauri://created', async () => {
      if (isWindows()) {
        // 禁用父窗口，模拟模态窗口效果
        await parentWindow?.setEnabled(false)
      }

      // 如果有 payload，发送到子窗口
      if (payload) {
        await sendWindowPayload(label, payload)
      }

      // 设置窗口为焦点
      await modalWindow.setFocus()

      if (isMac()) {
        try {
          await invoke('set_window_movable', {
            windowLabel: label,
            movable: false
          })
        } catch (error) {
          logger.error('设置子窗口不可拖动失败:', error)
        }
        attachMacModalOverlay(label)
      }
    })

    // 监听错误事件
    modalWindow.once('tauri://error', async (e) => {
      logger.error(`${title}窗口创建失败:`, e)
      msg.error?.(`创建${title}窗口失败`)
      await parentWindow?.setEnabled(true)
    })

    void modalWindow.once('tauri://destroyed', async () => {
      if (isMac()) {
        detachMacModalOverlay(label)
      }
      if (isWindows()) {
        try {
          await parentWindow?.setEnabled(true)
        } catch (error) {
          logger.error('重新启用父窗口失败:', error)
        }
      }
    })

    return modalWindow
  }

  /**
   * 调整窗口大小
   * @param label 窗口名称
   * @param width 窗口宽度
   * @param height 窗口高度
   * */
  const resizeWindow = async (label: string, width: number, height: number) => {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
    if (!isDesktop() || !isTauri) {
      return Promise.resolve()
    }
    const webview = await WebviewWindow.getByLabel(label)
    // 创建一个新的尺寸对象
    const newSize = new LogicalSize(width, height)
    // 调用窗口的 setSize 方法进行尺寸调整
    await webview?.setSize(newSize).catch((error) => {
      logger.error('无法调整窗口大小:', error)
    })
  }

  /**
   * 检查窗口是否存在并激活
   * @param L 窗口标签
   */
  const checkWinExist = async (L: string) => {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
    if (!isDesktop() || !isTauri) {
      return Promise.resolve()
    }

    try {
      const isExistsWinds = await WebviewWindow.getByLabel(L)
      if (isExistsWinds) {
        logger.debug('找到已存在的窗口，准备激活', { label: L }, 'useWindow')

        // 使用 nextTick 确保 DOM 更新完成
        await nextTick()

        try {
          // 检查窗口状态并恢复
          const minimized = await isExistsWinds.isMinimized()
          const visible = await isExistsWinds.isVisible()

          if (!visible) {
            await isExistsWinds.show()
          }

          if (minimized) {
            await isExistsWinds.unminimize()
          }

          // 聚焦窗口
          await isExistsWinds.setFocus()

          logger.debug('窗口激活成功', { label: L }, 'useWindow')
        } catch (stateError) {
          logger.warn(
            '获取窗口状态失败，尝试直接聚焦',
            {
              error: stateError,
              label: L
            },
            'useWindow'
          )

          // 如果获取状态失败，直接尝试聚焦
          try {
            await isExistsWinds.setFocus()
          } catch (focusError) {
            logger.error(
              '聚焦窗口失败',
              {
                error: focusError,
                label: L
              },
              'useWindow'
            )
          }
        }
      } else {
        logger.debug('窗口不存在', { label: L }, 'useWindow')
      }
    } catch (error) {
      logger.error('检查窗口是否存在时出错', { error, label: L }, 'useWindow')
    }
  }

  /**
   * 设置窗口是否可调整大小
   * @param label 窗口名称
   * @param resizable 是否可调整大小
   */
  const setResizable = async (label: string, resizable: boolean) => {
    // 移动端不支持窗口管理
    if (!isDesktop()) {
      return Promise.resolve()
    }
    const webview = await WebviewWindow.getByLabel(label)
    if (webview) {
      await webview.setResizable(resizable).catch((error) => {
        logger.error('设置窗口可调整大小失败:', error)
      })
    }
  }

  const startRtcCall = async (callType: CallTypeEnum) => {
    try {
      const currentSession = globalStore.currentSession
      if (!currentSession) {
        msg.warning('当前会话尚未准备好')
        return
      }
      // 判断是否为群聊，如果是群聊则跳过
      if (currentSession.type === RoomTypeEnum.GROUP) {
        msg.warning('群聊暂不支持音视频通话')
        return
      }

      // 获取当前房间好友的ID（单聊时使用detailId作为remoteUid）
      const remoteUid = currentSession.detailId
      if (!remoteUid) {
        msg.error('无法获取对方用户信息')
        return
      }
      await createRtcCallWindow(false, remoteUid, globalStore.currentSessionRoomId, callType)
    } catch (error) {
      logger.error('创建视频通话窗口失败:', error)
    }
  }

  const createRtcCallWindow = async (
    isIncoming: boolean,
    remoteUserId: string,
    roomId: string,
    callType: CallTypeEnum
  ) => {
    // 根据是否来电决定窗口尺寸
    const windowConfig = isIncoming
      ? { width: 360, height: 90, minWidth: 360, minHeight: 90 } // 来电通知尺寸
      : callType === CallTypeEnum.VIDEO
        ? { width: 850, height: 580, minWidth: 850, minHeight: 580 } // 视频通话尺寸
        : { width: 500, height: 650, minWidth: 500, minHeight: 650 } // 语音通话尺寸

    const type = callType === CallTypeEnum.VIDEO ? '视频通话' : '语音通话'
    await createWebviewWindow(
      type, // 窗口标题
      'rtcCall', // 窗口标签
      windowConfig.width, // 宽度
      windowConfig.height, // 高度
      undefined, // 不需要关闭其他窗口
      true, // 可调整大小
      windowConfig.minWidth, // 最小宽度
      windowConfig.minHeight, // 最小高度
      false, // 不透明
      false, // 显示窗口
      {
        remoteUserId,
        roomId: roomId,
        callType,
        isIncoming
      }
    )
  }

  return {
    createWebviewWindow,
    createModalWindow,
    resizeWindow,
    checkWinExist,
    setResizable,
    sendWindowPayload,
    getWindowPayload,
    startRtcCall,
    createRtcCallWindow
  }
}
