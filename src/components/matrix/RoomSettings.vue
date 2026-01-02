<template>
  <div class="room-settings">
    <n-tabs v-model:value="activeTab" type="line" justify-content="center">
      <!-- General Settings -->
      <n-tab-pane name="general" tab="基本设置">
        <div class="settings-section">
          <h3>房间信息</h3>
          <n-form ref="generalFormRef" :model="roomInfo" label-placement="left">
            <!-- Room Name -->
            <n-form-item label="房间名称" path="name">
              <n-input
                :value="roomInfo.name ?? ''"
                @update:value="(val: string) => roomInfo.name = val"
                placeholder="输入房间名称"
                maxlength="100"
                show-count
              />
            </n-form-item>

            <!-- Room Topic -->
            <n-form-item label="房间主题" path="topic">
              <n-input
                :value="roomInfo.topic ?? ''"
                type="textarea"
                @update:value="(val: string) => roomInfo.topic = val"
                placeholder="输入房间主题描述"
                :autosize="{ minRows: 2, maxRows: 4 }"
                maxlength="500"
                show-count
              />
            </n-form-item>

            <!-- Room Avatar -->
            <n-form-item label="房间头像">
              <div class="avatar-upload">
                <n-avatar
                  v-if="roomInfo.avatarUrl !== undefined"
                  :src="roomInfo.avatarUrl"
                  :fallback-src="'/default-room-avatar.png'"
                  round
                  size="large"
                >
                  <n-icon :component="Users" size="24" />
                </n-avatar>
                <n-avatar
                  v-else
                  :fallback-src="'/default-room-avatar.png'"
                  round
                  size="large"
                >
                  <n-icon :component="Users" size="24" />
                </n-avatar>
                <n-upload
                  accept="image/*"
                  :max="1"
                  :show-file-list="false"
                  @change="handleAvatarChange"
                >
                  <n-button>更换头像</n-button>
                </n-upload>
              </div>
            </n-form-item>

            <!-- Room Type -->
            <n-form-item label="房间类型">
              <div class="room-type-info">
                <n-tag :type="roomInfo.type === 'm.space' ? 'primary' : 'default'">
                  {{ roomInfo.type === 'm.space' ? '空间' : '普通房间' }}
                </n-tag>
                <span class="room-id">ID: {{ roomId }}</span>
              </div>
            </n-form-item>

            <!-- Room Version -->
            <n-form-item label="房间版本">
              <span>{{ roomInfo.version || 'N/A' }}</span>
            </n-form-item>

            <!-- Creation Info -->
            <n-form-item label="创建信息">
              <div class="creation-info">
                <span>创建者: {{ roomInfo.creator }}</span>
                <span>创建时间: {{ formatTimestamp(roomInfo.created) }}</span>
              </div>
            </n-form-item>

            <!-- Save Button -->
            <n-form-item>
              <n-button
                type="primary"
                :loading="saving"
                @click="saveGeneralSettings"
              >
                保存设置
              </n-button>
            </n-form-item>
          </n-form>
        </div>

        <!-- Access Control -->
        <div class="settings-section">
          <h3>访问控制</h3>
          <n-form :model="accessSettings" label-placement="left">
            <!-- Join Rule -->
            <n-form-item label="加入规则">
              <n-select
                v-model:value="accessSettings.joinRule"
                :options="joinRuleOptions"
                @update:value="updateJoinRule"
              />
              <div class="option-description">
                {{ getJoinRuleDescription(accessSettings.joinRule) }}
              </div>
            </n-form-item>

            <!-- Guest Access -->
            <n-form-item label="访客访问">
              <n-select
                v-model:value="accessSettings.guestAccess"
                :options="guestAccessOptions"
                @update:value="updateGuestAccess"
              />
              <div class="option-description">
                {{ getGuestAccessDescription(accessSettings.guestAccess) }}
              </div>
            </n-form-item>

            <!-- History Visibility -->
            <n-form-item label="历史记录可见性">
              <n-select
                v-model:value="accessSettings.historyVisibility"
                :options="historyVisibilityOptions"
                @update:value="updateHistoryVisibility"
              />
              <div class="option-description">
                {{ getHistoryVisibilityDescription(accessSettings.historyVisibility) }}
              </div>
            </n-form-item>
          </n-form>
        </div>

        <!-- Encryption -->
        <div class="settings-section">
          <h3>加密设置</h3>
          <div class="encryption-settings">
            <div class="encryption-status">
              <n-icon
                :component="roomInfo.encrypted ? Lock : LockOpen"
                :color="roomInfo.encrypted ? '#18a058' : '#d03050'"
                size="20"
              />
              <span>
                房间加密: {{ roomInfo.encrypted ? '已启用' : '未启用' }}
              </span>
            </div>
            <n-alert
              v-if="roomInfo.encrypted"
              type="info"
              title="端到端加密"
            >
              此房间已启用端到端加密，只有房间成员可以解密消息
            </n-alert>
            <n-button
              v-else
              type="primary"
              :loading="enablingEncryption"
              @click="enableEncryption"
            >
              启用端到端加密
            </n-button>
          </div>
        </div>
      </n-tab-pane>

      <!-- Members Management -->
      <n-tab-pane name="members" tab="成员管理">
        <div class="members-section">
          <div class="section-header">
            <h3>房间成员 ({{ members.length }})</h3>
            <div class="member-actions">
              <n-input
                v-model:value="memberSearchQuery"
                placeholder="搜索成员..."
                clearable
                style="width: 200px"
              >
                <template #prefix>
                  <n-icon :component="Search" />
                </template>
              </n-input>
              <n-button @click="showInviteModal = true">
                <n-icon :component="UserPlus" />
                邀请成员
              </n-button>
            </div>
          </div>

          <!-- Member List -->
          <div class="member-list">
            <div
              v-for="member in filteredMembers"
              :key="member.userId"
              class="member-item"
            >
              <n-avatar
                v-if="member.avatarUrl !== undefined"
                :src="member.avatarUrl"
                round
                size="medium"
              >
                {{ getMemberInitials(member) }}
              </n-avatar>
              <n-avatar
                v-else
                round
                size="medium"
              >
                {{ getMemberInitials(member) }}
              </n-avatar>
              <div class="member-info">
                <div class="member-name">
                  {{ member.displayName || member.userId }}
                  <n-tag v-if="(member.powerLevel || 0) >= 50" type="warning" size="tiny">
                    管理员
                  </n-tag>
                  <n-tag v-if="(member.powerLevel || 0) >= 100" type="error" size="tiny">
                    房主
                  </n-tag>
                </div>
                <div class="member-id">{{ member.userId }}</div>
                <div class="member-status">
                  <span class="membership">{{ getMembershipText(member.membership) }}</span>
                  <span class="power-level">权限等级: {{ member.powerLevel || 0 }}</span>
                </div>
              </div>
              <div class="member-actions">
                <n-dropdown
                  :options="getMemberMenuOptions(member)"
                  @select="handleMemberAction($event, member)"
                >
                  <n-button quaternary>
                    <n-icon :component="DotsVertical" />
                  </n-button>
                </n-dropdown>
              </div>
            </div>
          </div>
        </div>

        <!-- Power Levels -->
        <div class="power-levels-section">
          <h3>权限等级</h3>
          <n-form :model="powerLevels" label-placement="left">
            <n-form-item label="默认用户权限">
              <n-input-number
                v-model:value="powerLevels.usersDefault"
                :min="0"
                :max="100"
                @update:value="updatePowerLevels"
              />
            </n-form-item>

            <n-form-item label="默认事件权限">
              <n-input-number
                v-model:value="powerLevels.eventsDefault"
                :min="0"
                :max="100"
                @update:value="updatePowerLevels"
              />
            </n-form-item>

            <n-form-item label="踢出权限">
              <n-input-number
                v-model:value="powerLevels.kick"
                :min="0"
                :max="100"
                @update:value="updatePowerLevels"
              />
            </n-form-item>

            <n-form-item label="封禁权限">
              <n-input-number
                v-model:value="powerLevels.ban"
                :min="0"
                :max="100"
                @update:value="updatePowerLevels"
              />
            </n-form-item>
          </n-form>
        </div>
      </n-tab-pane>

      <!-- Advanced Settings -->
      <n-tab-pane name="advanced" tab="高级设置">
        <div class="advanced-section">
          <h3>房间操作</h3>
          <div class="room-actions">
            <n-button @click="exportRoomData">
              <n-icon :component="Download" />
              导出房间数据
            </n-button>
            <n-button @click="showLeaveModal = true">
              <n-icon :component="Logout" />
              离开房间
            </n-button>
            <n-button
              v-if="isRoomOwner"
              type="error"
              @click="showDeleteModal = true"
            >
              <n-icon :component="Trash" />
              删除房间
            </n-button>
          </div>

          <!-- Room Statistics -->
          <h3>房间统计</h3>
          <div class="room-stats">
            <n-descriptions :column="2">
              <n-descriptions-item label="成员数量">
                {{ members.length }}
              </n-descriptions-item>
              <n-descriptions-item label="消息数量">
                {{ messageCount }}
              </n-descriptions-item>
              <n-descriptions-item label="房间版本">
                {{ roomInfo.version || 'N/A' }}
              </n-descriptions-item>
              <n-descriptions-item label="是否加密">
                <n-tag :type="roomInfo.encrypted ? 'success' : 'error'" size="small">
                  {{ roomInfo.encrypted ? '是' : '否' }}
                </n-tag>
              </n-descriptions-item>
            </n-descriptions>
          </div>

          <!-- Room Events -->
          <h3>最近事件</h3>
          <div class="recent-events">
            <div
              v-for="event in recentEvents"
              :key="event.eventId"
              class="event-item"
            >
              <span class="event-time">{{ formatTime(event.timestamp) }}</span>
              <span class="event-type">{{ event.type }}</span>
              <span class="event-sender">{{ event.sender }}</span>
            </div>
          </div>
        </div>
      </n-tab-pane>
    </n-tabs>

    <!-- Invite Member Modal -->
    <n-modal
      v-model:show="showInviteModal"
      preset="dialog"
      title="邀请成员"
    >
      <div class="invite-content">
        <n-form :model="inviteForm" label-placement="left">
          <n-form-item label="用户ID">
            <n-input
              v-model:value="inviteForm.userId"
              placeholder="@user:example.com"
            />
          </n-form-item>
          <n-form-item label="邀请理由(可选)">
            <n-input
              v-model:value="inviteForm.reason"
              type="textarea"
              placeholder="邀请理由"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </n-form-item>
        </n-form>
      </div>
      <template #action>
        <n-button @click="showInviteModal = false">取消</n-button>
        <n-button
          type="primary"
          :loading="inviting"
          @click="inviteMember"
        >
          邀请
        </n-button>
      </template>
    </n-modal>

    <!-- Leave Room Modal -->
    <n-modal
      v-model:show="showLeaveModal"
      preset="dialog"
      type="warning"
      title="离开房间"
    >
      <p>确定要离开这个房间吗？</p>
      <template #action>
        <n-button @click="showLeaveModal = false">取消</n-button>
        <n-button
          type="warning"
          :loading="leaving"
          @click="leaveRoom"
        >
          离开
        </n-button>
      </template>
    </n-modal>

    <!-- Delete Room Modal -->
    <n-modal
      v-model:show="showDeleteModal"
      preset="dialog"
      type="error"
      title="删除房间"
    >
      <p>
        <strong>警告：</strong>删除房间是不可逆的，所有消息和历史记录将被永久删除。
      </p>
      <n-input
        v-model:value="deleteConfirmText"
        placeholder="输入房间ID以确认删除"
        style="margin-top: 16px"
      />
      <template #action>
        <n-button @click="showDeleteModal = false">取消</n-button>
        <n-button
          type="error"
          :disabled="deleteConfirmText !== roomId"
          :loading="deleting"
          @click="deleteRoom"
        >
          删除
        </n-button>
      </template>
    </n-modal>

    <!-- Member Profile Modal -->
    <n-modal
      v-model:show="showMemberProfileModal"
      preset="card"
      title="成员资料"
      :style="{ width: '500px' }"
      :bordered="false"
    >
      <div v-if="selectedMember" class="member-profile-content">
        <!-- 头像和基本信息 -->
        <div class="member-header">
          <n-avatar
            :src="selectedMember.avatarUrl ? AvatarUtils.getAvatarUrl(selectedMember.avatarUrl) : undefined"
            :fallback-src="'/default-avatar.png'"
            round
            :size="80"
          >
            <n-icon :component="User" size="40" />
          </n-avatar>
          <div class="member-basic-info">
            <h3>{{ selectedMember.displayName || selectedMember.userId }}</h3>
            <p class="member-user-id">{{ selectedMember.userId }}</p>
            <n-tag :type="getMembershipTagType(selectedMember.membership)" size="small">
              {{ getMembershipText(selectedMember.membership) }}
            </n-tag>
          </div>
        </div>

        <!-- 权限信息 -->
        <div class="member-section">
          <h4>权限等级</h4>
          <n-descriptions :column="1" size="small">
            <n-descriptions-item label="权限值">
              {{ selectedMember.powerLevel || 0 }}
            </n-descriptions-item>
            <n-descriptions-item label="角色">
              {{ getPowerLevelRole(selectedMember.powerLevel || 0) }}
            </n-descriptions-item>
          </n-descriptions>
        </div>

        <!-- 加入时间 -->
        <div v-if="selectedMember.joinedAt" class="member-section">
          <h4>加入信息</h4>
          <n-descriptions :column="1" size="small">
            <n-descriptions-item label="加入时间">
              {{ formatTimestamp(selectedMember.joinedAt) }}
            </n-descriptions-item>
          </n-descriptions>
        </div>

        <!-- 操作按钮 -->
        <div class="member-actions">
          <n-button
            v-if="selectedMember.userId !== currentUserId"
            type="error"
            size="small"
            @click="kickSelectedMember"
            :disabled="!canManageMember"
          >
            踢出成员
          </n-button>
          <n-button
            v-if="selectedMember.userId !== currentUserId"
            type="warning"
            size="small"
            @click="banSelectedMember"
            :disabled="!canManageMember"
          >
            封禁成员
          </n-button>
        </div>
      </div>
      <template #footer>
        <n-button @click="showMemberProfileModal = false">关闭</n-button>
      </template>
    </n-modal>

    <!-- Power Level Editor Modal -->
    <n-modal
      v-model:show="showPowerLevelEditor"
      preset="card"
      title="权限等级编辑"
      :style="{ width: '800px' }"
      :bordered="false"
    >
      <PowerLevelEditor
        v-if="showPowerLevelEditor"
        :room-id="roomId"
        @saved="handlePowerLevelsSaved"
        @cancelled="showPowerLevelEditor = false"
      />
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { logger } from '@/utils/logger'
import {
  NTabs,
  NTabPane,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NButton,
  NAvatar,
  NTag,
  NIcon,
  NUpload,
  NAlert,
  NDescriptions,
  NDescriptionsItem,
  NDropdown,
  NModal,
  useMessage
} from 'naive-ui'
import { Users, Lock, LockOpen, Search, UserPlus, DotsVertical, Download, Logout, Trash, User } from '@vicons/tabler'
import { matrixRoomManager } from '@/services/matrixRoomManager'
import type { MatrixMember } from '@/types/matrix'
import { matrixClientService } from '@/integrations/matrix/client'
import { getUserId, getRoom } from '@/utils/matrixClientUtils'
import PowerLevelEditor from '@/components/rooms/PowerLevelEditor.vue'

