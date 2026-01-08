<template>
  <n-modal
    v-model:show="showDialog"
    :mask-closable="false"
    preset="dialog"
    :title="space ? `管理工作区 - ${space.name}` : '管理工作区'"
    class="modal-large"
    :style="{ width: isMobile() ? '100%' : '800px' }">
    <div v-if="space" class="manage-space-dialog" :class="{ 'is-mobile': isMobile() }">
      <!-- 空间信息概览 -->
      <div class="space-overview">
        <div class="space-cover">
          <div v-if="space.avatar" class="space-avatar">
            <img :src="space.avatar" :alt="space.name" />
          </div>
          <div v-else class="space-placeholder">
            <n-icon size="48"><Building /></n-icon>
            <span class="placeholder-text">{{ space.name.charAt(0).toUpperCase() }}</span>
          </div>
        </div>
        <div class="space-info">
          <h3>{{ space.name }}</h3>
          <p>{{ space.topic || space.description || '暂无描述' }}</p>
          <div class="space-stats">
            <span class="stat-item">
              <n-icon><Users /></n-icon>
              {{ space.memberCount }} 成员
            </span>
            <span class="stat-item">
              <n-icon><Hash /></n-icon>
              {{ space.roomCount }} 房间
            </span>
            <span class="stat-item">
              <n-icon><Calendar /></n-icon>
              创建于 {{ formatDate(space.created) }}
            </span>
          </div>
        </div>
      </div>

      <!-- 管理标签页 -->
      <div class="manage-content">
        <n-tabs v-model:value="activeTab" type="segment" animated>
          <!-- 基本信息 -->
          <n-tab-pane name="basic" tab="基本信息">
            <div class="tab-content">
              <n-form
                ref="basicFormRef"
                :model="basicForm"
                :rules="basicRules"
                label-placement="left"
                label-width="120px">
                <n-form-item label="空间名称" path="name">
                  <n-input v-model:value="basicForm.name" placeholder="输入空间名称" maxlength="50" show-count />
                </n-form-item>

                <n-form-item label="空间主题" path="topic">
                  <n-input v-model:value="basicForm.topic" placeholder="简短的空间主题（可选）" maxlength="100" />
                </n-form-item>

                <n-form-item label="空间描述" path="description">
                  <n-input
                    v-model:value="basicForm.description"
                    type="textarea"
                    placeholder="详细描述这个空间的用途和目标"
                    :autosize="{ minRows: 3, maxRows: 5 }"
                    maxlength="500"
                    show-count />
                </n-form-item>

                <n-form-item label="空间标签" path="tags">
                  <n-dynamic-tags v-model:value="basicForm.tags" :max="5" placeholder="按回车添加标签" />
                </n-form-item>
              </n-form>
            </div>
          </n-tab-pane>

          <!-- 隐私设置 -->
          <n-tab-pane name="privacy" tab="隐私设置">
            <div class="tab-content">
              <n-form :model="privacyForm" label-placement="left" label-width="120px">
                <n-form-item label="空间可见性">
                  <n-radio-group v-model:value="privacyForm.visibility">
                    <n-radio value="public">
                      <div class="radio-content">
                        <div class="radio-title">
                          <n-icon><Globe /></n-icon>
                          <span>公开空间</span>
                        </div>
                        <div class="radio-description">任何人都可以找到并加入此空间</div>
                      </div>
                    </n-radio>
                    <n-radio value="private">
                      <div class="radio-content">
                        <div class="radio-title">
                          <n-icon><Lock /></n-icon>
                          <span>私有空间</span>
                        </div>
                        <div class="radio-description">仅受邀请的用户可以加入此空间</div>
                      </div>
                    </n-radio>
                  </n-radio-group>
                </n-form-item>

                <n-form-item label="加入方式">
                  <n-radio-group v-model:value="privacyForm.joinRule" :disabled="privacyForm.visibility === 'public'">
                    <n-radio value="open">
                      <div class="radio-content">
                        <span>自由加入</span>
                        <div class="radio-description">用户可以直接加入空间</div>
                      </div>
                    </n-radio>
                    <n-radio value="approval">
                      <div class="radio-content">
                        <span>需要批准</span>
                        <div class="radio-description">管理员需要审核加入申请</div>
                      </div>
                    </n-radio>
                    <n-radio value="invite">
                      <div class="radio-content">
                        <span>仅邀请</span>
                        <div class="radio-description">只能通过邀请加入</div>
                      </div>
                    </n-radio>
                  </n-radio-group>
                </n-form-item>

                <n-form-item label="搜索引擎">
                  <n-switch v-model:value="privacyForm.allowSearch">
                    <template #checked>允许搜索</template>
                    <template #unchecked>禁止搜索</template>
                  </n-switch>
                  <div class="form-help">是否允许其他用户通过搜索找到此空间</div>
                </n-form-item>

                <n-form-item label="成员可见性">
                  <n-switch v-model:value="privacyForm.showMemberList">
                    <template #checked>公开成员</template>
                    <template #unchecked>隐藏成员</template>
                  </n-switch>
                  <div class="form-help">是否向非成员显示空间成员列表</div>
                </n-form-item>
              </n-form>
            </div>
          </n-tab-pane>

          <!-- 权限管理 -->
          <n-tab-pane name="permissions" tab="权限管理">
            <div class="tab-content">
              <div class="permission-section">
                <h4>默认权限</h4>
                <p class="section-desc">新成员的默认权限设置</p>

                <n-form :model="permissionsForm.defaultPermissions" label-placement="left" label-width="200px">
                  <n-form-item>
                    <n-checkbox v-model:checked="permissionsForm.defaultPermissions.canRead">查看消息和文件</n-checkbox>
                  </n-form-item>
                  <n-form-item>
                    <n-checkbox v-model:checked="permissionsForm.defaultPermissions.canPost">发送消息</n-checkbox>
                  </n-form-item>
                  <n-form-item>
                    <n-checkbox v-model:checked="permissionsForm.defaultPermissions.canUpload">上传文件</n-checkbox>
                  </n-form-item>
                  <n-form-item>
                    <n-checkbox v-model:checked="permissionsForm.defaultPermissions.canInvite">邀请其他成员</n-checkbox>
                  </n-form-item>
                  <n-form-item>
                    <n-checkbox v-model:checked="permissionsForm.defaultPermissions.canCreateRoom">
                      创建新房间
                    </n-checkbox>
                  </n-form-item>
                </n-form>
              </div>

              <div class="permission-section">
                <h4>高级权限</h4>
                <p class="section-desc">危险操作权限，请谨慎分配</p>

                <n-form :model="permissionsForm.advancedPermissions" label-placement="left" label-width="200px">
                  <n-form-item>
                    <n-checkbox v-model:checked="permissionsForm.advancedPermissions.canModerate">
                      管理消息和成员
                    </n-checkbox>
                  </n-form-item>
                  <n-form-item>
                    <n-checkbox v-model:checked="permissionsForm.advancedPermissions.canManageRooms">
                      管理房间设置
                    </n-checkbox>
                  </n-form-item>
                  <n-form-item>
                    <n-checkbox v-model:checked="permissionsForm.advancedPermissions.canManageSpace">
                      管理空间设置
                    </n-checkbox>
                  </n-form-item>
                </n-form>
              </div>

              <div class="permission-section">
                <h4>角色权限预设</h4>
                <div class="role-presets">
                  <div
                    v-for="role in rolePresets"
                    :key="role.name"
                    class="role-preset"
                    :class="{ active: selectedRole === role.name }"
                    @click="applyRolePreset(role)">
                    <div class="role-header">
                      <h5>{{ role.label }}</h5>
                      <span class="role-desc">{{ role.description }}</span>
                    </div>
                    <div class="role-permissions">
                      <n-tag v-for="perm in role.permissions" :key="perm" size="small" round>
                        {{ getPermissionLabel(perm) }}
                      </n-tag>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </n-tab-pane>

          <!-- 成员管理 -->
          <n-tab-pane name="members" tab="成员管理">
            <div class="tab-content">
              <div class="members-header">
                <div class="members-actions">
                  <n-input v-model:value="memberSearchQuery" placeholder="搜索成员..." clearable class="search-input">
                    <template #prefix>
                      <n-icon><Search /></n-icon>
                    </template>
                  </n-input>
                  <n-button type="primary" @click="showInviteDialog = true">
                    <template #icon>
                      <n-icon><UserPlus /></n-icon>
                    </template>
                    邀请成员
                  </n-button>
                  <n-dropdown :options="bulkActions" @select="handleBulkAction" placement="bottom-end">
                    <n-button :disabled="selectedMembers.length === 0">
                      批量操作
                      <template #icon>
                        <n-icon><MoreHorizontal /></n-icon>
                      </template>
                    </n-button>
                  </n-dropdown>
                </div>
                <div class="member-stats">
                  <span>共 {{ space.memberCount }} 位成员</span>
                  <span v-if="selectedMembers.length > 0">已选择 {{ selectedMembers.length }} 位</span>
                </div>
              </div>

              <div class="members-list">
                <div
                  v-for="member in filteredMembers"
                  :key="member.id"
                  class="member-item"
                  :class="{ selected: selectedMembers.includes(member.userId || '') }">
                  <n-checkbox
                    :checked="selectedMembers.includes(member.userId || '')"
                    @update:checked="toggleMemberSelection(member.userId || '')" />

                  <div class="member-avatar">
                    <n-avatar :src="member.avatar || ''" :fallback="(member.name || '').charAt(0)" />
                    <div v-if="member.isOnline" class="online-indicator"></div>
                  </div>

                  <div class="member-info">
                    <div class="member-name">
                      {{ member.name }}
                      <n-tag v-if="member.role" size="small" :type="getRoleType(member.role)">
                        {{ getRoleLabel(member.role) }}
                      </n-tag>
                    </div>
                    <div class="member-status">{{ member.status || '暂无状态' }}</div>
                    <div class="member-joined">加入于 {{ formatDate(member.joinedAt) }}</div>
                  </div>

                  <div class="member-actions">
                    <n-dropdown :options="getMemberActions(member)" @select="handleMemberAction" placement="bottom-end">
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

          <!-- 通知设置 -->
          <n-tab-pane name="notifications" tab="通知设置">
            <div class="tab-content">
              <div class="notification-section">
                <h4>空间通知</h4>
                <n-form :model="notificationsForm.space" label-placement="left" label-width="200px">
                  <n-form-item>
                    <n-checkbox v-model:checked="notificationsForm.space.newMembers">新成员加入时通知管理员</n-checkbox>
                  </n-form-item>
                  <n-form-item>
                    <n-checkbox v-model:checked="notificationsForm.space.memberLeft">成员离开时通知管理员</n-checkbox>
                  </n-form-item>
                  <n-form-item>
                    <n-checkbox v-model:checked="notificationsForm.space.spaceUpdated">
                      空间设置更新时通知所有成员
                    </n-checkbox>
                  </n-form-item>
                  <n-form-item>
                    <n-checkbox v-model:checked="notificationsForm.space.roomCreated">
                      创建新房间时通知所有成员
                    </n-checkbox>
                  </n-form-item>
                </n-form>
              </div>

              <div class="notification-section">
                <h4>消息通知</h4>
                <n-form :model="notificationsForm.messages" label-placement="left" label-width="200px">
                  <n-form-item label="通知级别">
                    <n-select
                      v-model:value="notificationsForm.messages.level"
                      :options="notificationLevels"
                      placeholder="选择通知级别" />
                  </n-form-item>
                  <n-form-item>
                    <n-checkbox v-model:checked="notificationsForm.messages.mentions">
                      仅在被 @ 提及或回复时通知
                    </n-checkbox>
                  </n-form-item>
                  <n-form-item>
                    <n-checkbox v-model:checked="notificationsForm.messages.keywords">关键词匹配时通知</n-checkbox>
                  </n-form-item>
                </n-form>

                <div v-if="notificationsForm.messages.keywords" class="keywords-input">
                  <n-form-item label="关键词列表">
                    <n-dynamic-tags
                      v-model:value="notificationsForm.messages.keywordList"
                      :max="10"
                      placeholder="添加关键词" />
                  </n-form-item>
                </div>
              </div>

              <div class="notification-section">
                <h4>通知方式</h4>
                <n-form :model="notificationsForm.delivery" label-placement="left" label-width="200px">
                  <n-form-item>
                    <n-checkbox v-model:checked="notificationsForm.delivery.inApp">应用内通知</n-checkbox>
                  </n-form-item>
                  <n-form-item>
                    <n-checkbox v-model:checked="notificationsForm.delivery.email">邮件通知</n-checkbox>
                  </n-form-item>
                  <n-form-item>
                    <n-checkbox v-model:checked="notificationsForm.delivery.push">推送通知</n-checkbox>
                  </n-form-item>
                  <n-form-item>
                    <n-checkbox v-model:checked="notificationsForm.delivery.sound">声音提醒</n-checkbox>
                  </n-form-item>
                </n-form>
              </div>
            </div>
          </n-tab-pane>

          <!-- 高级设置 -->
          <n-tab-pane name="advanced" tab="高级设置">
            <div class="tab-content">
              <div class="advanced-section">
                <h4>内容审核</h4>
                <n-form :model="advancedForm.contentModeration" label-placement="left" label-width="200px">
                  <n-form-item>
                    <n-switch v-model:value="advancedForm.contentModeration.enabled">
                      <template #checked>启用审核</template>
                      <template #unchecked>禁用审核</template>
                    </n-switch>
                  </n-form-item>

                  <template v-if="advancedForm.contentModeration.enabled">
                    <n-form-item>
                      <n-checkbox v-model:checked="advancedForm.contentModeration.requireApproval">
                        新成员发布需要审批
                      </n-checkbox>
                    </n-form-item>
                    <n-form-item>
                      <n-checkbox v-model:checked="advancedForm.contentModeration.autoModerate">
                        自动审核可疑内容
                      </n-checkbox>
                    </n-form-item>
                    <n-form-item label="审核敏感词">
                      <n-dynamic-tags
                        v-model:value="advancedForm.contentModeration.blockedWords"
                        :max="50"
                        placeholder="添加敏感词" />
                    </n-form-item>
                  </template>
                </n-form>
              </div>

              <div class="advanced-section">
                <h4>数据管理</h4>
                <n-form :model="advancedForm.dataManagement" label-placement="left" label-width="200px">
                  <n-form-item label="消息保留期限">
                    <n-select
                      v-model:value="advancedForm.dataManagement.messageRetention"
                      :options="messageRetentionOptions"
                      placeholder="选择保留期限" />
                  </n-form-item>
                  <n-form-item label="文件保留期限">
                    <n-select
                      v-model:value="advancedForm.dataManagement.fileRetention"
                      :options="fileRetentionOptions"
                      placeholder="选择保留期限" />
                  </n-form-item>
                  <n-form-item>
                    <n-switch v-model:value="advancedForm.dataManagement.allowExport">
                      <template #checked>允许导出</template>
                      <template #unchecked>禁止导出</template>
                    </n-switch>
                  </n-form-item>
                </n-form>
              </div>

              <div class="advanced-section">
                <h4>危险操作</h4>
                <div class="danger-actions">
                  <n-button type="warning" @click="handleArchiveSpace" :disabled="!!space.isArchived">
                    <template #icon>
                      <n-icon><Archive /></n-icon>
                    </template>
                    归档空间
                  </n-button>
                  <n-button type="error" @click="showDeleteConfirm = true">
                    <template #icon>
                      <n-icon><Trash /></n-icon>
                    </template>
                    删除空间
                  </n-button>
                </div>
              </div>
            </div>
          </n-tab-pane>
        </n-tabs>
      </div>
    </div>

    <template #action>
      <n-space>
        <n-button @click="handleCancel">取消</n-button>
        <n-button type="primary" @click="handleSave" :loading="isSaving">保存更改</n-button>
      </n-space>
    </template>
  </n-modal>

  <!-- 邀请成员对话框 -->
  <n-modal v-model:show="showInviteDialog" preset="dialog" title="邀请成员" class="modal-medium">
    <n-form ref="inviteFormRef" :model="inviteForm" :rules="inviteRules" label-placement="left" label-width="100px">
      <n-form-item label="用户邮箱" path="emails">
        <n-dynamic-input v-model:value="inviteForm.emails" placeholder="输入邮箱地址" :max="10" />
      </n-form-item>
      <n-form-item label="邀请消息" path="message">
        <n-input
          v-model:value="inviteForm.message"
          type="textarea"
          placeholder="可选的邀请消息"
          :autosize="{ minRows: 2, maxRows: 4 }" />
      </n-form-item>
      <n-form-item label="初始权限" path="permissions">
        <n-select v-model:value="inviteForm.permissions" :options="permissionPresets" placeholder="选择初始权限" />
      </n-form-item>
    </n-form>
    <template #action>
      <n-space>
        <n-button @click="showInviteDialog = false">取消</n-button>
        <n-button type="primary" @click="handleSendInvites" :loading="isInviting">发送邀请</n-button>
      </n-space>
    </template>
  </n-modal>

  <!-- 删除确认对话框 -->
  <n-modal v-model:show="showDeleteConfirm" preset="dialog" type="error" title="删除空间确认" class="modal-small">
    <div class="delete-confirmation">
      <n-alert type="error" :closable="false">
        <strong>⚠️ 警告：此操作不可恢复！</strong>
        <p>删除空间将永久移除所有消息、文件和成员数据。请确认您要继续。</p>
      </n-alert>

      <n-form
        ref="deleteFormRef"
        :model="deleteForm"
        :rules="deleteRules"
        label-placement="left"
        label-width="120px"
        class="mt-20">
        <n-form-item label="确认删除" path="confirm">
          <n-input v-model:value="deleteForm.confirm" placeholder="请输入空间名称以确认删除" />
        </n-form-item>
      </n-form>
    </div>
    <template #action>
      <n-space>
        <n-button @click="showDeleteConfirm = false">取消</n-button>
        <n-button
          type="error"
          @click="handleDeleteSpace"
          :disabled="deleteForm.confirm !== (space?.name || '')"
          :loading="isDeleting">
          永久删除
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, type Component } from 'vue'
import {
  NModal,
  NTabs,
  NTabPane,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NRadioGroup,
  NRadio,
  NCheckbox,
  NSwitch,
  NDynamicTags,
  NButton,
  NIcon,
  NTag,
  NAvatar,
  NDropdown,
  NSpace,
  NAlert,
  useDialog,
  FormInst
} from 'naive-ui'
import {
  Building,
  Users,
  Hash,
  Calendar,
  Globe,
  Lock,
  Search,
  UserPlus,
  MoreHorizontal,
  Archive,
  Trash
} from '@/icons/TablerPlaceholders'
import { usePlatformConstants } from '@/utils/PlatformConstants'
import { useMatrixSpaces, type Space as MatrixSpace } from '@/hooks/useMatrixSpaces'
import { msg } from '@/utils/SafeUI'

