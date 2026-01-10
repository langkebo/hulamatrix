<template>
  <n-flex vertical :size="16" class="friends-list">
    <!-- 搜索和操作栏 -->
    <n-flex align="center" justify="space-between" class="header">
      <n-input
        v-model:value="searchQuery"
        size="small"
        :placeholder="t('friends.list.search_placeholder')"
        clearable
        class="search-input"
        @update:value="handleSearch">
        <template #prefix>
          <svg class="size-14px"><use href="#search"></use></svg>
        </template>
      </n-input>

      <n-space>
        <n-button size="small" type="primary" secondary @click="showAddFriendDialog = true">
          <template #icon>
            <svg class="size-14px"><use href="#user-plus"></use></svg>
          </template>
          {{ t('friends.list.add_friend') }}
        </n-button>
        <n-dropdown :options="categoryMenuOptions" @select="handleCategoryAction">
          <n-button size="small" secondary>
            <template #icon>
              <svg class="size-14px"><use href="#folder"></use></svg>
            </template>
            {{ t('friends.list.category_management') }}
          </n-button>
        </n-dropdown>
      </n-space>
    </n-flex>

    <!-- 统计信息 (v2 新增) -->
    <n-space :size="16" class="stats-bar">
      <n-statistic label="好友总数" :value="friendsStore.totalFriendsCount" />
      <n-statistic label="在线好友" :value="friendsStore.onlineFriendsCount" />
      <n-statistic label="待处理" :value="friendsStore.pendingCount" />
    </n-space>

    <!-- 分类标签 -->
    <n-scrollbar x-scrollable class="category-tabs">
      <n-space :size="8">
        <n-tag
          v-for="category in friendsStore.categories"
          :key="category.id"
          :type="selectedCategoryId === category.id ? 'primary' : 'default'"
          :color="selectedCategoryId === category.id ? (category.color as never) : undefined"
          :bordered="false"
          size="small"
          @click="handleSelectCategory(category.id)">
          {{ category.name }} ({{ getCategoryFriendCount(category.id) }})
        </n-tag>
        <n-tag
          :type="selectedCategoryId === null ? 'primary' : 'default'"
          :bordered="false"
          size="small"
          @click="handleSelectCategory(null)">
          {{ t('friends.list.all_friends', { count: friendsStore.friends.length }) }}
        </n-tag>
      </n-space>
    </n-scrollbar>

    <!-- 待处理的好友请求 -->
    <n-collapse v-if="friendsStore.pending.length > 0" class="pending-requests">
      <n-collapse-item :title="t('friends.requests.pending_title')" name="pending">
        <n-flex vertical :size="12">
          <div v-for="request in friendsStore.pending" :key="request.id" class="pending-request-item">
            <n-flex align="center" :size="12" class="flex-1">
              <n-avatar :size="40" round>
                <svg class="size-20px"><use href="#user"></use></svg>
              </n-avatar>
              <n-flex vertical :size="4">
                <span class="text-14px font-600">{{ request.requester_display_name || request.requester_id }}</span>
                <span v-if="request.message" class="text-(12px var(--hula-brand-primary))">{{ request.message }}</span>
              </n-flex>
            </n-flex>
            <n-space>
              <n-button size="small" type="primary" @click="handleAcceptRequest(request)">
                {{ t('friends.requests.accept') }}
              </n-button>
              <n-button size="small" secondary @click="handleRejectRequest(request)">
                {{ t('friends.requests.reject') }}
              </n-button>
            </n-space>
          </div>
        </n-flex>
      </n-collapse-item>
    </n-collapse>

    <!-- 好友列表 -->
    <n-flex class="friends-container" vertical :size="8">
      <!-- 加载状态 - 使用骨架屏 -->
      <FriendsSkeleton v-if="friendsStore.loading" />

      <!-- 空状态 -->
      <n-empty
        v-else-if="filteredFriends.length === 0"
        :description="searchQuery ? t('friends.list.no_results') : t('friends.list.no_friends')"
        size="small">
        <template #extra>
          <n-button v-if="!searchQuery" size="small" type="primary" secondary @click="showAddFriendDialog = true">
            {{ t('friends.list.add_friend') }}
          </n-button>
        </template>
      </n-empty>

      <!-- 好友列表 -->
      <template v-else>
        <n-virtual-list v-if="filteredFriends.length > 100" :items="filteredFriends" :item-size="76">
          <template #default="{ item: friend }">
            <div
              :key="friend.user_id"
              class="friend-item"
              :class="{ 'is-offline': friend.presence === 'offline' }"
              @click="handleFriendClick(friend)">
              <n-flex align="center" :size="12">
                <div class="friend-avatar-wrapper">
                  <n-avatar :size="48" round>
                    <svg class="size-24px"><use href="#user"></use></svg>
                  </n-avatar>
                  <span class="status-indicator" :class="`status-${friend.presence || 'offline'}`"></span>
                </div>
                <n-flex vertical :size="4" class="flex-1">
                  <n-flex align="center" :space="8">
                    <span class="text-14px font-600">{{ friend.display_name || friend.user_id }}</span>
                  </n-flex>
                  <span class="text-(12px var(--hula-brand-primary))">{{ getPresenceText(friend.presence) }}</span>
                </n-flex>

                <n-dropdown :options="getFriendActions(friend)" @select="(key) => handleFriendAction(key, friend)">
                  <n-button circle size="small" quaternary>
                    <svg class="size-14px"><use href="#more"></use></svg>
                  </n-button>
                </n-dropdown>
              </n-flex>
            </div>
          </template>
        </n-virtual-list>
        <template v-else>
          <div
            v-for="friend in filteredFriends"
            :key="friend.user_id"
            class="friend-item"
            :class="{ 'is-offline': friend.presence === 'offline' }"
            @click="handleFriendClick(friend)">
            <n-flex align="center" :size="12">
              <div class="friend-avatar-wrapper">
                <n-avatar :size="48" round>
                  <svg class="size-24px"><use href="#user"></use></svg>
                </n-avatar>
                <span class="status-indicator" :class="`status-${friend.presence || 'offline'}`"></span>
              </div>

              <n-flex vertical :size="4" class="flex-1">
                <n-flex align="center" :space="8">
                  <span class="text-14px font-600">{{ friend.display_name || friend.user_id }}</span>
                </n-flex>
                <span class="text-(12px var(--hula-brand-primary))">{{ getPresenceText(friend.presence) }}</span>
              </n-flex>

              <n-dropdown :options="getFriendActions(friend)" @select="(key) => handleFriendAction(key, friend)">
                <n-button circle size="small" quaternary>
                  <svg class="size-14px"><use href="#more"></use></svg>
                </n-button>
              </n-dropdown>
            </n-flex>
          </div>
        </template>
      </template>
    </n-flex>

    <!-- 添加好友对话框 -->
    <n-modal v-model:show="showAddFriendDialog" preset="card" :title="t('friends.list.add_friend')" class="w-400px">
      <n-form
        ref="addFriendFormRef"
        :model="addFriendForm"
        :rules="addFriendRules"
        label-placement="left"
        label-width="80">
        <n-form-item :label="t('friends.dialogs.user_id_label')" path="userId">
          <n-input v-model:value="addFriendForm.userId" :placeholder="t('friends.dialogs.user_id_placeholder')" />
        </n-form-item>
        <n-form-item :label="t('friends.requests.message')" path="message">
          <n-input
            v-model:value="addFriendForm.message"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            :placeholder="t('friends.requests.message_placeholder')" />
        </n-form-item>
        <n-form-item :label="t('friends.category.select')" path="categoryId">
          <n-select
            v-model:value="addFriendForm.categoryId"
            :options="categoryOptions"
            :placeholder="t('friends.category.select')" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showAddFriendDialog = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" @click="handleSendFriendRequest" :loading="isSendingRequest">
            {{ t('friends.requests.send_request') }}
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 创建分类对话框 -->
    <n-modal
      v-model:show="showCategoryDialog"
      preset="card"
      :style="{ width: '400px' }"
      :aria-label="'创建好友分组'"
      role="dialog"
      @after-leave="resetCategoryForm">
      <template #header>
        <div class="flex items-center gap-2">
          <svg class="size-20px"><use href="#folder-plus"></use></svg>
          <span>{{ t('friends.category.create_title') }}</span>
        </div>
      </template>

      <n-spin v-if="categoryLoading" :size="24" style="min-height: 100px" />

      <n-form v-else ref="categoryFormRef" :model="categoryForm" :rules="categoryRules" label-placement="top">
        <n-form-item path="name" :label="t('friends.category.name_label')">
          <n-input
            v-model:value="categoryForm.name"
            :placeholder="t('friends.category.name_placeholder')"
            maxlength="50"
            show-count
            :disabled="categorySubmitting"
            @keyup.enter="handleCreateCategory" />
        </n-form-item>

        <n-form-item :label="t('friends.category.color_label')">
          <n-color-picker
            v-model:value="categoryForm.color"
            :modes="['hex']"
            :actions="['confirm']"
            :disabled="categorySubmitting" />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="showCategoryDialog = false" :disabled="categorySubmitting">
            {{ t('common.cancel') }}
          </n-button>
          <n-button type="primary" @click="handleCreateCategory" :loading="categorySubmitting">
            {{ t('friends.category.create_button') }}
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </n-flex>
</template>

