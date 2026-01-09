import { logger, toError } from '@/utils/logger'

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  addMessageReaction,
  removeMessageReaction,
  toggleMessageReaction,
  hasUserReaction,
  getMessageReactions,
  getPopularReactions,
  getReactionCategories,
  type ReactionSummary,
  type ReactionCategory
} from '@/integrations/matrix/notifications'
import { useChatStore } from './chat'
import { flags } from '@/utils/envFlags'
import type { MessageType } from '@/services/types'

export interface ReactionCache {
  [eventId: string]: {
    summary: ReactionSummary
    timestamp: number
    loading: boolean
  }
}

export interface ReactionAnalytics {
  totalReactions: number
  uniqueUsers: number
  popularReactions: Array<{ emoji: string; count: number }>
  reactionDistribution: { [key: string]: number }
  averageReactionsPerMessage: number
}

export const useReactionsStore = defineStore('reactions', () => {
  // 状态
  const cache = ref<ReactionCache>({})
  const analytics = ref<ReactionAnalytics | null>(null)
  const popularReactions = ref<string[]>([])
  const reactionCategories = ref<ReactionCategory[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const chatStore = useChatStore()

  const cachedReactions = computed(() => {
    const result: { [eventId: string]: ReactionSummary } = {}
    Object.entries(cache.value).forEach(([eventId, data]) => {
      if (Date.now() - data.timestamp < 5 * 60 * 1000) {
        // 5分钟缓存
        result[eventId] = data.summary
      }
    })
    return result
  })

  const analyticsData = computed(() => analytics.value)

  // 方法
  const fetchReactions = async (roomId: string, eventId: string, forceRefresh = false) => {
    if (!flags.matrixReactionsEnabled) return null

    // 检查缓存
    const cached = cache.value[eventId]
    if (cached && !forceRefresh && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.summary
    }

    // 设置加载状态
    const existingCache = cache.value[eventId]
    const defaultSummary: ReactionSummary = {
      eventId,
      reactions: {},
      totalCount: 0,
      hasCurrentUserReaction: false
    }

    cache.value[eventId] = {
      summary: existingCache?.summary || defaultSummary,
      timestamp: existingCache?.timestamp || Date.now(),
      loading: true
    }

    try {
      const summary = await getMessageReactions(roomId, eventId)

      // 更新缓存
      cache.value[eventId] = {
        summary,
        timestamp: Date.now(),
        loading: false
      }

      // 更新消息对象中的反应信息
      updateMessageReactions(eventId, summary)

      return summary
    } catch (err) {
      logger.error('Failed to fetch reactions:', toError(err))
      error.value = err instanceof Error ? err.message : 'Unknown error'

      // 清除加载状态
      if (cache.value[eventId]) {
        cache.value[eventId].loading = false
      }

      return null
    }
  }

  const addReaction = async (roomId: string, eventId: string, reaction: string) => {
    if (!flags.matrixReactionsEnabled) return false

    try {
      const success = await addMessageReaction(roomId, eventId, reaction)

      if (success) {
        // 更新缓存
        await refreshReactions(roomId, eventId)
        updateAnalytics()
      }

      return success
    } catch (err) {
      logger.error('Failed to add reaction:', toError(err))
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    }
  }

  const removeReaction = async (roomId: string, eventId: string, reaction: string) => {
    if (!flags.matrixReactionsEnabled) return false

    try {
      const success = await removeMessageReaction(roomId, eventId, reaction)

      if (success) {
        // 更新缓存
        await refreshReactions(roomId, eventId)
        updateAnalytics()
      }

      return success
    } catch (err) {
      logger.error('Failed to remove reaction:', toError(err))
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    }
  }

  const toggleReaction = async (roomId: string, eventId: string, reaction: string) => {
    if (!flags.matrixReactionsEnabled) return false

    try {
      const added = await toggleMessageReaction(roomId, eventId, reaction)

      // 更新缓存
      await refreshReactions(roomId, eventId)
      updateAnalytics()

      return added
    } catch (err) {
      logger.error('Failed to toggle reaction:', toError(err))
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return false
    }
  }

  const hasUserReacted = async (roomId: string, eventId: string, reaction: string) => {
    if (!flags.matrixReactionsEnabled) return false

    try {
      return await hasUserReaction(roomId, eventId, reaction)
    } catch (err) {
      logger.error('Failed to check user reaction:', toError(err))
      return false
    }
  }

  const refreshReactions = async (roomId: string, eventId: string) => {
    // 强制刷新缓存
    return await fetchReactions(roomId, eventId, true)
  }

  const clearCache = (eventId?: string) => {
    if (eventId) {
      delete cache.value[eventId]
    } else {
      cache.value = {}
    }
  }

  const updateMessageReactions = (eventId: string, summary: ReactionSummary) => {
    // 更新chat store中对应消息的反应信息
    const message = chatStore.getMessage(eventId)
    if (message) {
      message.message.messageMarks = summary.reactions
      chatStore.updateMsg({
        msgId: eventId,
        status: message.message.status,
        message: { body: message.message.body } as Partial<MessageType>
      })
    }
  }

  const initializePopularReactions = () => {
    if (!flags.matrixReactionsEnabled) return

    popularReactions.value = getPopularReactions()
    reactionCategories.value = getReactionCategories()
  }

  const updateAnalytics = () => {
    if (!flags.matrixReactionsEnabled) return

    const allReactions: { [key: string]: string[] } = {}
    let totalReactions = 0
    const users = new Set<string>()

    Object.values(cachedReactions.value).forEach((summary) => {
      Object.entries(summary.reactions).forEach(([emoji, reaction]) => {
        if (!allReactions[emoji]) {
          allReactions[emoji] = []
        }
        allReactions[emoji].push(...(reaction.users || []))
        totalReactions += reaction.count

        if (reaction.users) {
          reaction.users.forEach((userId) => users.add(userId))
        }
      })
    })

    const popularReactionsList = Object.entries(allReactions)
      .map(([emoji, userList]) => ({ emoji, count: userList.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const reactionDistribution: { [key: string]: number } = {}
    Object.entries(allReactions).forEach(([emoji, users]) => {
      reactionDistribution[emoji] = users.length
    })

    analytics.value = {
      totalReactions,
      uniqueUsers: users.size,
      popularReactions: popularReactionsList,
      reactionDistribution,
      averageReactionsPerMessage:
        Object.keys(cachedReactions.value).length > 0 ? totalReactions / Object.keys(cachedReactions.value).length : 0
    }
  }

  const getReactionsForEvent = (eventId: string) => {
    return cachedReactions.value[eventId] || null
  }

  const getPopularReactionsList = () => {
    return popularReactions.value
  }

  const getReactionCategoriesList = () => {
    return reactionCategories.value
  }

  const isReactionLoading = (eventId: string) => {
    return cache.value[eventId]?.loading || false
  }

  const getReactionCount = (eventId: string, reaction?: string) => {
    const summary = cachedReactions.value[eventId]
    if (!summary) return 0

    if (reaction) {
      return summary.reactions[reaction]?.count || 0
    }

    return summary.totalCount
  }

  const getUserReactions = (eventId: string) => {
    const summary = cachedReactions.value[eventId]
    if (!summary) return []

    return Object.entries(summary.reactions)
      .filter(([, reaction]) => reaction.userMarked)
      .map(([emoji]) => emoji)
  }

  const exportReactionsData = (eventId: string) => {
    const summary = cachedReactions.value[eventId]
    if (!summary) return null

    return {
      eventId,
      reactions: summary.reactions,
      totalCount: summary.totalCount,
      hasCurrentUserReaction: summary.hasCurrentUserReaction,
      exportTime: new Date().toISOString()
    }
  }

  const importReactionsData = (data: { eventId?: string; reactions?: unknown }) => {
    if (!data.eventId || !data.reactions) return false

    // 这里可以实现导入反应数据的逻辑
    // 例如：恢复之前的反应状态
    logger.debug('Import reactions data:', data)
    return true
  }

  // 清理过期缓存
  const cleanupExpiredCache = () => {
    const now = Date.now()
    const expiryTime = 10 * 60 * 1000 // 10分钟

    Object.keys(cache.value).forEach((eventId) => {
      const ts = cache.value[eventId]?.timestamp ?? 0
      if (ts > 0 && now - ts > expiryTime) {
        delete cache.value[eventId]
      }
    })
  }

  // 初始化
  const initialize = () => {
    initializePopularReactions()

    // 定期清理缓存
    setInterval(cleanupExpiredCache, 5 * 60 * 1000) // 每5分钟清理一次
  }

  // 重置状态
  const reset = () => {
    cache.value = {}
    analytics.value = null
    loading.value = false
    error.value = null
  }

  return {
    // 状态
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    cachedReactions,
    analyticsData,

    // 方法
    fetchReactions,
    addReaction,
    removeReaction,
    toggleReaction,
    hasUserReacted,
    refreshReactions,
    clearCache,
    getReactionsForEvent,
    getPopularReactionsList,
    getReactionCategoriesList,
    isReactionLoading,
    getReactionCount,
    getUserReactions,
    exportReactionsData,
    importReactionsData,
    initialize,
    reset,
    updateAnalytics
  }
})
