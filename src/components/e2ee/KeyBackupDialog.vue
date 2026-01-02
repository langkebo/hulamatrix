<template>
  <n-modal
    v-model:show="showDialog"
    :mask-closable="false"
    preset="dialog"
    title="密钥备份"
    style="width: 600px"
  >
    <div class="key-backup-dialog">
      <!-- 备份状态概览 -->
      <div class="backup-overview">
        <n-alert
          :type="backupStatus.type"
          :title="backupStatus.title"
          show-icon
          closable
        >
          {{ backupStatus.description }}
        </n-alert>
      </div>

      <!-- 备份方式选择 -->
      <div class="backup-methods" v-if="currentStep === 'method'">
        <h4>选择备份方式</h4>
        <n-space vertical size="large">
          <n-card
            v-for="method in backupMethods"
            :key="method.key"
            :class="{ 'method-selected': selectedMethod === method.key }"
            class="method-card"
            hoverable
            @click="selectedMethod = method.key"
          >
            <div class="method-content">
              <div class="method-icon">{{ method.icon }}</div>
              <div class="method-info">
                <div class="method-title">{{ method.title }}</div>
                <div class="method-description">{{ method.description }}</div>
                <div class="method-security">
                  <n-tag :type="method.security.type as never" size="small">{{ method.security.label }}</n-tag>
                  <span class="security-text">{{ method.security.text }}</span>
                </div>
              </div>
            </div>
          </n-card>
        </n-space>
      </div>

      <!-- 密码设置 -->
      <div class="password-setup" v-if="currentStep === 'password'">
        <h4>设置备份密码</h4>
        <n-form :model="backupForm" :rules="passwordRules" ref="passwordFormRef">
          <n-form-item label="备份密码" path="password">
            <n-input
              v-model:value="backupForm.password"
              type="password"
              show-password-on="click"
              placeholder="请输入备份密码"
              :maxlength="64"
              show-count
            />
          </n-form-item>
          <n-form-item label="确认密码" path="confirmPassword">
            <n-input
              v-model:value="backupForm.confirmPassword"
              type="password"
              show-password-on="click"
              placeholder="请再次输入密码"
              :maxlength="64"
            />
          </n-form-item>
          <n-form-item>
            <n-alert type="info" show-icon>
              <template #icon>
                <n-icon><Info /></n-icon>
              </template>
              <div class="password-tips">
                <p>密码要求：</p>
                <ul>
                  <li>至少8个字符</li>
                  <li>包含大小写字母和数字</li>
                  <li>建议使用特殊字符增强安全性</li>
                  <li>请妥善保管，丢失密码将无法恢复密钥</li>
                </ul>
              </div>
            </n-alert>
          </n-form-item>
        </n-form>
      </div>

      <!-- 备份进度 -->
      <div class="backup-progress" v-if="currentStep === 'progress'">
        <div class="progress-content">
          <div class="progress-icon">
            <n-spin v-if="isBackingUp" size="large">
              <div style="width: 60px; height: 60px;"></div>
            </n-spin>
            <n-icon v-else-if="backupCompleted" size="60" color="#18a058">
              <CheckCircle />
            </n-icon>
            <n-icon v-else size="60" color="#f0a020">
              <AlertCircle />
            </n-icon>
          </div>
          <div class="progress-info">
            <h4>{{ progressTitle }}</h4>
            <p>{{ progressDescription }}</p>
            <n-progress
              v-if="isBackingUp"
              :percentage="backupProgress"
              :height="8"
              :border-radius="4"
              :fill-border-radius="4"
            />
            <div class="progress-details" v-if="currentBackupStep">
              <n-tag size="small" type="info">{{ currentBackupStep }}</n-tag>
            </div>
          </div>
        </div>
      </div>

      <!-- 备份完成 -->
      <div class="backup-completed" v-if="currentStep === 'completed'">
        <div class="completion-content">
          <n-result
            status="success"
            title="备份创建成功"
            :description="`已成功备份 ${backupData.deviceCount} 个设备的密钥`"
          >
            <div class="backup-summary">
              <n-descriptions :column="1" size="small">
                <n-descriptions-item label="备份时间">
                  {{ formatTimestamp(backupData.backupTime) }}
                </n-descriptions-item>
                <n-descriptions-item label="备份方式">
                  {{ getMethodName(selectedMethod) }}
                </n-descriptions-item>
                <n-descriptions-item label="设备数量">
                  {{ backupData.deviceCount }} 个
                </n-descriptions-item>
                <n-descriptions-item label="密钥数量">
                  {{ backupData.keyCount }} 个
                </n-descriptions-item>
                <n-descriptions-item label="备份大小">
                  {{ formatFileSize(backupData.backupSize) }}
                </n-descriptions-item>
              </n-descriptions>
            </div>
            <div class="backup-actions">
              <n-space>
                <n-button @click="downloadBackup" type="primary">
                  <template #icon>
                    <n-icon><Download /></n-icon>
                  </template>
                  下载备份文件
                </n-button>
                <n-button @click="showVerificationCode">
                  <template #icon>
                    <n-icon><Key /></n-icon>
                  </template>
                  查看恢复代码
                </n-button>
                <n-button @click="shareBackup">
                  <template #icon>
                    <n-icon><Share /></n-icon>
                  </template>
                  分享备份
                </n-button>
              </n-space>
            </div>
          </n-result>
        </div>
      </div>

      <!-- 恢复代码 -->
      <div class="recovery-code" v-if="currentStep === 'recovery-code'">
        <div class="code-content">
          <h4>恢复代码</h4>
          <div class="code-warning">
            <n-alert type="warning" show-icon closable>
              请妥善保存此恢复代码，它将用于恢复您的密钥备份。不要与他人分享此代码。
            </n-alert>
          </div>
          <div class="code-display">
            <div class="code-grid">
              <div
                v-for="(code, index) in recoveryCodes"
                :key="index"
                class="code-item"
              >
                {{ code }}
              </div>
            </div>
          </div>
          <div class="code-actions">
            <n-space>
              <n-button @click="copyRecoveryCode" type="primary" size="small">
                <template #icon>
                  <n-icon><Copy /></n-icon>
                </template>
                复制代码
              </n-button>
              <n-button @click="downloadRecoveryCode" size="small">
                <template #icon>
                  <n-icon><Download /></n-icon>
                </template>
                下载代码
              </n-button>
              <n-button @click="printRecoveryCode" size="small">
                <template #icon>
                  <n-icon><Printer /></n-icon>
                </template>
                打印代码
              </n-button>
            </n-space>
          </div>
        </div>
      </div>

      <!-- 现有备份 -->
      <div class="existing-backup" v-if="currentStep === 'existing'">
        <div class="existing-content">
          <h4>现有备份</h4>
          <div v-if="existingBackups.length === 0" class="no-backup">
            <n-empty description="暂无备份记录" />
          </div>
          <div v-else class="backup-list">
            <n-card
              v-for="backup in existingBackups"
              :key="backup.id"
              class="backup-item"
              size="small"
            >
              <div class="backup-item-content">
                <div class="backup-info">
                  <div class="backup-title">{{ backup.method }}备份</div>
                  <div class="backup-meta">
                    <span>{{ formatTimestamp(backup.createdAt) }}</span>
                    <n-tag size="small" :type="backup.status === 'valid' ? 'success' : 'error'">
                      {{ backup.status === 'valid' ? '有效' : '已过期' }}
                    </n-tag>
                  </div>
                </div>
                <div class="backup-actions">
                  <n-dropdown
                    :options="getBackupActions(backup)"
                    @select="handleBackupAction($event, backup)"
                  >
                    <n-button quaternary circle size="small">
                      <template #icon>
                        <n-icon><MoreVertical /></n-icon>
                      </template>
                    </n-button>
                  </n-dropdown>
                </div>
              </div>
            </n-card>
          </div>
        </div>
      </div>
    </div>

    <template #action>
      <div class="dialog-actions">
        <n-button
          v-if="currentStep === 'method'"
          @click="startBackup"
          type="primary"
          :disabled="!selectedMethod"
        >
          开始备份
        </n-button>
        <n-button
          v-if="currentStep === 'password'"
          @click="validateAndStartBackup"
          type="primary"
          :loading="isBackingUp"
        >
          开始备份
        </n-button>
        <n-button
          v-if="currentStep === 'existing'"
          @click="currentStep = 'method'"
          type="primary"
        >
          创建新备份
        </n-button>
        <n-button @click="handleCancel">
          {{ currentStep === 'method' ? '取消' : '返回' }}
        </n-button>
      </div>
    </template>
  </n-modal>

  <!-- 恢复代码对话框 -->
  <n-modal
    v-model:show="showRecoveryModal"
    preset="dialog"
    title="输入恢复代码"
    style="width: 500px"
  >
    <div class="recovery-input">
      <n-form :model="recoveryForm" :rules="recoveryRules">
        <n-form-item label="恢复代码" path="code">
          <n-input
            v-model:value="recoveryForm.code"
            type="password"
            placeholder="请输入恢复代码"
            :maxlength="128"
          />
        </n-form-item>
      </n-form>
      <n-alert type="info" show-icon>
        恢代码是12个单词组成的短语，用于验证您的身份并恢复密钥备份。
      </n-alert>
    </div>
    <template #action>
      <n-button @click="verifyRecoveryCode" type="primary" :loading="isVerifying">
        验证代码
      </n-button>
      <n-button @click="showRecoveryModal = false">取消</n-button>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import {
  NModal,
  NAlert,
  NSpace,
  NCard,
  NInput,
  NForm,
  NFormItem,
  NIcon,
  NSpin,
  NProgress,
  NTag,
  NResult,
  NDescriptions,
  NDescriptionsItem,
  NButton,
  NEmpty,
  NDropdown,
  FormInst
} from 'naive-ui'
import { Download, Key, Share, Copy } from '@vicons/tabler'
import { dlg, msg } from '@/utils/SafeUI'
//
import MoreVertical from '@vicons/tabler/DotsVertical'

