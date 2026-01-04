<template>
  <n-modal
    v-model:show="showDialog"
    :mask-closable="false"
    preset="dialog"
    title="添加新设备"
    style="width: 600px"
  >
    <div class="add-device-dialog">
      <!-- 添加方式选择 -->
      <div class="method-selection" v-if="currentStep === 'method'">
        <h4>选择添加方式</h4>
        <n-radio-group v-model:value="addMethod" name="addMethod">
          <n-space vertical size="large">
            <n-radio value="qr" size="large">
              <div class="method-option">
                <div class="method-icon">📱</div>
                <div class="method-details">
                  <div class="method-title">扫描二维码</div>
                  <div class="method-description">使用新设备扫描二维码进行配对</div>
                </div>
              </div>
            </n-radio>
            <n-radio value="link" size="large">
              <div class="method-option">
                <div class="method-icon">🔗</div>
                <div class="method-details">
                  <div class="method-title">分享链接</div>
                  <div class="method-description">生成链接发送给新设备进行验证</div>
                </div>
              </div>
            </n-radio>
            <n-radio value="phrase" size="large">
              <div class="method-option">
                <div class="method-icon">🔐</div>
                <div class="method-details">
                  <div class="method-title">验证短语</div>
                  <div class="method-description">手动输入验证短语完成设备添加</div>
                </div>
              </div>
            </n-radio>
          </n-space>
        </n-radio-group>
      </div>

      <!-- 二维码扫描 -->
      <div class="qr-scanning" v-if="currentStep === 'qr'">
        <div class="qr-content">
          <div class="qr-code">
            <n-spin v-if="isGeneratingQR" size="large">
              <div style="width: 200px; height: 200px;"></div>
            </n-spin>
            <div v-else-if="qrCodeUrl" class="qr-image">
              <img :src="qrCodeUrl" alt="设备配对二维码" />
            </div>
            <div v-else class="qr-error">
              <n-result status="error" title="生成失败" description="无法生成配对二维码">
                <template #footer>
                  <n-button @click="generateQRCode">重新生成</n-button>
                </template>
              </n-result>
            </div>
          </div>
          <div class="qr-instructions">
            <h4>扫描说明</h4>
            <ol>
              <li>在新设备上打开应用</li>
              <li>进入"设置" → "设备管理" → "添加设备"</li>
              <li>选择"扫描二维码"选项</li>
              <li>扫描上方二维码完成配对</li>
            </ol>
            <div class="qr-status">
              <n-tag v-if="isWaitingForDevice" type="info" size="small">等待设备扫描...</n-tag>
              <n-tag v-else-if="hasConnectedDevice" type="success" size="small">设备已连接</n-tag>
            </div>
          </div>
        </div>
        <div class="qr-actions">
          <n-button @click="refreshQRCode" :loading="isGeneratingQR">
            <template #icon>
              <n-icon><Refresh /></n-icon>
            </template>
            刷新二维码
          </n-button>
          <n-button @click="cancelAdding">取消</n-button>
        </div>
      </div>

      <!-- 链接分享 -->
      <div class="link-sharing" v-if="currentStep === 'link'">
        <div class="link-content">
          <div class="link-generation">
            <n-spin v-if="isGeneratingLink" size="large">
              <div style="width: 100%; height: 60px;"></div>
            </n-spin>
            <div v-else-if="sharingLink" class="link-display">
              <n-input
                v-model:value="sharingLink"
                readonly
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 4 }"
                placeholder="生成的分享链接"
              />
              <div class="link-actions">
                <n-button @click="copyLink" type="primary" size="small">
                  <template #icon>
                    <n-icon><Copy /></n-icon>
                  </template>
                  复制链接
                </n-button>
                <n-button @click="shareLink" size="small">
                  <template #icon>
                    <n-icon><Share /></n-icon>
                  </template>
                  分享链接
                </n-button>
              </div>
            </div>
          </div>
          <div class="link-instructions">
            <h4>使用说明</h4>
            <ol>
              <li>复制上方链接或直接分享</li>
              <li>在新设备上打开链接</li>
              <li>按照页面指示完成设备验证</li>
              <li>验证成功后设备将自动添加</li>
            </ol>
            <div class="link-status">
              <n-tag v-if="isWaitingForLink" type="info" size="small">等待设备验证...</n-tag>
              <n-tag v-else-if="hasLinkDevice" type="success" size="small">设备已验证</n-tag>
            </div>
          </div>
        </div>
        <div class="link-actions-bottom">
          <n-button @click="generateNewLink" :loading="isGeneratingLink">
            <template #icon>
              <n-icon><Refresh /></n-icon>
            </template>
            生成新链接
          </n-button>
          <n-button @click="cancelAdding">取消</n-button>
        </div>
      </div>

      <!-- 验证短语 -->
      <div class="phrase-verification" v-if="currentStep === 'phrase'">
        <div class="phrase-content">
          <div class="phrase-display">
            <h4>验证短语</h4>
            <div class="phrase-box">
              <n-spin v-if="isGeneratingPhrase" size="large">
                <div style="width: 100%; height: 60px;"></div>
              </n-spin>
              <div v-else-if="verificationPhrase" class="phrase-text">
                {{ verificationPhrase }}
              </div>
            </div>
            <div class="phrase-actions">
              <n-button @click="generateNewPhrase" :loading="isGeneratingPhrase" size="small">
                <template #icon>
                  <n-icon><Refresh /></n-icon>
                </template>
                生成新短语
              </n-button>
              <n-button @click="copyPhrase" size="small">
                <template #icon>
                  <n-icon><Copy /></n-icon>
                </template>
                复制短语
              </n-button>
            </div>
          </div>
          <div class="phrase-instructions">
            <h4>验证步骤</h4>
            <ol>
              <li>将上方验证短语发送给新设备用户</li>
              <li>新设备用户在应用中输入该短语</li>
              <li>系统自动验证短语匹配性</li>
              <li>验证成功后设备将自动添加</li>
            </ol>
            <div class="phrase-status">
              <n-tag v-if="isWaitingForPhrase" type="info" size="small">等待短语验证...</n-tag>
              <n-tag v-else-if="hasPhraseDevice" type="success" size="small">设备已验证</n-tag>
            </div>
          </div>
        </div>
        <div class="phrase-actions-bottom">
          <n-button @click="cancelAdding">取消</n-button>
        </div>
      </div>

      <!-- 设备确认 -->
      <div class="device-confirmation" v-if="currentStep === 'confirmation'">
        <div class="confirmation-content">
          <div class="device-preview">
            <n-avatar
              v-bind="createStrictAvatarProps({
                src: pendingDevice.avatar || null,
                size: 64,
                round: true
              })"
            >{{ pendingDevice.displayName?.charAt(0) || 'D' }}</n-avatar>
            <div class="device-info">
              <h4>{{ pendingDevice.displayName || pendingDevice.deviceId }}</h4>
              <p class="device-id">{{ pendingDevice.deviceId }}</p>
              <p class="device-type">{{ getDeviceType(pendingDevice.deviceId) }}</p>
            </div>
          </div>
          <div class="verification-summary">
            <h4>验证信息</h4>
            <n-descriptions :column="1" size="small">
              <n-descriptions-item label="验证方式">
                {{ getMethodName(addMethod) }}
              </n-descriptions-item>
              <n-descriptions-item label="验证时间">
                {{ formatTimestamp(verificationTime) }}
              </n-descriptions-item>
              <n-descriptions-item label="设备状态">
                <n-tag type="success" size="small">已验证</n-tag>
              </n-descriptions-item>
            </n-descriptions>
          </div>
          <div class="device-settings">
            <h4>设备设置</h4>
            <n-form :model="deviceSettings" label-placement="left" label-width="120">
              <n-form-item label="设备名称">
                <n-input v-model:value="deviceSettings.displayName" placeholder="为设备设置一个友好的名称" />
              </n-form-item>
              <n-form-item label="自动验证">
                <n-switch v-model:value="deviceSettings.autoVerify" />
                <template #feedback>
                  <n-text depth="3" style="font-size: 12px;">
                    自动验证来自此设备的消息
                  </n-text>
                </template>
              </n-form-item>
              <n-form-item label="共享历史消息">
                <n-switch v-model:value="deviceSettings.shareHistory" />
                <template #feedback>
                  <n-text depth="3" style="font-size: 12px;">
                    与新设备共享历史消息记录
                  </n-text>
                </template>
              </n-form-item>
            </n-form>
          </div>
        </div>
      </div>
    </div>

    <template #action>
      <div class="dialog-actions">
        <n-button v-if="currentStep === 'method'" @click="startAdding" type="primary" :disabled="!addMethod">
          开始添加
        </n-button>
        <n-button v-if="currentStep === 'confirmation'" @click="confirmAddDevice" type="primary" :loading="isConfirming">
          确认添加
        </n-button>
        <n-button @click="handleCancel">取消</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { TIME_INTERVALS } from '@/constants'
