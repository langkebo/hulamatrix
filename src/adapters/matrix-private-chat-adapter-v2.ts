/**
 * Matrix Private Chat Adapter v2.0
 *
 * 基于 SDK v2.0 API 的私聊适配器（可选迁移工具）
 *
 * 推荐方式：直接使用 usePrivateChatStoreV2
 * import { usePrivateChatStoreV2 } from '@/stores/privateChatV2'
 *
 * 此适配器仅用于平滑迁移，保持与旧适配器相同的接口
 */

import { privateChatServiceV2 } from '@/services/privateChatServiceV2'
import type { PrivateChatSessionItem, PrivateChatMessageItem } from '@/types/matrix-sdk-v2'
import { logger } from '@/utils/logger'

/**
 * Matrix Private Chat Adapter v2.0
 * 简化版，不导出类型以避免冲突
 */
export const matrixPrivateChatAdapterV2 = {
    /**
     * 获取私聊会话列表
     */
    async listSessions(): Promise<PrivateChatSessionItem[]> {
        try {
            return await privateChatServiceV2.listSessions(true)
        } catch (error) {
            logger.error('[PrivateChatAdapterV2] Failed to list sessions:', error)
            throw error
        }
    },

    /**
     * 创建私聊会话
     */
    async createSession(
        targetId: string,
        sessionName?: string,
        ttl?: number
    ): Promise<string> {
        try {
            const session = await privateChatServiceV2.createSession({
                participants: [targetId],
                session_name: sessionName,
                ttl_seconds: ttl
            })
            // 使用类型断言访问属性
            return (session as any).session_id || (session as any).sessionId || ''
        } catch (error) {
            logger.error('[PrivateChatAdapterV2] Failed to create session:', error)
            throw error
        }
    },

    /**
     * 删除私聊会话
     */
    async deleteSession(sessionId: string): Promise<void> {
        try {
            await privateChatServiceV2.deleteSession(sessionId)
        } catch (error) {
            logger.error('[PrivateChatAdapterV2] Failed to delete session:', error)
            throw error
        }
    },

    /**
     * 获取私聊消息列表
     */
    async getMessages(
        sessionId: string,
        limit = 50,
        before?: string
    ): Promise<PrivateChatMessageItem[]> {
        try {
            return await privateChatServiceV2.getMessages({
                session_id: sessionId,
                limit,
                before
            })
        } catch (error) {
            logger.error('[PrivateChatAdapterV2] Failed to get messages:', error)
            throw error
        }
    },

    /**
     * 发送私聊消息
     */
    async sendMessage(
        sessionId: string,
        content: string,
        type: string = 'text',
        _ttl?: number
    ): Promise<string> {
        try {
            if (type === 'text') {
                return await privateChatServiceV2.sendText(sessionId, content)
            }
            // 其他类型使用 sendCustom
            return await privateChatServiceV2.sendMessage({
                session_id: sessionId,
                content,
                type: type as any
            })
        } catch (error) {
            logger.error('[PrivateChatAdapterV2] Failed to send message:', error)
            throw error
        }
    },

    /**
     * 订阅消息更新
     */
    subscribeToMessages(
        sessionId: string,
        callback: (message: PrivateChatMessageItem) => void
    ): () => void {
        try {
            return privateChatServiceV2.subscribeToMessages(sessionId, callback)
        } catch (error) {
            logger.error('[PrivateChatAdapterV2] Failed to subscribe to messages:', error)
            throw error
        }
    },

    /**
     * 取消订阅消息
     */
    unsubscribeFromMessages(sessionId: string): void {
        try {
            privateChatServiceV2.unsubscribeFromMessages(sessionId)
        } catch (error) {
            logger.error('[PrivateChatAdapterV2] Failed to unsubscribe from messages:', error)
        }
    },

    /**
     * 清除缓存
     */
    invalidateCache(): void {
        privateChatServiceV2.invalidateCache()
    },

    /**
     * 清理资源
     */
    dispose(): void {
        privateChatServiceV2.dispose()
    }
}

export default matrixPrivateChatAdapterV2
