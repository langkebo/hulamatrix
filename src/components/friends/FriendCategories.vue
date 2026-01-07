<template>
  <div class="friend-categories">
    <!-- 头部 -->
    <div class="categories-header">
      <h3 class="categories-title">
        <svg class="size-18px">
          <use href="#folder"></use>
        </svg>
        {{ t('friends.categories.title') }}
        <n-badge v-if="categories.length > 0" :value="categories.length" />
      </h3>
      <n-dropdown
        :options="menuOptions"
        placement="bottom-end"
        @select="handleMenuSelect">
        <n-button circle size="small" quaternary>
          <template #icon>
            <svg class="size-14px">
              <use href="#more"></use>
            </svg>
          </template>
        </n-button>
      </n-dropdown>
    </div>

    <!-- 分类列表 -->
    <div class="categories-content">
      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-state">
        <n-spin size="medium" />
      </div>

      <!-- 空状态 -->
      <n-empty
        v-else-if="categories.length === 0"
        :description="t('friends.categories.no_categories')"
        size="small">
        <template #extra>
          <n-button size="small" type="primary" secondary @click="showCreateDialog = true">
            {{ t('friends.categories.create_first') }}
          </n-button>
        </template>
      </n-empty>

      <!-- 分类列表 -->
      <n-scrollbar v-else class="categories-scrollbar">
        <div class="categories-list">
          <!-- 全部好友（默认） -->
          <div
            class="category-item all-friends"
            :class="{ 'is-active': selectedCategoryId === null }"
            @click="handleSelectCategory(null)">
            <div class="category-icon">
              <svg class="size-20px">
                <use href="#users"></use>
              </svg>
            </div>
            <div class="category-info">
              <span class="category-name">{{ t('friends.categories.all_friends') }}</span>
              <span class="category-count">{{ totalFriendsCount }}</span>
            </div>
          </div>

          <!-- 自定义分类 -->
          <div
            v-for="category in categories"
            :key="category.id"
            class="category-item"
            :class="{ 'is-active': selectedCategoryId === category.id, 'is-editing': editingCategoryId === category.id }"
            @click="handleSelectCategory(category.id)">
            <div
              v-if="editingCategoryId === category.id"
              class="category-edit">
              <n-input
                ref="editInputRef"
                v-model:value="editingCategoryName"
                size="tiny"
                @blur="handleSaveEdit(category)"
                @keydown="handleEditKeydown($event, category)" />
            </div>
            <template v-else>
              <div class="category-icon" :style="{ backgroundColor: category.color || '#1890ff' }">
                <svg class="size-16px text-white">
                  <use href="#folder"></use>
                </svg>
              </div>
              <div class="category-info">
                <span class="category-name">{{ category.name }}</span>
                <span class="category-count">{{ getCategoryFriendCount(category.id) }}</span>
              </div>
            </template>
          </div>
        </div>
      </n-scrollbar>
    </div>

    <!-- 创建分类对话框 -->
    <n-modal
      v-model:show="showCreateDialog"
      preset="card"
      :title="t('friends.categories.create_title')"
      :style="{ width: '400px' }">
      <n-form ref="createFormRef" :model="createForm" label-placement="left" label-width="80">
        <n-form-item :label="t('friends.categories.name_label')" required>
          <n-input
            v-model:value="createForm.name"
            :placeholder="t('friends.categories.name_placeholder')"
            @keydown.enter="handleCreate" />
        </n-form-item>
        <n-form-item :label="t('friends.categories.color_label')">
          <n-color-picker v-model:value="createForm.color" :modes="['hex']" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showCreateDialog = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" @click="handleCreate" :loading="isCreating">
            {{ t('common.confirm') }}
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 删除确认对话框 -->
    <n-modal
      v-model:show="showDeleteConfirm"
      preset="dialog"
      :title="t('friends.categories.delete_title')"
      :content="t('friends.categories.delete_content')"
      :positive-text="t('common.confirm')"
      :negative-text="t('common.cancel')"
      @positive-click="handleConfirmDelete" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFriendsSDKStore, type CategoryWithColor } from '@/stores/friendsSDK'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'
import type { FormInst, FormRules } from 'naive-ui'

const { t } = useI18n()
const friendsStore = useFriendsSDKStore()

// 状态
const isLoading = ref(false)
const showCreateDialog = ref(false)
const showDeleteConfirm = ref(false)
const isCreating = ref(false)
const selectedCategoryId = ref<string | null>(null)
const editingCategoryId = ref<string | null>(null)
const editingCategoryName = ref('')
const editingInputRef = ref<HTMLElement | null>(null)
const createFormRef = ref<FormInst | null>(null)
const categoryToDelete = ref<string | null>(null)

// 创建分类表单
const createForm = ref({
  name: '',
  color: '#1890ff'
})

// 表单验证规则
const createFormRules: FormRules = {
  name: {
    required: true,
    message: t('friends.categories.name_required'),
    trigger: ['blur', 'input']
  }
}

