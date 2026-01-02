<template>
  <div class="matrix-chat-sidebar">
    <!-- 侧边栏头部 -->
    <div class="sidebar-header">
      <div class="header-title">
        <h3>{{ getSidebarTitle() }}</h3>
        <n-button
          quaternary
          size="small"
          @click="$emit('close')"
        >
          <n-icon :component="X" />
        </n-button>
      </div>
      <n-tabs
        v-model:value="activeTab"
        type="segment"
        size="small"
      >
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

    <!-- 侧边栏内容 -->
    <div class="sidebar-content">
      <!-- 成员列表 (使用虚拟滚动) -->
      <div v-if="activeTab === 'members'" class="members-list-container">
        <n-virtual-list
          :items="virtualMemberItems"
          :item-size="54"
          :show-scrollbar="true"
          class="members-virtual-list"
          @scroll="handleMemberScroll"
        >
          <template #default="{ item }">
            <!-- 分组标题 -->
            <div v-if="item.type === 'header'" :key="item.id" class="member-group-header">
              <n-icon :component="item.id === 'header-online' ? Radio : Circle"
                :color="item.id === 'header-online' ? 'var(--n-success-color)' : 'var(--n-text-color-3)'" />
              <span>{{ item.label }}</span>
            </div>

            <!-- 成员项 -->
            <div
              v-else-if="item.type === 'member' && item.data"
              :key="item.id"
              class="member-item"
              :class="{ online: item.data.presence === 'online', offline: item.data.presence !== 'online' }"
              @click="handleMemberClick(item.data)"
            >
              <n-avatar
                v-bind="item.data.avatarUrl !== undefined ? { src: item.data.avatarUrl } : {}"
                round
                :size="32"
              >
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
                  @select="handleMemberAction($event, item.data)"
                >
                  <n-button quaternary size="small">
                    <n-icon :component="DotsVertical" />
                  </n-button>
                </n-dropdown>
              </div>
            </div>
          </template>
        </n-virtual-list>

        <!-- 加载更多指示器 -->
        <div v-if="loadingMoreMembers" class="loading-more">
          <n-spin size="small" />
          <span>加载更多成员...</span>
        </div>

        <!-- 邀请成员 -->
        <div class="invite-section">
          <n-button
            type="primary"
            dashed
            block
            @click="handleInviteMember"
          >
            <n-icon :component="UserPlus" />
            邀请成员
          </n-button>
        </div>
      </div>

      <!-- 文件列表 -->
      <div v-else-if="activeTab === 'files'" class="files-list">
        <!-- 文件类型过滤 -->
        <div class="file-filters">
          <n-button-group size="small">
            <n-button
              :type="fileFilter === 'all' ? 'primary' : 'default'"
              @click="fileFilter = 'all'"
            >
              全部
            </n-button>
            <n-button
              :type="fileFilter === 'image' ? 'primary' : 'default'"
              @click="fileFilter = 'image'"
            >
              图片
            </n-button>
            <n-button
              :type="fileFilter === 'document' ? 'primary' : 'default'"
              @click="fileFilter = 'document'"
            >
              文档
            </n-button>
            <n-button
              :type="fileFilter === 'video' ? 'primary' : 'default'"
              @click="fileFilter = 'video'"
            >
              视频
            </n-button>
            <n-button
              :type="fileFilter === 'audio' ? 'primary' : 'default'"
              @click="fileFilter = 'audio'"
            >
              音频
            </n-button>
          </n-button-group>
        </div>

        <!-- 文件列表 -->
        <div class="file-items">
          <div
            v-for="file in filteredFiles"
            :key="file.eventId"
            class="file-item"
            @click="handleFileClick(file)"
          >
            <div class="file-icon">
              <n-icon
                :component="getFileIcon(file.mimeType)"
                :size="24"
                :color="getFileIconColor(file.mimeType)"
              />
            </div>
            <div class="file-info">
              <span class="file-name">{{ file.name || '未命名文件' }}</span>
              <span class="file-meta">
                {{ formatFileSize(file.size || 0) }} • {{ formatTime(file.timestamp || 0) }}
              </span>
              <span class="file-sender">{{ file.senderId }}</span>
            </div>
            <div class="file-actions">
              <n-dropdown
                :options="getFileMenuOptions(file)"
                placement="bottom-end"
                @select="handleFileAction($event, file)"
              >
                <n-button quaternary size="small">
                  <n-icon :component="DotsVertical" />
                </n-button>
              </n-dropdown>
            </div>
          </div>
        </div>

        <!-- 加载更多 -->
        <div v-if="hasMoreFiles" class="load-more">
          <n-button
            text
            :loading="loadingFiles"
            @click="loadMoreFiles"
          >
            加载更多
          </n-button>
        </div>

        <!-- 空状态 -->
        <div v-if="filteredFiles.length === 0 && !loadingFiles" class="empty-state">
          <n-empty
            description="暂无文件"
            size="small"
          >
            <template #icon>
              <n-icon :component="Paperclip" />
            </template>
          </n-empty>
        </div>
      </div>

      <!-- 搜索 -->
      <div v-else-if="activeTab === 'search'" class="search-panel">
        <div class="search-input">
          <n-input
            v-model:value="searchQuery"
            placeholder="搜索消息..."
            clearable
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <n-icon :component="Search" />
            </template>
            <template #suffix>
              <n-button
                text
                size="small"
                :loading="searching"
                @click="handleSearch"
              >
                搜索
              </n-button>
            </template>
          </n-input>
        </div>

        <!-- 搜索选项 -->
        <div class="search-options">
          <n-form-item label="搜索范围">
            <n-checkbox-group v-model:value="searchOptions.scope">
              <n-checkbox value="messages">消息内容</n-checkbox>
              <n-checkbox value="files">文件名</n-checkbox>
              <n-checkbox value="users">用户名</n-checkbox>
            </n-checkbox-group>
          </n-form-item>
          <n-form-item label="时间范围">
            <n-select
              v-model:value="searchOptions.timeRange"
              :options="timeRangeOptions"
              size="small"
            />
          </n-form-item>
          <n-form-item label="发送者">
            <n-select
              v-model:value="searchOptions.sender"
              :options="memberOptions"
              size="small"
              placeholder="全部成员"
              clearable
            />
          </n-form-item>
        </div>

        <!-- 搜索结果 -->
        <div v-if="searchResults.length > 0" class="search-results">
          <div class="result-header">
            <span>找到 {{ searchTotal }} 条结果</span>
          </div>
          <div
            v-for="result in searchResults"
            :key="result.eventId"
            class="result-item"
            @click="handleSearchResultClick(result)"
          >
            <div class="result-content">
              <div class="result-header-info">
                <span class="result-sender">{{ result.senderName }}</span>
                <span class="result-time">{{ formatTime(result.timestamp) }}</span>
              </div>
              <div class="result-text" v-html="highlightSearchText(result.content)"></div>
            </div>
          </div>
        </div>

        <!-- 搜索中 -->
        <div v-else-if="searching" class="search-loading">
          <n-spin size="small">
            <template #description>搜索中...</template>
          </n-spin>
        </div>
      </div>

      <!-- 房间信息 -->
      <div v-else-if="activeTab === 'info'" class="info-panel">
        <!-- 基本信息 -->
        <div class="info-section">
          <h4>房间信息</h4>
          <div class="info-item">
            <span class="info-label">房间ID</span>
            <span class="info-value">{{ roomId }}</span>
            <n-button
              text
              size="small"
              @click="copyToClipboard(roomId)"
            >
              <n-icon :component="Copy" />
            </n-button>
          </div>
          <div class="info-item">
            <span class="info-label">创建时间</span>
            <span class="info-value">{{ formatDate(roomInfo?.created) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">创建者</span>
            <span class="info-value">{{ roomInfo?.creator }}</span>
          </div>
        </div>

        <!-- 权限设置 -->
        <div v-if="isAdmin" class="info-section">
          <h4>权限设置</h4>
          <div class="permission-item">
            <span>加密聊天</span>
            <n-switch v-model:value="roomSettings.encryption" />
          </div>
          <div class="permission-item">
            <span>允许邀请</span>
            <n-switch v-model:value="roomSettings.allowInvites" />
          </div>
          <div class="permission-item">
            <span>访客可查看历史</span>
            <n-switch v-model:value="roomSettings.guestCanSeeHistory" />
          </div>
          <div class="permission-item">
            <span>需要邀请才能加入</span>
            <n-switch v-model:value="roomSettings.joinRule" />
          </div>
        </div>

        <!-- 通知设置 -->
        <div class="info-section">
          <h4>通知设置</h4>
          <div class="notification-item">
            <span>消息通知</span>
            <n-switch v-model:value="notificationSettings.enabled" />
          </div>
          <div class="notification-item">
            <span>声音提醒</span>
            <n-switch v-model:value="notificationSettings.sound" />
          </div>
          <div class="notification-item">
            <span>包含@所有人时提醒</span>
            <n-switch v-model:value="notificationSettings.mentionAll" />
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="info-actions">
          <n-button
            v-if="isAdmin"
            type="primary"
            block
            @click="handleRoomSettings"
          >
            房间设置
          </n-button>
          <n-button
            type="error"
            block
            @click="handleLeaveRoom"
          >
            退出房间
          </n-button>
        </div>
      </div>
    </div>

    <!-- 邀请成员弹窗 -->
    <n-modal
      v-model:show="showInviteModal"
      preset="dialog"
      title="邀请新成员"
      style="width: 500px"
    >
      <MatrixInviteMember
        :room-id="roomId"
        @invite="handleInviteSent"
        @cancel="showInviteModal = false"
      />
    </n-modal>

    <!-- 用户资料弹窗 -->
    <MatrixUserProfile
      :visible="showUserProfile"
      :member="selectedMember"
      :room-id="roomId"
      :show-devices="true"
      @update:visible="showUserProfile = $event"
      @start-dm="handleStartDM"
      @kick="handleKickMember"
      @ban="handleBanMember"
      @modify-power="handleModifyPower"
    />

    <!-- 权限级别编辑器弹窗 -->
    <n-modal
      v-model:show="showPowerLevelEditor"
      preset="card"
      title="权限设置"
      style="width: 700px; max-height: 80vh"
      :mask-closable="true"
      @close="showPowerLevelEditor = false"
    >
      <PowerLevelEditor
        :room-id="roomId"
        :readonly="false"
        @saved="handlePowerLevelsSaved"
        @cancelled="showPowerLevelEditor = false"
      />
    </n-modal>

    <!-- 房间设置弹窗 -->
    <n-modal
      v-model:show="showRoomSettingsModal"
      preset="card"
      title="房间设置"
      style="width: 800px; max-height: 85vh"
      :mask-closable="true"
      @close="showRoomSettingsModal = false"
    >
      <RoomSettings
        :room-id="roomId"
        @close="showRoomSettingsModal = false"
        @saved="handleRoomSettingsSaved"
      />
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import {
  NTabs,
  NTabPane,
  NBadge,
  NButton,
  NButtonGroup,
  NIcon,
  NAvatar,
  NDropdown,
  NInput,
  NFormItem,
  NCheckboxGroup,
  NCheckbox,
  NSelect,
  NSwitch,
  NModal,
  NSpin,
  NEmpty,
  NVirtualList,
  useMessage,
  type DropdownOption
} from 'naive-ui'
import {
  X,
  Search,
  InfoCircle,
  Radio,
  Circle,
  DotsVertical,
  UserPlus,
  Paperclip,
  File,
  Photo,
  Video,
  Music,
  Copy,
  Folder,
  Download,
  Trash
} from '@vicons/tabler'
import { matrixRoomManager } from '@/services/matrixRoomManager'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import { sanitizeHighlightHtml } from '@/utils/htmlSanitizer'
import { useUserStore } from '@/stores/user'
import type { MatrixMember, MatrixFile, MatrixRoom, SearchResult } from '@/types/matrix'

// Components
import MatrixInviteMember from './MatrixInviteMember.vue'
import MatrixUserProfile from './MatrixUserProfile.vue'
import PowerLevelEditor from '@/components/rooms/PowerLevelEditor.vue'
import RoomSettings from './RoomSettings.vue'

interface Props {
  roomId: string
  show: boolean
}

// Menu option for dropdown menus
interface MenuOption {
  label: string
  key: string
  icon: unknown
  [key: string]: unknown
}

// Virtual list item type
interface VirtualListItem {
  type: 'header' | 'member'
  id: string
  data?: MatrixMember
  label?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  scrollToMessage: [eventId: string]
}>()

const message = useMessage()
const userStore = useUserStore()

// State
const activeTab = ref('members')
const fileFilter = ref('all')
const searchQuery = ref('')
const searching = ref(false)
const searchResults = ref<SearchResult[]>([])
const searchTotal = ref(0)
const showInviteModal = ref(false)
const showUserProfile = ref(false)
const showPowerLevelEditor = ref(false)
const showRoomSettingsModal = ref(false)
const selectedMember = ref<MatrixMember | null>(null)
const members = ref<MatrixMember[]>([])
const files = ref<MatrixFile[]>([])
const roomInfo = ref<MatrixRoom | null>(null)
const loadingFiles = ref(false)
const hasMoreFiles = ref(false)

// Pagination state for members
const memberOffset = ref(0)
const memberLimit = ref(50)
const loadingMoreMembers = ref(false)
const hasMoreMembers = ref(false)

// Options
const searchOptions = ref({
  scope: ['messages'],
  timeRange: 'all',
  sender: null
})

const timeRangeOptions = [
  { label: '全部时间', value: 'all' },
  { label: '今天', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '自定义', value: 'custom' }
]

// Settings
const roomSettings = ref({
  encryption: true,
  allowInvites: true,
  guestCanSeeHistory: false,
  joinRule: false
})

const notificationSettings = ref({
  enabled: true,
  sound: true,
  mentionAll: true
})

// Computed
const memberCount = computed(() => members.value.length)
const fileCount = computed(() => files.value.length)

const onlineMembers = computed<MatrixMember[]>(() => members.value.filter((m) => m.presence === 'online'))

const offlineMembers = computed<MatrixMember[]>(() => members.value.filter((m) => m.presence !== 'online'))

// Virtual list items for members
const virtualMemberItems = computed<VirtualListItem[]>(() => {
  const items: VirtualListItem[] = []

  // Add online section header
  if (onlineMembers.value.length > 0) {
    items.push({
      type: 'header',
      id: 'header-online',
      label: `在线 (${onlineMembers.value.length})`
    })
    // Add online members
    for (const member of onlineMembers.value) {
      items.push({
        type: 'member',
        id: member.userId,
        data: member
      })
    }
  }

  // Add offline section header
  if (offlineMembers.value.length > 0) {
    items.push({
      type: 'header',
      id: 'header-offline',
      label: `离线 (${offlineMembers.value.length})`
    })
    // Add offline members
    for (const member of offlineMembers.value) {
      items.push({
        type: 'member',
        id: member.userId,
        data: member
      })
    }
  }

  return items
})

const filteredFiles = computed(() => {
  if (fileFilter.value === 'all') return files.value

  const mimeTypeMap = {
    image: ['image/'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument'],
    video: ['video/'],
    audio: ['audio/']
  }

  const mimeTypes = mimeTypeMap[fileFilter.value as keyof typeof mimeTypeMap]
  if (!mimeTypes) return files.value

  return files.value.filter((file) => mimeTypes.some((mime) => (file.mimeType || '').startsWith(mime)))
})

const memberOptions = computed(() =>
  members.value.map((member) => ({
    label: member.displayName || member.userId,
    value: member.userId
  }))
)

const isAdmin = computed(() => {
  const currentUserId = (userStore as { userInfo?: { userId?: string } }).userInfo?.userId
  const currentUser = members.value.find((m) => m.userId === currentUserId)
  return currentUser?.powerLevel && currentUser.powerLevel >= 50
})

// Methods
const getSidebarTitle = () => {
  const titles = {
    members: '房间成员',
    files: '共享文件',
    search: '搜索消息',
    info: '房间信息'
  }
  return titles[activeTab.value as keyof typeof titles]
}

const getMemberInitials = (member: MatrixMember): string => {
  const name = member.displayName || member.userId
  if (!name) return '?'

  const names = name.split(' ')
  if (names.length >= 2) {
    return (names[0]?.[0] || '') + (names[1]?.[0] || '')
  }
  return name.substring(0, 2).toUpperCase()
}

const getMemberMenuOptions = (member: MatrixMember) => {
  const options = [
    {
      label: '查看资料',
      key: 'profile'
    },
    {
      label: '发送私信',
      key: 'dm'
    }
  ]

  const currentUserId = (userStore as { userInfo?: { userId?: string } }).userInfo?.userId
  if (isAdmin.value && member.userId !== currentUserId) {
    options.push(
      {
        label: '设为管理员',
        key: 'admin'
      },
      {
        label: '移出房间',
        key: 'remove'
      }
    )
  }

  return options
}

const getFileIcon = (mimeType?: string) => {
  const mt = mimeType || ''
  if (mt.startsWith('image/')) return Photo
  if (mt.startsWith('video/')) return Video
  if (mt.startsWith('audio/')) return Music
  return File
}

const getFileIconColor = (mimeType?: string) => {
  const mt = mimeType || ''
  if (mt.startsWith('image/')) return '#4CAF50'
  if (mt.startsWith('video/')) return '#2196F3'
  if (mt.startsWith('audio/')) return '#FF9800'
  return '#607D8B'
}

const getFileMenuOptions = (_file: MatrixFile): DropdownOption[] => [
  {
    label: '下载',
    key: 'download',
    icon: () => h(Download)
  },
  {
    label: '在文件夹中显示',
    key: 'showInFolder',
    icon: () => h(Folder)
  },
  {
    label: '删除',
    key: 'delete',
    icon: () => h(Trash)
  }
]

const handleMemberClick = (member: MatrixMember) => {
  selectedMember.value = member
  showUserProfile.value = true
}

const handleMemberAction = async (action: string, member: MatrixMember) => {
  switch (action) {
    case 'profile':
      selectedMember.value = member
      showUserProfile.value = true
      break
    case 'dm':
      await handleStartDM(member.userId)
      break
    case 'admin':
      // Open power level editor to modify user permissions
      showPowerLevelEditor.value = true
      break
    case 'remove':
      await handleKickMember(member)
      break
  }
}

// User profile actions
const handleStartDM = async (userId: string) => {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      message.error('Matrix 客户端未初始化')
      return
    }

    // Create DM room or open existing one
    const createRoomMethod = client.createRoom as
      | ((options: Record<string, unknown>) => Promise<{ room_id: string }>)
      | undefined

    if (!createRoomMethod) {
      message.error('创建私聊功能不可用')
      return
    }

    // Check if DM room already exists
    const getRoomsMethod = client.getRooms as (() => Record<string, unknown>[]) | undefined
    const rooms = getRoomsMethod?.() || []

    let existingRoomId: string | null = null
    for (const room of rooms) {
      const r = room as Record<string, unknown>
      const getRoomMembersMethod = r.getJoinedMembers as (() => MatrixMember[]) | undefined
      const members = getRoomMembersMethod?.() || []

      // Check if this is a DM room with the target user
      if (members.length === 2) {
        const hasTargetUser = members.some((m: MatrixMember) => m.userId === userId)
        const hasCurrentUser = members.some((m: MatrixMember) => m.userId === userStore.userInfo?.uid)
        if (hasTargetUser && hasCurrentUser) {
          const roomIdMethod = r.roomId as (() => string) | undefined
          existingRoomId = roomIdMethod?.() || null
          break
        }
      }
    }

    if (existingRoomId) {
      // Emit event to switch to existing DM room
      message.success('已打开私聊')
    } else {
      // Create new DM room
      const result = await createRoomMethod({
        preset: 'trusted_private_chat',
        invite: [userId],
        is_direct: true
      })

      message.success('已创建私聊')
      logger.info('[MatrixChatSidebar] Created DM room', { roomId: result.room_id, userId })
    }
  } catch (error) {
    logger.error('[MatrixChatSidebar] Failed to start DM:', error)
    message.error('创建私聊失败：' + (error instanceof Error ? error.message : String(error)))
  }
}

const handleKickMember = async (member: MatrixMember) => {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      message.error('Matrix 客户端未初始化')
      return
    }

    const kickMethod = client.kick as
      | ((roomId: string, userId: string, reason?: string) => Promise<unknown>)
      | undefined

    if (!kickMethod) {
      message.error('移除成员功能不可用')
      return
    }

    await kickMethod(props.roomId, member.userId)
    message.success(`${member.displayName || member.userId} 已被移除`)

    // Refresh member list
    await loadMembers()
  } catch (error) {
    logger.error('[MatrixChatSidebar] Failed to kick member:', error)
    message.error('移除成员失败：' + (error instanceof Error ? error.message : String(error)))
  }
}

