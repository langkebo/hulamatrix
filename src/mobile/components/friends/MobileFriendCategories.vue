<!-- Mobile Friend Categories - Friend category management for mobile -->
<template>
  <div class="mobile-friend-categories">
    <!-- Category Chips (Horizontal Scroll) -->
    <div v-if="mode === 'chips'" class="category-chips">
      <n-scrollbar x-scrollable>
        <div class="chips-container">
          <n-tag
            v-for="category in categories"
            :key="category.categoryId"
            :type="selectedCategoryId === category.categoryId ? 'primary' : 'default'"
            :bordered="false"
            size="medium"
            round
            closable
            @close="handleDeleteCategory(category)"
            @click="handleSelectCategory(category.categoryId)"
          >
            {{ category.name }}
          </n-tag>
          <n-tag
            :type="selectedCategoryId === null ? 'primary' : 'default'"
            :bordered="false"
            size="medium"
            round
            @click="handleSelectCategory(null)"
          >
            全部
          </n-tag>
          <n-tag
            type="info"
            :bordered="false"
            size="medium"
            round
            @click="showCreateDialog = true"
          >
            <template #icon>
              <n-icon><Plus /></n-icon>
            </template>
            新建
          </n-tag>
        </div>
      </n-scrollbar>
    </div>

    <!-- Category List (Vertical) -->
    <div v-else-if="mode === 'list'" class="category-list">
      <!-- Header -->
      <div class="list-header">
        <h3 class="list-title">好友分类</h3>
        <n-button circle size="small" type="primary" @click="showCreateDialog = true">
          <template #icon>
            <n-icon><Plus /></n-icon>
          </template>
        </n-button>
      </div>

      <!-- Category Items -->
      <div class="list-items">
        <div
          v-for="category in categories"
          :key="category.categoryId"
          class="category-item"
          :class="{ active: selectedCategoryId === category.categoryId }"
          @click="handleSelectCategory(category.categoryId)"
        >
          <div class="item-left">
            <div
              class="category-color"
              :style="{ background: category.color }"
            ></div>
            <div class="category-info">
              <div class="category-name">{{ category.name }}</div>
              <div v-if="category.description" class="category-desc">{{ category.description }}</div>
            </div>
          </div>
          <div class="item-right">
            <n-tag size="small" round>{{ category.count || 0 }}</n-tag>
            <n-dropdown
              :options="getCategoryActions(category)"
              @select="(key) => handleCategoryAction(key, category)"
            >
              <n-button text size="small">
                <template #icon>
                  <n-icon><DotsVertical /></n-icon>
                </template>
              </n-button>
            </n-dropdown>
          </div>
        </div>

        <!-- All Friends Option -->
        <div
          class="category-item"
          :class="{ active: selectedCategoryId === null }"
          @click="handleSelectCategory(null)"
        >
          <div class="item-left">
            <div class="category-color all-friends"></div>
            <div class="category-info">
              <div class="category-name">全部好友</div>
            </div>
          </div>
          <div class="item-right">
            <n-tag size="small" round>{{ totalCount }}</n-tag>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Category Dialog -->
    <n-modal v-model:show="showCreateDialog" preset="dialog" title="创建分类">
      <n-form ref="createFormRef" :model="createForm" :rules="createRules">
        <n-form-item label="名称" path="name">
          <n-input v-model:value="createForm.name" placeholder="输入分类名称" />
        </n-form-item>
        <n-form-item label="描述">
          <n-input v-model:value="createForm.description" type="textarea" placeholder="描述此分类的用途" />
        </n-form-item>
        <n-form-item label="颜色">
          <n-color-picker v-model:value="createForm.color" :modes="['hex']" />
        </n-form-item>
        <n-form-item label="图标">
          <n-select
            v-model:value="createForm.icon"
            :options="iconOptions"
            clearable
            placeholder="选择图标"
          />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showCreateDialog = false">取消</n-button>
        <n-button type="primary" :loading="isCreating" @click="handleCreateCategory">
          创建
        </n-button>
      </template>
    </n-modal>

    <!-- Edit Category Dialog -->
    <n-modal v-model:show="showEditDialog" preset="dialog" title="编辑分类">
      <n-form ref="editFormRef" :model="editForm" :rules="editRules">
        <n-form-item label="名称" path="name">
          <n-input v-model:value="editForm.name" placeholder="输入分类名称" />
        </n-form-item>
        <n-form-item label="描述">
          <n-input v-model:value="editForm.description" type="textarea" placeholder="描述此分类的用途" />
        </n-form-item>
        <n-form-item label="颜色">
          <n-color-picker v-model:value="editForm.color" :modes="['hex']" />
        </n-form-item>
        <n-form-item label="图标">
          <n-select
            v-model:value="editForm.icon"
            :options="iconOptions"
            clearable
            placeholder="选择图标"
          />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showEditDialog = false">取消</n-button>
        <n-button type="primary" :loading="isEditing" @click="handleUpdateCategory">
          保存
        </n-button>
      </template>
    </n-modal>

    <!-- Move Friends Dialog -->
    <n-modal v-model:show="showMoveDialog" preset="dialog" title="移动好友到分类">
      <div class="move-dialog-content">
        <n-alert type="info" class="mb-3">
          将 {{ selectedFriends.length }} 位好友移动到选定分类
        </n-alert>

        <n-radio-group v-model:value="targetCategoryId" name="category">
          <n-space vertical>
            <n-radio value="no-category">
              <span>无分类</span>
            </n-radio>
            <n-radio
              v-for="category in categories"
              :key="category.categoryId"
              :value="category.categoryId"
            >
              <div class="category-radio-item">
                <div
                  class="category-color-dot"
                  :style="{ background: category.color }"
                ></div>
                <span>{{ category.name }}</span>
              </div>
            </n-radio>
          </n-space>
        </n-radio-group>
      </div>
      <template #action>
        <n-button @click="showMoveDialog = false">取消</n-button>
        <n-button type="primary" :loading="isMoving" @click="handleMoveFriends">
          移动
        </n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  NTag,
  NIcon,
  NButton,
  NScrollbar,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NColorPicker,
  NSelect,
  NDropdown,
  NAlert,
  NRadioGroup,
  NRadio,
  NSpace,
  useDialog,
  useMessage
} from 'naive-ui'
import {
  Plus,
  DotsVertical,
  Edit,
  Trash,
  Users,
  Star,
  Heart,
  Briefcase,
  User,
  Home,
  Trophy,
  Book,
  Music
} from '@vicons/tabler'
import { matrixFriendAdapter } from '@/adapters'
import type { FriendCategory } from '@/adapters/service-adapter'
import { logger } from '@/utils/logger'

