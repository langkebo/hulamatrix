<template>
  <n-modal
    :show="visible"
    preset="card"
    :style="{ width: '500px' }"
    :aria-label="t('friends.category.manage_title')"
    role="dialog"
    :mask-closable="false"
    @update:show="handleClose">
    <template #header>
      <div class="flex items-center gap-2">
        <svg class="size-20px"><use href="#folder-settings"></use></svg>
        <span>{{ t('friends.category.manage_title') }}</span>
      </div>
    </template>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <n-spin size="medium" />
    </div>

    <!-- 分类列表 -->
    <div v-else class="category-manage-container">
      <!-- 空状态 -->
      <n-empty v-if="categories.length === 0" :description="t('friends.category.no_categories')" size="small">
        <template #extra>
          <n-button size="small" type="primary" secondary @click="handleCreateNew">
            {{ t('friends.category.create_button') }}
          </n-button>
        </template>
      </n-empty>

      <!-- 分类列表 -->
      <n-virtual-list v-else :items="categories" :item-size="72" class="category-list">
        <template #default="{ item: category }">
          <div class="category-item" :class="{ 'is-editing': editingCategoryId === category.id }">
            <div class="category-info">
              <div class="category-color-dot" :style="{ backgroundColor: category.color || '#18A058' }"></div>
              <div v-if="editingCategoryId !== category.id" class="category-details">
                <span class="category-name">{{ category.name }}</span>
                <span class="category-count">
                  {{ getCategoryFriendCount(category.id) }} {{ t('friends.category.friends') }}
                </span>
              </div>
              <n-input
                v-else
                v-model:value="editingForm.name"
                size="small"
                :maxlength="50"
                :placeholder="t('friends.category.name_placeholder')"
                @keyup.enter="handleSaveEdit(category.id)"
                @keyup.esc="handleCancelEdit" />
            </div>

            <div class="category-actions">
              <template v-if="editingCategoryId === category.id">
                <n-button-group size="small">
                  <n-button type="primary" @click="handleSaveEdit(category.id)" :loading="saving">
                    {{ t('common.save') }}
                  </n-button>
                  <n-button @click="handleCancelEdit">
                    {{ t('common.cancel') }}
                  </n-button>
                </n-button-group>
              </template>
              <template v-else>
                <n-button-group size="small">
                  <n-button secondary @click="handleStartEdit(category)">
                    {{ t('common.edit') }}
                  </n-button>
                  <n-button
                    secondary
                    type="error"
                    :disabled="getCategoryFriendCount(category.id) > 0"
                    @click="handleDeleteCategory(category)">
                    {{ t('common.delete') }}
                  </n-button>
                </n-button-group>
              </template>
            </div>
          </div>
        </template>
      </n-virtual-list>
    </div>

    <template #footer>
      <n-space justify="space-between">
        <n-text depth="3" class="category-hint">
          <Icon icon="mdi:information-outline" />
          {{ t('friends.category.manage_hint') }}
        </n-text>
        <n-space>
          <n-button @click="handleClose">{{ t('common.close') }}</n-button>
          <n-button type="primary" @click="handleCreateNew">
            <template #icon>
              <svg class="size-14px"><use href="#plus"></use></svg>
            </template>
            {{ t('friends.category.create_button') }}
          </n-button>
        </n-space>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NSpin,
  NEmpty,
  NVirtualList,
  NButton,
  NButtonGroup,
  NInput,
  NSpace,
  NText,
  NIcon,
  useDialog,
  useMessage
} from 'naive-ui'
import { Icon } from '@iconify/vue'
import { useFriendsSDKStore } from '@/stores/friendsSDK'
import { logger } from '@/utils/logger'
import type { CategoryItem } from '@/stores/friendsSDK'

