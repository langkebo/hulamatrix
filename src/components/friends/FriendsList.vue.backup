<template>
  <n-flex vertical :size="16" class="friends-list">
    <!-- 搜索和操作栏 -->
    <n-flex align="center" justify="space-between" class="header">
      <n-input
        v-model:value="searchQuery"
        size="small"
        :placeholder="t('friends.list.search_placeholder')"
        clearable
        style="width: 200px"
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

    <!-- 分类标签 -->
    <n-scrollbar x-scrollable class="category-tabs">
      <n-space :size="8">
        <n-tag
          v-for="category in categories"
          :key="category.categoryId"
          :type="selectedCategoryId === category.categoryId ? 'primary' : 'default'"
          :color="selectedCategoryId === category.categoryId ? ((category.color || undefined) as never) : undefined"
          :bordered="false"
          size="small"
          closable
          @close="handleDeleteCategory(category.categoryId)"
          @click="handleSelectCategory(category.categoryId)">
          {{ category.name }} ({{ category.count || 0 }})
        </n-tag>
        <n-tag
          v-if="categories.length > 0"
          :type="selectedCategoryId === null ? 'primary' : 'default'"
          :bordered="false"
          size="small"
          @click="handleSelectCategory(null)">
          {{ t('friends.list.all_friends', { count: friends.length }) }}
        </n-tag>
      </n-space>
    </n-scrollbar>

    <!-- 待处理的好友请求 -->
    <n-collapse v-if="pendingRequests.length > 0" class="pending-requests">
      <n-collapse-item :title="t('friends.requests.pending_title')" name="pending">
        <n-flex vertical :size="12">
          <div
            v-for="request in pendingRequests"
            :key="request.requestId"
            class="pending-request-item">
            <n-flex align="center" :size="12" class="flex-1">
              <n-avatar v-bind="request.fromAvatarUrl !== undefined ? { src: request.fromAvatarUrl } : {}" :size="40" round>
                <svg class="size-20px"><use href="#user"></use></svg>
              </n-avatar>
              <n-flex vertical :size="4">
                <span class="text-14px font-600">{{ request.fromDisplayName }}</span>
                <span v-if="request.message" class="text-(12px #909090)">{{ request.message }}</span>
              </n-flex>
            </n-flex>
            <n-space>
              <n-button size="small" type="primary" @click="handleAcceptRequest(request)">{{ t('friends.requests.accept') }}</n-button>
              <n-button size="small" secondary @click="handleRejectRequest(request)">{{ t('friends.requests.reject') }}</n-button>
            </n-space>
          </div>
        </n-flex>
      </n-collapse-item>
    </n-collapse>

    <!-- 好友列表 -->
    <n-flex class="friends-container" vertical :size="8">
      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-container">
        <n-spin size="medium" />
      </div>

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
        <n-virtual-list
          v-if="filteredFriends.length > 100"
          :items="filteredFriends"
          :item-size="76">
          <template #default="{ item: friend }">
            <div
              :key="friend.userId"
              class="friend-item"
              :class="{ 'is-offline': friend.status === 'offline' }"
              @click="handleFriendClick(friend)">
              <n-flex align="center" :size="12">
                <div class="friend-avatar-wrapper">
                  <n-avatar v-bind="friend.avatarUrl !== undefined ? { src: friend.avatarUrl } : {}" :size="48" round>
                    <svg class="size-24px"><use href="#user"></use></svg>
                  </n-avatar>
                  <span class="status-indicator" :class="`status-${friend.status || 'offline'}`"></span>
                </div>
                <n-flex vertical :size="4" class="flex-1">
                  <n-flex align="center" :space="8">
                    <span class="text-14px font-600">{{ friend.displayName }}</span>
                    <n-tag v-if="friend.remark" size="tiny" type="info">{{ friend.remark }}</n-tag>
                  </n-flex>
                  <span class="text-(12px #909090)">{{ getPresenceText(friend.status) }}</span>
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
            :key="friend.userId"
            class="friend-item"
            :class="{ 'is-offline': friend.status === 'offline' }"
            @click="handleFriendClick(friend)">
            <n-flex align="center" :size="12">
              <div class="friend-avatar-wrapper">
                <n-avatar v-bind="friend.avatarUrl !== undefined ? { src: friend.avatarUrl } : {}" :size="48" round>
                  <svg class="size-24px"><use href="#user"></use></svg>
                </n-avatar>
                <span class="status-indicator" :class="`status-${friend.status || 'offline'}`"></span>
              </div>

              <n-flex vertical :size="4" class="flex-1">
                <n-flex align="center" :space="8">
                  <span class="text-14px font-600">{{ friend.displayName }}</span>
                  <n-tag v-if="friend.remark" size="tiny" type="info">{{ friend.remark }}</n-tag>
                </n-flex>
                <span class="text-(12px #909090)">{{ getPresenceText(friend.status) }}</span>
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
    <n-modal v-model:show="showAddFriendDialog" preset="card" :title="t('friends.list.add_friend')" :style="{ width: '400px' }">
      <n-form ref="addFriendFormRef" :model="addFriendForm" :rules="addFriendRules" label-placement="left" label-width="80">
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
          <n-button type="primary" @click="handleSendFriendRequest" :loading="isSendingRequest">{{ t('friends.requests.send_request') }}</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 创建分类对话框 -->
    <n-modal v-model:show="showCreateCategoryDialog" preset="card" :title="t('friends.category.create_title')" :style="{ width: '400px' }">
      <n-form ref="categoryFormRef" :model="categoryForm" :rules="categoryRules" label-placement="left" label-width="80">
        <n-form-item :label="t('friends.category.name')" path="name">
          <n-input v-model:value="categoryForm.name" :placeholder="t('friends.category.name_placeholder')" />
        </n-form-item>
        <n-form-item :label="t('friends.category.description')" path="description">
          <n-input v-model:value="categoryForm.description" :placeholder="t('friends.category.description_placeholder')" />
        </n-form-item>
        <n-form-item :label="t('friends.category.color')" path="color">
          <n-color-picker v-model:value="categoryForm.color" :modes="['hex']" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showCreateCategoryDialog = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" @click="handleCreateCategory" :loading="isCreatingCategory">{{ t('friends.category.create') }}</n-button>
        </n-space>
      </template>
    </n-modal>
  </n-flex>
