<template>
  <div class="mobile-space-list">
    <!-- 头部 -->
    <div class="mobile-header">
      <div class="header-title">
        <h2>工作区</h2>
        <n-badge :value="totalUnreadCount" :max="99" v-if="totalUnreadCount > 0" />
      </div>

      <div class="header-actions">
        <n-button circle quaternary @click="showFilterDrawer = true">
          <template #icon>
            <n-icon><Filter /></n-icon>
          </template>
        </n-button>
        <n-button circle @click="showCreateDialog = true">
          <template #icon>
            <n-icon><Plus /></n-icon>
          </template>
        </n-button>
      </div>
    </div>

    <!-- 搜索和筛选栏 -->
    <div class="search-section">
      <n-auto-complete
        v-model:value="searchQuery"
        :options="searchSuggestions.map((s) => ({ label: s, value: s }))"
        placeholder="搜索工作区..."
        clearable
        @input="handleSearch"
        @focus="loadSuggestions"
        @select="selectSuggestion"
        :loading="isSearching"
        size="large">
        <template #prefix>
          <n-icon><Search /></n-icon>
        </template>
        <template #suffix>
          <n-dropdown
            v-if="searchHistory.length > 0"
            trigger="click"
            :options="[{ label: '清除搜索历史', key: 'clear' }]"
            @select="clearHistory">
            <n-button text type="primary">
              <template #icon>
                <n-icon><Clock /></n-icon>
              </template>
            </n-button>
          </n-dropdown>
          <n-button v-if="hasActiveFilters" text type="primary" @click="handleResetFilters">清除筛选</n-button>
        </template>
      </n-auto-complete>

      <!-- 快速筛选标签 -->
      <div class="filter-tags" v-if="!searchQuery && searchHistory.length === 0">
        <n-tag
          v-for="filter in quickFilters"
          :key="filter.key"
          :type="activeQuickFilter === filter.key ? 'primary' : 'default'"
          :bordered="false"
          round
          size="small"
          @click="toggleQuickFilter(filter.key)">
          {{ filter.label }}
        </n-tag>
      </div>

      <!-- 搜索历史标签 -->
      <div class="filter-tags" v-if="!searchQuery && searchHistory.length > 0">
        <span class="history-label">最近搜索</span>
        <n-tag
          v-for="item in searchHistory.slice(0, 4)"
          :key="item"
          type="default"
          :bordered="false"
          round
          size="small"
          closable
          @close="removeHistoryItem(item)"
          @click.stop="selectSuggestion(item)">
          {{ item }}
        </n-tag>
      </div>
    </div>

    <!-- 内容区域 - 下拉刷新 -->
    <div class="content-area">
      <n-spin :show="isLoading && !isRefreshing" size="large">
        <n-scrollbar ref="scrollbarRef" x-scrollable @scroll="handleScroll" style="height: 100%">
          <PullRefresh
            @refresh="handleRefresh"
            :trigger-distance="80"
            :max-distance="120"
            pulling-text="下拉刷新"
            release-text="释放立即刷新"
            refreshing-text="正在刷新...">
            <div class="spaces-content">
              <!-- 空状态 -->
              <div v-if="displaySpaces.length === 0 && !isLoading" class="empty-state">
                <n-result
                  :status="searchQuery ? 'info' : '418'"
                  :title="searchQuery ? '未找到匹配的工作区' : '暂无工作区'"
                  :description="searchQuery ? '尝试其他关键词' : '创建或加入一个工作区开始协作'">
                  <template #footer>
                    <n-button v-if="!searchQuery" type="primary" @click="showCreateDialog = true">创建工作区</n-button>
                    <n-button
                      v-else
                      @click="
                        searchQuery = ''
                        handleSearch('')
                      ">
                      清除搜索
                    </n-button>
                  </template>
                </n-result>
              </div>

              <!-- 搜索结果信息 -->
              <div v-else-if="searchQuery" class="search-header">
                <div class="search-info">
                  <p>找到 {{ displaySpaces.length }} 个结果</p>
                  <n-button
                    text
                    type="primary"
                    @click="
                      searchQuery = ''
                      handleSearch('')
                    ">
                    清除搜索
                  </n-button>
                </div>
              </div>

              <!-- 空间列表 - 使用虚拟滚动优化性能 -->
              <div v-else class="spaces-list">
                <!-- 排序选项 -->
                <div v-if="!searchQuery && displaySpaces.length > 1" class="sort-bar">
                  <n-dropdown trigger="click" :options="sortOptions" @select="handleSortSelect">
                    <n-button size="small" quaternary>
                      <template #icon>
                        <n-icon><ArrowsSort /></n-icon>
                      </template>
                      {{ currentSortLabel }}
                    </n-button>
                  </n-dropdown>
                </div>

                <!-- Space卡片列表 -->
                <DynamicScroller
                  :items="displaySpaces"
                  :min-item-size="100"
                  :buffer="300"
                  key-field="id"
                  type-field="type"
                  class="space-scroller">
                  <template #default="{ item: space, index: index }">
                    <div class="space-item" :class="{ 'first-item': index === 0 }" @click="handleSpaceClick(space)">
                      <div class="space-avatar">
                        <n-avatar
                          :src="space.avatar || ''"
                          :size="52"
                          round
                          :fallback="space.name?.charAt(0)?.toUpperCase() || ''" />
                        <div v-if="(space.notifications?.notificationCount ?? 0) > 0" class="unread-badge">
                          {{ formatUnreadCount((space.notifications?.notificationCount ?? 0)) }}
                        </div>
                        <div v-if="space.encrypted" class="encrypted-badge">
                          <n-icon size="12"><Lock /></n-icon>
                        </div>
                      </div>

                      <div class="space-info">
                        <div class="space-name-row">
                          <h3 class="space-name">{{ space.name }}</h3>
                          <n-space :size="4">
                            <n-tag v-if="space.isPublic ?? false" type="info" size="small" round>公开</n-tag>
                            <n-tag v-if="space.encrypted" type="success" size="small" round>
                              <template #icon>
                                <n-icon size="12"><Lock /></n-icon>
                              </template>
                              加密
                            </n-tag>
                          </n-space>
                        </div>

                        <p v-if="space.topic" class="space-topic">
                          {{ space.topic }}
                        </p>

                        <div class="space-meta">
                          <span class="member-count">
                            <n-icon size="14"><Users /></n-icon>
                            {{ space.memberCount ?? 0 }}
                          </span>
                          <span v-if="space.roomCount > 0" class="room-count">
                            <n-icon size="14"><Hash /></n-icon>
                            {{ space.roomCount }} 个房间
                          </span>
                          <span v-if="space.lastActivity" class="last-activity">
                            {{ formatLastActivity(space.lastActivity) }}
                          </span>
                        </div>

                        <!-- 成员预览 -->
                        <div v-if="space.memberPreview && space.memberPreview.length > 0" class="member-preview">
                          <n-avatar-group :options="space.memberPreview" :size="28" :max="4">
                            <template #avatar="{ option }">
                              <n-avatar
                                :src="(option as { src?: string }).src || ''"
                                :size="28"
                                round
                                :fallback="(option as { name?: string })?.name?.charAt(0) || ''" />
                            </template>
                          </n-avatar-group>
                          <span v-if="space.memberCount > 4" class="more-members">+{{ space.memberCount - 4 }}</span>
                        </div>
                      </div>

                      <div class="space-actions">
                        <n-dropdown
                          trigger="click"
                          placement="bottom-end"
                          :options="getActionOptions(space)"
                          @select="handleActionSelect($event, space)">
                          <n-button quaternary circle size="small">
                            <template #icon>
                              <n-icon><DotsVertical /></n-icon>
                            </template>
                          </n-button>
                        </n-dropdown>
                      </div>
                    </div>
                  </template>
                </DynamicScroller>

                <!-- 底部提示 -->
                <div v-if="displaySpaces.length > 0 && !isLoading" class="end-hint">
                  <n-text depth="3">已加载全部工作区</n-text>
                </div>
              </div>
            </div>
          </PullRefresh>
        </n-scrollbar>
      </n-spin>
    </div>

    <!-- 筛选抽屉 -->
    <n-drawer v-model:show="showFilterDrawer" placement="right" :width="320">
      <n-card title="筛选选项" :bordered="false">
        <template #header-extra>
          <n-button quaternary circle @click="showFilterDrawer = false">
            <template #icon>
              <n-icon><X /></n-icon>
            </template>
          </n-button>
        </template>

        <!-- 可见性筛选 -->
        <div class="filter-section">
          <h4>可见性</h4>
          <n-checkbox-group v-model:value="filters.visibility">
            <n-space vertical>
              <n-checkbox value="all">全部</n-checkbox>
              <n-checkbox value="public">公开</n-checkbox>
              <n-checkbox value="private">私有</n-checkbox>
            </n-space>
          </n-checkbox-group>
        </div>

        <!-- 加密状态筛选 -->
        <div class="filter-section">
          <h4>加密状态</h4>
          <n-checkbox-group v-model:value="filters.encrypted">
            <n-space vertical>
              <n-checkbox value="all">全部</n-checkbox>
              <n-checkbox value="encrypted">已加密</n-checkbox>
              <n-checkbox value="unencrypted">未加密</n-checkbox>
            </n-space>
          </n-checkbox-group>
        </div>

        <!-- 成员数筛选 -->
        <div class="filter-section">
          <h4>成员数量</h4>
          <n-slider
            v-model:value="filters.memberCount"
            :min="0"
            :max="1000"
            :step="10"
            :marks="{ 0: '0', 100: '100', 500: '500', 1000: '1K+' }"
            range
            style="margin: 24px 0" />
          <n-space>
            <n-tag>{{ filters.memberCount[0] }}+</n-tag>
            <n-tag>{{ filters.memberCount[1] }}-</n-tag>
          </n-space>
        </div>

        <!-- 操作按钮 -->
        <template #footer>
          <n-space vertical style="width: 100%">
            <n-button type="primary" @click="applyFilters" block>应用筛选</n-button>
            <n-button @click="handleResetFilters" block>重置</n-button>
          </n-space>
        </template>
      </n-card>
    </n-drawer>

    <!-- 创建Space对话框 -->
    <MobileCreateSpaceDialog v-model:show="showCreateDialog" @created="handleSpaceCreated" />

    <!-- Space详情底部抽屉 -->
    <MobileSpaceDrawer v-model:show="showSpaceDrawer" :space="selectedSpace" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NIcon,
  NBadge,
  NAutoComplete,
  NSpin,
  NResult,
  NAvatar,
  NTag,
  NDropdown,
  NSpace,
  NText,
  NScrollbar,
  NDrawer,
  NCard,
  NCheckboxGroup,
  NCheckbox,
  NSlider,
  useMessage,
  useDialog
} from 'naive-ui'
import { Plus, Search, Filter, Users, Hash, Lock, DotsVertical, X, Clock, ArrowsSort } from '@vicons/tabler'
import { useMatrixSpaces, type Space as MatrixSpace } from '@/hooks/useMatrixSpaces'
import { useSpaceList, type SortOption } from '@/composables/useSpaceList'
import { useUserStore } from '@/stores/user'
import MobileCreateSpaceDialog from './MobileCreateSpaceDialog.vue'
import MobileSpaceDrawer from './MobileSpaceDrawer.vue'
import PullRefresh from '@/components/common/PullRefresh.vue'
import { DynamicScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

// 使用 Matrix Spaces hook
const {
  isLoading,
  userSpaces,
  totalUnreadCount,
  searchResults,
  isSearching: isMatrixSearching,
  joinSpace,
  leaveSpace,
  refreshSpaces,
  searchSpaces,
  clearSearchResults,
  initializeSpaces
} = useMatrixSpaces()

const router = useRouter()
const userStore = useUserStore()
const message = useMessage()
const dialog = useDialog()

// 使用 Space List 共享逻辑
const {
  searchQuery,
  currentSort,
  filters,
  activeQuickFilter,
  searchSuggestions,
  searchHistory,
  isSearching,
  hasActiveFilters,
  currentSortLabel,
  displaySpaces,
  handleSearch,
  loadSuggestions,
  clearHistory,
  removeHistoryItem,
  resetFilters,
  toggleQuickFilter,
  formatUnreadCount,
  formatLastActivity
} = useSpaceList({
  userSpaces,
  searchResults: searchResults as any,
  searchSpaces: async (q, o) => {
    await searchSpaces(q, o)
    return searchResults.value as MatrixSpace[]
  },
  clearSearchResults
})

// 本地状态
const showCreateDialog = ref(false)
const showSpaceDrawer = ref(false)
const showFilterDrawer = ref(false)
const selectedSpace = ref<MatrixSpace | null>(null)
const isRefreshing = ref(false)
const scrollbarRef = ref()
const showSuggestions = ref(false)

// 快速筛选选项
const quickFilters = [
  { key: 'all', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'encrypted', label: '已加密' },
  { key: 'public', label: '公开' }
]

// 排序选项
const sortOptions = [
  { label: '最近活动', key: 'activity' },
  { label: '成员数量', key: 'members' },
  { label: '名称', key: 'name' }
]

// 方法
const selectSuggestion = (suggestion: string) => {
  searchQuery.value = suggestion
  showSuggestions.value = false
  handleSearch(suggestion)
}

const handleRefresh = async () => {
  isRefreshing.value = true
  try {
    await refreshSpaces()
    message.success('已刷新')
  } finally {
    // 模拟网络延迟
    setTimeout(() => {
      isRefreshing.value = false
    }, 500)
  }
}

const handleScroll = (e: Event) => {
  // const target = e.target as HTMLElement
  // const { scrollTop, scrollHeight, clientHeight } = target
  // if (scrollHeight - scrollTop - clientHeight < 100 && hasMore.value && !isLoadingMore.value) {
  //   loadMore()
  // }
}

const handleSortSelect = (key: string) => {
  const validSorts = ['name', 'members', 'activity'] as const
  if (validSorts.includes(key as (typeof validSorts)[number])) {
    currentSort.value = key as SortOption
  }
}

const handleResetFilters = () => {
  resetFilters()
  message.success('筛选已重置')
}

const applyFilters = () => {
  showFilterDrawer.value = false
  message.success('筛选已应用')
}

const handleSpaceClick = (space: MatrixSpace) => {
  selectedSpace.value = space
  showSpaceDrawer.value = true
}

const getActionOptions = (space: MatrixSpace) => {
  const isJoined = (space.roomCount ?? 0) > 0

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
      label: '打开工作区',
      key: 'open',
      icon: () => '🚀'
    })
  }

  options.push({
    label: '分享',
    key: 'share',
    icon: () => '🔗'
  })

  options.push({
    label: '设置',
    key: 'settings',
    icon: () => '⚙️'
  })

  if (isJoined) {
    options.push({
      label: '离开工作区',
      key: 'leave',
      icon: () => '📤'
    })
  }

  return options
}