const handleBanMember = async (member: MatrixMember) => {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      message.error('Matrix 客户端未初始化')
      return
    }

    const banMethod = client.ban as ((roomId: string, userId: string, reason?: string) => Promise<unknown>) | undefined

    if (!banMethod) {
      message.error('封禁成员功能不可用')
      return
    }

    await banMethod(props.roomId, member.userId)
    message.success(`${member.displayName || member.userId} 已被封禁`)

    // Refresh member list
    await loadMembers()
  } catch (error) {
    logger.error('[MatrixChatSidebar] Failed to ban member:', error)
    message.error('封禁成员失败：' + (error instanceof Error ? error.message : String(error)))
  }
}

const handleModifyPower = (member: MatrixMember) => {
  // Open power level editor dialog to modify member permissions
  selectedMember.value = member
  showPowerLevelEditor.value = true
}

const handlePowerLevelsSaved = () => {
  showPowerLevelEditor.value = false
  message.success('权限设置已保存')
  // Reload member list to reflect updated power levels
  loadMembers()
}

const handleRoomSettingsSaved = () => {
  showRoomSettingsModal.value = false
  message.success('房间设置已保存')
  // Reload room info
  const summary = matrixRoomManager.getRoomSummary(props.roomId)
  roomInfo.value = summary
    ? {
        roomId: summary.roomId || '',
        name: summary.name || '',
        topic: summary.topic || '',
        avatar: summary.avatar || '',
        type: summary.type || '',
        encrypted: summary.encrypted || false,
        joinRule: 'public',
        guestAccess: 'forbidden',
        historyVisibility: 'shared',
        memberCount: summary.memberCount || 0,
        isSpace: summary.type === 'm.space'
      }
    : null
}