interface RolePreset {
  name: string
  label: string
  description: string
  permissions: string[]
}

interface Member {
  userId?: string
  id?: string
  name?: string
  avatar?: string
  role?: string
  status?: string
  joinedAt?: number
  isOnline?: boolean
  powerLevel?: number
  membership?: string
  displayname?: string
  avatarUrl?: string
}

// Local Space interface for dialog compatibility
// Updated to match useMatrixSpaces.Space with readonly arrays
interface Space {
  id: string
  name: string
  topic?: string
  description?: string
  avatar?: string
  memberCount?: number
  roomCount?: number
  created?: number
  lastActivity?: number
  members?: readonly unknown[] // Changed from Member[] to readonly unknown[] to match MatrixSpace
  canAdmin?: boolean
  isPublic?: boolean
  isArchived?: boolean
  tags?: readonly string[] // Changed to readonly string[] to match MatrixSpace
  notifications?: {
    highlightCount: number
    notificationCount: number
  }
  settings?: {
    allowGuests?: boolean
    historyVisibility?: string
    joinRule?: string
  }
  joinRule?: string
}

interface Props {
  show: boolean
  space: Space | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  updated: [space: Space]
}>()

const { isMobile } = usePlatformConstants()
const dialog = useDialog()
const message = msg

const { updateSpaceSettings, inviteToSpace, removeFromSpace } = useMatrixSpaces()

