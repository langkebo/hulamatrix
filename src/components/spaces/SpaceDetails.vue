<template>
  <div v-if="props.space" class="space-details" :class="{ 'is-mobile': isMobile }">
    <!-- 空间头部信息 -->
    <div class="space-header">
      <div class="space-cover">
        <div v-if="safeSpace.avatar" class="space-avatar">
          <img :src="safeSpace.avatar" :alt="safeSpace.name" />
        </div>
        <div v-else class="space-placeholder">
          <n-icon size="64"><Building /></n-icon>
          <span class="placeholder-text">{{ safeSpace.name.charAt(0).toUpperCase() }}</span>
        </div>
        <div class="space-overlay">
          <n-button v-if="safeSpace.isPublic" circle size="small" type="info">
            <template #icon>
              <n-icon><Globe /></n-icon>
            </template>
          </n-button>
          <n-button v-if="safeSpace.isArchived" circle size="small" type="warning">
            <template #icon>
              <n-icon><Archive /></n-icon>
            </template>
          </n-button>
        </div>
      </div>

      <div class="space-info">
        <div class="space-title">
          <h2>{{ safeSpace.name }}</h2>
          <div class="space-badges">
            <n-tag v-if="safeSpace.isPublic" type="info" size="small">
              <template #icon>
                <n-icon><Globe /></n-icon>
              </template>
              公开
            </n-tag>
            <n-tag v-if="safeSpace.isArchived" type="warning" size="small">
              <template #icon>
                <n-icon><Archive /></n-icon>
              </template>
              已归档
            </n-tag>
            <n-tag v-if="safeSpace.isFavorite" type="warning" size="small">
              <template #icon>
                <n-icon><Star /></n-icon>
              </template>
              已收藏
            </n-tag>
          </div>
        </div>

        <div class="space-description" v-if="safeSpace.topic">
          <p>{{ safeSpace.topic }}</p>
        </div>

        <div class="space-meta">
          <div class="meta-item">
            <n-icon><Users /></n-icon>
            <span>{{ safeSpace.memberCount }} 成员</span>
          </div>
          <div class="meta-item">
            <n-icon><Hash /></n-icon>
            <span>{{ safeSpace.roomCount }} 房间</span>
          </div>
          <div class="meta-item">
            <n-icon><Calendar /></nicon>
            <span>创建于 {{ formatDate(safeSpace.created || Date.now()) }}</span>
          </div>
          <div class="meta-item">
            <n-icon><Clock /></nicon>
            <span>{{ formatLastActivity() }}</span>
          </div>
        </div>

        <div class="space-actions">
          <n-button
            v-if="!safeSpace.isJoined"
            type="primary"
            @click="handleJoin"
            :loading="isJoining">
            <template #icon>
              <n-icon><Plus /></n-icon>
            </template>
            加入空间
          </n-button>

          <n-dropdown
            v-else
            :options="getSpaceActions()"
            @select="handleSpaceAction"
            placement="bottom-end">
            <n-button type="primary">
              <template #icon>
                <n-icon><Settings /></n-icon>
              </template>
              管理空间
            </n-button>
          </n-dropdown>

          <n-button @click="handleClose">
            关闭
          </n-button>
        </div>
      </div>
    </div>

    <!-- 标签页内容 -->
    <div class="space-content">
      <n-tabs v-model:value="activeTab" type="card" animated>
        <!-- 概览 -->
        <n-tab-pane name="overview" tab="概览">
          <div class="overview-content">
            <!-- 空间统计 -->
            <div class="stats-section">
              <h3>空间统计</h3>
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-value">{{ safeSpace.memberCount }}</div>
                  <div class="stat-label">总成员</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{{ safeSpace.roomCount }}</div>
                  <div class="stat-label">房间数</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{{ safeSpace.notifications?.notificationCount || 0 }}</div>
                  <div class="stat-label">未读消息</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{{ getActiveMembersCount() }}</div>
                  <div class="stat-label">活跃成员</div>
                </div>
              </div>
            </div>

            <!-- 空间描述 -->
            <div class="description-section" v-if="safeSpace.description">
              <h3>空间描述</h3>
              <div class="description-content">
                <p>{{ safeSpace.description }}</p>
              </div>
            </div>

            <!-- 空间标签 -->
            <div class="tags-section" v-if="safeSpace.tags && safeSpace.tags.length > 0">
              <h3>标签</h3>
              <div class="tags-content">
                <n-tag
                  v-for="tag in safeSpace.tags"
                  :key="tag"
                  round
                  type="info">
                  {{ tag }}
                </n-tag>
              </div>
            </div>

            <!-- 最近活动 -->
            <div class="activity-section">
              <h3>最近活动</h3>
              <div class="activity-timeline">
                <div
                  v-for="activity in recentActivities"
                  :key="activity.id"
                  class="activity-item">
                  <div class="activity-avatar">
                    <n-avatar :src="activity.userAvatar" :fallback="activity.userName.charAt(0)" />
                  </div>
                  <div class="activity-content">
                    <div class="activity-header">
                      <span class="activity-user">{{ activity.userName }}</span>
                      <span class="activity-action">{{ activity.action }}</span>
                      <span class="activity-time">{{ formatActivityTime(activity.timestamp) }}</span>
                    </div>
                    <div v-if="activity.details" class="activity-details">
                      {{ activity.details }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </n-tab-pane>

        <!-- 房间列表 -->
        <n-tab-pane name="rooms" tab="房间">
          <div class="rooms-content">
            <div class="rooms-header">
              <div class="rooms-search">
                <n-input
                  v-model:value="roomSearchQuery"
                  placeholder="搜索房间..."
                  clearable>
                  <template #prefix>
                    <n-icon><Search /></n-icon>
                  </template>
                </n-input>
              </div>
              <n-button type="primary" @click="handleCreateRoom" v-if="safeSpace.isAdmin">
                <template #icon>
                  <n-icon><Plus /></n-icon>
                </template>
                创建房间
              </n-button>
            </div>

            <div class="rooms-list">
              <div
                v-for="room in filteredRooms"
                :key="room.id"
                class="room-item"
                @click="handleViewRoom(room)">
                <div class="room-icon">
                  <n-icon :component="getRoomIcon(room.type || 'text')" />
                </div>
                <div class="room-info">
                  <div class="room-name">{{ room.name }}</div>
                  <div class="room-topic">{{ room.topic || '暂无描述' }}</div>
                  <div class="room-meta">
                    <span class="member-count">{{ room.memberCount ?? 0 }} 成员</span>
                    <span class="last-message">{{ formatLastMessage(room.lastMessage || '') }}</span>
                  </div>
                </div>
                <div class="room-actions">
                  <div v-if="(room.unreadCount ?? 0) > 0" class="unread-badge">
                    {{ room.unreadCount ?? 0 }}
                  </div>
                  <n-dropdown
                    :options="getRoomActions(room)"
                    @select="handleRoomAction"
                    placement="bottom-end">
                    <n-button quaternary circle size="small">
                      <template #icon>
                        <n-icon><MoreHorizontal /></n-icon>
                      </template>
                    </n-button>
                  </n-dropdown>
                </div>
              </div>
            </div>
          </div>
        </n-tab-pane>

        <!-- 成员列表 -->
        <n-tab-pane name="members" tab="成员">
          <div class="members-content">
            <div class="members-header">
              <div class="members-search">
                <n-input
                  v-model:value="memberSearchQuery"
                  placeholder="搜索成员..."
                  clearable>
                  <template #prefix>
                    <n-icon><Search /></n-icon>
                  </template>
                </n-input>
              </div>
              <n-button @click="handleInviteMembers" v-if="safeSpace.isAdmin">
                <template #icon>
                  <n-icon><UserPlus /></n-icon>
                </template>
                邀请成员
              </n-button>
            </div>

            <div class="members-list">
              <div
                v-for="member in filteredMembers"
                :key="member.id"
                class="member-item">
                <div class="member-avatar">
                  <n-avatar :src="member.avatar || ''" :fallback="(member.name ?? '').charAt(0).toUpperCase()" />
                  <div v-if="member.isOnline" class="online-indicator"></div>
                </div>
                <div class="member-info">
                  <div class="member-name">
                    {{ member.name }}
                    <n-tag v-if="member.role" size="tiny" :type="getRoleType(member.role)">
                      {{ getRoleLabel(member.role) }}
                    </n-tag>
                  </div>
                  <div class="member-status">{{ member.status || '暂无状态' }}</div>
                  <div class="member-joined">
                    加入于 {{ formatDate(member.joinedAt || Date.now()) }}
                  </div>
                </div>
                <div class="member-actions">
                  <n-dropdown
                    :options="getMemberActions(member)"
                    @select="handleMemberAction"
                    placement="bottom-end">
                    <n-button quaternary circle size="small">
                      <template #icon>
                        <n-icon><MoreHorizontal /></n-icon>
                      </template>
                    </n-button>
                  </n-dropdown>
                </div>
              </div>
            </div>
          </div>
        </n-tab-pane>

        <!-- 设置 -->
        <n-tab-pane name="settings" tab="设置" v-if="safeSpace.isAdmin">
          <div class="settings-content">
            <div class="setting-section">
              <h3>基本信息</h3>
              <n-form
                ref="basicFormRef"
                :model="basicForm"
                :rules="basicRules"
                label-placement="left"
                label-width="120px">
                <n-form-item label="空间名称" path="name">
                  <n-input v-model:value="basicForm.name" placeholder="输入空间名称" />
                </n-form-item>
                <n-form-item label="空间描述" path="description">
                  <n-input
                    v-model:value="basicForm.description"
                    type="textarea"
                    placeholder="描述这个空间的用途"
                    :autosize="{ minRows: 3, maxRows: 5 }" />
                </n-form-item>
                <n-form-item label="空间主题" path="topic">
                  <n-input v-model:value="basicForm.topic" placeholder="简短的空间主题" />
                </n-form-item>
              </n-form>
            </div>

            <div class="setting-section">
              <h3>隐私设置</h3>
              <n-form
                :model="privacyForm"
                label-placement="left"
                label-width="120px">
                <n-form-item label="空间类型">
                  <n-radio-group v-model:value="privacyForm.visibility">
                    <n-radio value="public">
                      <div class="radio-content">
                        <div class="radio-title">公开空间</div>
                        <div class="radio-description">任何人都可以找到并加入</div>
                      </div>
                    </n-radio>
                    <n-radio value="private">
                      <div class="radio-content">
                        <div class="radio-title">私有空间</div>
                        <div class="radio-description">仅受邀请的用户可以加入</div>
                      </div>
                    </n-radio>
                  </n-radio-group>
                </n-form-item>
              </n-form>
            </div>

            <div class="setting-section">
              <h3>通知设置</h3>
              <n-form
                :model="notificationForm"
                label-placement="left"
                label-width="120px">
                <n-form-item>
                  <n-checkbox v-model:checked="notificationForm.newMembers">
                    新成员加入通知
                  </n-checkbox>
                </n-form-item>
                <n-form-item>
                  <n-checkbox v-model:checked="notificationForm.spaceUpdated">
                    空间更新通知
                  </n-checkbox>
                </n-form-item>
                <n-form-item>
                  <n-checkbox v-model:checked="notificationForm.roomCreated">
                    新房间创建通知
                  </n-checkbox>
                </n-form-item>
              </n-form>
            </div>

            <div class="setting-actions">
              <n-button type="primary" @click="handleSaveSettings" :loading="isSaving">
                保存设置
              </n-button>
              <n-button @click="handleResetSettings">
                重置
              </n-button>
            </div>
          </div>
        </n-tab-pane>
      </n-tabs>
    </div>

    <!-- 创建房间对话框 -->
    <n-modal
      v-model:show="showCreateRoomDialog"
      preset="dialog"
      title="创建房间">
      <n-form
        ref="roomFormRef"
        :model="roomForm"
        :rules="roomRules"
        label-placement="left"
        label-width="100px">
        <n-form-item label="房间名称" path="name">
          <n-input v-model:value="roomForm.name" placeholder="输入房间名称" />
        </n-form-item>
        <n-form-item label="房间类型" path="type">
          <n-select
            v-model:value="roomForm.type"
            :options="roomTypeOptions"
            placeholder="选择房间类型" />
        </n-form-item>
        <n-form-item label="房间描述" path="description">
          <n-input
            v-model:value="roomForm.description"
            type="textarea"
            placeholder="描述房间的用途"
            :autosize="{ minRows: 2, maxRows: 4 }" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="showCreateRoomDialog = false">取消</n-button>
          <n-button type="primary" @click="handleCreateRoomConfirm" :loading="isCreatingRoom">
            创建
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, type Component } from 'vue'
import {
  NTabs,
  NTabPane,
  NButton,
  NIcon,
  NTag,
  NAvatar,
  NDropdown,
  NInput,
  NForm,
  NFormItem,
  NSelect,
  NRadioGroup,
  NRadio,
  NCheckbox,
  NModal,
  NSpace,
  useDialog
} from 'naive-ui'
import {
  Building,
  Globe,
  Archive,
  Star,
  Users,
  Hash,
  Calendar,
  Clock,
  Plus,
  Settings,
  Search,
  UserPlus,
  MoreHorizontal,
  MessageCircle,
  Video,
  FileText,
  Bell
} from '@/icons/TablerPlaceholders'
import { usePlatformConstants } from '@/utils/PlatformConstants'

