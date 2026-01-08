<template>
  <n-flex vertical :size="12">
    <n-flex justify="space-between">
      <n-input v-model:value="q" placeholder="搜索用户" class="search-input" />
      <n-button @click="fetchUsers" :loading="loading">刷新</n-button>
    </n-flex>
    <n-data-table :columns="columns" :data="rows" :bordered="false" size="small" />
    <n-modal v-model:show="showPwd">
      <n-card class="password-modal" title="重置密码">
        <n-input v-model:value="pwd" type="password" placeholder="新密码" />
        <n-flex class="mt-10px" justify="end" :size="8">
          <n-button tertiary @click="showPwd = false">取消</n-button>
          <n-button type="primary" @click="applyReset">确定</n-button>
        </n-flex>
      </n-card>
    </n-modal>
    <n-modal v-model:show="showDevices">
      <n-card class="devices-modal" title="设备列表">
        <n-data-table :columns="deviceCols" :data="pagedDevices" size="small" />
        <n-flex justify="end" class="mt-8px">
          <n-pagination
            v-model:page="page"
            v-model:page-size="pageSize"
            :page-count="pageCount"
            show-size-picker
            :page-sizes="[5, 10, 20, 50]" />
        </n-flex>
      </n-card>
    </n-modal>
  </n-flex>
</template>
<script setup lang="ts">
/**
 * AdminUsers.vue - 用户管理界面
 * Requirements 10.5: Update Admin UI components to use SDK methods
 */
import { ref, computed, watch, onMounted, h } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import { adminClient } from '@/services/adminClient'

// Type definitions
interface AdminUser {
  name: string
  admin: boolean
  deactivated: boolean
}

interface AdminDevice {
  device_id: string
  display_name?: string
  last_seen_ts?: number
}

const rows = ref<AdminUser[]>([])
const q = ref('')
const loading = ref(false)
const pwd = ref('')
const targetUser = ref<string>('')
const showPwd = ref(false)

const fetchUsers = async () => {
  loading.value = true
  try {
    const args: { name?: string; from?: number; limit?: number } = { limit: 50 }
    if (q.value) args.name = q.value
    const result = await adminClient.listUsers(args)
    rows.value = result.users || []
  } finally {
    loading.value = false
  }
}

onMounted(fetchUsers)
watch(q, fetchUsers)

const columns: DataTableColumns<AdminUser> = [
  { title: '用户', key: 'name' },
  { title: 'ID', key: 'name' },
  { title: '是否管理员', key: 'admin', render: (r: AdminUser) => (r.admin ? '是' : '否') },
  { title: '状态', key: 'deactivated', render: (r: AdminUser) => (r.deactivated ? '已禁用' : '正常') },
  {
    title: '操作',
    key: 'actions',
    render(row: AdminUser) {
      return h('div', { class: 'flex items-center gap-8px' }, [
        h(
          'button',
          {
            class: 'n-button n-button--tiny',
            onClick: async () => {
              await adminClient.updateUserAdmin(row.name, !row.admin)
              await fetchUsers()
            }
          },
          row.admin ? '撤销管理员' : '设为管理员'
        ),
        h(
          'button',
          {
            class: 'n-button n-button--tiny',
            onClick: async () => {
              await adminClient.setUserDeactivated(row.name, !row.deactivated)
              await fetchUsers()
            }
          },
          row.deactivated ? '启用' : '禁用'
        ),
        h(
          'button',
          {
            class: 'n-button n-button--tiny',
            onClick: async () => {
              targetUser.value = row.name
              devices.value = await adminClient.listDevices(row.name)
              page.value = 1
              pageSize.value = 10
              showDevices.value = true
            }
          },
          '设备列表'
        ),
        h(
          'button',
          {
            class: 'n-button n-button--tiny',
            onClick: async () => {
              targetUser.value = row.name
              showPwd.value = true
            }
          },
          '重置密码'
        ),
        h(
          'button',
          {
            class: 'n-button n-button--tiny',
            onClick: async () => {
              await adminClient.deleteTokens(row.name)
              await fetchUsers()
            }
          },
          '注销令牌'
        )
      ])
    }
  }
]

const applyReset = async () => {
  if (!targetUser.value || !pwd.value) return
  await adminClient.resetPassword(targetUser.value, pwd.value, true)
  showPwd.value = false
  pwd.value = ''
  await fetchUsers()
}

// 设备列表分页与列定义
const showDevices = ref(false)
const devices = ref<AdminDevice[]>([])
const page = ref(1)
const pageSize = ref(10)
const pageCount = computed(() => Math.max(1, Math.ceil(devices.value.length / pageSize.value)))
const pagedDevices = computed(() => devices.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

const deviceCols: DataTableColumns<AdminDevice> = [
  { title: '设备ID', key: 'device_id' },
  { title: '显示名称', key: 'display_name' },
  {
    title: '最后活跃',
    key: 'last_seen_ts',
    render: (r: AdminDevice) => (r.last_seen_ts ? new Date(r.last_seen_ts).toLocaleString() : '-')
  },
  {
    title: '操作',
    key: 'actions',
    render(row: AdminDevice) {
      return h(
        'button',
        {
          class: 'n-button n-button--tiny n-button--error',
          onClick: async () => {
            if (!targetUser.value) return
            await adminClient.deleteDevice(targetUser.value, row.device_id)
            devices.value = await adminClient.listDevices(targetUser.value)
          }
        },
        '注销设备'
      )
    }
  }
]
</script>

<style scoped>
/* 搜索输入框 */
.search-input {
  max-width: 240px;
}

/* 密码重置模态框 */
.password-modal {
  max-width: 360px;
}

/* 设备列表模态框 */
.devices-modal {
  max-width: 640px;
}
</style>