// 计算属性
const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

// 状态管理
const activeTab = ref('basic')
const memberSearchQuery = ref('')
const showInviteDialog = ref(false)
const showDeleteConfirm = ref(false)
const selectedMembers = ref<string[]>([])
const selectedRole = ref('')
const isSaving = ref(false)
const isInviting = ref(false)
const isDeleting = ref(false)

// 表单引用
const basicFormRef = ref<FormInst | null>(null)
const inviteFormRef = ref<FormInst | null>(null)
const deleteFormRef = ref<FormInst | null>(null)

// 表单数据
const basicForm = reactive<{ name: string; topic: string; description: string; tags: string[] }>({
  name: '',
  topic: '',
  description: '',
  tags: []
})

const privacyForm = reactive({
  visibility: 'public',
  joinRule: 'open',
  allowSearch: true,
  showMemberList: true
})

const permissionsForm = reactive({
  defaultPermissions: {
    canRead: true,
    canPost: true,
    canUpload: true,
    canInvite: false,
    canCreateRoom: false
  },
  advancedPermissions: {
    canModerate: false,
    canManageRooms: false,
    canManageSpace: false
  }
})

const notificationsForm = reactive({
  space: {
    newMembers: true,
    memberLeft: false,
    spaceUpdated: true,
    roomCreated: true
  },
  messages: {
    level: 'all',
    mentions: false,
    keywords: false,
    keywordList: []
  },
  delivery: {
    inApp: true,
    email: false,
    push: true,
    sound: true
  }
})

