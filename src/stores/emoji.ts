import { defineStore } from 'pinia'
import { ref } from 'vue'
import { StoresEnum } from '@/enums'
import type { EmojiItem } from '@/services/types'
import { useUserStore } from '@/stores/user'
import { requestWithFallback } from '@/utils/MatrixApiBridgeAdapter'
import { msg } from '@/utils/SafeUI'

export const useEmojiStore = defineStore(StoresEnum.EMOJI, () => {
  const isLoading = ref(false) // 是否正在加载
  const userStore = useUserStore()
  const emojiList = ref<EmojiItem[]>([])

  /**
   * 获取我的全部表情
   */
  const getEmojiList = async () => {
    isLoading.value = true
    const res = (await requestWithFallback({
      url: 'get_emoji'
    }).catch(() => {
      isLoading.value = false
      return undefined
    })) as { expressionUrl: string; id: string }[] | undefined
    if (!res) return
    emojiList.value = res
  }

  /**
   * 添加表情
   */
  const addEmoji = async (emojiUrl: string) => {
    const { uid } = userStore.userInfo!
    if (!uid || !emojiUrl) return
    const res = await requestWithFallback({
      url: 'add_emoji',
      body: { expressionUrl: emojiUrl }
    })
    if (res) {
      msg.success('添加表情成功')
    }
    await getEmojiList()
  }

  /**
   * 删除表情
   */
  const deleteEmoji = async (id: string) => {
    if (!id) return
    await requestWithFallback({
      url: 'delete_emoji',
      body: { id }
    })
    await getEmojiList()
  }

  return {
    emojiList,
    addEmoji,
    getEmojiList,
    deleteEmoji
  }
})
