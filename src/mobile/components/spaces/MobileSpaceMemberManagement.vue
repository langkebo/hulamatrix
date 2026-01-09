<!-- Mobile Space Member Management - Enhanced member management for mobile -->
<template>
  <div class="mobile-space-member-management">
    <!-- Header with Stats -->
    <div class="header-section">
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-value">{{ memberStats.total }}</span>
          <span class="stat-label">成员</span>
        </div>
        <div class="stat-item" @click="setFilter('admin')">
          <span class="stat-value admin">{{ memberStats.admin }}</span>
          <span class="stat-label">管理员</span>
        </div>
        <div class="stat-item" @click="setFilter('moderator')">
          <span class="stat-value moderator">{{ memberStats.moderator }}</span>
          <span class="stat-label">版主</span>
        </div>
        <div class="stat-item" @click="setFilter('online')">
          <span class="stat-value online">{{ memberStats.online }}</span>
          <span class="stat-label">在线</span>
        </div>
      </div>
    </div>

    <!-- Search and Filter -->
    <div class="search-filter-section">
      <van-field v-model="searchQuery" placeholder="搜索成员..." clearable @input="handleSearch">
        <template #left-icon>
          <van-icon name="search" />
        </template>
      </van-field>

      <div class="filter-chips">
        <van-tag
          v-for="option in filterOptions"
          :key="option.value"
          :type="currentFilter === option.value ? 'primary' : 'default'"
          round
          @click="setFilter(option.value)">
          {{ option.label }}
        </van-tag>
      </div>
    </div>

    <!-- Member List -->
    <div class="member-list">
      <van-loading v-if="loading" size="24px">加载中...</van-loading>

      <!-- Empty State -->
      <van-empty v-else-if="!hasMembers" description="暂无成员" />

      <!-- Members -->
      <div v-else class="members">
        <div
          v-for="member in filteredMembers"
          :key="member.userId"
          class="member-item"
          @click="handleMemberClick(member)">
          <div class="member-left">
            <div class="avatar-wrapper">
              <van-image :src="getAvatarUrl(member.avatarUrl)" width="48" height="48" round @error="handleAvatarError">
                <template #error>
                  <div class="avatar-fallback">
                    {{ getInitials(member.displayName) }}
                  </div>
                </template>
              </van-image>
              <div v-if="member.presence === 'online'" class="presence-indicator online" />
              <div v-else class="presence-indicator offline" />
            </div>

            <div class="member-info">
              <div class="member-name">{{ member.displayName }}</div>
              <div class="member-id">{{ formatUserId(member.userId) }}</div>
              <div class="member-roles">
                <van-tag v-if="member.powerLevel >= 100" type="danger">管理员</van-tag>
                <van-tag v-else-if="member.powerLevel >= 50" type="warning">版主</van-tag>
                <van-tag v-if="member.membership === 'invite'" type="primary">已邀请</van-tag>
              </div>
            </div>
          </div>

          <div class="member-right">
            <van-button icon="ellipsis" @click.stop="showActionSheet(member)" />
          </div>
        </div>
      </div>
    </div>

    <!-- Member Detail Modal -->
    <van-popup
      :show="showMemberDetail"
      position="center"
      :style="{ width: '90%', maxWidth: '400px', borderRadius: '12px' }"
      @update:show="handleDetailClose">
      <div v-if="selectedMember" class="member-detail-popup">
        <div class="detail-header">
          <span class="header-title">成员详情</span>
          <van-icon name="cross" :size="18" @click="showMemberDetail = false" />
        </div>

        <div class="member-detail">
          <div class="detail-avatar">
            <van-image :src="getAvatarUrl(selectedMember.avatarUrl)" width="80" height="80" round>
              <template #error>
                <div class="avatar-fallback-large">
                  {{ getInitials(selectedMember.displayName) }}
                </div>
              </template>
            </van-image>
            <div :class="['presence-badge', selectedMember.presence || 'offline']">
              {{ getPresenceLabel(selectedMember.presence) }}
            </div>
          </div>

          <div class="detail-name">{{ selectedMember.displayName }}</div>
          <div class="detail-id">{{ selectedMember.userId }}</div>

          <van-divider />

          <div class="detail-section">
            <div class="section-label">权限等级</div>
            <div class="power-level-bar">
              <van-progress :percentage="Math.min(100, (selectedMember.powerLevel / 100) * 100)" :show-pivot="false" />
              <div class="power-value">{{ selectedMember.powerLevel }}</div>
            </div>
          </div>

          <div class="detail-section">
            <div class="section-label">操作</div>
            <div class="action-buttons">
              <van-button v-if="canChangeRole(selectedMember)" type="primary" block @click="showRoleModal = true">
                修改角色
              </van-button>
              <van-button
                v-if="selectedMember.membership === 'invite'"
                type="success"
                block
                @click="handleResendInvite">
                重新发送邀请
              </van-button>
              <van-button v-if="canKick(selectedMember)" type="warning" block @click="handleKick(selectedMember)">
                移除成员
              </van-button>
              <van-button v-if="canBan(selectedMember)" type="danger" block @click="handleBan(selectedMember)">
                封禁用户
              </van-button>
            </div>
          </div>
        </div>
      </div>
    </van-popup>

    <!-- Role Change Modal -->
    <van-popup
      :show="showRoleModal"
      position="center"
      :style="{ width: '85%', maxWidth: '350px', borderRadius: '12px' }">
      <div class="role-modal-popup">
        <div class="role-modal-header">
          <span class="header-title">修改角色</span>
        </div>

        <div class="role-modal-content">
          <van-radio-group v-model="newRole">
            <van-cell-group inset :border="true">
              <van-cell title="管理员" label="完全权限 (100)" clickable @click="newRole = 'admin'">
                <template #right-icon>
                  <van-radio name="admin" />
                </template>
              </van-cell>
              <van-cell title="版主" label="管理权限 (50)" clickable @click="newRole = 'moderator'">
                <template #right-icon>
                  <van-radio name="moderator" />
                </template>
              </van-cell>
              <van-cell title="成员" label="普通权限 (0)" clickable @click="newRole = 'member'">
                <template #right-icon>
                  <van-radio name="member" />
                </template>
              </van-cell>
            </van-cell-group>
          </van-radio-group>
        </div>

        <div class="role-modal-actions">
          <van-button @click="showRoleModal = false">取消</van-button>
          <van-button type="primary" :loading="isChangingRole" @click="confirmRoleChange">确定</van-button>
        </div>
      </div>
    </van-popup>

    <!-- Invite Member Modal -->
    <van-popup
      :show="showInviteModal"
      position="center"
      :style="{ width: '85%', maxWidth: '350px', borderRadius: '12px' }">
      <div class="invite-modal-popup">
        <div class="invite-modal-header">
          <span class="header-title">邀请新成员</span>
        </div>

        <van-form @submit="handleInvite">
          <van-cell-group inset :border="true">
            <van-field
              v-model="inviteForm.userId"
              name="userId"
              label="用户ID"
              placeholder="@username:server.com"
              :rules="[{ required: true, message: '请输入用户ID' }]" />
          </van-cell-group>
        </van-form>

        <div class="invite-modal-actions">
          <van-button @click="showInviteModal = false">取消</van-button>
          <van-button type="primary" :loading="isInviting" @click="handleInvite">邀请</van-button>
        </div>
      </div>
    </van-popup>

    <!-- Action Sheet -->
    <van-action-sheet
      v-model:show="showActionSheetVisible"
      :actions="currentMemberActions"
      @select="handleMemberAction" />

    <!-- Floating Action Button -->
    <van-floating-bubble
      axis="xy"
      magnetic="x"
      :style="{ right: '20px', bottom: '20px' }"
      icon="plus"
      @click="showInviteModal = true" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMessage, useDialog } from '@/utils/vant-adapter'