import { ref, computed } from 'vue'
import {
  NModal,
  NRadioGroup,
  NRadio,
  NSpace,
  NButton,
  NIcon,
  NSpin,
  NTag,
  NResult,
  NInput,
  NDescriptions,
  NDescriptionsItem,
  NAvatar,
  NText,
  NForm,
  NFormItem,
  NSwitch
} from 'naive-ui'

import type { Device } from '@/stores/core/index'
import { createStrictAvatarProps } from '@/utils/naive-types'
import { msg } from '@/utils/SafeUI'

interface Props {
  show: boolean
}

interface DeviceSettings {
  displayName: string
  autoVerify: boolean
  shareHistory: boolean
}

interface PendingDevice extends Device {
  verificationMethod: string
  verificationTime: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'device-added': [device: Device]
}>()

const message = msg

// 状态管理
const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const currentStep = ref<'method' | 'qr' | 'link' | 'phrase' | 'confirmation'>('method')
const addMethod = ref<'qr' | 'link' | 'phrase'>('qr')
const isGeneratingQR = ref(false)
const isGeneratingLink = ref(false)
const isGeneratingPhrase = ref(false)
const isWaitingForDevice = ref(false)
const isWaitingForLink = ref(false)
const isWaitingForPhrase = ref(false)
const hasConnectedDevice = ref(false)
const hasLinkDevice = ref(false)
const hasPhraseDevice = ref(false)
const isConfirming = ref(false)

