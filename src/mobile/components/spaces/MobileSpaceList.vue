<template>
  <div class="mobile-space-list">
    <!-- 头部 -->
    <div class="mobile-header">
      <div class="header-title">
        <h2>工作区</h2>
        <n-badge :value="totalUnreadCount" :max="99" v-if="totalUnreadCount > 0" />
      </div>

      <div class="header-actions">
        <n-button circle @click="showCreateDialog = true">
          <template #icon>
            <n-icon><Plus /></n-icon>
          </template>
        </n-button>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="search-section">
      <n-input
        v-model:value="searchQuery"
        placeholder="搜索工作区..."
        clearable
        @input="handleSearch"
        :loading="isSearching"
        size="large">
        <template #prefix>
          <n-icon><Search /></n-icon>
        </template>
      </n-input>
    </div>

    <!-- 内容区域 -->
    <div class="content-area">
      <div v-if="isLoading" class="loading-state">
        <n-spin size="large" />
        <p>加载工作区中...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <n-result status="error" title="加载失败" :description="error">
          <template #footer>
            <n-button @click="refreshSpaces">重试</n-button>
          </template>
        </n-result>
      </div>

      <div v-else-if="displaySpaces.length === 0" class="empty-state">
        <n-result status="info" title="暂无工作区" description="创建或加入一个工作区开始协作">
          <template #footer>
            <n-button type="primary" @click="showCreateDialog = true">创建工作区</n-button>
          </template>
        </n-result>
      </div>

      <div v-else class="spaces-container">
        <!-- 搜索结果 -->
        <div v-if="searchQuery" class="search-header">
          <p class="search-info">找到 {{ searchResults.length }} 个结果</p>
        </div>

        <!-- Space卡片列表 -->
        <div class="space-list">
          <div v-for="space in displaySpaces" :key="space.id" class="space-item" @click="handleSpaceClick(space)">
            <div class="space-avatar">
              <n-avatar :src="space.avatar || ''" :size="48" round :fallback="space.name?.charAt(0)?.toUpperCase() || ''" />
              <div v-if="space.notifications && space.notifications.highlightCount !== undefined && space.notifications.highlightCount > 0" class="unread-badge">
                {{ space.notifications.highlightCount }}
              </div>
            </div>

            <div class="space-info">
              <div class="space-name-row">
                <h3 class="space-name">{{ space.name }}</h3>
                <n-tag v-if="space.isPublic ?? false" type="info" size="small" round>公开</n-tag>
              </div>

              <p v-if="space.topic" class="space-topic">{{ space.topic }}</p>

              <div class="space-meta">
                <span class="member-count">
                  {{ space.memberCount ?? 0 }} 成员
                </span>
                <span v-if="(space.notifications?.notificationCount ?? 0) > 0" class="notification-count">
                  {{ space.notifications?.notificationCount ?? 0 }} 条消息
                </span>
              </div>

              <div class="space-children" v-if="space.children && space.children.length > 0">
                <div class="children-preview">
                  <span class="children-label">{{ space.children.length }} 个房间</span>
                  <div class="children-avatars">
                    <n-avatar
                      v-for="(child, index) in space.children.slice(0, 3)"
                      :key="child.roomId"
                      :src="String(child.avatar ?? '')"
                      :size="24"
                      round
                      :style="{ marginLeft: index > 0 ? '-8px' : '0' }"
                      :fallback="String(child.name?.charAt(0)?.toUpperCase() ?? '')" />
                    <span v-if="space.children.length > 3" class="more-children">+{{ space.children.length - 3 }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="space-actions">
              <n-dropdown
                trigger="click"
                :options="getActionOptions(space)"
                @select="handleActionSelect($event, space)">
                <n-button quaternary circle>⋯</n-button>
              </n-dropdown>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建Space对话框 -->
    <MobileCreateSpaceDialog v-model:show="showCreateDialog" @created="handleSpaceCreated" />

    <!-- Space详情底部抽屉 -->
    <MobileSpaceDrawer v-model:show="showSpaceDrawer" :space="selectedSpace" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NButton, NIcon, NBadge, NInput, NSpin, NResult, NAvatar, NTag, NDropdown } from 'naive-ui'
import { msg, dlg } from '@/utils/SafeUI'
import { useMatrixSpaces, type SpaceChild, type Space as MatrixSpace } from '@/hooks/useMatrixSpaces'
import MobileCreateSpaceDialog from './MobileCreateSpaceDialog.vue'
import MobileSpaceDrawer from './MobileSpaceDrawer.vue'

// Interface definitions
interface SpaceNotifications {
  highlightCount: number
  notificationCount: number
  [key: string]: unknown
}

// Use the Space type from useMatrixSpaces directly
// Note: We use the imported type instead of creating a local alias
// to avoid type conflicts

// 使用Matrix Spaces hook
const {
  isLoading,
  error,
  userSpaces,
  totalUnreadCount,
  searchResults,
  isSearching,
  joinSpace,
  leaveSpace,
  refreshSpaces,
  searchSpaces,
  clearSearchResults,
  initializeSpaces
} = useMatrixSpaces()

// 本地状态
const searchQuery = ref('')
const showCreateDialog = ref(false)
const showSpaceDrawer = ref(false)
const selectedSpace = ref<MatrixSpace | null>(null)

// 计算属性
const displaySpaces = computed(() => {
  if (searchQuery.value) {
    return searchResults.value
  }
  return userSpaces.value
})