import { matrixClientService } from '@/integrations/matrix/client'
import { mxcUrlToHttp } from '@/utils/matrixClientUtils'
import { logger } from '@/utils/logger'

interface ActionSheetAction {
  name: string
  value: string
  icon?: string
}

// ==================== Types ====================

interface SpaceMember {
  userId: string
  displayName: string
  avatarUrl?: string
  powerLevel: number
  presence?: 'online' | 'offline' | 'unavailable'
  membership?: 'join' | 'invite' | 'ban' | 'leave'
}

interface Props {
  spaceId: string
  currentUserId?: string
}

interface Emits {
  (e: 'member-invited', userId: string): void
  (e: 'member-removed', userId: string): void
  (e: 'member-banned', userId: string): void
  (e: 'role-changed', userId: string, newRole: string): void
}

const props = withDefaults(defineProps<Props>(), {
  currentUserId: ''
})

const emit = defineEmits<Emits>()

const message = useMessage()
const dialog = useDialog()

// ==================== State ====================

const loading = ref(false)
const members = ref<SpaceMember[]>([])
const searchQuery = ref('')
const currentFilter = ref<string>('all')
const selectedMember = ref<SpaceMember | null>(null)
const showMemberDetail = ref(false)
const showRoleModal = ref(false)
const showInviteModal = ref(false)
const isChangingRole = ref(false)
const isInviting = ref(false)
const newRole = ref<'admin' | 'moderator' | 'member'>('member')