import { secureRandomFloat } from '@/utils/secureRandom'

interface Props {
  show: boolean
}

interface BackupForm {
  password: string
  confirmPassword: string
}

interface RecoveryForm {
  code: string
}

// TagColor type literals for Naive UI tags
type SecurityType = 'default' | 'error' | 'info' | 'primary' | 'success' | 'warning'

interface BackupMethod {
  key: string
  icon: string
  title: string
  description: string
  security: {
    type: SecurityType
    label: string
    text: string
  }
}

interface BackupData {
  backupTime: number
  method: string
  deviceCount: number
  keyCount: number
  backupSize: number
  backupId: string
}

interface ExistingBackup {
  id: string
  method: string
  createdAt: number
  status: 'valid' | 'expired'
  deviceCount: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'backup-completed': [options: { success: boolean; exportedKey?: string }]
}>()

const message = msg

// 状态管理
const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const currentStep = ref<'method' | 'password' | 'progress' | 'completed' | 'recovery-code' | 'existing'>('method')
const selectedMethod = ref('')
const isBackingUp = ref(false)
const backupCompleted = ref(false)
const backupProgress = ref(0)
const currentBackupStep = ref('')
const showRecoveryModal = ref(false)
const isVerifying = ref(false)

// 表单数据
const passwordFormRef = ref<FormInst | null>(null)
const backupForm = reactive<BackupForm>({
  password: '',
  confirmPassword: ''
})

