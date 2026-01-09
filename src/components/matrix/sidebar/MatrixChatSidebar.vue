<template>
  <div class="matrix-chat-sidebar">
    <!-- Sidebar header -->
    <div class="sidebar-header">
      <div class="header-title">
        <h3>{{ getSidebarTitle() }}</h3>
        <n-button quaternary size="small" @click="$emit('close')">
          <n-icon :component="X" />
        </n-button>
      </div>
      <n-tabs v-model:value="activeTab" type="segment" size="small">
        <n-tab-pane name="members" tab="成员">
          <n-badge :value="memberCount" :max="99" />
        </n-tab-pane>
        <n-tab-pane name="files" tab="文件">
          <n-badge :value="fileCount" :max="99" />
        </n-tab-pane>
        <n-tab-pane name="search" tab="搜索">
          <n-icon :component="Search" />
        </n-tab-pane>
        <n-tab-pane name="info" tab="信息">
          <n-icon :component="InfoCircle" />
        </n-tab-pane>
      </n-tabs>
    </div>

    <!-- Sidebar content -->
    <div class="sidebar-content">
      <!-- Members tab -->
      <div v-if="activeTab === 'members'" class="members-container">
        <n-virtual-list
          :items="virtualMemberItems"
          :item-size="54"
          :show-scrollbar="true"
          class="members-virtual-list"
          @scroll="handleMemberScroll">
          <template #default="{ item }">
            <template :key="item.id">
              <!-- Group header -->
              <div v-if="item.type === 'header'" class="member-group-header">
                <n-icon
                  :component="item.id === 'header-online' ? Radio : Circle"
                  :color="item.id === 'header-online' ? 'var(--n-success-color)' : 'var(--n-text-color-3)'" />
                <span>{{ item.label }}</span>
              </div>

              <!-- Member item -->
              <div
                v-else-if="item.type === 'member' && item.data"
                class="member-item"
                :class="{ online: item.data.presence === 'online', offline: item.data.presence !== 'online' }"
                @click="handleMemberClick(item.data)">
                <n-avatar
                  :src="item.data.avatarUrl"
                  round
                  :size="32"
                  @error="(e) => ((e.target as HTMLImageElement).src = '')">
                  {{ getMemberInitials(item.data) }}
                </n-avatar>
                <div class="member-info">
                  <span class="member-name">{{ item.data.displayName || item.data.userId }}</span>
                  <span class="member-status">{{ item.data.presence === 'online' ? '在线' : '离线' }}</span>
                </div>
                <div class="member-actions">
                  <n-dropdown
                    :options="getMemberMenuOptions(item.data)"
                    placement="bottom-end"
                    @select="(key: string) => handleMemberAction(key, item.data)">
                    <n-button quaternary size="small">
                      <n-icon :component="DotsVertical" />
                    </n-button>
                  </n-dropdown>
                </div>
              </div>
            </template>
          </template>
        </n-virtual-list>

        <!-- Loading more indicator -->
        <div v-if="loadingMoreMembers" class="loading-more">
          <n-spin size="small" />
          <span>加载更多成员...</span>
        </div>

        <!-- Invite member button -->
        <div class="invite-section">
          <n-button type="primary" dashed block @click="handleInviteMember">
            <template #icon>
              <n-icon :component="UserPlus" />
            </template>
            邀请成员
          </n-button>
        </div>
      </div>

      <!-- Files tab -->
      <div v-else-if="activeTab === 'files'" class="files-container">
        <div class="files-filter">
          <n-select v-model:value="fileFilter" :options="fileFilterOptions" size="small" />
        </div>

        <div v-if="loadingFiles" class="files-loading">
          <n-spin size="medium" />
        </div>

        <div v-else-if="filteredFiles.length === 0" class="files-empty">
          <n-empty description="暂无文件" />
        </div>

        <div v-else class="files-list">
          <div v-for="file in filteredFiles" :key="file.id" class="file-item" @click="handleFileClick(file)">
            <div class="file-icon" :style="{ color: getFileIconColor(file.mimeType) }">
              <n-icon :component="getFileIcon(file.mimeType)" :size="32" />
            </div>
            <div class="file-info">
              <div class="file-name">{{ file.name }}</div>
              <div class="file-meta">
                <span>{{ formatFileSize(file.size) }}</span>
                <span>{{ formatTime(file.timestamp) }}</span>
              </div>
            </div>
            <div class="file-actions">
              <n-button quaternary size="small" @click.stop="handleFileDownload(file)">
                <n-icon :component="Download" />
              </n-button>
            </div>
          </div>
        </div>
      </div>

      <!-- Search tab -->
      <div v-else-if="activeTab === 'search'" class="search-container">
        <div class="search-input">
          <n-input
            v-model:value="searchQuery"
            type="text"
            placeholder="搜索消息..."
            clearable
            @keyup.enter="searchRoom(searchQuery)">
            <template #prefix>
              <n-icon :component="Search" />
            </template>
          </n-input>
          <n-button type="primary" :loading="searching" @click="searchRoom(searchQuery)">搜索</n-button>
        </div>

        <div v-if="searchResults.length === 0 && !searching" class="search-empty">
          <n-empty description="输入关键词搜索消息" />
        </div>

        <div v-else class="search-results">
          <div class="search-summary" v-if="searchTotal > 0">找到 {{ searchTotal }} 条结果</div>

          <div
            v-for="result in searchResults"
            :key="result.id"
            class="search-result-item"
            @click="handleSearchResultClick(result)">
            <div class="result-header">
              <span class="result-sender">{{ result.userId?.split(':')[0] || '未知用户' }}</span>
              <span class="result-time">{{ formatTime(result.timestamp) }}</span>
            </div>
            <div class="result-content" v-html="highlightSearchText(result.content || '')"></div>
          </div>
        </div>
      </div>

      <!-- Room info tab -->
      <div v-else-if="activeTab === 'info'" class="info-container">
        <div v-if="roomInfo" class="room-info">
          <div class="info-section">
            <h4>房间名称</h4>
            <p>{{ roomInfo.name }}</p>
          </div>

          <div class="info-section" v-if="roomInfo.topic">
            <h4>房间主题</h4>
            <p>{{ roomInfo.topic }}</p>
          </div>

          <div class="info-section">
            <h4>房间信息</h4>
            <div class="info-item">
              <span>成员数量:</span>
              <span>{{ roomInfo.memberCount }}</span>
            </div>
            <div class="info-item">
              <span>加密:</span>
              <span>{{ roomInfo.isEncrypted ? '是' : '否' }}</span>
            </div>
            <div class="info-item">
              <span>类型:</span>
              <span>{{ roomInfo.isDirect ? '私聊' : '群聊' }}</span>
            </div>
          </div>

          <div class="info-actions" v-if="isAdmin">
            <n-button @click="handleRoomSettings">房间设置</n-button>
          </div>
        </div>

        <n-spin v-else size="large" />
      </div>
    </div>

    <!-- Modals -->
    <n-modal v-model:show="showInviteModal" preset="card" title="邀请成员" @close="showInviteModal = false">
      <MatrixInviteMember :room-id="roomId" @invited="handleInviteSent" @close="showInviteModal = false" />
    </n-modal>

    <n-modal v-model:show="showUserProfile" preset="card" title="成员资料" @close="showUserProfile = false">
      <MatrixUserProfile
        :visible="showUserProfile"
        :member="selectedMember"
        :room-id="roomId"
        @update:visible="showUserProfile = false" />
    </n-modal>

    <n-modal
      v-model:show="showPowerLevelEditor"
      preset="card"
      title="权限设置"
      :mask-closable="true"
      @close="showPowerLevelEditor = false">
      <PowerLevelEditor
        :room-id="roomId"
        :readonly="false"
        @saved="handlePowerLevelsSaved"
        @cancelled="showPowerLevelEditor = false" />
    </n-modal>

    <n-modal
      v-model:show="showRoomSettingsModal"
      preset="card"
      title="房间设置"
      :mask-closable="true"
      @close="showRoomSettingsModal = false">
      <RoomSettings :room-id="roomId" @close="showRoomSettingsModal = false" @saved="handleRoomSettingsSaved" />
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import {
  NTabs,
  NTabPane,
  NBadge,
  NButton,
  NIcon,
  NAvatar,
  NDropdown,
  NInput,
  NSelect,
  NModal,
  NSpin,
  NEmpty,
  NVirtualList
} from 'naive-ui'
import { X, Search, InfoCircle, Radio, Circle, DotsVertical, UserPlus, Download } from '@vicons/tabler'
import { useMatrixChatSidebar } from './useMatrixChatSidebar'
import type { FileFilter } from './types'