const handleActionSelect = async (key: string, space: MatrixSpace) => {
  switch (key) {
    case 'view':
    case 'open':
      handleSpaceClick(space)
      break

    case 'join': {
      const joinSuccess = await joinSpace(space.id)
      if (joinSuccess) {
        message.success(`成功加入工作区: ${space.name}`)
      }
      break
    }

    case 'leave':
      dialog.warning({
        title: '确认离开',
        content: `确定要离开工作区 "${space.name}" 吗？`,
        positiveText: '确定',
        negativeText: '取消',
        onPositiveClick: async () => {
          const leaveSuccess = await leaveSpace(space.id)
          if (leaveSuccess) {
            message.success(`已离开工作区: ${space.name}`)
          }
        }
      })
      break

    case 'share':
      // TODO: 实现分享功能
      message.info('分享功能开发中')
      break

    case 'settings':
      selectedSpace.value = space
      showSpaceDrawer.value = true
      break
  }
}

const handleSpaceCreated = (space: unknown) => {
  showCreateDialog.value = false
  const spaceName = (space as { name?: string }).name || '工作区'
  message.success(`工作区创建成功: ${spaceName}`)
  refreshSpaces()
}

// 生命周期
onMounted(async () => {
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

  .header-actions {
    display: flex;
    gap: 8px;
  }
}

.search-section {
  padding: 12px 16px;
  background: var(--card-color);
  border-bottom: 1px solid var(--border-color);

  .filter-tags {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    align-items: center;

    &::-webkit-scrollbar {
      display: none;
    }

    .history-label {
      font-size: 12px;
      color: var(--text-color-3);
      margin-right: 4px;
      white-space: nowrap;
    }
  }
}

.content-area {
  flex: 1;
  overflow: hidden;
}

.spaces-content {
  min-height: 100%;
  padding: 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 32px 16px;
  text-align: center;
}

.search-header {
  padding: 8px 16px;
  margin-bottom: 8px;

  .search-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }
}