const recoveryForm = reactive<RecoveryForm>({
  code: ''
})

// 备份数据
const backupData = ref<BackupData>({
  backupTime: Date.now(),
  method: '',
  deviceCount: 0,
  keyCount: 0,
  backupSize: 0,
  backupId: ''
})

const recoveryCodes = ref<string[]>([])
const existingBackups = ref<ExistingBackup[]>([])

// ========== 计算属性 ==========

const backupStatus = computed(() => {
  if (existingBackups.value.length > 0) {
    return {
      type: 'success' as const,
      title: '密钥已备份',
      description: `您有 ${existingBackups.value.length} 个有效备份，可以创建新备份或管理现有备份。`
    }
  } else {
    return {
      type: 'warning' as const,
      title: '密钥未备份',
      description: '您的加密密钥尚未备份，建议立即创建备份以防止数据丢失。'
    }
  }
})

const progressTitle = computed(() => {
  if (isBackingUp.value) return '正在创建备份'
  if (backupCompleted.value) return '备份创建完成'
  return '备份准备中'
})

const progressDescription = computed(() => {
  if (isBackingUp.value) return '正在加密和上传您的密钥，请稍候...'
  if (backupCompleted.value) return '您的密钥已成功备份并保护'
  return '正在初始化备份流程'
})

