/**
 * Friend Categories Management
 * Handles friend category operations
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import type { FriendCategory, FriendCategoriesContent, Friend } from './types'

/**
 * Friend Categories Manager
 */
export class CategoriesManager {
  /**
   * 列出所有好友分类
   */
  async listCategories(): Promise<FriendCategory[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      // Synapse API doesn't support categories, use account data directly
      return this.listCategoriesViaAccountData()
    } catch (error) {
      logger.warn('[Categories] Failed to list categories:', error)
      return []
    }
  }

  /**
   * 通过账户数据获取分类
   */
  private async listCategoriesViaAccountData(): Promise<FriendCategory[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      type AccountDataGetter = (type: string) => { getContent?: () => FriendCategoriesContent } | undefined
      const getAccountDataMethod = client.getAccountData as AccountDataGetter | undefined
      const categoriesEvent = getAccountDataMethod?.('m.friend_categories')
      type ContentGetter = () => FriendCategoriesContent
      const getContentMethod = categoriesEvent?.getContent as ContentGetter | undefined
      const content = getContentMethod?.()

      return content?.categories || []
    } catch (error) {
      logger.warn('[Categories] Failed to list categories via account data:', error)
      return []
    }
  }

  /**
   * 创建好友分类
   */
  async createCategory(name: string): Promise<FriendCategory> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    return this.createCategoryViaAccountData(name)
  }

  /**
   * 通过账户数据创建分类
   */
  private async createCategoryViaAccountData(name: string): Promise<FriendCategory> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      type AccountDataGetter = (type: string) => { getContent?: () => FriendCategoriesContent } | undefined
      const getAccountDataMethod = client.getAccountData as AccountDataGetter | undefined
      const categoriesEvent = getAccountDataMethod?.('m.friend_categories')
      type ContentGetter = () => FriendCategoriesContent
      const getContentMethod = categoriesEvent?.getContent as ContentGetter | undefined
      const content = getContentMethod?.() || { categories: [] }

      // 生成分类ID
      const categoryId = `category_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

      // 计算排序顺序
      const maxOrder = Math.max(0, ...content.categories.map((c) => c.order))

      const newCategory: FriendCategory = {
        id: categoryId,
        name,
        order: maxOrder + 1
      }

      content.categories.push(newCategory)

      // 保存更新后的分类
      type AccountDataSetter = (type: string, content: FriendCategoriesContent) => Promise<void>
      const setAccountDataMethod = client.setAccountData as AccountDataSetter | undefined
      await setAccountDataMethod?.('m.friend_categories', content)

      logger.info('[Categories] Category created', { name, categoryId })
      return newCategory
    } catch (error) {
      logger.error('[Categories] Failed to create category:', error)
      throw error
    }
  }

  /**
   * 重命名好友分类
   */
  async renameCategory(categoryId: string, newName: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    await this.renameCategoryViaAccountData(categoryId, newName)
  }

  /**
   * 通过账户数据重命名分类
   */
  private async renameCategoryViaAccountData(categoryId: string, newName: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      type AccountDataGetter = (type: string) => { getContent?: () => FriendCategoriesContent } | undefined
      const getAccountDataMethod = client.getAccountData as AccountDataGetter | undefined
      const categoriesEvent = getAccountDataMethod?.('m.friend_categories')
      type ContentGetter = () => FriendCategoriesContent
      const getContentMethod = categoriesEvent?.getContent as ContentGetter | undefined
      const content = getContentMethod?.()

      if (!content) {
        throw new Error('Categories not found')
      }

      const category = content.categories.find((c) => c.id === categoryId)
      if (!category) {
        throw new Error('Category not found')
      }

      category.name = newName

      // 保存更新后的分类
      type AccountDataSetter = (type: string, content: FriendCategoriesContent) => Promise<void>
      const setAccountDataMethod = client.setAccountData as AccountDataSetter | undefined
      await setAccountDataMethod?.('m.friend_categories', content)

      logger.info('[Categories] Category renamed', { categoryId, newName })
    } catch (error) {
      logger.error('[Categories] Failed to rename category:', error)
      throw error
    }
  }

  /**
   * 删除好友分类
   */
  async deleteCategory(categoryId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    await this.deleteCategoryViaAccountData(categoryId)
  }

  /**
   * 通过账户数据删除分类
   */
  private async deleteCategoryViaAccountData(categoryId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      type AccountDataGetter = (type: string) => { getContent?: () => FriendCategoriesContent } | undefined
      const getAccountDataMethod = client.getAccountData as AccountDataGetter | undefined
      const categoriesEvent = getAccountDataMethod?.('m.friend_categories')
      type ContentGetter = () => FriendCategoriesContent
      const getContentMethod = categoriesEvent?.getContent as ContentGetter | undefined
      const content = getContentMethod?.()

      if (!content) {
        throw new Error('Categories not found')
      }

      content.categories = content.categories.filter((c) => c.id !== categoryId)

      // 保存更新后的分类
      type AccountDataSetter = (type: string, content: FriendCategoriesContent) => Promise<void>
      const setAccountDataMethod = client.setAccountData as AccountDataSetter | undefined
      await setAccountDataMethod?.('m.friend_categories', content)

      logger.info('[Categories] Category deleted', { categoryId })
    } catch (error) {
      logger.error('[Categories] Failed to delete category:', error)
      throw error
    }
  }

  /**
   * 重新排序好友分类
   */
  async reorderCategories(categoryIds: string[]): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    await this.reorderCategoriesViaAccountData(categoryIds)
  }

  /**
   * 通过账户数据重新排序分类
   */
  private async reorderCategoriesViaAccountData(categoryIds: string[]): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      type AccountDataGetter = (type: string) => { getContent?: () => FriendCategoriesContent } | undefined
      const getAccountDataMethod = client.getAccountData as AccountDataGetter | undefined
      const categoriesEvent = getAccountDataMethod?.('m.friend_categories')
      type ContentGetter = () => FriendCategoriesContent
      const getContentMethod = categoriesEvent?.getContent as ContentGetter | undefined
      const content = getContentMethod?.()

      if (!content) {
        throw new Error('Categories not found')
      }

      // 按新顺序重新排序分类
      const categoryMap = new Map(content.categories.map((c) => [c.id, c]))
      content.categories = []

      for (const categoryId of categoryIds) {
        const category = categoryMap.get(categoryId)
        if (category) {
          category.order = content.categories.length
          content.categories.push(category)
        }
      }

      // 保存更新后的分类
      type AccountDataSetter = (type: string, content: FriendCategoriesContent) => Promise<void>
      const setAccountDataMethod = client.setAccountData as AccountDataSetter | undefined
      await setAccountDataMethod?.('m.friend_categories', content)

      logger.info('[Categories] Categories reordered', { count: categoryIds.length })
    } catch (error) {
      logger.error('[Categories] Failed to reorder categories:', error)
      throw error
    }
  }

  /**
   * 设置好友分类
   */
  async setFriendCategory(roomId: string, categoryId: string | null): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    await this.setFriendCategoryViaAccountData(roomId, categoryId)
  }

  /**
   * 通过账户数据设置好友分类
   */
  private async setFriendCategoryViaAccountData(roomId: string, categoryId: string | null): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      type RoomGetter = (roomId: string) =>
        | {
            setAccountData?: (type: string, content: Record<string, unknown>) => Promise<void>
          }
        | undefined
      const getRoomMethod = client.getRoom as RoomGetter | undefined
      const room = getRoomMethod?.(roomId)

      if (!room) {
        throw new Error('Room not found')
      }

      // 使用房间账户数据存储分类
      type SetRoomAccountDataMethod = (type: string, content: Record<string, unknown>) => Promise<void>
      const setRoomAccountDataMethod = room.setAccountData as SetRoomAccountDataMethod | undefined

      if (categoryId) {
        await setRoomAccountDataMethod?.('m.friend_category', {
          id: categoryId,
          order: 0
        })
      } else {
        // 移除分类标签
        await setRoomAccountDataMethod?.('m.friend_category', {})
      }

      logger.info('[Categories] Friend category set', { roomId, categoryId })
    } catch (error) {
      logger.error('[Categories] Failed to set friend category:', error)
      throw error
    }
  }

  /**
   * 获取好友的分类
   */
  async getFriendCategory(roomId: string): Promise<string | undefined> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    return this.getFriendCategoryViaAccountData(roomId)
  }

  /**
   * 通过账户数据获取好友分类
   */
  private async getFriendCategoryViaAccountData(roomId: string): Promise<string | undefined> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      type RoomGetter = (roomId: string) =>
        | {
            getAccountData?: (type: string) => {
              getContent?: () => { id?: string } | undefined
            }
          }
        | undefined
      const getRoomMethod = client.getRoom as RoomGetter | undefined
      const room = getRoomMethod?.(roomId)

      if (!room) {
        return undefined
      }

      const getRoomAccountDataMethod = room.getAccountData as
        | ((type: string) => {
            getContent?: () => { id?: string } | undefined
          })
        | undefined
      const categoryEvent = getRoomAccountDataMethod?.('m.friend_category')
      type ContentGetter = () => { id?: string } | undefined
      const getContentMethod = categoryEvent?.getContent as ContentGetter | undefined
      const content = getContentMethod?.()

      return content?.id
    } catch (error) {
      logger.warn('[Categories] Failed to get friend category:', error)
      return undefined
    }
  }

  /**
   * 获取指定分类下的好友
   */
  async getFriendsByCategory(categoryId: string | null, listFriendsFunc: () => Promise<Friend[]>): Promise<Friend[]> {
    const allFriends = await listFriendsFunc()

    if (!categoryId) {
      // 返回未分类的好友
      return allFriends.filter((f) => !f.categoryId)
    }

    return allFriends.filter((f) => f.categoryId === categoryId)
  }

  /**
   * 获取按分类分组的好友
   */
  async getFriendsGroupedByCategory(listFriendsFunc: () => Promise<Friend[]>): Promise<Map<string | null, Friend[]>> {
    const allFriends = await listFriendsFunc()
    const grouped = new Map<string | null, Friend[]>()

    // 初始化未分类组
    grouped.set(null, [])

    for (const friend of allFriends) {
      const categoryId = friend.categoryId || null
      if (!grouped.has(categoryId)) {
        grouped.set(categoryId, [])
      }
      grouped.get(categoryId)!.push(friend)
    }

    return grouped
  }
}