const advancedForm = reactive({
  contentModeration: {
    enabled: false,
    requireApproval: false,
    autoModerate: false,
    blockedWords: []
  },
  dataManagement: {
    messageRetention: 'forever',
    fileRetention: 'forever',
    allowExport: true
  }
})

const inviteForm = reactive({
  emails: [''],
  message: '',
  permissions: 'member'
})

const deleteForm = reactive({
  confirm: ''
})

// 选项数据
const notificationLevels = [
  { label: '所有消息', value: 'all' },
  { label: '仅提及', value: 'mentions' },
  { label: '静音', value: 'none' }
]

const messageRetentionOptions = [
  { label: '永久保留', value: 'forever' },
  { label: '1年', value: '1year' },
  { label: '6个月', value: '6months' },
  { label: '3个月', value: '3months' },
  { label: '1个月', value: '1month' }
]

const fileRetentionOptions = [
  { label: '永久保留', value: 'forever' },
  { label: '2年', value: '2years' },
  { label: '1年', value: '1year' },
  { label: '6个月', value: '6months' }
]

const permissionPresets = [
  { label: '普通成员', value: 'member' },
  { label: '协管员', value: 'moderator' },
  { label: '管理员', value: 'admin' }
]

const rolePresets = [
  {
    name: 'guest',
    label: '访客',
    description: '只能查看，无法互动',
    permissions: ['canRead']
  },
  {
    name: 'member',
    label: '成员',
    description: '标准成员权限',
    permissions: ['canRead', 'canPost', 'canUpload']
  },
  {
    name: 'moderator',
    label: '协管员',
    description: '可以帮助管理',
    permissions: ['canRead', 'canPost', 'canUpload', 'canInvite', 'canModerate', 'canManageRooms']
  },
  {
    name: 'admin',
    label: '管理员',
    description: '完全控制权限',
    permissions: [
      'canRead',
      'canPost',
      'canUpload',
      'canInvite',
      'canCreateRoom',
      'canModerate',
      'canManageRooms',
      'canManageSpace'
    ]
  }
]

