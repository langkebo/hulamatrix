<template>
  <n-flex vertical :size="12">
    <n-flex align="center" :size="8">
      <n-input v-model:value="q" placeholder="搜索房间名或ID" class="search-input" />
      <n-button @click="fetchRooms" :loading="loading">刷新</n-button>
    </n-flex>
    <n-data-table :columns="columns" :data="filtered" size="small" />
    <n-flex align="center" :size="8" class="mt-8px">
      <n-input v-model:value="roomId" placeholder="room_id" class="room-id-input" />
      <n-select
        v-model:value="visibility"
        :options="[
          { label: 'public', value: 'public' },
          { label: 'private', value: 'private' }
        ]"
        class="visibility-select" />
      <n-button @click="applyVisibility">设置目录可见性</n-button>
    </n-flex>
    <n-flex align="center" :size="8" class="mt-8px">
      <n-input v-model:value="purgeRoomId" placeholder="room_id" class="room-id-input" />
      <n-input-number v-model:value="purgeDays" :min="1" :max="365" />
      <n-button type="warning" @click="applyPurge">清理历史</n-button>
    </n-flex>

    <n-divider></n-divider>
    <n-flex align="center" :size="8">
      <n-input v-model:value="memberRoomId" placeholder="room_id" class="room-id-input" />
      <n-button @click="fetchMembers">查看成员</n-button>
    </n-flex>
    <n-input v-model:value="reason" placeholder="理由(可选)" class="reason-input mt-6px" />
    <n-data-table :columns="memberCols" :data="pagedMembers" size="small" />
    <n-flex justify="end" class="mt-8px">
      <n-pagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :page-count="pageCount"
        show-size-picker
        :page-sizes="[20, 50, 100, 200]" />
    </n-flex>
  </n-flex>
</template>
<script setup lang="ts">
/**
 * AdminRooms.vue - 房间管理界面
 * Requirements 10.2, 10.3, 10.4: Use SDK methods for standard Matrix operations
 */
import { adminClient } from '@/services/adminClient'
import { setDirectoryVisibility, kickUser, banUser, unbanUser } from '@/integrations/matrix/rooms'
import { listJoinedMembers } from '@/integrations/matrix/members'
import { h, ref, onMounted, computed } from 'vue'
import { useDialog } from 'naive-ui'
import type { AdminRoom as BaseAdminRoom } from '@/types/admin'

// Local type definition for admin rooms - uses base type plus index signature
type LocalAdminRoom = BaseAdminRoom & { [key: string]: unknown }

interface AdminMember {
  user_id: string
  membership: string
  displayname: string
  [key: string]: unknown
}

const rows = ref<LocalAdminRoom[]>([])
const q = ref('')
const loading = ref(false)
const roomId = ref('')
const visibility = ref<'public' | 'private'>('public')
const purgeRoomId = ref('')
const purgeDays = ref<number>(30)

const fetchRooms = async () => {
  loading.value = true
  try {
    // Use AdminClient for Synapse Admin API
    const result = await adminClient.listRooms({ limit: 100 })
    rows.value = (result.rooms || []) as LocalAdminRoom[]
  } finally {
    loading.value = false
  }
}

onMounted(fetchRooms)

const filtered = computed(() =>
  rows.value.filter((r: LocalAdminRoom) => !q.value || String(r.name || r.room_id).includes(q.value))
)

const columns = [
  { title: '房间', key: 'name' },
  { title: 'ID', key: 'room_id' },
  { title: '成员数', key: 'joined_members' },
  { title: '可见性', key: 'public', render: (r: LocalAdminRoom) => (r.public ? 'public' : 'private') },
  {
    title: '操作',
    key: 'actions',
    render(row: LocalAdminRoom) {
      return h('div', { class: 'flex items-center gap-8px' }, [
        h(
          'button',
          {
            class: 'n-button n-button--tiny n-button--error',
            onClick: async () => {
              // Use AdminClient for Synapse Admin API (deleteRoom)
              await adminClient.deleteRoom(row.room_id, { block: true, purge: true })
              await fetchRooms()
            }
          },
          '删除房间'
        )
      ])
    }
  }
]

// Requirements 10.2: Use SDK method for setDirectoryVisibility
const applyVisibility = async () => {
  if (!roomId.value) return
  await setDirectoryVisibility(roomId.value, visibility.value)
  await fetchRooms()
}

const applyPurge = async () => {
  if (!purgeRoomId.value) return
  const ts = Date.now() - purgeDays.value * 24 * 3600 * 1000
  // Use AdminClient for Synapse Admin API (purgeHistory)
  await adminClient.purgeHistory(purgeRoomId.value, ts)
}

const memberRoomId = ref('')
const members = ref<AdminMember[]>([])
const reason = ref('')

// Requirements 10.4: Use SDK method for listing room members
const fetchMembers = async () => {
  if (!memberRoomId.value) return
  const memberList = await listJoinedMembers(memberRoomId.value)
  type MemberWithDisplayName = { userId: string; name?: string; displayName?: string }
  members.value = memberList.map((m) => {
    const member = m as MemberWithDisplayName
    return {
      user_id: member.userId,
      membership: 'join',
      displayname: member.displayName || member.name || member.userId
    } as AdminMember
  })
}

const page = ref(1)
const pageSize = ref(50)
const pageCount = computed(() => Math.max(1, Math.ceil(members.value.length / pageSize.value)))
const pagedMembers = computed(() => members.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
const dialog = useDialog()

const memberCols = [
  { title: '成员', key: 'user_id' },
  { title: '状态', key: 'membership' },
  {
    title: '操作',
    key: 'actions',
    render(row: AdminMember) {
      const confirm = (title: string, onOk: () => Promise<void>) => {
        dialog.warning({
          title,
          content: `目标用户：${row.user_id}\n理由：${reason.value || '（未填写）'}`,
          positiveText: '确定',
          negativeText: '取消',
          onPositiveClick: async () => {
            await onOk()
          }
        })
      }
      return h('div', { class: 'flex items-center gap-8px' }, [
        h(
          'button',
          {
            class: 'n-button n-button--tiny',
            onClick: () =>
              confirm('确认踢出该成员？', async () => {
                // Requirements 10.2: Use SDK method for kick
                await kickUser(memberRoomId.value, row.user_id, reason.value || '')
                await fetchMembers()
              })
          },
          '踢出'
        ),
        h(
          'button',
          {
            class: 'n-button n-button--tiny',
            onClick: () =>
              confirm('确认封禁该成员？', async () => {
                // Requirements 10.3: Use SDK method for ban
                await banUser(memberRoomId.value, row.user_id, reason.value || '')
                await fetchMembers()
              })
          },
          '封禁'
        ),
        h(
          'button',
          {
            class: 'n-button n-button--tiny',
            onClick: () =>
              confirm('确认解除封禁？', async () => {
                // Requirements 10.3: Use SDK method for unban
                await unbanUser(memberRoomId.value, row.user_id)
                await fetchMembers()
              })
          },
          '解除封禁'
        )
      ])
    }
  }
]
</script>

<style scoped>
.search-input {
  max-width: 240px;
}

.room-id-input {
  max-width: 260px;
}

.visibility-select {
  max-width: 160px;
}

.reason-input {
  max-width: 360px;
}
</style>