<script setup lang="ts">
// Category option type for select component
interface CategoryOption {
  label: string
  value: string | 'none' // Use 'none' instead of null for "no category"
}

import { ref, computed, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NFlex,
  NSpace,
  NInput,
  NButton,
  NTag,
  NAvatar,
  NScrollbar,
  NCollapse,
  NCollapseItem,
  NModal,
  NForm,
  NFormItem,
  NSelect,
  NColorPicker,
  NSpin,
  NEmpty,
  NDropdown,
  NVirtualList,
  NStatistic,
  NIcon,
  useDialog,
  useMessage,
  type FormRules,
  type FormInst
} from 'naive-ui'
import { useFriendsStoreV2 } from '@/stores/friendsSDK'
import type { FriendItem, CategoryItem, PendingItem } from '@/stores/friendsSDK'
import { logger } from '@/utils/logger'
import { checkAppReady, withAppCheck, handleAppError, AppErrorType } from '@/utils/appErrorHandler'
import { appInitMonitor, AppInitPhase } from '@/utils/performanceMonitor'
import FriendsSkeleton from '@/components/common/FriendsSkeleton.vue'

const router = useRouter()
const { t } = useI18n()
const dialog = useDialog()
const message = useMessage()

// 使用 v2 Store
const friendsStore = useFriendsStoreV2()