import { useMatrixSpaces, type Space } from '@/hooks/useMatrixSpaces'

import { msg } from '@/utils/SafeUI'

interface Room {
  id: string
  name: string
  topic?: string
  type: string
  memberCount?: number
  isEncrypted?: boolean
  lastActivity?: number
  lastMessage?: string
  unreadCount?: number
}

interface Member {
  id: string
  name: string
  avatar?: string
  role?: string
  status?: string
  joinedAt?: number
  isOnline?: boolean
  powerLevel?: number
}

interface Activity {
  id: string
  userName: string
  userAvatar: string
  action: string
  details: string
  timestamp: number
}

interface Props {
  space: Space | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  updated: [space: Space]
  closed: []
}>()

const { isMobile } = usePlatformConstants()
const dialog = useDialog()
const message = msg

const { createRoomInSpace, updateSpaceSettings } = useMatrixSpaces()

// Computed property for safe space access with defaults
const safeSpace = computed(() => {
  if (!props.space) {
    return {
      id: '',
      name: '',
      topic: '',
      avatar: undefined,
      isPublic: false,
      notifications: { highlightCount: 0, notificationCount: 0 },
      memberCount: 0,
      joinedAt: undefined,
      joined: false,
      canonicalAlias: undefined,
      canAdmin: false,
      children: [],
      isArchived: false,
      isActive: true,
      isFavorite: false,
      isAdmin: false,
      roomCount: 0,
      lastActivity: Date.now(),
      tags: [],
      theme: undefined,
      rooms: undefined,
      members: undefined,
      description: undefined,
      created: undefined,
      isJoined: false,
      memberStatus: 'joined' as const
    }
  }

  return {
    id: props.space.id || '',
    name: props.space.name || '',
    topic: props.space.topic ?? '',
    avatar: props.space.avatar,
    isPublic: props.space.isPublic ?? false,
    notifications: props.space.notifications || { highlightCount: 0, notificationCount: 0 },
    memberCount: props.space.memberCount ?? 0,
    joinedAt: props.space.joinedAt,
    joined: props.space.joined ?? false,
    canonicalAlias: props.space.canonicalAlias,
    canAdmin: props.space.canAdmin ?? false,
    children: props.space.children || [],
    isArchived: props.space.isArchived ?? false,
    isActive: props.space.isActive ?? true,
    isFavorite: props.space.isFavorite ?? false,
    isAdmin: props.space.isAdmin ?? false,
    roomCount: props.space.roomCount ?? 0,
    lastActivity: props.space.lastActivity ?? Date.now(),
    tags: props.space.tags || [],
    theme: props.space.theme,
    rooms: props.space.rooms as Room[] | undefined,
    members: props.space.members as Member[] | undefined,
    description: props.space.description ?? undefined,
    created: props.space.created,
    isJoined: props.space.isJoined ?? props.space.joined ?? false,
    memberStatus: props.space.memberStatus ?? ('joined' as const)
  }
})

