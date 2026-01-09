<!-- Mobile Space Details Drawer - Full space details for mobile -->
<template>
  <van-popup
    :show="showDrawer"
    position="bottom"
    :style="{ height: '90vh', borderRadius: '16px 16px 0 0' }"
    @update:show="handleClose"
    @click-overlay="handleClose">
    <div class="space-drawer-popup">
      <!-- Header -->
      <div class="drawer-header">
        <div class="header-left">
          <van-button icon="cross" @click="handleClose" />
          <span class="header-title">工作区详情</span>
        </div>
        <div class="header-right">
          <van-button icon="ellipsis" @click="showMenuSheet = true" />
        </div>
      </div>

      <!-- Content -->
      <div v-if="space" class="space-details">
        <!-- Space Info Card -->
        <div class="space-info-card">
          <div class="space-avatar-section">
            <van-image :src="space.avatar" width="72" height="72" round>
              <template #error>
                <div class="avatar-fallback">{{ space.name?.charAt(0)?.toUpperCase() || '?' }}</div>
              </template>
            </van-image>
            <div class="space-badges">
              <van-tag v-if="space.isPublic" type="primary" round>公开</van-tag>
              <van-tag v-else type="default" round>私有</van-tag>
              <van-tag v-if="space.encrypted" type="success" round>加密</van-tag>
            </div>
          </div>

          <h2 class="space-name">{{ space.name }}</h2>
          <p v-if="space.topic" class="space-topic">{{ space.topic }}</p>

          <div class="space-stats">
            <div class="stat-item">
              <van-icon name="friends-o" :size="16" />
              <span>{{ space.memberCount ?? 0 }}</span>
              <span class="stat-label">成员</span>
            </div>
            <div class="stat-item">
              <van-icon name="hash" :size="16" />
              <span>{{ space.children?.length ?? 0 }}</span>
              <span class="stat-label">房间</span>
            </div>
            <div v-if="unreadCount > 0" class="stat-item unread">
              <van-icon name="bell" :size="16" />
              <span>{{ unreadCount }}</span>
              <span class="stat-label">未读</span>
            </div>
          </div>

          <!-- Space Address -->
          <div v-if="space.canonicalAlias" class="space-address">
            <span class="address-text">{{ space.canonicalAlias }}</span>
            <van-button icon="files-o" size="small" @click="copySpaceAddress" />
          </div>

          <!-- Join/Leave Button -->
          <div class="space-actions">
            <van-button
              v-if="!isJoined"
              type="primary"
              size="large"
              block
              :loading="isJoining"
              icon="log-in"
              @click="handleJoin">
              加入工作区
            </van-button>
            <van-button
              v-else
              type="danger"
              size="large"
              block
              :loading="isLeaving"
              icon="log-out"
              @click="handleLeave">
              离开工作区
            </van-button>
          </div>
        </div>

        <!-- Tabs -->
        <van-tabs v-model:active="activeTab" animated swipeable>
          <!-- Rooms Tab -->
          <van-tab title="房间" name="rooms">
            <div class="tab-content">
              <!-- Create Room Button -->
              <div v-if="isJoined && canManageRooms" class="tab-header">
                <van-button type="primary" size="small" icon="plus" @click="showCreateDialog = true">
                  添加房间
                </van-button>
              </div>

              <!-- Room List -->
              <div v-if="space.children && space.children.length > 0" class="room-list">
                <div
                  v-for="child in sortedChildren"
                  :key="child.roomId"
                  class="room-item"
                  @click="openRoom(child.roomId)">
                  <div class="room-avatar">
                    <van-image :src="String(child.avatar ?? '')" width="44" height="44" round>
                      <template #error>
                        <span>{{ child.name?.charAt(0)?.toUpperCase() || '?' }}</span>
                      </template>
                    </van-image>
                    <div v-if="getRoomUnread(child) > 0" class="unread-badge">
                      {{ getRoomUnread(child) > 99 ? '99+' : getRoomUnread(child) }}
                    </div>
                  </div>

                  <div class="room-info">
                    <div class="room-name">{{ child.name }}</div>
                    <div class="room-meta">
                      <span v-if="child.memberCount">{{ child.memberCount }} 成员</span>
                      <van-tag v-if="!child.isJoined" type="primary">未加入</van-tag>
                      <van-tag v-if="child.topic" type="default">{{ child.topic }}</van-tag>
                    </div>
                  </div>

                  <div class="room-action">
                    <van-icon name="arrow" :size="18" />
                  </div>
                </div>
              </div>

              <van-empty v-else description="暂无房间">
                <template #extra v-if="isJoined && canManageRooms">
                  <van-button type="primary" size="small" @click="showCreateDialog = true">添加第一个房间</van-button>
                </template>
              </van-empty>
            </div>
          </van-tab>

          <!-- Members Tab -->
          <van-tab title="成员" name="members">
            <div class="tab-content">
              <!-- Search and Filter -->
              <div v-if="isJoined" class="tab-header">
                <van-field v-model="memberSearchQuery" placeholder="搜索成员..." clearable left-icon="search" />
              </div>

              <!-- Member List -->
              <div v-if="isLoadingMembers" class="loading-container">
                <van-loading size="24px" />
                <span style="color: var(--text-color-3)">加载成员中...</span>
              </div>

              <div v-else-if="filteredMembers.length > 0" class="member-list">
                <div
                  v-for="member in filteredMembers"
                  :key="member.userId"
                  class="member-item"
                  @click="handleMemberClick(member)">
                  <van-image :src="member.avatarUrl" width="42" height="42" round>
                    <template #error>
                      <span>
                        {{ member.displayName?.charAt(0) || member.userId?.charAt(0) || '?' }}
                      </span>
                    </template>
                  </van-image>

                  <div class="member-info">
                    <div class="member-name">{{ member.displayName || member.userId }}</div>
                    <div class="member-role">
                      <van-tag v-if="member.isAdmin" type="warning">管理员</van-tag>
                      <van-tag v-else-if="member.isModerator" type="primary">版主</van-tag>
                      <span v-else style="font-size: 12px; color: var(--text-color-3)">{{ member.userId }}</span>
                    </div>
                  </div>

                  <div class="member-status">
                    <div v-if="member.presence === 'online'" class="status-dot online" />
                    <div v-else-if="member.presence === 'unavailable'" class="status-dot away" />
                    <div v-else class="status-dot offline" />
                  </div>
                </div>
              </div>

              <van-empty v-else :description="memberSearchQuery ? '未找到匹配的成员' : '暂无成员'">
                <template #extra v-if="isJoined && !memberSearchQuery">
                  <van-button type="primary" size="small" @click="showInviteDialog = true">邀请成员</van-button>
                </template>
              </van-empty>

              <!-- Invite Button (only for admins) -->
              <div v-if="isJoined && canManageMembers && !isLoadingMembers" class="invite-section">
                <van-button type="primary" block icon="add-o" @click="showInviteDialog = true">邀请新成员</van-button>
              </div>
            </div>
          </van-tab>

          <!-- Settings Tab -->
          <van-tab title="设置" name="settings">
            <div class="tab-content">
              <van-cell-group v-if="isJoined" inset :border="true">
                <!-- Space Settings -->
                <van-cell title="工作区设置" is-link @click="">
                  <template #icon>
                    <van-icon name="setting-o" :size="20" />
                  </template>
                  <template #label>
                    <span style="color: var(--text-color-3)">名称、头像、描述等</span>
                  </template>
                </van-cell>

                <!-- Notifications -->
                <van-cell title="通知设置" is-link @click="handleNotifications">
                  <template #icon>
                    <van-icon name="bell" :size="20" />
                  </template>
                  <template #right-icon>
                    <van-tag :type="notificationEnabled ? 'success' : 'default'">
                      {{ notificationEnabled ? '已启用' : '已禁用' }}
                    </van-tag>
                  </template>
                </van-cell>

                <!-- Permissions -->
                <van-cell v-if="canAdmin" title="权限管理" is-link @click="handlePermissions">
                  <template #icon>
                    <van-icon name="shield-o" :size="20" />
                  </template>
                  <template #label>
                    <span style="color: var(--text-color-3)">成员角色和权限</span>
                  </template>
                </van-cell>

                <!-- Share -->
                <van-cell title="分享工作区" :is-link="space.isPublic" @click="handleExport">
                  <template #icon>
                    <van-icon name="share-o" :size="20" />
                  </template>
                  <template #label>
                    <span style="color: var(--text-color-3)">复制邀请链接</span>
                  </template>
                </van-cell>

                <!-- Leave -->
                <van-cell title="离开工作区" @click="handleLeave" class="danger-item">
                  <template #icon>
                    <van-icon name="log-out" :size="20" color="#d03050" />
                  </template>
                </van-cell>
              </van-cell-group>

              <van-empty v-else description="加入工作区后可访问设置">
                <template #extra>
                  <van-button type="primary" size="small" @click="handleJoin">立即加入</van-button>
                </template>
              </van-empty>
            </div>
          </van-tab>
        </van-tabs>
      </div>

      <!-- Create Room Dialog -->
      <van-popup
        :show="showCreateDialog"
        position="center"
        :style="{ width: '85%', maxWidth: '400px', borderRadius: '12px' }"
        @update:show="showCreateDialog = $event">
        <div class="dialog-content">
          <div class="dialog-header">
            <h3>添加房间</h3>
          </div>
          <van-form @submit="handleCreateRoom">
            <van-field
              v-model="newRoom.name"
              label="房间名称"
              placeholder="输入房间名称"
              :rules="[{ required: true, message: '请输入房间名称' }]" />
            <van-field
              v-model="newRoom.description"
              label="房间描述"
              type="textarea"
              placeholder="描述此房间的用途"
              rows="3" />
            <van-field label="房间类型">
              <template #input>
                <van-radio-group v-model="newRoom.isPublic" direction="horizontal">
                  <van-radio :name="false">私有房间</van-radio>
                  <van-radio :name="true">公开房间</van-radio>
                </van-radio-group>
              </template>
            </van-field>
            <div class="dialog-actions">
              <van-button @click="showCreateDialog = false">取消</van-button>
              <van-button type="primary" :loading="isCreating" native-type="submit">创建</van-button>
            </div>
          </van-form>
        </div>
      </van-popup>

      <!-- Invite Member Dialog -->
      <van-popup
        :show="showInviteDialog"
        position="center"
        :style="{ width: '85%', maxWidth: '400px', borderRadius: '12px' }"
        @update:show="showInviteDialog = $event">
        <div class="dialog-content">
          <div class="dialog-header">
            <h3>邀请成员</h3>
          </div>
          <van-form @submit="handleInvite">
            <van-field
              v-model="inviteForm.userId"
              label="用户 ID"
              placeholder="@username:server.com"
              :rules="[{ required: true, message: '请输入用户 ID' }]" />
            <div class="dialog-actions">
              <van-button @click="showInviteDialog = false">取消</van-button>
              <van-button type="primary" :loading="isInviting" native-type="submit">邀请</van-button>
            </div>
          </van-form>
        </div>
      </van-popup>

      <!-- Member Details Modal -->
      <van-popup
        :show="showMemberModal"
        position="center"
        :style="{ width: '90%', maxWidth: '500px', borderRadius: '12px' }"
        @update:show="showMemberModal = $event">
        <div class="dialog-content member-details">
          <div class="dialog-header">
            <h3>{{ selectedMember?.displayName || '成员详情' }}</h3>
          </div>
          <div v-if="selectedMember">
            <div class="member-avatar-section">
              <van-image :src="selectedMember.avatarUrl" width="80" height="80" round>
                <template #error>
                  <span>{{ selectedMember.displayName?.charAt(0) || selectedMember.userId?.charAt(0) || '?' }}</span>
                </template>
              </van-image>
              <van-tag v-if="selectedMember.isAdmin" type="warning">管理员</van-tag>
              <van-tag v-else-if="selectedMember.isModerator" type="primary">版主</van-tag>
            </div>

            <van-cell-group inset :border="true">
              <van-cell title="用户 ID" :value="selectedMember.userId" />
              <van-cell title="显示名称" :value="selectedMember.displayName || '未设置'" />
              <van-cell title="在线状态">
                <template #value>
                  <van-tag v-if="selectedMember.presence === 'online'" type="success">在线</van-tag>
                  <van-tag v-else-if="selectedMember.presence === 'unavailable'" type="warning">离开</van-tag>
                  <van-tag v-else type="default">离线</van-tag>
                </template>
              </van-cell>
            </van-cell-group>

            <div v-if="canAdmin && selectedMember.userId !== currentUserId" class="member-actions">
              <van-button block icon="chat-o" @click="startChatWithMember">发送消息</van-button>
              <van-button block type="warning" icon="delete-o" @click="handleRemoveMember">移除成员</van-button>
            </div>
          </div>
        </div>
      </van-popup>

      <!-- Menu Action Sheet -->
      <van-action-sheet v-model:show="showMenuSheet" :actions="menuActions" @select="handleMenuSelect" />
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDialog, useMessage } from '@/utils/vant-adapter'
import { useMatrixSpaces, type Space as MatrixSpace, type SpaceChild } from '@/hooks/useMatrixSpaces'
import { useHaptic } from '@/composables/useMobileGestures'
import { useUserStore } from '@/stores/user'
import { logger } from '@/utils/logger'
import { msg } from '@/utils/SafeUI'

