<template>
  <div class="notification-scheduler">
    <n-card title="通知调度" :bordered="false">
      <!-- Quiet Hours Section -->
      <div class="section">
        <div class="section-header">
          <h3>免打扰时段</h3>
          <n-switch v-model:value="quietHours.enabled" @update:value="handleQuietHoursToggle" />
        </div>
        <p class="section-desc">在指定时间段内静音通知</p>

        <div v-if="quietHours.enabled" class="quiet-hours-config">
          <n-form-item label="开始时间">
            <n-time-picker
              v-model:value="startTimeValue"
              format="HH:mm"
              @update:value="(value: number | null) => handleStartTimeChange(value ? formatTime(value) : null)" />
          </n-form-item>

          <n-form-item label="结束时间">
            <n-time-picker
              v-model:value="endTimeValue"
              format="HH:mm"
              @update:value="(value: number | null) => handleEndTimeChange(value ? formatTime(value) : null)" />
          </n-form-item>

          <n-form-item label="允许紧急通知">
            <n-switch v-model:value="quietHours.allowEmergency" @update:value="handleQuietHoursUpdate" />
            <template #feedback>在免打扰时段内仍允许紧急警报通知</template>
          </n-form-item>

          <div class="quiet-hours-preview">
            <n-alert type="info" :title="quietHoursPreview">
              {{ quietHoursActive ? '（当前生效中）' : '' }}
            </n-alert>
          </div>
        </div>
      </div>

      <!-- Scheduled Notifications Section -->
      <div class="section">
        <div class="section-header">
          <h3>定时通知</h3>
          <n-button type="primary" size="small" @click="showAddDialog = true">
            <template #icon>
              <n-icon><Plus /></n-icon>
            </template>
            添加
          </n-button>
        </div>
        <p class="section-desc">设置在特定时间发送的通知提醒</p>

        <div class="scheduled-list">
          <n-list v-if="scheduledNotifications.length > 0">
            <n-list-item v-for="notification in scheduledNotifications" :key="notification.id">
              <template #prefix>
                <div class="notification-icon" :class="`type-${notification.type}`">
                  <n-icon size="20">
                    <Bell v-if="notification.type === 'reminder'" />
                    <AlertTriangle v-else-if="notification.type === 'alert'" />
                    <Message v-else />
                  </n-icon>
                </div>
              </template>

              <div class="notification-content">
                <div class="notification-header">
                  <span class="notification-title">{{ notification.title }}</span>
                  <n-switch
                    :value="notification.enabled"
                    size="small"
                    @update:value="(value) => handleToggleNotification(notification.id, value)" />
                </div>
                <div class="notification-meta">
                  <span class="notification-time">{{ formatScheduledTime(notification.scheduledTime) }}</span>
                  <span v-if="notification.repeat && notification.repeat !== 'none'" class="notification-repeat">
                    {{ getRepeatLabel(notification.repeat) }}
                  </span>
                </div>
                <div v-if="notification.content" class="notification-body">
                  {{ notification.content }}
                </div>
              </div>

              <template #suffix>
                <n-dropdown
                  :options="getNotificationActions(notification)"
                  @select="(key) => handleNotificationAction(key, notification)">
                  <n-button quaternary circle size="small">
                    <template #icon>
                      <n-icon><DotsVertical /></n-icon>
                    </template>
                  </n-button>
                </n-dropdown>
              </template>
            </n-list-item>
          </n-list>
          <n-empty v-else description="暂无定时通知" size="small" />
        </div>
      </div>
    </n-card>

    <!-- Add/Edit Dialog -->
    <n-modal
      v-model:show="showAddDialog"
      :title="editingNotification ? '编辑定时通知' : '添加定时通知'"
      preset="card"
      style="width: 500px">
      <n-form ref="formRef" :model="formData" :rules="formRules" label-placement="top">
        <n-form-item label="标题" path="title">
          <n-input v-model:value="formData.title" placeholder="输入通知标题" />
        </n-form-item>

        <n-form-item label="内容" path="content">
          <n-input v-model:value="formData.content" type="textarea" placeholder="输入通知内容（可选）" :rows="3" />
        </n-form-item>

        <n-form-item label="类型" path="type">
          <n-select v-model:value="formData.type" :options="typeOptions" @update:value="handleTypeChange" />
        </n-form-item>

        <n-form-item label="时间" path="scheduledTime">
          <n-date-picker
            v-model:value="scheduledDateValue"
            type="datetime"
            format="yyyy-MM-dd HH:mm"
            placeholder="选择通知时间"
            @update:value="handleDateChange" />
        </n-form-item>

        <n-form-item label="重复" path="repeat">
          <n-select v-model:value="formData.repeat" :options="repeatOptions" />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space>
          <n-button @click="showAddDialog = false">取消</n-button>
          <n-button type="primary" @click="handleSaveNotification" :loading="saving">
            {{ editingNotification ? '保存' : '添加' }}
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  NCard,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NButton,
  NSwitch,
  NIcon,
  NList,
  NListItem,
  NEmpty,
  NTimePicker,
  NAlert,
  NSpace,
  NModal,
  NDatePicker,
  NDropdown,
  useMessage,
  useDialog,
  type FormRules,
  type FormInst
} from 'naive-ui'
import { Plus, Bell, AlertTriangle, Message, DotsVertical } from '@vicons/tabler'
import notificationScheduler, { type ScheduledNotification, type QuietHours } from '@/utils/notificationScheduler'
import { logger } from '@/utils/logger'