// 生成的数据
const qrCodeUrl = ref('')
const sharingLink = ref('')
const verificationPhrase = ref('')
const verificationTime = ref(Date.now())

// 待确认设备
const pendingDevice = ref<PendingDevice>({
  deviceId: '',
  displayName: '',
  userId: '',
  keys: {},
  algorithms: [],
  verified: false,
  blocked: false,
  verificationMethod: '',
  verificationTime: Date.now()
})

const deviceSettings = ref<DeviceSettings>({
  displayName: '',
  autoVerify: true,
  shareHistory: false
})

// ========== 方法 ==========

const getDeviceType = (deviceId: string): string => {
  if (deviceId.includes('DESKTOP')) return '桌面设备'
  if (deviceId.includes('MOBILE')) return '移动设备'
  if (deviceId.includes('WEB')) return 'Web设备'
  if (deviceId.includes('BOT')) return '机器人'
  return '未知设备'
}

const getMethodName = (method: string): string => {
  switch (method) {
    case 'qr':
      return '二维码扫描'
    case 'link':
      return '链接分享'
    case 'phrase':
      return '验证短语'
    default:
      return '未知方式'
  }
}

const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

// ========== 事件处理 ==========

const startAdding = () => {
  currentStep.value = addMethod.value

  switch (addMethod.value) {
    case 'qr':
      generateQRCode()
      break
    case 'link':
      generateSharingLink()
      break
    case 'phrase':
      generateVerificationPhrase()
      break
  }
}