// Components
import MatrixInviteMember from '../MatrixInviteMember.vue'
import MatrixUserProfile from '../MatrixUserProfile.vue'
import PowerLevelEditor from '@/components/rooms/PowerLevelEditor.vue'
import RoomSettings from '../RoomSettings.vue'

interface Props {
  roomId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  scrollToMessage: [eventId: string]
}>()

// Use composable
const {
  // State
  activeTab,
  fileFilter,
  searchQuery,
  searching,
  searchResults,
  searchTotal,
  showInviteModal,
  showUserProfile,
  showPowerLevelEditor,
  showRoomSettingsModal,
  selectedMember,
  loadingFiles,
  filteredFiles,
  loadingMoreMembers,
  roomInfo,

  // Computed
  memberCount,
  fileCount,
  virtualMemberItems,
  isAdmin,

  // Methods
  initialize,
  cleanup,
  handleMemberScroll,
  getMemberInitials,
  getMemberMenuOptions,
  handleMemberClick,
  handleMemberAction,
  handleInviteMember,
  handleInviteSent,
  handleFileClick,
  handleFileDownload,
  getFileIcon,
  formatFileSize,
  formatTime,
  searchRoom,
  highlightSearchText,
  handleSearchResultClick,
  handlePowerLevelsSaved,
  handleRoomSettingsSaved,
  handleRoomSettings
} = useMatrixChatSidebar({
  roomId: props.roomId,
  onScrollToMessage: (eventId) => emit('scrollToMessage', eventId),
  onClose: () => emit('close')
})

