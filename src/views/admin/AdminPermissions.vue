<template>
  <n-flex vertical :size="12">
    <n-flex>
      <n-select v-model:value="selectedUserId" :options="userOptions" placeholder="选择用户" style="max-width: 240px" />
      <n-select v-model:value="selectedRoleId" :options="roleOptions" placeholder="选择角色" style="max-width: 240px" />
      <n-button @click="assignRole" type="primary">授予角色</n-button>
    </n-flex>
    <n-alert type="info">基于房间权限 `m.room.power_levels` 与管理员 API 的权限变更</n-alert>
  </n-flex>
</template>
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAdminStore } from '@/stores/admin'

import { msg } from '@/utils/SafeUI'
const store = useAdminStore()
const selectedUserId = ref<string | null>(null)
const selectedRoleId = ref<string | null>(null)
onMounted(async () => {
  await store.fetchUsers()
  await store.fetchRoles()
})
const userOptions = computed(() =>
  store.users.map((u) => ({ label: u.displayName || u.username || u.id, value: u.id }))
)
const roleOptions = computed(() => store.roles.map((r) => ({ label: r.name || r.id, value: r.id })))
const assignRole = async () => {
  if (!selectedUserId.value || !selectedRoleId.value) return
  await store.setRole(selectedUserId.value, selectedRoleId.value)
  msg.success?.('已授予角色')
}
</script>