interface Props {
  mode?: 'chips' | 'list'
  selectedCategoryId?: string | null
  selectedFriends?: string[]
}

interface Emits {
  (e: 'update:selectedCategoryId', value: string | null): void
  (e: 'category-created', category: FriendCategory): void
  (e: 'category-updated', category: FriendCategory): void
  (e: 'category-deleted', categoryId: string): void
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'chips',
  selectedCategoryId: null,
  selectedFriends: () => []
})

const emit = defineEmits<Emits>()

const dialog = useDialog()
const message = useMessage()

// State
const categories = ref<FriendCategory[]>([])
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showMoveDialog = ref(false)
const isCreating = ref(false)
const isEditing = ref(false)
const isMoving = ref(false)
const editingCategory = ref<FriendCategory | null>(null)
const targetCategoryId = ref<string | null>('no-category')

// Form refs
const createFormRef = ref()
const editFormRef = ref()

// Forms
const createForm = ref({
  name: '',
  description: '',
  color: '#18a058',
  icon: ''
})

const editForm = ref({
  name: '',
  description: '',
  color: '#18a058',
  icon: ''
})

// Icon options
const iconOptions = [
  { label: '星标', value: 'Star', icon: Star },
  { label: '家人', value: 'Heart', icon: Heart },
  { label: '同事', value: 'Briefcase', icon: Briefcase },
  { label: '好友', value: 'Users', icon: Users },
  { label: '家庭', value: 'Home', icon: Home },
  { label: '游戏', value: 'Trophy', icon: Trophy },
  { label: '学习', value: 'Book', icon: Book },
  { label: '音乐', value: 'Music', icon: Music }
]

// Validation rules
const createRules = {
  name: { required: true, message: '请输入分类名称', trigger: 'blur' }
}

const editRules = {
  name: { required: true, message: '请输入分类名称', trigger: 'blur' }
}

// Computed
const totalCount = computed(() => {
  return categories.value.reduce((sum, cat) => sum + (cat.count || 0), 0)
})

// Methods
const loadCategories = async () => {
  try {
    categories.value = await matrixFriendAdapter.listCategories()
  } catch (error) {
    logger.error('Failed to load categories:', error)
  }
}

const handleSelectCategory = (categoryId: string | null) => {
  emit('update:selectedCategoryId', categoryId)
}