const message = useMessage()
const dialog = useDialog()

// State
const quietHours = ref<QuietHours>({
  enabled: false,
  startTime: '22:00',
  endTime: '08:00',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  allowEmergency: true
})

const scheduledNotifications = ref<ScheduledNotification[]>([])
const showAddDialog = ref(false)
const editingNotification = ref<ScheduledNotification | null>(null)
const saving = ref(false)

const formRef = ref<FormInst | null>(null)

// Form data
const formData = ref({
  title: '',
  content: '',
  type: 'reminder' as 'reminder' | 'alert' | 'message',
  scheduledTime: 0,
  repeat: 'none' as 'none' | 'daily' | 'weekly' | 'monthly'
})

const scheduledDateValue = ref<number | null>(null)

// Time picker values
const startTimeValue = ref<number | null>(null)
const endTimeValue = ref<number | null>(null)

// Options
const typeOptions = [
  { label: '提醒', value: 'reminder' },
  { label: '警报', value: 'alert' },
  { label: '消息', value: 'message' }
]

const repeatOptions = [
  { label: '不重复', value: 'none' },
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' }
]

// Form rules
const formRules: FormRules = {
  title: [{ required: true, message: '请输入通知标题', trigger: 'blur' }],
  scheduledTime: [{ required: true, message: '请选择通知时间', trigger: 'blur' }]
}

// Computed
const quietHoursPreview = computed(() => {
  if (!quietHours.value.enabled) {
    return '免打扰已关闭'
  }
  return `${quietHours.value.startTime} - ${quietHours.value.endTime}`
})

const quietHoursActive = computed(() => notificationScheduler.isQuietHoursActive())

// Methods
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const loadSchedule = () => {
  const schedule = notificationScheduler.getSchedule()
  if (schedule) {
    quietHours.value = schedule.quietHours
    scheduledNotifications.value = schedule.scheduledNotifications
  }
}

const handleQuietHoursToggle = (enabled: boolean) => {
  notificationScheduler.updateQuietHours({ enabled })
  quietHours.value.enabled = enabled
  message.info(enabled ? '免打扰已启用' : '免打扰已关闭')
}

const handleStartTimeChange = (value: string | null) => {
  if (value) {
    notificationScheduler.updateQuietHours({ startTime: value })
    quietHours.value.startTime = value
  }
}

const handleEndTimeChange = (value: string | null) => {
  if (value) {
    notificationScheduler.updateQuietHours({ endTime: value })
    quietHours.value.endTime = value
  }
}

const handleQuietHoursUpdate = () => {
  notificationScheduler.updateQuietHours(quietHours.value)
}

const formatScheduledTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const scheduledDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  let dateStr = ''
  if (scheduledDate.getTime() === today.getTime()) {
    dateStr = '今天 '
  } else if (scheduledDate.getTime() === tomorrow.getTime()) {
    dateStr = '明天 '
  } else {
    dateStr = `${date.getMonth() + 1}/${date.getDate()} `
  }

  const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return `${dateStr}${timeStr}`
}

const getRepeatLabel = (repeat: string): string => {
  const labels: Record<string, string> = {
    none: '不重复',
    daily: '每天',
    weekly: '每周',
    monthly: '每月'
  }
  return labels[repeat] || repeat
}

