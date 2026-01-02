<!-- Room Permissions - Room-specific permission settings -->
<template>
  <div class="room-permissions">
    <n-spin :show="loading">
      <!-- Room List -->
      <div class="room-list">
        <div
          v-for="room in roomPermissions"
          :key="room.roomId"
          class="room-item"
        >
          <div class="room-info">
            <n-avatar :size="40" round>
              <n-icon><Door /></n-icon>
            </n-avatar>
            <div class="room-details">
              <div class="room-name">{{ room.name }}</div>
              <div class="room-id">{{ formatRoomId(room.roomId) }}</div>
            </div>
          </div>

          <div class="room-power">
            <n-select
              :value="getPowerLevel(room.permissionLevel)"
              :options="powerLevelOptions"
              size="small"
              style="width: 120px"
              @update:value="(v) => handleUpdate(room.roomId, v)"
            />
          </div>
        </div>

        <n-empty
          v-if="roomPermissions.length === 0"
          description="暂无房间权限设置"
        >
          <template #icon>
            <n-icon size="48"><Door /></n-icon>
          </template>
        </n-empty>
      </div>

      <!-- Add Room Button -->
      <div class="add-section">
        <n-button
          type="primary"
          block
          dashed
          @click="showAddModal = true"
        >
          <template #icon>
            <n-icon><Plus /></n-icon>
          </template>
          添加房间权限
        </n-button>
      </div>

      <!-- Add Room Modal -->
      <n-modal
        v-model:show="showAddModal"
        preset="dialog"
        title="添加房间权限"
      >
        <n-form ref="formRef" :model="addForm" :rules="addRules">
          <n-form-item label="选择房间" path="roomId">
            <n-select
              v-model:value="addForm.roomId"
              :options="availableRooms"
              filterable
              placeholder="搜索房间"
            />
          </n-form-item>
          <n-form-item label="所需权限等级" path="permissionLevel">
            <n-slider
              v-model:value="addForm.permissionLevel"
              :min="0"
              :max="100"
              :step="10"
              :marks="{ 0: '公开', 50: '受限', 100: '私密' }"
            />
          </n-form-item>
          <n-alert type="info" style="margin-top: 12px;">
            设置后，只有权限等级≥此值的成员才能访问该房间
          </n-alert>
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
  NSelect,
  NModal,
  NForm,
  NFormItem,
  NSlider,
  NAlert,
  NEmpty,
  useMessage
} from 'naive-ui'
import { Door, Plus } from '@vicons/tabler'

interface RoomPermission {
  roomId: string
  name: string
  permissionLevel: number
}

interface SpaceRoom {
  roomId: string
  name: string
}

interface Props {
  roomPermissions: RoomPermission[]
  loading: boolean
}

type Emits = (e: 'update', roomId: string, permissionLevel: number) => void

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const message = useMessage()

const showAddModal = ref(false)
const formRef = ref()
const addForm = ref({
  roomId: '',
  permissionLevel: 0
})

const addRules = {
  roomId: { required: true, message: '请选择房间', trigger: 'blur' }
}

// Mock available rooms - in real app, this would come from space children
const availableRooms = ref<{ label: string; value: string }[]>([])

// Power level options
const powerLevelOptions = [
  { label: '公开 (0)', value: 0 },
  { label: '成员 (10)', value: 10 },
  { label: '受信任 (25)', value: 25 },
  { label: '版主 (50)', value: 50 },
  { label: '高级版主 (75)', value: 75 },
  { label: '管理员 (100)', value: 100 }
]

const getPowerLevel = (level: number): number => {
  // Round to nearest 10
  return Math.round(level / 10) * 10
}

const handleUpdate = (roomId: string, permissionLevel: number) => {
  emit('update', roomId, permissionLevel)
}

const handleAdd = () => {
  if (!addForm.value.roomId) {
    message.warning('请选择房间')
    return
  }

  emit('update', addForm.value.roomId, addForm.value.permissionLevel)
  showAddModal.value = false
  addForm.value = { roomId: '', permissionLevel: 0 }
  message.success('房间权限已添加')
}

const formatRoomId = (roomId: string): string => {
  const parts = roomId.split(':')
  if (parts.length > 1) {
    const local = parts[0].replace(/^!/, '')
    const server = parts[1]
    return `${local}@${server.slice(0, 12)}...`
  }
  return roomId
}

// Load available rooms (mock for now)
const loadAvailableRooms = () => {
  // In real implementation, fetch from space children
  availableRooms.value = [
    { label: '公告频道', value: '!abc123:server.com' },
    { label: '讨论区', value: '!def456:server.com' },
    { label: '资源分享', value: '!ghi789:server.com' }
  ]
}

// Lifecycle
loadAvailableRooms()
</script>

<style scoped lang="scss">
.room-permissions {
  padding: 16px;
}

.room-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.room-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--card-color);
  border-radius: 12px;
}

.room-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.room-details {
  flex: 1;
  min-width: 0;
}

.room-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-color-1);
  margin-bottom: 2px;
}

.room-id {
  font-size: 12px;
  color: var(--text-color-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Monaco', 'Consolas', monospace;
}

.room-power {
  flex-shrink: 0;
}

.add-section {
  margin-top: 16px;
}

.room-option {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
