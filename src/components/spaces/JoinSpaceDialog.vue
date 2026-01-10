<template>
  <n-modal
    v-model:show="showDialog"
    :mask-closable="false"
    preset="dialog"
    title="加入工作区"
    class="join-space-modal"
    :style="{ width: isMobile() ? '100%' : '500px' }">
    <div class="join-space-dialog" :class="{ 'is-mobile': isMobile }">
      <!-- 空间信息展示 -->
      <div class="space-info" v-if="space">
        <div class="space-cover">
          <div v-if="space.avatar" class="space-avatar">
            <img :src="space.avatar" :alt="space.name" />
          </div>
          <div v-else class="space-placeholder">
            <n-icon size="48"><Building /></n-icon>
            <span class="placeholder-text">{{ space.name.charAt(0).toUpperCase() }}</span>
          </div>
        </div>
        <div class="space-details">
          <h3>{{ space.name }}</h3>
          <p v-if="space.topic">{{ space.topic }}</p>
          <p v-else-if="space.description">{{ space.description }}</p>
          <div class="space-meta">
            <span class="meta-item">
              <n-icon><Users /></n-icon>
              {{ space.memberCount }} 成员
            </span>
            <span class="meta-item">
              <n-icon><Hash /></n-icon>
              {{ space.roomCount }} 房间
            </span>
            <span class="meta-item" v-if="space.isPublic">
              <n-icon><Globe /></n-icon>
              公开空间
            </span>
            <span class="meta-item" v-else>
              <n-icon><Lock /></n-icon>
              私有空间
            </span>
          </div>
        </div>
      </div>

      <!-- 加入方式选择 -->
      <div class="join-method">
        <h4>选择加入方式</h4>
        <n-radio-group v-model:value="joinMethod" class="method-options">
          <n-radio value="direct" v-if="space?.isPublic">
            <div class="method-option">
              <div class="method-icon">
                <n-icon size="24"><UserPlus /></n-icon>
              </div>
              <div class="method-content">
                <div class="method-title">直接加入</div>
                <div class="method-desc">立即成为空间成员</div>
              </div>
            </div>
          </n-radio>

          <n-radio value="request" v-if="!space?.isPublic">
            <div class="method-option">
              <div class="method-icon">
                <n-icon size="24"><Send /></n-icon>
              </div>
              <div class="method-content">
                <div class="method-title">申请加入</div>
                <div class="method-desc">发送申请，等待管理员批准</div>
              </div>
            </div>
          </n-radio>

          <n-radio value="invite">
            <div class="method-option">
              <div class="method-icon">
                <n-icon size="24"><Mail /></n-icon>
              </div>
              <div class="method-content">
                <div class="method-title">邀请码</div>
                <div class="method-desc">使用邀请码加入</div>
              </div>
            </div>
          </n-radio>
        </n-radio-group>
      </div>

      <!-- 申请表单 -->
      <div v-if="joinMethod === 'request'" class="request-form">
        <h4>申请信息</h4>
        <n-form ref="requestFormRef" :model="requestForm" :rules="requestRules" label-placement="top">
          <n-form-item label="申请理由" path="reason">
            <n-input
              v-model:value="requestForm.reason"
              type="textarea"
              placeholder="请说明您希望加入此空间的原因..."
              :autosize="{ minRows: 3, maxRows: 5 }"
              maxlength="200"
              show-count />
          </n-form-item>

          <n-form-item label="您的角色" path="role">
            <n-select v-model:value="requestForm.role" :options="roleOptions" placeholder="选择您的角色" />
          </n-form-item>

          <n-form-item label="相关技能" path="skills">
            <n-dynamic-tags v-model:value="requestForm.skills" :max="5" placeholder="添加您的相关技能" />
          </n-form-item>
        </n-form>
      </div>

      <!-- 邀请码输入 -->
      <div v-if="joinMethod === 'invite'" class="invite-form">
        <h4>输入邀请码</h4>
        <n-form ref="inviteFormRef" :model="inviteForm" :rules="inviteRules" label-placement="top">
          <n-form-item label="邀请码" path="code">
            <n-input v-model:value="inviteForm.code" placeholder="请输入邀请码" maxlength="20" show-password-on="click">
              <template #prefix>
                <n-icon><Key /></n-icon>
              </template>
            </n-input>
          </n-form-item>

          <n-form-item>
            <n-button text @click="handleHelpWithInvite">
              <template #icon>
                <n-icon><HelpCircle /></n-icon>
              </template>
              如何获取邀请码？
            </n-button>
          </n-form-item>
        </n-form>
      </div>

      <!-- 加入须知 -->
      <div class="join-notice">
        <n-alert type="info" :closable="false">
          <template #header>加入须知</template>
          <ul>
            <li>加入空间后，您可以查看和参与空间内的所有房间</li>
            <li>请遵守空间规则和社区准则</li>
            <li>管理员可以根据需要调整您的权限</li>
            <li>您可以随时离开已加入的空间</li>
          </ul>
        </n-alert>
      </div>

      <!-- 频率限制提示 -->
      <div v-if="joinAttempts > 0" class="rate-limit">
        <n-alert type="warning" :closable="false">
          <template #header>请注意</template>
          您已提交 {{ joinAttempts }} 次加入申请，请耐心等待管理员处理。
        </n-alert>
      </div>
    </div>

    <template #action>
      <n-space>
        <n-button @click="handleCancel">取消</n-button>
        <n-button type="primary" @click="handleJoin" :loading="isJoining" :disabled="!canJoin">
          {{ getJoinButtonText() }}
        </n-button>
      </n-space>
    </template>
  </n-modal>

  <!-- 成功提示 -->
  <n-modal v-model:show="showSuccess" preset="dialog" type="success" title="申请已提交" class="success-modal">
    <div class="success-content">
      <n-result status="success" title="申请已成功提交">
        <template #footer>
          <div class="success-details">
            <p v-if="joinMethod === 'direct'">
              您已成功加入工作区
              <strong>{{ space?.name }}</strong>
              ！
            </p>
            <p v-else>您的加入申请已发送给工作区管理员，我们将在 24 小时内处理您的申请。</p>
            <div class="next-steps">
              <h5>接下来您可以：</h5>
              <ul>
                <li v-if="joinMethod === 'direct'">立即开始参与空间内的讨论</li>
                <li v-else>查看您的申请状态</li>
                <li>探索其他感兴趣的工作区</li>
                <li>联系空间管理员了解更多信息</li>
              </ul>
            </div>
          </div>
        </template>
      </n-result>
    </div>
    <template #action>
      <n-space>
        <n-button @click="showSuccess = false">关闭</n-button>
        <n-button v-if="joinMethod === 'direct'" type="primary" @click="handleGoToSpace">进入空间</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NRadioGroup,
  NRadio,
  NButton,
  NIcon,
  NAlert,
  NResult,
  NSpace,
  useDialog,
  FormInst
} from 'naive-ui'
import {
  Building,
  Users,
  Hash,
  Globe,
  Lock,
  UserPlus,
  Send,
  Mail,
  Key,
  HelpCircle
  //
} from '@/icons/TablerPlaceholders'
import { usePlatformConstants } from '@/utils/PlatformConstants'