.spaces-list {
  .sort-bar {
    display: flex;
    justify-content: flex-end;
    padding: 8px 16px;
  }

  .space-scroller {
    min-height: calc(100vh - 200px);
  }

  .space-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    margin-bottom: 8px;
    background: var(--card-color);
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;

    &:hover {
      background: var(--card-color-hover);
      border-color: var(--primary-color-hover);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(var(--hula-black-rgb), 0.08);
    }

    &:active {
      transform: scale(0.98);
    }

    &.first-item {
      margin-top: 0;
    }
  }

  .load-more {
    padding: 16px;
    text-align: center;
  }

  .end-hint {
    padding: 24px;
    text-align: center;
  }
}

.space-avatar {
  position: relative;
  flex-shrink: 0;

  .unread-badge {
    position: absolute;
    top: -2px;
    right: -2px;
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
    border: 1px solid var(--card-color);
  }

  .encrypted-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 18px;
    height: 18px;
    background: var(--success-color);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--card-color);
    color: white;
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
      flex: 1;
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
    gap: 16px;
    margin-bottom: 8px;
    flex-wrap: wrap;

    span {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--text-color-3);
    }
  }

  .member-preview {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;

    .more-members {
      font-size: 12px;
      color: var(--text-color-3);
      margin-left: 4px;
    }
  }
}

.space-actions {
  flex-shrink: 0;
  align-self: center;
}

.filter-section {
  margin-bottom: 24px;

  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color-1);
  }
}

// 触摸优化
@media (hover: none) {
  .space-item {
    &:hover {
      background: var(--card-color);
      border-color: transparent;
      transform: none;
      box-shadow: none;
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

    .space-info {
      .space-name-row .space-name {
        font-size: 15px;
      }

      .space-topic {
        font-size: 13px;
      }
    }
  }
}
</style>