// PowerLevelConfig 接口定义 (与 PowerLevelEditor.vue 保持一致)
interface PowerLevelConfig {
  users: Record<string, number>
  users_default: number
  events: Record<string, number>
  events_default: number
  state_default: number
  ban: number
  kick: number
  redact: number
  invite: number
}

interface Props {
  roomId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  settingsUpdated: []
  memberInvited: [userId: string]
  memberRemoved: [userId: string]
  roomLeft: []
  roomDeleted: []
}>()

const message = useMessage()

// Current user ID
const client = matrixClientService.getClient()
const currentUserId = getUserId(client)

// State
const activeTab = ref('general')
const saving = ref(false)
const enablingEncryption = ref(false)
const inviting = ref(false)
const leaving = ref(false)
const deleting = ref(false)
const showInviteModal = ref(false)
const showLeaveModal = ref(false)
const showDeleteModal = ref(false)
const showMemberProfileModal = ref(false)
const showPowerLevelEditor = ref(false)
const deleteConfirmText = ref('')
const memberSearchQuery = ref('')
const messageCount = ref(0)

// Member profile state
const selectedMember = ref<MatrixMember | null>(null)

// Forms
const generalFormRef = ref()
interface RoomInfoState {
  name?: string
  topic?: string
  avatar?: File | undefined
  joinRule: 'public' | 'invite' | 'knock' | 'restricted'
  guestAccess: 'can_join' | 'forbidden'
  historyVisibility: 'world_readable' | 'shared' | 'invited' | 'joined'
  encryption?: boolean
  roomVersion?: string
  avatarUrl?: string
  type?: string
  version?: string
  creator?: string
  created?: number
  encrypted?: boolean
}
const roomInfo = reactive<RoomInfoState>({
  name: '',
  topic: '',
  joinRule: 'invite',
  guestAccess: 'forbidden',
  historyVisibility: 'shared',
  encryption: false,
  roomVersion: '',
  avatarUrl: '',
  type: 'm.room',
  version: '',
  creator: '',
  encrypted: false
})