</template>

<script setup lang="ts">
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
  useDialog,
  useMessage,
  type FormRules,
  type FormInst
} from 'naive-ui'
import { matrixFriendAdapter } from '@/adapters'
import type { Friend, FriendCategory, FriendRequest, FriendStatus } from '@/adapters/service-adapter'
import { logger } from '@/utils/logger'

const router = useRouter()
const { t } = useI18n()
const dialog = useDialog()
const message = useMessage()

// 状态
const searchQuery = ref('')
const isLoading = ref(false)
const selectedCategoryId = ref<string | null>(null)
const friends = ref<Friend[]>([])
const categories = ref<FriendCategory[]>([])
const pendingRequests = ref<FriendRequest[]>([])

// 对话框状态
const showAddFriendDialog = ref(false)
const showCreateCategoryDialog = ref(false)
const isSendingRequest = ref(false)
const isCreatingCategory = ref(false)

// 表单
const addFriendFormRef = ref<FormInst>()
const addFriendForm = ref({
  userId: '',
  message: '',
  categoryId: 'no-category' as string | null
})

const categoryFormRef = ref<FormInst>()
const categoryForm = ref({
  name: '',
  description: '',
  color: '#13987f'
})

// 表单验证规则 - 使用 i18n 翻译
const addFriendRules: FormRules = {
  userId: [{ required: true, message: t('friends.dialogs.user_id_required'), trigger: 'blur' }]
}

