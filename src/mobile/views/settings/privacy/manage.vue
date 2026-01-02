<template>
  <SettingsLayout :title="t('setting.privacy.manage_title')" :loading="loading">
    <div class="privacy-manage">
      <!-- Tabs -->
      <div class="tab-bar">
        <div
          v-for="tab in tabs"
          :key="tab.key"
          :class="['tab-item', { 'tab-item--active': activeTab === tab.key }]"
          @click="activeTab = tab.key">
          <div class="tab-item__label">{{ tab.label }}</div>
          <div v-if="getCount(tab.key) > 0" class="tab-item__badge">{{ getCount(tab.key) }}</div>
        </div>
      </div>

      <!-- Blocked Users Tab -->
      <div v-if="activeTab === 'blockedUsers'" class="tab-content">
        <div v-if="blockedUsers.length === 0" class="empty-state">
          <Icon name="user" :size="48" />
          <p>{{ t('setting.privacy.no_blocked_users') }}</p>
        </div>
        <div v-else class="list">
          <div
            v-for="user in blockedUsers"
            :key="user.mxid"
            class="list-item">
            <div class="item-content">
              <div class="item-label">{{ user.mxid }}</div>
            </div>
            <n-button size="small" type="error" ghost @click="handleUnblockUser(user.mxid)">
              {{ t('setting.privacy.unblock') }}
            </n-button>
          </div>
        </div>
      </div>

      <!-- Blocked Rooms Tab -->
      <div v-if="activeTab === 'blockedRooms'" class="tab-content">
        <div v-if="blockedRooms.length === 0" class="empty-state">
          <Icon name="hash" :size="48" />
          <p>{{ t('setting.privacy.no_blocked_rooms') }}</p>
        </div>
        <div v-else class="list">
          <div
            v-for="room in blockedRooms"
            :key="room.roomId"
            class="list-item">
            <div class="item-content">
              <div class="item-label">{{ room.roomId }}</div>
            </div>
            <n-button size="small" type="error" ghost @click="handleUnblockRoom(room.roomId)">
              {{ t('setting.privacy.unblock') }}
            </n-button>
          </div>
        </div>
      </div>

      <!-- Reports Tab -->
      <div v-if="activeTab === 'reports'" class="tab-content">
        <div v-if="reports.length === 0" class="empty-state">
          <Icon name="alert-circle" :size="48" />
          <p>{{ t('setting.privacy.no_reports') }}</p>
        </div>
        <div v-else class="list">
          <div
            v-for="report in reports"
            :key="report.target + report.time"
            class="list-item list-item--vertical">
            <div class="report-header">
              <span class="report-target">{{ report.target }}</span>
              <span class="report-time">{{ formatTime(report.time) }}</span>
            </div>
            <div v-if="report.reason" class="report-reason">{{ report.reason }}</div>
          </div>
        </div>
      </div>
    </div>
  </SettingsLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, useMessage } from 'naive-ui'
import SettingsLayout from '#/views/settings/SettingsLayout.vue'
import Icon from '#/components/icons/Icon.vue'
import {
  listBlockedUsers,
  listBlockedRooms,
  listReports,
  unblockUser,
  unblockRoom
} from '@/integrations/synapse/privacy'
import { logger } from '@/utils/logger'

interface BlockedUser {
  mxid: string
  [key: string]: unknown
}

interface BlockedRoom {
  roomId: string
  [key: string]: unknown
}

interface Report {
  target: string
  reason: string
  time: string
  [key: string]: unknown
}

const { t } = useI18n()
const message = useMessage()

const loading = ref(false)
const activeTab = ref('blockedUsers')
const blockedUsers = ref<BlockedUser[]>([])
const blockedRooms = ref<BlockedRoom[]>([])
const reports = ref<Report[]>([])

const tabs = [
  { key: 'blockedUsers', label: t('setting.privacy.tab_blocked_users') },
  { key: 'blockedRooms', label: t('setting.privacy.tab_blocked_rooms') },
  { key: 'reports', label: t('setting.privacy.tab_reports') }
]

const getCount = (tab: string) => {
  if (tab === 'blockedUsers') return blockedUsers.value.length
  if (tab === 'blockedRooms') return blockedRooms.value.length
  if (tab === 'reports') return reports.value.length
  return 0
}

const formatTime = (time: string) => {
  try {
    const date = new Date(time)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return t('setting.privacy.today')
    if (days === 1) return t('setting.privacy.yesterday')
    if (days < 7) return t('setting.privacy.days_ago', { n: days })
    return date.toLocaleDateString()
  } catch {
    return time
  }
}

const fetchData = async () => {
  loading.value = true
  try {
    const [users, rooms, reportsData] = await Promise.all([listBlockedUsers(), listBlockedRooms(), listReports()])
    blockedUsers.value = users
    blockedRooms.value = rooms
    reports.value = reportsData
  } catch (error) {
    logger.error('Failed to load privacy data:', error)
    message.error(t('setting.privacy.error_load_failed'))
  } finally {
    loading.value = false
  }
}

const handleUnblockUser = async (mxid: string) => {
  try {
    await unblockUser(mxid)
    await fetchData()
    message.success(t('setting.privacy.unblock_success'))
  } catch (error) {
    logger.error('Failed to unblock user:', error)
    message.error(t('setting.privacy.error_unblock_failed'))
  }
}

const handleUnblockRoom = async (roomId: string) => {
  try {
    await unblockRoom(roomId)
    await fetchData()
    message.success(t('setting.privacy.unblock_success'))
  } catch (error) {
    logger.error('Failed to unblock room:', error)
    message.error(t('setting.privacy.error_unblock_failed'))
  }
}

onMounted(fetchData)
</script>

<style lang="scss" scoped>
.privacy-manage {
  padding: 0;
}

.tab-bar {
  display: flex;
  background: white;
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 16px;
}

.tab-item {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;

  &:active {
    transform: scale(0.98);
  }

  &--active {
    background: var(--primary-color);

    .tab-item__label {
      color: white;
      font-weight: 500;
    }

    .tab-item__badge {
      background: rgba(255, 255, 255, 0.25);
      color: white;
    }
  }

  &__label {
    font-size: 14px;
    color: #666;
  }

  &__badge {
    position: absolute;
    top: 4px;
    right: 4px;
    min-width: 18px;
    height: 18px;
    padding: 0 6px;
    background: #f56c6c;
    color: white;
    border-radius: 9px;
    font-size: 11px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.tab-content {
  min-height: 200px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: white;
  border-radius: 12px;
  color: #999;

  p {
    margin-top: 12px;
    font-size: 14px;
  }
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-item {
  background: white;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  &--vertical {
    flex-direction: column;
    align-items: flex-start;
  }

  .item-content {
    flex: 1;
    min-width: 0;
  }

  .item-label {
    font-size: 14px;
    color: #333;
    word-break: break-all;
  }
}

.report-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.report-target {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.report-time {
  font-size: 11px;
  color: #999;
}

.report-reason {
  font-size: 13px;
  color: #666;
  line-height: 1.4;
}
</style>