const accessSettings = reactive({
  joinRule: 'invite' as 'public' | 'invite' | 'knock' | 'restricted',
  guestAccess: 'forbidden' as 'can_join' | 'forbidden',
  historyVisibility: 'shared' as 'world_readable' | 'shared' | 'invited' | 'joined'
})

const powerLevels = reactive({
  usersDefault: 0,
  eventsDefault: 0,
  stateDefault: 50,
  ban: 50,
  kick: 50,
  redact: 50,
  invite: 0,
  roomName: 50,
  roomAvatar: 50,
  roomTopic: 50,
  powerLevel: 50
})

const inviteForm = reactive({
  userId: '',
  reason: ''
})

const members = ref<MatrixMember[]>([])

// Recent event interface
interface RecentEvent {
  eventId: string
  timestamp: number
  type: string
  sender: string
}

const recentEvents = ref<RecentEvent[]>([])

// Options
const joinRuleOptions = [
  { label: '公开(任何人都可以加入)', value: 'public' },
  { label: '邀请制', value: 'invite' },
  { label: '敲门制', value: 'knock' },
  { label: '受限', value: 'restricted' }
]

const guestAccessOptions = [
  { label: '禁止', value: 'forbidden' },
  { label: '可以加入', value: 'can_join' }
]

const historyVisibilityOptions = [
  { label: '任何人可见', value: 'world_readable' },
  { label: '成员可见', value: 'shared' },
  { label: '受邀者可见', value: 'invited' },
  { label: '加入后可见', value: 'joined' }
]

