<template>
  <div class="mobile-admin-users">
    <!-- Header -->
    <van-nav-bar :title="t('admin.users.title')" left-arrow @click-left="handleBack">
      <template #right>
        <van-icon name="plus" @click="handleCreateUser" />
      </template>
    </van-nav-bar>

    <!-- Search -->
    <van-search
      v-model="searchQuery"
      :placeholder="t('admin.users.search_placeholder')"
      @input="handleSearch" />

    <!-- User List -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        :finished-text="t('common.no_more')"
        @load="onLoad">
        <van-cell
          v-for="user in filteredUsers"
          :key="user.userId"
          is-link
          @click="handleViewUser(user)">
          <template #title>
            <div class="user-name">{{ user.displayName || user.userId }}</div>
            <div class="user-id">{{ user.userId }}</div>
          </template>
          <template #icon>
            <van-image
              round
              width="40"
              height="40"
              :src="getUserAvatar(user)" />
          </template>
          <template #right-icon>
            <van-space>
              <van-tag v-if="user.isAdmin" type="primary">Admin</van-tag>
              <van-tag v-if="user.deactivated" type="danger">Disabled</van-tag>
              <van-dropdown-menu class="user-actions">
                <van-dropdown-item>
                  <van-cell-group>
                    <van-cell title="编辑" is-link @click.stop="handleEditUser(user)" />
                    <van-cell :title="user.isAdmin ? '取消管理员' : '设为管理员'" is-link @click.stop="handleToggleAdmin(user)" />
                    <van-cell :title="user.deactivated ? '启用' : '禁用'" is-link @click.stop="handleToggleActive(user)" />
                    <van-cell title="删除" is-link @click.stop="handleDeleteUser(user)" />
                  </van-cell-group>
                </van-dropdown-item>
              </van-dropdown-menu>
            </van-space>
          </template>
        </van-cell>
      </van-list>
    </van-pull-refresh>

    <!-- Empty State -->
    <van-empty v-if="filteredUsers.length === 0 && !loading" :description="t('admin.users.no_users')" />

    <!-- User Detail Sheet -->
    <van-action-sheet
      v-model:show="showUserSheet"
      :title="selectedUser?.displayName || selectedUser?.userId">
      <div class="user-detail">
        <van-cell-group>
          <van-cell title="用户 ID" :value="selectedUser?.userId" />
          <van-cell title="显示名称" :value="selectedUser?.displayName || '-'" />
          <van-cell title="管理员">
            <template #value>
              <van-tag :type="selectedUser?.isAdmin ? 'success' : 'default'">
                {{ selectedUser?.isAdmin ? '是' : '否' }}
              </van-tag>
            </template>
          </van-cell>
          <van-cell title="状态">
            <template #value>
              <van-tag :type="selectedUser?.deactivated ? 'danger' : 'success'">
                {{ selectedUser?.deactivated ? '已禁用' : '正常' }}
              </van-tag>
            </template>
          </van-cell>
          <van-cell title="注册时间" :value="formatTimestamp(selectedUser?.creationTs)" />
        </van-cell-group>

        <van-button type="danger" block @click="handleDeleteUser(selectedUser)">
          删除用户
        </van-button>
      </div>
    </van-action-sheet>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { showToast, showLoadingToast, closeToast, showConfirmDialog } from 'vant'
import { logger } from '@/utils/logger'
import { adminClient } from '@/services/adminClient'

const { t } = useI18n()
const router = useRouter()

interface User {
  userId: string
  displayName?: string
  isAdmin: boolean
  deactivated: boolean
  creationTs: number
  avatarUrl?: string
}

const searchQuery = ref('')
const loading = ref(false)
const refreshing = ref(false)
const finished = ref(false)
const users = ref<User[]>([])
const showUserSheet = ref(false)
const selectedUser = ref<User | null>(null)
const nextToken = ref<string | undefined>(undefined)
const totalCount = ref(0)

// Admin API response interface
interface AdminUserResponse {
  name: string
  displayname?: string
  admin: boolean
  deactivated: boolean
  creation_ts: number
  avatar_url?: string
}

// Transform AdminUser to User interface
function transformAdminUser(adminUser: AdminUserResponse): User {
  return {
    userId: adminUser.name,
    displayName: adminUser.displayname || undefined,
    isAdmin: adminUser.admin,
    deactivated: adminUser.deactivated,
    creationTs: adminUser.creation_ts * 1000, // Convert to milliseconds
    avatarUrl: adminUser.avatar_url || undefined
  }
}

const filteredUsers = computed(() => {
  if (!searchQuery.value) {
    return users.value
  }
  const query = searchQuery.value.toLowerCase()
  return users.value.filter(
    (user) =>
      user.userId.toLowerCase().includes(query) || (user.displayName && user.displayName.toLowerCase().includes(query))
  )
})