// 状态
const searchQuery = ref('')
const selectedCategoryId = ref<string | null>(null)

// 对话框状态
const showAddFriendDialog = ref(false)
const isSendingRequest = ref(false)
const showCategoryDialog = ref(false)
const categoryLoading = ref(false)
const categorySubmitting = ref(false)

// 表单
const addFriendFormRef = ref<FormInst>()
const addFriendForm = ref({
  userId: '',
  message: '',
  categoryId: null as string | null
})

// 分类表单
const categoryFormRef = ref<FormInst>()
const categoryForm = ref({
  name: '',
  color: '#18A058' // 默认绿色
})

// 表单验证规则
const addFriendRules: FormRules = {
  userId: [{ required: true, message: t('friends.dialogs.user_id_required'), trigger: 'blur' }]
}

// 分类表单验证规则
const categoryRules: FormRules = {
  name: [
    { required: true, message: t('friends.category.name_required'), trigger: 'blur' },
    { min: 1, max: 50, message: t('friends.category.name_length'), trigger: 'blur' }
  ]
}

// 计算属性
const filteredFriends = computed(() => {
  let result = friendsStore.friends

  // 按分类过滤
  if (selectedCategoryId.value !== null) {
    result = result.filter((f: FriendItem) => f.category_id === selectedCategoryId.value)
  }

  // 按搜索关键词过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (f: FriendItem) =>
        f.user_id && ((f.display_name || '').toLowerCase().includes(query) || f.user_id.toLowerCase().includes(query))
    )
  }

  return result
})

const categoryOptions = computed(() => [
  { label: '无分类', value: 'none' },
  ...friendsStore.categories.map((cat) => ({ label: cat.name, value: cat.id }))
])

