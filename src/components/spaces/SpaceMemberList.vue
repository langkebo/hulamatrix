<!--
  Space Member List

  View and manage members in a Matrix space.
  Shows members with their roles and allows management actions.

  SDK Integration:
  - space.getJoinedMembers() - Get space members
  - space.getChildren() - Get child rooms
  - client.kick() - Remove member
  - client.ban() - Ban member
-->
<script setup lang="ts">
import { ref, computed, watch, onMounted, h } from 'vue'
import {
  NCard,
  NButton,
  NSpace,
  NInput,
  NSelect,
  NTag,
  NDataTable,
  NAvatar,
  NTooltip,
  NModal,
  NPopconfirm,
  NSpin,
  NEmpty,
  NDivider,
  useMessage
} from 'naive-ui'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import { useI18n } from 'vue-i18n'
import { mxcUrlToHttp } from '@/utils/matrixClientUtils'

interface Props {
  spaceId: string
  filter?: 'all' | 'admin' | 'moderator' | 'member'
  showActions?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  filter: 'all',
  showActions: true
})

const emit = defineEmits<{
  memberKicked: [userId: string]
  memberBanned: [userId: string]
  inviteMember: []
  filterChange: [value: string]
}>()

const message = useMessage()
const { t } = useI18n()

// Type definitions
interface SpaceMember {
  userId: string
  displayName: string
  avatarUrl?: string
  powerLevel: number
  presence?: 'online' | 'offline' | 'unavailable'
  membership?: 'join' | 'invite' | 'ban' | 'leave'
}

interface RoomInfo {
  roomId: string
  name: string
  avatarUrl?: string
}

// State
const loading = ref(false)
const members = ref<SpaceMember[]>([])
const childRooms = ref<RoomInfo[]>([])
const searchQuery = ref('')
const selectedMember = ref<SpaceMember | null>(null)
const showKickConfirm = ref(false)
const showBanConfirm = ref(false)
const showMemberDetail = ref(false)

// Filter options
const filterOptions = computed(() => [
  { label: 'All Members', value: 'all' },
  { label: 'Admins (100+)', value: 'admin' },
  { label: 'Moderators (50+)', value: 'moderator' },
  { label: 'Members (<50)', value: 'member' }
])

// Computed
const filteredMembers = computed(() => {
  let result = members.value

  // Apply role filter
  if (props.filter === 'admin') {
    result = result.filter((m) => m.powerLevel >= 100)
  } else if (props.filter === 'moderator') {
    result = result.filter((m) => m.powerLevel >= 50 && m.powerLevel < 100)
  } else if (props.filter === 'member') {
    result = result.filter((m) => m.powerLevel < 50)
  }

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((m) => m.displayName.toLowerCase().includes(query) || m.userId.toLowerCase().includes(query))
  }

  return result
})

const memberStats = computed(() => {
  return {
    total: members.value.length,
    admin: members.value.filter((m) => m.powerLevel >= 100).length,
    moderator: members.value.filter((m) => m.powerLevel >= 50 && m.powerLevel < 100).length,
    member: members.value.filter((m) => m.powerLevel < 50).length,
    online: members.value.filter((m) => m.presence === 'online').length
  }
})

const hasMembers = computed(() => filteredMembers.value.length > 0)

// Table columns
const columns = computed(() => [
  {
    title: 'Member',
    key: 'displayName',
    render(row: SpaceMember) {
      return h('div', { class: 'member-cell' }, [
        h(NAvatar, {
          src: getAvatarUrl(row.avatarUrl),
          size: 32,
          round: true,
          style: { marginRight: '12px' }
        }),
        h('div', { class: 'member-info' }, [
          h('div', { class: 'member-name' }, [
            h('span', row.displayName),
            row.presence === 'online'
              ? h('span', { class: 'online-indicator online' })
              : h('span', { class: 'online-indicator offline' })
          ]),
          h('div', { class: 'member-id' }, row.userId)
        ])
      ])
    }
  },
  {
    title: 'Role',
    key: 'powerLevel',
    render(row: SpaceMember) {
      return getRoleTag(row.powerLevel)
    }
  },
  {
    title: 'Rooms',
    key: 'rooms',
    render(_row: SpaceMember) {
      // Count rooms where this member is present
      const roomCount = childRooms.value.filter((_room) => {
        // In a real implementation, you'd check if user is in each room
        return true // Placeholder
      }).length

      return h('span', { class: 'room-count' }, `${roomCount} rooms`)
    }
  },
  {
    title: 'Actions',
    key: 'actions',
    render(row: SpaceMember) {
      if (!props.showActions) return null

      return h(NSpace, { size: 'small' }, () => [
        h(
          NTooltip,
          {},
          {
            trigger: () =>
              h(NButton, {
                size: 'small',
                onClick: () => viewMemberDetail(row)
              }),
            default: () => 'View Details'
          }
        ),
        h(
          NPopconfirm,
          {
            onPositiveClick: () => kickMember(row.userId)
          },
          {
            trigger: () =>
              h(NButton, {
                size: 'small',
                type: 'warning',
                disabled: row.powerLevel >= 100
              }),
            default: () => `Kick ${row.displayName}?`
          }
        ),
        h(
          NPopconfirm,
          {
            onPositiveClick: () => banMember(row.userId)
          },
          {
            trigger: () =>
              h(NButton, {
                size: 'small',
                type: 'error',
                disabled: row.powerLevel >= 100
              }),
            default: () => `Ban ${row.displayName}?`
          }
        )
      ])
    }
  }
])

