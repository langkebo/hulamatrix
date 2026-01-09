<template>
  <div class="space-settings">
    <n-form ref="formRef" :model="formData" label-placement="left" label-width="120px">
      <!-- 基本信息 -->
      <div class="setting-section">
        <h3>基本信息</h3>
        <n-form-item label="空间名称" path="name">
          <n-input v-model:value="formData.basic.name" placeholder="请输入空间名称" />
        </n-form-item>
        <n-form-item label="空间主题" path="topic">
          <n-input
            v-model:value="formData.basic.topic"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder="简短描述空间主题" />
        </n-form-item>
        <n-form-item label="空间描述" path="description">
          <n-input
            v-model:value="formData.basic.description"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 6 }"
            placeholder="详细描述空间用途和规则" />
        </n-form-item>
        <n-form-item label="空间头像" path="avatar">
          <n-input v-model:value="formData.basic.avatar" placeholder="头像 URL" />
        </n-form-item>
      </div>

      <!-- 隐私设置 -->
      <div class="setting-section">
        <h3>隐私设置</h3>
        <n-form-item label="公开空间" path="isPublic">
          <n-switch v-model:value="formData.privacy.isPublic" />
          <template #feedback>公开空间可以被任何人搜索和查看</template>
        </n-form-item>
        <n-form-item label="允许访客" path="guestAllowed">
          <n-switch v-model:value="formData.privacy.guestAllowed" />
          <template #feedback>允许未注册用户作为访客访问</template>
        </n-form-item>
        <n-form-item label="历史记录可见" path="historyVisible">
          <n-switch v-model:value="formData.privacy.historyVisible" />
          <template #feedback>新成员可以查看加入前的消息历史</template>
        </n-form-item>
      </div>

      <!-- 通知设置 -->
      <div class="setting-section">
        <h3>通知设置</h3>
        <n-form-item label="所有房间" path="allRooms">
          <n-switch v-model:value="formData.notification.allRooms" />
          <template #feedback>接收空间内所有房间的通知</template>
        </n-form-item>
        <n-form-item label="忽略提及" path="ignoreMentions">
          <n-switch v-model:value="formData.notification.ignoreMentions" />
          <template #feedback>不接收 @mention 的通知</template>
        </n-form-item>
        <n-form-item label="关键词" path="keywords">
          <n-dynamic-tags v-model:value="formData.notification.keywords" />
          <template #feedback>当消息包含这些关键词时通知我</template>
        </n-form-item>
      </div>

      <!-- 操作按钮 -->
      <div class="setting-actions">
        <n-space>
          <n-button type="primary" @click="$emit('save', formData)" :loading="isSaving">保存设置</n-button>
          <n-button @click="$emit('reset')">重置</n-button>
        </n-space>
      </div>
    </n-form>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { NForm, NFormItem, NInput, NSwitch, NDynamicTags, NButton, NSpace } from 'naive-ui'
import type { FormInst } from 'naive-ui'
import type { BasicSettingsForm, PrivacySettingsForm, NotificationSettingsForm, SpaceDetailsProps } from './types'

interface Props {
  space: NonNullable<SpaceDetailsProps['space']>
  isSaving?: boolean
}

interface Emits {
  (
    e: 'save',
    data: {
      basic: BasicSettingsForm
      privacy: PrivacySettingsForm
      notification: NotificationSettingsForm
    }
  ): void
  (e: 'reset'): void
  (
    e: 'update:formData',
    data: {
      basic: BasicSettingsForm
      privacy: PrivacySettingsForm
      notification: NotificationSettingsForm
    }
  ): void
}

const props = withDefaults(defineProps<Props>(), {
  isSaving: false
})

const emit = defineEmits<Emits>()

const formRef = ref<FormInst>()

const formData = ref({
  basic: {
    name: props.space.name,
    topic: props.space.topic || '',
    description: props.space.description || '',
    avatar: props.space.avatar || ''
  },
  privacy: {
    isPublic: props.space.isPublic || false,
    guestAllowed: false,
    historyVisible: false
  },
  notification: {
    allRooms: false,
    keywords: [],
    ignoreMentions: false
  }
})

// 监听表单变化，同步到父组件
watch(
  () => formData.value,
  (newValue) => {
    emit('update:formData', newValue)
  },
  { deep: true }
)
</script>

<style lang="scss" scoped>
.space-settings {
  padding: 24px;

  .setting-section {
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--divider-color);

    &:last-of-type {
      border-bottom: none;
    }

    h3 {
      margin: 0 0 20px 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--text-color-1);
    }

    .n-form-item {
      margin-bottom: 20px;
    }
  }

  .setting-actions {
    display: flex;
    justify-content: flex-end;
    padding-top: 16px;
  }
}
</style>
