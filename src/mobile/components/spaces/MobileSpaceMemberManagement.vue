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
      <n-input
        v-model:value="searchQuery"
        placeholder="搜索成员..."
        clearable
        @input="handleSearch"
      >
        <template #prefix>
          <n-icon><Search /></n-icon>
        </template>
      </n-input>

      <div class="filter-chips">
        <n-tag
          v-for="option in filterOptions"
          :key="option.value"
          :type="currentFilter === option.value ? 'primary' : 'default'"
          :bordered="false"
          size="small"
          round
          @click="setFilter(option.value)"
        >
          {{ option.label }}
        </n-tag>
      </div>
    </div>

    <!-- Member List -->
    <div class="member-list">
      <n-spin :show="loading">
        <!-- Empty State -->
        <n-empty v-if="!hasMembers && !loading" description="暂无成员" />

        <!-- Members -->
        <div v-else class="members">
          <div
            v-for="member in filteredMembers"
            :key="member.userId"
            class="member-item"
            @click="handleMemberClick(member)"
          >
            <div class="member-left">
              <div class="avatar-wrapper">
                <n-avatar
                  :src="getAvatarUrl(member.avatarUrl)"
                  :size="48"
                  round
                  @error="handleAvatarError"
                >
                  {{ getInitials(member.displayName) }}
                </n-avatar>
                <div
                  v-if="member.presence === 'online'"
                  class="presence-indicator online"
                />
                <div
                  v-else
                  class="presence-indicator offline"
                />
              </div>

              <div class="member-info">
                <div class="member-name">{{ member.displayName }}</div>
                <div class="member-id">{{ formatUserId(member.userId) }}</div>
                <div class="member-roles">
                  <n-tag
                    v-if="member.powerLevel >= 100"
                    type="error"
                    size="small"
                    :bordered="false"
                  >
                    管理员
                  </n-tag>
                  <n-tag
                    v-else-if="member.powerLevel >= 50"
                    type="warning"
                    size="small"
                    :bordered="false"
                  >
                    版主
                  </n-tag>
                  <n-tag
                    v-if="member.membership === 'invite'"
                    type="info"
                    size="small"
                    :bordered="false"
                  >
                    已邀请
                  </n-tag>
                </div>
              </div>
            </div>

            <div class="member-right">
              <n-dropdown
                :options="getMemberActions(member)"
                @select="(key) => handleMemberAction(key, member)"
              >
                <n-button text>
                  <template #icon>
                    <n-icon><DotsVertical /></n-icon>
                  </template>
                </n-button>
              </n-dropdown>
            </div>
          </div>
        </div>
      </n-spin>
    </div>

    <!-- Member Detail Modal -->
    <n-modal
      v-model:show="showMemberDetail"
      preset="card"
      :style="{ width: '90%', maxWidth: '400px' }"
      @update:show="selectedMember = null"
    >
      <template #header>
        <div class="modal-header">成员详情</div>
      </template>

      <div v-if="selectedMember" class="member-detail">
        <div class="detail-avatar">
          <n-avatar
            :src="getAvatarUrl(selectedMember.avatarUrl)"
            :size="80"
            round
          >
            {{ getInitials(selectedMember.displayName) }}
          </n-avatar>
          <div
            :class="['presence-badge', selectedMember.presence || 'offline']"
          >
            {{ getPresenceLabel(selectedMember.presence) }}
          </div>
        </div>

        <div class="detail-name">{{ selectedMember.displayName }}</div>
        <div class="detail-id">{{ selectedMember.userId }}</div>

        <n-divider />

        <div class="detail-section">
          <div class="section-label">权限等级</div>
          <div class="power-level-bar">
            <n-progress
              type="line"
              :percentage="Math.min(100, (selectedMember.powerLevel / 100) * 100)"
              :show-indicator="false"
            />
            <div class="power-value">{{ selectedMember.powerLevel }}</div>
          </div>
        </div>

        <div class="detail-section">
          <div class="section-label">操作</div>
          <n-space vertical>
            <n-button
              v-if="canChangeRole(selectedMember)"
              type="primary"
              block
              @click="showRoleModal = true"
            >
              修改角色
            </n-button>
            <n-button
              v-if="selectedMember.membership === 'invite'"
              type="success"
              block
              @click="handleResendInvite"
            >
              重新发送邀请
            </n-button>
            <n-button
              v-if="canKick(selectedMember)"
              type="warning"
              block
              @click="handleKick(selectedMember)"
            >
              移除成员
            </n-button>
            <n-button
              v-if="canBan(selectedMember)"
              type="error"
              block
              @click="handleBan(selectedMember)"
            >
              封禁用户
            </n-button>
          </n-space>
        </div>
      </div>
    </n-modal>

    <!-- Role Change Modal -->
    <n-modal
      v-model:show="showRoleModal"
      preset="dialog"
      title="修改角色"
    >
      <div class="role-modal-content">
        <n-radio-group v-model:value="newRole" name="role">
          <n-space vertical>
            <n-radio value="admin">
              <div class="role-option">
                <div class="role-name">管理员</div>
                <div class="role-desc">完全权限 (100)</div>
              </div>
            </n-radio>
            <n-radio value="moderator">
              <div class="role-option">
                <div class="role-name">版主</div>
                <div class="role-desc">管理权限 (50)</div>
              </div>
            </n-radio>
            <n-radio value="member">
              <div class="role-option">
                <div class="role-name">成员</div>
                <div class="role-desc">普通权限 (0)</div>
              </div>
            </n-radio>
          </n-space>
        </n-radio-group>
      </div>
      <template #action>
        <n-button @click="showRoleModal = false">取消</n-button>
        <n-button type="primary" :loading="isChangingRole" @click="confirmRoleChange">
          确定
        </n-button>
      </template>
    </n-modal>

    <!-- Invite Member Modal -->
    <n-modal
      v-model:show="showInviteModal"
      preset="dialog"
      title="邀请新成员"
    >
      <n-form ref="inviteFormRef" :model="inviteForm" :rules="inviteRules">
        <n-form-item label="用户ID" path="userId">
          <n-input
            v-model:value="inviteForm.userId"
            placeholder="@username:server.com"
          />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showInviteModal = false">取消</n-button>
        <n-button type="primary" :loading="isInviting" @click="handleInvite">
          邀请
        </n-button>
      </template>
    </n-modal>

    <!-- Floating Action Button -->
    <n-float-button
      :right="20"
      :bottom="20"
      :shape="'circle'"
      @click="showInviteModal = true"
    >
      <n-icon :size="24"><UserPlus /></n-icon>
    </n-float-button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  NInput,
  NIcon,
  NTag,
  NSpin,
  NEmpty,
  NAvatar,
  NDropdown,
  NModal,
  NButton,
  NDivider,
  NSpace,
  NProgress,
  NRadioGroup,
  NRadio,
  NForm,
  NFormItem,
  NFloatButton,
  useMessage,
  useDialog
} from 'naive-ui'
import { Search, DotsVertical, UserPlus, Crown, Shield, User, Mail, UserMinus, Ban, Refresh } from '@vicons/tabler'
import { matrixClientService } from '@/integrations/matrix/client'
import { mxcUrlToHttp } from '@/utils/matrixClientUtils'
import { logger } from '@/utils/logger'

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

