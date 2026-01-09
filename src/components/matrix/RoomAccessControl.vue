<template>
  <div class="room-access-control">
    <h3>访问控制</h3>
    <n-form :model="accessSettings" label-placement="left">
      <!-- Join Rule -->
      <n-form-item label="加入规则">
        <n-select
          :value="accessSettings.joinRule"
          :options="joinRuleOptions"
          @update:value="$emit('updateJoinRule', $event)" />
        <div class="option-description">
          {{ getJoinRuleDescription(accessSettings.joinRule) }}
        </div>
      </n-form-item>

      <!-- Guest Access -->
      <n-form-item label="访客访问">
        <n-select
          :value="accessSettings.guestAccess"
          :options="guestAccessOptions"
          @update:value="$emit('updateGuestAccess', $event)" />
        <div class="option-description">
          {{ getGuestAccessDescription(accessSettings.guestAccess) }}
        </div>
      </n-form-item>

      <!-- History Visibility -->
      <n-form-item label="历史记录可见性">
        <n-select
          :value="accessSettings.historyVisibility"
          :options="historyVisibilityOptions"
          @update:value="$emit('updateHistoryVisibility', $event)" />
        <div class="option-description">
          {{ getHistoryVisibilityDescription(accessSettings.historyVisibility) }}
        </div>
      </n-form-item>
    </n-form>
  </div>
</template>

<script setup lang="ts">
import { NForm, NFormItem, NSelect } from 'naive-ui'
import { getJoinRuleDescription, getGuestAccessDescription, getHistoryVisibilityDescription } from './roomSettingsUtils'

interface AccessSettings {
  joinRule: 'public' | 'invite' | 'knock' | 'restricted'
  guestAccess: 'can_join' | 'forbidden'
  historyVisibility: 'world_readable' | 'shared' | 'invited' | 'joined'
}

interface Props {
  accessSettings: AccessSettings
}

defineProps<Props>()

defineEmits<{
  updateJoinRule: [value: 'public' | 'invite' | 'knock' | 'restricted']
  updateGuestAccess: [value: 'can_join' | 'forbidden']
  updateHistoryVisibility: [value: 'world_readable' | 'shared' | 'invited' | 'joined']
}>()

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
</script>

<style scoped>
.room-access-control {
  margin-bottom: 32px;
}

.room-access-control h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--n-text-color-1);
}

.option-description {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 4px;
}
</style>