const handleToggleNotification = (id: string, enabled: boolean) => {
  notificationScheduler.toggleScheduledNotification(id, enabled)
  const notification = scheduledNotifications.value.find((n) => n.id === id)
  if (notification) {
    notification.enabled = enabled
  }
  message.info(enabled ? '通知已启用' : '通知已禁用')
}

const getNotificationActions = (_notification: ScheduledNotification) => [
  {
    label: '编辑',
    key: 'edit'
  },
  {
    label: '删除',
    key: 'delete'
  }
]

const handleNotificationAction = (key: string, notification: ScheduledNotification) => {
  switch (key) {
    case 'edit':
      openEditDialog(notification)
      break
    case 'delete':
      dialog.warning({
        title: '确认删除',
        content: '确定要删除此定时通知吗？',
        positiveText: '删除',
        negativeText: '取消',
        onPositiveClick: () => {
          notificationScheduler.removeScheduledNotification(notification.id)
          scheduledNotifications.value = scheduledNotifications.value.filter((n) => n.id !== notification.id)
          message.success('定时通知已删除')
        }
      })
      break
  }
}

const openEditDialog = (notification: ScheduledNotification) => {
  editingNotification.value = notification
  formData.value = {
    title: notification.title,
    content: notification.content || '',
    type: notification.type,
    scheduledTime: notification.scheduledTime,
    repeat: notification.repeat || 'none'
  }
  scheduledDateValue.value = notification.scheduledTime
  showAddDialog.value = true
}

const handleTypeChange = () => {
  // Handle type change if needed
}

const handleDateChange = (value: number | null) => {
  if (value) {
    formData.value.scheduledTime = value
  } else {
    formData.value.scheduledTime = 0
  }
}

const handleSaveNotification = async () => {
  try {
    await formRef.value?.validate()

    saving.value = true

    if (editingNotification.value) {
      notificationScheduler.updateScheduledNotification(editingNotification.value.id, {
        ...formData.value
      })

      // Update local list
      const index = scheduledNotifications.value.findIndex((n) => n.id === editingNotification.value!.id)
      if (index !== -1) {
        scheduledNotifications.value[index] = {
          ...scheduledNotifications.value[index],
          ...formData.value
        }
      }

      message.success('定时通知已更新')
    } else {
      const id = notificationScheduler.addScheduledNotification({
        ...formData.value,
        enabled: true
      })

      scheduledNotifications.value.push({
        id,
        ...formData.value,
        enabled: true
      })

      message.success('定时通知已添加')
    }

    showAddDialog.value = false
    resetForm()
  } catch (error) {
    logger.error('[NotificationScheduler] Failed to save notification:', error)
  } finally {
    saving.value = false
  }
}

const resetForm = () => {
  formData.value = {
    title: '',
    content: '',
    type: 'reminder',
    scheduledTime: 0,
    repeat: 'none'
  }
  scheduledDateValue.value = null
  editingNotification.value = null
  formRef.value?.restoreValidation()
}

// Lifecycle
onMounted(async () => {
  await notificationScheduler.initialize()
  loadSchedule()

  // Request notification permission
  await notificationScheduler.requestPermission()
})

onUnmounted(() => {
  notificationScheduler.stopMonitoring()
})
</script>

<style lang="scss" scoped>
.notification-scheduler {
  .section {
    margin-bottom: 32px;
    padding-bottom: 32px;
    border-bottom: 1px solid var(--divider-color);

    &:last-of-type {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;

      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
    }

    .section-desc {
      margin: 0 0 16px 0;
      font-size: 13px;
      color: var(--text-color-3);
    }
  }

  .quiet-hours-config {
    .quiet-hours-preview {
      margin-top: 16px;
    }
  }

  .scheduled-list {
    margin-top: 16px;

    .notification-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;

      &.type-reminder {
        background: rgba(24, 160, 88, 0.1);
        color: #18a058;
      }

      &.type-alert {
        background: rgba(208, 48, 80, 0.1);
        color: #d03050;
      }

      &.type-message {
        background: rgba(51, 136, 255, 0.1);
        color: #3388ff;
      }
    }

    .notification-content {
      flex: 1;

      .notification-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;

        .notification-title {
          font-weight: 500;
        }
      }

      .notification-meta {
        display: flex;
        gap: 12px;
        font-size: 12px;
        color: var(--text-color-3);

        .notification-repeat {
          color: var(--primary-color);
        }
      }

      .notification-body {
        margin-top: 8px;
        font-size: 13px;
        color: var(--text-color-2);
      }
    }
  }
}
</style>