/**
 * Load space members and child rooms
 */
async function loadSpaceData() {
  loading.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const getRoomMethod = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
    const space = getRoomMethod?.(props.spaceId)
    if (!space) {
      throw new Error(`Space not found: ${props.spaceId}`)
    }

    logger.info('[SpaceMemberList] Loading space data:', { spaceId: props.spaceId })

    // Load space members
    const getJoinedMembersMethod = space.getJoinedMembers as (() => Array<Record<string, unknown>>) | undefined
    const memberRecords = getJoinedMembersMethod?.() || []

    // Get power levels
    const getStateEventsMethod = (space.currentState as Record<string, unknown> | undefined)?.getStateEvents as
      | ((type: string, key: string) => { content?: { users?: Record<string, number> } } | undefined)
      | undefined
    const powerLevelsEvent = getStateEventsMethod?.('m.room.power_levels', '')
    const powerLevels = powerLevelsEvent?.content?.users || {}

    members.value = memberRecords.map((member: Record<string, unknown>) => {
      const userId = (member.userId as string) || ''
      const displayName = (member.name as string | undefined) || userId?.split(':')[0]?.replace(/^@/, '') || userId
      const avatarUrl = member.avatarUrl as string | undefined

      return {
        userId,
        displayName,
        avatarUrl,
        powerLevel: (powerLevels[userId] as number) || 0,
        presence: 'offline', // Would need presence API to determine
        membership: 'join'
      }
    })

    // Load child rooms
    const getChildrenMethod = space.getChildren as
      | (() => Array<{ roomId?: string; name?: string; avatarUrl?: string }>)
      | undefined
    const children = getChildrenMethod?.() || []

    childRooms.value = children.map((child) => ({
      roomId: child.roomId || '',
      name: child.name || child.roomId || '',
      avatarUrl: child.avatarUrl
    }))

    logger.info('[SpaceMemberList] Space data loaded:', {
      memberCount: members.value.length,
      childRoomCount: childRooms.value.length
    })
  } catch (error) {
    logger.error('[SpaceMemberList] Failed to load space data:', error)
    message.error('Failed to load space members')
  } finally {
    loading.value = false
  }
}

/**
 * Kick a member from the space
 */
async function kickMember(userId: string) {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    logger.info('[SpaceMemberList] Kicking member:', { spaceId: props.spaceId, userId })

    // Use SDK's kick method
    const kickMethod = client.kick as (roomId: string, userId: string, reason?: string) => Promise<unknown> | undefined

    await kickMethod?.(props.spaceId, userId, 'Kicked from space')

    message.success('Member kicked successfully')
    emit('memberKicked', userId)

    // Reload members
    await loadSpaceData()
  } catch (error) {
    logger.error('[SpaceMemberList] Failed to kick member:', error)
    message.error('Failed to kick member')
  }
}

/**
 * Ban a member from the space
 */
async function banMember(userId: string) {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    logger.info('[SpaceMemberList] Banning member:', { spaceId: props.spaceId, userId })

    // Use SDK's ban method
    const banMethod = client.ban as (roomId: string, userId: string, reason?: string) => Promise<unknown> | undefined

    await banMethod?.(props.spaceId, userId, 'Banned from space')

    message.success('Member banned successfully')
    emit('memberBanned', userId)

    // Reload members
    await loadSpaceData()
  } catch (error) {
    logger.error('[SpaceMemberList] Failed to ban member:', error)
    message.error('Failed to ban member')
  }
}

/**
 * View member details
 */
function viewMemberDetail(member: SpaceMember) {
  selectedMember.value = member
  showMemberDetail.value = true
}

/**
 * Get avatar URL
 */
function getAvatarUrl(mxcUrl?: string): string {
  if (!mxcUrl) return ''
  const client = matrixClientService.getClient()
  if (!client) return ''
  return mxcUrlToHttp(client, mxcUrl, 64, 64) || mxcUrl
}

/**
 * Get role tag for power level
 */
function getRoleTag(powerLevel: number) {
  if (powerLevel >= 100) {
    return h(NTag, { type: 'error', size: 'small' }, { default: () => 'Admin' })
  } else if (powerLevel >= 50) {
    return h(NTag, { type: 'warning', size: 'small' }, { default: () => 'Moderator' })
  } else if (powerLevel >= 10) {
    return h(NTag, { type: 'info', size: 'small' }, { default: () => 'Trusted' })
  }
  return h(NTag, { type: 'default', size: 'small' }, { default: () => 'Member' })
}

/**
 * Handle filter change
 */
function handleFilterChange(value: string) {
  emit('filterChange', value)
}

// Lifecycle
onMounted(() => {
  loadSpaceData()
})