async function onLoad() {
  try {
    // Call AdminClient API to load users
    const result = await adminClient.listUsers({
      from: 0,
      limit: 50,
      guests: false,
      deactivated: false
    })

    // Transform admin users to our User interface
    const transformedUsers = result.users.map(transformAdminUser)
    users.value = [...users.value, ...transformedUsers]

    // Update pagination state
    nextToken.value = result.next_token
    totalCount.value = result.total
    finished.value = !result.next_token

    loading.value = false
  } catch (error) {
    logger.error('[MobileAdminUsers] Failed to load users:', error)
    showToast.fail('加载用户列表失败')
    loading.value = false
  }
}

async function onRefresh() {
  try {
    finished.value = false
    nextToken.value = undefined
    users.value = []
    totalCount.value = 0

    const result = await adminClient.listUsers({
      from: 0,
      limit: 50,
      guests: false,
      deactivated: false
    })

    const transformedUsers = result.users.map(transformAdminUser)
    users.value = transformedUsers
    nextToken.value = result.next_token
    totalCount.value = result.total
    finished.value = !result.next_token

    refreshing.value = false
    showToast.success('刷新成功')
  } catch (error) {
    logger.error('[MobileAdminUsers] Failed to refresh users:', error)
    showToast.fail('刷新失败')
    refreshing.value = false
  }
}

function handleSearch() {
  // Search is handled by computed property
}

function handleBack() {
  router.back()
}

function handleCreateUser() {
  showToast('创建用户功能待实现')
  // TODO: Navigate to user creation page or show modal
}

function handleViewUser(user: User) {
  selectedUser.value = user
  showUserSheet.value = true
}

function handleEditUser(_user: User) {
  showUserSheet.value = false
  showToast('编辑用户功能待实现')
  // TODO: Navigate to user edit page or show modal
}

async function handleToggleAdmin(user: User) {
  showUserSheet.value = false
  try {
    showConfirmDialog({
      title: user.isAdmin ? '取消管理员权限' : '设为管理员',
      message: `确认要${user.isAdmin ? '取消' : '授予'} ${user.displayName || user.userId} 的管理员权限吗？`
    })
      .then(async () => {
        showLoadingToast({
          message: '操作中...',
          forbidClick: true,
          duration: 0
        })

        // Call AdminClient API
        await adminClient.updateUserAdmin(user.userId, !user.isAdmin)

        // Update local state
        user.isAdmin = !user.isAdmin

        closeToast()
        showToast.success('操作成功')
      })
      .catch(() => {
        // User cancelled
      })
  } catch (error) {
    logger.error('[MobileAdminUsers] Failed to toggle admin status:', error)
    showToast.fail('操作失败')
  }
}

async function handleToggleActive(user: User) {
  showUserSheet.value = false
  try {
    showConfirmDialog({
      title: user.deactivated ? '启用用户' : '禁用用户',
      message: `确认要${user.deactivated ? '启用' : '禁用'} ${user.displayName || user.userId} 吗？`
    })
      .then(async () => {
        showLoadingToast({
          message: '操作中...',
          forbidClick: true,
          duration: 0
        })

        // Call AdminClient API
        await adminClient.setUserDeactivated(user.userId, !user.deactivated)

        // Update local state
        user.deactivated = !user.deactivated

        closeToast()
        showToast.success('操作成功')
      })
      .catch(() => {
        // User cancelled
      })
  } catch (error) {
    logger.error('[MobileAdminUsers] Failed to toggle active status:', error)
    showToast.fail('操作失败')
  }
}

async function handleDeleteUser(user: User | null) {
  if (!user) return
  showUserSheet.value = false

  try {
    showConfirmDialog({
      title: '删除用户',
      message: `确认要删除 ${user.displayName || user.userId} 吗？此操作不可撤销。`
    })
      .then(async () => {
        showLoadingToast({
          message: '删除中...',
          forbidClick: true,
          duration: 0
        })

        // Call AdminClient API
        await adminClient.deleteUser(user.userId)

        // Remove from local state
        users.value = users.value.filter((u) => u.userId !== user.userId)
        totalCount.value--

        closeToast()
        showToast.success('删除成功')
      })
      .catch(() => {
        // User cancelled
      })
  } catch (error) {
    logger.error('[MobileAdminUsers] Failed to delete user:', error)
    showToast.fail('删除失败')
  }
}

function getUserAvatar(user: User): string {
  if (user.avatarUrl) {
    return user.avatarUrl
  }
  // Generate avatar from Matrix ID
  const matrixId = user.userId
  const avatarUrl = `https://picsum.photos/seed/${matrixId}/40/40`
  return avatarUrl
}

function formatTimestamp(timestamp?: number): string {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN')
}

onMounted(() => {
  onLoad()
})
</script>

<style scoped>
.mobile-admin-users {
  min-height: 100vh;
  background-color: #f7f8fa;
}

.user-name {
  font-weight: 500;
  font-size: 15px;
}

.user-id {
  font-size: 12px;
  color: #969799;
  margin-top: 2px;
}

.user-actions {
  flex-direction: row-reverse;
}

.user-detail {
  padding: 16px;
}
</style>