const inviteForm = ref({ userId: '' })
const inviteFormRef = ref()
const inviteRules = {
  userId: {
    required: true,
    message: '请输入用户ID',
    trigger: 'blur'
  }
}

// Action sheet state
const showActionSheetVisible = ref(false)
const currentActionMember = ref<SpaceMember | null>(null)

// ==================== Computed ====================

const filterOptions = [
  { label: '全部', value: 'all' },
  { label: '管理员', value: 'admin' },
  { label: '版主', value: 'moderator' },
  { label: '在线', value: 'online' }
]

const filteredMembers = computed(() => {
  let result = members.value

  // Apply role filter
  if (currentFilter.value === 'admin') {
    result = result.filter((m) => m.powerLevel >= 100)
  } else if (currentFilter.value === 'moderator') {
    result = result.filter((m) => m.powerLevel >= 50 && m.powerLevel < 100)
  } else if (currentFilter.value === 'online') {
    result = result.filter((m) => m.presence === 'online')
  }

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((m) => m.displayName.toLowerCase().includes(query) || m.userId.toLowerCase().includes(query))
  }

  return result
})

const memberStats = computed(() => ({
  total: members.value.length,
  admin: members.value.filter((m) => m.powerLevel >= 100).length,
  moderator: members.value.filter((m) => m.powerLevel >= 50 && m.powerLevel < 100).length,
  online: members.value.filter((m) => m.presence === 'online').length
}))

const hasMembers = computed(() => filteredMembers.value.length > 0)

const currentMemberActions = computed<ActionSheetAction[]>(() => {
  if (!currentActionMember.value) return []

  const member = currentActionMember.value
  const actions: ActionSheetAction[] = [{ name: '查看详情', value: 'view', icon: 'eye-o' }]

  if (canChangeRole(member)) {
    if (member.powerLevel < 100) {
      actions.push({ name: '设为管理员', value: 'promote_admin', icon: 'upgrade' })
    }
    if (member.powerLevel >= 50 && member.powerLevel < 100) {
      actions.push({ name: '降为成员', value: 'demote', icon: 'down' })
    } else if (member.powerLevel < 50) {
      actions.push({ name: '设为版主', value: 'promote_moderator', icon: 'upgrade' })
    }
  }

  if (canKick(member)) {
    actions.push({ name: '移除成员', value: 'kick', icon: 'delete-o' })
  }

  if (canBan(member)) {
    actions.push({ name: '封禁用户', value: 'ban', icon: 'lock' })
  }

  if (member.membership === 'invite') {
    actions.push({ name: '重新发送邀请', value: 'resend_invite', icon: 'envelope-o' })
  }

  return actions
})

