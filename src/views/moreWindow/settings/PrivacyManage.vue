<template>
  <n-space vertical :size="16" class="p-16px">
    <n-tabs type="line" v-model:value="tab">
      <n-tab-pane name="blockedUsers" tab="屏蔽的用户">
        <n-data-table :columns="userCols" :data="blockedUsers" :bordered="false" />
      </n-tab-pane>
      <n-tab-pane name="blockedRooms" tab="屏蔽的房间">
        <n-data-table :columns="roomCols" :data="blockedRooms" :bordered="false" />
      </n-tab-pane>
      <n-tab-pane name="reports" tab="举报记录">
        <n-data-table :columns="reportCols" :data="reports" :bordered="false" />
      </n-tab-pane>
    </n-tabs>
  </n-space>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
const msg = useMessage()
const tab = ref('blockedUsers')
const blockedUsers = ref<Array<{ mxid: string }>>([])
const blockedRooms = ref<Array<{ roomId: string }>>([])
const reports = ref<Array<{ target: string; reason: string; time: string }>>([])
interface BlockedUser {
  mxid: string
  [key: string]: unknown
}

interface BlockedRoom {
  roomId: string
  [key: string]: unknown
}

const userCols = [
  { title: '用户', key: 'mxid' },
  {
    title: '操作',
    key: 'action',
    render: (row: BlockedUser) => h('a', { onClick: () => unblockUser(row.mxid) }, '取消屏蔽')
  }
]
const roomCols = [
  { title: '房间', key: 'roomId' },
  {
    title: '操作',
    key: 'action',
    render: (row: BlockedRoom) => h('a', { onClick: () => unblockRoom(row.roomId) }, '取消屏蔽')
  }
]
const reportCols = [
  { title: '目标', key: 'target' },
  { title: '原因', key: 'reason' },
  { title: '时间', key: 'time' }
]
import { h } from 'vue'
const fetchData = async () => {
  try {
    const { listBlockedUsers, listBlockedRooms, listReports } = await import('@/integrations/synapse/privacy')
    blockedUsers.value = await listBlockedUsers()
    blockedRooms.value = await listBlockedRooms()
    reports.value = await listReports()
  } catch {
    msg.error('加载失败')
  }
}
const unblockUser = async (mxid: string) => {
  try {
    const { unblockUser } = await import('@/integrations/synapse/privacy')
    await unblockUser(mxid)
    await fetchData()
    msg.success('已取消屏蔽')
  } catch {
    msg.error('操作失败')
  }
}
const unblockRoom = async (roomId: string) => {
  try {
    const { unblockRoom } = await import('@/integrations/synapse/privacy')
    await unblockRoom(roomId)
    await fetchData()
    msg.success('已取消屏蔽')
  } catch {
    msg.error('操作失败')
  }
}
onMounted(fetchData)
</script>