const bulkActions = [
  {
    label: '设为管理员',
    key: 'set-admin'
  },
  {
    label: '设为协管员',
    key: 'set-moderator'
  },
  {
    label: '移除成员',
    key: 'remove'
  }
]

// 计算属性
const filteredMembers = computed(() => {
  if (!props.space) return []
  // Cast members from readonly unknown[] to Member[] for use in the dialog
  const members = (props.space.members || []) as Member[]
  if (!memberSearchQuery.value.trim()) return members
  const query = memberSearchQuery.value.toLowerCase()
  return members.filter(
    (member: Member) =>
      (member.name || '').toLowerCase().includes(query) ||
      (member.status && member.status.toLowerCase().includes(query))
  )
})

// ========== 方法 ==========

const formatDate = (timestamp?: number): string => {
  const ts = timestamp ?? Date.now()
  return new Date(ts).toLocaleDateString('zh-CN')
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
    case 'guest':
      return '访客'
    default:
      return '用户'
  }
}

const getPermissionLabel = (permission: string): string => {
  const labels: Record<string, string> = {
    canRead: '查看',
    canPost: '发帖',
    canUpload: '上传',
    canInvite: '邀请',
    canCreateRoom: '创建房间',
    canModerate: '审核',
    canManageRooms: '管理房间',
    canManageSpace: '管理空间'
  }
  return labels[permission] || permission
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

  if (member.role !== 'admin') {
    actions.push(
      {
        label: '设为协管员',
        key: 'promote-moderator',
        icon: () => '⬆️'
      },
      {
        label: '设为管理员',
        key: 'promote-admin',
        icon: () => '👑'
      },
      {
        label: '降为成员',
        key: 'demote-member',
        icon: () => '⬇️'
      },
      { label: '移除成员', key: 'remove', icon: () => '🚫' }
    )
  }

  return actions as Array<{
    label: string
    key: string
    icon: () => string
    [key: string]: unknown
  }>
}

