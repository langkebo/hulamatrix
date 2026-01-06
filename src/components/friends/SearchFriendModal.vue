<template>
  <n-modal
    v-model:show="showModal"
    preset="card"
    :title="t('friends.add_friend_title')"
    :style="{ width: '500px', maxHeight: '80vh' }"
    :mask-closable="true">
    <!-- 搜索框 -->
    <n-flex vertical :size="16">
      <n-input
        v-model:value="searchValue"
        type="text"
        size="medium"
        :placeholder="t('friends.dialogs.user_id_placeholder')"
        clearable
        @keydown.enter="handleSearch">
        <template #prefix>
          <n-icon>
            <svg class="size-16px"><use href="#search"></use></svg>
          </n-icon>
        </template>
        <template #suffix>
          <n-button size="small" type="primary" :loading="searching" @click="handleSearch">搜索</n-button>
        </template>
      </n-input>

      <!-- 搜索结果 -->
      <n-scrollbar style="max-height: 400px">
        <!-- 加载状态 -->
        <div v-if="searching" class="flex-center py-40px">
          <n-spin size="medium" />
        </div>

        <!-- 搜索结果列表 -->
        <n-flex v-else-if="searchResults.length > 0" vertical :size="8">
          <div
            v-for="user in searchResults"
            :key="user.userId"
            class="search-result-item p-12px rounded-8px hover:bg-[--hover-color] cursor-pointer">
            <n-flex align="center" justify="space-between">
              <n-flex align="center" :size="12">
                <n-avatar :size="48" :src="user.avatar" round :fallback-src="'/logoD.png'" />
                <n-flex vertical :size="4">
                  <span class="text-14px font-medium">{{ user.displayName }}</span>
                  <span class="text-12px text-gray-500">{{ user.userId }}</span>
                </n-flex>
              </n-flex>
              <n-button
                size="small"
                :type="user.isFriend ? 'info' : 'primary'"
                :disabled="user.isSelf"
                @click="handleUserAction(user)">
                {{ user.isSelf ? '自己' : user.isFriend ? '发消息' : '添加' }}
              </n-button>
            </n-flex>
          </div>
        </n-flex>

        <!-- 无结果 -->
        <n-empty v-else-if="hasSearched && searchResults.length === 0" description="未找到用户" class="py-40px" />

        <!-- 初始状态 -->
        <n-empty v-else description="输入用户ID或昵称搜索" class="py-40px">
          <template #icon>
            <n-icon size="48">
              <svg><use href="#search"></use></svg>
            </n-icon>
          </template>
        </n-empty>
      </n-scrollbar>
    </n-flex>

    <!-- 添加好友确认对话框 -->
    <n-modal
      v-model:show="showAddConfirm"
      preset="dialog"
      :title="t('friends.add_friend_title')"
      :positive-text="t('common.confirm')"
      :negative-text="t('common.cancel')"
      :loading="sending"
      @positive-click="handleConfirmAdd"
      @negative-click="showAddConfirm = false">
      <n-flex vertical :size="16" class="py-4">
        <n-flex align="center" :size="12">
          <n-avatar :size="56" :src="selectedUser?.avatar" round :fallback-src="'/logoD.png'" />
          <n-flex vertical :size="4">
            <span class="text-16px font-medium">{{ selectedUser?.displayName }}</span>
            <span class="text-12px text-gray-500">{{ selectedUser?.userId }}</span>
          </n-flex>
        </n-flex>
        <n-form-item :label="t('friends.verify_message')">
          <n-input
            v-model:value="verifyMessage"
            type="textarea"
            :placeholder="t('friends.verify_message_placeholder')"
            :rows="3"
            :maxlength="200"
            show-count />
        </n-form-item>
      </n-flex>
    </n-modal>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { searchUsers as synapseSearchUsers, sendRequest } from '@/integrations/synapse/friends'
import { searchUsersOptimized } from '@/integrations/matrix/search'
import { useFriendsStore } from '@/stores/friends'
import { useMatrixAuthStore } from '@/stores/matrixAuth'
import { matrixClientService } from '@/integrations/matrix/client'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'
import { mxcUrlToHttp, getProfileInfo } from '@/utils/matrixClientUtils'
import { checkAppReady, withAppCheck } from '@/utils/appErrorHandler'
import { appInitMonitor, AppInitPhase } from '@/utils/performanceMonitor'

const { t } = useI18n()
const router = useRouter()
const friendsStore = useFriendsStore()
const matrixAuth = useMatrixAuthStore()

/**
 * Matrix 用户目录搜索结果
 */
interface MatrixUserResult {
  id: string
  title?: string
  avatar?: string
  [key: string]: unknown
}

/**
 * Synapse 用户搜索结果
 */
interface SynapseUserResult {
  user_id: string
  display_name?: string
  avatar_url?: string
  [key: string]: unknown
}

interface SearchUser {
  userId: string
  displayName: string
  avatar: string
  isFriend: boolean
  isSelf: boolean
}

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'success'): void
}>()

const showModal = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const searchValue = ref('')
const searchResults = ref<SearchUser[]>([])
const searching = ref(false)
const hasSearched = ref(false)

const showAddConfirm = ref(false)
const selectedUser = ref<SearchUser | null>(null)
const verifyMessage = ref('')
const sending = ref(false)

