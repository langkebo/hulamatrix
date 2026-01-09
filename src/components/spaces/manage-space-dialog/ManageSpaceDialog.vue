<template>
  <n-modal
    v-model:show="showDialog"
    :mask-closable="false"
    preset="dialog"
    :title="space ? `管理工作区 - ${space.name}` : '管理工作区'"
    class="modal-large"
    :style="{ width: isMobile() ? '100%' : '800px' }">
    <div v-if="space" class="manage-space-dialog" :class="{ 'is-mobile': isMobile() }">
      <!-- 空间信息概览 -->
      <div class="space-overview">
        <div class="space-cover">
          <div v-if="space.avatar" class="space-avatar">
            <img :src="space.avatar" :alt="space.name" />
          </div>
          <div v-else class="space-placeholder">
            <n-icon size="48"><Building /></n-icon>
            <span class="placeholder-text">{{ space.name.charAt(0).toUpperCase() }}</span>
          </div>
        </div>
        <div class="space-info">
          <h3>{{ space.name }}</h3>
          <p>{{ space.topic || space.description || '暂无描述' }}</p>
          <div class="space-stats">
            <span class="stat-item">
              <n-icon><Users /></n-icon>
              {{ space.memberCount }} 成员
            </span>
            <span class="stat-item">
              <n-icon><Hash /></n-icon>
              {{ space.roomCount }} 房间
            </span>
            <span class="stat-item">
              <n-icon><Calendar /></n-icon>
              创建于 {{ formatDate(space.created) }}
            </span>
          </div>
        </div>
      </div>

      <!-- 管理标签页 -->
      <div class="manage-content">
        <n-tabs v-model:value="activeTab" type="segment" animated>
          <!-- 标签页内容将通过组件渲染 -->
          <slot :active-tab="activeTab" :space="space" />
        </n-tabs>
      </div>
    </div>

    <template #action>
      <n-space>
        <n-button @click="handleCancel">取消</n-button>
        <n-button type="primary" @click="handleSave" :loading="isSaving">保存更改</n-button>
      </n-space>
    </template>
  </n-modal>

  <!-- 邀请成员对话框 -->
  <n-modal v-model:show="showInviteDialog" preset="dialog" title="邀请成员" class="modal-medium">
    <n-form ref="inviteFormRef" :model="inviteForm" :rules="inviteRules" label-placement="left" label-width="100px">
      <n-form-item label="用户邮箱" path="emails">
        <n-dynamic-input v-model:value="inviteForm.emails" placeholder="输入邮箱地址" :max="10" />
      </n-form-item>
      <n-form-item label="邀请消息" path="message">
        <n-input
          v-model:value="inviteForm.message"
          type="textarea"
          placeholder="可选的邀请消息"
          :autosize="{ minRows: 2, maxRows: 4 }" />
      </n-form-item>
      <n-form-item label="初始权限" path="permissions">
        <n-select v-model:value="inviteForm.permissions" :options="permissionPresets" placeholder="选择初始权限" />
      </n-form-item>
    </n-form>
    <template #action>
      <n-space>
        <n-button @click="showInviteDialog = false">取消</n-button>
        <n-button type="primary" @click="handleSendInvites" :loading="isInviting">发送邀请</n-button>
      </n-space>
    </template>
  </n-modal>

  <!-- 删除确认对话框 -->
  <n-modal v-model:show="showDeleteConfirm" preset="dialog" type="error" title="删除空间确认" class="modal-small">
    <div class="delete-confirmation">
      <n-alert type="error" :closable="false">
        <strong>⚠️ 警告：此操作不可恢复！</strong>
        <p>删除空间将永久移除所有消息、文件和成员数据。请确认您要继续。</p>
      </n-alert>

      <n-form
        ref="deleteFormRef"
        :model="deleteForm"
        :rules="deleteRules"
        label-placement="left"
        label-width="120px"
        class="mt-20">
        <n-form-item label="确认删除" path="confirm">
          <n-input v-model:value="deleteForm.confirm" placeholder="请输入空间名称以确认删除" />
        </n-form-item>
      </n-form>
    </div>
    <template #action>
      <n-space>
        <n-button @click="showDeleteConfirm = false">取消</n-button>
        <n-button
          type="error"
          @click="handleDeleteSpace"
          :disabled="deleteForm.confirm !== (space?.name || '')"
          :loading="isDeleting">
          永久删除
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  NModal,
  NTabs,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NButton,
  NIcon,
  NSpace,
  NAlert,
  type FormInst
} from 'naive-ui'
import { Building, Users, Hash, Calendar } from '@/icons/TablerPlaceholders'
import { usePlatformConstants } from '@/utils/PlatformConstants'
import { useManageSpaceDialog } from './useManageSpaceDialog'
import type { Space } from './types'