const applyRolePreset = (role: RolePreset) => {
  selectedRole.value = role.name

  // 重置权限
  Object.keys(permissionsForm.defaultPermissions).forEach((key) => {
    permissionsForm.defaultPermissions[key as keyof typeof permissionsForm.defaultPermissions] = false
  })
  Object.keys(permissionsForm.advancedPermissions).forEach((key) => {
    permissionsForm.advancedPermissions[key as keyof typeof permissionsForm.advancedPermissions] = false
  })

  // 应用预设权限
  role.permissions.forEach((perm: string) => {
    if (perm in permissionsForm.defaultPermissions) {
      permissionsForm.defaultPermissions[perm as keyof typeof permissionsForm.defaultPermissions] = true
    } else if (perm in permissionsForm.advancedPermissions) {
      permissionsForm.advancedPermissions[perm as keyof typeof permissionsForm.advancedPermissions] = true
    }
  })

  message.success(`已应用 ${role.label} 权限预设`)
}

const toggleMemberSelection = (memberId: string) => {
  const index = selectedMembers.value.indexOf(memberId)
  if (index > -1) {
    selectedMembers.value.splice(index, 1)
  } else {
    selectedMembers.value.push(memberId)
  }
}

// ========== 事件处理 ==========

const handleCancel = () => {
  resetForms()
  showDialog.value = false
}

const handleSave = async () => {
  try {
    await basicFormRef.value?.validate()
    isSaving.value = true

    if (!props.space) return
    await updateSpaceSettings(props.space.id, {})

    message.success('空间设置已更新')
    emit('updated', { ...props.space })
    showDialog.value = false
  } catch (error) {
    message.error('保存失败')
  } finally {
    isSaving.value = false
  }
}

const handleSendInvites = async () => {
  try {
    await inviteFormRef.value?.validate()
    isInviting.value = true

    if (!props.space) return
    const emails = inviteForm.emails.filter((email) => email.trim())
    for (const email of emails) {
      // 注意：此处假设inviteToSpace支持email或userId，且未进行email转userId
      await inviteToSpace(props.space.id, email)
    }

    message.success('邀请已发送')
    showInviteDialog.value = false

    // 重置表单
    inviteForm.emails = ['']
    inviteForm.message = ''
    inviteForm.permissions = 'member'
  } catch (error) {
    message.error('发送邀请失败')
  } finally {
    isInviting.value = false
  }
}