const backupMethods: BackupMethod[] = [
  {
    key: 'local',
    icon: '💾',
    title: '本地备份',
    description: '将密钥备份到本地文件，您可以手动保存到安全位置',
    security: {
      type: 'success',
      label: '高安全性',
      text: '完全本地控制'
    }
  },
  {
    key: 'cloud',
    icon: '☁️',
    title: '云端备份',
    description: '将密钥加密后备份到安全的服务器',
    security: {
      type: 'info',
      label: '便捷性',
      text: '自动同步恢复'
    }
  },
  {
    key: 'phrase',
    icon: '🔐',
    title: '恢复短语',
    description: '生成恢复短语，可用于在任何设备上恢复密钥',
    security: {
      type: 'warning',
      label: '需要保管',
      text: '请安全保存'
    }
  }
]

const passwordRules = {
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码至少8个字符', trigger: 'blur' },
    {
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      message: '密码必须包含大小写字母和数字',
      trigger: 'blur'
    }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string) => value === backupForm.password,
      message: '两次输入的密码不一致',
      trigger: 'blur'
    }
  ]
}

const recoveryRules = {
  code: [
    { required: true, message: '请输入恢复代码', trigger: 'blur' },
    { min: 12, message: '恢复代码格式不正确', trigger: 'blur' }
  ]
}

// ========== 方法 ==========

const getMethodName = (method: string): string => {
  const found = backupMethods.find((m) => m.key === method)
  return found?.title || method
}