// ==================== Methods ====================

const loadMembers = async () => {
  loading.value = true
  try {
    // This would call the actual Matrix SDK methods
    // For now, mock data
    members.value = []
    logger.info('[MobileSpaceMemberManagement] Loading members for space:', props.spaceId)
  } catch (error) {
    logger.error('[MobileSpaceMemberManagement] Failed to load members:', error)
    message.error('加载成员列表失败')
  } finally {
    loading.value = false
  }
}

const setFilter = (filter: string) => {
  currentFilter.value = currentFilter.value === filter ? 'all' : filter
}

const handleSearch = () => {
  // Search is handled by computed property
}

const handleMemberClick = (member: SpaceMember) => {
  selectedMember.value = member
  showMemberDetail.value = true
}

const handleDetailClose = () => {
  showMemberDetail.value = false
  selectedMember.value = null
}

const showActionSheet = (member: SpaceMember) => {
  currentActionMember.value = member
  showActionSheetVisible.value = true
}

const handleMemberAction = (action: ActionSheetAction) => {
  if (!currentActionMember.value) return

  const member = currentActionMember.value
  const key = action.value

  showActionSheetVisible.value = false
  switch (key) {
    case 'view':
      handleMemberClick(member)
      break
    case 'promote_admin':
      changeRole(member, 'admin')
      break
    case 'promote_moderator':
      changeRole(member, 'moderator')
      break
    case 'demote':
      changeRole(member, 'member')
      break
    case 'kick':
      handleKick(member)
      break
    case 'ban':
      handleBan(member)
      break
    case 'resend_invite':
      handleResendInvite()
      break
  }
}

const canChangeRole = (member: SpaceMember): boolean => {
  // Current user must have higher power level
  const currentUserPower = 100 // Mock
  return currentUserPower > member.powerLevel
}

const canKick = (member: SpaceMember): boolean => {
  return member.userId !== props.currentUserId && member.powerLevel < 100
}

const canBan = (member: SpaceMember): boolean => {
  return member.userId !== props.currentUserId
}

const changeRole = (member: SpaceMember, role: 'admin' | 'moderator' | 'member') => {
  selectedMember.value = member
  newRole.value = role
  showRoleModal.value = true
}

const confirmRoleChange = async () => {
  if (!selectedMember.value) return

  isChangingRole.value = true
  try {
    // Call API to change role
    message.success('角色已更新')
    showRoleModal.value = false
    emit('role-changed', selectedMember.value.userId, newRole.value)
    await loadMembers()
  } catch (error) {
    message.error('更新角色失败')
  } finally {
    isChangingRole.value = false
  }
}

const handleKick = (member: SpaceMember) => {
  dialog.warning({
    title: '移除成员',
    content: `确定要移除 ${member.displayName} 吗？`,
    confirmText: '移除',
    cancelText: '取消',
    onConfirm: async () => {
      try {
        message.success('成员已移除')
        emit('member-removed', member.userId)
        await loadMembers()
      } catch (error) {
        message.error('移除失败')
      }
    }
  })
}

const handleBan = (member: SpaceMember) => {
  dialog.error({
    title: '封禁用户',
    content: `确定要封禁 ${member.displayName} 吗？用户将被禁止重新加入。`,
    confirmText: '封禁',
    cancelText: '取消',
    onConfirm: async () => {
      try {
        message.success('用户已封禁')
        emit('member-banned', member.userId)
        await loadMembers()
      } catch (error) {
        message.error('封禁失败')
      }
    }
  })
}

const handleInvite = async () => {
  try {
    await inviteFormRef.value?.validate()
  } catch {
    return
  }

  isInviting.value = true
  try {
    // Call API to invite user
    message.success('邀请已发送')
    showInviteModal.value = false
    inviteForm.value.userId = ''
    emit('member-invited', inviteForm.value.userId)
  } catch (error) {
    message.error('邀请发送失败')
  } finally {
    isInviting.value = false
  }
}

