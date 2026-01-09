<template>
  <div v-if="props.space" class="space-details" :class="{ 'is-mobile': isMobile }">
    <!-- 空间头部 -->
    <SpaceDetailsHeader
      :space="props.space"
      :is-joining="isJoining"
      @join="handleJoin"
      @close="handleClose"
      @space-action="handleSpaceAction" />

    <!-- 标签页内容 -->
    <div class="space-content">
      <n-tabs v-model:value="activeTab" type="card" animated>
        <!-- 概览 -->
        <n-tab-pane name="overview" tab="概览">
          <SpaceOverview
            :space="safeSpace"
            :activities="recentActivities"
            :active-members-count="getActiveMembersCount()" />
        </n-tab-pane>

        <!-- 房间 -->
        <n-tab-pane name="rooms" tab="房间">
          <SpaceRooms
            :rooms="filteredRooms"
            :is-admin="safeSpace.isAdmin"
            @create-room="handleCreateRoom"
            @view-room="handleViewRoom"
            @room-action="handleRoomAction" />
        </n-tab-pane>

        <!-- 成员 -->
        <n-tab-pane name="members" tab="成员">
          <SpaceMembers
            :members="filteredMembers"
            :is-admin="safeSpace.isAdmin"
            :current-user-id="currentUserId"
            @invite-members="handleInviteMembers"
            @member-action="handleMemberAction" />
        </n-tab-pane>

        <!-- 设置 -->
        <n-tab-pane name="settings" tab="设置" v-if="safeSpace.isAdmin">
          <SpaceSettings
            :space="safeSpace"
            :is-saving="isSaving"
            @save="handleSaveSettings"
            @reset="handleResetSettings" />
        </n-tab-pane>
      </n-tabs>
    </div>

    <!-- 创建房间对话框 -->
    <n-modal v-model:show="showCreateRoomDialog" preset="card" title="创建房间" :style="{ width: '500px' }">
      <n-form ref="roomFormRef" :model="roomForm" :rules="roomRules">
        <n-form-item label="房间名称" path="name">
          <n-input v-model:value="roomForm.name" placeholder="请输入房间名称" />
        </n-form-item>
        <n-form-item label="房间主题" path="topic">
          <n-input
            v-model:value="roomForm.topic"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder="请输入房间主题" />
        </n-form-item>
        <n-form-item label="房间类型" path="type">
          <n-select v-model:value="roomForm.type" :options="roomTypeOptions" />
        </n-form-item>
        <n-form-item label="公开房间" path="isPublic">
          <n-switch v-model:value="roomForm.isPublic" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showCreateRoomDialog = false">取消</n-button>
          <n-button type="primary" @click="handleCreateRoomConfirm" :loading="isCreatingRoom">创建</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NTabs, NTabPane, NModal, NForm, NFormItem, NInput, NSelect, NSwitch, NButton, NSpace } from 'naive-ui'
import { usePlatformConstants } from '@/utils/PlatformConstants'
import { useMatrixSpaces } from '@/hooks/useMatrixSpaces'
import { msg } from '@/utils/SafeUI'
import SpaceDetailsHeader from './SpaceDetailsHeader.vue'
import SpaceOverview from './SpaceOverview.vue'
import SpaceRooms from './SpaceRooms.vue'
import SpaceMembers from './SpaceMembers.vue'
import SpaceSettings from './SpaceSettings.vue'
import type {
  SpaceDetailsProps,
  Room,
  Member,
  Activity,
  BasicSettingsForm,
  PrivacySettingsForm,
  NotificationSettingsForm,
  CreateRoomForm
} from './types'

// ==================== Props & Emits ====================
const props = defineProps<{
  space: SpaceDetailsProps['space']
  rooms?: Room[]
  members?: Member[]
  activities?: Activity[]
  currentUserId?: string
}>()

const emit = defineEmits<{
  (e: 'join', spaceId: string): void
  (e: 'leave', spaceId: string): void
  (e: 'archive', spaceId: string): void
  (e: 'unarchive', spaceId: string): void
  (e: 'toggle-favorite', spaceId: string): void
  (e: 'invite', spaceId: string): void
  (e: 'invite-members', spaceId: string): void
  (e: 'view-room', roomId: string): void
  (e: 'create-room', data: any): void
  (e: 'save-settings', data: any): void
  (e: 'room-action', data: any): void
  (e: 'member-action', data: any): void
  (e: 'close'): void
}>()

// ==================== Composables ====================
const { isMobile } = usePlatformConstants()
const { createRoomInSpace, updateSpaceSettings } = useMatrixSpaces()

// ==================== 状态 ====================
const activeTab = ref('overview')
const roomSearchQuery = ref('')
const memberSearchQuery = ref('')
const showCreateRoomDialog = ref(false)
const isJoining = ref(false)
const isSaving = ref(false)
const isCreatingRoom = ref(false)

