<!-- Mobile Spaces View - Spaces management for mobile -->
<template>
  <div class="mobile-spaces-view">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">工作区</h1>
        <n-badge v-if="totalUnreadCount > 0" :value="totalUnreadCount" :max="99" />
      </div>
      <div class="header-actions">
        <n-button circle @click="showCreateDialog = true">
          <template #icon>
            <n-icon><Plus /></n-icon>
          </template>
        </n-button>
      </div>
    </div>

    <!-- Content -->
    <div class="page-content">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <n-spin size="large" />
        <p>加载中...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <n-result status="error" title="加载失败" :description="error">
          <template #footer>
            <n-button @click="handleRefresh">重试</n-button>
          </template>
        </n-result>
      </div>

      <!-- Empty State -->
      <div v-else-if="userSpaces.length === 0" class="empty-state">
        <n-result status="info" title="暂无工作区" description="创建或加入一个工作区开始协作">
          <template #footer>
            <n-button type="primary" @click="showCreateDialog = true">创建工作区</n-button>
          </template>
        </n-result>
      </div>

      <!-- Spaces Grid -->
      <div v-else class="spaces-grid">
        <div v-for="space in userSpaces" :key="space.id" class="space-card" @click="handleSpaceClick(space)">
          <div class="space-avatar-section">
            <n-avatar :src="space.avatar || ''" :size="56" round>
              <template #fallback>
                <span class="avatar-fallback">{{ space.name?.charAt(0)?.toUpperCase() || '?' }}</span>
              </template>
            </n-avatar>
            <div v-if="getUnreadCount(space.id) > 0" class="unread-badge">
              {{ getUnreadCount(space.id) }}
            </div>
          </div>

          <div class="space-info">
            <h3 class="space-name">{{ space.name }}</h3>
            <p v-if="space.topic" class="space-topic">{{ space.topic }}</p>
            <div class="space-meta">
              <span class="meta-item">
                <n-icon :size="12"><Users /></n-icon>
                {{ space.memberCount ?? 0 }}
              </span>
              <span class="meta-item">
                <n-icon :size="12"><Hash /></n-icon>
                {{ space.children?.length ?? 0 }}
              </span>
            </div>
          </div>

          <div class="space-badge">
            <n-tag v-if="space.isPublic" type="info" size="small" round>
              <template #icon>
                <n-icon :size="12"><World /></n-icon>
              </template>
              公开
            </n-tag>
            <n-tag v-else type="default" size="small" round>
              <template #icon>
                <n-icon :size="12"><Lock /></n-icon>
              </template>
              私有
            </n-tag>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Space Dialog -->
    <n-modal v-model:show="showCreateDialog" preset="dialog" title="创建工作区">
      <n-form ref="createFormRef" :model="createForm" :rules="createRules">
        <n-form-item label="名称" path="name">
          <n-input v-model:value="createForm.name" placeholder="输入工作区名称" />
        </n-form-item>
        <n-form-item label="描述">
          <n-input v-model:value="createForm.topic" type="textarea" placeholder="描述此工作区的用途" />
        </n-form-item>
        <n-form-item label="公开">
          <n-switch v-model:value="createForm.isPublic" />
          <template #feedback>
            <n-text depth="3" class="helper-text">公开工作区可以被任何人发现和加入</n-text>
          </template>
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showCreateDialog = false">取消</n-button>
        <n-button type="primary" :loading="isCreating" @click="handleCreate">创建</n-button>
      </template>
    </n-modal>

    <!-- Space Details Drawer -->
    <MobileSpaceDrawer v-model:show="showSpaceDrawer" :space="selectedSpace" @room-selected="handleRoomSelected" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NIcon,
  NBadge,
  NSpin,
  NResult,
  NAvatar,
  NTag,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NSwitch,
  NText,
  useMessage
} from 'naive-ui'
import { Plus, Users, Hash, World, Lock } from '@vicons/tabler'
import { useMatrixSpaces, type Space as MatrixSpace } from '@/hooks/useMatrixSpaces'
import MobileSpaceDrawer from '@/mobile/components/spaces/MobileSpaceDrawer.vue'
import { useHaptic } from '@/composables/useMobileGestures'

