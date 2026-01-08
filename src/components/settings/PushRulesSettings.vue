<!--
  Push Rules Settings Panel

  Comprehensive UI for managing Matrix push rules.
  Provides user-friendly interface for customizing notification preferences.

  Features:
  - Auto-sync status indicator
  - Global push rule management
  - Keyword highlights
  - Muted rooms/users
  - Quiet hours
  - Rule templates
-->
<script setup lang="ts">
import { ref, computed, watch, onMounted, h } from 'vue'
import {
  NCard,
  NButton,
  NSpace,
  NSwitch,
  NSelect,
  NTag,
  NModal,
  NAlert,
  NDivider,
  NIcon,
  NTooltip,
  useMessage,
  NSpin,
  NInput,
  NPopconfirm,
  NList,
  NListItem,
  NText,
  NTime,
  NCollapse,
  NCollapseItem,
  NCheckbox,
  NCheckboxGroup,
  NProgress,
  NSkeleton,
  NEmpty,
  NTabs,
  NTabPane,
  NDatePicker,
  NStatistic,
  NDescriptions,
  NDescriptionsItem,
  NGrid,
  NGridItem
} from 'naive-ui'
import {
  Refresh,
  RefreshAlert,
  Bell,
  BellOff,
  Volume,
  Volume3,
  Clock,
  Key,
  User,
  Building,
  Settings,
  Check,
  AlertCircle
} from '@vicons/tabler'
import { usePushRulesStore, type PushRuleSettings, type RuleTemplate } from '@/stores/pushRules'
import { logger } from '@/utils/logger'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const props = defineProps<{
  show: boolean
}>()

const message = useMessage()
const { t } = useI18n()
const pushRulesStore = usePushRulesStore()

// State
const isLoading = ref(false)
const isSaving = ref(false)
const error = ref('')
const activeTab = ref('general')

// Local settings
const settings = ref<PushRuleSettings>({
  globalEnabled: true,
  messageSound: true,
  desktopNotifications: true,
  mobileNotifications: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  highlightMentions: true,
  highlightKeywords: true,
  showPreviews: true
})

// Keywords management
const newKeywordInput = ref('')
const keywords = ref<string[]>([])

// Muted rooms/users
const mutedRoomsList = ref<Array<{ id: string; name: string }>>([])
const mutedUsersList = ref<Array<{ id: string; name: string }>>([])

// Rule templates
const selectedTemplates = ref<string[]>([])

// Computed
const show = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value)
})

const hasChanges = computed(() => {
  return JSON.stringify(settings.value) !== JSON.stringify(pushRulesStore.settings)
})

// Auto-sync status
const syncStatusIcon = computed(() => {
  switch (pushRulesStore.syncStatus) {
    case 'syncing':
      return h(RefreshAlert, { class: 'spin' })
    case 'success':
      return h(Check, { style: { color: '#18a058' } })
    case 'error':
      return h(AlertCircle, { style: { color: '#d03050' } })
    default:
      return h(Refresh)
  }
})

const syncStatusText = computed(() => {
  switch (pushRulesStore.syncStatus) {
    case 'syncing':
      return '正在同步...'
    case 'success':
      return '同步成功'
    case 'error':
      return '同步失败'
    default:
      return '已同步'
  }
})

const lastSyncTime = computed(() => {
  if (!pushRulesStore.lastSyncTime) return null
  return new Date(pushRulesStore.lastSyncTime).toLocaleString()
})

// Rule templates by category
const templatesByCategory = computed(() => {
  const templates = pushRulesStore.ruleTemplates || []
  const grouped: Record<string, RuleTemplate[]> = {}

  templates.forEach((template) => {
    const category = template.category || '其他'
    if (!grouped[category]) {
      grouped[category] = []
    }
    grouped[category].push(template)
  })

  return grouped
})

// Analytics
const analyticsData = computed(() => pushRulesStore.analytics)