// 状态管理
const activeTab = ref('overview')
const roomSearchQuery = ref('')
const memberSearchQuery = ref('')
const showCreateRoomDialog = ref(false)
const isJoining = ref(false)
const isSaving = ref(false)
const isCreatingRoom = ref(false)

// 表单数据
const basicForm = ref({
  name: '',
  description: '',
  topic: ''
})

const privacyForm = ref({
  visibility: 'public'
})

const notificationForm = ref({
  newMembers: true,
  spaceUpdated: true,
  roomCreated: true
})

const roomForm = ref({
  name: '',
  type: 'text',
  description: ''
})

// 表单引用
const basicFormRef = ref()
const roomFormRef = ref()

// 选项数据
const roomTypeOptions = [
  { label: '文本聊天', value: 'text' },
  { label: '语音聊天', value: 'voice' },
  { label: '视频会议', value: 'video' },
  { label: '文件共享', value: 'file' },
  { label: '公告发布', value: 'announcement' }
]

// 计算属性
const filteredRooms = computed(() => {
  if (!props.space) return []
  if (!roomSearchQuery.value.trim()) return safeSpace.value.rooms || []
  const query = roomSearchQuery.value.toLowerCase()
  return (safeSpace.value.rooms || []).filter(
    (room: Room) => room.name.toLowerCase().includes(query) || (room.topic && room.topic.toLowerCase().includes(query))
  )
})

