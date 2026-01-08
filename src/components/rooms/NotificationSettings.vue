<!--
  Notification Settings

  Per-room notification settings using Matrix push rules.
  Controls muting, highlights, and notification preferences.

  SDK Integration:
  - client.getPushRules() - Get all push rules
  - client.addPushRule(scope, kind, ruleId, content) - Add push rule
  - client.deletePushRule(scope, kind, ruleId) - Delete push rule
  - client.setPushRuleEnabled(scope, kind, ruleId, enabled) - Toggle rule
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
  NPopconfirm
} from 'naive-ui'
import { Bell, BellOff, Volume, Volume3 } from '@vicons/tabler'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import { useI18n } from 'vue-i18n'

interface Props {
  roomId: string
  show: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  settingsChanged: [settings: NotificationSettings]
}>()

const message = useMessage()
const { t } = useI18n()

// Type definitions
interface NotificationSettings {
  muted: boolean
  highlightEnabled: boolean
  highlightMode: 'all' | 'keywords' | 'none'
  keywords: string[]
  desktopEnabled: boolean
  mobileEnabled: boolean
  soundEnabled: boolean
  soundType: 'default' | 'silent' | 'custom'
}

interface PushRule {
  rule_id: string
  enabled: boolean
  actions: Array<Record<string, unknown>>
  conditions?: Array<Record<string, unknown>>
  pattern?: string
}

// Default settings
const defaultSettings: NotificationSettings = {
  muted: false,
  highlightEnabled: true,
  highlightMode: 'all',
  keywords: [],
  desktopEnabled: true,
  mobileEnabled: true,
  soundEnabled: true,
  soundType: 'default'
}

// State
const settings = ref<NotificationSettings>({ ...defaultSettings })
const isLoading = ref<boolean>(false)
const isSaving = ref<boolean>(false)
const error = ref<string>('')
const newKeywordInput = ref<string>('')

// Computed
const show = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value)
})

const hasChanges = computed(() => {
  // Compare with defaults to detect changes
  return (
    settings.value.muted !== defaultSettings.muted ||
    settings.value.highlightEnabled !== defaultSettings.highlightEnabled ||
    settings.value.highlightMode !== defaultSettings.highlightMode ||
    settings.value.desktopEnabled !== defaultSettings.desktopEnabled ||
    settings.value.mobileEnabled !== defaultSettings.mobileEnabled ||
    settings.value.soundEnabled !== defaultSettings.soundEnabled ||
    settings.value.soundType !== defaultSettings.soundType
  )
})

const highlightOptions = [
  { label: 'All Messages', value: 'all' },
  { label: 'Keywords Only', value: 'keywords' },
  { label: 'None', value: 'none' }
]

const soundOptions = [
  { label: 'Default Sound', value: 'default' },
  { label: 'Silent', value: 'silent' }
]

const hasError = computed(() => error.value.length > 0)

// SDK Integration for Push Rules
async function loadNotificationSettings(): Promise<void> {
  if (!props.roomId) return

  isLoading.value = true
  error.value = ''

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    // Get push rules from SDK
    const getPushRulesMethod = (
      client as unknown as {
        getPushRules?: () => Record<string, Record<string, PushRule[]>>
      }
    ).getPushRules

    if (!getPushRulesMethod) {
      logger.warn('[NotificationSettings] getPushRules not available')
      // Keep default settings
      return
    }

    const pushRules = getPushRulesMethod.call(client)

    // The pushRules object has keys like 'override', 'underride', etc.
    // Each key contains a function that returns an array of rules
    const getOverrideRules = (
      pushRules as {
        override?: () => PushRule[]
      }
    ).override

    if (!getOverrideRules) {
      logger.warn('[NotificationSettings] Override rules not available')
      return
    }

    const roomRules = getOverrideRules() || []

    // Find room-specific mute rule
    const muteRule = roomRules.find((rule: PushRule) => {
      const ruleId = typeof rule.rule_id === 'string' ? rule.rule_id : String(rule.rule_id)
      const firstAction = Array.isArray(rule.actions) && rule.actions.length > 0 ? rule.actions[0] : undefined
      return ruleId === props.roomId && (firstAction as string | undefined) === 'dont_notify'
    })

    // Find highlight rules
    const highlightRule = roomRules.find(
      (rule: PushRule) => typeof rule.rule_id === 'string' && rule.rule_id.startsWith(`.${props.roomId}`)
    )

    // Update settings based on rules
    settings.value.muted = muteRule?.enabled || false

    if (highlightRule?.enabled) {
      settings.value.highlightEnabled = true
      // Determine highlight mode from rule pattern/conditions
      if (highlightRule.pattern) {
        settings.value.highlightMode = 'keywords'
        settings.value.keywords = [highlightRule.pattern]
      } else {
        settings.value.highlightMode = 'all'
      }
    } else {
      settings.value.highlightEnabled = false
      settings.value.highlightMode = 'none'
    }

    logger.info('[NotificationSettings] Settings loaded:', settings.value)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    error.value = `Failed to load settings: ${errorMessage}`
    logger.error('[NotificationSettings] Failed to load settings:', err)
  } finally {
    isLoading.value = false
  }
}

