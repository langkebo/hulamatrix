/**
 * Chat List Context Menu Utilities
 *
 * Utilities for managing context menu actions on chat list items
 *
 * @module utils/chatListMenu
 */

import type { SessionItem } from '@/services/types'
import type { RightMenu } from '@/typings/components'
import type { SessionMenuItem } from '@/types/chat'
import { RoomTypeEnum, NotificationTypeEnum, SessionOperateEnum } from '@/enums'
import { useChatStore } from '@/stores/chat'
import { useGlobalStore } from '@/stores/global'
import { useRoomStore } from '@/stores/room'
import { msg } from './SafeUI'
import { sdkSetSessionTop } from '@/services/rooms'
import { muteRoom, unmuteRoom } from '@/integrations/matrix/pusher'
import { requestWithFallback } from '@/utils/MatrixApiBridgeAdapter'
import { hiddenSessions } from './HiddenSessions'
import { logger } from '@/utils/logger'

/**
 * Create pin/unpin menu item
 */
export function createPinMenuItem(): SessionMenuItem {
  return {
    label: (item: SessionItem) => (item.top ? '取消置顶' : '置顶'),
    icon: (item: SessionItem) => (item.top ? 'to-bottom' : 'to-top'),
    click: async (item: SessionItem) => {
      const chatStore = useChatStore()
      try {
        // 先尝试调用 Matrix API
        await sdkSetSessionTop(item.roomId, !item.top)
      } catch (error) {
        // 如果 Matrix 客户端未初始化或失败，只更新本地状态
        logger.warn('[createPinMenuItem] Matrix API failed, using local state only:', error)
      }

      // 无论 Matrix API 是否成功，都更新本地状态
      chatStore.updateSession(item.roomId, { top: !item.top })
      msg.success(item.top ? '取消置顶成功' : '置顶成功')
    }
  }
}

/**
 * Create copy account menu item
 */
export function createCopyAccountMenuItem(): SessionMenuItem {
  return {
    label: '复制账号',
    icon: 'copy',
    click: async (item: SessionItem) => {
      await navigator.clipboard.writeText(item.account)
      msg.success(`已复制: ${item.account}`)
    }
  }
}

/**
 * Create mark as unread menu item
 */
export function createMarkUnreadMenuItem(): SessionMenuItem {
  return {
    label: '标为未读',
    icon: 'message-unread',
    click: async (item: SessionItem) => {
      const chatStore = useChatStore()
      const newUnreadCount = item.unreadCount > 0 ? item.unreadCount : 1
      chatStore.updateSession(item.roomId, { unreadCount: newUnreadCount })
      chatStore.updateTotalUnreadCount()
      msg.success('已标记为未读')
    }
  }
}

/**
 * Create notification settings menu item
 */
export function createNotificationMenuItem(): SessionMenuItem {
  return {
    label: (item: SessionItem) => {
      if (item.type === RoomTypeEnum.GROUP) {
        return '群消息设置'
      }
      return item.muteNotification === NotificationTypeEnum.RECEPTION ? '开启免打扰' : '关闭免打扰'
    },
    icon: (item: SessionItem) => {
      if (item.type === RoomTypeEnum.GROUP) {
        return 'peoples-two'
      }
      return item.muteNotification === NotificationTypeEnum.RECEPTION ? 'close-remind' : 'remind'
    },
    children: (item: SessionItem) => {
      if (item.type === RoomTypeEnum.SINGLE) return []

      const chatStore = useChatStore()
      return [
        {
          label: '允许通知',
          icon: !item.shield && item.muteNotification === NotificationTypeEnum.RECEPTION ? 'check-small' : '',
          action: async () => {
            try {
              if (item.shield) {
                await unmuteRoom(item.roomId)
                chatStore.updateSession(item.roomId, { shield: false })
              }
            } catch (error) {
              logger.warn('[createNotificationMenuItem] Failed to unmute room:', error)
            }
            await handleNotificationChange(item, NotificationTypeEnum.RECEPTION)
          }
        },
        {
          label: '静默接收',
          icon: !item.shield && item.muteNotification === NotificationTypeEnum.NOT_DISTURB ? 'check-small' : '',
          action: async () => {
            try {
              if (item.shield) {
                await unmuteRoom(item.roomId)
                chatStore.updateSession(item.roomId, { shield: false })
              }
            } catch (error) {
              logger.warn('[createNotificationMenuItem] Failed to unmute room:', error)
            }
            await handleNotificationChange(item, NotificationTypeEnum.NOT_DISTURB)
          }
        },
        {
          label: '屏蔽群消息',
          icon: item.shield ? 'check-small' : '',
          action: async () => {
            try {
              if (!item.shield) {
                await muteRoom(item.roomId)
              } else {
                await unmuteRoom(item.roomId)
              }
            } catch (error) {
              logger.warn('[createNotificationMenuItem] Failed to toggle mute:', error)
            }
            chatStore.updateSession(item.roomId, { shield: !item.shield })
            msg.success(item.shield ? '已解除屏蔽' : '已屏蔽')
          }
        }
      ]
    },
    click: async (item: SessionItem) => {
      if (item.type === RoomTypeEnum.GROUP) return

      const newType =
        item.muteNotification === NotificationTypeEnum.RECEPTION
          ? NotificationTypeEnum.NOT_DISTURB
          : NotificationTypeEnum.RECEPTION
      await handleNotificationChange(item, newType)
    }
  }
}