import { useMatrixSpaces, type Space } from '@/hooks/useMatrixSpaces'

import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

interface Props {
  show: boolean
  space: Space | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  joined: [space: Space]
}>()

const { isMobile } = usePlatformConstants()
const message = msg

const { joinSpace } = useMatrixSpaces()

// 计算属性
const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

// 状态管理
const joinMethod = ref('direct')
const showSuccess = ref(false)
const isJoining = ref(false)
const joinAttempts = ref(0)

// 表单引用
const requestFormRef = ref<FormInst | null>(null)
const inviteFormRef = ref<FormInst | null>(null)

// 表单数据
const requestForm = reactive({
  reason: '',
  role: '',
  skills: []
})

const inviteForm = reactive({
  code: ''
})

// 选项数据
const roleOptions = [
  { label: '开发者', value: 'developer' },
  { label: '设计师', value: 'designer' },
  { label: '产品经理', value: 'product_manager' },
  { label: '运营', value: 'operations' },
  { label: '学生', value: 'student' },
  { label: '其他', value: 'other' }
]

// 计算属性
const canJoin = computed(() => {
  if (!props.space) return false
  switch (joinMethod.value) {
    case 'direct':
      return !!props.space.isPublic
    case 'request':
      return requestForm.reason.trim().length > 0
    case 'invite':
      return inviteForm.code.trim().length > 0
    default:
      return false
  }
})

// ========== 方法 ==========

const getJoinButtonText = (): string => {
  switch (joinMethod.value) {
    case 'direct':
      return '立即加入'
    case 'request':
      return '提交申请'
    case 'invite':
      return '验证并加入'
    default:
      return '加入'
  }
}

const handleCancel = () => {
  resetForms()
  showDialog.value = false
}

const handleJoin = async () => {
  if (!props.space) return

  try {
    isJoining.value = true

    let success = false

    if (joinMethod.value === 'direct') {
      success = await joinSpace(props.space.id)
      if (success) {
        message.success(`已加入工作区: ${props.space.name}`)
        emit('joined', props.space)
        showDialog.value = false
      }
    } else {
      if (joinMethod.value === 'request') await requestFormRef.value?.validate()
      if (joinMethod.value === 'invite') await inviteFormRef.value?.validate()
      joinAttempts.value++
      showSuccess.value = true
    }
  } catch (error) {
    logger.error('Failed to join space:', error)
    message.error('加入失败，请稍后重试')
  } finally {
    isJoining.value = false
  }
}

const handleGoToSpace = () => {
  showSuccess.value = false
  // 导航到空间详情页面
  message.info('正在进入空间...')
}