const categoryRules: FormRules = {
  name: [{ required: true, message: t('friends.validation.category_name_required'), trigger: 'blur' }]
}

// 计算属性
const filteredFriends = computed(() => {
  let result = friends.value

  // 按分类过滤
  if (selectedCategoryId.value !== null) {
    result = result.filter((f) => f.categoryId === selectedCategoryId.value)
  }

  // 按搜索关键词过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (f) =>
        f.displayName.toLowerCase().includes(query) ||
        f.remark?.toLowerCase().includes(query) ||
        f.userId.toLowerCase().includes(query)
    )
  }

  return result
})

const categoryOptions = computed(() => [
  { label: t('friends.category.no_category'), value: 'no-category' },
  ...categories.value.map((cat) => ({ label: cat.name, value: cat.categoryId }))
])

const categoryMenuOptions = computed(() => [
  {
    label: t('friends.category.create'),
    key: 'create'
  }
])

// 方法

const loadFriends = async () => {
  isLoading.value = true
  try {
    friends.value = await matrixFriendAdapter.listFriends({ includePresence: true })
  } catch (error) {
    message.error(t('friends.errors.load_failed'))
  } finally {
    isLoading.value = false
  }
}

const loadCategories = async () => {
  try {
    categories.value = await matrixFriendAdapter.listCategories()
  } catch (error) {
    message.error(t('friends.category.delete_failed'))
  }
}

const loadPendingRequests = async () => {
  try {
    pendingRequests.value = await matrixFriendAdapter.getPendingRequests()
  } catch (error) {
    logger.error('加载待处理请求失败:', error)
  }
}

const handleSearch = () => {
  // 搜索由计算属性自动处理
}

const handleSelectCategory = (categoryId: string | null) => {
  selectedCategoryId.value = categoryId
}

const handleDeleteCategory = (categoryId: string) => {
  dialog.warning({
    title: t('friends.category.delete_confirm_title'),
    content: t('friends.category.delete_confirm_content'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await matrixFriendAdapter.deleteCategory(categoryId)
        await loadCategories()
        message.success(t('friends.category.delete_success'))
      } catch (error) {
        message.error(t('friends.category.delete_failed'))
      }
    }
  })
}

const handleCategoryAction = async (key: string) => {
  if (key === 'create') {
    showCreateCategoryDialog.value = true
  }
}

const handleFriendClick = (friend: Friend) => {
  // 打开与该好友的私密聊天
  router.push({ path: '/private-chat', query: { userId: friend.userId } })
}

const handleFriendAction = async (key: string, friend: Friend) => {
  switch (key) {
    case 'chat':
      router.push({ path: '/private-chat', query: { userId: friend.userId } })
      break
    case 'setRemark': {
      const remark = ref(friend.remark || '')
      dialog.create({
        title: t('friends.remark.title'),
        content: () => {
          return h('div', { class: 'p-16px' }, [
            h(NInput, {
              value: remark.value,
              placeholder: t('friends.remark.placeholder'),
              onUpdateValue: (v: string) => {
                remark.value = v
              }
            })
          ])
        },
        positiveText: t('friends.remark.save'),
        negativeText: t('common.cancel'),
        onPositiveClick: async () => {
          try {
            await matrixFriendAdapter.updateFriendRemark(friend.userId, remark.value || '')
            await loadFriends()
            message.success(t('friends.remark.update_success'))
          } catch (error) {
            message.error(t('friends.remark.update_failed'))
          }
        }
      })
      break
    }
    case 'setCategory': {
      const categoryId = ref(friend.categoryId || 'no-category')
      dialog.create({
        title: t('friends.actions.set_category'),
        content: () => {
          return h('div', { class: 'p-16px' }, [
            h(NSelect, {
              value: categoryId.value,
              options: categoryOptions.value,
              onUpdateValue: (v: string) => {
                categoryId.value = v
              }
            })
          ])
        },
        positiveText: t('friends.remark.save'),
        negativeText: t('common.cancel'),
        onPositiveClick: async () => {
          try {
            const finalCategoryId = categoryId.value === 'no-category' ? null : categoryId.value
            await matrixFriendAdapter.setFriendCategory(friend.userId, finalCategoryId)
            await loadFriends()
            message.success(t('friends.category.set_success'))
          } catch (error) {
            message.error(t('friends.category.set_failed'))
          }
        }
      })
      break
    }
    case 'remove':
      dialog.warning({
        title: t('friends.remove.confirm_title'),
        content: t('friends.remove.confirm_content', { name: friend.displayName }),
        positiveText: t('common.confirm'),
        negativeText: t('common.cancel'),
        onPositiveClick: async () => {
          try {
            await matrixFriendAdapter.removeFriend(friend.userId)
            await loadFriends()
            message.success(t('friends.remove.success'))
          } catch (error) {
            message.error(t('friends.remove.failed'))
          }
        }
      })
      break
  }
}

