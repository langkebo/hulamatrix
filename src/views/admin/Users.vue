<template>
  <div class="admin-users">
    <n-page-header :title="t('admin.users.title')" @back="handleBack">
      <template #extra>
        <n-space>
          <n-input
            v-model:value="searchQuery"
            :placeholder="t('admin.users.search_placeholder')"
            clearable
            style="width: 240px"
            @input="handleSearch">
            <template #prefix>
              <n-icon><Search /></n-icon>
            </template>
          </n-input>
          <n-button type="primary" @click="handleCreateUser">
            <template #icon>
              <n-icon><UserPlus /></n-icon>
            </template>
            {{ t('admin.users.create_button') }}
          </n-button>
        </n-space>
      </template>
    </n-page-header>

    <!-- Users Table -->
    <n-card :bordered="false">
      <n-data-table
        :columns="columns"
        :data="filteredUsers"
        :loading="loading"
        :pagination="pagination"
        :row-key="(row: User) => row.userId"
        striped>
        <template #empty>
          <n-empty :description="t('admin.users.no_users')" />
        </template>
      </n-data-table>
    </n-card>

    <!-- User Actions Modal -->
    <n-modal v-model:show="showUserModal" preset="card" :title="modalTitle" style="width: 600px">
      <UserForm v-if="showUserModal" :user="selectedUser" @submit="handleUserSubmit" @cancel="showUserModal = false" />
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NPageHeader,
  NIcon,
  NSpace,
  NInput,
  NButton,
  NCard,
  NDataTable,
  NModal,
  NEmpty,
  NTag,
  NAvatar,
  NSwitch,
  NDropdown,
  useMessage,
  useDialog
} from 'naive-ui'
import { Search, UserPlus, DotsVertical, Edit, Shield, ShieldOff, Trash } from '@vicons/tabler'
import { adminClient } from '@/services/adminClient'
import { logger } from '@/utils/logger'
import UserForm from '@/components/admin/UserForm.vue'

interface User {
  userId: string
  displayName?: string
  isAdmin: boolean
  deactivated: boolean
  creationTs: number
}

const { t } = useI18n()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const searchQuery = ref('')
const users = ref<User[]>([])
const selectedUser = ref<User | null>(null)
const showUserModal = ref(false)

const pagination = ref({
  page: 1,
  pageSize: 20
})

const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value

  const query = searchQuery.value.toLowerCase()
  return users.value.filter(
    (user) => user.userId.toLowerCase().includes(query) || user.displayName?.toLowerCase().includes(query)
  )
})

const modalTitle = computed(() => {
  return selectedUser.value
    ? t('admin.users.edit_title', { userId: selectedUser.value.userId })
    : t('admin.users.create_title')
})

const columns = [
  {
    title: t('admin.users.table.avatar'),
    key: 'avatar',
    width: 60,
    render: (row: User) => {
      return h(NAvatar, {
        round: true,
        size: 32,
        name: row.displayName || row.userId
      })
    }
  },
  {
    title: t('admin.users.table.user_id'),
    key: 'userId',
    width: 250
  },
  {
    title: t('admin.users.table.display_name'),
    key: 'displayName',
    width: 150,
    render: (row: User) => row.displayName || '-'
  },
  {
    title: t('admin.users.table.admin'),
    key: 'isAdmin',
    width: 80,
    render: (row: User) => {
      return h(
        NTag,
        {
          type: row.isAdmin ? 'success' : 'default',
          size: 'small'
        },
        {
          default: () => (row.isAdmin ? t('common.yes') : t('common.no'))
        }
      )
    }
  },
  {
    title: t('admin.users.table.status'),
    key: 'status',
    width: 100,
    render: (row: User) => {
      return h(
        NTag,
        {
          type: row.deactivated ? 'error' : 'success',
          size: 'small'
        },
        {
          default: () => (row.deactivated ? t('admin.users.status.deactivated') : t('admin.users.status.active'))
        }
      )
    }
  },
  {
    title: t('admin.users.table.created'),
    key: 'creationTs',
    width: 120,
    render: (row: User) => {
      return new Date(row.creationTs).toLocaleDateString()
    }
  },
  {
    title: t('admin.users.table.actions'),
    key: 'actions',
    width: 60,
    render: (row: User) => {
      return h(
        NDropdown,
        {
          options: [
            {
              label: t('admin.users.actions.edit'),
              key: 'edit',
              icon: () => h(NIcon, null, { default: () => h(Edit) })
            },
            {
              label: row.isAdmin ? t('admin.users.actions.revoke_admin') : t('admin.users.actions.make_admin'),
              key: 'toggle_admin',
              icon: () => h(NIcon, null, { default: () => (row.isAdmin ? h(ShieldOff) : h(Shield)) })
            },
            {
              label: row.deactivated ? t('admin.users.actions.activate') : t('admin.users.actions.deactivate'),
              key: 'toggle_status',
              icon: () => h(NIcon, null, { default: () => h(Shield) })
            },
            {
              type: 'divider',
              key: 'divider'
            },
            {
              label: t('admin.users.actions.delete'),
              key: 'delete',
              icon: () => h(NIcon, null, { default: () => h(Trash) })
            }
          ],
          onSelect: (key: string) => handleUserAction(key, row)
        },
        {
          default: () =>
            h(
              NButton,
              {
                size: 'small',
                quaternary: true,
                circle: true
              },
              {
                default: () => h(NIcon, null, { default: () => h(DotsVertical) })
              }
            )
        }
      )
    }
  }
]