// Icon name mapping for Vant
const getVantIconName = (iconName: string): string => {
  const iconMap: Record<string, string> = {
    X: 'cross',
    DotsVertical: 'ellipsis',
    World: 'globe-o',
    Lock: 'lock',
    LockOpen: 'lock-open',
    Users: 'friends-o',
    Hash: 'hash',
    Bell: 'bell',
    Login: 'log-in',
    Logout: 'log-out',
    Plus: 'plus',
    ChevronRight: 'arrow',
    UserPlus: 'add-o',
    Share: 'share-o',
    Settings: 'setting-o',
    Search: 'search',
    Copy: 'files-o',
    MessageCircle: 'chat-o',
    UserMinus: 'delete-o',
    AlertTriangle: 'warning-o',
    Shield: 'shield-o',
    Check: 'success'
  }
  return iconMap[iconName] || 'circle'
}

interface Props {
  show: boolean
  space: MatrixSpace | null
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'room-selected', roomId: string): void
}

interface SpaceMember {
  userId: string
  displayName?: string
  avatarUrl?: string
  presence?: 'online' | 'offline' | 'unavailable'
  isAdmin?: boolean
  isModerator?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const router = useRouter()
const userStore = useUserStore()
const dialog = useDialog()
const message = useMessage()
const { selection, success, error: hapticError, warning } = useHaptic()

// Matrix Spaces hook
const { joinSpace, leaveSpace, addChildToSpace, inviteToSpace, getSpaceMembers, removeFromSpace, canManageSpace } =
  useMatrixSpaces()

// State
const activeTab = ref<'rooms' | 'members' | 'settings'>('rooms')
const isJoining = ref(false)
const isLeaving = ref(false)
const showCreateDialog = ref(false)
const showInviteDialog = ref(false)
const showMenuSheet = ref(false)
const isCreating = ref(false)
const isInviting = ref(false)
const showMemberModal = ref(false)
const isLoadingMembers = ref(false)
const memberSearchQuery = ref('')
const members = ref<SpaceMember[]>([])
const selectedMember = ref<SpaceMember | null>(null)

// Settings state
const notificationEnabled = ref(true)
const spaceEncrypted = ref(false)

// Current user ID (would come from auth store)
const currentUserId = ref('')

// New room form
const newRoom = ref({
  name: '',
  description: '',
  isPublic: false
})

// Invite form
const inviteForm = ref({
  userId: ''
})

// Form refs
const createFormRef = ref()
const inviteFormRef = ref()

// Form rules
const createRules = {
  name: { required: true, message: '请输入房间名称', trigger: 'blur' }
}

const inviteRules = {
  userId: { required: true, message: '请输入用户 ID', trigger: 'blur' }
}

// Computed
const showDrawer = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const isJoined = computed(() => {
  return props.space?.joined ?? false
})

const unreadCount = computed(() => {
  if (!props.space?.notifications) return 0
  return (props.space.notifications.highlightCount ?? 0) + (props.space.notifications.notificationCount ?? 0)
})

const canManageRooms = computed(() => {
  return props.space?.canAdmin || props.space?.permissions?.canManageRooms
})

const canManageMembers = computed(() => {
  return props.space?.canAdmin || props.space?.permissions?.canInvite
})

const canAdmin = computed(() => {
  return props.space?.canAdmin || props.space?.permissions?.canRemove
})

const sortedChildren = computed(() => {
  if (!props.space?.children) return []
  return [...props.space.children].sort((a, b) => {
    // Sort by unread first, then by name
    const aUnread = (a.notifications?.notificationCount ?? 0) + (a.notifications?.highlightCount ?? 0)
    const bUnread = (b.notifications?.notificationCount ?? 0) + (b.notifications?.highlightCount ?? 0)
    if (aUnread !== bUnread) return bUnread - aUnread
    return (a.name || '').localeCompare(b.name || '')
  })
})

const filteredMembers = computed(() => {
  if (!memberSearchQuery.value) return members.value
  const query = memberSearchQuery.value.toLowerCase()
  return members.value.filter(
    (m) => m.displayName?.toLowerCase().includes(query) || m.userId?.toLowerCase().includes(query)
  )
})

// Menu actions for action sheet
interface MenuAction {
  name: string
  value: string
  icon?: string
}

const menuActions = computed<MenuAction[]>(() => [
  { name: '分享', value: 'share', icon: 'share-o' },
  { name: '刷新', value: 'refresh', icon: 'replay' },
  { name: '举报', value: 'report', icon: 'warning-o' }
])

// Methods
const loadMembers = async () => {
  if (!props.space || !isJoined.value) return

  isLoadingMembers.value = true
  try {
    const memberList = await getSpaceMembers(props.space.id)
    members.value = (memberList || []) as SpaceMember[]
    logger.info('[MobileSpaceDrawer] Loaded members:', members.value.length)
  } catch (error) {
    logger.error('[MobileSpaceDrawer] Failed to load members:', error)
  } finally {
    isLoadingMembers.value = false
  }
}

const handleAfterLeave = () => {
  // Reset state when drawer closes
  activeTab.value = 'rooms'
  memberSearchQuery.value = ''
  members.value = []
  selectedMember.value = null
}

const handleClose = () => {
  emit('update:show', false)
  selection()
}

const handleMenuSelect = (action: MenuAction) => {
  showMenuSheet.value = false
  switch (action.value) {
    case 'share':
      handleExport()
      break
    case 'refresh':
      loadMembers()
      msg.success('已刷新')
      break
    case 'report':
      warning()
      message.info('举报功能开发中')
      break
  }
  selection()
}

const handleJoin = async () => {
  if (!props.space) return

  isJoining.value = true
  try {
    const result = await joinSpace(props.space.id)
    if (result) {
      success()
      message.success('已加入工作区')
      // Load members after joining
      await loadMembers()
    } else {
      hapticError()
      message.error('加入工作区失败')
    }
  } finally {
    isJoining.value = false
  }
}

const handleLeave = () => {
  if (!props.space) return

  dialog.warning({
    title: '离开工作区',
    content: `确定要离开 "${props.space.name}" 吗？`,
    confirmText: '离开',
    cancelText: '取消',
    onConfirm: async () => {
      isLeaving.value = true
      try {
        const result = await leaveSpace(props.space!.id)
        if (result) {
          warning()
          message.success('已离开工作区')
          handleClose()
        } else {
          hapticError()
          message.error('离开工作区失败')
        }
      } finally {
        isLeaving.value = false
      }
    }
  })
}

const openRoom = (roomId: string) => {
  emit('room-selected', roomId)
  selection()
}

const getRoomUnread = (child: SpaceChild) => {
  if (!child.notifications) return 0
  return (child.notifications.notificationCount ?? 0) + (child.notifications.highlightCount ?? 0)
}

const handleCreateRoom = async () => {
  if (!props.space || !newRoom.value.name) return

  isCreating.value = true
  try {
    const result = await addChildToSpace(props.space.id, '', {
      order: '',
      suggested: false
    })

    if (result) {
      success()
      message.success('房间添加成功')
      showCreateDialog.value = false
      newRoom.value = { name: '', description: '', isPublic: false }
    } else {
      hapticError()
      message.error('添加房间失败')
    }
  } finally {
    isCreating.value = false
  }
}

const handleInvite = async () => {
  if (!props.space || !inviteForm.value.userId) return

  isInviting.value = true
  try {
    const result = await inviteToSpace(props.space.id, inviteForm.value.userId)
    if (result) {
      success()
      message.success('邀请已发送')
      showInviteDialog.value = false
      inviteForm.value = { userId: '' }
    } else {
      hapticError()
      message.error('邀请发送失败')
    }
  } finally {
    isInviting.value = false
  }
}

const handleMemberClick = (member: SpaceMember) => {
  selectedMember.value = member
  showMemberModal.value = true
  selection()
}

const copySpaceAddress = () => {
  if (props.space?.canonicalAlias) {
    navigator.clipboard.writeText(props.space.canonicalAlias)
    success()
    message.success('地址已复制')
  }
}

const handleNotifications = () => {
  notificationEnabled.value = !notificationEnabled.value
  message.success(notificationEnabled.value ? '通知已启用' : '通知已禁用')
  selection()
}

const handlePermissions = () => {
  message.info('权限管理功能开发中')
  selection()
}

const handleEncryptionToggle = (value: boolean) => {
  dialog.info({
    title: '加密设置',
    content: value ? '启用加密后，新消息将被端到端加密' : '禁用加密后，新消息将不再加密',
    confirmText: '确定',
    cancelText: '取消',
    onConfirm: () => {
      spaceEncrypted.value = value
      success()
      message.success(value ? '已启用加密' : '已禁用加密')
    }
  })
}

const handleExport = () => {
  if (props.space?.canonicalAlias) {
    const shareUrl = `${window.location.origin}/#/space/${props.space.roomId || props.space.id}`
    navigator.clipboard.writeText(shareUrl)
    success()
    message.success('工作区链接已复制')
  } else if (props.space?.roomId) {
    const shareUrl = `${window.location.origin}/#/room/${props.space.roomId}`
    navigator.clipboard.writeText(shareUrl)
    success()
    message.success('工作区链接已复制')
  } else {
    hapticError()
    message.warning('无法分享此工作区')
  }
  selection()
}

const startChatWithMember = () => {
  if (selectedMember.value) {
    showMemberModal.value = false
    router.push({
      path: '/mobile/chatRoom/chatMain',
      query: { userId: selectedMember.value.userId }
    })
  }
}

const handleRemoveMember = () => {
  if (!props.space || !selectedMember.value) return

  dialog.warning({
    title: '移除成员',
    content: `确定要移除 "${selectedMember.value.displayName || selectedMember.value.userId}" 吗？`,
    confirmText: '移除',
    cancelText: '取消',
    onConfirm: async () => {
      try {
        await removeFromSpace(props.space!.id, selectedMember.value!.userId)
        success()
        message.success('成员已移除')
        showMemberModal.value = false
        // Reload members
        await loadMembers()
      } catch (error) {
        hapticError()
        message.error('移除成员失败')
      }
    }
  })
}

// Watch for tab changes to load members when switching to members tab
watch(activeTab, async (newTab) => {
  if (newTab === 'members' && members.value.length === 0 && isJoined.value) {
    await loadMembers()
  }
})

// Watch for space changes
watch(
  () => props.space,
  async (newSpace) => {
    if (newSpace && isJoined.value) {
      spaceEncrypted.value = newSpace.encrypted || false
    }
  }
)

// Lifecycle
onMounted(() => {
  // Load current user ID from user store
  currentUserId.value = userStore.userInfo?.uid || ''
})
</script>

<style scoped lang="scss">
.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;

