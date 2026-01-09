<template>
  <div class="space-members">
    <!-- 搜索和操作栏 -->
    <div class="members-header">
      <n-input
        v-model:value="searchQuery"
        size="small"
        placeholder="搜索成员..."
        clearable>
        <template #prefix>
          <n-icon><Search /></n-icon>
        </template>
      </n-input>

      <n-button
        v-if="isAdmin"
        type="primary"
        size="small"
        @click="$emit('invite-members')">
        <template #icon>
          <n-icon><UserPlus /></n-icon>
        </template>
        邀请成员
      </n-button>
    </div>

    <!-- 成员列表 -->
    <div class="members-list">
      <div v-if="filteredMembers.length === 0" class="empty-state">
        <n-empty description="暂无成员" size="small" />
      </div>

      <div
        v-for="member in filteredMembers"
        :key="member.id"
        class="member-item">
        <div class="member-avatar">
          <n-avatar :size="48" round :src="member.avatar">
            <n-icon><User /></n-icon>
          </n-avatar>
          <n-badge
            v-if="member.isActive"
            type="success"
            dot
            :bottom="2"
            :right="2" />
        </div>

        <div class="member-info">
          <div class="member-name">{{ member.name }}</div>
          <div class="member-meta">
            <n-tag :type="getRoleType(member.role)" size="tiny">
              {{ getRoleLabel(member.role) }}
            </n-tag>
            <span v-if="member.lastActive" class="member-activity">
              {{ formatLastActive(member.lastActive) }}
            </span>
          </div>
        </div>

        <n-dropdown
          :options="getMemberActions(member)"
          @select="(action) => $emit('member-action', { action, member })"
          placement="bottom-end">
          <n-button circle size="small" quaternary>
            <template #icon>
              <n-icon><DotsVertical /></n-icon>
            </template>
          </n-button>
        </n-dropdown>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, type Component } from 'vue'
import { NInput, NButton, NIcon, NAvatar, NTag, NBadge, NEmpty, NDropdown } from 'naive-ui'
import { Search, UserPlus, User, DotsVertical } from '@vicons/tabler'
import type { Member, MemberAction, NaiveType } from './types'

interface Props {
  members: Member[]
  isAdmin?: boolean
  currentUserId?: string
}

interface Emits {
  (e: 'invite-members'): void
  (e: 'member-action', payload: { action: MemberAction; member: Member }): void
}

const props = withDefaults(defineProps<Props>(), {
  isAdmin: false,
  currentUserId: ''
})

const emit = defineEmits<Emits>()

const searchQuery = ref('')

const filteredMembers = computed(() => {
  if (!searchQuery.value) return props.members

  const query = searchQuery.value.toLowerCase()
  return props.members.filter(member =>
    member.name.toLowerCase().includes(query)
  )
})

const formatLastActive = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return '刚刚活跃'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前活跃`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前活跃`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前活跃`

  return '更早活跃'
}

const getRoleType = (role: string): NaiveType => {
  const roleMap: Record<string, NaiveType> = {
    admin: 'error',
    moderator: 'warning',
    member: 'default'
  }
  return roleMap[role] || 'default'
}

const getRoleLabel = (role: string): string => {
  const roleMap: Record<string, string> = {
    admin: '管理员',
    moderator: '版主',
    member: '成员'
  }
  return roleMap[role] || '成员'
}

const getMemberActions = (member: Member) => {
  const isCurrentUser = member.id === props.currentUserId

  return [
    {
      label: '发送消息',
      key: 'message'
    },
    {
      label: member.role === 'admin' ? '降级为版主' : '提升为管理员',
      key: 'promote',
      disabled: !props.isAdmin || isCurrentUser
    },
    {
      label: '移除成员',
      key: 'remove',
      disabled: !props.isAdmin || isCurrentUser
    }
  ]
}
</script>

<style lang="scss" scoped>
.space-members {
  padding: 24px;

  .members-header {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;

    .n-input {
      flex: 1;
    }
  }

  .members-list {
    .member-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      margin-bottom: 8px;
      background: var(--bg-setting-item);
      border-radius: 8px;
      transition: all 0.2s;

      &:hover {
        background: var(--bg-msg-hover);
      }

      .member-avatar {
        position: relative;
        flex-shrink: 0;
      }

      .member-info {
        flex: 1;
        min-width: 0;

        .member-name {
          font-weight: 600;
          font-size: 15px;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .member-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 12px;

          .member-activity {
            color: var(--text-color-3);
          }
        }
      }
    }

    .empty-state {
      padding: 40px 0;
      text-align: center;
    }
  }
}
</style>