const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const formatFileSize = (bytes: number): string => {
  const sizes = ['B', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round((bytes / 1024 ** i) * 100) / 100 + ' ' + sizes[i]
}

const getBackupActions = (_backup: ExistingBackup) => [
  {
    label: '查看详情',
    key: 'view',
    icon: () => '👁️'
  },
  {
    label: '恢复密钥',
    key: 'restore',
    icon: () => '🔄'
  },
  {
    label: '删除备份',
    key: 'delete',
    icon: () => '🗑️'
  }
]

// ========== 事件处理 ==========

const startBackup = () => {
  if (selectedMethod.value === 'phrase') {
    currentStep.value = 'progress'
    performPhraseBackup()
  } else {
    currentStep.value = 'password'
  }
}

const validateAndStartBackup = async () => {
  try {
    await passwordFormRef.value?.validate()
    currentStep.value = 'progress'
    performBackup()
  } catch (error) {
    // 验证失败
  }
}

const performBackup = async () => {
  isBackingUp.value = true
  backupProgress.value = 0

  try {
    // 模拟备份步骤
    const steps = [
      { message: '正在收集密钥...', progress: 20 },
      { message: '正在加密数据...', progress: 40 },
      { message: '正在生成备份文件...', progress: 60 },
      { message: '正在上传备份...', progress: 80 },
      { message: '正在验证备份...', progress: 100 }
    ]

    for (const step of steps) {
      currentBackupStep.value = step.message
      backupProgress.value = step.progress
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    // 模拟备份数据
    backupData.value = {
      backupTime: Date.now(),
      method: selectedMethod.value || 'local',
      deviceCount: Math.floor(secureRandomFloat() * 5) + 1,
      keyCount: Math.floor(secureRandomFloat() * 20) + 10,
      backupSize: Math.floor(secureRandomFloat() * 1024 * 1024) + 512 * 1024,
      backupId: `backup_${Date.now()}`
    }

    isBackingUp.value = false
    backupCompleted.value = true
    currentStep.value = 'completed'
  } catch (error) {
    isBackingUp.value = false
    message.error('备份创建失败')
  }
}

const performPhraseBackup = async () => {
  isBackingUp.value = true
  backupProgress.value = 0

  try {
    const steps = [
      { message: '正在生成恢复短语...', progress: 30 },
      { message: '正在关联设备密钥...', progress: 60 },
      { message: '正在验证短语...', progress: 100 }
    ]

    for (const step of steps) {
      currentBackupStep.value = step.message
      backupProgress.value = step.progress
      await new Promise((resolve) => setTimeout(resolve, 800))
    }

    // 生成恢复代码
    const words = [
      'Apple',
      'Banana',
      'Cherry',
      'Dragon',
      'Elephant',
      'Forest',
      'Garden',
      'House',
      'Island',
      'Jungle',
      'Kitten',
      'Lemon',
      'Mountain',
      'Nature',
      'Ocean',
      'Piano',
      'Queen',
      'Rainbow',
      'Sunset',
      'Tiger',
      'Universe',
      'Valley',
      'Water',
      'Yellow'
    ]
    recoveryCodes.value = Array.from({ length: 12 }, (): string => {
      const randomIndex = Math.floor(Math.random() * (words?.length || 0))
      return words?.[randomIndex] || 'Default'
    })

    backupData.value = {
      backupTime: Date.now(),
      method: selectedMethod.value || 'phrase',
      deviceCount: Math.floor(secureRandomFloat() * 5) + 1,
      keyCount: Math.floor(secureRandomFloat() * 20) + 10,
      backupSize: Math.floor(secureRandomFloat() * 1024 * 1024) + 512 * 1024,
      backupId: `phrase_backup_${Date.now()}`
    }

    isBackingUp.value = false
    backupCompleted.value = true
    currentStep.value = 'completed'
  } catch (error) {
    isBackingUp.value = false
    message.error('恢复短语生成失败')
  }
}

const downloadBackup = () => {
  const backupContent = JSON.stringify(backupData.value, null, 2)
  const blob = new Blob([backupContent], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `key-backup-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  message.success('备份文件已下载')
}

const showVerificationCode = () => {
  currentStep.value = 'recovery-code'
}

const shareBackup = async () => {
  try {
    if (navigator.share) {
      await navigator.share({
        title: '密钥备份',
        text: '我已经创建了密钥备份，请帮我保存恢复代码。'
      })
    } else {
      message.info('请手动分享恢复代码给可信任的人')
    }
  } catch (error) {
    message.error('分享失败')
  }
}

const copyRecoveryCode = async () => {
  try {
    const code = recoveryCodes.value.join(' ')
    await navigator.clipboard.writeText(code)
    message.success('恢复代码已复制到剪贴板')
  } catch (error) {
    message.error('复制失败')
  }
}

const downloadRecoveryCode = () => {
  const codeContent = `FoxChat 密钥恢复代码\n生成时间: ${formatTimestamp(Date.now())}\n\n恢复代码:\n${recoveryCodes.value.join(' ')}`
  const blob = new Blob([codeContent], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `recovery-code-${new Date().toISOString().split('T')[0]}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  message.success('恢复代码已下载')
}

const printRecoveryCode = () => {
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head>
          <title>FoxChat 恢复代码</title>
          <style>
            body { font-family: monospace; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .code { font-size: 18px; line-height: 1.8; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>FoxChat 密钥恢复代码</h1>
            <p>生成时间: ${formatTimestamp(Date.now())}</p>
          </div>
          <div class="code">
            ${recoveryCodes.value.join(' ')}
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }
}

const verifyRecoveryCode = async () => {
  isVerifying.value = true
  try {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    message.success('恢复代码验证成功')
    showRecoveryModal.value = false
  } catch (error) {
    message.error('恢复代码验证失败')
  } finally {
    isVerifying.value = false
  }
}

const handleBackupAction = async (action: string, backup: ExistingBackup) => {
  switch (action) {
    case 'view':
      message.info(`查看备份详情: ${backup.method}`)
      break
    case 'restore':
      message.info(`开始恢复备份: ${backup.method}`)
      break
    case 'delete':
      dlg.warning({
        title: '确认删除',
        content: '确定要删除此备份吗？此操作不可撤销。',
        onPositiveClick: () => {
          message.success('备份已删除')
          loadExistingBackups()
        }
      })
      break
  }
}

const handleCancel = () => {
  if (currentStep.value === 'method') {
    showDialog.value = false
  } else {
    currentStep.value = 'existing'
  }
}

//

const loadExistingBackups = () => {
  // 模拟加载现有备份
  existingBackups.value = []
}

// ========== 生命周期 ==========

onMounted(() => {
  loadExistingBackups()
})
</script>

<style lang="scss" scoped>
.key-backup-dialog {
  .backup-overview {
    margin-bottom: 20px;
  }

  .backup-methods {
    h4 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-1);
    }

    .method-card {
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        transform: translateY(-2px);
      }

      &.method-selected {
        border-color: var(--primary-color);
        box-shadow: 0 0 0 2px rgba(24, 160, 88, 0.2);
      }

      .method-content {
        display: flex;
        align-items: flex-start;
        gap: 16px;

        .method-icon {
          font-size: 32px;
          flex-shrink: 0;
        }

        .method-info {
          flex: 1;

          .method-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-color-1);
            margin-bottom: 8px;
          }

          .method-description {
            font-size: 14px;
            color: var(--text-color-2);
            line-height: 1.5;
            margin-bottom: 12px;
          }

          .method-security {
            display: flex;
            align-items: center;
            gap: 8px;

            .security-text {
              font-size: 12px;
              color: var(--text-color-3);
            }
          }
        }
      }
    }
  }

  .password-setup {
    h4 {
      margin: 0 0 20px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-1);
    }

    .password-tips {
      ul {
        margin: 8px 0 0 0;
        padding-left: 20px;

        li {
          margin-bottom: 4px;
          font-size: 14px;
          color: var(--text-color-2);
        }
      }
    }
  }

  .backup-progress {
    .progress-content {
      display: flex;
      align-items: flex-start;
      gap: 20px;
      padding: 20px 0;

      .progress-icon {
        flex-shrink: 0;
      }

      .progress-info {
        flex: 1;

        h4 {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-color-1);
        }

        p {
          margin: 0 0 16px 0;
          color: var(--text-color-2);
        }

        .progress-details {
          margin-top: 12px;
        }
      }
    }
  }

  .backup-completed {
    .backup-summary {
      margin: 20px 0;
    }

    .backup-actions {
      margin-top: 20px;
    }
  }

  .recovery-code {
    .code-content {
      h4 {
        margin: 0 0 16px 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-color-1);
      }

      .code-warning {
        margin-bottom: 20px;
      }

      .code-display {
        .code-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 20px;

          .code-item {
            padding: 12px;
            background: var(--card-color);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            text-align: center;
            font-family: monospace;
            font-size: 14px;
            font-weight: 600;
            color: var(--text-color-1);
          }
        }
      }

      .code-actions {
        display: flex;
        justify-content: center;
      }
    }
  }

  .existing-backup {
    .existing-content {
      h4 {
        margin: 0 0 16px 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-color-1);
      }

      .no-backup {
        text-align: center;
        padding: 40px 0;
      }

      .backup-list {
        .backup-item {
          margin-bottom: 12px;

          .backup-item-content {
            display: flex;
            align-items: center;
            justify-content: space-between;

            .backup-info {
              flex: 1;

              .backup-title {
                font-weight: 600;
                color: var(--text-color-1);
                margin-bottom: 4px;
              }

              .backup-meta {
                display: flex;
                align-items: center;
                gap: 12px;
                font-size: 12px;
                color: var(--text-color-3);
              }
            }
          }
        }
      }
    }
  }
}

.recovery-input {
  margin-bottom: 20px;
}

// 响应式设计
@media (max-width: 768px) {
  .key-backup-dialog {
    .method-content {
      flex-direction: column;
      gap: 12px;
    }

    .code-grid {
      grid-template-columns: repeat(2, 1fr) !important;
    }

    .progress-content {
      flex-direction: column;
      gap: 16px;
      text-align: center;
    }
  }
}
</style>