const generateQRCode = async () => {
  isGeneratingQR.value = true
  isWaitingForDevice.value = true

  try {
    // 模拟生成二维码
    await new Promise((resolve) => setTimeout(resolve, 2000))
    qrCodeUrl.value = `data:image/png;base64,${Buffer.from('mock-qr-code-data').toString('base64')}`

    // 模拟等待设备连接
    setTimeout(() => {}, TIME_INTERVALS.TOAST_DURATION)
  } catch (error) {
    message.error('生成二维码失败')
  } finally {
    isGeneratingQR.value = false
  }
}

const generateSharingLink = async () => {
  isGeneratingLink.value = true
  isWaitingForLink.value = true

  try {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    sharingLink.value = `https://foxchat.app/device-verify/${Math.random().toString(36).substring(2, 15)}`

    // 模拟等待设备验证
    setTimeout(() => {
      hasLinkDevice.value = true
      simulateDeviceConnection()
    }, 4000)
  } catch (error) {
    message.error('生成分享链接失败')
  } finally {
    isGeneratingLink.value = false
  }
}

const generateVerificationPhrase = async () => {
  isGeneratingPhrase.value = true
  isWaitingForPhrase.value = true

  try {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const words = ['Apple', 'Banana', 'Cherry', 'Dragon', 'Elephant', 'Forest', 'Garden', 'House']
    verificationPhrase.value = words
      .sort(() => Math.random() - 0.5)
      .slice(0, 4)
      .join('-')

    // 模拟等待短语验证
    setTimeout(() => {}, TIME_INTERVALS.MESSAGE_RETRY_DELAY)
  } catch (error) {
    message.error('生成验证短语失败')
  } finally {
    isGeneratingPhrase.value = false
  }
}