const filteredMembers = computed(() => {
  if (!props.space) return []
  if (!memberSearchQuery.value.trim()) return safeSpace.value.members || []
  const query = memberSearchQuery.value.toLowerCase()
  return (safeSpace.value.members || []).filter(
    (member: Member) =>
      (member.name || '').toLowerCase().includes(query) ||
      (member.status && member.status.toLowerCase().includes(query))
  )
})

// 模拟数据
const recentActivities = ref<Activity[]>([
  {
    id: '1',
    userName: 'Alice',
    userAvatar: '/avatars/alice.jpg',
    action: '创建了房间',
    details: 'general',
    timestamp: Date.now() - 3600000
  },
  {
    id: '2',
    userName: 'Bob',
    userAvatar: '/avatars/bob.jpg',
    action: '邀请了',
    details: 'Carol 加入空间',
    timestamp: Date.now() - 7200000
  },
  {
    id: '3',
    userName: 'Carol',
    userAvatar: '/avatars/carol.jpg',
    action: '上传了文件',
    details: 'project-plan.pdf',
    timestamp: Date.now() - 86400000
  }
])

// ========== 方法 ==========

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

const formatLastActivity = (): string => {
  const now = Date.now()
  const lastActivity = safeSpace.value.lastActivity || now
  const diff = now - lastActivity

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
  return `${Math.floor(diff / 604800000)} 周前`
}