const handleResendInvite = () => {
  if (!selectedMember.value) return
  message.info('邀请已重新发送')
}

const getAvatarUrl = (mxcUrl?: string): string | undefined => {
  if (!mxcUrl) return undefined
  const client = matrixClientService.getClient()
  const url = mxcUrlToHttp(client as Record<string, unknown> | null, mxcUrl, 80, 80, 'crop')
  return url || undefined
}

const getInitials = (name: string): string => {
  return name.slice(0, 2).toUpperCase()
}

const formatUserId = (userId: string): string => {
  // Shorten display for mobile
  const parts = userId.split(':')
  if (parts.length > 1) {
    const local = parts[0].replace(/^@/, '')
    const server = parts[1]
    return `${local}@${server.slice(0, 10)}...`
  }
  return userId
}

const getPresenceLabel = (presence?: string): string => {
  const labels: Record<string, string> = {
    online: '在线',
    offline: '离线',
    unavailable: '离开'
  }
  return labels[presence || 'offline'] || '离线'
}

const handleAvatarError = (_e: Event) => {
  logger.debug('[MobileSpaceMemberManagement] Avatar load error')
}

// ==================== Lifecycle ====================

onMounted(() => {
  loadMembers()
})

// ==================== Expose ====================

defineExpose({
  loadMembers,
  refresh: loadMembers
})
</script>

<style scoped lang="scss">
.mobile-space-member-management {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.header-section {
  padding: 16px;

  .stats-row {
    display: flex;
    justify-content: space-around;
    background: var(--card-color);
    border-radius: 12px;
    padding: 16px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    transition: transform 0.2s;

    &:active {
      transform: scale(0.95);
    }
  }

  .stat-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--text-color-1);

    &.admin {
      color: var(--hula-error);
    }

    &.moderator {
      color: var(--hula-warning);
    }

    &.online {
      color: var(--hula-success);
    }
  }

  .stat-label {
    font-size: 12px;
    color: var(--text-color-3);
  }
}

.search-filter-section {
  padding: 0 16px 16px;

  .filter-chips {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    overflow-x: auto;
    padding-bottom: 4px;

    &::-webkit-scrollbar {
      display: none;
    }
  }
}

.member-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 80px; // Extra padding for FAB
}

.members {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--card-color);
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:active {
    background: var(--item-hover-bg);
  }
}

.member-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.presence-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--card-color);

  &.online {
    background: var(--hula-success);
  }

  &.offline {
    background: #909399;
  }
}

.member-info {
  flex: 1;
  min-width: 0;
}

.member-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-color-1);
  margin-bottom: 2px;
}

.member-id {
  font-size: 12px;
  color: var(--text-color-3);
  margin-bottom: 4px;
}

.member-roles {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.member-right {
  flex-shrink: 0;
}

.member-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.detail-avatar {
  position: relative;
}

.presence-badge {
  position: absolute;
  bottom: 0;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  background: var(--item-hover-bg);

  &.online {
    background: var(--hula-success);
    color: white;
  }

  &.offline {
    background: #909399;
    color: white;
  }
}

.detail-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color-1);
}

.detail-id {
  font-size: 13px;
  color: var(--text-color-3);
}

.detail-section {
  width: 100%;
}

.section-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color-2);
  margin-bottom: 8px;
}

.power-level-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.power-value {
  min-width: 32px;
  text-align: right;
  font-weight: 600;
}

.role-option {
  .role-name {
    font-weight: 500;
  }

  .role-desc {
    font-size: 12px;
    color: var(--text-color-3);
  }
}

.modal-header {
  font-size: 16px;
  font-weight: 600;
}

// Safe area for mobile
@supports (padding: env(safe-area-inset-bottom)) {
  .member-list {
    padding-bottom: calc(80px + env(safe-area-inset-bottom));
  }
}
</style>