    .header-title {
      font-size: 16px;
      font-weight: 600;
    }
  }
}

.space-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.space-info-card {
  padding: 20px;
  background: var(--card-color);
  border-bottom: 1px solid var(--border-color);

  .space-avatar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 16px;
    position: relative;

    .space-badges {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }

    .avatar-fallback {
      font-size: 32px;
      font-weight: 600;
    }
  }

  .space-name {
    text-align: center;
    margin: 0 0 8px 0;
    font-size: 22px;
    font-weight: 600;
  }

  .space-topic {
    text-align: center;
    margin: 0 0 16px 0;
    font-size: 14px;
    color: var(--text-color-2);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .space-stats {
    display: flex;
    justify-content: center;
    gap: 24px;
    margin-bottom: 16px;

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;

      &.unread {
        color: var(--error-color);
      }

      .stat-label {
        font-size: 11px;
        color: var(--text-color-3);
      }
    }
  }

  .space-address {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 16px;
    padding: 8px 16px;
    background: var(--body-color);
    border-radius: 8px;
  }

  .space-actions {
    margin-top: 8px;
  }
}

.tab-content {
  min-height: 300px;
}

.tab-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.room-list {
  display: flex;
  flex-direction: column;
}

.room-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--divider-color);
  cursor: pointer;
  transition: background 0.2s;

  &:active {
    background: var(--item-hover-bg);
  }

  .room-avatar {
    position: relative;
    flex-shrink: 0;

    .unread-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      background: var(--error-color);
      color: white;
      border-radius: 9px;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
    }
  }

  .room-info {
    flex: 1;
    min-width: 0;

    .room-name {
      font-size: 15px;
      font-weight: 500;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .room-meta {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: 12px;
      color: var(--text-color-3);
    }
  }

  .room-action {
    flex-shrink: 0;
    color: var(--text-color-3);
  }
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 12px;
}

