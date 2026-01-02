/**
 * 好友服务 v2.0
 * 基于 SDK v2.0.0 API (client.friendsV2)
 *
 * 统一 PC 端和移动端实现
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import type {
    IFriendsServiceV2,
    FriendItem,
    FriendCategoryItem,
    PendingRequestItem,
    FriendStats,
    SearchedUser
} from '@/types/matrix-sdk-v2'
import type {
    Friend,
    FriendCategory
} from 'matrix-js-sdk'

/**
 * 好友服务类 v2.0
 * 直接使用 SDK v2.0.0 API，利用其内置缓存和事件系统
 */
class FriendsServiceV2 implements IFriendsServiceV2 {
    private initialized = false
    private eventListeners = new Map<string, Set<Function>>()

    /**
     * 获取 FriendsClient 实例
     */
    private get friendsV2() {
        const client = matrixClientService.getClient()
        if (!client) {
            throw new Error('Matrix client not initialized')
        }

        const friendsV2 = (client as any).friendsV2
        if (!friendsV2) {
            throw new Error('Friends v2 API not available. Please update matrix-js-sdk to 39.1.3+')
        }

        return friendsV2
    }

    /**
     * 初始化服务
     * 设置事件监听器
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            logger.debug('[FriendsServiceV2] Already initialized')
            return
        }

        try {
            // 设置事件监听
            this.setupEventListeners()

            this.initialized = true
            logger.info('[FriendsServiceV2] Initialized successfully')
        } catch (error) {
            logger.error('[FriendsServiceV2] Initialization failed', { error })
            throw error
        }
    }

    /**
     * 设置事件监听器
     */
    private setupEventListeners(): void {
        // 监听好友添加事件
        this.friendsV2.on('friend.add', (data: { friendId: string }) => {
            logger.info('[FriendsServiceV2] Friend added event:', data.friendId)
            this.emit('friend.add', data)
        })

        // 监听好友移除事件
        this.friendsV2.on('friend.remove', (data: { friendId: string }) => {
            logger.info('[FriendsServiceV2] Friend removed event:', data.friendId)
            this.emit('friend.remove', data)
        })

        // 监听好友请求接收事件
        this.friendsV2.on('request.received', (request: any) => {
            logger.info('[FriendsServiceV2] Friend request received:', request.id)
            this.emit('request.received', request)
        })

        // 监听好友请求接受事件
        this.friendsV2.on('request.accepted', (data: { requestId: string; categoryId: number }) => {
            logger.info('[FriendsServiceV2] Friend request accepted:', data.requestId)
            this.emit('request.accepted', data)
        })

        logger.debug('[FriendsServiceV2] Event listeners set up')
    }

