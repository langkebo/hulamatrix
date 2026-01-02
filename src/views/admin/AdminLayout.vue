<template>
  <n-flex vertical :size="12" class="p-16px">
    <n-tabs type="segment" v-model:value="active">
      <n-tab-pane name="users" tab="用户管理">
        <AdminUsers />
      </n-tab-pane>
      <n-tab-pane name="rooms" tab="房间治理">
        <AdminRooms />
      </n-tab-pane>
      <n-tab-pane name="media" tab="媒体清理">
        <AdminMedia />
      </n-tab-pane>
      <n-tab-pane name="permissions" tab="权限控制">
        <AdminPermissions />
      </n-tab-pane>
      <n-tab-pane name="room-power" tab="房间权限">
        <AdminRoomPower />
      </n-tab-pane>
      <n-tab-pane name="system" tab="系统配置">
        <AdminSystem />
      </n-tab-pane>
      <n-tab-pane name="devices" tab="设备管理">
        <AdminDevices />
      </n-tab-pane>
      <n-tab-pane name="encryption" tab="加密管理">
        <AdminEncryption />
      </n-tab-pane>
      <n-tab-pane name="metrics" tab="报表与策略">
        <AdminMetrics />
      </n-tab-pane>
    </n-tabs>
  </n-flex>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import AdminUsers from './AdminUsers.vue'
import AdminRooms from './AdminRooms.vue'
import AdminMedia from './AdminMedia.vue'
import AdminPermissions from './AdminPermissions.vue'
import AdminRoomPower from './AdminRoomPower.vue'
import AdminSystem from './AdminSystem.vue'
import AdminDevices from './AdminDevices.vue'
import AdminEncryption from './AdminEncryption.vue'
import AdminMetrics from './AdminMetrics.vue'
const active = ref('users')
</script>