// Computed
const filteredMembers = computed(() => {
  if (!memberSearchQuery.value) return members.value

  const query = memberSearchQuery.value.toLowerCase()
  return members.value.filter(
    (member) => member.displayName?.toLowerCase().includes(query) || member.userId.toLowerCase().includes(query)
  )
})

const isRoomOwner = computed(() => {
  const client = matrixClientService.getClient()
  const myUserId = getUserId(client)
  const myMember = members.value.find((m) => m.userId === myUserId)
  return (myMember?.powerLevel || 0) >= 100
})

// Methods
// Extended Matrix types for room state access
interface MatrixRoomState {
  getStateEvents?: (eventType: string, stateKey?: string) => unknown[] | undefined
}

interface MatrixRoomWithState {
  currentState?: MatrixRoomState
}

interface MatrixCreateEvent {
  getContent?: () => {
    room_version?: string
    creator?: string
  }
  getTs?: () => number
}

const loadRoomInfo = async () => {
  try {
    const summary = matrixRoomManager.getRoomSummary(props.roomId)
    if (summary) {
      const client = matrixClientService.getClient()
      const room = getRoom(client, props.roomId) as MatrixRoomWithState | undefined
      const createEvents =
        room?.currentState?.getStateEvents?.('m.room.create', '') ||
        room?.currentState?.getStateEvents?.('m.room.create') ||
        undefined
      const createEvent = (Array.isArray(createEvents) ? createEvents[0] : createEvents) as
        | MatrixCreateEvent
        | undefined
      const createContent = createEvent?.getContent?.()
      const version = createContent?.room_version
      const creator = createContent?.creator
      const created = createEvent?.getTs?.()

      Object.assign(roomInfo, {
        name: summary.name,
        topic: summary.topic,
        avatarUrl: summary.avatar,
        joinRule: summary.joinRule,
        guestAccess: summary.guestAccess,
        historyVisibility: summary.historyVisibility,
        encrypted: summary.encrypted,
        version: version || '',
        creator: creator || '',
        created: created
      })

      Object.assign(accessSettings, {
        joinRule: summary.joinRule || 'invite',
        guestAccess: summary.guestAccess || 'forbidden',
        historyVisibility: summary.historyVisibility || 'shared'
      })
    }

    // Load power levels
    const pl = await matrixRoomManager.getRoomPowerLevels(props.roomId)
    Object.assign(powerLevels, pl)

    // Load members
    members.value = await matrixRoomManager.getRoomMembers(props.roomId)

    // Load message count and recent events
    try {
      const messagesResponse = await matrixRoomManager.getRoomMessages(props.roomId, 20)
      messageCount.value = messagesResponse.events.length

      // Parse recent events for display
      const events: RecentEvent[] = []
      for (const event of messagesResponse.events) {
        const eventLike = event as {
          eventId?: string
          event_id?: string
          getTs?: () => number
          ts?: number
          origin_server_ts?: number
          getType?: () => string
          type?: string
          getSender?: () => string
          sender?: string
        }
        const eventId = eventLike.eventId || eventLike.event_id || ''
        const timestamp = eventLike.getTs?.() || eventLike.ts || eventLike.origin_server_ts || 0
        const type = eventLike.getType?.() || eventLike.type || 'unknown'
        const sender = eventLike.getSender?.() || eventLike.sender || 'unknown'

        if (eventId && timestamp) {
          events.push({
            eventId,
            timestamp,
            type: getEventTypeDisplayName(type),
            sender: formatUserId(sender)
          })
        }
      }
      recentEvents.value = events.slice(0, 10) // Show max 10 recent events
    } catch (error) {
      logger.warn('[RoomSettings] Failed to load room messages:', error)
      // Don't show error for this optional feature
    }
  } catch (error) {
    message.error('加载房间信息失败')
  }
}