/**
 * Handle notification change
 */
async function handleNotificationChange(item: SessionItem, newType: NotificationTypeEnum) {
  const chatStore = useChatStore()

  try {
    await requestWithFallback({
      url: 'notification',
      body: {
        roomId: item.roomId,
        type: newType
      }
    })
  } catch (error) {
    logger.warn('[handleNotificationChange] Failed to update notification on server:', error)
  }

  // 无论服务器是否成功，都更新本地状态
  chatStore.updateSession(item.roomId, {
    muteNotification: newType
  })

  // Update total unread count when changing notification settings
  if (item.muteNotification === NotificationTypeEnum.NOT_DISTURB && newType === NotificationTypeEnum.RECEPTION) {
    chatStore.updateTotalUnreadCount()
  } else if (newType === NotificationTypeEnum.NOT_DISTURB) {
    chatStore.updateTotalUnreadCount()
  }

  const message = newType === NotificationTypeEnum.RECEPTION ? '已允许通知' : '已开启免打扰'
  msg.success(message)
}

/**
 * Create block user menu item (for direct messages)
 */
export function createBlockUserMenuItem(): SessionMenuItem {
  return {
    label: (item: SessionItem) => (item.shield ? '解除屏蔽' : '屏蔽消息'),
    icon: (item: SessionItem) => (item.shield ? 'message-success' : 'people-unknown'),
    visible: (item: SessionItem) => item.type === RoomTypeEnum.SINGLE,
    click: async (item: SessionItem) => {
      const chatStore = useChatStore()
      try {
        if (!item.shield) {
          await muteRoom(item.roomId)
        } else {
          await unmuteRoom(item.roomId)
        }
      } catch (error) {
        logger.warn('[createBlockUserMenuItem] Matrix API failed, using local state only:', error)
      }

      // 无论 API 是否成功，都更新本地状态
      chatStore.updateSession(item.roomId, { shield: !item.shield })
      msg.success(item.shield ? '已解除屏蔽' : '已屏蔽')
    }
  }
}

/**
 * Create hide session menu item
 */
export function createHideSessionMenuItem(): SessionMenuItem {
  return {
    label: '隐藏会话',
    icon: 'forbid',
    click: async (item: SessionItem) => {
      try {
        const { hidePrivateSession } = await import('@/integrations/synapse/friends')
        await hidePrivateSession(item.roomId)
      } catch {}
      hiddenSessions.add(item.roomId)
      const chatStore = useChatStore()
      chatStore.removeSession(item.roomId, { clearMessages: false })
      msg.success('已隐藏会话')
    }
  }
}

/**
 * Create delete session menu item
 */
export function createDeleteSessionMenuItem(): SessionMenuItem {
  return {
    label: '删除会话',
    icon: 'delete',
    click: async (item: SessionItem) => {
      const confirmed = window.confirm('确定删除该会话吗？')
      if (!confirmed) return

      const _chatStore = useChatStore()
      await handleMsgDelete(item.roomId)
      msg.success('已删除会话')
    }
  }
}

/**
 * Handle delete session
 */
async function handleMsgDelete(roomId: string) {
  const chatStore = useChatStore()
  const currentSessions = chatStore.sessionList
  const currentIndex = currentSessions.findIndex((session) => session.roomId === roomId)
  const targetSession = chatStore.getSession(roomId)

  logger.info('[handleMsgDelete] Starting delete:', {
    roomId,
    currentIndex,
    totalSessions: currentSessions.length,
    targetSession: targetSession ? 'found' : 'not found'
  })

  if (targetSession?.type === RoomTypeEnum.SINGLE) {
    try {
      const { deletePrivateSession } = await import('@/integrations/synapse/friends')
      await deletePrivateSession(roomId)
      logger.info('[handleMsgDelete] Private session deleted from server')
    } catch (error) {
      logger.warn('[handleMsgDelete] Failed to delete private session from server:', error)
    }
  }

  try {
    await chatStore.removeSession(roomId, { clearMessages: true, leaveRoom: true })
    hiddenSessions.add(roomId)
    logger.info('[handleMsgDelete] Session removed from store:', {
      remainingSessions: chatStore.sessionList.length
    })
  } catch (error) {
    logger.error('[handleMsgDelete] Failed to remove session:', error)
    msg.error('删除会话失败')
    return
  }

  // Select next session if needed
  const isCurrentSession = roomId === useGlobalStore().currentSessionRoomId
  if (isCurrentSession) {
    const updatedSessions = chatStore.sessionList
    const nextIndex = Math.min(currentIndex, updatedSessions.length - 1)
    const nextSession = updatedSessions[nextIndex]
    if (nextSession) {
      useGlobalStore().updateCurrentSessionRoomId(nextSession.roomId)
      logger.info('[handleMsgDelete] Switched to next session:', nextSession.roomId)
    } else {
      logger.info('[handleMsgDelete] No next session available')
    }
  }

  msg.success('已删除会话')
}

