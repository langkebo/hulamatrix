<template>
  <van-popup
    :show="showDialog"
    position="center"
    :style="{ width: '90%', maxWidth: '450px', borderRadius: '12px' }"
    :close-on-click-overlay="false"
    @update:show="handleClose">
    <div class="create-space-dialog">
      <!-- Header -->
      <div class="dialog-header">
        <span class="header-title">创建空间</span>
        <van-icon name="cross" :size="18" @click="handleClose" />
      </div>

      <!-- Loading Overlay -->
      <van-loading v-if="isCreating" size="24px" vertical>正在创建空间...</van-loading>

      <!-- Form Content -->
      <div v-else class="dialog-content">
        <van-form ref="formRef" @submit="handleCreate">
          <!-- Space Name -->
          <van-field
            v-model="formData.name"
            label="空间名称"
            placeholder="输入空间名称"
            maxlength="64"
            :rules="[{ required: true, message: '请输入空间名称' }]" />

          <!-- Topic -->
          <van-field
            v-model="formData.topic"
            type="textarea"
            label="描述（可选）"
            placeholder="描述这个空间的用途"
            :rows="3"
            maxlength="256"
            show-word-limit />

          <!-- Visibility -->
          <div class="form-section">
            <div class="section-label">可见性</div>
            <van-radio-group v-model="formData.visibility">
              <van-radio name="private" class="radio-option">
                <div class="radio-content">
                  <div class="option-title">私有空间</div>
                  <div class="option-desc">仅受邀成员可以查看和加入</div>
                </div>
              </van-radio>
              <van-radio name="public" class="radio-option">
                <div class="radio-content">
                  <div class="option-title">公开空间</div>
                  <div class="option-desc">任何人都可以查看和加入</div>
                </div>
              </van-radio>
            </van-radio-group>
          </div>

          <!-- Avatar -->
          <div class="form-section">
            <div class="section-label">头像（可选）</div>
            <van-uploader
              :max-count="1"
              accept="image/*"
              :deletable="true"
              v-model="avatarFileList"
              :after-read="handleAvatarChange"
              @delete="clearAvatar" />
            <div v-if="avatarPreview" class="avatar-preview">
              <van-image :width="60" :height="60" :src="avatarPreview" round />
              <van-button type="danger" size="small" icon="delete" @click="clearAvatar">移除</van-button>
            </div>
          </div>

          <!-- Invite Members (Optional) -->
          <van-collapse v-model="activeCollapse" class="invite-collapse">
            <van-collapse-item title="邀请成员（可选）" name="invite">
              <div class="invite-section">
                <div class="invite-label">邀请用户</div>
                <van-field
                  v-model="selectedUsersText"
                  readonly
                  clickable
                  placeholder="选择要邀请的用户"
                  :disabled="userOptions.length === 0"
                  @click="showUserPicker = true">
                  <template #right-icon>
                    <van-icon name="arrow" />
                  </template>
                </van-field>
                <van-empty v-if="userOptions.length === 0" description="没有可邀请的用户" image-size="80" />
              </div>
            </van-collapse-item>
          </van-collapse>
        </van-form>
      </div>

      <!-- Footer Actions -->
      <div class="dialog-footer">
        <van-button @click="handleClose" :disabled="isCreating">取消</van-button>
        <van-button type="primary" @click="handleCreate" :loading="isCreating" :disabled="!formData.name.trim()">
          创建空间
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { matrixSpacesService } from '@/matrix/services/room/spaces'
import { useUserStore } from '@/stores/user'
import { logger } from '@/utils/logger'
import { msg } from '@/utils/SafeUI'

interface UploaderFileListItem {
  file?: File
  content?: string
  message?: string
  status?: '' | 'failed' | 'done' | 'uploading'
}

