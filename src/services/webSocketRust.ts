import { TIME_INTERVALS } from '@/constants'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { useMitt } from '@/hooks/useMitt'
import { WsResponseMessageType } from '@/services/wsType'
import type { TauriEvent } from '@/typings/tauri-events'
import { logger } from '@/utils/logger'

// Tauri environment check
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

// Logging wrapper that uses project logger in web mode, Tauri log in Tauri mode
const logError = (...args: unknown[]) => {
  try {
    const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
    logger.error(msg)
  } catch {}
}

const logInfo = (...args: unknown[]) => {
  try {
    const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
    logger.info(msg)
  } catch {}
}

const logWarn = (...args: unknown[]) => {
  try {
    const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
    logger.warn(msg)
  } catch {}
}

/// WebSocket 连接状态
export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR'
}

/// 连接健康状态
export interface ConnectionHealth {
  isHealthy: boolean
  lastPongTime?: number
  consecutiveFailures: number
  roundTripTime?: number
}

/// WebSocket 事件
export interface WebSocketEvent {
  type: 'ConnectionStateChanged' | 'MessageReceived' | 'HeartbeatStatusChanged' | 'Error'
  state?: ConnectionState
  isReconnection?: boolean
  is_reconnection?: boolean
  message?: unknown
  health?: ConnectionHealth
  details?: Record<string, unknown>
}

/**
 * Rust WebSocket 客户端封装
 * 提供与原始 WebSocket Worker 兼容的接口
 */
/**
 * 监听器管理器，类似 AbortController
 */
class ListenerController {
  private listeners: Set<UnlistenFn> = new Set()
  private isAborted = false

  add(unlisten: UnlistenFn): void {
    if (this.isAborted) {
      // 如果已经中止，立即清理新添加的监听器
      unlisten()
      return
    }
    this.listeners.add(unlisten)
  }

  async abort(): Promise<void> {
    if (this.isAborted) return

    this.isAborted = true
    const cleanupPromises: Promise<void>[] = []

    // 并行执行所有清理操作
    for (const unlisten of this.listeners) {
      cleanupPromises.push(
        Promise.resolve()
          .then(() => unlisten())
          .catch((err) => {
            logError(`[ListenerController] 清理监听器失败: ${err}`)
          })
      )
    }

    // 等待所有清理完成（设置超时防止阻塞）
    try {
      await Promise.race([
        Promise.all(cleanupPromises),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Cleanup timeout')), TIME_INTERVALS.MESSAGE_RETRY_DELAY)
        )
      ])
    } catch (err) {
      logWarn(`[ListenerController] 部分监听器清理可能未完成: ${err}`)
    }

    this.listeners.clear()
    logInfo(`[ListenerController] 已清理所有监听器`)
  }

  get size(): number {
    return this.listeners.size
  }

  get aborted(): boolean {
    return this.isAborted
  }
}

class RustWebSocketClient {
  private listenerController: ListenerController = new ListenerController()

  constructor() {
    logInfo('[RustWS] Rust WebSocket 客户端初始化')
  }