const simulateDeviceConnection = () => {
  // 模拟设备连接数据
  pendingDevice.value = {
    deviceId: `DEVICE_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    displayName: `${getDeviceType(pendingDevice.value.deviceId)} - ${new Date().toLocaleDateString()}`,
    userId: 'current-user-id',
    keys: {
      ed25519: 'mock-ed25519-key',
      curve25519: 'mock-curve25519-key'
    },
    algorithms: ['m.olm.v1.curve25519-aes-sha2', 'm.megolm.v1.aes-sha2'],
    verified: true,
    blocked: false,
    verificationMethod: addMethod.value,
    verificationTime: Date.now()
  }

  deviceSettings.value.displayName = pendingDevice.value.displayName

  setTimeout(() => {
    currentStep.value = 'confirmation'
  }, 1000)
}

const confirmAddDevice = async () => {
  isConfirming.value = true

  try {
    // 应用设备设置
    const finalDevice: Device = {
      ...pendingDevice.value,
      displayName: deviceSettings.value.displayName || pendingDevice.value.displayName
    }

    await new Promise((resolve) => setTimeout(resolve, 1500))

    emit('device-added', finalDevice)
    message.success('设备添加成功')
    resetDialog()
  } catch (error) {
    message.error('添加设备失败')
  } finally {
    isConfirming.value = false
  }
}

const cancelAdding = () => {
  currentStep.value = 'method'
  resetDialog()
}

const handleCancel = () => {
  resetDialog()
}

const resetDialog = () => {
  currentStep.value = 'method'
  addMethod.value = 'qr'
  qrCodeUrl.value = ''
  sharingLink.value = ''
  verificationPhrase.value = ''
  isWaitingForDevice.value = false
  isWaitingForLink.value = false
  isWaitingForPhrase.value = false
  hasConnectedDevice.value = false
  hasLinkDevice.value = false
  hasPhraseDevice.value = false

  deviceSettings.value = {
    displayName: '',
    autoVerify: true,
    shareHistory: false
  }
}

const refreshQRCode = () => {
  qrCodeUrl.value = ''
  hasConnectedDevice.value = false
  generateQRCode()
}

const generateNewLink = () => {
  sharingLink.value = ''
  hasLinkDevice.value = false
  generateSharingLink()
}

const generateNewPhrase = () => {
  verificationPhrase.value = ''
  hasPhraseDevice.value = false
  generateVerificationPhrase()
}

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(sharingLink.value)
    message.success('链接已复制到剪贴板')
  } catch (error) {
    message.error('复制失败')
  }
}

const copyPhrase = async () => {
  try {
    await navigator.clipboard.writeText(verificationPhrase.value)
    message.success('验证短语已复制到剪贴板')
  } catch (error) {
    message.error('复制失败')
  }
}

const shareLink = async () => {
  try {
    if (navigator.share) {
      await navigator.share({
        title: '设备验证链接',
        text: '点击此链接完成设备验证',
        url: sharingLink.value
      })
    } else {
      await copyLink()
      message.success('链接已复制，您可以手动分享')
    }
  } catch (error) {
    message.error('分享失败')
  }
}
</script>

<style lang="scss" scoped>
.add-device-dialog {
  min-height: 400px;

  .method-selection {
    h4 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-1);
    }

    .method-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      transition: all 0.2s ease;

      &:hover {
        background: var(--bg-color-hover);
      }

      .method-icon {
        font-size: 24px;
      }

      .method-details {
        .method-title {
          font-weight: 600;
          color: var(--text-color-1);
          margin-bottom: 4px;
        }

        .method-description {
          font-size: 14px;
          color: var(--text-color-3);
        }
      }
    }
  }

  .qr-scanning, .link-sharing, .phrase-verification {
    .qr-content, .link-content, .phrase-content {
      display: flex;
      gap: 24px;
      margin-bottom: 20px;

      .qr-code, .link-generation, .phrase-display {
        flex-shrink: 0;

        .qr-image {
          width: 200px;
          height: 200px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;

          img {
            max-width: 100%;
            max-height: 100%;
          }
        }

        .qr-error {
          width: 200px;
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .link-display {
          width: 300px;
        }

        .phrase-box {
          width: 300px;
          padding: 16px;
          background: var(--card-color);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          text-align: center;

          .phrase-text {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-color-1);
            letter-spacing: 1px;
            font-family: monospace;
          }
        }

        .link-actions, .phrase-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
      }

      .qr-instructions, .link-instructions, .phrase-instructions {
        flex: 1;

        h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-color-1);
        }

        ol {
          margin: 0 0 16px 0;
          padding-left: 20px;

          li {
            margin-bottom: 8px;
            color: var(--text-color-2);
          }
        }

        .qr-status, .link-status, .phrase-status {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }
    }

    .qr-actions, .link-actions-bottom, .phrase-actions-bottom {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid var(--border-color);
    }
  }

  .device-confirmation {
    .confirmation-content {
      .device-preview {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background: var(--card-color);
        border-radius: 8px;
        margin-bottom: 20px;

        .device-info {
          h4 {
            margin: 0 0 4px 0;
            font-size: 16px;
            font-weight: 600;
            color: var(--text-color-1);
          }

          .device-id {
            margin: 0 0 4px 0;
            font-size: 12px;
            color: var(--text-color-3);
            font-family: monospace;
          }

          .device-type {
            margin: 0;
            font-size: 14px;
            color: var(--text-color-2);
          }
        }
      }

      .verification-summary, .device-settings {
        margin-bottom: 20px;

        h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-color-1);
        }
      }
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .add-device-dialog {
    .qr-content, .link-content, .phrase-content {
      flex-direction: column;
      gap: 16px;

      .qr-code, .link-generation, .phrase-display {
        align-self: center;
      }
    }
  }
}
</style>