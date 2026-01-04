/**
 * Session Settings Service
 *
 * 使用 Matrix SDK 的 room account data 和 tags 管理会话设置：
 * - 置顶: 使用 m.tag room account data
 * - 屏蔽: 使用自定义 room account data
 * - 免打扰: 使用 m.marked_unread 或自定义标记
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { setRoomTag, deleteRoomTag } from '@/utils/matrixClientUtils'
import { logger } from '@/utils/logger'

// Matrix 标准标签
const MATRIX_TAG_FAVORITE = 'm.favourite' // 置顶

// 自定义 account data 类型
const ACCOUNT_DATA_SHIELD = 'im.hula.shield' // 屏蔽设置
const ACCOUNT_DATA_NOTIFICATION = 'im.hula.notification' // 通知设置
const ACCOUNT_DATA_FRIEND_REMARK = 'im.hula.friend_remark' // 好友备注
const ACCOUNT_DATA_ROOM_NICKNAME = 'im.hula.room_nickname' // 房间昵称（群昵称）
const ACCOUNT_DATA_USER_STATE = 'im.hula.user_state' // 用户状态（自定义状态）

/**
 * 会话设置服务
 */
export const sessionSettingsService = {
  /**
   * 设置会话置顶
   * @param roomId 房间ID
   * @param top 是否置顶
   */
  async setSessionTop(roomId: string, top: boolean): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        logger.warn('[SessionSettings] No Matrix client available')
        return
      }

      if (top) {
        // 使用 m.favourite 标签设置置顶
        await setRoomTag(client, roomId, MATRIX_TAG_FAVORITE, { order: 0.5 })
        logger.debug('[SessionSettings] Session topped:', roomId)
      } else {
        // 移除置顶标签
        await deleteRoomTag(client, roomId, MATRIX_TAG_FAVORITE)
        logger.debug('[SessionSettings] Session untopped:', roomId)
      }
    } catch (error) {
      logger.error('[SessionSettings] Failed to set session top:', { error, roomId })
      throw error
    }
  },

  /**
   * 设置会话屏蔽
   * @param roomId 房间ID
   * @param shield 是否屏蔽
   */
  async setSessionShield(roomId: string, shield: boolean): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        logger.warn('[SessionSettings] No Matrix client available')
        return
      }

      // 使用 room account data 存储屏蔽状态
      // setAccountData(eventType: string, content: Record<string, unknown>)
      const setAccountData = client.setAccountData as
        | ((roomId: string, eventType: string, content: Record<string, unknown>) => Promise<unknown>)
        | undefined

      if (setAccountData) {
        await setAccountData(roomId, ACCOUNT_DATA_SHIELD, {
          shield,
          updated_at: Date.now()
        })
        logger.debug('[SessionSettings] Session shield set:', { roomId, shield })
      } else {
        logger.warn('[SessionSettings] setAccountData not available')
      }
    } catch (error) {
      logger.error('[SessionSettings] Failed to set session shield:', { error, roomId })
      throw error
    }
  },

  /**
   * 设置通知模式
   * @param roomId 房间ID
   * @param mode 通知模式 ('reception' | 'not_disturb')
   */
  async setNotificationMode(roomId: string, mode: 'reception' | 'not_disturb'): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        logger.warn('[SessionSettings] No Matrix client available')
        return
      }

      // 使用 room account data 存储通知模式
      const setAccountData = client.setAccountData as
        | ((roomId: string, eventType: string, content: Record<string, unknown>) => Promise<unknown>)
        | undefined

      if (setAccountData) {
        await setAccountData(roomId, ACCOUNT_DATA_NOTIFICATION, {
          mode,
          updated_at: Date.now()
        })
        logger.debug('[SessionSettings] Notification mode set:', { roomId, mode })
      } else {
        logger.warn('[SessionSettings] setAccountData not available')
      }
    } catch (error) {
      logger.error('[SessionSettings] Failed to set notification mode:', { error, roomId })
      throw error
    }
  },

  /**
   * 设置房间昵称（群昵称）
   * @param roomId 房间ID
   * @param nickname 昵称
   */
  async setRoomNickname(roomId: string, nickname: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        logger.warn('[SessionSettings] No Matrix client available')
        return
      }

      // 使用 room account data 存储房间昵称
      const setAccountData = client.setAccountData as
        | ((roomId: string, eventType: string, content: Record<string, unknown>) => Promise<unknown>)
        | undefined

      if (setAccountData) {
        await setAccountData(roomId, ACCOUNT_DATA_ROOM_NICKNAME, {
          nickname,
          updated_at: Date.now()
        })
        logger.debug('[SessionSettings] Room nickname set:', { roomId, nickname })
      } else {
        logger.warn('[SessionSettings] setAccountData not available')
      }
    } catch (error) {
      logger.error('[SessionSettings] Failed to set room nickname:', { error, roomId })
      throw error
    }
  },

  /**
   * 设置好友备注
   * @param roomId 房间ID（与好友的私聊房间）
   * @param remark 备注内容
   */
  async setFriendRemark(roomId: string, remark: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        logger.warn('[SessionSettings] No Matrix client available')
        return
      }

      // 使用 room account data 存储备注
      const setAccountData = client.setAccountData as
        | ((roomId: string, eventType: string, content: Record<string, unknown>) => Promise<unknown>)
        | undefined

      if (setAccountData) {
        await setAccountData(roomId, ACCOUNT_DATA_FRIEND_REMARK, {
          remark,
          updated_at: Date.now()
        })
        logger.debug('[SessionSettings] Friend remark set:', { roomId, remark })
      } else {
        logger.warn('[SessionSettings] setAccountData not available')
      }
    } catch (error) {
      logger.error('[SessionSettings] Failed to set friend remark:', { error, roomId })
      throw error
    }
  },

  /**
   * 获取会话置顶状态
   * @param roomId 房间ID
   * @returns 是否置顶
   */
  isSessionTopped(roomId: string): boolean {
    try {
      const client = matrixClientService.getClient()
      if (!client) return false

      const room = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const currentRoom = room?.call(client, roomId)
      if (!currentRoom) return false

      const tags = (currentRoom as Record<string, unknown>).tags as Record<string, { order: number }> | undefined

      return tags?.[MATRIX_TAG_FAVORITE] !== undefined
    } catch (error) {
      logger.error('[SessionSettings] Failed to check session top:', { error, roomId })
      return false
    }
  },

  /**
   * 获取会话屏蔽状态
   * @param roomId 房间ID
   * @returns 是否屏蔽
   */
  isSessionShielded(roomId: string): boolean {
    try {
      const client = matrixClientService.getClient()
      if (!client) return false

      const room = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const currentRoom = room?.call(client, roomId)
      if (!currentRoom) return false

      // 从 room account data 读取屏蔽状态
      const accountData = (currentRoom as Record<string, unknown>).accountData as
        | Record<string, { content: Record<string, unknown> }>
        | undefined

      const shieldData = accountData?.[ACCOUNT_DATA_SHIELD]?.content as { shield?: boolean } | undefined
      return shieldData?.shield === true
    } catch (error) {
      logger.error('[SessionSettings] Failed to check session shield:', { error, roomId })
      return false
    }
  },

  /**
   * 获取通知模式
   * @param roomId 房间ID
   * @returns 通知模式
   */
  getNotificationMode(roomId: string): 'reception' | 'not_disturb' {
    try {
      const client = matrixClientService.getClient()
      if (!client) return 'reception'

      const room = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const currentRoom = room?.call(client, roomId)
      if (!currentRoom) return 'reception'

      // 从 room account data 读取通知模式
      const accountData = (currentRoom as Record<string, unknown>).accountData as
        | Record<string, { content: Record<string, unknown> }>
        | undefined

      const notificationData = accountData?.[ACCOUNT_DATA_NOTIFICATION]?.content as
        | { mode?: 'reception' | 'not_disturb' }
        | undefined

      return notificationData?.mode || 'reception'
    } catch (error) {
      logger.error('[SessionSettings] Failed to get notification mode:', { error, roomId })
      return 'reception'
    }
  },

  /**
   * 获取好友备注
   * @param roomId 房间ID
   * @returns 备注内容
   */
  getFriendRemark(roomId: string): string {
    try {
      const client = matrixClientService.getClient()
      if (!client) return ''

      const room = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const currentRoom = room?.call(client, roomId)
      if (!currentRoom) return ''

      // 从 room account data 读取备注
      const accountData = (currentRoom as Record<string, unknown>).accountData as
        | Record<string, { content: Record<string, unknown> }>
        | undefined

      const remarkData = accountData?.[ACCOUNT_DATA_FRIEND_REMARK]?.content as { remark?: string } | undefined
      return remarkData?.remark || ''
    } catch (error) {
      logger.error('[SessionSettings] Failed to get friend remark:', { error, roomId })
      return ''
    }
  },

  /**
   * 设置用户状态（自定义状态）
   * @param stateId 状态ID
   */
  async setUserState(stateId: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        logger.warn('[SessionSettings] No Matrix client available')
        return
      }

      // 使用全局 account data 存储用户状态
      const setAccountData = client.setAccountData as
        | ((eventType: string, content: Record<string, unknown>) => Promise<unknown>)
        | undefined

      if (setAccountData) {
        await setAccountData(ACCOUNT_DATA_USER_STATE, {
          stateId,
          updated_at: Date.now()
        })
        logger.debug('[SessionSettings] User state set:', { stateId })
      } else {
        logger.warn('[SessionSettings] setAccountData not available')
      }
    } catch (error) {
      logger.error('[SessionSettings] Failed to set user state:', { error })
      throw error
    }
  },

  /**
   * 获取用户状态（自定义状态）
   * @returns 状态ID
   */
  getUserState(): string {
    try {
      const client = matrixClientService.getClient()
      if (!client) return ''

      // 使用全局 account data 读取用户状态
      const getAccountData = client.getAccountData as
        | ((eventType: string) => Record<string, unknown> | { getContent?: () => Record<string, unknown> } | undefined)
        | undefined

      if (!getAccountData) return ''

      const accountData = getAccountData(ACCOUNT_DATA_USER_STATE)
      if (!accountData) return ''

      const content = typeof accountData.getContent === 'function' ? accountData.getContent() : accountData
      const stateData = content as { stateId?: string } | undefined
      return stateData?.stateId || ''
    } catch (error) {
      logger.error('[SessionSettings] Failed to get user state:', { error })
      return ''
    }
  }
}

// 类型导出
export type NotificationMode = 'reception' | 'not_disturb'