// ==================== 表单 ====================
const roomForm = ref<CreateRoomForm>({
  name: '',
  topic: '',
  type: 'room',
  isPublic: false
})

const roomFormRef = ref()
const roomTypeOptions = [
  { label: '普通房间', value: 'room' },
  { label: '空间', value: 'space' }
]

// ==================== 计算属性 ====================
const safeSpace = computed(() => {
  if (!props.space) {
    return {
      id: '',
      name: '未知空间',
      isPublic: false,
      isArchived: false,
      isFavorite: false,
      isJoined: false,
      isAdmin: false,
      memberCount: 0,
      roomCount: 0
    }
  }
  return props.space
})

const filteredRooms = computed(() => {
  if (!roomSearchQuery.value || !props.rooms) return props.rooms || []
  const query = roomSearchQuery.value.toLowerCase()
  return props.rooms.filter(
    (room: Room) => room.name.toLowerCase().includes(query) || (room.topic && room.topic.toLowerCase().includes(query))
  )
})

const filteredMembers = computed(() => {
  if (!memberSearchQuery.value || !props.members) return props.members || []
  const query = memberSearchQuery.value.toLowerCase()
  return props.members.filter((member: Member) => member.name.toLowerCase().includes(query))
})

const recentActivities = computed(() => props.activities || [])

// ==================== 辅助函数 ====================
const getActiveMembersCount = (): number => {
  if (!props.members) return 0
  return props.members.filter((m: Member) => m.isActive).length
}

// ==================== 事件处理 ====================
const handleJoin = async () => {
  isJoining.value = true
  try {
    emit('join', safeSpace.value.id)
    msg.success('已加入空间')
  } catch (error) {
    msg.error('加入空间失败')
  } finally {
    isJoining.value = false
  }
}

const handleSpaceAction = async (action: string) => {
  switch (action) {
    case 'settings':
      activeTab.value = 'settings'
      break
    case 'invite':
    case 'invite_members':
      emit('invite', safeSpace.value.id)
      break
    case 'archive':
      emit('archive', safeSpace.value.id)
      break
    case 'unarchive':
      emit('unarchive', safeSpace.value.id)
      break
    case 'leave':
      emit('leave', safeSpace.value.id)
      break
    case 'copy_link':
      try {
        const link = `${window.location.origin}/#/space/${safeSpace.value.id}`
        await navigator.clipboard.writeText(link)
        msg.success('链接已复制到剪贴板')
      } catch (error) {
        msg.error('复制链接失败')
      }
      break
    case 'toggle_favorite':
      emit('toggle-favorite', safeSpace.value.id)
      break
  }
}

const handleViewRoom = (room: Room) => {
  emit('view-room', room.id)
}

const handleRoomAction = (data: { action: string; room: Room }) => {
  emit('room-action', data)
}

const handleCreateRoom = () => {
  showCreateRoomDialog.value = true
}

const handleCreateRoomConfirm = async () => {
  isCreatingRoom.value = true
  try {
    await createRoomInSpace(safeSpace.value.id, roomForm.value)
    showCreateRoomDialog.value = false
    roomForm.value = {
      name: '',
      topic: '',
      type: 'room',
      isPublic: false
    }
    msg.success('房间创建成功')
  } catch (error) {
    msg.error('创建房间失败')
  } finally {
    isCreatingRoom.value = false
  }
}

const handleInviteMembers = () => {
  emit('invite-members', safeSpace.value.id)
}

const handleMemberAction = (data: { action: string; member: Member }) => {
  emit('member-action', data)
}

const handleSaveSettings = async (data: {
  basic: BasicSettingsForm
  privacy: PrivacySettingsForm
  notification: NotificationSettingsForm
}) => {
  isSaving.value = true
  try {
    await updateSpaceSettings(safeSpace.value.id, data)
    msg.success('设置已保存')
  } catch (error) {
    msg.error('保存设置失败')
  } finally {
    isSaving.value = false
  }
}

const handleResetSettings = () => {
  // 重置表单到初始值
  msg.info('设置已重置')
}

const handleClose = () => {
  emit('close')
}

// ==================== 表单验证 ====================
const roomRules = {
  name: {
    required: true,
    message: '请输入房间名称',
    trigger: 'blur'
  }
}
</script>

<style lang="scss" scoped>
.space-details {
  height: 100%;
  display: flex;
  flex-direction: column;

  &.is-mobile {
    .space-content {
      padding: 16px;
    }
  }

  .space-content {
    flex: 1;
    overflow: hidden;
    padding: 24px;

    :deep(.n-tabs) {
      height: 100%;
      display: flex;
      flex-direction: column;

      .n-tabs-nav-wrapper {
        flex-shrink: 0;
      }

      .n-tabs-pane-wrapper {
        flex: 1;
        overflow-y: auto;
      }
    }
  }
}
</style>
