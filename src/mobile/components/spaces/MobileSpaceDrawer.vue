<!-- Mobile Space Details Drawer - Full space details for mobile -->
<template>
  <n-drawer
    v-model:show="showDrawer"
    placement="bottom"
    :height="'85vh'"
    :trap-focus="false"
    :block-scroll="false"
  >
    <n-drawer-content :body-style="{ padding: '0' }" :native-scrollbar="false">
      <!-- Header -->
      <template #header>
        <div class="drawer-header">
          <div class="header-left">
            <n-button text @click="handleClose">
              <template #icon>
                <n-icon :size="20"><X /></n-icon>
              </template>
            </n-button>
            <span class="header-title">工作区详情</span>
          </div>
          <div class="header-right">
            <n-dropdown
              trigger="click"
              :options="getMenuOptions()"
              @select="handleMenuAction"
            >
              <n-button circle>
                <template #icon>
                  <n-icon><DotsVertical /></n-icon>
                </template>
              </n-button>
            </n-dropdown>
          </div>
        </div>
      </template>

      <div v-if="space" class="space-details">
        <!-- Space Info Card -->
        <div class="space-info-card">
          <div class="space-avatar-section">
            <n-avatar :src="space.avatar" :size="64" round>
              <template #fallback>
                <span class="avatar-fallback">{{ space.name?.charAt(0)?.toUpperCase() || '?' }}</span>
              </template>
            </n-avatar>
            <div class="space-badges">
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

          <h2 class="space-name">{{ space.name }}</h2>
          <p v-if="space.topic" class="space-topic">{{ space.topic }}</p>

          <div class="space-stats">
            <div class="stat-item">
              <n-icon :size="16"><Users /></n-icon>
              <span>{{ space.memberCount ?? 0 }}</span>
            </div>
            <div class="stat-item">
              <n-icon :size="16"><Hash /></n-icon>
              <span>{{ space.children?.length ?? 0 }}</span>
            </div>
            <div v-if="space.notifications" class="stat-item">
              <n-icon :size="16"><Bell /></n-icon>
              <span>{{ space.notifications.notificationCount ?? 0 }}</span>
            </div>
          </div>

          <!-- Join/Leave Button -->
          <div class="space-actions">
            <n-button
              v-if="!isJoined"
              type="primary"
              size="large"
              block
              :loading="isJoining"
              @click="handleJoin"
            >
              <template #icon>
                <n-icon><Login /></n-icon>
              </template>
              加入工作区
            </n-button>
            <n-button
              v-else
              type="error"
              size="large"
              block
              :loading="isLeaving"
              @click="handleLeave"
            >
              <template #icon>
                <n-icon><Logout /></n-icon>
              </template>
              离开工作区
            </n-button>
          </div>
        </div>

        <!-- Tabs -->
        <n-tabs
          v-model:value="activeTab"
          type="line"
          animated
          :bar-padding="20"
        >
          <!-- Rooms Tab -->
          <n-tab-pane name="rooms" tab="房间">
            <div class="tab-content">
              <!-- Create Room Button -->
              <div v-if="isJoined" class="tab-header">
                <n-button type="primary" size="small" @click="showCreateDialog = true">
                  <template #icon>
                    <n-icon><Plus /></n-icon>
                  </template>
                  添加房间
                </n-button>
              </div>

              <!-- Room List -->
              <div v-if="space.children && space.children.length > 0" class="room-list">
                <div
                  v-for="child in space.children"
                  :key="child.roomId"
                  class="room-item"
                  @click="openRoom(child.roomId)"
                >
                  <div class="room-avatar">
                    <n-avatar :src="String(child.avatar ?? '')" :size="40" round>
                      <template #fallback>
                        <span>{{ child.name?.charAt(0)?.toUpperCase() || '?' }}</span>
                      </template>
                    </n-avatar>
                    <div v-if="child.notifications?.notificationCount" class="unread-badge">
                      {{ child.notifications.notificationCount > 99 ? '99+' : child.notifications.notificationCount }}
                    </div>
                  </div>

                  <div class="room-info">
                    <div class="room-name">{{ child.name }}</div>
                    <div class="room-meta">
                      <span>{{ child.memberCount ?? 0 }} 成员</span>
                      <n-tag v-if="!child.isJoined" size="tiny" type="info">未加入</n-tag>
                    </div>
                  </div>

                  <div class="room-action">
                    <n-icon :size="18"><ChevronRight /></n-icon>
                  </div>
                </div>
              </div>

              <n-empty v-else description="暂无房间" size="small" />
            </div>
          </n-tab-pane>

          <!-- Members Tab -->
          <n-tab-pane name="members" tab="成员">
            <div class="tab-content">
              <div v-if="isJoined" class="tab-header">
                <n-button type="primary" size="small" @click="showInviteDialog = true">
                  <template #icon>
                    <n-icon><UserPlus /></n-icon>
                  </template>
                  邀请成员
                </n-button>
              </div>

              <!-- Member List -->
              <div class="member-list">
                <div v-for="i in Math.min((space.memberCount ?? 0), 10)" :key="i" class="member-item">
                  <n-skeleton :width="40" :height="40" :sharp="false" circle />
                  <div class="member-info">
                    <n-skeleton :width="120" :height="16" />
                    <n-skeleton :width="80" :height="12" />
                  </div>
                </div>
              </div>

              <n-empty
                v-if="!space.memberCount || space.memberCount === 0"
                description="暂无成员"
                size="small"
              >
                <template #extra>
                  <n-text depth="3" style="font-size: 12px">
                    加入工作区后可查看成员列表
                  </n-text>
                </template>
              </n-empty>
            </div>
          </n-tab-pane>

          <!-- Settings Tab -->
          <n-tab-pane name="settings" tab="设置">
            <div class="tab-content">
              <n-list v-if="isJoined" hoverable clickable>
                <n-list-item @click="handleEditSpace">
                  <template #prefix>
                    <n-icon :size="20"><Edit /></n-icon>
                  </template>
                  编辑工作区信息
                </n-list-item>
                <n-list-item @click="handleNotifications">
                  <template #prefix>
                    <n-icon :size="20"><Bell /></n-icon>
                  </template>
                  通知设置
                </n-list-item>
                <n-list-item @click="handlePermissions">
                  <template #prefix>
                    <n-icon :size="20"><Shield /></n-icon>
                  </template>
                  权限管理
                </n-list-item>
                <n-list-item @click="handleExport" :disabled="!space.isPublic">
                  <template #prefix>
                    <n-icon :size="20"><Share /></n-icon>
                  </template>
                  分享工作区
                </n-list-item>
              </n-list>

              <n-empty v-else description="加入工作区后可访问设置" size="small">
                <template #extra>
                  <n-button type="primary" size="small" @click="handleJoin">
                    立即加入
                  </n-button>
                </template>
              </n-empty>
            </div>
          </n-tab-pane>
        </n-tabs>
      </div>

      <!-- Create Room Dialog -->
      <n-modal v-model:show="showCreateDialog" preset="dialog" title="添加房间">
        <n-form ref="createFormRef" :model="newRoom" :rules="createRules">
          <n-form-item label="房间名称" path="name">
            <n-input v-model:value="newRoom.name" placeholder="输入房间名称" />
          </n-form-item>
          <n-form-item label="房间描述">
            <n-input v-model:value="newRoom.description" type="textarea" placeholder="描述此房间的用途" />
          </n-form-item>
        </n-form>
        <template #action>
          <n-button @click="showCreateDialog = false">取消</n-button>
          <n-button type="primary" :loading="isCreating" @click="handleCreateRoom">创建</n-button>
        </template>
      </n-modal>

      <!-- Invite Member Dialog -->
      <n-modal v-model:show="showInviteDialog" preset="dialog" title="邀请成员">
        <n-form ref="inviteFormRef" :model="inviteForm" :rules="inviteRules">
          <n-form-item label="用户 ID" path="userId">
            <n-input v-model:value="inviteForm.userId" placeholder="@username:server.com" />
          </n-form-item>
        </n-form>
        <template #action>
          <n-button @click="showInviteDialog = false">取消</n-button>
          <n-button type="primary" :loading="isInviting" @click="handleInvite">邀请</n-button>
        </template>
      </n-modal>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  NDrawer,
  NDrawerContent,
  NTabs,
  NTabPane,
  NButton,
  NIcon,
  NAvatar,
  NTag,
  NEmpty,
  NList,
  NListItem,
  NSkeleton,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NText,
  NDropdown,
  useDialog,
  useMessage
} from 'naive-ui'
import {
  X,
  DotsVertical,
  World,
  Lock,
  Users,
  Hash,
  Bell,
  Login,
  Logout,
  Plus,
  ChevronRight,
  UserPlus,
  Edit,
  Shield,
  Share
} from '@vicons/tabler'
import { useMatrixSpaces, type Space as MatrixSpace } from '@/hooks/useMatrixSpaces'
import { useHaptic } from '@/composables/useMobileGestures'