const categoryMenuOptions = computed(() => [
  {
    label: t('friends.category.create'),
    key: 'create'
  }
])

// 方法
const getCategoryFriendCount = (categoryId: string) => {
  return friendsStore.friends.filter((f: FriendItem) => f.category_id === categoryId).length
}

const handleSearch = () => {
  // 搜索由计算属性自动处理
}

const handleSelectCategory = (categoryId: string | null) => {
  selectedCategoryId.value = categoryId
}

const handleCategoryAction = async (key: string) => {
  if (key === 'create') {
    showCategoryDialog.value = true
  }
}

const handleCreateCategory = async () => {
  try {
    await categoryFormRef.value?.validate()
    categorySubmitting.value = true

    await friendsStore.createCategory(categoryForm.value.name)
    message.success(t('friends.category.create_success'))
    showCategoryDialog.value = false
    resetCategoryForm()
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      // Form validation error
      return
    }
    message.error(t('friends.category.create_failed'))
    logger.error('Failed to create category:', error)
  } finally {
    categorySubmitting.value = false
  }
}

const resetCategoryForm = () => {
  categoryForm.value = {
    name: '',
    color: '#18A058'
  }
  categoryFormRef.value?.restoreValidation()
}

const handleFriendClick = (friend: FriendItem) => {
  // 打开与该好友的私密聊天
  router.push({ path: '/private-chat', query: { userId: friend.user_id } })
}

const handleFriendAction = async (key: string, friend: FriendItem) => {
  switch (key) {
    case 'chat':
      if (friend.user_id) {
        router.push({ path: '/private-chat', query: { userId: friend.user_id } })
      }
      break
    case 'block':
      if (!friend.user_id) {
        message.error('无效的好友ID')
        return
      }
      dialog.warning({
        title: t('friends.block.confirm_title'),
        content: t('friends.block.confirm_content', { name: friend.display_name || friend.user_id || '' }),
        positiveText: t('common.confirm'),
        negativeText: t('common.cancel'),
        onPositiveClick: async () => {
          try {
            await friendsStore.blockUser(friend.user_id!)
            message.success(t('friends.block.success'))
          } catch (error) {
            message.error(t('friends.block.failed'))
            logger.error('Failed to block user:', error)
          }
        }
      })
      break
    case 'unblock':
      if (!friend.user_id) {
        message.error('无效的好友ID')
        return
      }
      dialog.success({
        title: t('friends.unblock.confirm_title'),
        content: t('friends.unblock.confirm_content', { name: friend.display_name || friend.user_id || '' }),
        positiveText: t('common.confirm'),
        negativeText: t('common.cancel'),
        onPositiveClick: async () => {
          try {
            await friendsStore.unblockUser(friend.user_id!)
            message.success(t('friends.unblock.success'))
          } catch (error) {
            message.error(t('friends.unblock.failed'))
            logger.error('Failed to unblock user:', error)
          }
        }
      })
      break
    case 'remove':
      if (!friend.user_id) {
        message.error('无效的好友ID')
        return
      }
      dialog.warning({
        title: t('friends.remove.confirm_title'),
        content: t('friends.remove.confirm_content', { name: friend.display_name || friend.user_id || '' }),
        positiveText: t('common.confirm'),
        negativeText: t('common.cancel'),
        onPositiveClick: async () => {
          try {
            await friendsStore.removeFriend(friend.user_id!)
            message.success(t('friends.remove.success'))
          } catch (error) {
            message.error(t('friends.remove.failed'))
          }
        }
      })
      break
  }
}

const getFriendActions = (friend: FriendItem) => {
  const isBlocked = friendsStore.blockedUsers.some((u) => u.user_id === friend.user_id)

  return [
    { label: t('friends.actions.chat'), key: 'chat' },
    { type: 'divider', key: 'd1' },
    isBlocked
      ? { label: t('friends.actions.unblock'), key: 'unblock' }
      : { label: t('friends.actions.block'), key: 'block' },
    { label: t('friends.actions.remove'), key: 'remove' }
  ]
}