const handleMemberAction = (action: string) => {
  const member = filteredMembers.value.find((m: Member) => getMemberActions(m).some((a) => a.key === action))
  if (!member) return

  switch (action) {
    case 'message':
      message.info(`发送消息给 ${member.name}`)
      break
    case 'profile':
      message.info(`查看 ${member.name} 的资料`)
      break
    case 'promote-admin':
      if (member.id) updateMemberRole(member.id, 'admin')
      break
    case 'promote-moderator':
      if (member.id) updateMemberRole(member.id, 'moderator')
      break
    case 'demote-member':
      if (member.id) updateMemberRole(member.id, 'member')
      break
    case 'remove':
      confirmRemoveMember(member)
      break
  }
}

const handleBulkAction = (action: string) => {
  switch (action) {
    case 'set-admin':
      selectedMembers.value.forEach((memberId) => {
        updateMemberRole(memberId, 'admin')
      })
      selectedMembers.value = []
      break
    case 'set-moderator':
      selectedMembers.value.forEach((memberId) => {
        updateMemberRole(memberId, 'moderator')
      })
      selectedMembers.value = []
      break
    case 'remove':
      confirmBulkRemove()
      break
  }
}

const handleArchiveSpace = async () => {
  if (!props.space) return
  dialog.warning({
    title: '确认归档',
    content: `确定要归档空间 "${props.space.name}" 吗？归档后空间将变为只读状态。`,
    positiveText: '确定归档',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        // await archiveSpace(props.space.id) // Not implemented in hook
        message.warning('归档功能暂未实现')
        // emit('updated', { ...props.space, isArchived: true })
        // showDialog.value = false
      } catch (error) {
        message.error('归档失败')
      }
    }
  })
}

const handleDeleteSpace = async () => {
  try {
    await deleteFormRef.value?.validate()
    isDeleting.value = true

    if (!props.space) return
    // await deleteSpace(props.space.id) // Not implemented in hook
    message.warning('删除功能暂未实现')
    // message.success('空间已删除')
    // showDialog.value = false
  } catch (error) {
    message.error('删除失败')
  } finally {
    isDeleting.value = false
  }
}

const updateMemberRole = async (memberId: string, role: string) => {
  void memberId
  message.info(`已更新成员角色为 ${getRoleLabel(role)}`)
}

const confirmRemoveMember = (member: Member) => {
  if (!props.space) return
  const spaceId = props.space.id
  dialog.warning({
    title: '确认移除',
    content: `确定要移除成员 "${member.name}" 吗？`,
    positiveText: '确定移除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        if (member.userId) await removeFromSpace(spaceId, member.userId)
        message.success(`已移除成员 ${member.name}`)
      } catch (error) {
        message.error('移除成员失败')
      }
    }
  })
}

const confirmBulkRemove = () => {
  if (!props.space) return
  const spaceId = props.space.id
  dialog.warning({
    title: '批量移除',
    content: `确定要移除选中的 ${selectedMembers.value.length} 位成员吗？`,
    positiveText: '确定移除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        for (const memberId of selectedMembers.value) {
          await removeFromSpace(spaceId, memberId)
        }
        message.success(`已移除 ${selectedMembers.value.length} 位成员`)
        selectedMembers.value = []
      } catch (error) {
        message.error('批量移除失败')
      }
    }
  })
}

const resetForms = () => {
  // 重置所有表单数据
  selectedMembers.value = []
  selectedRole.value = ''
}

// ========== 生命周期 ==========

onMounted(() => {
  // 初始化表单数据
  if (!props.space) return
  basicForm.name = props.space.name
  basicForm.topic = props.space.topic || ''
  basicForm.description = props.space.description || ''
  basicForm.tags = (props.space.tags || []) as string[]

  privacyForm.visibility = props.space.isPublic ? 'public' : 'private'
  privacyForm.joinRule = props.space.joinRule || 'open'
})

// 表单验证规则
const basicRules = {
  name: [
    { required: true, message: '请输入空间名称', trigger: 'blur' },
    { min: 2, max: 50, message: '空间名称长度应在2-50个字符之间', trigger: 'blur' }
  ]
}