interface Props {
  visible: boolean
  categories: CategoryItem[]
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'refresh'): void
  (e: 'create'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const dialog = useDialog()
const message = useMessage()
const friendsStore = useFriendsSDKStore()

// 状态
const loading = ref(false)
const saving = ref(false)
const editingCategoryId = ref<string | null>(null)
const editingForm = ref({
  name: '',
  color: '#18A058'
})

// 获取分组好友数量
const getCategoryFriendCount = (categoryId: string): number => {
  return friendsStore.friends.filter((f) => f.category_id === categoryId).length
}

// 开始编辑
const handleStartEdit = (category: CategoryItem) => {
  editingCategoryId.value = category.id
  editingForm.value = {
    name: category.name,
    color: (category as any).color || '#18A058'
  }
}

// 取消编辑
const handleCancelEdit = () => {
  editingCategoryId.value = null
  editingForm.value = {
    name: '',
    color: '#18A058'
  }
}

// 保存编辑
const handleSaveEdit = async (categoryId: string) => {
  if (!editingForm.value.name.trim()) {
    message.error(t('friends.category.name_required'))
    return
  }

  try {
    saving.value = true

    // 先删除旧分组
    await friendsStore.deleteCategory(categoryId)

    // 创建新分组（因为 API 可能不支持更新）
    await friendsStore.createCategory(editingForm.value.name.trim())

    message.success(t('friends.category.update_success'))
    editingCategoryId.value = null
    emit('refresh')
  } catch (error) {
    message.error(t('friends.category.update_failed'))
    logger.error('Failed to update category:', error)
  } finally {
    saving.value = false
  }
}

// 删除分组
const handleDeleteCategory = (category: CategoryItem) => {
  const friendCount = getCategoryFriendCount(category.id)

  if (friendCount > 0) {
    message.warning(t('friends.category.delete_not_empty'))
    return
  }

  dialog.warning({
    title: t('friends.category.delete_confirm_title'),
    content: t('friends.category.delete_confirm_content', { name: category.name }),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await friendsStore.deleteCategory(category.id)
        message.success(t('friends.category.delete_success'))
        emit('refresh')
      } catch (error) {
        message.error(t('friends.category.delete_failed'))
        logger.error('Failed to delete category:', error)
      }
    }
  })
}

// 创建新分组
const handleCreateNew = () => {
  emit('create')
}

// 关闭对话框
const handleClose = () => {
  // 如果正在编辑，提示保存
  if (editingCategoryId.value) {
    dialog.warning({
      title: t('friends.category.unsaved_changes_title'),
      content: t('friends.category.unsaved_changes_content'),
      positiveText: t('common.leave'),
      negativeText: t('common.stay'),
      onPositiveClick: () => {
        editingCategoryId.value = null
        emit('update:visible', false)
      }
    })
  } else {
    emit('update:visible', false)
  }
}

// 监听对话框关闭
watch(
  () => props.visible,
  (newVal) => {
    if (!newVal) {
      editingCategoryId.value = null
    }
  }
)
</script>

<style scoped lang="scss">
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.category-manage-container {
  max-height: 400px;
  overflow: hidden;
}

.category-list {
  max-height: 350px;
}

.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--hula-spacing-sm);
  margin-bottom: var(--hula-spacing-xs);
  background: var(--bg-setting-item);
  border: 1px solid var(--line-color);
  border-radius: var(--hula-radius-sm);
  transition:
    background 0.2s ease,
    border-color 0.2s ease;

  &:hover {
    background: var(--hover-color);
    border-color: var(--border-active-color);
  }

  &.is-editing {
    border-color: var(--color-primary);
    background: var(--bg-color-2);
  }
}

.category-info {
  display: flex;
  align-items: center;
  gap: var(--hula-spacing-md);
  flex: 1;
  min-width: 0;
}

.category-color-dot {
  width: var(--hula-spacing-sm);
  height: var(--hula-spacing-sm);
  border-radius: 50%;
  flex-shrink: 0;
  border: 2px solid var(--bg-color);
}

.category-details {
  display: flex;
  flex-direction: column;
  gap: var(--hula-spacing-xs);
  min-width: 0;
  flex: 1;
}

.category-name {
  font-size: var(--hula-text-sm);
  font-weight: 600;
  color: var(--text-color-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.category-count {
  font-size: var(--hula-text-xs);
  color: var(--text-color-3);
}

.category-actions {
  flex-shrink: 0;
}

.category-hint {
  display: flex;
  align-items: center;
  gap: var(--hula-spacing-xs);
  font-size: var(--hula-text-xs);
}
</style>