const formatActivityTime = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return formatDate(timestamp)
}

const formatLastMessage = (message: { content?: string } | string): string => {
  if (!message) return '暂无消息'
  const content = typeof message === 'string' ? message : message.content || ''
  return content.substring(0, 50) + (content.length > 50 ? '...' : '')
}

const getActiveMembersCount = (): number => {
  return Math.floor((safeSpace.value.memberCount || 0) * 0.7) // 模拟活跃成员数量
}

const getRoomIcon = (type: string): Component => {
  switch (type) {
    case 'voice':
      return Video
    case 'video':
      return Video
    case 'file':
      return FileText
    case 'announcement':
      return Bell
    default:
      return MessageCircle
  }
}

const getRoleType = (role: string): 'error' | 'warning' | 'info' | 'default' | 'success' | 'primary' => {
  switch (role) {
    case 'admin':
      return 'error'
    case 'moderator':
      return 'warning'
    case 'member':
      return 'info'
    default:
      return 'default'
  }
}

const getRoleLabel = (role: string): string => {
  switch (role) {
    case 'admin':
      return '管理员'
    case 'moderator':
      return '协管员'
    case 'member':
      return '成员'
    default:
      return '用户'
  }
}

const getSpaceActions = () => {
  return [
    {
      label: '编辑信息',
      key: 'edit',
      icon: () => '✏️'
    },
    {
      label: '邀请成员',
      key: 'invite',
      icon: () => '👥'
    },
    {
      label: '通知设置',
      key: 'notifications',
      icon: () => '🔔'
    },
    {
      label: '复制链接',
      key: 'copy-link',
      icon: () => '🔗'
    },
    {
      label: '归档空间',
      key: 'archive',
      icon: () => '📦'
    },
    {
      label: '离开空间',
      key: 'leave',
      icon: () => '🚪'
    }
  ]
}

const getRoomActions = (room: unknown) => {
  void room
  return [
    {
      label: '查看房间',
      key: 'view',
      icon: () => '👁️'
    },
    {
      label: '房间设置',
      key: 'settings',
      icon: () => '⚙️'
    },
    {
      label: '复制链接',
      key: 'copy-link',
      icon: () => '🔗'
    },
    {
      label: '离开房间',
      key: 'leave',
      icon: () => '🚪'
    }
  ]
}

const getMemberActions = (member: Member) => {
  const actions = [
    {
      label: '发送消息',
      key: 'message',
      icon: () => '💬'
    },
    {
      label: '查看资料',
      key: 'profile',
      icon: () => '👤'
    }
  ]

  if (props.space?.isAdmin && member.role !== 'admin') {
    actions.push(
      {
        label: '设置权限',
        key: 'permissions',
        icon: () => '🔐'
      },
      {
        label: '移除成员',
        key: 'remove',
        icon: () => '🚫'
      }
    )
  }

  return actions
}

// ========== 事件处理 ==========

const handleJoin = async () => {
  if (!props.space) return
  isJoining.value = true
  try {
    message.success(`已申请加入空间: ${props.space.name}`)
    const updatedSpace: Space = {
      id: props.space.id || '',
      name: props.space.name || '',
      topic: props.space.topic,
      avatar: props.space.avatar,
      isPublic: props.space.isPublic,
      notifications: props.space.notifications,
      memberCount: props.space.memberCount,
      joinedAt: props.space.joinedAt,
      joined: true,
      canonicalAlias: props.space.canonicalAlias,
      canAdmin: props.space.canAdmin,
      children: props.space.children,
      isArchived: props.space.isArchived,
      isActive: props.space.isActive,
      isFavorite: props.space.isFavorite,
      isAdmin: props.space.isAdmin,
      roomCount: props.space.roomCount,
      lastActivity: props.space.lastActivity,
      tags: props.space.tags ? [...props.space.tags] : [],
      theme: props.space.theme
    }
    emit('updated', updatedSpace)
  } catch (error) {
    message.error('加入空间失败')
  } finally {
    isJoining.value = false
  }
}

