<template>
  <n-modal
    v-model:show="showDialog"
    preset="card"
    title="创建空间"
    :bordered="false"
    :mask-closable="false"
    :style="{ width: '90%', maxWidth: '450px' }"
    @update:show="handleClose">
    <n-spin :show="isCreating" description="正在创建空间...">
      <n-form ref="formRef" :model="formData" :rules="formRules" label-placement="top">
        <!-- Space Name -->
        <n-form-item label="空间名称" path="name">
          <n-input
            v-model:value="formData.name"
            placeholder="输入空间名称"
            maxlength="64"
            show-count
            @keydown.enter="handleCreate" />
        </n-form-item>

        <!-- Topic -->
        <n-form-item label="描述（可选）" path="topic">
          <n-input
            v-model:value="formData.topic"
            type="textarea"
            placeholder="描述这个空间的用途"
            :rows="3"
            maxlength="256"
            show-count />
        </n-form-item>

        <!-- Visibility -->
        <n-form-item label="可见性" path="visibility">
          <n-radio-group v-model:value="formData.visibility" name="visibility">
            <n-space vertical>
              <n-radio value="private">
                <div class="radio-option">
                  <div class="option-title">私有空间</div>
                  <div class="option-desc">仅受邀成员可以查看和加入</div>
                </div>
              </n-radio>
              <n-radio value="public">
                <div class="radio-option">
                  <div class="option-title">公开空间</div>
                  <div class="option-desc">任何人都可以查看和加入</div>
                </div>
              </n-radio>
            </n-space>
          </n-radio-group>
        </n-form-item>

        <!-- Avatar -->
        <n-form-item label="头像（可选）" path="avatar">
          <n-space vertical>
            <n-upload :max="1" accept="image/*" :show-file-list="false" @change="handleAvatarChange">
              <n-button>
                <template #icon>
                  <n-icon><Upload /></n-icon>
                </template>
                选择图片
              </n-button>
            </n-upload>
            <n-space v-if="avatarPreview" align="center">
              <n-avatar :size="60" :src="avatarPreview" />
              <n-button text type="error" @click="clearAvatar">
                <template #icon>
                  <n-icon><X /></n-icon>
                </template>
                移除
              </n-button>
            </n-space>
          </n-space>
        </n-form-item>

        <!-- Invite Members (Optional) -->
        <n-collapse-item title="邀请成员（可选）">
          <n-form-item label="邀请用户">
            <n-select
              v-model:value="selectedUsers"
              :options="userOptions"
              multiple
              filterable
              placeholder="选择要邀请的用户"
              :loading="isLoadingUsers"
              clearable>
              <template #empty>
                <n-empty size="small" description="没有可邀请的用户" />
              </template>
            </n-select>
          </n-form-item>
        </n-collapse-item>
      </n-form>
    </n-spin>

    <template #footer>
      <n-space justify="end">
        <n-button @click="handleClose" :disabled="isCreating">取消</n-button>
        <n-button type="primary" @click="handleCreate" :loading="isCreating" :disabled="!formData.name.trim()">
          创建空间
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NRadioGroup,
  NRadio,
  NSpace,
  NButton,
  NUpload,
  NAvatar,
  NCollapseItem,
  NSelect,
  NIcon,
  NSpin,
  NEmpty,
  type FormRules,
  type FormInst,
  type UploadFileInfo
} from 'naive-ui'
import { Upload, X } from '@vicons/tabler'
import { matrixSpacesService } from '@/services/matrixSpacesService'
import { useUserStore } from '@/stores/user'
import { logger } from '@/utils/logger'
import { msg } from '@/utils/SafeUI'

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

// Form
const formRef = ref<FormInst | null>(null)
const isCreating = ref(false)
const avatarFile = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)
const selectedUsers = ref<string[]>([])
const isLoadingUsers = ref(false)

// Form data
const formData = ref({
  name: '',
  topic: '',
  visibility: 'private' as 'public' | 'private'
})

// Form validation rules
const formRules: FormRules = {
  name: [
    {
      required: true,
      message: '请输入空间名称',
      trigger: ['blur', 'input']
    },
    {
      min: 1,
      max: 64,
      message: '空间名称长度应在 1-64 个字符之间',
      trigger: ['blur', 'input']
    }
  ]
}

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
  selectedUsers.value = []
  formRef.value?.restoreValidation()
}

const handleClose = () => {
  if (!isCreating.value) {
    emit('update:show', false)
  }
}

const handleAvatarChange = (options: { fileList: UploadFileInfo[] }) => {
  const file = options.fileList[0]?.file
  if (file) {
    avatarFile.value = file
    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      avatarPreview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

const clearAvatar = () => {
  avatarFile.value = null
  avatarPreview.value = null
}

const handleCreate = async () => {
  try {
    // Validate form
    await formRef.value?.validate()

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
.radio-option {
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
</style>