// ========== 事件处理 ==========

/**
 * 处理搜索
 */
const handleSearch = async (query: string) => {
  if (query.trim()) {
    await searchSpaces(query, { limit: 20 })
  } else {
    clearSearchResults()
  }
}

/**
 * 处理Space点击
 */
const handleSpaceClick = (space: MatrixSpace) => {
  selectedSpace.value = space
  showSpaceDrawer.value = true
}

/**
 * 获取操作选项
 */
const getActionOptions = (space: MatrixSpace) => {
  const isJoined = (space.children || []).some((child: SpaceChild) => child.isJoined)

  const options = [
    {
      label: '查看详情',
      key: 'view',
      icon: () => '👁️'
    }
  ]

  if (!isJoined) {
    options.push({
      label: '加入工作区',
      key: 'join',
      icon: () => '📥'
    })
  } else {
    options.push({
      label: '离开工作区',
      key: 'leave',
      icon: () => '📤'
    })
  }

  return options
}

/**
 * 处理操作选择
 */
const handleActionSelect = async (key: string, space: MatrixSpace) => {
  switch (key) {
    case 'view':
      handleSpaceClick(space)
      break

    case 'join': {
      const joinSuccess = await joinSpace(space.id)
      if (joinSuccess) {
        msg.success(`成功加入工作区: ${space.name}`)
      }
      break
    }

    case 'leave':
      // 显示确认对话框
      dlg.warning({
        title: '确认离开',
        content: `确定要离开工作区 "${space.name}" 吗？`,
        positiveText: '确定',
        negativeText: '取消',
        onPositiveClick: async () => {
          const leaveSuccess = await leaveSpace(space.id)
          if (leaveSuccess) {
            msg.success(`已离开工作区: ${space.name}`)
          }
        }
      })
      break
  }
}

/**
 * 处理Space创建完成
 * Note: MobileCreateSpaceDialog emits a different Space interface than MatrixSpace
 */
const handleSpaceCreated = (space: unknown) => {
  showCreateDialog.value = false
  // Extract name safely from the space object
  const spaceName = (space as { name?: string }).name || '工作区'
  msg.success(`工作区创建成功: ${spaceName}`)
  refreshSpaces()

  // 自动打开新创建的Space详情
  // Cast to MatrixSpace for selectedSpace since we just created it
  selectedSpace.value = space as MatrixSpace
  showSpaceDrawer.value = true
}

// ========== 生命周期 ==========

onMounted(async () => {
  // 初始化Spaces
  await initializeSpaces()
})
</script>

<style lang="scss" scoped>
.mobile-space-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
}

.mobile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--card-color);
  border-bottom: 1px solid var(--border-color);

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;

    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: var(--text-color-1);
    }
  }
}

.search-section {
  padding: 16px;
  background: var(--card-color);
  border-bottom: 1px solid var(--border-color);
}

.content-area {
  flex: 1;
  overflow: hidden;
}

.loading-state,
.error-state,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;

  p {
    margin-top: 16px;
    color: var(--text-color-3);
  }
}

.spaces-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.search-header {
  padding: 8px 16px;
  background: var(--card-color);
  margin-bottom: 8px;
  border-radius: 8px;

  .search-info {
    margin: 0;
    font-size: 14px;
    color: var(--text-color-2);
  }
}

.space-list {
  .space-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    margin-bottom: 8px;
    background: var(--card-color);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;

    &:hover {
      background: var(--card-color-hover);
      border-color: var(--primary-color);
      transform: translateY(-1px);
    }

    &:active {
      transform: translateY(0);
    }
  }

  .space-avatar {
    position: relative;
    flex-shrink: 0;

    .unread-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      background: var(--error-color);
      color: white;
      border-radius: 9px;
      font-size: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
    }
  }

  .space-info {
    flex: 1;
    min-width: 0;

    .space-name-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;

      .space-name {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-color-1);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .space-topic {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: var(--text-color-2);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .space-meta {
      display: flex;
      gap: 12px;
      margin-bottom: 8px;

      .member-count,
      .notification-count {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: var(--text-color-3);

        .n-icon {
          font-size: 14px;
        }
      }

      .notification-count {
        color: var(--primary-color);
      }
    }

    .space-children {
      .children-preview {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .children-label {
          font-size: 12px;
          color: var(--text-color-3);
        }

        .children-avatars {
          display: flex;
          align-items: center;

          .more-children {
            margin-left: 4px;
            font-size: 10px;
            color: var(--text-color-3);
            background: var(--bg-color-hover);
            padding: 2px 6px;
            border-radius: 10px;
          }
        }
      }
    }
  }

  .space-actions {
    flex-shrink: 0;
    margin-left: 8px;
  }
}

// 触摸优化
@media (hover: none) {
  .space-item {
    &:hover {
      background: var(--card-color);
      border-color: transparent;
      transform: none;
    }

    &:active {
      background: var(--card-color-hover);
      transform: scale(0.98);
    }
  }
}

// 小屏幕优化
@media (max-width: 480px) {
  .mobile-header {
    padding: 12px;

    .header-title h2 {
      font-size: 18px;
    }
  }

  .search-section {
    padding: 12px;
  }

  .space-item {
    padding: 12px;
  }

  .space-info {
    .space-name-row .space-name {
      font-size: 15px;
    }

    .space-topic {
      font-size: 13px;
    }
  }
}
</style>
