<template>
  <n-modal v-model:show="visible" :mask-closable="false" preset="card" title="创建空间" class="create-space-modal">
    <n-form ref="formRef" :model="formData" :rules="rules" label-placement="top" label-width="80">
      <!-- Space name -->
      <n-form-item label="空间名称" path="name">
        <n-input
          v-model:value="formData.name"
          placeholder="请输入空间名称"
          :maxlength="50"
          show-count
          @keydown.enter="handleCreateSpace" />
      </n-form-item>

      <!-- Space topic -->
      <n-form-item label="空间描述" path="topic">
        <n-input
          v-model:value="formData.topic"
          type="textarea"
          placeholder="请输入空间描述（可选）"
          :autosize="{ minRows: 2, maxRows: 4 }"
          :maxlength="200"
          show-count />
      </n-form-item>

      <!-- Visibility -->
      <n-form-item label="可见性" path="visibility">
        <n-radio-group v-model:value="formData.visibility">
          <n-space vertical>
            <n-radio value="private">
              <div>
                <div class="font-medium">私密空间</div>
                <div class="text-(11px [--chat-text-color])">仅受邀用户可以加入</div>
              </div>
            </n-radio>
            <n-radio value="public">
              <div>
                <div class="font-medium">公开空间</div>
                <div class="text-(11px [--chat-text-color])">任何人都可以通过链接或搜索找到</div>
              </div>
            </n-radio>
          </n-space>
        </n-radio-group>
      </n-form-item>

      <!-- Space avatar -->
      <n-form-item label="空间头像">
        <n-upload :max="1" accept="image/*" :show-file-list="false" @change="handleAvatarChange">
          <n-button>选择图片</n-button>
        </n-upload>
        <div v-if="avatarPreview" class="mt-8px">
          <n-avatar :size="64" :src="avatarPreview" />
        </div>
      </n-form-item>
    </n-form>

    <template #footer>
      <n-space justify="end">
        <n-button @click="handleCancel">取消</n-button>
        <n-button type="primary" :loading="loading" @click="handleCreateSpace">创建</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useMitt } from '@/hooks/useMitt'
import { MittEnum } from '@/enums'
import { useSpacesStore } from '@/stores/spaces'
import { logger } from '@/utils/logger'
import { msg } from '@/utils/SafeUI'

const visible = ref(false)
const loading = ref(false)
const formRef = ref()
const avatarFile = ref<File | null>(null)
const avatarPreview = ref<string>('')

// Form data
const formData = reactive({
  name: '',
  topic: '',
  visibility: 'private' as 'public' | 'private'
})

// Form rules
const rules = {
  name: [
    { required: true, message: '请输入空间名称', trigger: 'blur' },
    { min: 2, max: 50, message: '空间名称长度应在 2-50 个字符之间', trigger: 'blur' }
  ]
}

// Handle avatar change
const handleAvatarChange = (options: { file: { file?: File | null; status?: string }; fileList?: unknown[] }) => {
  const file = options.file?.file
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

// Handle create space
const handleCreateSpace = async () => {
  try {
    // Validate form
    await formRef.value?.validate()

    loading.value = true

    const spacesStore = useSpacesStore()

    // Build create space options with only defined properties
    const createSpaceOptions: {
      name: string
      topic?: string
      avatar?: File
      visibility: 'public' | 'private'
    } = {
      name: formData.name.trim(),
      visibility: formData.visibility
    }

    const trimmedTopic = formData.topic.trim()
    if (trimmedTopic) {
      createSpaceOptions.topic = trimmedTopic
    }

    if (avatarFile.value) {
      createSpaceOptions.avatar = avatarFile.value
    }

    // Create space
    const roomId = await spacesStore.createSpace(createSpaceOptions)

    logger.info('[CreateSpaceModal] Space created successfully', { roomId, name: formData.name })

    msg.success('空间创建成功')

    // Reset form
    handleResetForm()

    // Close modal
    visible.value = false

    // Notify other components to refresh
    useMitt.emit(MittEnum.REFRESH_SPACES)
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'errorFields' in error) {
      // Form validation error, do nothing
      return
    }

    logger.error('[CreateSpaceModal] Failed to create space:', error)
    msg.error(
      (error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String(error.message)
          : '') || '创建空间失败'
    )
  } finally {
    loading.value = false
  }
}

// Handle cancel
const handleCancel = () => {
  handleResetForm()
  visible.value = false
}

// Reset form
const handleResetForm = () => {
  formData.name = ''
  formData.topic = ''
  formData.visibility = 'private'
  avatarFile.value = null
  avatarPreview.value = ''
  formRef.value?.restoreValidation()
}

// Listen for show modal event
useMitt.on(MittEnum.SHOW_CREATE_SPACE_MODAL, () => {
  visible.value = true
})
</script>

<style lang="scss" scoped>
.create-space-modal {
  width: 400px;
}

:deep(.n-form-item-label) {
  font-weight: 500;
}
</style>