const saveGeneralSettings = async () => {
  saving.value = true
  try {
    // Only include properties that have defined values
    const settings: Record<string, unknown> = {}
    if (roomInfo.name !== undefined) settings.name = roomInfo.name
    if (roomInfo.topic !== undefined) settings.topic = roomInfo.topic
    if (roomInfo.avatar !== undefined) settings.avatar = roomInfo.avatar
    if (roomInfo.joinRule !== undefined) settings.joinRule = roomInfo.joinRule
    if (roomInfo.guestAccess !== undefined) settings.guestAccess = roomInfo.guestAccess
    if (roomInfo.historyVisibility !== undefined) settings.historyVisibility = roomInfo.historyVisibility
    if (roomInfo.encrypted !== undefined) settings.encrypted = roomInfo.encrypted

    await matrixRoomManager.updateRoomSettings(props.roomId, settings)
    message.success('设置已保存')
    emit('settingsUpdated')
  } catch (error) {
    message.error('保存设置失败')
  } finally {
    saving.value = false
  }
}

const updateJoinRule = async (value: string) => {
  try {
    await matrixRoomManager.updateRoomSettings(props.roomId, {
      joinRule: value as 'public' | 'invite' | 'knock' | 'restricted'
    })
    message.success('加入规则已更新')
  } catch (error) {
    message.error('更新加入规则失败')
  }
}