// Watch for prop changes
watch(
  () => props.spaceId,
  () => {
    loadSpaceData()
  }
)
</script>

<template>
  <div class="space-member-list">
    <!-- Header -->
    <div class="space-member-list__header">
      <h3>Space Members</h3>
      <NButton v-if="showActions" type="primary" size="small" @click="emit('inviteMember')">
        Invite Member
      </NButton>
    </div>

    <!-- Stats -->
    <div class="space-member-list__stats">
      <NTag size="small" :bordered="false">Total: {{ memberStats.total }}</NTag>
      <NTag size="small" type="error" :bordered="false">Admins: {{ memberStats.admin }}</NTag>
      <NTag size="small" type="warning" :bordered="false">Mods: {{ memberStats.moderator }}</NTag>
      <NTag size="small" type="success" :bordered="false">Members: {{ memberStats.member }}</NTag>
      <NTag size="small" type="info" :bordered="false">Online: {{ memberStats.online }}</NTag>
    </div>

    <NDivider />

    <!-- Filters and Search -->
    <div class="space-member-list__filters">
      <NInput
        v-model:value="searchQuery"
        placeholder="Search members..."
        clearable
        style="flex: 1">
        <template #prefix>
          <span class="icon">🔍</span>
        </template>
      </NInput>
      <NSelect
        :value="filter"
        :options="filterOptions"
        style="width: 180px"
        @update:value="handleFilterChange" />
    </div>

    <!-- Members Table -->
    <NSpin :show="loading">
      <NCard size="small" class="members-card">
        <NEmpty v-if="!hasMembers && !loading" description="No members found" />

        <n-data-table
          v-else
          :columns="columns"
          :data="filteredMembers"
          :bordered="false"
          size="small"
          :max-height="400" />
      </NCard>
    </NSpin>

    <!-- Member Detail Modal -->
    <NModal
      v-if:if="showMemberDetail"
      :show="showMemberDetail"
      preset="card"
      title="Member Details"
      :style="{ width: '500px' }"
      @update:show="showMemberDetail = false">
      <div v-if="selectedMember" class="member-detail">
        <div class="member-detail__avatar">
          <NAvatar :src="getAvatarUrl(selectedMember.avatarUrl)" :size="80" round />
        </div>

        <div class="member-detail__info">
          <h4>{{ selectedMember.displayName }}</h4>
          <p class="user-id">{{ selectedMember.userId }}</p>
          <div class="role-badge">
            {{ getRoleTag(selectedMember.powerLevel) }}
          </div>
        </div>

        <NDivider />

        <div class="member-detail__sections">
          <div class="detail-section">
            <label>Power Level</label>
            <span>{{ selectedMember.powerLevel }}</span>
          </div>
          <div class="detail-section">
            <label>Presence</label>
            <span>{{ selectedMember.presence || 'Unknown' }}</span>
          </div>
          <div class="detail-section">
            <label>Membership</label>
            <span>{{ selectedMember.membership || 'Unknown' }}</span>
          </div>
        </div>

        <NDivider />

        <div v-if="showActions" class="member-detail__actions">
          <NSpace justify="end">
            <NButton type="warning" @click="kickMember(selectedMember!.userId)">
              Kick Member
            </NButton>
            <NButton type="error" @click="banMember(selectedMember!.userId)">
              Ban Member
            </NButton>
          </NSpace>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.space-member-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.space-member-list__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.space-member-list__header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.space-member-list__stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.space-member-list__filters {
  display: flex;
  gap: 12px;
}

.members-card {
  background: #fff;
}

.member-cell {
  display: flex;
  align-items: center;
}

.member-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-name {
  font-weight: 500;
  font-size: 14px;
  color: #333;
  display: flex;
  align-items: center;
  gap: 6px;
}

.online-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.online-indicator.online {
  background: #18a058;
}

.online-indicator.offline {
  background: #d0d0d0;
}

.member-id {
  font-size: 12px;
  color: #999;
  font-family: monospace;
}

.room-count {
  font-size: 13px;
  color: #666;
}

.member-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.member-detail__avatar {
  display: flex;
  justify-content: center;
  padding: 16px;
}

.member-detail__info {
  text-align: center;
}

.member-detail__info h4 {
  margin: 0 0 4px;
  font-size: 18px;
  color: #333;
}

.member-detail__info .user-id {
  margin: 0 0 8px;
  font-size: 13px;
  color: #999;
  font-family: monospace;
}

.role-badge {
  display: flex;
  justify-content: center;
}

.member-detail__sections {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-section label {
  font-weight: 500;
  font-size: 14px;
  color: #666;
}

.detail-section span {
  font-size: 14px;
  color: #333;
}

.icon {
  font-size: 16px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .space-member-list__header h3 {
    color: #eee;
  }

  .members-card {
    background: #2a2a2a;
  }

  .member-name {
    color: #eee;
  }

  .member-id {
    color: #666;
  }

  .room-count {
    color: #aaa;
  }

  .member-detail__info h4 {
    color: #eee;
  }

  .detail-section label {
    color: #aaa;
  }

  .detail-section span {
    color: #eee;
  }
}
</style>