// Load members from room (with pagination)
const loadMembers = async () => {
  try {
    // For initial load, use paginated approach with lazy loading
    memberOffset.value = 0
    const result = await matrixRoomManager.getRoomMembersPaginated(props.roomId, {
      limit: memberLimit.value,
      offset: 0,
      includeOffline: true
    })

    members.value = result.members
    hasMoreMembers.value = result.hasMore

    logger.info('[MatrixChatSidebar] Loaded members', {
      count: result.members.length,
      total: result.total,
      hasMore: result.hasMore
    })
  } catch (error) {
    logger.error('[MatrixChatSidebar] Failed to load members:', error)
    message.error('加载成员列表失败')
  }
}

// Load more members (pagination)
const loadMoreMembers = async () => {
  if (loadingMoreMembers.value || !hasMoreMembers.value) return

  loadingMoreMembers.value = true
  try {
    const newOffset = memberOffset.value + memberLimit.value
    const result = await matrixRoomManager.getRoomMembersPaginated(props.roomId, {
      limit: memberLimit.value,
      offset: newOffset,
      includeOffline: true
    })

    // Append new members
    members.value = [...members.value, ...result.members]
    memberOffset.value = newOffset
    hasMoreMembers.value = result.hasMore

    logger.info('[MatrixChatSidebar] Loaded more members', {
      added: result.members.length,
      total: members.value.length
    })
  } catch (error) {
    logger.error('[MatrixChatSidebar] Failed to load more members:', error)
    message.error('加载更多成员失败')
  } finally {
    loadingMoreMembers.value = false
  }
}