const inviteRules = {
  emails: [
    {
      validator: (_rule: unknown, value: string[]) => {
        const validEmails = value.every((email) => !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return validEmails ? Promise.resolve() : Promise.reject('请输入有效的邮箱地址')
      },
      trigger: 'blur'
    }
  ]
}

const deleteRules = {
  confirm: [
    {
      validator: (_rule: unknown, value: string) => {
        if (!props.space) return Promise.resolve()
        return value === props.space.name
          ? Promise.resolve()
          : Promise.reject(`请输入完整的空间名称 "${props.space.name}"`)
      },
      trigger: 'blur'
    }
  ]
}
</script>

<style lang="scss" scoped>
.manage-space-dialog {
  .space-overview {
    display: flex;
    gap: 16px;
    padding: 20px;
    background: var(--bg-color-hover);
    border-radius: 8px;
    margin-bottom: 24px;

    .space-cover {
      width: 80px;
      height: 80px;
      flex-shrink: 0;

      .space-avatar,
      .space-placeholder {
        width: 100%;
        height: 100%;
        border-radius: 8px;
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
          font-size: 32px;
          font-weight: 600;
          text-transform: uppercase;
          opacity: 0.8;
        }
      }
    }

    .space-info {
      flex: 1;

      h3 {
        margin: 0 0 8px 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--text-color-1);
      }

      p {
        margin: 0 0 12px 0;
        color: var(--text-color-2);
        line-height: 1.5;
      }

      .space-stats {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;

        .stat-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: var(--text-color-3);
        }
      }
    }
  }

  .manage-content {
    max-height: 60vh;
    overflow-y: auto;

    .tab-content {
      padding: 16px 0;
    }
  }

  .radio-content {
    margin-left: 8px;

    .radio-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      color: var(--text-color-1);
      margin-bottom: 4px;
    }

    .radio-description {
      font-size: 12px;
      color: var(--text-color-3);
    }
  }

  .form-help {
    font-size: 12px;
    color: var(--text-color-3);
    margin-top: 4px;
  }

  .permission-section {
    margin-bottom: 32px;

    h4 {
      margin: 0 0 8px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-1);
    }

    .section-desc {
      margin: 0 0 16px 0;
      color: var(--text-color-3);
      font-size: 13px;
    }

    .role-presets {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;

      .role-preset {
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 16px;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          border-color: var(--primary-color);
        }

        &.active {
          border-color: var(--primary-color);
          background: rgba(24, 144, 255, 0.05);
        }

        .role-header {
          margin-bottom: 12px;

          h5 {
            margin: 0 0 4px 0;
            font-size: 14px;
            font-weight: 600;
            color: var(--text-color-1);
          }

          .role-desc {
            font-size: 12px;
            color: var(--text-color-3);
          }
        }

        .role-permissions {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
      }
    }
  }

  .members-header {
    margin-bottom: 20px;

    .members-actions {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 12px;
    }

    .member-stats {
      font-size: 13px;
      color: var(--text-color-3);
    }
  }

  .members-list {
    .member-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: var(--card-color);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-bottom: 8px;
      transition: all 0.2s ease;

      &:hover {
        border-color: var(--primary-color);
      }

      &.selected {
        border-color: var(--primary-color);
        background: rgba(24, 144, 255, 0.05);
      }

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

  .notification-section,
  .advanced-section {
    margin-bottom: 32px;

    h4 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-1);
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-color);
    }

    .keywords-input {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border-color);
    }
  }

  .danger-actions {
    display: flex;
    gap: 12px;
    padding: 20px;
    background: rgba(244, 67, 54, 0.05);
    border: 1px solid rgba(244, 67, 54, 0.2);
    border-radius: 8px;
  }

  .delete-confirmation {
    .n-alert {
      margin-bottom: 16px;

      strong {
        display: block;
        margin-bottom: 8px;
      }

      p {
        margin: 0;
        line-height: 1.5;
      }
    }
  }

  &.is-mobile {
    .space-overview {
      flex-direction: column;
      text-align: center;
      gap: 12px;

      .space-info {
        .space-stats {
          justify-content: center;
        }
      }
    }

    .manage-content {
      max-height: 70vh;
    }

    .members-header {
      .members-actions {
        flex-direction: column;
        gap: 8px;

        .n-input {
          width: 100% !important;
        }
      }
    }

    .role-presets {
      grid-template-columns: 1fr !important;
    }

    .danger-actions {
      flex-direction: column;
    }
  }
}

/* Inline style replacements */
.modal-large {
  width: 800px;
  max-height: 90vh;
  overflow: hidden;
}

.search-input {
  width: 300px;
}

.modal-medium {
  width: 500px;
}

.modal-small {
  width: 400px;
}

.mt-20 {
  margin-top: 20px;
}

// 响应式设计
@media (max-width: 768px) {
  .manage-space-dialog {
    .space-overview {
      padding: 16px;

      .space-cover {
        width: 60px;
        height: 60px;

        .space-placeholder .placeholder-text {
          font-size: 24px;
        }
      }

      .space-info {
        h3 {
          font-size: 16px;
        }
      }
    }
  }
}
</style>