.member-list {
  display: flex;
  flex-direction: column;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--divider-color);
  cursor: pointer;
  transition: background 0.2s;

  &:active {
    background: var(--item-hover-bg);
  }

  .member-info {
    flex: 1;
    min-width: 0;

    .member-name {
      font-size: 15px;
      font-weight: 500;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .member-role {
      display: flex;
      gap: 6px;
      align-items: center;
    }
  }

  .member-status {
    flex-shrink: 0;

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;

      &.online {
        background: #52c41a;
      }

      &.away {
        background: #faad14;
      }

      &.offline {
        background: var(--text-color-3);
      }
    }
  }
}

.invite-section {
  padding: 16px;
  border-top: 1px solid var(--border-color);
}

.settings-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;

  .setting-value {
    display: flex;
    align-items: center;
  }
}

.danger-item {
  &:hover {
    background: rgba(208, 48, 80, 0.1);
  }
}

.member-details {
  display: flex;
  flex-direction: column;
  gap: 20px;

  .member-avatar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .member-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
  }
}

.dialog-content {
  display: flex;
  flex-direction: column;
  background: var(--card-color, var(--hula-white)fff);
  border-radius: 12px;
  overflow: hidden;
  max-height: 80vh;

  .dialog-header {
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #f0f0f0);

    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--text-color-1);
      text-align: center;
    }
  }

  .dialog-actions {
    display: flex;
    gap: 8px;
    padding: 16px;
    border-top: 1px solid var(--border-color, #f0f0f0);

    .van-button {
      flex: 1;
    }
  }
}

// Safe area for mobile
@supports (padding: env(safe-area-inset-bottom)) {
  .drawer-header {
    padding-top: env(safe-area-inset-top);
  }

  .tab-content {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
</style>