// Handle virtual list scroll to load more
const handleMemberScroll = (e: Event) => {
  const target = e.target as HTMLElement
  const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight

  // Load more when near bottom (within 100px)
  if (scrollBottom < 100 && hasMoreMembers.value && !loadingMoreMembers.value) {
    loadMoreMembers()
  }
}

const handleInviteMember = () => {
  showInviteModal.value = true
}

const handleInviteSent = () => {
  showInviteModal.value = false
  message.success('邀请已发送')
}

const handleFileClick = async (file: MatrixFile) => {
  try {
    // Try to open the file URL in a new tab
    if (file.url) {
      window.open(file.url, '_blank')
    } else {
      message.warning('文件链接不可用')
    }
  } catch (error) {
    logger.error('[MatrixChatSidebar] Failed to open file:', error)
    message.error('打开文件失败')
  }
}

const handleFileAction = async (action: string, file: MatrixFile) => {
  switch (action) {
    case 'download':
      try {
        if (file.url) {
          // Create a download link and click it
          const link = document.createElement('a')
          link.href = file.url
          link.download = file.name || 'download'
          link.target = '_blank'
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          message.success('开始下载文件')
        } else {
          message.warning('文件链接不可用')
        }
      } catch (error) {
        logger.error('[MatrixChatSidebar] Failed to download file:', error)
        message.error('下载文件失败')
      }
      break
    case 'showInFolder':
      // This requires Tauri API for desktop platforms
      message.info('在文件夹中显示功能需要 Tauri 桌面环境支持')
      break
    case 'delete':
      try {
        // Redact the message event to "delete" the file
        const client = matrixClientService.getClient()
        if (!client) {
          message.error('Matrix 客户端未初始化')
          return
        }

        const redactMethod = client.redactEvent as ((roomId: string, eventId: string) => Promise<unknown>) | undefined

        if (!redactMethod) {
          message.error('删除文件功能不可用')
          return
        }

        if (!file.eventId) {
          message.error('文件事件ID无效')
          return
        }

        await redactMethod(props.roomId, file.eventId)
        message.success('文件已删除')

        // Remove from local file list
        const index = files.value.findIndex((f) => f.eventId === file.eventId)
        if (index > -1) {
          files.value.splice(index, 1)
        }
      } catch (error) {
        logger.error('[MatrixChatSidebar] Failed to delete file:', error)
        message.error('删除文件失败')
      }
      break
  }
}