async function saveNotificationSettings(): Promise<void> {
  isSaving.value = true
  error.value = ''

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const addPushRuleMethod = (
      client as unknown as {
        addPushRule?: (scope: string, kind: string, ruleId: string, content: Record<string, unknown>) => Promise<void>
      }
    ).addPushRule

    const deletePushRuleMethod = (
      client as unknown as {
        deletePushRule?: (scope: string, kind: string, ruleId: string) => Promise<void>
      }
    ).deletePushRule

    const setPushRuleEnabledMethod = (
      client as unknown as {
        setPushRuleEnabled?: (scope: string, kind: string, ruleId: string, enabled: boolean) => Promise<void>
      }
    ).setPushRuleEnabled

    // Handle mute rule
    if (settings.value.muted) {
      if (addPushRuleMethod) {
        await addPushRuleMethod.call(client, 'override', 'room', props.roomId, {
          actions: ['dont_notify'],
          conditions: [
            {
              kind: 'event_match',
              key: 'room_id',
              pattern: props.roomId
            }
          ]
        })
      }
    } else {
      if (deletePushRuleMethod) {
        try {
          await deletePushRuleMethod.call(client, 'override', 'room', props.roomId)
        } catch (err) {
          const error = err as { errcode?: string }
          // Ignore if rule doesn't exist (M_NOT_FOUND)
          if (error.errcode !== 'M_NOT_FOUND') {
            throw err
          }
        }
      }
    }

    // Handle highlight settings
    if (settings.value.highlightEnabled && settings.value.highlightMode === 'keywords') {
      // Add keyword highlight rules
      for (const keyword of settings.value.keywords) {
        if (addPushRuleMethod) {
          await addPushRuleMethod.call(client, 'override', 'underride', `.${props.roomId}/${keyword}`, {
            actions: ['highlight', 'notify'],
            conditions: [
              {
                kind: 'event_match',
                key: 'room_id',
                pattern: props.roomId
              },
              {
                kind: 'contains_display_name'
              }
            ],
            pattern: keyword
          })
        }
      }
    }

    // Enable/disable rules based on settings
    if (setPushRuleEnabledMethod) {
      await setPushRuleEnabledMethod.call(client, 'override', 'room', props.roomId, settings.value.muted)
    }

    message.success('Notification settings saved')
    emit('settingsChanged', settings.value)

    logger.info('[NotificationSettings] Settings saved:', settings.value)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    message.error(`Failed to save settings: ${errorMessage}`)
    logger.error('[NotificationSettings] Failed to save settings:', err)
  } finally {
    isSaving.value = false
  }
}

// Keyword management
function addKeyword(): void {
  const keyword = newKeywordInput.value.trim()
  if (!keyword) return

  if (settings.value.keywords.includes(keyword)) {
    message.warning('This keyword already exists')
    return
  }

  settings.value.keywords.push(keyword)
  newKeywordInput.value = ''
}

function removeKeyword(keyword: string): void {
  settings.value.keywords = settings.value.keywords.filter((k) => k !== keyword)
}

function handleSaveAndClose(): void {
  saveNotificationSettings().then(() => {
    if (!error.value) {
      show.value = false
    }
  })
}

// Lifecycle
onMounted(() => {
  if (props.show) {
    loadNotificationSettings()
  }
})

watch(
  () => props.show,
  (newShow) => {
    if (newShow) {
      loadNotificationSettings()
    }
  }
)