const handleSpaceAction = async (action: string) => {
  switch (action) {
    case 'edit':
      activeTab.value = 'settings'
      break
    case 'invite':
      handleInviteMembers()
      break
    case 'copy-link':
      await copySpaceLink()
      break
    case 'archive':
      await handleArchiveSpace()
      break
    case 'leave':
      await handleLeaveSpace()
      break
    default:
      message.info(`${action} 功能开发中`)
  }
}

const handleViewRoom = (room: Room) => {
  message.info(`查看房间: ${room.name}`)
}

const handleRoomAction = (action: string, _option: unknown) => {
  message.info(`${action} 房间`)
}

const handleCreateRoom = () => {
  showCreateRoomDialog.value = true
}

const handleCreateRoomConfirm = async () => {
  if (!props.space) return
  try {
    await roomFormRef.value?.validate()
    isCreatingRoom.value = true

    const newRoom = await createRoomInSpace(props.space.id, roomForm.value)

    message.success('房间创建成功')
    showCreateRoomDialog.value = false

    // 重置表单
    roomForm.value = {
      name: '',
      type: 'text',
      description: ''
    }

    emit('updated', { ...props.space, rooms: [...(props.space.rooms || []), newRoom] })
  } catch (error) {
    message.error('创建房间失败')
  } finally {
    isCreatingRoom.value = false
  }
}

const handleInviteMembers = () => {
  message.info('邀请成员功能开发中')
}

const handleMemberAction = (action: string, _option: unknown) => {
  message.info(`${action} 成员`)
}

const handleSaveSettings = async () => {
  if (!props.space) return
  try {
    await basicFormRef.value?.validate()
    isSaving.value = true

    await updateSpaceSettings(props.space.id, {})

    message.success('设置保存成功')
    const updatedSpace: Space = {
      id: props.space.id || '',
      name: props.space.name || '',
      topic: props.space.topic,
      avatar: props.space.avatar,
      isPublic: props.space.isPublic,
      notifications: props.space.notifications,
      memberCount: props.space.memberCount,
      joinedAt: props.space.joinedAt,
      joined: props.space.joined,
      canonicalAlias: props.space.canonicalAlias,
      canAdmin: props.space.canAdmin,
      children: props.space.children,
      isArchived: props.space.isArchived,
      isActive: props.space.isActive,
      isFavorite: props.space.isFavorite,
      isAdmin: props.space.isAdmin,
      roomCount: props.space.roomCount,
      lastActivity: props.space.lastActivity,
      tags: props.space.tags ? [...props.space.tags] : [],
      theme: props.space.theme
    }
    emit('updated', updatedSpace)
  } catch (error) {
    message.error('保存设置失败')
  } finally {
    isSaving.value = false
  }
}

const handleResetSettings = () => {
  if (!props.space) return
  basicForm.value = {
    name: safeSpace.value.name,
    description: safeSpace.value.description || '',
    topic: safeSpace.value.topic || ''
  }
  privacyForm.value.visibility = safeSpace.value.isPublic ? 'public' : 'private'
}

const copySpaceLink = async () => {
  if (!props.space) return
  const link = `${window.location.origin}/space/${props.space.id}`
  try {
    await navigator.clipboard.writeText(link)
    message.success('空间链接已复制到剪贴板')
  } catch (error) {
    message.error('复制链接失败')
  }
}

const handleArchiveSpace = async () => {
  if (!props.space) return
  const spaceData = { ...props.space }
  dialog.warning({
    title: '确认归档',
    content: `确定要归档空间 "${spaceData.name}" 吗？归档后空间将变为只读状态。`,
    positiveText: '确定归档',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        message.success('空间已归档')
        const updatedSpace: Space = {
          id: spaceData.id || '',
          name: spaceData.name || '',
          topic: spaceData.topic,
          avatar: spaceData.avatar,
          isPublic: spaceData.isPublic,
          notifications: spaceData.notifications,
          memberCount: spaceData.memberCount,
          joinedAt: spaceData.joinedAt,
          joined: spaceData.joined,
          canonicalAlias: spaceData.canonicalAlias,
          canAdmin: spaceData.canAdmin,
          children: spaceData.children,
          isArchived: true,
          isActive: spaceData.isActive,
          isFavorite: spaceData.isFavorite,
          isAdmin: spaceData.isAdmin,
          roomCount: spaceData.roomCount,
          lastActivity: spaceData.lastActivity,
          tags: spaceData.tags ? [...spaceData.tags] : [],
          theme: spaceData.theme
        }
        emit('updated', updatedSpace)
      } catch (error) {
        message.error('归档空间失败')
      }
    }
  })
}