const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatDate = (timestamp?: number | string): string => {
  if (!timestamp) return '未知'
  const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(String(timestamp))
  return date.toLocaleDateString('zh-CN')
}

const handleSearch = async () => {
  if (!searchQuery.value.trim()) return

  searching.value = true
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      message.error('Matrix 客户端未初始化')
      return
    }

    // Use Matrix search API
    const searchMethod = client.searchRooms as
      | ((options: { roomFilter?: { roomId: string }[]; searchTerms: { rooms?: string[]; text?: string } }) => Promise<{
          results?: Array<{
            result?: {
              event_id?: string
              room_id?: string
              sender?: string
              origin_server_ts?: number
              type?: string
              content?: Record<string, unknown>
            }
          }>
          count?: number
        }>)
      | undefined

    if (!searchMethod) {
      message.error('搜索功能不可用')
      return
    }

    const result = await searchMethod({
      roomFilter: [{ roomId: props.roomId }],
      searchTerms: {
        rooms: [props.roomId],
        text: searchQuery.value
      }
    })

    // Transform results
    searchResults.value = (result.results || []).map((r) => {
      const event = r.result || {}
      const content = (event.content || {}) as Record<string, unknown>
      // 检查是否为加密消息 (m.room.encrypted 类型)
      const eventType = (event.type as string) || ''
      return {
        eventId: (event.event_id as string) || '',
        roomId: (event.room_id as string) || props.roomId,
        senderId: (event.sender as string) || '',
        senderName: (event.sender as string)?.split(':')[0]?.replace(/^@/, '') || (event.sender as string) || '',
        timestamp: (event.origin_server_ts as number) || 0,
        content: (content.body as string) || JSON.stringify(content),
        encrypted: eventType === 'm.room.encrypted'
      }
    })
    searchTotal.value = result.count || searchResults.value.length

    logger.info('[MatrixChatSidebar] Search completed', {
      query: searchQuery.value,
      results: searchTotal.value
    })
  } catch (error) {
    logger.error('[MatrixChatSidebar] Search failed:', error)
    message.error('搜索失败：' + (error instanceof Error ? error.message : String(error)))
    searchResults.value = []
    searchTotal.value = 0
  } finally {
    searching.value = false
  }
}