const updateGuestAccess = async (value: string) => {
  try {
    await matrixRoomManager.updateRoomSettings(props.roomId, {
      guestAccess: value as 'can_join' | 'forbidden'
    })
    message.success('访客访问设置已更新')
  } catch (error) {
    message.error('更新访客访问设置失败')
  }
}

const updateHistoryVisibility = async (value: string) => {
  try {
    await matrixRoomManager.updateRoomSettings(props.roomId, {
      historyVisibility: value as 'world_readable' | 'shared' | 'invited' | 'joined'
    })
    message.success('历史记录可见性已更新')
  } catch (error) {
    message.error('更新历史记录可见性失败')
  }
}

const updatePowerLevels = async () => {
  try {
    await matrixRoomManager.updateRoomPowerLevels(props.roomId, powerLevels)
    message.success('权限等级已更新')
  } catch (error) {
    message.error('更新权限等级失败')
  }
}

const enableEncryption = async () => {
  enablingEncryption.value = true
  try {
    await matrixRoomManager.updateRoomSettings(props.roomId, {
      encryption: true
    })
    roomInfo.encrypted = true
    message.success('端到端加密已启用')
  } catch (error) {
    message.error('启用加密失败')
  } finally {
    enablingEncryption.value = false
  }
}

// Upload file interface - match Naive UI's UploadFileInfo
const handleAvatarChange = (data: { file: { file: File | null } }) => {
  if (data.file?.file) {
    roomInfo.avatar = data.file.file
  }
}

const inviteMember = async () => {
  if (!inviteForm.userId) {
    message.warning('请输入用户ID')
    return
  }

  inviting.value = true
  try {
    await matrixRoomManager.inviteUser(props.roomId, inviteForm.userId, inviteForm.reason)
    message.success('邀请已发送')
    emit('memberInvited', inviteForm.userId)
    showInviteModal.value = false
    inviteForm.userId = ''
    inviteForm.reason = ''
    await loadRoomInfo()
  } catch (error) {
    message.error('邀请成员失败')
  } finally {
    inviting.value = false
  }
}

const getMemberMenuOptions = (member: MatrixMember) => {
  const client = matrixClientService.getClient()
  const myUserId = getUserId(client)
  const myPowerLevel = members.value.find((m) => m.userId === myUserId)?.powerLevel || 0

  const options = []

  // View profile
  options.push({
    label: '查看资料',
    key: 'profile'
  })

  // Power level management
  if (myPowerLevel >= (member.powerLevel || 0) + 10 && member.userId !== myUserId) {
    options.push({
      label: '修改权限',
      key: 'power'
    })
  }

  // Kick member
  if (myPowerLevel > (member.powerLevel || 0) && member.userId !== myUserId) {
    options.push({
      label: '踢出',
      key: 'kick'
    })
  }

  // Ban member
  if (myPowerLevel >= powerLevels.ban && member.userId !== myUserId) {
    options.push({
      label: '封禁',
      key: 'ban'
    })
  }

  return options
}

const handleMemberAction = async (action: string, member: MatrixMember) => {
  switch (action) {
    case 'profile':
      selectedMember.value = member
      showMemberProfileModal.value = true
      break
    case 'power':
      selectedMember.value = member
      showPowerLevelEditor.value = true
      break
    case 'kick':
      await kickMember(member)
      break
    case 'ban':
      await banMember(member)
      break
  }
}

const kickMember = async (member: MatrixMember) => {
  try {
    await matrixRoomManager.kickUser(props.roomId, member.userId)
    message.success('成员已踢出')
    emit('memberRemoved', member.userId)
    await loadRoomInfo()
  } catch (error) {
    message.error('踢出成员失败')
  }
}