// File filter options
const fileFilterOptions: { label: string; value: FileFilter }[] = [
  { label: '全部文件', value: 'all' },
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
  { label: '音频', value: 'audio' },
  { label: '文档', value: 'file' }
]

const getFileIconColor = (mimeType = ''): string => {
  if (mimeType.startsWith('image/')) return 'var(--hula-brand-primary)'
  if (mimeType.startsWith('video/')) return 'var(--hula-brand-primary)'
  if (mimeType.startsWith('audio/')) return 'var(--hula-brand-primary)'
  return 'var(--hula-brand-primary)'
}

const getSidebarTitle = () => {
  const titles = {
    members: '房间成员',
    files: '共享文件',
    search: '搜索消息',
    info: '房间信息'
  }
  return titles[activeTab.value as keyof typeof titles]
}

// Lifecycle
onMounted(() => {
  initialize()
})

onUnmounted(() => {
  cleanup()
})
</script>

<style scoped lang="scss">
.matrix-chat-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--n-color);
  border-left: 1px solid var(--n-border-color);
}

.sidebar-header {
  padding: 12px;
  border-bottom: 1px solid var(--n-border-color);
}

.header-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
  }
}

.sidebar-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

// Members styles
.members-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.members-virtual-list {
  flex: 1;
}

.member-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--n-text-color-2);
  background: var(--n-color-modal);
}

.member-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: var(--n-color-hover);
  }

  &.online .member-status {
    color: var(--n-success-color);
  }

  &.offline .member-status {
    color: var(--n-text-color-3);
  }
}

.member-info {
  flex: 1;
  min-width: 0;
}

.member-name {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-status {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.member-actions {
  flex-shrink: 0;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  font-size: 13px;
  color: var(--n-text-color-2);
}

.invite-section {
  padding: 12px;
  border-top: 1px solid var(--n-border-color);
}

// Files styles
.files-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.files-filter {
  padding: 12px;
  border-bottom: 1px solid var(--n-border-color);
}

.files-loading,
.files-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.files-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: var(--n-color-hover);
  }
}

.file-icon {
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 4px;
}

.file-actions {
  flex-shrink: 0;
}

// Search styles
.search-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

.search-input {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.search-empty,
.search-results {
  flex: 1;
  overflow-y: auto;
}

.search-summary {
  padding: 8px 0;
  font-size: 13px;
  color: var(--n-text-color-2);
  font-weight: 500;
}

.search-result-item {
  padding: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: var(--n-color-hover);
  }

  &:not(:last-child) {
    border-bottom: 1px solid var(--n-border-color);
  }
}

.result-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.result-sender {
  font-size: 13px;
  font-weight: 500;
  color: var(--n-primary-color);
}

.result-time {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.result-content {
  font-size: 14px;
  color: var(--n-text-color-1);
  line-height: 1.5;
  word-break: break-word;
}

// Info styles
.info-container {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
}

.room-info {
  .info-section {
    margin-bottom: 24px;

    h4 {
      margin: 0 0 8px 0;
      font-size: 14px;
      font-weight: 500;
      color: var(--n-text-color-2);
    }

    p {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
    }
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 14px;

    span:first-child {
      color: var(--n-text-color-2);
    }

    span:last-child {
      font-weight: 500;
    }
  }

  .info-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
}
</style>
