<!-- User Permissions - Individual user permission settings -->
<template>
  <div class="user-permissions">
    <n-spin :show="loading">
      <!-- Add User Button -->
      <div class="add-section">
        <n-button type="primary" block @click="showAddModal = true">
          <template #icon>
            <n-icon><UserPlus /></n-icon>
          </template>
          添加用户权限
        </n-button>
      </div>

      <!-- User List -->
      <div class="user-list">
        <div
          v-for="user in sortedUsers"
          :key="user.userId"
          class="user-item"
        >
          <div class="user-info">
            <n-avatar
              :src="getAvatarUrl(user.avatarUrl)"
              :size="40"
              round
            >
              {{ getInitials(user.displayName) }}
            </n-avatar>
            <div class="user-details">
              <div class="user-name">{{ user.displayName }}</div>
              <div class="user-id">{{ formatUserId(user.userId) }}</div>
            </div>
          </div>

          <div class="user-power">
            <n-input-number
              :value="user.powerLevel"
              :min="0"
              :max="100"
              :step="10"
              size="small"
              style="width: 80px"
              @update:value="(v) => handleUpdate(user.userId, v || 0)"
            />
          </div>

          <div class="user-actions">
            <n-button
              text
              type="error"
              size="small"
              @click="handleRemove(user)"
            >
              <template #icon>
                <n-icon><X /></n-icon>
              </template>
            </n-button>
          </div>
        </div>

        <n-empty v-if="sortedUsers.length === 0" description="暂无自定义用户权限" />
      </div>

      <!-- Add User Modal -->
      <n-modal
        v-model:show="showAddModal"
        preset="dialog"
        title="添加用户权限"
      >
        <n-form ref="formRef" :model="addForm" :rules="addRules">
          <n-form-item label="选择用户" path="userId">
            <n-select
              v-model:value="addForm.userId"
              :options="availableUsers"
              filterable
              placeholder="搜索用户"
            />
          </n-form-item>
          <n-form-item label="权限等级" path="powerLevel">
            <n-slider
              v-model:value="addForm.powerLevel"
              :min="0"
              :max="100"
              :step="10"
              :marks="{ 0: '成员', 50: '版主', 100: '管理员' }"
            />
          </n-form-item>
        </n-form>
        <template #action>
          <n-button @click="showAddModal = false">取消</n-button>
          <n-button type="primary" @click="handleAdd">
            添加
          </n-button>
        </template>
      </n-modal>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  NSpin,
  NButton,
  NIcon,
  NAvatar,
  NInputNumber,
  NModal,
  NForm,
  NFormItem,
  NSelect,
  NSlider,
  NEmpty,
  useMessage
} from 'naive-ui'
import { UserPlus, X } from '@vicons/tabler'
import { matrixClientService } from '@/integrations/matrix/client'
import { mxcUrlToHttp } from '@/utils/matrixClientUtils'

interface UserPermission {
  userId: string
  displayName: string
  powerLevel: number
  avatarUrl?: string
}

interface Props {
  permissions: UserPermission[]
  members: UserPermission[]
  loading: boolean
}

interface Emits {
  (e: 'update', userId: string, powerLevel: number): void
  (e: 'remove', userId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const message = useMessage()

const showAddModal = ref(false)
const formRef = ref()
const addForm = ref({
  userId: '',
  powerLevel: 0
})

const addRules = {
  userId: { required: true, message: '请选择用户', trigger: 'blur' }
}

// Users that can be added (members without custom permissions)
const availableUsers = computed(() => {
  const customUserIds = new Set(props.permissions.map((p) => p.userId))
  return props.members
    .filter((m) => !customUserIds.has(m.userId))
    .map((m) => ({
      label: m.displayName,
      value: m.userId
    }))
})

// Sort users by power level (highest first)
const sortedUsers = computed(() => {
  return [...props.permissions].sort((a, b) => b.powerLevel - a.powerLevel)
})

const handleUpdate = (userId: string, powerLevel: number) => {
  emit('update', userId, powerLevel)
}

const handleRemove = (user: UserPermission) => {
  emit('remove', user.userId)
}

const handleAdd = () => {
  if (!addForm.value.userId) {
    message.warning('请选择用户')
    return
  }

  emit('update', addForm.value.userId, addForm.value.powerLevel)
  showAddModal.value = false
  addForm.value = { userId: '', powerLevel: 0 }
  message.success('用户权限已添加')
}

const getAvatarUrl = (mxcUrl?: string): string | undefined => {
  if (!mxcUrl) return undefined
  try {
    const client = matrixClientService.getClient()
    if (!client) return undefined
    const url = mxcUrlToHttp(client as Record<string, unknown> | null, mxcUrl, 80, 80, 'crop')
    return url || undefined
  } catch {
    return undefined
  }
}

const getInitials = (name: string): string => {
  return name.slice(0, 2).toUpperCase()
}

const formatUserId = (userId: string): string => {
  const parts = userId.split(':')
  if (parts.length > 1) {
    const local = parts[0].replace(/^@/, '')
    const server = parts[1]
    return `${local}@${server.slice(0, 12)}...`
  }
  return userId
}
</script>

<style scoped lang="scss">
.user-permissions {
  padding: 16px;
}

.add-section {
  margin-bottom: 16px;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--card-color);
  border-radius: 12px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-color-1);
  margin-bottom: 2px;
}

.user-id {
  font-size: 12px;
  color: var(--text-color-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-power {
  flex-shrink: 0;
}

.user-actions {
  flex-shrink: 0;
}

.user-option {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
