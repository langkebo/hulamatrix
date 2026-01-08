<template>
  <div class="space-settings">
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <n-spin size="large" />
      <p>加载空间设置中...</p>
    </div>

    <!-- Error State -->
    <n-alert v-else-if="error" type="error" :title="error" />

    <!-- Settings Content -->
    <div v-else-if="spaceInfo" class="settings-content">
      <!-- Space Info Card -->
      <n-card title="空间信息" :bordered="false" class="settings-card">
        <n-form label-placement="left" label-width="100px">
          <!-- Space Avatar -->
          <n-form-item label="头像">
            <n-space align="center">
              <n-avatar :size="64" :src="spaceInfo.avatar" />
              <n-upload :max="1" accept="image/*" :show-file-list="false" @change="handleAvatarUpload">
                <n-button secondary>
                  <template #icon>
                    <n-icon><Upload /></n-icon>
                  </template>
                  更换头像
                </n-button>
              </n-upload>
            </n-space>
          </n-form-item>

          <!-- Space Name -->
          <n-form-item label="空间名称">
            <n-input
              v-model:value="spaceInfo.name"
              placeholder="空间名称"
              maxlength="64"
              show-count
              @blur="handleNameChange" />
          </n-form-item>

          <!-- Space Topic -->
          <n-form-item label="描述">
            <n-input
              v-model:value="spaceInfo.topic"
              type="textarea"
              placeholder="空间描述"
              :rows="3"
              maxlength="256"
              show-count
              @blur="handleTopicChange" />
          </n-form-item>

          <!-- Space Type -->
          <n-form-item label="类型">
            <n-tag :type="spaceInfo.spaceType === 'space' ? 'primary' : 'default'">
              {{ getSpaceTypeLabel(spaceInfo.spaceType) }}
            </n-tag>
          </n-form-item>

          <!-- Visibility -->
          <n-form-item label="可见性">
            <n-tag :type="getVisibilityTagType(spaceInfo.joinRule)">
              {{ getVisibilityLabel(spaceInfo.joinRule) }}
            </n-tag>
            <n-button v-if="canEdit" text type="primary" class="change-button" @click="showVisibilityDialog = true">
              更改
            </n-button>
          </n-form-item>

          <!-- Member Count -->
          <n-form-item label="成员数量">
            <n-statistic :value="memberCount" />
          </n-form-item>

          <!-- Created Date -->
          <n-form-item v-if="spaceInfo.created" label="创建时间">
            <n-time :time="spaceInfo.created * 1000" type="date" />
          </n-form-item>
        </n-form>
      </n-card>

      <!-- Notifications Settings -->
      <n-card title="通知设置" :bordered="false" class="settings-card">
        <n-form label-placement="left" label-width="100px">
          <n-form-item label="消息通知">
            <n-switch v-model:value="notificationSettings.enabled" @update:value="handleNotificationChange" />
          </n-form-item>

          <n-form-item label="高亮关键词">
            <n-dynamic-tags v-model:value="notificationSettings.keywords" @update:value="handleKeywordsChange" />
          </n-form-item>
        </n-form>
      </n-card>

      <!-- Advanced Settings -->
      <n-card title="高级设置" :bordered="false" class="settings-card">
        <n-list>
          <!-- Space Address -->
          <n-list-item>
            <template #prefix>
              <n-icon size="24"><Hash /></n-icon>
            </template>
            空间地址
            <template #default>
              <n-space vertical>
                <n-input-group>
                  <n-input-group-label>https://matrix.cjystx.top/</n-input-group-label>
                  <n-input v-model:value="spaceAlias" placeholder="space-alias" :disabled="!canEdit" />
                </n-input-group>
                <n-button
                  v-if="canEdit"
                  type="primary"
                  size="small"
                  @click="handleAliasUpdate"
                  :loading="updatingAlias">
                  更新地址
                </n-button>
              </n-space>
            </template>
          </n-list-item>

          <!-- Export Space Data -->
          <n-list-item>
            <template #prefix>
              <n-icon size="24"><Download /></n-icon>
            </template>
            导出空间数据
            <template #default>
              <n-space vertical>
                <n-text depth="3">导出空间的成员、房间和设置数据</n-text>
                <n-button size="small" @click="handleExportData" :loading="exporting">导出数据</n-button>
              </n-space>
            </template>
          </n-list-item>

          <!-- Danger Zone -->
          <n-list-item>
            <template #prefix>
              <n-icon size="24" color="#d03050"><AlertTriangle /></n-icon>
            </template>
            危险操作
            <template #default>
              <n-space vertical>
                <n-text depth="3">这些操作不可逆，请谨慎操作</n-text>
                <n-space>
                  <n-button v-if="canEdit" size="small" type="warning" @click="handleLeaveSpace" :loading="leaving">
                    离开空间
                  </n-button>
                  <n-button v-if="canEdit && isOwner" size="small" type="error" @click="showDeleteDialog = true">
                    删除空间
                  </n-button>
                </n-space>
              </n-space>
            </template>
          </n-list-item>
        </n-list>
      </n-card>
    </div>

    <!-- Visibility Change Dialog -->
    <n-modal
      v-model:show="showVisibilityDialog"
      preset="dialog"
      title="更改可见性"
      positive-text="确认"
      negative-text="取消"
      @positive-click="handleVisibilityChange">
      <n-radio-group v-model:value="newVisibility" name="visibility">
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
          <n-radio value="restricted">
            <div class="radio-option">
              <div class="option-title">受限空间</div>
              <div class="option-desc">只有被邀请的人可以查看，但成员可以邀请其他人</div>
            </div>
          </n-radio>
        </n-space>
      </n-radio-group>
    </n-modal>

    <!-- Delete Confirmation Dialog -->
    <n-modal
      v-model:show="showDeleteDialog"
      preset="dialog"
      title="确认删除空间"
      :positive-text="`${spaceInfo?.name || '此空间'} 将被永久删除`"
      negative-text="取消"
      @positive-click="handleDeleteSpace">
      <n-alert type="warning" :title="deleteWarning" />
    </n-modal>
  </div>