onMounted(async () => {
  await loadUsers()
})

async function loadUsers() {
  loading.value = true
  try {
    const result = await adminClient.listUsers({ from: 0, limit: 100 })
    // Map AdminUser to User interface
    users.value = (result.users || []).map((au) => ({
      userId: au.name,
      displayName: au.displayname,
      isAdmin: au.admin,
      deactivated: au.deactivated,
      creationTs: au.creation_ts
    }))
  } catch (error) {
    logger.error('[AdminUsers] Failed to load users:', error)
    message.error(t('admin.error.load_users_failed'))
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  // Filter is handled via computed property
}

function handleCreateUser() {
  selectedUser.value = null
  showUserModal.value = true
}

function handleEditUser(user: User) {
  selectedUser.value = user
  showUserModal.value = true
}

async function handleUserAction(action: string, user: User) {
  switch (action) {
    case 'edit':
      handleEditUser(user)
      break

    case 'toggle_admin':
      dialog.info({
        title: user.isAdmin ? t('admin.users.confirm_revoke_admin') : t('admin.users.confirm_make_admin'),
        content: user.isAdmin
          ? t('admin.users.confirm_revoke_admin_content', { userId: user.userId })
          : t('admin.users.confirm_make_admin_content', { userId: user.userId }),
        positiveText: t('common.confirm'),
        negativeText: t('common.cancel'),
        onPositiveClick: async () => {
          try {
            await adminClient.updateUserAdmin(user.userId, !user.isAdmin)
            message.success(user.isAdmin ? t('admin.users.admin_revoked') : t('admin.users.admin_granted'))
            await loadUsers()
          } catch (error) {
            logger.error('[AdminUsers] Failed to toggle admin:', error)
            message.error(t('admin.error.toggle_admin_failed'))
          }
        }
      })
      break

    case 'toggle_status':
      dialog.warning({
        title: user.deactivated ? t('admin.users.confirm_activate') : t('admin.users.confirm_deactivate'),
        content: user.deactivated
          ? t('admin.users.confirm_activate_content', { userId: user.userId })
          : t('admin.users.confirm_deactivate_content', { userId: user.userId }),
        positiveText: t('common.confirm'),
        negativeText: t('common.cancel'),
        onPositiveClick: async () => {
          try {
            await adminClient.setUserDeactivated(user.userId, !user.deactivated)
            message.success(user.deactivated ? t('admin.users.activated') : t('admin.users.deactivated'))
            await loadUsers()
          } catch (error) {
            logger.error('[AdminUsers] Failed to toggle status:', error)
            message.error(t('admin.error.toggle_status_failed'))
          }
        }
      })
      break

    case 'delete':
      dialog.error({
        title: t('admin.users.confirm_delete'),
        content: t('admin.users.confirm_delete_content', { userId: user.userId }),
        positiveText: t('common.confirm'),
        negativeText: t('common.cancel'),
        onPositiveClick: async () => {
          try {
            await adminClient.deleteUser(user.userId)
            message.success(t('admin.users.deleted'))
            await loadUsers()
          } catch (error) {
            logger.error('[AdminUsers] Failed to delete user:', error)
            message.error(t('admin.error.delete_user_failed'))
          }
        }
      })
      break
  }
}

async function handleUserSubmit(_userData: Partial<User>) {
  try {
    if (selectedUser.value) {
      // Update existing user
      message.info(t('admin.users.update_not_implemented'))
    } else {
      // Create new user
      message.info(t('admin.users.create_not_implemented'))
    }
    showUserModal.value = false
    await loadUsers()
  } catch (error) {
    logger.error('[AdminUsers] Failed to submit user:', error)
    message.error(t('admin.error.submit_user_failed'))
  }
}

function handleBack() {
  router.back()
}
</script>

<style lang="scss" scoped>
.admin-users {
  padding: 24px;
}
</style>