/**
 * Create delete friend / leave group menu item
 */
export function createDeleteFriendMenuItem(): SessionMenuItem {
  return {
    label: (item: SessionItem) => {
      if (item.type === RoomTypeEnum.SINGLE) return '删除好友'
      if (item.operate === SessionOperateEnum.DISSOLUTION_GROUP) return '解散群组'
      return '退出群组'
    },
    icon: (item: SessionItem) => {
      if (item.type === RoomTypeEnum.SINGLE) return 'forbid'
      return 'logout'
    },
    click: async (item: SessionItem) => {
      // Direct chat: delete friend
      if (item.type === RoomTypeEnum.SINGLE) {
        await requestWithFallback({
          url: 'delete_friend',
          body: { targetUid: item.detailId }
        })
        await import('@/stores/friends').then((m) => m.useFriendsStore().refreshAll())
        await handleMsgDelete(item.roomId)
        msg.success('已删除好友')
        return
      }

      // Group chat: check if it's a channel
      if (item.roomId === '1') {
        msg.warning(item.operate === SessionOperateEnum.DISSOLUTION_GROUP ? '无法解散频道' : '无法退出频道')
        return
      }

      // Group chat: leave or dissolve
      const roomStore = useRoomStore()
      const service = roomStore.getService()
      if (service) {
        await service.leaveRoom(item.roomId)
      }
      await handleMsgDelete(item.roomId)
      msg.success(item.operate === SessionOperateEnum.DISSOLUTION_GROUP ? '已解散群组' : '已退出群组')
    }
  }
}

/**
 * Get default menu items
 */
export function getDefaultMenuItems(): SessionMenuItem[] {
  return [createPinMenuItem(), createCopyAccountMenuItem(), createMarkUnreadMenuItem(), createNotificationMenuItem()]
}

/**
 * Get special menu items (destructive actions)
 */
export function getSpecialMenuItems(): SessionMenuItem[] {
  return [
    createBlockUserMenuItem(),
    createHideSessionMenuItem(),
    createDeleteSessionMenuItem(),
    createDeleteFriendMenuItem()
  ]
}

/**
 * Filter menu items for bot accounts
 */
export function filterBotMenuItems(items: SessionMenuItem[]): SessionMenuItem[] {
  const BOT_ALLOWED_INDEXES = new Set([0, 1, 2, 3]) // pin, copy, mark unread, notification
  return items.filter((_, index) => BOT_ALLOWED_INDEXES.has(index))
}

/**
 * Filter menu items by visibility
 */
export function filterVisibleMenuItems(items: SessionMenuItem[], item: SessionItem): SessionMenuItem[] {
  return items.filter((menuItem) => {
    if (typeof menuItem.visible === 'function') {
      return menuItem.visible(item)
    }
    return menuItem.visible !== false
  })
}

/**
 * Convert SessionMenuItem to MenuItem (legacy format)
 */
export function toLegacyMenuItem(sessionMenuItem: SessionMenuItem): RightMenu {
  // Wrap the click function to preserve the SessionItem parameter
  const wrappedClick = sessionMenuItem.click
    ? (content: unknown) => {
        logger.debug('[toLegacyMenuItem wrappedClick] Called with:', {
          content,
          hasRoomId: content && typeof content === 'object' && 'roomId' in content,
          originalClick: sessionMenuItem.click?.name || 'anonymous'
        })

        // Validate that content is a valid SessionItem before calling the handler
        if (content && typeof content === 'object' && 'roomId' in content) {
          logger.debug('[toLegacyMenuItem wrappedClick] Calling original click handler')
          sessionMenuItem.click!(content as SessionItem)
        } else {
          logger.warn('[toLegacyMenuItem] Invalid SessionItem passed to click handler:', { content })
        }
      }
    : undefined

  // Preserve the visible function or boolean value
  const convertedVisible =
    typeof sessionMenuItem.visible === 'function' ? sessionMenuItem.visible : sessionMenuItem.visible

  // Preserve label and icon whether they are strings or functions
  const convertedLabel = sessionMenuItem.label
  const convertedIcon = sessionMenuItem.icon

  return {
    label: convertedLabel,
    icon: convertedIcon,
    click: wrappedClick,
    visible: convertedVisible,
    action: sessionMenuItem.action as (() => void) | undefined,
    children:
      typeof sessionMenuItem.children === 'function' || Array.isArray(sessionMenuItem.children)
        ? (sessionMenuItem.children as RightMenu[] | (() => RightMenu[]))
        : undefined
  }
}