const highlightSearchText = (text: string): string => {
  if (!searchQuery.value) return text
  // Use sanitizeHighlightHtml to safely highlight search terms
  return sanitizeHighlightHtml(text, searchQuery.value)
}

const handleSearchResultClick = (result: SearchResult) => {
  // Emit event to scroll to the message
  emit('scrollToMessage', result.eventId)
  emit('close')
  logger.info('[MatrixChatSidebar] Scrolling to message', { eventId: result.eventId })
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    message.success('已复制到剪贴板')
  } catch (error) {
    message.error('复制失败')
  }
}

const handleRoomSettings = () => {
  showRoomSettingsModal.value = true
}

const handleLeaveRoom = async () => {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      message.error('Matrix 客户端未初始化')
      return
    }

    const leaveMethod = client.leave as ((roomId: string) => Promise<unknown>) | undefined

    if (!leaveMethod) {
      message.error('退出房间功能不可用')
      return
    }

    // Confirm before leaving
    const confirm = window.confirm('确定要退出此房间吗？')
    if (!confirm) return

    await leaveMethod(props.roomId)
    message.success('已退出房间')
    emit('close')

    logger.info('[MatrixChatSidebar] Left room', { roomId: props.roomId })
  } catch (error) {
    logger.error('[MatrixChatSidebar] Failed to leave room:', error)
    message.error('退出房间失败：' + (error instanceof Error ? error.message : String(error)))
  }
}