    /**
     * 获取好友列表（使用 SDK 缓存）
     * @param useCache 是否使用缓存，默认 true
     * @returns 好友列表
     */
    async listFriends(useCache = true): Promise<FriendItem[]> {
        try {
            const friends = await this.friendsV2.listFriends({}, useCache)
            return friends.map(this.mapToFriendItem)
        } catch (error) {
            logger.error('[FriendsServiceV2] Failed to list friends', { error })
            throw new Error(`Failed to list friends: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * 获取好友分类（使用 SDK 缓存）
     * @param useCache 是否使用缓存，默认 true
     * @returns 好友分类列表
     */
    async getCategories(useCache = true): Promise<FriendCategoryItem[]> {
        try {
            const categories = await this.friendsV2.getCategories(useCache)
            return categories.map(this.mapToCategoryItem)
        } catch (error) {
            logger.error('[FriendsServiceV2] Failed to get categories', { error })
            throw new Error(`Failed to get categories: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * 获取待处理好友请求
     * @returns 待处理请求列表
     */
    async getPendingRequests(): Promise<PendingRequestItem[]> {
        try {
            const requests = await this.friendsV2.getPendingRequests()
            return requests.map(this.mapToPendingItem)
        } catch (error) {
            logger.error('[FriendsServiceV2] Failed to get pending requests', { error })
            throw new Error(`Failed to get pending requests: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * 发送好友请求
     * @param targetId 目标用户 ID
     * @param message 请求消息
     * @param categoryId 分类 ID
     * @returns 请求 ID
     */
    async sendFriendRequest(
        targetId: string,
        message?: string,
        categoryId?: number
    ): Promise<string> {
        try {
            const options: any = {
                target_id: targetId
            }
            if (message !== undefined) options.message = message
            if (categoryId !== undefined) options.category_id = categoryId

            const requestId = await this.friendsV2.sendFriendRequest(options)
            logger.info('[FriendsServiceV2] Friend request sent', { requestId, targetId })
            return requestId
        } catch (error) {
            logger.error('[FriendsServiceV2] Failed to send friend request', { error, targetId })
            throw new Error(`Failed to send friend request: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * 接受好友请求
     * @param requestId 请求 ID
     * @param categoryId 分类 ID
     */
    async acceptFriendRequest(requestId: string, categoryId?: number): Promise<void> {
        try {
            await this.friendsV2.acceptFriendRequest(requestId, categoryId)
            logger.info('[FriendsServiceV2] Friend request accepted', { requestId })
        } catch (error) {
            logger.error('[FriendsServiceV2] Failed to accept friend request', { error, requestId })
            throw new Error(`Failed to accept friend request: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * 拒绝好友请求
     * @param requestId 请求 ID
     */
    async rejectFriendRequest(requestId: string): Promise<void> {
        try {
            await this.friendsV2.rejectFriendRequest(requestId)
            logger.info('[FriendsServiceV2] Friend request rejected', { requestId })
        } catch (error) {
            logger.error('[FriendsServiceV2] Failed to reject friend request', { error, requestId })
            throw new Error(`Failed to reject friend request: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * 删除好友
     * @param friendId 好友用户 ID
     */
    async removeFriend(friendId: string): Promise<void> {
        try {
            await this.friendsV2.removeFriend(friendId)
            logger.info('[FriendsServiceV2] Friend removed', { friendId })
        } catch (error) {
            logger.error('[FriendsServiceV2] Failed to remove friend', { error, friendId })
            throw new Error(`Failed to remove friend: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * 搜索用户
     * @param query 搜索关键词
     * @param limit 最大结果数
     * @returns 搜索结果
     */
    async searchUsers(query: string, limit = 20): Promise<SearchedUser[]> {
        try {
            return await this.friendsV2.searchUsers(query, limit)
        } catch (error) {
            logger.error('[FriendsServiceV2] Failed to search users', { error, query })
            throw new Error(`Failed to search users: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * 获取好友统计
     * @returns 统计数据
     */
    async getStats(): Promise<FriendStats> {
        try {
            return await this.friendsV2.getStats()
        } catch (error) {
            logger.error('[FriendsServiceV2] Failed to get stats', { error })
            throw new Error(`Failed to get stats: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * 清除缓存
     * 强制下次调用时从服务器重新获取数据
     */
    invalidateCache(): void {
        try {
            this.friendsV2.invalidateCache()
            logger.debug('[FriendsServiceV2] Cache invalidated')
        } catch (error) {
            logger.warn('[FriendsServiceV2] Failed to invalidate cache', { error })
        }
    }

    /**
     * 检查用户是否为好友
     * @param userId 用户 ID
     * @returns 是否为好友
     */
    async isFriend(userId: string): Promise<boolean> {
        try {
            return await this.friendsV2.isFriend(userId)
        } catch (error) {
            logger.warn('[FriendsServiceV2] Failed to check friend status', { error, userId })
            return false
        }
    }

    /**
     * 获取单个好友信息
     * @param userId 用户 ID
     * @returns 好友信息
     */
    async getFriend(userId: string): Promise<FriendItem | undefined> {
        try {
            const friend = await this.friendsV2.getFriend(userId)
            return friend ? this.mapToFriendItem(friend) : undefined
        } catch (error) {
            logger.warn('[FriendsServiceV2] Failed to get friend', { error, userId })
            return undefined
        }
    }

    /**
     * 添加事件监听器
     * @param event 事件名称
     * @param handler 处理函数
     */
    on(event: string, handler: Function): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set())
        }
        this.eventListeners.get(event)!.add(handler)
    }

    /**
     * 移除事件监听器
     * @param event 事件名称
     * @param handler 处理函数
     */
    off(event: string, handler: Function): void {
        const handlers = this.eventListeners.get(event)
        if (handlers) {
            handlers.delete(handler)
        }
    }

    /**
     * 触发事件
     * @param event 事件名称
     * @param data 事件数据
     */
    private emit(event: string, data: unknown): void {
        const handlers = this.eventListeners.get(event)
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data)
                } catch (error) {
                    logger.error('[FriendsServiceV2] Event handler error', { event, error })
                }
            })
        }
    }

    /**
     * 映射到 FriendItem
     */
    private mapToFriendItem(friend: Friend): FriendItem {
        const item: FriendItem = { ...friend }

        // 添加额外字段（如果需要）
        if (!item.presence) {
            item.presence = 'offline'
        }

        return item
    }

    /**
     * 映射到 FriendCategoryItem
     */
    private mapToCategoryItem(category: FriendCategory): FriendCategoryItem {
        return { ...category }
    }

    /**
     * 映射到 PendingRequestItem
     */
    private mapToPendingItem(request: any): PendingRequestItem {
        return { ...request }
    }
}

// 导出单例实例
export const friendsServiceV2 = new FriendsServiceV2()

// 导出类型
export type { IFriendsServiceV2 }
