import { defineStore } from 'pinia'
import { ref } from 'vue'
import { StoresEnum } from '@/enums'
import type { EmojiItem } from '@/services/types'
import { logger } from '@/utils/logger'
import { msg } from '@/utils/SafeUI'

/**
 * Emoji Store - 表情包管理
 *
 * WebSocket API 已移除:
 * - get_emoji: 获取表情列表
 * - add_emoji: 添加表情
 * - delete_emoji: 删除表情
 *
 * Matrix 标准不包含自定义表情包系统
 * 建议使用 Matrix m.room.emoji 事件或 Account Data 重新实现
 */
export const useEmojiStore = defineStore(StoresEnum.EMOJI, () => {
  const _isLoading = ref(false)
  const emojiList = ref<EmojiItem[]>([])

  /**
   * 获取我的全部表情
   * get_emoji WebSocket API 已移除
   */
  const getEmojiList = async () => {
    logger.warn('[EmojiStore] getEmojiList called, but get_emoji API removed')
    // TODO: 使用 Matrix Account Data API 或 m.room.emoji 事件重新实现
    emojiList.value = []
  }

  /**
   * 添加表情
   * add_emoji WebSocket API 已移除
   */
  const addEmoji = async (_emojiUrl: string) => {
    logger.warn('[EmojiStore] addEmoji called, but add_emoji API removed')
    // TODO: 使用 Matrix Account Data API 或 m.room.emoji 事件重新实现
    msg.warning('表情功能暂不可用')
  }

  /**
   * 删除表情
   * delete_emoji WebSocket API 已移除
   */
  const deleteEmoji = async (_id: string) => {
    logger.warn('[EmojiStore] deleteEmoji called, but delete_emoji API removed')
    // TODO: 使用 Matrix Account Data API 或 m.room.emoji 事件重新实现
    msg.warning('表情功能暂不可用')
  }

  return {
    emojiList,
    addEmoji,
    getEmojiList,
    deleteEmoji
  }
})