const handleLeaveSpace = async () => {
  if (!props.space) return
  const spaceData = { ...props.space }
  dialog.warning({
    title: '确认退出',
    content: `确定要退出空间 "${spaceData.name}" 吗？`,
    positiveText: '确定退出',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        message.success('已退出空间')
        const updatedSpace: Space = {
          id: spaceData.id || '',
          name: spaceData.name || '',
          topic: spaceData.topic,
          avatar: spaceData.avatar,
          isPublic: spaceData.isPublic,
          notifications: spaceData.notifications,
          memberCount: spaceData.memberCount,
          joinedAt: spaceData.joinedAt,
          joined: false,
          canonicalAlias: spaceData.canonicalAlias,
          canAdmin: spaceData.canAdmin,
          children: spaceData.children,
          isArchived: spaceData.isArchived,
          isActive: spaceData.isActive,
          isFavorite: spaceData.isFavorite,
          isAdmin: spaceData.isAdmin,
          roomCount: spaceData.roomCount,
          lastActivity: spaceData.lastActivity,
          tags: spaceData.tags ? [...spaceData.tags] : [],
          theme: spaceData.theme
        }
        emit('updated', updatedSpace)
      } catch (error) {
        message.error('退出空间失败')
      }
    }
  })
}

const handleClose = () => {
  emit('closed')
}

// ========== 生命周期 ==========

onMounted(() => {
  if (!props.space) return
  // 初始化表单数据
  basicForm.value = {
    name: safeSpace.value.name,
    description: safeSpace.value.description || '',
    topic: safeSpace.value.topic || ''
  }
  privacyForm.value.visibility = safeSpace.value.isPublic ? 'public' : 'private'
})

// 表单验证规则
const basicRules = {
  name: [
    { required: true, message: '请输入空间名称', trigger: 'blur' },
    { min: 2, max: 50, message: '空间名称长度应在2-50个字符之间', trigger: 'blur' }
  ]
}

const roomRules = {
  name: [
    { required: true, message: '请输入房间名称', trigger: 'blur' },
    { min: 2, max: 50, message: '房间名称长度应在2-50个字符之间', trigger: 'blur' }
  ],
  type: [{ required: true, message: '请选择房间类型', trigger: 'change' }]
}
</script>