watch(
  () => props.roomId,
  () => {
    if (props.show) {
      loadNotificationSettings()
    }
  }
)
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    title="Notification Settings"
    class="modal-small"
    :mask-closable="false"
    :segmented="{ content: 'soft' }">
    <template #header-extra>
      <NIcon v-if="settings.muted" size="20" color="#f0a020">
        <BellOff />
      </NIcon>
      <NIcon v-else size="20" color="#18a058">
        <Bell />
      </NIcon>
    </template>

    <!-- Error Alert -->
    <NAlert v-if="hasError" type="error" :title="error" closable @close="error = ''" class="alert-spacing" />

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-container">
      <NSpin size="large" />
      <div class="loading-text">Loading notification settings...</div>
    </div>

    <!-- Settings Content -->
    <template v-else>
      <!-- Mute Section -->
      <div class="setting-section">
        <div class="setting-header">
          <div class="setting-title">
            <NIcon size="18" class="icon-spacing">
              <BellOff v-if="settings.muted" />
              <Bell v-else />
            </NIcon>
            <span>Mute Notifications</span>
          </div>
          <NSwitch v-model:value="settings.muted" :disabled="isSaving" />
        </div>
        <div class="setting-description">
          {{
            settings.muted
              ? "This room is muted. You won't receive any notifications."
              : 'Enable to mute all notifications from this room.'
          }}
        </div>
      </div>

      <NDivider class="divider-spacing" />

      <!-- Highlight Section -->
      <div class="setting-section">
        <div class="setting-header">
          <div class="setting-title">
            <span>Message Highlights</span>
          </div>
          <NSwitch v-model:value="settings.highlightEnabled" :disabled="settings.muted || isSaving" />
        </div>
        <div class="setting-description">Highlight messages that mention you or match specific keywords</div>

        <div v-if="settings.highlightEnabled && !settings.muted" class="setting-content">
          <div class="input-container">
            <label class="label-text">Highlight Mode</label>
            <NSelect
              v-model:value="settings.highlightMode"
              :options="highlightOptions"
              :disabled="isSaving"
              class="select-spacing" />

            <!-- Keyword List (when highlightMode is 'keywords') -->
            <div v-if="settings.highlightMode === 'keywords'" class="keyword-list">
              <div v-if="settings.keywords.length > 0" class="keyword-tags">
                <NTag
                  v-for="keyword in settings.keywords"
                  :key="keyword"
                  closable
                  type="info"
                  size="small"
                  @close="removeKeyword(keyword)"
                  class="tag-spacing">
                  {{ keyword }}
                </NTag>
              </div>
              <div v-else class="keyword-placeholder">
                No keywords set. Add keywords below to highlight messages containing them.
              </div>

              <div class="keyword-input-row">
                <NInput
                  v-model:value="newKeywordInput"
                  placeholder="Add keyword..."
                  :disabled="isSaving"
                  size="small"
                  @keyup.enter="addKeyword"
                  class="flex-1" />
                <NButton size="small" :disabled="isSaving || !newKeywordInput.trim()" @click="addKeyword">Add</NButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <NDivider class="divider-spacing" />

      <!-- Sound Section -->
      <div class="setting-section">
        <div class="setting-header">
          <div class="setting-title">
            <NIcon size="18" class="icon-spacing">
              <Volume3 v-if="!settings.soundEnabled || settings.soundType === 'silent'" />
              <Volume v-else />
            </NIcon>
            <span>Notification Sound</span>
          </div>
          <NSwitch v-model:value="settings.soundEnabled" :disabled="settings.muted || isSaving" />
        </div>
        <div class="setting-description">Play a sound when you receive a notification from this room</div>

        <div v-if="settings.soundEnabled && !settings.muted" class="setting-content">
          <NSelect
            v-model:value="settings.soundType"
            :options="soundOptions"
            :disabled="isSaving"
            class="select-narrow" />
        </div>
      </div>

      <NDivider class="divider-spacing" />

      <!-- Desktop Notifications -->
      <div class="setting-section">
        <div class="setting-header">
          <div class="setting-title">Desktop Notifications</div>
          <NSwitch v-model:value="settings.desktopEnabled" :disabled="settings.muted || isSaving" />
        </div>
        <div class="setting-description">Show desktop notifications for messages in this room</div>
      </div>

      <NDivider class="divider-spacing" />

      <!-- Mobile Notifications -->
      <div class="setting-section">
        <div class="setting-header">
          <div class="setting-title">Mobile Notifications</div>
          <NSwitch v-model:value="settings.mobileEnabled" :disabled="settings.muted || isSaving" />
        </div>
        <div class="setting-description">Show push notifications on mobile devices for this room</div>
      </div>
    </template>

    <!-- Actions -->
    <template #footer>
      <NSpace justify="end" class="width-full">
        <NButton @click="show = false" :disabled="isSaving">Cancel</NButton>
        <NPopconfirm
          v-if="hasChanges"
          @positive-click="handleSaveAndClose"
          negative-text="Continue Editing"
          positive-text="Save & Close">
          <template #trigger>
            <NButton type="primary" :loading="isSaving" @click="handleSaveAndClose">Save Changes</NButton>
          </template>
          You have unsaved changes. Save and close?
        </NPopconfirm>
        <NButton v-else type="primary" disabled>Save Changes</NButton>
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
}

.keyword-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* Inline style replacements */
.modal-small {
  width: 600px;
}

.alert-spacing {
  margin-bottom: 16px;
}

.loading-container {
  text-align: center;
  padding: 40px 0;
}

.loading-text {
  margin-top: 16px;
  color: #999;
}

.icon-spacing {
  margin-right: 8px;
}

.divider-spacing {
  margin: 20px 0;
}

.input-container {
  margin-top: 12px;
}

.label-text {
  font-size: 13px;
  color: #666;
  display: block;
  margin-bottom: 8px;
}

.select-spacing {
  margin-bottom: 12px;
}

.tag-spacing {
  margin: 4px;
}

.keyword-placeholder {
  color: #999;
  font-size: 12px;
  font-style: italic;
}

.keyword-input-row {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

.flex-1 {
  flex: 1;
}

.select-narrow {
  margin-top: 12px;
  width: 200px;
}

.width-full {
  width: 100%;
}
</style>