interface Props {
  show: boolean
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'created', spaceId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const userStore = useUserStore()

// Form ref
const formRef = ref()
const isCreating = ref(false)
const avatarFile = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)
const avatarFileList = ref<UploaderFileListItem[]>([])
const selectedUsers = ref<string[]>([])
const isLoadingUsers = ref(false)
const activeCollapse = ref<string[]>([])
const showUserPicker = ref(false)

// Form data
const formData = ref({
  name: '',
  topic: '',
  visibility: 'private' as 'public' | 'private'
})

// Computed
const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

// User options for invite
const userOptions = computed(() => {
  // TODO: Fetch from contact list or user directory
  return []
})

const selectedUsersText = computed(() => {
  if (selectedUsers.value.length === 0) return ''
  return `已选择 ${selectedUsers.value.length} 个用户`
})

// Watch for modal open to reset form
watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      resetForm()
    }
  }
)

// Methods
const resetForm = () => {
  formData.value = {
    name: '',
    topic: '',
    visibility: 'private'
  }
  avatarFile.value = null
  avatarPreview.value = null
  avatarFileList.value = []
  selectedUsers.value = []
  activeCollapse.value = []
}

const handleClose = () => {
  if (!isCreating.value) {
    emit('update:show', false)
  }
}

const handleAvatarChange = (item: UploaderFileListItem | UploaderFileListItem[]) => {
  const fileItem = Array.isArray(item) ? item[0] : item
  if (fileItem?.file) {
    avatarFile.value = fileItem.file
    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      avatarPreview.value = e.target?.result as string
    }
    reader.readAsDataURL(fileItem.file)
  }
}

const clearAvatar = () => {
  avatarFile.value = null
  avatarPreview.value = null
  avatarFileList.value = []
}

const handleCreate = async () => {
  try {
    // Validate form
    if (!formData.value.name.trim()) {
      msg.error('请输入空间名称')
      return
    }

    isCreating.value = true

    // Prepare create options
    const createOptions = {
      name: formData.value.name.trim(),
      topic: formData.value.topic?.trim() || undefined,
      avatar: avatarFile.value || undefined,
      visibility: formData.value.visibility,
      invite: selectedUsers.value.length > 0 ? selectedUsers.value : undefined
    }

    logger.info('[MobileCreateSpace] Creating space:', createOptions)

    // Create space via Matrix SDK
    const spaceId = await matrixSpacesService.createSpace(createOptions)

    logger.info('[MobileCreateSpace] Space created successfully:', spaceId)

    msg.success('空间创建成功')

    // Emit created event
    emit('created', spaceId)

    // Close dialog
    emit('update:show', false)

    // Reset form
    resetForm()
  } catch (error) {
    logger.error('[MobileCreateSpace] Failed to create space:', error)
    msg.error('创建空间失败：' + (error instanceof Error ? error.message : '未知错误'))
  } finally {
    isCreating.value = false
  }
}
</script>

<style lang="scss" scoped>
.create-space-dialog {
  display: flex;
  flex-direction: column;
  background: var(--card-color, #ffffff);
  max-height: 85vh;
  border-radius: 12px;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border-color, #f0f0f0);
  flex-shrink: 0;

  .header-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color-1, #333);
  }
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid var(--border-color, #f0f0f0);
  flex-shrink: 0;
}

.form-section {
  margin: 16px 0;

  .section-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color-2);
    margin-bottom: 12px;
  }
}

.radio-option {
  margin-bottom: 12px;
  padding: 12px;
  background: var(--bg-color, #f5f5f5);
  border-radius: 8px;

  &:last-child {
    margin-bottom: 0;
  }
}

.radio-content {
  margin-left: 28px;

  .option-title {
    font-weight: 500;
    color: var(--text-color-1);
  }

  .option-desc {
    font-size: 12px;
    color: var(--text-color-3);
    margin-top: 2px;
  }
}

.avatar-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.invite-collapse {
  margin-top: 16px;
}

.invite-section {
  padding: 0;

  .invite-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color-2);
    margin-bottom: 8px;
  }
}
</style>