  /**
   * 初始化 WebSocket 连接
   */
  async initConnect(): Promise<void> {
    try {
      if (!isTauri) return
      const clientId = localStorage.getItem('clientId')

      const params = {
        clientId: clientId || ''
      }

      logInfo(`[RustWS] 初始化连接参数: ${JSON.stringify(params)}`)

      await invoke('ws_init_connection', { params })

      logInfo('[RustWS] WebSocket 连接初始化成功')
    } catch (err) {
      logError(`[RustWS] 连接初始化失败: ${err}`)
      throw err
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    try {
      if (!isTauri) return
      await invoke('ws_disconnect')
      logInfo('[RustWS] WebSocket 连接已断开')
    } catch (err) {
      logError(`[RustWS] 断开连接失败: ${err}`)
    }
  }

  /**
   * 发送消息
   */
  async sendMessage(data: unknown): Promise<void> {
    try {
      if (!isTauri) return
      await invoke('ws_send_message', {
        params: { data }
      })
    } catch (err: unknown) {
      logError(`[RustWS] 发送消息失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取连接状态
   */
  async getState(): Promise<ConnectionState> {
    try {
      if (!isTauri) return ConnectionState.ERROR
      const state = await invoke<ConnectionState>('ws_get_state')
      return state
    } catch (err) {
      logError(`[RustWS] 获取连接状态失败: ${err}`)
      return ConnectionState.ERROR
    }
  }

  /**
   * 强制重连
   */
  async forceReconnect(): Promise<void> {
    try {
      if (!isTauri) return
      await invoke('ws_force_reconnect')
      logInfo('[RustWS] 强制重连成功')
    } catch (err) {
      logError(`[RustWS] 强制重连失败: ${err}`)
      throw err
    }
  }

  /**
   * 检查是否已连接
   */
  async isConnected(): Promise<boolean> {
    try {
      if (!isTauri) return false
      const connected = await invoke<boolean>('ws_is_connected')
      return connected
    } catch (err) {
      logError(`[RustWS] 检查连接状态失败: ${err}`)
      return false
    }
  }

  /**
   * 更新配置
   */
  async updateConfig(config: {
    heartbeatInterval?: number
    heartbeatTimeout?: number
    maxReconnectAttempts?: number
    reconnectDelayMs?: number
  }): Promise<void> {
    try {
      if (!isTauri) return
      await invoke('ws_update_config', {
        params: config
      })
      logInfo('[RustWS] 配置更新成功')
    } catch (err) {
      logError(`[RustWS] 配置更新失败: ${err}`)
      throw err
    }
  }

  /**
   * 设置业务消息监听器
   * 监听 Rust 端发送的具体业务消息事件
   */
  public async setupBusinessMessageListeners(): Promise<void> {
    this.listenerController.add(
      await listen('ws-login-success', (event: unknown) => {
        logInfo('登录成功')
        const tauriEvent = event as TauriEvent<unknown>
        useMitt.emit(WsResponseMessageType.LOGIN_SUCCESS, tauriEvent.payload)
      })
    )

    // 消息相关事件
    const listenerIndex = this.listenerController.size
    this.listenerController.add(
      await listen('ws-receive-message', (event: unknown) => {
        const payload = (event as TauriEvent<unknown>).payload
        logInfo(`[ws]收到消息[监听器${listenerIndex}]: ${JSON.stringify(payload)}`)

        // Debug: Trace message flow from the very beginning
        if (import.meta.env.MODE === 'development') {
          const payloadRecord = payload as Record<string, unknown>
          const message = payloadRecord.message as Record<string, unknown> | undefined
          const messageId = message?.id || (message as { messageId?: string })?.messageId || 'unknown'
          const roomId = message?.roomId || 'unknown'
          logger.debug('[MessageFlow] ws-receive-message → useMitt.emit(RECEIVE_MESSAGE)', {
            messageId,
            roomId,
            payload
          })
        }

        try {
          useMitt.emit(WsResponseMessageType.RECEIVE_MESSAGE, payload)
        } catch (err) {
          logError(`[ws]消息分发失败: ${err instanceof Error ? err.message : String(err)}`)
        }
      })
    )

    this.listenerController.add(
      await listen('ws-msg-recall', (event: unknown) => {
        logInfo('撤回')
        useMitt.emit(WsResponseMessageType.MSG_RECALL, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-msg-mark-item', (event: unknown) => {
        logInfo(`消息标记: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.MSG_MARK_ITEM, (event as TauriEvent<unknown>).payload)
      })
    )

