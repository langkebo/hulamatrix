import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useDebounceFn } from '@vueuse/core'
import { sumBy } from 'es-toolkit'
import { NotificationTypeEnum } from '@/enums'
import type { SessionItem } from '@/services/types'
import { isMac } from '@/utils/PlatformConstants'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import { logger } from '@/utils/logger'

/**
 * 统一的未读计数管理器
 */
export class UnreadCountManager {
  private pendingUpdates = new Set<string>()
  private readonly DEBOUNCE_DELAY = 60 // 防抖延迟
  private updateCallback: (() => void) | null = null
  private setTipVisible?: (visible: boolean) => void
  private debouncedExecuteUpdate: () => void

  constructor() {
    this.debouncedExecuteUpdate = useDebounceFn(() => {
      this.executeUpdate()
    }, this.DEBOUNCE_DELAY)
  }

  /**
   * 设置更新回调函数
   * @param callback 当需要实际更新时调用的回调函数
   */
  public setUpdateCallback(callback: () => void) {
    this.updateCallback = callback
  }

  /**
   * 请求更新未读计数
   * @param sessionId 可选的会话ID，如果提供则只更新特定会话
   */
  public requestUpdate(sessionId?: string) {
    if (sessionId) {
      this.pendingUpdates.add(sessionId)
    } else {
      this.pendingUpdates.add('*') // '*' 表示全局更新
    }

    this.debouncedExecuteUpdate()
  }

  /**
   * 计算全局未读计数
   * @param sessionList 会话列表
   * @param unReadMark 全局未读标记对象
   */
  public calculateTotal(
    sessionList: SessionItem[],
    unReadMark: {
      newFriendUnreadCount: number
      newGroupUnreadCount: number
      newMsgUnreadCount: number
      noticeUnreadCount: number
    }
  ) {
    // 检查当前窗口标签 (在测试环境中 Tauri API 不可用，跳过窗口检查)
    try {
      const webviewWindowLabel = WebviewWindow.getCurrent()
      if (webviewWindowLabel.label !== 'home' && webviewWindowLabel.label !== 'mobile-home') {
        return
      }
    } catch {
      // Tauri API 不可用 (如测试环境)，继续执行
    }

    logger.info('[UnreadCountManager] 计算全局未读消息计数')

    // 计算总未读数
    const totalUnread = sumBy(sessionList, (session) => {
      if (session.muteNotification === NotificationTypeEnum.NOT_DISTURB) {
        return 0
      }
      return Math.max(0, session.unreadCount || 0)
    })

    // 更新全局未读计数
    unReadMark.newMsgUnreadCount = totalUnread

    // 更新系统徽章 (包含通知未读数)
    this.updateSystemBadge(unReadMark)
  }

  /**
   * 执行实际的更新操作
   */
  private executeUpdate() {
    if (this.updateCallback) {
      this.updateCallback()
    }
    this.pendingUpdates.clear()
  }

  /**
   * 更新系统徽章计数
   */
  private async updateSystemBadge(unReadMark: {
    newFriendUnreadCount: number
    newGroupUnreadCount: number
    newMsgUnreadCount: number
    noticeUnreadCount: number
  }): Promise<void> {
    const messageUnread = Math.max(0, unReadMark.newMsgUnreadCount || 0)
    const friendUnread = Math.max(0, unReadMark.newFriendUnreadCount || 0)
    const groupUnread = Math.max(0, unReadMark.newGroupUnreadCount || 0)
    const noticeUnread = Math.max(0, unReadMark.noticeUnreadCount || 0)
    const badgeTotal = messageUnread + friendUnread + groupUnread + noticeUnread

    if (isMac()) {
      const count = badgeTotal > 0 ? badgeTotal : undefined
      await invokeWithErrorHandler('set_badge_count', { count })
    }

    // 更新tipVisible状态，用于控制托盘通知显示
    if (messageUnread > 0 || noticeUnread > 0) {
      // 有新消息或通知时，设置tipVisible为true，触发托盘闪烁
      this.setTipVisible?.(true)
    } else {
      // 没有未读消息或通知时，设置tipVisible为false
      this.setTipVisible?.(false)
    }
  }

  /**
   * 标记消息为已读
   * @param sessionId 会话ID
   * @param sessionList 会话列表
   * @param unReadMark 未读标记对象
   */
  public markRead(
    sessionId: string,
    sessionList: SessionItem[],
    unReadMark: {
      newFriendUnreadCount: number
      newGroupUnreadCount: number
      newMsgUnreadCount: number
      noticeUnreadCount: number
    }
  ) {
    const session = sessionList.find((s) => s.id === sessionId)
    if (session) {
      session.unreadCount = 0
      this.calculateTotal(sessionList, unReadMark)
    }
  }

  /**
   * 手动刷新系统徽章计数
   */
  public refreshBadge(unReadMark: {
    newFriendUnreadCount: number
    newGroupUnreadCount: number
    newMsgUnreadCount: number
    noticeUnreadCount: number
  }) {
    this.updateSystemBadge(unReadMark)
  }

  /**
   * 设置tipVisible回调函数
   * @param callback 回调函数，用于设置tipVisible状态
   */
  public setTipVisibleCallback(callback: (visible: boolean) => void) {
    this.setTipVisible = callback
  }

  /**
   * 销毁管理器，清理资源
   */
  public destroy() {
    this.pendingUpdates.clear()
  }
}

// 创建单例实例
export const unreadCountManager = new UnreadCountManager()