interface Props {
  show: boolean
  space: MatrixSpace | null
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'room-selected', roomId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const router = useRouter()
const dialog = useDialog()
const message = useMessage()
const { selection, success, error: hapticError, warning } = useHaptic()

// Matrix Spaces hook
const { joinSpace, leaveSpace, addChildToSpace, inviteToSpace } = useMatrixSpaces()

// State
const activeTab = ref<'rooms' | 'members' | 'settings'>('rooms')
const isJoining = ref(false)
const isLeaving = ref(false)
const showCreateDialog = ref(false)
const showInviteDialog = ref(false)
const isCreating = ref(false)
const isInviting = ref(false)

// New room form
const newRoom = ref({
  name: '',
  description: ''
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
  return props.space?.children?.some((child: { isJoined?: boolean }) => child.isJoined) ?? false
})

// Methods
const handleClose = () => {
  emit('update:show', false)
  selection()
}

const getMenuOptions = () => {
  return [
    {
      label: '分享',
      key: 'share',
      icon: () => 'Share'
    },
    {
      label: '通知设置',
      key: 'notifications',
      icon: () => 'Bell'
    },
    {
      label: '报告问题',
      key: 'report',
      icon: () => 'AlertTriangle'
    }
  ]
}

const handleMenuAction = (key: string) => {
  switch (key) {
    case 'share':
      handleExport()
      break
    case 'notifications':
      handleNotifications()
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
    positiveText: '离开',
    negativeText: '取消',
    onPositiveClick: async () => {
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

const handleCreateRoom = async () => {
  try {
    await createFormRef.value?.validate()
  } catch {
    return
  }

  if (!props.space || !newRoom.value.name) return

  isCreating.value = true
  try {
    const result = await addChildToSpace(props.space.id, '', {
      order: '',
      suggested: false
    })

    if (result) {
      success()
      message.success('房间创建成功')
      showCreateDialog.value = false
      newRoom.value = { name: '', description: '' }
    } else {
      hapticError()
      message.error('创建房间失败')
    }
  } finally {
    isCreating.value = false
  }
}

const handleInvite = async () => {
  try {
    await inviteFormRef.value?.validate()
  } catch {
    return
  }

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

const handleEditSpace = () => {
  message.info('编辑功能开发中')
  selection()
}

const handleNotifications = () => {
  message.info('通知设置功能开发中')
  selection()
}

const handlePermissions = () => {
  message.info('权限管理功能开发中')
  selection()
}

const handleExport = () => {
  if (props.space?.isPublic) {
    const shareUrl = `${window.location.origin}/#/space/${props.space.roomId || props.space.id}`
    navigator.clipboard.writeText(shareUrl)
    success()
    message.success('工作区链接已复制')
  } else {
    hapticError()
    message.warning('私有工作区无法分享')
  }
  selection()
}

// Watch for show changes to reset tab
watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      activeTab.value = 'rooms'
    }
  }
)
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
  padding: 0 0 20px 0;
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

    .space-badges {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }

    .avatar-fallback {
      font-size: 24px;
      font-weight: 600;
    }
  }