// 重置状态
watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      searchValue.value = ''
      searchResults.value = []
      hasSearched.value = false
      verifyMessage.value = t('friends.default_verify_message')
    }
  }
)

const isFriend = (userId: string): boolean => {
  return (friendsStore.friends || []).some((f) => f.user_id === userId)
}

const isSelf = (userId: string): boolean => {
  return matrixAuth.userId === userId
}

const handleSearch = async () => {
  if (!searchValue.value.trim()) return

  logger.debug('[SearchFriendModal] handleSearch called with:', searchValue.value)

  // 使用统一的应用状态检查
  if (!checkAppReady()) {
    hasSearched.value = true
    return
  }

  // 检查 Matrix 客户端是否可用
  const client = matrixClientService.getClient()
  if (!client) {
    logger.warn('[SearchFriendModal] Matrix client not available, showing user message')
    msg.warning('Matrix 客户端未初始化，请先登录')
    hasSearched.value = true
    return
  }

  searching.value = true
  hasSearched.value = true
  searchResults.value = []

  try {
    // 使用优化的搜索功能 (优先好友系统 API，降级到 Matrix 标准 API)
    // 添加性能监控
    appInitMonitor.markPhase(AppInitPhase.START_MATRIX_SYNC)

    logger.info('[SearchFriendModal] Using optimized search (friends API first)')
    const results = await searchUsersOptimized(searchValue.value, 20)
    logger.info('[SearchFriendModal] Search returned:', results.length, 'results')

    if (results && results.length > 0) {
      searchResults.value = results.map((user) => {
        let avatar = ''
        if (user.avatar) {
          try {
            if (user.avatar.startsWith('mxc://')) {
              avatar = mxcUrlToHttp(client, user.avatar, 64, 64, 'crop') || ''
            } else {
              avatar = user.avatar
            }
          } catch {}
        }
        return {
          userId: user.id,
          displayName: user.title || user.id.split(':')[0].substring(1),
          avatar,
          isFriend: isFriend(user.id),
          isSelf: isSelf(user.id)
        }
      })
      logger.info('[SearchFriendModal] Successfully mapped', searchResults.value.length, 'users')
    } else {
      logger.info('[SearchFriendModal] No users found with search term:', searchValue.value)
    }

    // 显示结果提示
    if (searchResults.value.length > 0) {
      msg.success(`找到 ${searchResults.value.length} 个用户`)
    } else {
      msg.info(`未找到用户 "${searchValue.value}"`)
    }
  } catch (error) {
    logger.error('[SearchFriendModal] Search failed:', error)
    // 使用统一错误处理
    msg.error('搜索失败，请重试')
  } finally {
    searching.value = false
  }
}

const handleUserAction = (user: SearchUser) => {
  if (user.isSelf) return

  if (user.isFriend) {
    // 已是好友，跳转到私聊
    router.push({ path: '/private-chat', query: { userId: user.userId } })
    showModal.value = false
  } else {
    // 不是好友，显示添加确认
    selectedUser.value = user
    showAddConfirm.value = true
  }
}

const handleConfirmAdd = async () => {
  if (!selectedUser.value) return

  // 保存用户ID的引用，避免在异步操作中丢失
  const targetUserId = selectedUser.value.userId

  // 使用 withAppCheck 包装整个操作
  const result = await withAppCheck(
    async () => {
      sending.value = true

      // 调试日志
      logger.debug('[SearchFriendModal] handleConfirmAdd called')
      logger.debug('[SearchFriendModal] selectedUser:', selectedUser.value)
      logger.debug('[SearchFriendModal] matrixAuth.userId:', matrixAuth.userId)
      logger.debug('[SearchFriendModal] verifyMessage:', verifyMessage.value)

      const requestPayload = {
        requester_id: matrixAuth.userId || '',
        target_id: targetUserId,
        message: verifyMessage.value || undefined
      }
      logger.debug('[SearchFriendModal] Sending request with payload:', requestPayload)

      await sendRequest(requestPayload)

      msg.success(t('friends.request_sent_success'))
      showAddConfirm.value = false
      emit('success')

      // 刷新好友列表
      await friendsStore.refreshAll()

      // 重新搜索以更新状态
      if (searchValue.value) {
        await handleSearch()
      }
    },
    {
      customMessage: t('friends.request_sent_failed')
    }
  )

  // Fallback: 如果主要方法失败，尝试通过创建 DM 房间
  if (result === undefined) {
    sending.value = true
    try {
      logger.debug('[SearchFriendModal] Trying DM room fallback...')
      const { getOrCreateDirectRoom, updateDirectMapping } = await import('@/integrations/matrix/contacts')
      const roomId = await getOrCreateDirectRoom(targetUserId)
      if (roomId) {
        await updateDirectMapping(targetUserId, roomId)
        msg.success(t('friends.request_sent_success'))
        showAddConfirm.value = false
        emit('success')
        await friendsStore.refreshAll()
      }
    } catch (fallbackError) {
      logger.error('[SearchFriendModal] Fallback also failed', { error: fallbackError })
      msg.error(t('friends.request_sent_failed'))
    } finally {
      sending.value = false
    }
  } else {
    sending.value = false
  }
}
</script>

<style scoped lang="scss">
.search-result-item {
  border: 1px solid var(--line-color);
  transition: all 0.2s;

  &:hover {
    border-color: var(--primary-color);
  }
}
</style>