const loadMoreFiles = async () => {
  loadingFiles.value = true
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      message.error('Matrix 客户端未初始化')
      return
    }

    const getRoomMethod = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
    const room = getRoomMethod?.(props.roomId)
    if (!room) {
      message.error('房间不存在')
      return
    }

    // For now, this is a placeholder implementation
    // A full implementation would:
    // 1. Use room.timeline() to paginate through events
    // 2. Filter for m.room.message events with msgtype in {m.image, m.file, m.video, m.audio}
    // 3. Extract file metadata and add to files array
    logger.info('[MatrixChatSidebar] Loading more files (placeholder)', { roomId: props.roomId })
    hasMoreFiles.value = false
  } catch (error) {
    logger.error('[MatrixChatSidebar] Failed to load more files:', error)
    message.error('加载更多文件失败')
  } finally {
    loadingFiles.value = false
  }
}

// Lifecycle
onMounted(async () => {
  // Load room data
  members.value = await matrixRoomManager.getRoomMembers(props.roomId)

  // 获取房间文件需要遍历房间事件来查找 m.file, m.image, m.audio, m.video 类型的消息
  // 这是一个较重的操作，需要分页实现。当前使用空列表作为占位符。
  // 完整实现需要在 matrixRoomManager 中添加 getRoomFiles 方法，该方法应：
  // 1. 遍历房间时间线事件
  // 2. 过滤出包含媒体文件的消息事件
  // 3. 支持分页以避免一次性加载所有事件
  files.value = []

  // 使用 getRoomSummary 获取房间信息
  const summary = matrixRoomManager.getRoomSummary(props.roomId)
  roomInfo.value = summary
    ? {
        roomId: summary.roomId || '',
        name: summary.name || '',
        topic: summary.topic || '',
        avatar: summary.avatar || '',
        type: summary.type || '',
        encrypted: summary.encrypted || false,
        joinRule: 'public',
        guestAccess: 'forbidden',
        historyVisibility: 'shared',
        memberCount: summary.memberCount || 0,
        isSpace: summary.type === 'm.space'
      }
    : null
  hasMoreFiles.value = files.value.length >= 50
})
</script>