</template>

<script setup lang="ts">
// Extended Matrix Client interface with room management methods
interface MatrixClientWithRoomMethods {
  getUserId?(): string
  getRoom?(roomId: string): {
    currentState?: {
      getStateEvents?(
        eventType: string,
        stateKey: string
      ): {
        getContent?(): Record<string, unknown>
      }
    }
  } | null
  setRoomName?(roomId: string, name: string): Promise<void>
  setRoomTopic?(roomId: string, topic: string): Promise<void>
  createAlias?(alias: string, roomId: string): Promise<void>
}

import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NCard,
  NForm,
  NFormItem,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NButton,
  NSpace,
  NAvatar,
  NUpload,
  NSpin,
  NAlert,
  NTag,
  NIcon,
  NStatistic,
  NTime,
  NSwitch,
  NDynamicTags,
  NList,
  NListItem,
  NText,
  NModal,
  NRadioGroup,
  NRadio,
  useMessage,
  useDialog,
  type UploadFileInfo
} from 'naive-ui'
import { matrixClientService } from '@/integrations/matrix/client'
import { Hash, Upload, Download, AlertTriangle } from '@vicons/tabler'
import { matrixSpacesService, type SpaceInfo } from '@/services/matrixSpacesService'
import { createRoomService } from '@/services/roomService'
import { useSpacesStore } from '@/stores/spaces'
import { logger } from '@/utils/logger'
import { msg } from '@/utils/SafeUI'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const spacesStore = useSpacesStore()

// Get room service instance (lazy initialization)
const getRoomService = (): ReturnType<typeof createRoomService> | null => {
  const client = matrixClientService.getClient()
  if (!client) return null
  // Use unknown intermediate type assertion as suggested by TypeScript
  return createRoomService(client as unknown as Parameters<typeof createRoomService>[0])
}

// State
const loading = ref(true)
const error = ref<string | null>(null)
const spaceInfo = ref<SpaceInfo | null>(null)
const memberCount = ref(0)
const canEdit = ref(false)
const isOwner = ref(false)
const spaceAlias = ref('')
const updatingAlias = ref(false)
const exporting = ref(false)
const leaving = ref(false)

// Dialogs
const showVisibilityDialog = ref(false)
const showDeleteDialog = ref(false)
const newVisibility = ref<'public' | 'private' | 'restricted'>('private')

// Notification settings
const notificationSettings = ref({
  enabled: true,
  keywords: [] as string[]
})

// Computed
const spaceId = computed(() => (route.params.spaceId as string) || (route.query.spaceId as string))

const deleteWarning = computed(() => {
  return `删除空间 "${spaceInfo.value?.name || ''}" 将永久删除该空间及其所有内容。此操作不可撤销。`
})