interface Props {
  show: boolean
  space: Space | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  updated: [space: Space]
}>()

const { isMobile } = usePlatformConstants()

// Use composable
const {
  // State
  activeTab,
  showInviteDialog,
  showDeleteConfirm,
  isSaving,
  isInviting,
  isDeleting,

  // Form refs
  inviteFormRef,
  deleteFormRef,

  // Form data
  inviteForm,
  deleteForm,

  // Options
  permissionPresets,

  // Validation rules
  inviteRules,
  deleteRules,

  // Methods
  formatDate,
  handleCancel,
  handleSave,
  handleSendInvites,
  handleDeleteSpace
} = useManageSpaceDialog({
  space: computed(() => props.space),
  emit: (event: 'update:show' | 'updated', value?: boolean | Space) => {
    if (event === 'update:show') emit('update:show', value as boolean)
    if (event === 'updated') emit('updated', value as Space)
  }
})

// Computed
const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

// Expose for slot content
defineExpose({
  activeTab,
  space: computed(() => props.space),
  showInviteDialog,
  showDeleteConfirm,
  inviteForm,
  deleteForm,
  inviteFormRef,
  deleteFormRef,
  permissionPresets,
  isSaving,
  isInviting,
  isDeleting,
  formatDate,
  handleSendInvites,
  handleDeleteSpace
})
</script>

<style lang="scss" scoped>
.manage-space-dialog {
  .space-overview {
    display: flex;
    gap: 16px;
    padding: 20px;
    background: var(--bg-color-hover);
    border-radius: 8px;
    margin-bottom: 24px;

    .space-cover {
      width: 80px;
      height: 80px;
      flex-shrink: 0;

      .space-avatar,
      .space-placeholder {
        width: 100%;
        height: 100%;
        border-radius: 8px;
        overflow: hidden;
      }

      .space-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .space-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, var(--hula-brand-primary) 0%, var(--hula-brand-primary) 100%);
        color: white;

        .placeholder-text {
          font-size: 32px;
          font-weight: 600;
          text-transform: uppercase;
          opacity: 0.8;
        }
      }
    }

    .space-info {
      flex: 1;

      h3 {
        margin: 0 0 8px 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--text-color-1);
      }

      p {
        margin: 0 0 12px 0;
        color: var(--text-color-2);
        line-height: 1.5;
      }

      .space-stats {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;

        .stat-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: var(--text-color-3);
        }
      }
    }
  }

  .manage-content {
    max-height: 60vh;
    overflow-y: auto;
  }

  .delete-confirmation {
    .n-alert {
      margin-bottom: 16px;

      strong {
        display: block;
        margin-bottom: 8px;
      }

      p {
        margin: 0;
        line-height: 1.5;
      }
    }
  }

  &.is-mobile {
    .space-overview {
      flex-direction: column;
      text-align: center;
      gap: 12px;

      .space-info {
        .space-stats {
          justify-content: center;
        }
      }
    }

    .manage-content {
      max-height: 70vh;
    }
  }
}

/* Modal sizes */
.modal-large {
  width: 800px;
  max-height: 90vh;
  overflow: hidden;
}

.modal-medium {
  width: 500px;
}

.modal-small {
  width: 400px;
}

.mt-20 {
  margin-top: 20px;
}

/* Responsive */
@media (max-width: 768px) {
  .manage-space-dialog {
    .space-overview {
      padding: 16px;

      .space-cover {
        width: 60px;
        height: 60px;

        .space-placeholder .placeholder-text {
          font-size: 24px;
        }
      }

      .space-info {
        h3 {
          font-size: 16px;
        }
      }
    }
  }
}
</style>
