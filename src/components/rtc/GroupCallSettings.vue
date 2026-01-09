<template>
  <div class="group-call-settings">
    <div class="settings-header">
      <h3>群组通话设置</h3>
      <n-button quaternary circle @click="$emit('closed')">
        <template #icon>
          <n-icon><X /></n-icon>
        </template>
      </n-button>
    </div>

    <div class="settings-content">
      <!-- 主持人设置 -->
      <div class="settings-section">
        <h4>主持人设置</h4>

        <div class="setting-item">
          <label>参与者权限</label>
          <div class="permission-settings">
            <div class="permission-item">
              <n-switch
                v-model:value="hostSettings.allowParticipantsToUnmute"
                @update:value="updatePermissionSettings"
              >
                <template #checked>允许</template>
                <template #unchecked>禁止</template>
              </n-switch>
              <span class="permission-label">允许参与者自行解除静音</span>
            </div>
            <div class="permission-item">
              <n-switch
                v-model:value="hostSettings.allowParticipantsToStartVideo"
                @update:value="updatePermissionSettings"
              >
                <template #checked>允许</template>
                <template #unchecked>禁止</template>
              </n-switch>
              <span class="permission-label">允许参与者开启摄像头</span>
            </div>
            <div class="permission-item">
              <n-switch
                v-model:value="hostSettings.allowParticipantsToShare"
                @update:value="updatePermissionSettings"
              >
                <template #checked>允许</template>
                <template #unchecked>禁止</template>
              </n-switch>
              <span class="permission-label">允许参与者共享屏幕</span>
            </div>
            <div class="permission-item">
              <n-switch
                v-model:value="hostSettings.allowParticipantsToRecord"
                @update:value="updatePermissionSettings"
              >
                <template #checked>允许</template>
                <template #unchecked>禁止</template>
              </n-switch>
              <span class="permission-label">允许参与者录制</span>
            </div>
          </div>
        </div>

        <div class="setting-item">
          <label>入场设置</label>
          <div class="admission-settings">
            <n-radio-group v-model:value="hostSettings.admissionMode" @update:value="updateAdmissionMode">
              <n-radio value="open">自由加入</n-radio>
              <n-radio value="approval">需要批准</n-radio>
              <n-radio value="waiting">等候室</n-radio>
            </n-radio-group>
            <div class="setting-description">
              选择参与者加入群组通话的方式
            </div>
          </div>
        </div>

        <div class="setting-item">
          <label>最大参与人数</label>
          <n-input-number
            v-model:value="hostSettings.maxParticipants"
            :min="2"
            :max="100"
            @update:value="updateMaxParticipants"
          />
          <div class="setting-description">
            设置群组通话的最大参与人数限制
          </div>
        </div>
      </div>

      <!-- 音频设置 -->
      <div class="settings-section">
        <h4>音频设置</h4>

        <div class="setting-item">
          <label>默认音频状态</label>
          <n-radio-group v-model:value="audioSettings.defaultState" @update:value="updateAudioSettings">
            <n-radio value="unmuted">加入时开启麦克风</n-radio>
            <n-radio value="muted">加入时静音</n-radio>
            <n-radio value="host-controlled">主持人控制</n-radio>
          </n-radio-group>
        </div>

        <div class="setting-item">
          <label>音频质量</label>
          <n-select
            v-model:value="audioSettings.quality"
            :options="audioQualityOptions"
            @update:value="updateAudioQuality"
          />
          <div class="setting-description">
            更高的质量需要更多的网络带宽
          </div>
        </div>

        <div class="setting-item">
          <label>背景噪音抑制</label>
          <n-select
            v-model:value="audioSettings.noiseSuppression"
            :options="noiseSuppressionOptions"
            @update:value="updateNoiseSuppression"
          />
        </div>
      </div>

      <!-- 视频设置 -->
      <div class="settings-section" v-if="callType === 'video'">
        <h4>视频设置</h4>

        <div class="setting-item">
          <label>默认视频状态</label>
          <n-radio-group v-model:value="videoSettings.defaultState" @update:value="updateVideoSettings">
            <n-radio value="on">加入时开启摄像头</n-radio>
            <n-radio value="off">加入时关闭摄像头</n-radio>
            <n-radio value="host-controlled">主持人控制</n-radio>
          </n-radio-group>
        </div>

        <div class="setting-item">
          <label>视频布局</label>
          <n-select
            v-model:value="videoSettings.layout"
            :options="layoutOptions"
            @update:value="updateVideoLayout"
          />
          <div class="setting-description">
            选择视频通话的布局方式
          </div>
        </div>

        <div class="setting-item">
          <label>发言人视图</label>
          <n-switch
            v-model:value="videoSettings.speakerView"
            @update:value="toggleSpeakerView"
          >
            <template #checked>启用</template>
          </n-switch>
          <div class="setting-description">
            自动放大当前发言人的视频画面
          </div>
        </div>

        <div class="setting-item">
          <label>虚拟背景</label>
          <n-switch
            v-model:value="videoSettings.virtualBackground"
            @update:value="toggleVirtualBackground"
          >
            <template #checked>启用</template>
          </n-switch>
          <div v-if="videoSettings.virtualBackground" class="background-options">
            <div class="background-presets">
              <div
                v-for="bg in backgroundPresets"
                :key="bg.id"
                class="background-preset"
                :class="{ active: selectedBackground === bg.id }"
                @click="selectBackground(bg.id)"
              >
                <img v-if="bg.type === 'image'" :src="bg.url" :alt="bg.name" />
                <div v-else-if="bg.type === 'color'" class="color-preview" :style="{ backgroundColor: bg.value }"></div>
                <div v-else class="blur-preview">
                  <n-icon><Blur /></n-icon>
                </div>
                <span class="preset-name">{{ bg.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 录制设置 -->
      <div class="settings-section">
        <h4>录制设置</h4>

        <div class="setting-item">
          <label>自动录制</label>
          <n-switch
            v-model:value="recordingSettings.autoRecord"
            @update:value="updateRecordingSettings"
          >
            <template #checked>启用</template>
          </n-switch>
          <div class="setting-description">
            通话开始时自动开始录制
          </div>
        </div>

        <div class="setting-item">
          <label>录制格式</label>
          <n-select
            v-model:value="recordingSettings.format"
            :options="recordingFormatOptions"
            @update:value="updateRecordingFormat"
          />
        </div>

        <div class="setting-item">
          <label>录制质量</label>
          <n-select
            v-model:value="recordingSettings.quality"
            :options="recordingQualityOptions"
            @update:value="updateRecordingQuality"
          />
        </div>

        <div class="setting-item">
          <label>录制存储位置</label>
          <n-select
            v-model:value="recordingSettings.storage"
            :options="storageOptions"
            @update:value="updateRecordingStorage"
          />
        </div>
      </div>

      <!-- 安全设置 -->
      <div class="settings-section">
        <h4>安全设置</h4>

        <div class="setting-item">
          <label>等候室密码</label>
          <n-input
            v-model:value="securitySettings.waitingRoomPassword"
            type="password"
            placeholder="设置等候室密码（可选）"
            @update:value="updateSecuritySettings"
          />
          <div class="setting-description">
            参与者需要输入密码才能进入等候室
          </div>
        </div>

        <div class="setting-item">
          <label>端到端加密</label>
          <n-switch
            v-model:value="securitySettings.endToEndEncryption"
            @update:value="updateSecuritySettings"
          >
            <template #checked>启用</template>
          </n-switch>
          <div class="setting-description">
            启用端到端加密以确保通话内容隐私
          </div>
        </div>

        <div class="setting-item">
          <label>锁定通话</label>
          <n-button
            :type="isCallLocked ? 'error' : 'default'"
            @click="toggleCallLock"
          >
            <template #icon>
              <n-icon>
                <Lock v-if="isCallLocked" />
                <LockOpen v-else />
              </n-icon>
            </template>
            {{ isCallLocked ? '解锁通话' : '锁定通话' }}
          </n-button>
          <div class="setting-description">
            锁定后新成员无法加入通话
          </div>
        </div>
      </div>

      <!-- 高级设置 -->
      <div class="settings-section">
        <h4>高级设置</h4>

        <div class="setting-item">
          <label>网络优化</label>
          <div class="network-settings">
          <n-switch
            v-model:value="advancedSettings.adaptiveBitrate"
            @update:value="updateAdvancedSettings"
          >
            <template #checked>启用</template>
          </n-switch>
            <span class="setting-label">自适应码率</span>
          </div>
          <div class="network-settings">
          <n-switch
            v-model:value="advancedSettings.lowLatencyMode"
            @update:value="updateAdvancedSettings"
          >
            <template #checked>启用</template>
          </n-switch>
            <span class="setting-label">低延迟模式</span>
          </div>
        </div>

        <div class="setting-item">
          <label>数据统计</label>
          <div class="stats-display">
            <div class="stat-item">
              <span class="stat-label">当前带宽使用:</span>
              <span class="stat-value">{{ formatBytes(currentStats.bandwidthUsage) }}/s</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">总数据传输:</span>
              <span class="stat-value">{{ formatBytes(currentStats.totalDataTransferred) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">CPU 使用率:</span>
              <span class="stat-value">{{ currentStats.cpuUsage }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-footer">
      <n-space>
        <n-button @click="resetToDefaults">
          重置默认
        </n-button>
        <n-button type="primary" @click="saveSettings">
          保存设置
        </n-button>
      </n-space>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NButton, NIcon, NSwitch, NRadioGroup, NRadio, NInputNumber, NSelect, NInput, NSpace } from 'naive-ui'
import { X, Lock, LockOpen, Blur } from '@vicons/tabler'
import type { MediaStream } from '@/types/rtc'

import { msg } from '@/utils/SafeUI'

import { secureRandomFloat } from '@/utils/secureRandom'

interface Props {
  callType: 'audio' | 'video'
  localStream?: MediaStream | null
}

defineProps<Props>()

const emit = defineEmits<{
  closed: []
}>()

const message = msg

// 主持人设置
const hostSettings = ref({
  allowParticipantsToUnmute: true,
  allowParticipantsToStartVideo: true,
  allowParticipantsToShare: false,
  allowParticipantsToRecord: false,
  admissionMode: 'open',
  maxParticipants: 50
})

// 音频设置
const audioSettings = ref({
  defaultState: 'muted',
  quality: 'standard',
  noiseSuppression: 'medium'
})

// 视频设置
const videoSettings = ref({
  defaultState: 'off',
  layout: 'grid',
  speakerView: true,
  virtualBackground: false
})

// 录制设置
const recordingSettings = ref({
  autoRecord: false,
  format: 'webm',
  quality: '720p',
  storage: 'local'
})

// 安全设置
const securitySettings = ref({
  waitingRoomPassword: '',
  endToEndEncryption: false
})

// 高级设置
const advancedSettings = ref({
  adaptiveBitrate: true,
  lowLatencyMode: false
})

// 状态
const isCallLocked = ref(false)
const selectedBackground = ref('none')

// 选项
const audioQualityOptions = [
  { label: '低质量 (节省带宽)', value: 'low' },
  { label: '标准质量', value: 'standard' },
  { label: '高质量', value: 'high' }
]

const noiseSuppressionOptions = [
  { label: '关闭', value: 'off' },
  { label: '轻度', value: 'light' },
  { label: '中度', value: 'medium' },
  { label: '强度', value: 'aggressive' }
]

const layoutOptions = [
  { label: '网格布局', value: 'grid' },
  { label: '发言人视图', value: 'speaker' },
  { label: '画廊视图', value: 'gallery' },
  { label: '自定义', value: 'custom' }
]

const recordingFormatOptions = [
  { label: 'WebM', value: 'webm' },
  { label: 'MP4', value: 'mp4' },
  { label: 'MOV', value: 'mov' }
]

const recordingQualityOptions = [
  { label: '360p', value: '360p' },
  { label: '480p', value: '480p' },
  { label: '720p', value: '720p' },
  { label: '1080p', value: '1080p' }
]

const storageOptions = [
  { label: '本地存储', value: 'local' },
  { label: '云端存储', value: 'cloud' },
  { label: '混合存储', value: 'hybrid' }
]

const backgroundPresets = ref([
  { id: 'none', name: '无背景', type: 'color', value: 'transparent' },
  { id: 'blur', name: '背景虚化', type: 'blur' },
  { id: 'office', name: '办公室', type: 'image', url: '/backgrounds/office.jpg' },
  { id: 'nature', name: '自然风光', type: 'image', url: '/backgrounds/nature.jpg' },
  { id: 'simple', name: '纯色背景', type: 'color', value: 'var(--hula-brand-primary)' }
])

// 当前统计数据
const currentStats = ref({
  bandwidthUsage: 1024 * 512, // 512 KB/s
  totalDataTransferred: 1024 * 1024 * 50, // 50 MB
  cpuUsage: 15
})

// ========== 方法 ==========

const formatBytes = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

// ========== 设置更新 ==========

const updatePermissionSettings = () => {
  // 更新参与者权限设置
  message.success('权限设置已更新')
}

const updateAdmissionMode = () => {
  // 更新入场模式
  message.success('入场模式已更新')
}

const updateMaxParticipants = () => {
  // 更新最大参与人数
  message.success(`最大参与人数已设置为 ${hostSettings.value.maxParticipants}`)
}

const updateAudioSettings = () => {
  // 更新音频设置
  message.success('音频设置已更新')
}

const updateAudioQuality = () => {
  // 更新音频质量
  message.success(`音频质量已设置为 ${audioSettings.value.quality}`)
}

const updateNoiseSuppression = () => {
  // 更新噪音抑制
  message.success('噪音抑制设置已更新')
}

const updateVideoSettings = () => {
  // 更新视频设置
  message.success('视频设置已更新')
}

const updateVideoLayout = () => {
  // 更新视频布局
  message.success(`视频布局已设置为 ${videoSettings.value.layout}`)
}

const toggleSpeakerView = () => {
  // 切换发言人视图
  message.info(videoSettings.value.speakerView ? '发言人视图已启用' : '发言人视图已禁用')
}

const toggleVirtualBackground = () => {
  // 切换虚拟背景
  message.info(videoSettings.value.virtualBackground ? '虚拟背景已启用' : '虚拟背景已禁用')
}

const selectBackground = (bgId: string) => {
  selectedBackground.value = bgId
  const bg = backgroundPresets.value.find((b) => b.id === bgId)
  if (bg) {
    // 应用虚拟背景
    message.success(`已选择背景: ${bg.name}`)
  }
}

const updateRecordingSettings = () => {
  // 更新录制设置
  message.success('录制设置已更新')
}

const updateRecordingFormat = () => {
  // 更新录制格式
  message.success(`录制格式已设置为 ${recordingSettings.value.format}`)
}

const updateRecordingQuality = () => {
  // 更新录制质量
  message.success(`录制质量已设置为 ${recordingSettings.value.quality}`)
}

const updateRecordingStorage = () => {
  // 更新录制存储
  message.success(`录制存储已设置为 ${recordingSettings.value.storage}`)
}

const updateSecuritySettings = () => {
  // 更新安全设置
  message.success('安全设置已更新')
}

const toggleCallLock = () => {
  isCallLocked.value = !isCallLocked.value
  message.info(isCallLocked.value ? '通话已锁定' : '通话已解锁')
}

const updateAdvancedSettings = () => {
  // 更新高级设置
  message.success('高级设置已更新')
}

const resetToDefaults = () => {
  // 重置为默认设置
  hostSettings.value = {
    allowParticipantsToUnmute: true,
    allowParticipantsToStartVideo: true,
    allowParticipantsToShare: false,
    allowParticipantsToRecord: false,
    admissionMode: 'open',
    maxParticipants: 50
  }

  audioSettings.value = {
    defaultState: 'muted',
    quality: 'standard',
    noiseSuppression: 'medium'
  }

  videoSettings.value = {
    defaultState: 'off',
    layout: 'grid',
    speakerView: true,
    virtualBackground: false
  }

  recordingSettings.value = {
    autoRecord: false,
    format: 'webm',
    quality: '720p',
    storage: 'local'
  }

  securitySettings.value = {
    waitingRoomPassword: '',
    endToEndEncryption: false
  }

  advancedSettings.value = {
    adaptiveBitrate: true,
    lowLatencyMode: false
  }

  message.success('设置已重置为默认值')
}

const saveSettings = () => {
  // 保存设置到本地存储
  localStorage.setItem('group-call-host-settings', JSON.stringify(hostSettings.value))
  localStorage.setItem('group-call-audio-settings', JSON.stringify(audioSettings.value))
  localStorage.setItem('group-call-video-settings', JSON.stringify(videoSettings.value))
  localStorage.setItem('group-call-recording-settings', JSON.stringify(recordingSettings.value))
  localStorage.setItem('group-call-security-settings', JSON.stringify(securitySettings.value))
  localStorage.setItem('group-call-advanced-settings', JSON.stringify(advancedSettings.value))

  message.success('群组通话设置已保存')
  emit('closed')
}

// ========== 生命周期 ==========

onMounted(() => {
  // 加载保存的设置
  const savedHostSettings = localStorage.getItem('group-call-host-settings')
  const savedAudioSettings = localStorage.getItem('group-call-audio-settings')
  const savedVideoSettings = localStorage.getItem('group-call-video-settings')
  const savedRecordingSettings = localStorage.getItem('group-call-recording-settings')
  const savedSecuritySettings = localStorage.getItem('group-call-security-settings')
  const savedAdvancedSettings = localStorage.getItem('group-call-advanced-settings')

  if (savedHostSettings) {
    Object.assign(hostSettings.value, JSON.parse(savedHostSettings))
  }

  if (savedAudioSettings) {
    Object.assign(audioSettings.value, JSON.parse(savedAudioSettings))
  }

  if (savedVideoSettings) {
    Object.assign(videoSettings.value, JSON.parse(savedVideoSettings))
  }

  if (savedRecordingSettings) {
    Object.assign(recordingSettings.value, JSON.parse(savedRecordingSettings))
  }

  if (savedSecuritySettings) {
    Object.assign(securitySettings.value, JSON.parse(savedSecuritySettings))
  }

  if (savedAdvancedSettings) {
    Object.assign(advancedSettings.value, JSON.parse(savedAdvancedSettings))
  }

  // 模拟实时统计数据更新
  setInterval(() => {
    currentStats.value.bandwidthUsage = 1024 * (300 + secureRandomFloat() * 500) // 300-800 KB/s
    currentStats.value.totalDataTransferred += 1024 * 10 // 每秒增加 10KB
    currentStats.value.cpuUsage = Math.max(5, Math.min(80, currentStats.value.cpuUsage + (Math.random() - 0.5) * 5))
  }, 1000)
})
</script>

<style lang="scss" scoped>
.group-call-settings {
  height: 100%;
  display: flex;
  flex-direction: column;

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid var(--border-color);

    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--text-color-1);
    }
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .settings-section {
    margin-bottom: 32px;

    h4 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-1);
    }
  }

  .setting-item {
    margin-bottom: 20px;

    label {
      display: block;
      font-weight: 500;
      color: var(--text-color-1);
      margin-bottom: 8px;
    }

    .setting-description {
      font-size: 12px;
      color: var(--text-color-3);
      margin-top: 4px;
    }
  }

  .permission-settings {
    .permission-item {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;

      .permission-label {
        font-size: 14px;
        color: var(--text-color-2);
      }
    }
  }

  .admission-settings {
    .n-radio-group {
      margin-bottom: 8px;
    }
  }

  .network-settings,
  .audio-settings,
  .video-settings {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;

    .setting-label {
      font-size: 14px;
      color: var(--text-color-2);
    }
  }

  .background-options {
    margin-top: 16px;

    .background-presets {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      gap: 12px;

      .background-preset {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border: 2px solid var(--border-color);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          border-color: var(--primary-color-hover);
        }

        &.active {
          border-color: var(--primary-color);
          background: rgba(24, 160, 88, 0.1);
        }

        img, .color-preview, .blur-preview {
          width: 60px;
          height: 40px;
          border-radius: 4px;
          object-fit: cover;
        }

        .color-preview {
          border: 1px solid var(--border-color);
        }

        .blur-preview {
          background: linear-gradient(45deg, var(--hula-brand-primary) 25%, transparent 25%, transparent 75%, var(--hula-brand-primary) 75%, var(--hula-brand-primary)),
                        linear-gradient(45deg, var(--hula-brand-primary) 25%, transparent 25%, transparent 75%, var(--hula-brand-primary) 75%, var(--hula-brand-primary));
          background-size: 10px 10px;
          background-position: 0 0, 5px 5px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-color-3);
        }

        .preset-name {
          font-size: 12px;
          color: var(--text-color-2);
          text-align: center;
          line-height: 1.2;
        }
      }
    }
  }

  .stats-display {
    .stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 14px;

      .stat-label {
        color: var(--text-color-2);
      }

      .stat-value {
        font-weight: 600;
        color: var(--text-color-1);
      }
    }
  }

  .settings-footer {
    padding: 20px;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
  }
}

// 响应式设计
@media (max-width: 480px) {
  .group-call-settings {
    .background-presets {
      grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)) !important;
    }

    .permission-item,
    .network-settings,
    .audio-settings,
    .video-settings {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
  }
}
</style>