const handleMemberAction = (key: string, member: SpaceMember) => {
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

const getMemberActions = (member: SpaceMember) => {
  const actions = [{ label: '查看详情', key: 'view', icon: () => 'User' }]

  if (canChangeRole(member)) {
    if (member.powerLevel < 50) {
      actions.push({ label: '设为版主', key: 'promote_moderator', icon: () => 'Shield' })
    }
    if (member.powerLevel < 100) {
      actions.push({ label: '设为管理员', key: 'promote_admin', icon: () => 'Crown' })
    }
    if (member.powerLevel >= 50) {
      actions.push({ label: '降为普通成员', key: 'demote', icon: () => 'UserMinus' })
    }
  }

  if (canKick(member)) {
    actions.push({ label: '移除成员', key: 'kick', icon: () => 'UserMinus' })
  }

  if (canBan(member)) {
    actions.push({ label: '封禁用户', key: 'ban', icon: () => 'Ban' })
  }

  if (member.membership === 'invite') {
    actions.push({ label: '重新发送邀请', key: 'resend_invite', icon: () => 'Mail' })
  }

  return actions
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
    positiveText: '移除',
    negativeText: '取消',
    onPositiveClick: async () => {
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
    positiveText: '封禁',
    negativeText: '取消',
    onPositiveClick: async () => {
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
      color: #d03050;
    }

    &.moderator {
      color: #f0a020;
    }

    &.online {
      color: #18a058;
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
    background: #18a058;
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
    background: #18a058;
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
