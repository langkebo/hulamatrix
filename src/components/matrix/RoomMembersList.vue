<template>
  <div class="room-members-list">
    <div class="section-header">
      <h3>房间成员 ({{ members.length }})</h3>
      <div class="member-actions">
        <n-input
          v-model:value="searchQuery"
          placeholder="搜索成员..."
          clearable
          class="member-search-input">
          <template #prefix>
            <n-icon :component="Search" />
          </template>
        </n-input>
        <n-button @click="$emit('invite')">
          <n-icon :component="UserPlus" />
          邀请成员
        </n-button>
      </div>
    </div>

    <!-- Member List -->
    <div class="member-list">
      <div v-for="member in filteredMembers" :key="member.userId" class="member-item">
        <n-avatar v-if="member.avatarUrl !== undefined" :src="member.avatarUrl" round size="medium">
          {{ getMemberInitials(member.displayName || '', member.userId) }}
        </n-avatar>
        <n-avatar v-else round size="medium">
          {{ getMemberInitials(member.displayName || '', member.userId) }}
        </n-avatar>
        <div class="member-info">
          <div class="member-name">
            {{ member.displayName || member.userId }}
            <n-tag v-if="(member.powerLevel || 0) >= 50" type="warning" size="tiny">管理员</n-tag>
            <n-tag v-if="(member.powerLevel || 0) >= 100" type="error" size="tiny">房主</n-tag>
          </div>
          <div class="member-id">{{ member.userId }}</div>
          <div class="member-status">
            <span class="membership">{{ getMembershipText(member.membership) }}</span>
            <span class="power-level">权限等级: {{ member.powerLevel || 0 }}</span>
          </div>
        </div>
        <div class="member-actions">
          <n-dropdown :options="getMemberMenuOptions(member)" @select="$emit('memberAction', { action: $event, member })">
            <n-button quaternary>
              <n-icon :component="DotsVertical" />
            </n-button>
          </n-dropdown>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NInput, NButton, NAvatar, NTag, NIcon, NDropdown } from 'naive-ui'
import { Search, UserPlus, DotsVertical } from '@vicons/tabler'
import type { MatrixMember } from '@/types/matrix'
import { getMemberInitials, getMembershipText } from './roomSettingsUtils'

interface Props {
  members: MatrixMember[]
  currentUserId: string | null
  currentPowerLevel: number
  banThreshold: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  invite: []
  memberAction: [{ action: string; member: MatrixMember }]
}>()

// State
const searchQuery = ref('')

// Computed
const filteredMembers = computed(() => {
  if (!searchQuery.value) return props.members

  const query = searchQuery.value.toLowerCase()
  return props.members.filter(
    (member) => member.displayName?.toLowerCase().includes(query) || member.userId.toLowerCase().includes(query)
  )
})

// Methods
const getMemberMenuOptions = (member: MatrixMember) => {
  const options = []

  // View profile
  options.push({
    label: '查看资料',
    key: 'profile'
  })

  // Power level management
  if (props.currentPowerLevel >= (member.powerLevel || 0) + 10 && member.userId !== props.currentUserId) {
    options.push({
      label: '修改权限',
      key: 'power'
    })
  }

  // Kick member
  if (props.currentPowerLevel > (member.powerLevel || 0) && member.userId !== props.currentUserId) {
    options.push({
      label: '踢出',
      key: 'kick'
    })
  }

  // Ban member
  if (props.currentPowerLevel >= props.banThreshold && member.userId !== props.currentUserId) {
    options.push({
      label: '封禁',
      key: 'ban'
    })
  }

  return options
}
</script>

<style scoped>
.room-members-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.member-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.member-search-input {
  width: 200px;
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
</style>