  .space-name {
    text-align: center;
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: var(--text-color-1);
  }

  .space-topic {
    text-align: center;
    font-size: 14px;
    color: var(--text-color-2);
    margin: 0 0 16px 0;
    line-height: 1.5;
  }

  .space-stats {
    display: flex;
    justify-content: center;
    gap: 24px;
    margin-bottom: 16px;

    .stat-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 14px;
      color: var(--text-color-2);
    }
  }

  .space-actions {
    margin-top: 16px;
  }
}

.tab-content {
  padding: 16px;
  min-height: 300px;

  .tab-header {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 12px;
  }
}

.room-list,
.member-list {
  .room-item,
  .member-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--card-color);
    border-radius: 8px;
    margin-bottom: 8px;
    cursor: pointer;

    &:active {
      background: var(--item-hover-bg);
    }
  }

  .room-avatar,
  .member-avatar {
    position: relative;
    flex-shrink: 0;

    .unread-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      background: var(--error-color);
      color: white;
      border-radius: 8px;
      font-size: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
    }
  }

  .room-info,
  .member-info {
    flex: 1;
    min-width: 0;

    .room-name,
    .member-name {
      font-size: 15px;
      font-weight: 500;
      color: var(--text-color-1);
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .room-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--text-color-3);
    }
  }

  .room-action,
  .member-action {
    flex-shrink: 0;
    color: var(--text-color-3);
  }
}

// Safe area for mobile
@supports (padding: env(safe-area-inset-bottom)) {
  .space-details {
    padding-bottom: calc(20px + env(safe-area-inset-bottom));
  }
}
</style>