// Methods
const loadSettings = async () => {
  isLoading.value = true
  error.value = ''

  try {
    // Load settings from store
    settings.value = { ...pushRulesStore.settings }

    // Load keywords
    keywords.value = pushRulesStore.keywordRules.map((rule) => rule.pattern || '').filter(Boolean)

    // Load muted rooms and users
    mutedRoomsList.value = pushRulesStore.mutedRooms.map((rule) => ({
      id: rule.rule_id,
      name: rule.rule_id // Could be enhanced with room names
    }))

    mutedUsersList.value = pushRulesStore.mutedUsers.map((rule) => ({
      id: rule.rule_id,
      name: rule.rule_id // Could be enhanced with display names
    }))

    // Load enabled templates
    selectedTemplates.value = pushRulesStore.ruleTemplates.filter((t) => t.enabled).map((t) => t.id)

    logger.info('[PushRulesSettings] Settings loaded')
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    error.value = `Failed to load settings: ${errorMessage}`
    logger.error('[PushRulesSettings] Failed to load settings:', err)
  } finally {
    isLoading.value = false
  }
}

const saveSettings = async () => {
  isSaving.value = true
  error.value = ''

  try {
    // Update settings
    pushRulesStore.updateSettings(settings.value)

    // Update keywords
    if (settings.value.highlightKeywords) {
      await pushRulesStore.setKeywordsHighlight(keywords.value)
    }

    // Update quiet hours
    if (settings.value.quietHoursEnabled) {
      await pushRulesStore.setQuietHoursSettings(true, settings.value.quietHoursStart, settings.value.quietHoursEnd)
    } else {
      await pushRulesStore.setQuietHoursSettings(false, '', '')
    }

    message.success('推送规则设置已保存')
    logger.info('[PushRulesSettings] Settings saved')
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    error.value = `Failed to save settings: ${errorMessage}`
    message.error(`保存失败: ${errorMessage}`)
    logger.error('[PushRulesSettings] Failed to save settings:', err)
  } finally {
    isSaving.value = false
  }
}

// Keyword management
const addKeyword = () => {
  const keyword = newKeywordInput.value.trim()
  if (!keyword) return

  if (keywords.value.includes(keyword)) {
    message.warning('该关键词已存在')
    return
  }

  keywords.value.push(keyword)
  newKeywordInput.value = ''
}

const removeKeyword = (keyword: string) => {
  keywords.value = keywords.value.filter((k) => k !== keyword)
}

// Unmute room/user
const unmuteRoom = async (roomId: string) => {
  try {
    await pushRulesStore.unmuteRoomNotifications(roomId)
    mutedRoomsList.value = mutedRoomsList.value.filter((r) => r.id !== roomId)
    message.success('已取消房间静音')
  } catch (err) {
    message.error('取消静音失败')
    logger.error('[PushRulesSettings] Failed to unmute room:', err)
  }
}

const unmuteUser = async (userId: string) => {
  try {
    await pushRulesStore.unmuteUserNotifications(userId)
    mutedUsersList.value = mutedUsersList.value.filter((u) => u.id !== userId)
    message.success('已取消用户静音')
  } catch (err) {
    message.error('取消静音失败')
    logger.error('[PushRulesSettings] Failed to unmute user:', err)
  }
}

// Sync operations
const handleManualSync = async () => {
  const success = await pushRulesStore.manualSync()
  if (success) {
    message.success('同步成功')
    await loadSettings()
  } else {
    message.error('同步失败: ' + (pushRulesStore.syncError || '未知错误'))
  }
}

const toggleAutoSync = (enabled: boolean) => {
  if (enabled) {
    pushRulesStore.enableAutoSync()
    message.success('已启用自动同步')
  } else {
    pushRulesStore.disableAutoSync()
    message.info('已禁用自动同步')
  }
}

// Template operations
const applyTemplate = async (templateId: string) => {
  try {
    const success = await pushRulesStore.applyTemplate(templateId)
    if (success) {
      message.success('模板已应用')
      await loadSettings()
    } else {
      message.error('应用模板失败')
    }
  } catch (err) {
    message.error('应用模板失败')
    logger.error('[PushRulesSettings] Failed to apply template:', err)
  }
}

const removeTemplate = async (templateId: string) => {
  try {
    await pushRulesStore.removeRule('global', 'override', templateId)
    message.success('模板已移除')
    await loadSettings()
  } catch (err) {
    message.error('移除模板失败')
    logger.error('[PushRulesSettings] Failed to remove template:', err)
  }
}

// Lifecycle
onMounted(() => {
  if (props.show) {
    loadSettings()
  }
})