// Methods
const loadSpaceInfo = async () => {
  if (!spaceId.value) {
    error.value = '未指定空间ID'
    loading.value = false
    return
  }

  loading.value = true
  error.value = null

  try {
    // Load space info from store
    const space = spacesStore.spaces[spaceId.value]
    if (space) {
      spaceInfo.value = space
      memberCount.value = space.memberCount || 0

      // Check permissions based on Matrix power levels
      const client = matrixClientService.getClient() as unknown as MatrixClientWithRoomMethods | null
      if (client && spaceInfo.value.roomId) {
        const currentUserId = client.getUserId?.()
        const room = client.getRoom?.(spaceInfo.value.roomId)

        if (room && currentUserId) {
          // Get power levels for the current user
          const powerLevelsEvent = room.currentState?.getStateEvents?.('m.room.power_levels', '')
          if (powerLevelsEvent) {
            const powerLevels = powerLevelsEvent.getContent?.()
            if (powerLevels) {
              const users = (powerLevels.users || {}) as Record<string, number>
              const usersDefault = (powerLevels.users_default || 0) as number
              const stateDefault = (powerLevels.state_default || 50) as number

              // Get current user's power level
              const userPowerLevel = users[currentUserId] ?? usersDefault

              // User can edit if they have sufficient power level (typically 50 or higher)
              canEdit.value = userPowerLevel >= stateDefault

              // Check if user is the creator/owner
              isOwner.value = spaceInfo.value.roomId === (spaceInfo.value.creator || '') || userPowerLevel >= 100
            } else {
              canEdit.value = spaceInfo.value.roomId === (spaceInfo.value.creator || '')
              isOwner.value = canEdit.value
            }
          } else {
            // Fallback: check if user is the creator
            canEdit.value = spaceInfo.value.roomId === (spaceInfo.value.creator || '')
            isOwner.value = canEdit.value
          }
        } else {
          // Room not found, fallback to creator check
          canEdit.value = spaceInfo.value.roomId === (spaceInfo.value.creator || '')
          isOwner.value = canEdit.value
        }
      } else {
        // No client available, default to true (for UI display purposes)
        canEdit.value = true
        isOwner.value = spaceInfo.value.roomId === (spaceInfo.value.creator || '')
      }
    } else {
      error.value = '空间不存在'
    }
  } catch (err) {
    logger.error('[SpaceSettings] Failed to load space info:', err)
    error.value = '加载空间信息失败'
  } finally {
    loading.value = false
  }
}

const getSpaceTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    space: '空间',
    room: '房间',
    dm: '私聊'
  }
  return labels[type] || type
}

const getVisibilityLabel = (joinRule: string): string => {
  const labels: Record<string, string> = {
    public: '公开',
    invite: '仅受邀',
    knock: '需申请',
    restricted: '受限'
  }
  return labels[joinRule] || joinRule
}

const getVisibilityTagType = (joinRule: string): 'default' | 'info' | 'success' | 'warning' | 'error' => {
  const types: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
    public: 'success',
    invite: 'info',
    knock: 'warning',
    restricted: 'default'
  }
  return types[joinRule] || 'default'
}

const handleAvatarUpload = async (options: { fileList: UploadFileInfo[] }) => {
  const file = options.fileList[0]?.file
  if (!file || !spaceId.value) return

  try {
    await matrixSpacesService.setSpaceAvatar(spaceId.value, file)
    msg.success('头像上传成功')
    await loadSpaceInfo()
  } catch (err) {
    logger.error('[SpaceSettings] Failed to upload avatar:', err)
    msg.error('头像上传失败')
  }
}

const handleNameChange = async () => {
  if (!spaceId.value || !spaceInfo.value?.name) return

  try {
    const client = matrixClientService.getClient() as unknown as MatrixClientWithRoomMethods | null
    if (client && client.setRoomName) {
      await client.setRoomName(spaceId.value, spaceInfo.value.name)
      msg.success('空间名称已更新')
    }
  } catch (err) {
    logger.error('[SpaceSettings] Failed to update name:', err)
    msg.error('更新失败')
  }
}

const handleTopicChange = async () => {
  if (!spaceId.value || !spaceInfo.value) return

  try {
    const client = matrixClientService.getClient() as unknown as MatrixClientWithRoomMethods | null
    if (client && client.setRoomTopic) {
      await client.setRoomTopic(spaceId.value, spaceInfo.value.topic || '')
      msg.success('空间描述已更新')
    }
  } catch (err) {
    logger.error('[SpaceSettings] Failed to update topic:', err)
    msg.error('更新失败')
  }
}

const handleNotificationChange = async (value: boolean) => {
  if (!spaceInfo.value?.roomId) return

  try {
    // Save notification settings to local storage
    const notificationKey = `space_notifications_${spaceInfo.value.roomId}`
    const settings = {
      enabled: value,
      keywords: notificationSettings.value.keywords
    }
    localStorage.setItem(notificationKey, JSON.stringify(settings))

    logger.info('[SpaceSettings] Notification setting updated:', { roomId: spaceInfo.value.roomId, enabled: value })
    msg.success(value ? '已启用消息通知' : '已关闭消息通知')
  } catch (err) {
    logger.error('[SpaceSettings] Failed to update notification settings:', err)
    msg.error('更新通知设置失败')
  }
}