<style lang="scss" scoped>
.space-details {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);

  .space-header {
    padding: 24px;
    background: var(--card-color);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    gap: 20px;

    .space-cover {
      position: relative;
      width: 120px;
      height: 120px;
      flex-shrink: 0;

      .space-avatar,
      .space-placeholder {
        width: 100%;
        height: 100%;
        border-radius: 12px;
        overflow: hidden;
      }

      .space-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .space-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;

        .placeholder-text {
          font-size: 48px;
          font-weight: 600;
          text-transform: uppercase;
          opacity: 0.8;
        }
      }

      .space-overlay {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        gap: 4px;
      }
    }

    .space-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;

      .space-title {
        display: flex;
        align-items: center;
        gap: 16px;

        h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          color: var(--text-color-1);
        }

        .space-badges {
          display: flex;
          gap: 8px;
        }
      }

      .space-description {
        color: var(--text-color-2);
        font-size: 14px;
        line-height: 1.5;

        p {
          margin: 0;
        }
      }

      .space-meta {
        display: flex;
        gap: 20px;
        flex-wrap: wrap;

        .meta-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--text-color-3);
        }
      }

      .space-actions {
        display: flex;
        gap: 12px;
        margin-top: auto;
      }
    }
  }

  .space-content {
    flex: 1;
    overflow: hidden;

    :deep(.n-tabs) {
      height: 100%;
      display: flex;
      flex-direction: column;

      .n-tabs-nav {
        background: var(--card-color);
        border-bottom: 1px solid var(--border-color);
      }

      .n-tabs-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
      }
    }
  }

  .overview-content {
    display: flex;
    flex-direction: column;
    gap: 32px;

    .stats-section {
      h3 {
        margin: 0 0 16px 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--text-color-1);
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;

        .stat-card {
          background: var(--card-color);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 20px;
          text-align: center;

          .stat-value {
            font-size: 32px;
            font-weight: 600;
            color: var(--primary-color);
            margin-bottom: 8px;
          }

          .stat-label {
            font-size: 14px;
            color: var(--text-color-3);
          }
        }
      }
    }

    .description-section,
    .tags-section,
    .activity-section {
      h3 {
        margin: 0 0 16px 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--text-color-1);
      }
    }

    .description-content {
      background: var(--card-color);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 20px;

      p {
        margin: 0;
        line-height: 1.6;
        color: var(--text-color-2);
      }
    }

    .tags-content {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .activity-timeline {
      .activity-item {
        display: flex;
        gap: 12px;
        padding: 16px 0;
        border-bottom: 1px solid var(--border-color);

        &:last-child {
          border-bottom: none;
        }

        .activity-avatar {
          flex-shrink: 0;
        }

        .activity-content {
          flex: 1;

          .activity-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;

            .activity-user {
              font-weight: 500;
              color: var(--text-color-1);
            }

            .activity-action {
              color: var(--text-color-2);
            }

            .activity-time {
              font-size: 12px;
              color: var(--text-color-3);
              margin-left: auto;
            }
          }

          .activity-details {
            font-size: 14px;
            color: var(--text-color-3);
          }
        }
      }
    }
  }

  .rooms-content,
  .members-content {
    .rooms-header,
    .members-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      gap: 16px;

      .rooms-search,
      .members-search {
        flex: 1;
        max-width: 400px;
      }
    }
  }

  .rooms-list {
    .room-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: var(--card-color);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        border-color: var(--primary-color);
        transform: translateY(-1px);
      }

      .room-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-color-hover);
        border-radius: 8px;
        color: var(--primary-color);
      }

      .room-info {
        flex: 1;

        .room-name {
          font-weight: 500;
          color: var(--text-color-1);
          margin-bottom: 4px;
        }

        .room-topic {
          font-size: 13px;
          color: var(--text-color-3);
          margin-bottom: 8px;
        }

        .room-meta {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: var(--text-color-3);
        }
      }

      .room-actions {
        display: flex;
        align-items: center;
        gap: 8px;

        .unread-badge {
          background: var(--error-color);
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
      }
    }
  }

  .members-list {
    .member-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: var(--card-color);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-bottom: 8px;

      .member-avatar {
        position: relative;
        flex-shrink: 0;

        .online-indicator {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 12px;
          height: 12px;
          background: var(--success-color);
          border: 2px solid var(--card-color);
          border-radius: 50%;
        }
      }

      .member-info {
        flex: 1;

        .member-name {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
          color: var(--text-color-1);
          margin-bottom: 4px;
        }

        .member-status {
          font-size: 13px;
          color: var(--text-color-2);
          margin-bottom: 4px;
        }

        .member-joined {
          font-size: 12px;
          color: var(--text-color-3);
        }
      }

      .member-actions {
        flex-shrink: 0;
      }
    }
  }

  .settings-content {
    display: flex;
    flex-direction: column;
    gap: 32px;

    .setting-section {
      h3 {
        margin: 0 0 20px 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--text-color-1);
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border-color);
      }

      .radio-content {
        margin-left: 8px;

        .radio-title {
          font-weight: 500;
          color: var(--text-color-1);
          margin-bottom: 4px;
        }

        .radio-description {
          font-size: 12px;
          color: var(--text-color-3);
        }
      }
    }

    .setting-actions {
      display: flex;
      gap: 12px;
      padding-top: 20px;
      border-top: 1px solid var(--border-color);
    }
  }

  &.is-mobile {
    .space-header {
      flex-direction: column;
      text-align: center;
      gap: 16px;

      .space-info {
        .space-title {
          flex-direction: column;
          gap: 8px;
        }

        .space-actions {
          justify-content: center;
        }
      }
    }

    .overview-content {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;

        .stat-card {
          padding: 16px;

          .stat-value {
            font-size: 24px;
          }
        }
      }
    }

    .rooms-header,
    .members-header {
      flex-direction: column;
      gap: 12px;

      .rooms-search,
      .members-search {
        max-width: none;
      }
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .space-details {
    .space-header {
      padding: 16px;

      .space-cover {
        width: 80px;
        height: 80px;

        .space-placeholder .placeholder-text {
          font-size: 32px;
        }
      }

      .space-info {
        .space-title h2 {
          font-size: 20px;
        }

        .space-meta {
          gap: 12px;
        }
      }
    }

    .space-content {
      :deep(.n-tabs-content) {
        padding: 16px;
      }
    }
  }
}
</style>