const banMember = async (member: MatrixMember) => {
  try {
    await matrixRoomManager.banUser(props.roomId, member.userId)
    message.success('成员已封禁')
    emit('memberRemoved', member.userId)
    await loadRoomInfo()
  } catch (error) {
    message.error('封禁成员失败')
  }
}

// 处理权限等级保存
const handlePowerLevelsSaved = async (_powerLevels: PowerLevelConfig) => {
  try {
    showPowerLevelEditor.value = false
    message.success('权限等级已更新')
    await loadRoomInfo()
  } catch (error) {
    logger.error('[RoomSettings] Failed to save power levels:', error)
    message.error('保存权限等级失败')
  }
}

const leaveRoom = async () => {
  leaving.value = true
  try {
    await matrixRoomManager.leaveRoom(props.roomId)
    message.success('已离开房间')
    emit('roomLeft')
    showLeaveModal.value = false
  } catch (error) {
    message.error('离开房间失败')
  } finally {
    leaving.value = false
  }
}

const deleteRoom = async () => {
  if (deleteConfirmText.value !== props.roomId) {
    message.warning('请输入正确的房间ID')
    return
  }

  deleting.value = true
  try {
    // In Matrix, "deleting" a room means leaving it and then forgetting it
    // True deletion (removing from server) requires admin API access
    await matrixRoomManager.leaveRoom(props.roomId)
    await matrixRoomManager.forgetRoom(props.roomId)

    message.success('房间已删除')
    emit('roomDeleted')
    showDeleteModal.value = false
  } catch (error) {
    logger.error('[RoomSettings] Failed to delete room:', error)
    message.error('删除房间失败')
  } finally {
    deleting.value = false
  }
}