const handleKeywordsChange = async (value: string[]) => {
  if (!spaceInfo.value?.roomId) return

  notificationSettings.value.keywords = value

  try {
    // Save keywords to local storage along with notification settings
    const notificationKey = `space_notifications_${spaceInfo.value.roomId}`
    const settings = {
      enabled: notificationSettings.value.enabled,
      keywords: value
    }
    localStorage.setItem(notificationKey, JSON.stringify(settings))

    logger.info('[SpaceSettings] Keywords updated:', { roomId: spaceInfo.value.roomId, keywords: value })
    msg.success('关键词已保存')
  } catch (err) {
    logger.error('[SpaceSettings] Failed to save keywords:', err)
    msg.error('保存关键词失败')
  }
}

const handleAliasUpdate = async () => {
  if (!spaceId.value || !spaceAlias.value) return

  updatingAlias.value = true
  try {
    const client = matrixClientService.getClient() as unknown as MatrixClientWithRoomMethods | null
    if (client && client.createAlias) {
      // Use dynamic server name from environment
      const serverName = import.meta.env.VITE_MATRIX_SERVER_NAME || 'cjystx.top'
      await client.createAlias(`#space-${spaceAlias.value}:${serverName}`, spaceId.value)
      msg.success('空间地址已更新')
    }
  } catch (err) {
    logger.error('[SpaceSettings] Failed to update alias:', err)
    msg.error('更新失败')
  } finally {
    updatingAlias.value = false
  }
}

const handleVisibilityChange = async () => {
  if (!spaceInfo.value?.roomId) return

  try {
    const roomId = spaceInfo.value.roomId
    const visibility = newVisibility.value

    // Map visibility to Matrix join rules
    // 'public' -> public, 'private' -> invite, 'restricted' -> knock
    const joinRuleMap: Record<string, 'public' | 'invite' | 'knock'> = {
      public: 'public',
      private: 'invite',
      restricted: 'knock'
    }

    const joinRule = joinRuleMap[visibility] || 'invite'

    // Update join rule using roomService
    const roomSvc = getRoomService()
    if (!roomSvc) {
      throw new Error('Matrix client not available')
    }
    await roomSvc.setJoinRule(roomId, joinRule)

    // Update directory visibility
    const dirVisibility: 'public' | 'private' = visibility === 'public' ? 'public' : 'private'
    await roomSvc.setDirectoryVisibility(roomId, dirVisibility)

    // Update local state
    if (spaceInfo.value) {
      spaceInfo.value.joinRule = joinRule as 'public' | 'invite' | 'knock' | 'restricted'
    }

    logger.info('[SpaceSettings] Visibility changed:', { roomId, visibility, joinRule })
    msg.success('可见性已更新')
    showVisibilityDialog.value = false
  } catch (err) {
    logger.error('[SpaceSettings] Failed to change visibility:', err)
    msg.error('更新失败')
  }
}

const handleExportData = async () => {
  if (!spaceId.value) return

  exporting.value = true
  try {
    const data = await matrixSpacesService.exportSpaceData(spaceId.value)
    // Create download link
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `space-${spaceId.value}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    msg.success('数据导出成功')
  } catch (err) {
    logger.error('[SpaceSettings] Failed to export data:', err)
    msg.error('导出失败')
  } finally {
    exporting.value = false
  }
}

const handleLeaveSpace = async () => {
  if (!spaceId.value) return

  dialog.warning({
    title: '确认离开空间',
    content: '确定要离开此空间吗？',
    positiveText: '确认离开',
    negativeText: '取消',
    onPositiveClick: async () => {
      leaving.value = true
      try {
        await matrixSpacesService.leaveSpace(spaceId.value)
        msg.success('已离开空间')
        router.back()
      } catch (err) {
        logger.error('[SpaceSettings] Failed to leave space:', err)
        msg.error('离开空间失败')
      } finally {
        leaving.value = false
      }
    }
  })
}

const handleDeleteSpace = async () => {
  if (!spaceId.value) return

  try {
    // For now, just leave the space. Proper delete requires admin API
    await matrixSpacesService.leaveSpace(spaceId.value)
    msg.success('已离开空间')
    router.push('/')
  } catch (err) {
    logger.error('[SpaceSettings] Failed to delete space:', err)
    msg.error('操作失败')
  }
}

// Lifecycle
onMounted(() => {
  loadSpaceInfo()
})

// Watch for spaceId changes
watch(
  () => route.params.spaceId,
  () => {
    loadSpaceInfo()
  }
)
</script>

<style lang="scss" scoped>
.space-settings {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    gap: 16px;

    p {
      color: var(--text-color-3);
    }
  }

  .settings-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .settings-card {
    &:last-child {
      margin-bottom: 0;
    }
  }

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

  .change-button {
    margin-left: 8px;
  }
}
</style>
