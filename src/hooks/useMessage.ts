import { logger } from '@/utils/logger'

import { ref, watchEffect, computed } from 'vue'
import { MittEnum, NotificationTypeEnum, RoomTypeEnum, SessionOperateEnum, UserType } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import type { SessionItem } from '@/services/types'
import type { SessionRightMenu, RightMenu } from '@/typings/components'
import { useChatStore } from '@/stores/chat'
import { useGlobalStore } from '@/stores/global'
import { useSettingStore } from '@/stores/setting'
import { useRoomStore } from '@/stores/room'
import { useUserStore } from '@/stores/user'
import { requestWithFallback } from '@/utils/MatrixApiBridgeAdapter'
import { ErrorType } from '@/utils/TauriInvokeHandler'
import { invokeWithErrorHandler } from '../utils/TauriInvokeHandler'
import { useI18n } from 'vue-i18n'
import { msg } from '@/utils/SafeUI'
import { flags } from '@/utils/envFlags'
import { sdkSetSessionTop } from '@/services/rooms'
import { muteRoom, unmuteRoom } from '@/integrations/matrix/pusher'
import { useDevConnectivity } from '@/hooks/useDevConnectivity'
import { hiddenSessions } from '@/utils/HiddenSessions'

const msgBoxShow = ref(false)
const shrinkStatus = ref(false)
export const useMessage = () => {
  const { t } = useI18n()
  const globalStore = useGlobalStore()
  const chatStore = useChatStore()
  const settingStore = useSettingStore()
  const chat = computed(() => settingStore.chat)
  const roomStore = useRoomStore()
  const userStore = useUserStore()
  const { backendConnected } = useDevConnectivity()
  const BOT_ALLOWED_MENU_INDEXES = new Set([0, 1, 2, 3])
  /** 监听独立窗口关闭事件 */
  watchEffect(() => {
    useMitt.on(MittEnum.SHRINK_WINDOW, async (event: boolean) => {
      shrinkStatus.value = event
    })
  })

  /**
   * 处理点击选中消息
   * 如果本地缓存中找不到自己，说明尚未同步服务端数据，此时强制刷新群成员信息。
   */
  const ensureGroupMembersSynced = async (roomId: string, sessionType: RoomTypeEnum) => {
    if (sessionType !== RoomTypeEnum.GROUP) return

    const currentUid = userStore.userInfo?.uid
    if (!currentUid) return

    const member = roomStore.getMember(roomId, currentUid)

    if (!member) {
      await roomStore.initRoom(roomId)
    }
  }

  const handleMsgClick = async (item: SessionItem) => {
    msgBoxShow.value = true
    // 更新当前会话信息
    globalStore.updateCurrentSessionRoomId(item.roomId)
    // 先更新会话，再根据是否存在自身成员做一次兜底刷新，防止批量切换账号后看到旧数据
    await ensureGroupMembersSynced(item.roomId, item.type)
    if (item.unreadCount && item.unreadCount > 0) {
      await requestWithFallback({ url: 'mark_msg_read', params: { roomId: item.roomId } })
      chatStore.markSessionRead(item.roomId)
    }
  }

  /**
   * 预加载聊天室
   * @param roomId
   */
  const preloadChatRoom = (roomId: string = '1') => {
    globalStore.updateCurrentSessionRoomId(roomId)
  }

  /**
   * 删除会话
   * @param roomId 会话信息
   * @param clearMessages 是否同时清除聊天记录（默认 true）
   */
  const handleMsgDelete = async (roomId: string, clearMessages: boolean = true) => {
    const currentSessions = chatStore.sessionList
    const currentIndex = currentSessions.findIndex((session) => session.roomId === roomId)

    // 检查是否是当前选中的会话
    const isCurrentSession = roomId === globalStore.currentSessionRoomId

    const targetSession = chatStore.getSession(roomId)
    if (flags.matrixEnabled && targetSession?.type === RoomTypeEnum.SINGLE) {
      try {
        const { deletePrivateSession } = await import('@/integrations/synapse/friends')
        await deletePrivateSession(roomId)
      } catch {}
    }
    // 删除会话，同时清除聊天记录，并调用Matrix leave接口
    await chatStore.removeSession(roomId, { clearMessages, leaveRoom: true })
    hiddenSessions.add(roomId)

    if (flags.matrixEnabled) {
      // Matrix mode: leaveRoom option handles the Matrix leave API call
    } else {
      // 使用隐藏会话接口
      const res = await invokeWithErrorHandler(
        'hide_contact_command',
        { data: { roomId, hide: true } },
        { errorType: ErrorType.Network }
      )
      logger.debug('hide_contact_command result:', { res, roomId })
    }

    // 如果不是当前选中的会话，直接返回
    if (!isCurrentSession) {
      return
    }

    const updatedSessions = chatStore.sessionList

    // 选择下一个或上一个会话
    const nextIndex = Math.min(currentIndex, updatedSessions.length - 1)
    const nextSession = updatedSessions[nextIndex]
    if (nextSession) {
      await handleMsgClick(nextSession)
    }
  }

  /** 处理双击事件 */
  const handleMsgDblclick = (_item: SessionItem) => {
    if (!chat.value.isDouble) return
  }

  const menuList = ref<SessionRightMenu[]>([
    {
      label: (item: SessionItem) => (item.top ? t('menu.unpin') : t('menu.pin')),
      icon: (item: SessionItem) => (item.top ? 'to-bottom' : 'to-top'),
      disabled: () => false,
      click: (item: SessionItem) => {
        const action = async () => {
          if (flags.matrixEnabled) {
            await sdkSetSessionTop(item.roomId, !item.top)
          } else {
            await requestWithFallback({ url: 'set_session_top', body: { roomId: item.roomId, top: !item.top } })
          }
        }
        action()
          .then(() => {
            // 更新本地会话状态
            chatStore.updateSession(item.roomId, { top: !item.top })
            msg.success(item.top ? t('message.message_menu.unpin_success') : t('message.message_menu.pin_success'))
          })
          .catch(() => {
            logger.warn('set_session_top failed', { roomId: item.roomId, nextTop: !item.top })
            msg.error(item.top ? t('message.message_menu.unpin_fail') : t('message.message_menu.pin_fail'))
          })
      }
    },
    {
      label: () => t('menu.copy_account'),
      icon: 'copy',
      click: (item: SessionItem) => {
        navigator.clipboard.writeText(item.account)
        msg.success(t('message.message_menu.copy_success', { account: item.account }))
      }
    },
    {
      label: () => t('menu.mark_unread'),
      icon: 'message-unread',
      click: async (item: SessionItem) => {
        // Mark room as unread by setting a fake unread count
        const unreadCount = item.unreadCount || 0
        const newUnreadCount = unreadCount > 0 ? unreadCount : 1

        if (flags.matrixEnabled) {
          // For Matrix, we need to track the read receipt locally
          // The unread count will be recalculated on next sync
          chatStore.updateSession(item.roomId, {
            unreadCount: newUnreadCount
          })
          logger.info('[useMessage] Room marked as unread', { roomId: item.roomId, unreadCount: newUnreadCount })
        } else {
          // Legacy API
          await requestWithFallback({
            url: 'mark_unread',
            body: { roomId: item.roomId }
          })
          chatStore.updateSession(item.roomId, {
            unreadCount: newUnreadCount
          })
        }

        // Update total unread count
        chatStore.updateTotalUnreadCount()

        msg.success(t('message.message_menu.mark_unread_success'))
      }
    },
    {
      label: (item: SessionItem) => {
        if (item.type === RoomTypeEnum.GROUP) {
          return t('menu.group_message_setting')
        }

        return item.muteNotification === NotificationTypeEnum.RECEPTION
          ? t('menu.set_do_not_disturb')
          : t('menu.unset_do_not_disturb')
      },
      icon: (item: SessionItem) => {
        if (item.type === RoomTypeEnum.GROUP) {
          return 'peoples-two'
        }
        return item.muteNotification === NotificationTypeEnum.RECEPTION ? 'close-remind' : 'remind'
      },
      disabled: (_item: SessionItem) => false,
      children: (item?: SessionItem): RightMenu[] => {
        if (!item || item.type === RoomTypeEnum.SINGLE) return []

        const sessionItem = item as SessionItem

        return [
          {
            label: () => t('menu.allow_notifications'),
            icon:
              !sessionItem.shield && sessionItem.muteNotification === NotificationTypeEnum.RECEPTION
                ? 'check-small'
                : '',
            action: async () => {
              // 如果当前是屏蔽状态，需要先取消屏蔽
              if (sessionItem.shield) {
                if (flags.matrixEnabled) {
                  await unmuteRoom(sessionItem.roomId)
                } else {
                  await requestWithFallback({
                    url: 'shield',
                    body: {
                      roomId: sessionItem.roomId,
                      state: false
                    }
                  })
                }
                chatStore.updateSession(sessionItem.roomId, { shield: false })
              }
              await handleNotificationChange(sessionItem, NotificationTypeEnum.RECEPTION)
            }
          },
          {
            label: () => t('menu.receive_silently'),
            icon:
              !sessionItem.shield && sessionItem.muteNotification === NotificationTypeEnum.NOT_DISTURB
                ? 'check-small'
                : '',
            action: async () => {
              // 如果当前是屏蔽状态，需要先取消屏蔽
              if (sessionItem.shield) {
                if (flags.matrixEnabled) {
                  await unmuteRoom(sessionItem.roomId)
                } else {
                  await requestWithFallback({
                    url: 'shield',
                    body: {
                      roomId: sessionItem.roomId,
                      state: false
                    }
                  })
                }
                chatStore.updateSession(sessionItem.roomId, { shield: false })
              }
              await handleNotificationChange(sessionItem, NotificationTypeEnum.NOT_DISTURB)
            }
          },
          {
            label: () => t('menu.block_group_messages'),
            icon: sessionItem.shield ? 'check-small' : '',
            action: async () => {
              if (flags.matrixEnabled) {
                if (!sessionItem.shield) {
                  await muteRoom(sessionItem.roomId)
                } else {
                  await unmuteRoom(sessionItem.roomId)
                }
              } else {
                await requestWithFallback({
                  url: 'shield',
                  body: {
                    roomId: sessionItem.roomId,
                    state: !sessionItem.shield
                  }
                })
              }

              // 更新本地会话状态
              chatStore.updateSession(sessionItem.roomId, {
                shield: !sessionItem.shield
              })

              msg.success(
                sessionItem.shield
                  ? t('message.message_menu.unshield_success')
                  : t('message.message_menu.shield_success')
              )
            }
          }
        ]
      },
      click: async (item: SessionItem) => {
        if (item.type === RoomTypeEnum.GROUP) return // 群聊不执行点击事件

        const newType =
          item.muteNotification === NotificationTypeEnum.RECEPTION
            ? NotificationTypeEnum.NOT_DISTURB
            : NotificationTypeEnum.RECEPTION

        await handleNotificationChange(item, newType)
      }
    }
  ])

  const specialMenuList = ref<SessionRightMenu[]>([
    {
      label: (item: SessionItem) => (item.shield ? t('menu.unblock_user_messages') : t('menu.block_user_messages')),
      icon: (item: SessionItem) => (item.shield ? 'message-success' : 'people-unknown'),
      visible: (item: SessionItem) => item.type === RoomTypeEnum.SINGLE,
      disabled: () => false,
      click: async (item: SessionItem) => {
        if (flags.matrixEnabled) {
          if (!item.shield) {
            await muteRoom(item.roomId)
          } else {
            await unmuteRoom(item.roomId)
          }
        } else {
          await requestWithFallback({
            url: 'shield',
            body: {
              roomId: item.roomId,
              state: !item.shield
            }
          })
        }

        // 更新本地会话状态
        chatStore.updateSession(item.roomId, {
          shield: !item.shield
        })

        msg.success(item.shield ? t('message.message_menu.unshield_success') : t('message.message_menu.shield_success'))
      }
    },
    {
      label: () => '隐藏会话',
      icon: 'forbid',
      click: async (item: SessionItem) => {
        try {
          if (flags.matrixEnabled && item.type === RoomTypeEnum.SINGLE) {
            const { hidePrivateSession } = await import('@/integrations/synapse/friends')
            await hidePrivateSession(item.roomId)
          } else {
            await requestWithFallback({
              url: 'hide_contact_command',
              body: { roomId: item.roomId, hide: true }
            })
          }
        } catch {}
        hiddenSessions.add(item.roomId)
        chatStore.removeSession(item.roomId, { clearMessages: false })
        msg.success('已隐藏会话')
      }
    },
    {
      label: () => t('menu.remove_from_list'),
      icon: 'delete',
      click: async (item: SessionItem) => {
        try {
          const confirmed = window.confirm(t('message.message_menu.confirm_delete_session'))
          if (!confirmed) return
          await handleMsgDelete(item.roomId)
          msg.success(t('message.message_menu.delete_session_success'))
        } catch (e) {
          logger.warn('remove_from_list failed', { roomId: item.roomId, error: e })
          msg.error(t('message.message_menu.delete_session_fail'))
        }
      }
    },
    {
      label: (item: SessionItem) => {
        if (item.type === RoomTypeEnum.SINGLE) return t('menu.delete_friend')
        if (item.operate === SessionOperateEnum.DISSOLUTION_GROUP) return t('menu.dissolve_group')
        return t('menu.leave_group')
      },
      icon: (item: SessionItem) => {
        if (item.type === RoomTypeEnum.SINGLE) return 'forbid'
        if (item.operate === SessionOperateEnum.DISSOLUTION_GROUP) return 'logout'
        return 'logout'
      },
      disabled: () => !backendConnected && !flags.matrixEnabled,
      click: async (item: SessionItem) => {
        logger.debug('删除好友或退出群聊执行', undefined, 'useMessage')
        // 单聊：删除好友
        if (item.type === RoomTypeEnum.SINGLE) {
          await requestWithFallback({
            url: 'delete_friend',
            body: { targetUid: item.detailId }
          })
          await import('@/stores/friends').then((m) => m.useFriendsStore().refreshAll())
          await handleMsgDelete(item.roomId)
          msg.success(t('message.message_menu.delete_friend_success'))
          return
        }

        // 群聊：检查是否是频道
        if (item.roomId === '1') {
          msg.warning(
            item.operate === SessionOperateEnum.DISSOLUTION_GROUP
              ? t('message.message_menu.cannot_dissolve_channel')
              : t('message.message_menu.cannot_quit_channel')
          )
          return
        }

        // 群聊：解散或退出
        const service = roomStore.getService()
        if (service) {
          await service.leaveRoom(item.roomId)
        }
        await handleMsgDelete(item.roomId)
        msg.success(
          item.operate === SessionOperateEnum.DISSOLUTION_GROUP
            ? t('message.message_menu.dissolve_group_success')
            : t('message.message_menu.quit_group_success')
        )
      }
    }
  ])

  // 全局菜单 - 适用于整个会话列表的操作
  const globalMenuList = ref<SessionRightMenu[]>([
    {
      label: () => t('menu.clear_all_unread'),
      icon: 'clear',
      click: async () => {
        // 使用 useChatUnread 中的 clearAllUnreadCount 方法
        const { useChatUnread: useChatUnreadComposable } = await import('@/stores/composables/chat-unread')
        const { clearAllUnreadCount } = useChatUnreadComposable({
          sessionList: { value: chatStore.sessionList },
          updateSession: chatStore.updateSession.bind(chatStore)
        })

        clearAllUnreadCount()
        msg.success(t('message.message_menu.clear_all_unread_success'))
      }
    }
  ])

  // 添加通知设置变更处理函数
  const handleNotificationChange = async (item: SessionItem, newType: NotificationTypeEnum) => {
    await requestWithFallback({
      url: 'notification',
      body: {
        roomId: item.roomId,
        type: newType
      }
    })

    // 更新本地会话状态
    chatStore.updateSession(item.roomId, {
      muteNotification: newType
    })

    // 如果从免打扰切换到允许提醒，需要重新计算全局未读数
    if (item.muteNotification === NotificationTypeEnum.NOT_DISTURB && newType === NotificationTypeEnum.RECEPTION) {
      chatStore.updateTotalUnreadCount()
    }

    // 显示操作成功提示
    let messageText = ''
    switch (newType) {
      case NotificationTypeEnum.RECEPTION:
        messageText = t('message.message_menu.notification_allowed')
        break
      case NotificationTypeEnum.NOT_DISTURB:
        messageText = t('message.message_menu.notification_silent')
        // 设置免打扰时也需要更新全局未读数，因为该会话的未读数将不再计入
        chatStore.updateTotalUnreadCount()
        break
    }
    msg.success(messageText)
  }

  const visibleMenu = (item: SessionItem) => {
    if (item.account === UserType.BOT) {
      return menuList.value.filter((_, index: number) => BOT_ALLOWED_MENU_INDEXES.has(index))
    }
    return menuList.value
  }

  const visibleSpecialMenu = (item: SessionItem) => {
    if (item.account === UserType.BOT) {
      return []
    }
    return specialMenuList.value.filter((menu) => {
      const labelText = typeof menu.label === 'function' ? menu.label(item) : menu.label
      if (labelText.includes(t('menu.block_user_messages')) || labelText.includes(t('menu.unblock_user_messages'))) {
        return item.type === RoomTypeEnum.SINGLE
      }
      if (labelText.includes(t('menu.delete_friend'))) {
        return item.type === RoomTypeEnum.SINGLE && item.operate === SessionOperateEnum.DELETE_FRIEND
      }
      if (item.roomId === '1' && labelText.includes(t('menu.leave_group'))) {
        return false
      }
      return true
    })
  }

  return {
    msgBoxShow,
    handleMsgClick,
    handleMsgDelete,
    handleMsgDblclick,
    menuList,
    specialMenuList,
    globalMenuList,
    visibleMenu,
    visibleSpecialMenu,
    preloadChatRoom
  }
}