const getFriendActions = (_friend: Friend) => {
  return [
    { label: t('friends.actions.chat'), key: 'chat' },
    { label: t('friends.actions.set_remark'), key: 'setRemark' },
    { label: t('friends.actions.set_category'), key: 'setCategory' },
    { type: 'divider', key: 'd1' },
    { label: t('friends.actions.remove'), key: 'remove' }
  ]
}

const handleAcceptRequest = async (request: FriendRequest) => {
  try {
    await matrixFriendAdapter.acceptFriendRequest(request.requestId)
    await loadPendingRequests()
    await loadFriends()
    message.success(t('friends.requests.accepted'))
  } catch (error) {
    message.error(t('friends.requests.error'))
  }
}

const handleRejectRequest = async (request: FriendRequest) => {
  try {
    await matrixFriendAdapter.rejectFriendRequest(request.requestId)
    await loadPendingRequests()
    message.success(t('friends.requests.rejected'))
  } catch (error) {
    message.error(t('friends.requests.error'))
  }
}

const handleSendFriendRequest = async () => {
  try {
    await addFriendFormRef.value?.validate()
    isSendingRequest.value = true

    await matrixFriendAdapter.sendFriendRequest(addFriendForm.value.userId, addFriendForm.value.message)

    message.success(t('friends.requests.sent'))
    showAddFriendDialog.value = false
    addFriendForm.value = { userId: '', message: '', categoryId: 'no-category' }
  } catch (error) {
    message.error(t('friends.requests.send_failed'))
  } finally {
    isSendingRequest.value = false
  }
}

const handleCreateCategory = async () => {
  try {
    await categoryFormRef.value?.validate()
    isCreatingCategory.value = true

    await matrixFriendAdapter.createCategory(
      categoryForm.value.name,
      categoryForm.value.description,
      categoryForm.value.color
    )

    message.success(t('friends.category.create_success'))
    showCreateCategoryDialog.value = false
    await loadCategories()
    categoryForm.value = { name: '', description: '', color: '#13987f' }
  } catch (error) {
    message.error(t('friends.category.create_failed'))
  } finally {
    isCreatingCategory.value = false
  }
}

const getPresenceText = (status?: FriendStatus): string => {
  switch (status) {
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
  await Promise.all([loadFriends(), loadCategories(), loadPendingRequests()])
})

// 导出刷新方法供父组件调用
defineExpose({
  refresh: loadFriends
})
</script>

<style scoped lang="scss">
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
  padding: 40px;
}

.friend-item {
  padding: 12px;
  background: var(--bg-setting-item);
  border: 1px solid var(--line-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;

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
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--bg-setting-item);

  &.status-online {
    background: #52c41a;
  }

  &.status-offline {
    background: #909090;
  }

  &.status-away {
    background: #ff9d00;
  }

  &.status-unavailable {
    background: #ff4d4f;
  }
}
</style>
