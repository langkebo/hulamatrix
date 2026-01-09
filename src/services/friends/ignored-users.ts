/**
 * Ignored Users Management
 * Handles ignoring and unignoring users
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'

/**
 * Ignored Users Manager
 */
export class IgnoredUsersManager {
  /**
   * 忽略用户
   */
  async ignoreUsers(userIds: string[]): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      type IgnoreUsersMethod = (userIds: string[]) => Promise<unknown>
      const ignoreUsersMethod = client.ignoreUsers as IgnoreUsersMethod | undefined
      await ignoreUsersMethod?.(userIds)
      logger.info('[IgnoredUsers] Users ignored successfully', { userIds })
    } catch (error) {
      logger.error('[IgnoredUsers] Failed to ignore users', { error, userIds })
      throw new Error(`Failed to ignore users: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 取消忽略用户
   */
  async unignoreUsers(userIds: string[]): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      // 获取当前忽略列表
      let ignoredList: Record<string, { type?: number }> = {}
      try {
        type AccountDataGetter = (type: string) => { getContent?: () => Record<string, { type?: number }> } | undefined
        const getAccountDataMethod = client.getAccountData as AccountDataGetter | undefined
        const ignoredEvent = getAccountDataMethod?.('m.ignored_user_list')
        type ContentGetter = () => Record<string, { type?: number }>
        const getContentMethod = ignoredEvent?.getContent as ContentGetter | undefined
        ignoredList = { ...(getContentMethod?.() || {}) }
      } catch {
        // 如果获取失败，使用空对象
      }

      // 从忽略列表中移除指定用户
      for (const userId of userIds) {
        delete ignoredList[userId]
      }

      // 更新忽略列表
      type AccountDataSetter = (type: string, content: Record<string, { type?: number }>) => Promise<unknown>
      const setAccountDataMethod = client.setAccountData as AccountDataSetter | undefined
      await setAccountDataMethod?.('m.ignored_user_list', ignoredList)

      logger.info('[IgnoredUsers] Users unignored successfully', { userIds })
    } catch (error) {
      logger.error('[IgnoredUsers] Failed to unignore users', { error, userIds })
      throw new Error(`Failed to unignore users: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 获取已忽略的用户列表
   */
  async getIgnoredUsers(): Promise<string[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      return []
    }

    try {
      type AccountDataGetter = (type: string) => { getContent?: () => Record<string, { type?: number }> } | undefined
      const getAccountDataMethod = client.getAccountData as AccountDataGetter | undefined
      const ignoredEvent = getAccountDataMethod?.('m.ignored_user_list')
      type ContentGetter = () => Record<string, { type?: number }>
      const getContentMethod = ignoredEvent?.getContent as ContentGetter | undefined
      const ignoredList = getContentMethod?.() || {}
      const userIds = Object.keys(ignoredList)
      logger.debug('[IgnoredUsers] Got ignored users list', { count: userIds.length })
      return userIds
    } catch (error) {
      logger.warn('[IgnoredUsers] Failed to get ignored users list', { error })
      return []
    }
  }

  /**
   * 检查用户是否被忽略
   */
  async isUserIgnored(userId: string): Promise<boolean> {
    const ignoredUsers = await this.getIgnoredUsers()
    return ignoredUsers.includes(userId)
  }
}