watch(
  () => props.show,
  (newShow) => {
    if (newShow) {
      loadSettings()
    }
  }
)
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    title="推送规则设置"
    class="modal-container"
    :mask-closable="false"
    :segmented="{ content: 'soft' }">
    <template #header-extra>
      <NSpace align="center">
        <!-- Sync status -->
        <NTooltip>
          <template #trigger>
            <NIcon :size="18">
              <component :is="syncStatusIcon" />
            </NIcon>
          </template>
          <span>{{ syncStatusText }}</span>
        </NTooltip>

        <!-- Last sync time -->
        <NText v-if="lastSyncTime" depth="3" class="text-small">
          {{ lastSyncTime }}
        </NText>

        <!-- Manual sync button -->
        <NButton
          quaternary
          circle
          size="small"
          :loading="pushRulesStore.syncStatus === 'syncing'"
          @click="handleManualSync">
          <template #icon>
            <NIcon>
              <Refresh />
            </NIcon>
          </template>
        </NButton>
      </NSpace>
    </template>

    <!-- Error Alert -->
    <NAlert v-if="error" type="error" :title="error" closable @close="error = ''" class="mb-16" />

    <!-- Loading Skeleton -->
    <NSkeleton v-if="isLoading" :n="10" class="mt-16" />

    <!-- Settings Content -->
    <template v-else>
      <NTabs v-model:value="activeTab" type="line">
        <!-- General Settings Tab -->
        <NTabPane name="general" tab="通用设置">
          <NSpace vertical size="large">
            <!-- Global notifications toggle -->
            <div class="setting-section">
              <div class="setting-header">
                <div class="setting-title">
                  <NIcon size="18" class="icon-spacing">
                    <Bell />
                  </NIcon>
                  <span>启用通知</span>
                </div>
                <NSwitch v-model:value="settings.globalEnabled" :disabled="isSaving" />
              </div>
              <div class="setting-description">全局启用或禁用所有通知</div>
            </div>

            <!-- Auto-sync toggle -->
            <div class="setting-section">
              <div class="setting-header">
                <div class="setting-title">
                  <NIcon size="18" class="icon-spacing">
                    <RefreshAlert />
                  </NIcon>
                  <span>自动同步</span>
                </div>
                <NSwitch :model-value="pushRulesStore.autoSyncEnabled" @update:value="toggleAutoSync" />
              </div>
              <div class="setting-description">自动同步服务器推送规则变更</div>
            </div>

            <NDivider class="divider-spacing" />

            <!-- Sound settings -->
            <div class="setting-section">
              <div class="setting-header">
                <div class="setting-title">
                  <NIcon size="18" class="icon-spacing">
                    <Volume />
                  </NIcon>
                  <span>通知声音</span>
                </div>
                <NSwitch v-model:value="settings.messageSound" :disabled="!settings.globalEnabled || isSaving" />
              </div>
              <div class="setting-description">收到通知时播放声音</div>
            </div>

            <!-- Desktop notifications -->
            <div class="setting-section">
              <div class="setting-header">
                <div class="setting-title">桌面通知</div>
                <NSwitch
                  v-model:value="settings.desktopNotifications"
                  :disabled="!settings.globalEnabled || isSaving" />
              </div>
              <div class="setting-description">在桌面显示通知</div>
            </div>

            <!-- Mobile notifications -->
            <div class="setting-section">
              <div class="setting-header">
                <div class="setting-title">移动端通知</div>
                <NSwitch v-model:value="settings.mobileNotifications" :disabled="!settings.globalEnabled || isSaving" />
              </div>
              <div class="setting-description">在移动设备显示推送通知</div>
            </div>

            <!-- Show previews -->
            <div class="setting-section">
              <div class="setting-header">
                <div class="setting-title">显示消息预览</div>
                <NSwitch v-model:value="settings.showPreviews" :disabled="!settings.globalEnabled || isSaving" />
              </div>
              <div class="setting-description">在通知中显示消息内容预览</div>
            </div>
          </NSpace>
        </NTabPane>

        <!-- Keywords Tab -->
        <NTabPane name="keywords" tab="关键词高亮">
          <NSpace vertical size="large">
            <!-- Highlight mentions -->
            <div class="setting-section">
              <div class="setting-header">
                <div class="setting-title">
                  <NIcon size="18" class="icon-spacing">
                    <Key />
                  </NIcon>
                  <span>@提及高亮</span>
                </div>
                <NSwitch v-model:value="settings.highlightMentions" :disabled="!settings.globalEnabled || isSaving" />
              </div>
              <div class="setting-description">当有人@你时高亮通知</div>
            </div>

            <!-- Keyword highlights -->
            <div class="setting-section">
              <div class="setting-header">
                <div class="setting-title">
                  <span>关键词高亮</span>
                </div>
                <NSwitch v-model:value="settings.highlightKeywords" :disabled="!settings.globalEnabled || isSaving" />
              </div>
              <div class="setting-description">包含特定关键词时高亮通知</div>

              <div v-if="settings.highlightKeywords" class="setting-content">
                <div class="keyword-list">
                  <NEmpty v-if="keywords.length === 0" description="暂无关键词" size="small" />

                  <NSpace v-else wrap>
                    <NTag
                      v-for="keyword in keywords"
                      :key="keyword"
                      closable
                      type="info"
                      size="medium"
                      @close="removeKeyword(keyword)">
                      {{ keyword }}
                    </NTag>
                  </NSpace>
                </div>

                <div class="keyword-input-container">
                  <NInput
                    v-model:value="newKeywordInput"
                    placeholder="添加关键词..."
                    :disabled="isSaving"
                    @keyup.enter="addKeyword"
                    class="flex-1" />
                  <NButton :disabled="isSaving || !newKeywordInput.trim()" @click="addKeyword">添加</NButton>
                </div>
              </div>
            </div>
          </NSpace>
        </NTabPane>

        <!-- Quiet Hours Tab -->
        <NTabPane name="quiet" tab="静默时间">
          <NSpace vertical size="large">
            <div class="setting-section">
              <div class="setting-header">
                <div class="setting-title">
                  <NIcon size="18" class="icon-spacing">
                    <Clock />
                  </NIcon>
                  <span>启用静默时间</span>
                </div>
                <NSwitch v-model:value="settings.quietHoursEnabled" :disabled="!settings.globalEnabled || isSaving" />
              </div>
              <div class="setting-description">在指定时间段内静音所有通知</div>

              <div v-if="settings.quietHoursEnabled" class="setting-content">
                <NSpace align="center">
                  <div class="flex-1">
                    <label class="label-text">开始时间</label>
                    <NInput v-model:value="settings.quietHoursStart" placeholder="22:00" :disabled="isSaving" />
                  </div>

                  <div class="flex-1">
                    <label class="label-text">结束时间</label>
                    <NInput v-model:value="settings.quietHoursEnd" placeholder="08:00" :disabled="isSaving" />
                  </div>
                </NSpace>
              </div>
            </div>
          </NSpace>
        </NTabPane>

        <!-- Muted Tab -->
        <NTabPane name="muted" tab="已静音">
          <NSpace vertical size="large">
            <!-- Muted rooms -->
            <div class="setting-section">
              <div class="setting-title mb-12">
                <NIcon size="18" class="icon-spacing">
                  <Building />
                </NIcon>
                <span>已静音房间 ({{ mutedRoomsList.length }})</span>
              </div>

              <NEmpty v-if="mutedRoomsList.length === 0" description="暂无静音房间" size="small" />

              <NList v-else hoverable clickable bordered>
                <NListItem v-for="room in mutedRoomsList" :key="room.id">
                  <template #prefix>
                    <NIcon>
                      <BellOff />
                    </NIcon>
                  </template>
                  <NText>{{ room.name || room.id }}</NText>
                  <template #suffix>
                    <NButton text type="error" size="small" @click="unmuteRoom(room.id)">取消静音</NButton>
                  </template>
                </NListItem>
              </NList>
            </div>

            <NDivider class="divider-spacing" />

            <!-- Muted users -->
            <div class="setting-section">
              <div class="setting-title mb-12">
                <NIcon size="18" class="icon-spacing">
                  <User />
                </NIcon>
                <span>已静音用户 ({{ mutedUsersList.length }})</span>
              </div>

              <NEmpty v-if="mutedUsersList.length === 0" description="暂无静音用户" size="small" />

              <NList v-else hoverable clickable bordered>
                <NListItem v-for="user in mutedUsersList" :key="user.id">
                  <template #prefix>
                    <NIcon>
                      <BellOff />
                    </NIcon>
                  </template>
                  <NText>{{ user.name || user.id }}</NText>
                  <template #suffix>
                    <NButton text type="error" size="small" @click="unmuteUser(user.id)">取消静音</NButton>
                  </template>
                </NListItem>
              </NList>
            </div>
          </NSpace>
        </NTabPane>

        <!-- Templates Tab -->
        <NTabPane name="templates" tab="规则模板">
          <NCollapse accordion>
            <NCollapseItem v-for="(templates, category) in templatesByCategory" :key="category" :title="category">
              <NList>
                <NListItem v-for="template in templates" :key="template.id">
                  <template #prefix>
                    <NCheckbox
                      :checked="template.enabled"
                      @update:checked="
                        (checked: boolean) => {
                          if (checked) {
                            applyTemplate(template.id)
                          } else {
                            removeTemplate(template.id)
                          }
                        }
                      " />
                  </template>
                  <NText strong>{{ template.name }}</NText>
                  <NText depth="3" class="small-block-text">
                    {{ template.description }}
                  </NText>
                </NListItem>
              </NList>
            </NCollapseItem>
          </NCollapse>

          <NEmpty v-if="Object.keys(templatesByCategory).length === 0" description="暂无可用模板" />
        </NTabPane>

        <!-- Analytics Tab -->
        <NTabPane name="analytics" tab="统计信息">
          <NGrid :cols="2" :x-gap="16" :y-gap="16">
            <NGridItem>
              <NStatistic label="总规则数" :value="analyticsData?.totalRules || 0">
                <template #prefix>
                  <NIcon>
                    <Settings />
                  </NIcon>
                </template>
              </NStatistic>
            </NGridItem>

            <NGridItem>
              <NStatistic label="启用规则数" :value="analyticsData?.activeRules || 0">
                <template #prefix>
                  <NIcon>
                    <Check />
                  </NIcon>
                </template>
              </NStatistic>
            </NGridItem>

            <NGridItem>
              <NStatistic label="静音房间" :value="analyticsData?.mutedRooms || 0">
                <template #prefix>
                  <NIcon>
                    <Building />
                  </NIcon>
                </template>
              </NStatistic>
            </NGridItem>

            <NGridItem>
              <NStatistic label="静音用户" :value="analyticsData?.mutedUsers || 0">
                <template #prefix>
                  <NIcon>
                    <User />
                  </NIcon>
                </template>
              </NStatistic>
            </NGridItem>

            <NGridItem>
              <NStatistic label="关键词高亮" :value="analyticsData?.keywordHighlights || 0">
                <template #prefix>
                  <NIcon>
                    <Key />
                  </NIcon>
                </template>
              </NStatistic>
            </NGridItem>

            <NGridItem>
              <NStatistic label="通知次数" :value="analyticsData?.notificationCount || 0">
                <template #prefix>
                  <NIcon>
                    <Bell />
                  </NIcon>
                </template>
              </NStatistic>
            </NGridItem>
          </NGrid>
        </NTabPane>
      </NTabs>
    </template>

    <!-- Actions Footer -->
    <template #footer>
      <NSpace justify="end" class="width-full">
        <NButton @click="show = false" :disabled="isSaving">取消</NButton>
        <NButton type="primary" :loading="isSaving" :disabled="!hasChanges" @click="saveSettings">保存设置</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.setting-section {
  padding: 8px 0;
}

.setting-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.setting-title {
  display: flex;
  align-items: center;
  font-weight: 500;
  font-size: 14px;
}

.setting-description {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  line-height: 1.5;
}

.setting-content {
  margin-top: 12px;
  padding-left: 26px;
}

.keyword-list {
  background: var(--n-color-modal);
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  padding: 12px;
  min-height: 60px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Inline style replacements */
.modal-container {
  width: 900px;
  max-height: 80vh;
}

.icon-spacing {
  margin-right: 8px;
}

.divider-spacing {
  margin: 20px 0;
}

.keyword-input-container {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

.flex-1 {
  flex: 1;
}

.label-text {
  font-size: 13px;
  color: #666;
  display: block;
  margin-bottom: 8px;
}

.mb-12 {
  margin-bottom: 12px;
}

.small-block-text {
  font-size: 12px;
  display: block;
}

.width-full {
  width: 100%;
}
</style>