const exportRoomData = async () => {
  try {
    // Collect all room data
    const roomData = {
      roomId: props.roomId,
      roomInfo: {
        name: roomInfo.name,
        topic: roomInfo.topic,
        avatarUrl: roomInfo.avatarUrl,
        type: roomInfo.type,
        version: roomInfo.version,
        creator: roomInfo.creator,
        created: roomInfo.created,
        encrypted: roomInfo.encrypted
      },
      accessSettings: {
        joinRule: accessSettings.joinRule,
        guestAccess: accessSettings.guestAccess,
        historyVisibility: accessSettings.historyVisibility
      },
      powerLevels: { ...powerLevels },
      members: members.value.map((m) => ({
        userId: m.userId,
        displayName: m.displayName,
        powerLevel: m.powerLevel,
        membership: m.membership
      })),
      recentEvents: recentEvents.value,
      exportDate: new Date().toISOString()
    }

    // Create JSON blob and download
    const blob = new Blob([JSON.stringify(roomData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `room-${props.roomId}-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    message.success('房间数据已导出')
    logger.info('[RoomSettings] Room data exported', { roomId: props.roomId })
  } catch (error) {
    logger.error('[RoomSettings] Failed to export room data:', error)
    message.error('导出房间数据失败')
  }
}

// Helper methods
const getJoinRuleDescription = (rule: string): string => {
  const descriptions = {
    public: '任何人都可以加入房间',
    invite: '只有被邀请的用户才能加入',
    knock: '用户可以申请加入，需要管理员批准',
    restricted: '只有特定用户可以加入'
  }
  return descriptions[rule as keyof typeof descriptions] || ''
}

const getGuestAccessDescription = (access: string): string => {
  const descriptions = {
    can_join: '访客可以加入房间',
    forbidden: '禁止访客访问'
  }
  return descriptions[access as keyof typeof descriptions] || ''
}

const getHistoryVisibilityDescription = (visibility: string): string => {
  const descriptions = {
    world_readable: '任何人都可以查看历史消息',
    shared: '成员可以查看加入前的历史消息',
    invited: '受邀者可以查看历史消息',
    joined: '只能查看加入后的历史消息'
  }
  return descriptions[visibility as keyof typeof descriptions] || ''
}

const getMemberInitials = (member: MatrixMember): string => {
  const name = member.displayName || member.userId
  if (!name) return '?'
  const names = name.split(' ')
  if (names.length >= 2) {
    const first = names[0]
    const second = names[1]
    if (first && second) {
      const firstChar = first[0]
      const secondChar = second[0]
      if (firstChar !== undefined && secondChar !== undefined) {
        return firstChar + secondChar
      }
    }
  }
  return name.substring(0, 2).toUpperCase()
}

const getMembershipText = (membership: string): string => {
  const texts = {
    join: '已加入',
    invite: '已邀请',
    leave: '已离开',
    ban: '已封禁',
    knock: '申请中'
  }
  return texts[membership as keyof typeof texts] || membership
}

const getMembershipTagType = (membership: string): 'success' | 'info' | 'warning' | 'error' | 'default' => {
  const types: Record<string, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
    join: 'success',
    invite: 'info',
    leave: 'default',
    ban: 'error',
    knock: 'warning'
  }
  return types[membership] || 'default'
}

const getPowerLevelRole = (powerLevel: number): string => {
  if (powerLevel >= 100) return '房主'
  if (powerLevel >= 50) return '管理员'
  if (powerLevel >= 10) return '版主'
  return '成员'
}

const canManageMember = computed(() => {
  if (!selectedMember.value) return false
  const myPowerLevel = members.value.find((m) => m.userId === currentUserId)?.powerLevel || 0
  const memberPowerLevel = selectedMember.value.powerLevel || 0
  return myPowerLevel > memberPowerLevel
})

const kickSelectedMember = async () => {
  if (!selectedMember.value) return
  try {
    await matrixRoomManager.kickUser(props.roomId, selectedMember.value.userId)
    message.success('成员已踢出')
    emit('memberRemoved', selectedMember.value.userId)
    showMemberProfileModal.value = false
    await loadRoomInfo()
  } catch (error) {
    message.error('踢出成员失败')
  }
}

const banSelectedMember = async () => {
  if (!selectedMember.value) return
  try {
    await matrixRoomManager.banUser(props.roomId, selectedMember.value.userId)
    message.success('成员已封禁')
    emit('memberRemoved', selectedMember.value.userId)
    showMemberProfileModal.value = false
    await loadRoomInfo()
  } catch (error) {
    message.error('封禁成员失败')
  }
}

const formatTimestamp = (timestamp?: number): string => {
  if (!timestamp) return 'N/A'
  return new Date(timestamp).toLocaleString('zh-CN')
}

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString('zh-CN')
}

const getEventTypeDisplayName = (eventType: string): string => {
  const displayNames: Record<string, string> = {
    'm.room.message': '消息',
    'm.room.name': '房间名称',
    'm.room.topic': '房间主题',
    'm.room.avatar': '房间头像',
    'm.room.member': '成员变化',
    'm.room.power_levels': '权限等级',
    'm.room.join_rules': '加入规则',
    'm.room.guest_access': '访客访问',
    'm.room.history_visibility': '历史可见性',
    'm.room.encryption': '加密设置',
    'm.room.create': '房间创建',
    'm.sticker': '贴纸',
    'm.reaction': '反应',
    'm.redaction': '撤回'
  }
  return displayNames[eventType] || eventType
}

const formatUserId = (userId: string): string => {
  // Extract the local part of the Matrix ID (before the :)
  const match = userId.match(/^@?([^:]+):/)
  return match ? match[1] : userId
}

// Lifecycle
onMounted(() => {
  loadRoomInfo()
})
</script>

<style scoped>
.room-settings {
  padding: 24px;
  max-width: 1000px;
  margin: 0 auto;
}

.settings-section {
  margin-bottom: 32px;
}

.settings-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--n-text-color-1);
}

.avatar-upload {
  display: flex;
  align-items: center;
  gap: 16px;
}

.room-type-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.room-id {
  font-family: monospace;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.creation-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--n-text-color-3);
  font-size: 12px;
}

.option-description {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 4px;
}

.encryption-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.encryption-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.members-section .section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.member-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.member-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--n-hover-color);
  border-radius: 8px;
  transition: background 0.2s;
}

.member-item:hover {
  background: var(--n-pressed-color);
}

.member-info {
  flex: 1;
  min-width: 0;
}

.member-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  margin-bottom: 2px;
}

.member-id {
  font-size: 12px;
  color: var(--n-text-color-3);
  font-family: monospace;
}

.member-status {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.power-levels-section {
  margin-top: 32px;
}

.power-levels-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
}

.advanced-section {
  margin-top: 32px;
}

.advanced-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
}

.room-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.room-stats {
  margin: 24px 0;
}

.recent-events {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.event-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: var(--n-hover-color);
  border-radius: 4px;
  font-size: 12px;
}

.event-time {
  color: var(--n-text-color-3);
  min-width: 80px;
}

.event-type {
  color: var(--n-primary-color);
  min-width: 100px;
}

.event-sender {
  flex: 1;
  font-family: monospace;
}

.invite-content {
  padding: 16px 0;
}

/* Member Profile Modal */
.member-profile-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.member-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--n-divider-color);
}

.member-basic-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.member-basic-info h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--n-text-color-1);
}

.member-user-id {
  margin: 0;
  font-size: 13px;
  font-family: monospace;
  color: var(--n-text-color-3);
}

.member-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-section h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--n-text-color-2);
}
</style>