<style scoped>
.matrix-chat-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--n-color);
  border-left: 1px solid var(--n-border-color);
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--n-border-color);
}

.header-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.header-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* Members - Virtual List */
.members-list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.members-virtual-list {
  flex: 1;
  min-height: 0;
}

.member-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 8px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--n-text-color-3);
  text-transform: uppercase;
  background: var(--n-color);
  position: sticky;
  top: 0;
  z-index: 1;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  height: 54px;
  box-sizing: border-box;
}

.member-item:hover {
  background: var(--n-hover-color);
}

.member-item.online .member-status {
  color: var(--n-success-color);
}

.member-item.offline .member-status {
  color: var(--n-text-color-3);
}

.member-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.member-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-status {
  font-size: 12px;
}

.member-actions {
  opacity: 0;
  transition: opacity 0.2s;
}

.member-item:hover .member-actions {
  opacity: 1;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  font-size: 12px;
  color: var(--n-text-color-3);
  background: var(--n-color);
  border-top: 1px solid var(--n-border-color);
}

.invite-section {
  padding: 12px 0;
  border-top: 1px solid var(--n-border-color);
}

/* Files */
.files-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.file-filters {
  display: flex;
  justify-content: center;
}

.file-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.file-item:hover {
  background: var(--n-hover-color);
}

.file-icon {
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.file-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.file-sender {
  font-size: 12px;
  color: var(--n-text-color-2);
}

.file-actions {
  opacity: 0;
  transition: opacity 0.2s;
}

.file-item:hover .file-actions {
  opacity: 1;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 16px;
}

/* Search */
.search-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-input {
  position: sticky;
  top: 0;
  background: var(--n-color);
  padding-bottom: 8px;
}

.search-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--n-hover-color);
  border-radius: 8px;
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-header {
  font-size: 12px;
  color: var(--n-text-color-3);
  padding: 8px 0;
}

.result-item {
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.result-item:hover {
  background: var(--n-hover-color);
}

.result-header-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.result-sender {
  font-weight: 500;
  font-size: 12px;
}

.result-time {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.result-text {
  font-size: 14px;
  line-height: 1.4;
}

.result-text :deep(mark) {
  background: rgba(var(--n-warning-color-rgb), 0.3);
  color: var(--n-warning-color);
  padding: 0 2px;
  border-radius: 2px;
}

.search-loading {
  display: flex;
  justify-content: center;
  padding: 40px;
}

/* Info */
.info-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.info-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--n-text-color-2);
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.info-label {
  font-size: 14px;
  color: var(--n-text-color-3);
  min-width: 80px;
}

.info-value {
  flex: 1;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.permission-item,
.notification-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}

.info-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  display: flex;
  justify-content: center;
  padding: 40px;
}

/* Responsive */
@media (max-width: 768px) {
  .sidebar-header {
    padding: 12px;
  }

  .sidebar-content {
    padding: 12px;
  }

  .member-item,
  .file-item {
    padding: 6px;
  }
}
</style>