    // 用户状态相关事件
    this.listenerController.add(
      await listen('ws-online', (event: unknown) => {
        logInfo(`上线: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.ONLINE, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-offline', (event: unknown) => {
        logInfo(`下线: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.OFFLINE, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-user-state-change', (event: unknown) => {
        logInfo(`用户状态改变: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.USER_STATE_CHANGE, (event as TauriEvent<unknown>).payload)
      })
    )

    // 好友相关事件
    this.listenerController.add(
      await listen('ws-request-new-apply', (event: unknown) => {
        logInfo('好友申请')
        useMitt.emit(WsResponseMessageType.REQUEST_NEW_FRIEND, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-group-set-admin-success', (event: unknown) => {
        useMitt.emit(WsResponseMessageType.GROUP_SET_ADMIN_SUCCESS, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-request-notify-event', (event: unknown) => {
        logInfo(`通知事件: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.NOTIFY_EVENT, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-request-approval-friend', (event: unknown) => {
        logInfo(`同意好友申请: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.REQUEST_APPROVAL_FRIEND, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-member-change', (event: unknown) => {
        useMitt.emit(WsResponseMessageType.WS_MEMBER_CHANGE, (event as TauriEvent<unknown>).payload)
      })
    )

    // 房间/群聊相关事件
    this.listenerController.add(
      await listen('ws-room-info-change', (event: unknown) => {
        logInfo(`群主修改群聊信息: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.ROOM_INFO_CHANGE, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-my-room-info-change', (event: unknown) => {
        logInfo(`自己修改我在群里的信息: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.MY_ROOM_INFO_CHANGE, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-room-group-notice-msg', (event: unknown) => {
        logInfo(`发布群公告: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.ROOM_GROUP_NOTICE_MSG, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-room-edit-group-notice-msg', (event: unknown) => {
        logInfo(`编辑群公告: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.ROOM_EDIT_GROUP_NOTICE_MSG, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-room-dissolution', (event: unknown) => {
        logInfo(`群解散: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.ROOM_DISSOLUTION, (event as TauriEvent<unknown>).payload)
      })
    )

    // 视频通话相关事件
    this.listenerController.add(
      await listen('ws-video-call-request', (event: unknown) => {
        logInfo(`收到通话请求: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.VideoCallRequest, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-call-accepted', (event: unknown) => {
        logInfo(`通话被接受: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.CallAccepted, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-call-rejected', (event: unknown) => {
        logInfo(`通话被拒绝: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.CallRejected, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-room-closed', (event: unknown) => {
        logInfo(`房间已关闭: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.RoomClosed, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-webrtc-signal', (event: unknown) => {
        logInfo(`收到信令消息: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.WEBRTC_SIGNAL, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-join-video', (event: unknown) => {
        logInfo(`用户加入房间: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.JoinVideo, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-leave-video', (event: unknown) => {
        logInfo(`用户离开房间: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.LeaveVideo, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-dropped', (event: unknown) => {
        useMitt.emit(WsResponseMessageType.DROPPED, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-cancel', (event: unknown) => {
        logInfo(`已取消通话: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.CANCEL, (event as TauriEvent<unknown>).payload)
      })
    )

    // 系统相关事件
    this.listenerController.add(
      await listen('ws-token-expired', (event: unknown) => {
        logInfo('账号在其他设备登录')
        useMitt.emit(WsResponseMessageType.TOKEN_EXPIRED, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-invalid-user', (event: unknown) => {
        logInfo('无效用户')
        useMitt.emit(WsResponseMessageType.INVALID_USER, (event as TauriEvent<unknown>).payload)
      })
    )

    // 未知消息类型
    this.listenerController.add(
      await listen('ws-unknown-message', (event: unknown) => {
        logInfo(`接收到未处理类型的消息: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
      })
    )

    this.listenerController.add(
      await listen('ws-delete-friend', async (event: unknown) => {
        logInfo(`删除好友: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        try {
          const friendsStore = require('@/stores/friends').useFriendsStore()
          await friendsStore.refreshAll()
        } catch {}
      })
    )

    // 朋友圈相关事件
    this.listenerController.add(
      await listen('ws-feed-send-msg', (event: unknown) => {
        logInfo(`收到朋友圈消息: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.FEED_SEND_MSG, (event as TauriEvent<unknown>).payload)
      })
    )

    this.listenerController.add(
      await listen('ws-feed-notify', (event: unknown) => {
        logInfo(`收到朋友圈通知: ${JSON.stringify((event as TauriEvent<unknown>).payload)}`)
        useMitt.emit(WsResponseMessageType.FEED_NOTIFY, (event as TauriEvent<unknown>).payload)
      })
    )
  }

  /**
   * Adapter compatibility method - send message via WebSocket
   */
  async send(params: { type: string; data: unknown }): Promise<unknown> {
    try {
      await this.sendMessage({ type: params.type, ...((params.data as Record<string, unknown>) ?? {}) })
      return { success: true }
    } catch (error) {
      logError(`[RustWS] Send failed: ${error}`)
      return { success: false, error }
    }
  }

  /**
   * Adapter compatibility method - register connect callback
   */
  onConnect(_callback?: () => void): void {
    // Callbacks are handled through event listeners
    logInfo('[RustWS] onConnect callback registered (no-op in current implementation)')
  }

  /**
   * Adapter compatibility method - register disconnect callback
   */
  onDisconnect(_callback?: () => void): void {
    // Callbacks are handled through event listeners
    logInfo('[RustWS] onDisconnect callback registered (no-op in current implementation)')
  }

  /**
   * Adapter compatibility method - connect to server
   */
  async connect(): Promise<void> {
    await this.initConnect()
  }
}
if (isTauri) {
  try {
    logInfo('创建RustWebSocketClient')
  } catch {}
}
const rustWebSocketClient = isTauri
  ? new RustWebSocketClient()
  : new (class {
      async initConnect(): Promise<void> {}
      async disconnect(): Promise<void> {}
      async sendMessage(_data: unknown): Promise<void> {}
      async getState(): Promise<ConnectionState> {
        return ConnectionState.DISCONNECTED
      }
      async forceReconnect(): Promise<void> {}
      async isConnected(): Promise<boolean> {
        return false
      }
      async updateConfig(_config: {
        heartbeatInterval?: number
        heartbeatTimeout?: number
        maxReconnectAttempts?: number
        reconnectDelayMs?: number
      }): Promise<void> {}
      async setupBusinessMessageListeners(): Promise<void> {}
      // Adapter compatibility methods (这些方法在 RustWebSocketClient 中不存在，但适配器需要)
      send(_params: unknown): Promise<unknown> {
        return Promise.resolve({})
      }
      onConnect(_callback?: () => void): void {
        // Mock method for compatibility
      }
      onDisconnect(_callback?: () => void): void {
        // Mock method for compatibility
      }
      connect(): Promise<void> {
        return Promise.resolve()
      }
    })()

export default rustWebSocketClient