const handleCreateCategory = async () => {
  try {
    await createFormRef.value?.validate()
  } catch {
    return
  }

  isCreating.value = true
  try {
    const category = await matrixFriendAdapter.createCategory(
      createForm.value.name,
      createForm.value.description,
      createForm.value.color
    )
    await loadCategories()
    message.success('分类创建成功')
    showCreateDialog.value = false
    createForm.value = { name: '', description: '', color: '#18a058', icon: '' }
    emit('category-created', category)
  } catch (error) {
    message.error('创建分类失败: ' + (error instanceof Error ? error.message : '未知错误'))
  } finally {
    isCreating.value = false
  }
}

const handleUpdateCategory = async () => {
  if (!editingCategory.value) return

  try {
    await editFormRef.value?.validate()
  } catch {
    return
  }

  isEditing.value = true
  try {
    // Note: updateCategory may not be implemented in the adapter yet
    // await matrixFriendAdapter.updateCategory(
    //   editingCategory.value.categoryId,
    //   editForm.value.name,
    //   editForm.value.description,
    //   editForm.value.color
    // )
    // For now, just show a message
    message.info('分类更新功能暂未实现')
    showEditDialog.value = false
  } catch (error) {
    message.error('更新分类失败: ' + (error instanceof Error ? error.message : '未知错误'))
  } finally {
    isEditing.value = false
  }
}

const handleDeleteCategory = (category: FriendCategory) => {
  dialog.warning({
    title: '删除分类',
    content: `确定要删除分类"${category.name}"吗？好友将移至无分类。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await matrixFriendAdapter.deleteCategory(category.categoryId)
        await loadCategories()
        message.success('分类已删除')
        emit('category-deleted', category.categoryId)
      } catch (error) {
        message.error('删除分类失败')
      }
    }
  })
}

const handleMoveFriends = async () => {
  isMoving.value = true
  try {
    const finalCategoryId = targetCategoryId.value === 'no-category' ? null : targetCategoryId.value

    // Move each selected friend to the target category
    for (const friendId of props.selectedFriends) {
      await matrixFriendAdapter.setFriendCategory(friendId, finalCategoryId)
    }

    message.success(`已移动 ${props.selectedFriends.length} 位好友`)
    showMoveDialog.value = false
    targetCategoryId.value = 'no-category'
  } catch (error) {
    message.error('移动好友失败')
  } finally {
    isMoving.value = false
  }
}

const handleCategoryAction = (key: string, category: FriendCategory) => {
  switch (key) {
    case 'edit':
      editingCategory.value = category
      editForm.value = {
        name: category.name,
        description: category.description || '',
        color: category.color || '#18a058',
        icon: ''
      }
      showEditDialog.value = true
      break
    case 'delete':
      handleDeleteCategory(category)
      break
    case 'move':
      if (props.selectedFriends.length === 0) {
        message.warning('请先选择要移动的好友')
        return
      }
      showMoveDialog.value = true
      break
  }
}

const getCategoryActions = (_category: FriendCategory) => {
  return [
    { label: '编辑', key: 'edit', icon: () => 'Edit' },
    { label: '删除', key: 'delete', icon: () => 'Trash' },
    ...(props.selectedFriends.length > 0 ? [{ label: '移动选中好友至此', key: 'move', icon: () => 'Users' }] : [])
  ]
}

// Lifecycle
onMounted(() => {
  loadCategories()
})

// Expose methods
defineExpose({
  loadCategories,
  refresh: loadCategories
})
</script>

<style scoped lang="scss">
.mobile-friend-categories {
  width: 100%;
}

.category-chips {
  .chips-container {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
  }
}

.category-list {
  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;

    .list-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }
  }

  .list-items {
    padding: 0 16px;
  }

  .category-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    margin-bottom: 8px;
    background: var(--card-color);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;

    &:active {
      background: var(--item-hover-bg);
      transform: scale(0.98);
    }

    &.active {
      background: var(--primary-color);
      color: white;

      .category-name,
      .category-desc {
        color: white;
      }
    }
  }

  .item-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .category-color {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &.all-friends {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
  }

  .category-info {
    flex: 1;
    min-width: 0;

    .category-name {
      font-size: 15px;
      font-weight: 500;
      color: var(--text-color-1);
      margin-bottom: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .category-desc {
      font-size: 12px;
      color: var(--text-color-3);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .item-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.move-dialog-content {
  .category-radio-item {
    display: flex;
    align-items: center;
    gap: 8px;

    .category-color-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
  }
}

.icon-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

// Safe area for mobile
@supports (padding: env(safe-area-inset-bottom)) {
  .category-list {
    .list-items {
      padding-bottom: calc(16px + env(safe-area-inset-bottom));
    }
  }
}
</style>