// 分类列表
const categories = computed(() => friendsStore.categories)
const totalFriendsCount = computed(() => friendsStore.totalFriendsCount)
const friendsByCategory = computed(() => friendsStore.friendsByCategory)

// 菜单选项
const menuOptions = computed(() => [
  {
    label: t('friends.categories.create'),
    key: 'create',
    icon: () => '📁'
  },
  {
    label: t('friends.categories.refresh'),
    key: 'refresh',
    icon: () => '🔄'
  }
])

// 获取分类好友数量
const getCategoryFriendCount = (categoryId: string): number => {
  return friendsByCategory.value.get(categoryId)?.length || 0
}

// 选择分类
const handleSelectCategory = (categoryId: string | null) => {
  selectedCategoryId.value = categoryId
  // 发射事件给父组件
  emit('category-selected', categoryId)
}

// 菜单选择
const handleMenuSelect = (key: string) => {
  switch (key) {
    case 'create':
      showCreateDialog.value = true
      break
    case 'refresh':
      handleRefresh()
      break
  }
}

// 刷新分类列表
const handleRefresh = async () => {
  isLoading.value = true
  try {
    await friendsStore.fetchCategories()
    msg.success(t('friends.categories.refreshed'))
  } catch (error) {
    msg.error(t('friends.categories.refresh_failed'))
    logger.error('[FriendCategories] Failed to refresh categories:', error)
  } finally {
    isLoading.value = false
  }
}

// 创建分类
const handleCreate = async () => {
  if (!createForm.value.name.trim()) {
    msg.warning(t('friends.categories.name_required'))
    return
  }

  isCreating.value = true

  try {
    const categoryId = await friendsStore.createCategory(createForm.value.name)

    msg.success(t('friends.categories.created'))

    logger.info('[FriendCategories] Category created', {
      categoryId,
      name: createForm.value.name
    })

    // 重置表单并关闭对话框
    createForm.value = { name: '', color: '#1890ff' }
    showCreateDialog.value = false
  } catch (error) {
    msg.error(t('friends.categories.create_failed'))
    logger.error('[FriendCategories] Failed to create category:', error)
  } finally {
    isCreating.value = false
  }
}

// 开始编辑分类
const handleStartEdit = (category: CategoryWithColor, event: Event) => {
  event.stopPropagation()
  editingCategoryId.value = category.id
  editingCategoryName.value = category.name

  nextTick(() => {
    editingInputRef.value?.querySelector('input')?.focus()
  })
}

// 保存编辑
const handleSaveEdit = async (_category: CategoryWithColor) => {
  if (!editingCategoryName.value.trim()) {
    editingCategoryId.value = null
    return
  }

  // TODO: SDK 暂未提供更新分类名称的 API
  msg.info(t('friends.categories.edit_not_supported'))
  editingCategoryId.value = null
}

// 编辑键盘事件
const handleEditKeydown = (event: KeyboardEvent, category: CategoryWithColor) => {
  if (event.key === 'Enter') {
    handleSaveEdit(category)
  } else if (event.key === 'Escape') {
    editingCategoryId.value = null
  }
}

// 删除分类
const handleDelete = (categoryId: string, event: Event) => {
  event.stopPropagation()
  categoryToDelete.value = categoryId
  showDeleteConfirm.value = true
}

// 确认删除
const handleConfirmDelete = async () => {
  if (!categoryToDelete.value) return

  try {
    await friendsStore.deleteCategory(categoryToDelete.value)

    msg.success(t('friends.categories.deleted'))

    logger.info('[FriendCategories] Category deleted', {
      categoryId: categoryToDelete.value
    })

    categoryToDelete.value = null
  } catch (error) {
    msg.error(t('friends.categories.delete_failed'))
    logger.error('[FriendCategories] Failed to delete category:', error)
  }
}

// 发射事件
const emit = defineEmits<(e: 'category-selected', categoryId: string | null) => void>()

// 组件挂载时加载分类
onMounted(async () => {
  if (!friendsStore.initialized) {
    await friendsStore.initialize()
  }
  if (categories.value.length === 0) {
    await friendsStore.fetchCategories()
  }
})
</script>

<style scoped lang="scss">
.friend-categories {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--right-chat-footer-bg);
  border-radius: 8px;
  overflow: hidden;
}

.categories-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line-color);
  background: var(--bg-color);
}

.categories-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.categories-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  min-height: 200px;
}

.categories-scrollbar {
  height: 100%;
}

.categories-list {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;

  &:hover {
    background: var(--hover-color);
  }

  &.is-active {
    background: var(--active-color);
    border-left: 3px solid var(--hula-primary);
  }

  &.is-editing {
    cursor: default;
    background: var(--bg-color);
  }

  &.all-friends {
    border-left: 3px solid transparent;
  }
}

.category-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--hula-primary);
  flex-shrink: 0;
}

.category-info {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.category-name {
  font-size: 14px;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-count {
  font-size: 12px;
  color: #909090;
  flex-shrink: 0;
}

.category-edit {
  flex: 1;
}
</style>