const router = useRouter()
const message = useMessage()
const { selection, success, error: hapticError } = useHaptic()

// Matrix Spaces hook
const {
  isLoading,
  error,
  userSpaces,
  totalUnreadCount,
  initializeSpaces,
  refreshSpaces,
  createSpace,
  getSpaceUnreadCount
} = useMatrixSpaces()

// State
const showCreateDialog = ref(false)
const showSpaceDrawer = ref(false)
const selectedSpace = ref<MatrixSpace | null>(null)
const isCreating = ref(false)

// Create form
const createFormRef = ref<{ validate: () => void | Promise<void> } | null>(null)
const createForm = ref({
  name: '',
  topic: '',
  isPublic: false
})

const createRules = {
  name: { required: true, message: '请输入工作区名称', trigger: 'blur' }
}

// Methods
const handleRefresh = async () => {
  await refreshSpaces()
  selection()
}

const handleSpaceClick = (space: MatrixSpace) => {
  selectedSpace.value = space
  showSpaceDrawer.value = true
  selection()
}

const handleCreate = async () => {
  try {
    await createFormRef.value?.validate()
  } catch {
    return
  }

  if (!createForm.value.name) return

  isCreating.value = true
  try {
    const space = await createSpace({
      name: createForm.value.name,
      topic: createForm.value.topic,
      isPublic: createForm.value.isPublic
    })

    if (space) {
      success()
      message.success('工作区创建成功')
      showCreateDialog.value = false
      createForm.value = { name: '', topic: '', isPublic: false }

      // Open the newly created space
      selectedSpace.value = space
      showSpaceDrawer.value = true
    } else {
      hapticError()
      message.error('创建工作区失败')
    }
  } finally {
    isCreating.value = false
  }
}

const handleRoomSelected = (roomId: string) => {
  router.push({
    path: '/mobile/chatRoom/chatMain',
    query: { roomId }
  })
}

const getUnreadCount = (spaceId: string) => {
  const unread = getSpaceUnreadCount(spaceId)
  return unread.highlight + unread.notification
}

// Lifecycle
onMounted(async () => {
  await initializeSpaces()
})
</script>

<style scoped lang="scss">
.mobile-spaces-view {
  min-height: 100vh;
  background: var(--bg-color);
  padding-bottom: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--card-color);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 10;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .page-title {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
  }
}

.page-content {
  padding: 16px;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;

  p {
    margin-top: 16px;
    color: var(--text-color-3);
  }
}

.spaces-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.space-card {
  background: var(--card-color);
  border-radius: 16px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;

  &:active {
    background: var(--item-hover-bg);
    transform: scale(0.98);
  }

  .space-avatar-section {
    display: flex;
    justify-content: center;
    margin-bottom: 16px;
    position: relative;

    .unread-badge {
      position: absolute;
      top: -4px;
      right: calc(50% - 28px);
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      background: var(--error-color);
      color: white;
      border-radius: 10px;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
    }

    .avatar-fallback {
      font-size: 24px;
      font-weight: 600;
    }
  }

  .space-info {
    text-align: center;
    margin-bottom: 16px;

    .space-name {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--text-color-1);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .space-topic {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: var(--text-color-2);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: 1.5;
    }

    .space-meta {
      display: flex;
      justify-content: center;
      gap: 16px;

      .meta-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: var(--text-color-3);
      }
    }
  }

  .space-badge {
    display: flex;
    justify-content: center;
  }
}

.helper-text {
  font-size: 12px;
}

// Safe area for mobile
@supports (padding: env(safe-area-inset-bottom)) {
  .mobile-spaces-view {
    padding-bottom: calc(20px + env(safe-area-inset-bottom));
  }
}
</style>