const handleAcceptRequest = async (request: PendingItem) => {
  try {
    await friendsStore.acceptRequest(request.id) // 使用 SDK 默认分类
    message.success(t('friends.requests.accepted'))
  } catch (error) {
    message.error(t('friends.requests.error'))
    logger.error('Failed to accept friend request:', error)
  }
}

const handleRejectRequest = async (request: PendingItem) => {
  try {
    await friendsStore.rejectRequest(request.id)
    message.success(t('friends.requests.rejected'))
  } catch (error) {
    message.error(t('friends.requests.error'))
    logger.error('Failed to reject friend request:', error)
  }
}

const handleSendFriendRequest = async () => {
  // 使用 withAppCheck 包装整个操作
  const result = await withAppCheck(
    async () => {
      await addFriendFormRef.value?.validate()
      isSendingRequest.value = true

      await friendsStore.sendRequest(
        addFriendForm.value.userId,
        addFriendForm.value.message,
        addFriendForm.value.categoryId || undefined
      )

      message.success(t('friends.requests.sent'))
      showAddFriendDialog.value = false
      addFriendForm.value = { userId: '', message: '', categoryId: null }
    },
    {
      customMessage: t('friends.requests.send_failed')
    }
  )

  // 重置发送状态
  isSendingRequest.value = false
}

const getPresenceText = (presence?: string): string => {
  switch (presence) {
    case 'online':
      return t('friends.status.online')
    case 'offline':
      return t('friends.status.offline')
    case 'unavailable':
      return t('friends.status.unavailable')
    case 'away':
      return t('friends.status.away')
    default:
      return t('friends.status.unknown')
  }
}

// 生命周期
onMounted(async () => {
  // 使用统一的应用状态检查
  if (!checkAppReady()) {
    return
  }

  // 使用 withAppCheck 包装初始化
  await withAppCheck(
    async () => {
      // 添加性能监控
      appInitMonitor.markPhase(AppInitPhase.LOAD_STORES)

      await friendsStore.initialize()
      logger.info('[FriendsListV2] Initialized successfully')
    },
    {
      customMessage: '加载好友列表失败'
    }
  )
})

// 导出刷新方法供父组件调用
defineExpose({
  refresh: () => friendsStore.refreshAll()
})
</script>

<style scoped lang="scss">
.search-input {
  width: 200px;
}

.friends-list {
  width: 100%;
  height: 100%;
}

.header {
  padding: 12px;
  background: var(--bg-setting-item);
  border-radius: 12px;
  border: 1px solid var(--line-color);
}

.stats-bar {
  padding: 12px;
  background: var(--bg-setting-item);
  border-radius: 12px;
  border: 1px solid var(--line-color);
}

.category-tabs {
  white-space: nowrap;
  padding: 4px 0;
}

.pending-requests {
  padding: 12px;
  background: var(--bg-setting-item);
  border: 1px solid var(--line-color);
  border-radius: 12px;
}

.pending-request-item {
  padding: 8px;
  border-bottom: 1px solid var(--line-color);

  &:last-child {
    border-bottom: none;
  }
}

.friends-container {
  flex: 1;
  overflow-y: auto;
  max-height: calc(100vh - 300px);

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb-color);
    border-radius: 3px;
  }
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--hula-spacing-xl);
}

.friend-item {
  padding: var(--hula-spacing-sm);
  background: var(--bg-setting-item);
  border: 1px solid var(--line-color);
  border-radius: var(--hula-radius-md);
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;

  &:hover {
    background: var(--hover-color);
    border-color: var(--border-active-color);
  }

  &.is-offline {
    opacity: 0.7;
  }
}

.friend-avatar-wrapper {
  position: relative;
}

.status-indicator {
  position: absolute;
  bottom: 0;
  right: 0;
  width: var(--hula-spacing-sm);
  height: var(--hula-spacing-sm);
  border-radius: 50%;
  border: 2px solid var(--bg-setting-item);

  &.status-online {
    background: var(--hula-success);
  }

  &.status-offline {
    background: var(--hula-gray-500);
  }

  &.status-away {
    background: var(--hula-warning);
  }

  &.status-unavailable {
    background: var(--hula-error);
  }
}
</style>