const handleHelpWithInvite = () => {
  dialog.info({
    title: '如何获取邀请码',
    content:
      '邀请码通常由空间管理员提供。您可以：\n\n1. 联系空间管理员索取邀请码\n2. 查看空间官方发布的邀请信息\n3. 通过其他空间成员获取邀请链接',
    positiveText: '明白了'
  })
}

const resetForms = () => {
  requestForm.reason = ''
  requestForm.role = ''
  requestForm.skills = []
  inviteForm.code = ''
  joinMethod.value = props.space?.isPublic ? 'direct' : 'request'

  // 重置表单验证
  requestFormRef.value?.restoreValidation()
  inviteFormRef.value?.restoreValidation()
}

// ========== 生命周期 ==========

onMounted(() => {
  // 根据空间加入规则设置默认加入方式
  if (props.space) joinMethod.value = props.space.isPublic ? 'direct' : 'request'
})

// 表单验证规则
const requestRules = {
  reason: [
    { required: true, message: '请输入申请理由', trigger: 'blur' },
    { min: 10, max: 200, message: '申请理由长度应在10-200个字符之间', trigger: 'blur' }
  ],
  role: [{ required: true, message: '请选择您的角色', trigger: 'change' }]
}

const inviteRules = {
  code: [
    { required: true, message: '请输入邀请码', trigger: 'blur' },
    { min: 6, max: 20, message: '邀请码格式不正确', trigger: 'blur' }
  ]
}

// 引入 useDialog
const dialog = useDialog()
</script>

<style lang="scss" scoped>
.join-space-modal {
  width: 500px;
  max-height: 90vh;
  overflow: hidden;
}

.success-modal {
  width: 400px;
}

.join-space-dialog {
  .space-info {
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

    .space-details {
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
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .space-meta {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;

        .meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: var(--text-color-3);
        }
      }
    }
  }

  .join-method {
    margin-bottom: 24px;

    h4 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-1);
    }

    .method-options {
      display: flex;
      flex-direction: column;
      gap: var(--hula-spacing-md);

      :deep(.n-radio) {
        width: 100%;
        padding: var(--hula-spacing-md);
        border: 1px solid var(--border-color);
        border-radius: var(--hula-radius-sm);
        transition: border-color 0.2s ease, background 0.2s ease;

        &:hover {
          border-color: var(--primary-color);
        }

        &.n-radio--checked {
          border-color: var(--primary-color);
          background: rgba(var(--hula-info-rgb), 0.05);
        }

        .n-radio__dot-wrapper {
          margin-right: 16px;
        }
      }
    }

    .method-option {
      display: flex;
      align-items: center;
      gap: 16px;

      .method-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--primary-color);
        color: white;
        border-radius: 8px;
        flex-shrink: 0;
      }

      .method-content {
        .method-title {
          font-weight: 500;
          color: var(--text-color-1);
          margin-bottom: 4px;
        }

        .method-desc {
          font-size: 13px;
          color: var(--text-color-3);
        }
      }
    }
  }

  .request-form,
  .invite-form {
    margin-bottom: 24px;

    h4 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-1);
    }
  }

  .join-notice {
    margin-bottom: 24px;

    :deep(.n-alert-body) {
      ul {
        margin: 8px 0 0 0;
        padding-left: 20px;

        li {
          margin-bottom: 4px;
          line-height: 1.5;
        }
      }
    }
  }

  .space-rules {
    margin-bottom: 24px;

    h4 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-1);
    }

    .rules-content {
      background: var(--bg-color-hover);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;

      .rule-item {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 14px;
        color: var(--text-color-2);

        &:last-child {
          margin-bottom: 0;
        }

        .n-icon {
          color: var(--success-color);
          flex-shrink: 0;
        }
      }
    }
  }

  .rate-limit {
    margin-bottom: 24px;
  }

  .success-content {
    .success-details {
      p {
        margin: 16px 0;
        line-height: 1.6;
      }

      .next-steps {
        margin-top: 20px;

        h5 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-color-1);
        }

        ul {
          margin: 0;
          padding-left: 20px;

          li {
            margin-bottom: 6px;
            font-size: 13px;
            color: var(--text-color-2);
          }
        }
      }
    }
  }

  &.is-mobile {
    .space-info {
      flex-direction: column;
      text-align: center;
      gap: 12px;

      .space-cover {
        width: 60px;
        height: 60px;
        margin: 0 auto;

        .space-placeholder .placeholder-text {
          font-size: 24px;
        }
      }

      .space-details {
        .space-meta {
          justify-content: center;
        }
      }
    }

    .method-option {
      .method-icon {
        width: 40px;
        height: 40px;
      }

      .method-content {
        .method-title {
          font-size: 14px;
        }

        .method-desc {
          font-size: 12px;
        }
      }
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .join-space-dialog {
    .space-info {
      padding: 16px;

      .space-cover {
        width: 60px;
        height: 60px;

        .space-placeholder .placeholder-text {
          font-size: 24px;
        }
      }

      .space-details {
        h3 {
          font-size: 16px;
        }

        .space-meta {
          gap: 12px;
        }
      }
    }
  }
}
</style>
