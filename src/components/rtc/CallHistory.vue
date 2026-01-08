<template>
  <div class="call-history">
    <!-- Header -->
    <div class="history-header">
      <h3>通话记录</h3>
      <div class="header-actions">
        <n-input v-model:value="searchQuery" placeholder="搜索通话记录" clearable size="small" class="search-input">
          <template #prefix>
            <n-icon><Search /></n-icon>
          </template>
        </n-input>
        <n-button v-if="filteredCalls.length > 0" quaternary size="small" @click="showDeleteAllDialog = true">
          <template #icon>
            <n-icon><Trash /></n-icon>
          </template>
        </n-button>
      </div>
    </div>

    <!-- Analytics Overview -->
    <div class="analytics-overview" v-if="analytics.totalCalls > 0">
      <n-grid :cols="4" :x-gap="12" :y-gap="12">
        <n-gi>
          <n-statistic label="总通话" :value="analytics.totalCalls" />
        </n-gi>
        <n-gi>
          <n-statistic label="总时长" :value="formatDuration(analytics.totalDuration)" />
        </n-gi>
        <n-gi>
          <n-statistic label="平均时长" :value="formatDuration(Math.round(analytics.averageDuration))" />
        </n-gi>
        <n-gi>
          <n-statistic label="接通率" :value="`${Math.round(analytics.answerRate)}%`" />
        </n-gi>
      </n-grid>
    </div>

    <!-- Calls List -->
    <div class="calls-list">
      <n-spin :show="loading">
        <div v-if="filteredCalls.length === 0 && !loading" class="empty-state">
          <n-empty description="暂无通话记录" />
        </div>

        <div v-else class="calls-container">
          <!-- Group by date -->
          <div v-for="(calls, date) in groupedCalls" :key="date" class="date-group">
            <div class="date-header">{{ formatDate(date) }}</div>
            <n-list hoverable clickable>
              <n-list-item
                v-for="call in calls"
                :key="call.id"
                @click="handleSelectCall(call)"
                :class="{ 'missed-call': !call.answered && call.direction === 'incoming' }">
                <template #prefix>
                  <div class="call-icon" :class="getCallIconClass(call)">
                    <n-icon size="24">
                      <PhoneCall v-if="call.callType === 'voice' || call.callType === 'group_voice'" />
                      <Video v-else />
                    </n-icon>
                  </div>
                </template>

                <div class="call-info">
                  <div class="call-main">
                    <span class="room-name">{{ call.roomName || call.roomId }}</span>
                    <n-tag v-if="!call.answered && call.direction === 'incoming'" type="error" size="small">
                      未接听
                    </n-tag>
                    <n-tag v-else-if="call.recordingId" type="success" size="small">已录音</n-tag>
                  </div>
                  <div class="call-meta">
                    <span class="call-time">{{ formatTime(call.startTime) }}</span>
                    <span class="call-duration">{{ formatDuration(call.duration) }}</span>
                    <span class="call-participants">{{ call.participants.length }} 位参与者</span>
                  </div>
                </div>

                <template #suffix>
                  <n-dropdown :options="getCallActions(call)" @select="handleCallAction($event, call)">
                    <n-button quaternary circle size="small">
                      <template #icon>
                        <n-icon><DotsVertical /></n-icon>
                      </template>
                    </n-button>
                  </n-dropdown>
                </template>
              </n-list-item>
            </n-list>
          </div>
        </div>
      </n-spin>
    </div>

    <!-- Call Detail Modal -->
    <n-modal v-model:show="showDetailModal" preset="card" title="通话详情" class="call-detail-modal">
      <div v-if="selectedCall" class="call-detail">
        <n-descriptions :column="2" bordered>
          <n-descriptions-item label="房间">
            {{ selectedCall.roomName || selectedCall.roomId }}
          </n-descriptions-item>
          <n-descriptions-item label="类型">
            {{ getCallTypeName(selectedCall.callType) }}
          </n-descriptions-item>
          <n-descriptions-item label="开始时间">
            {{ formatTimestamp(selectedCall.startTime) }}
          </n-descriptions-item>
          <n-descriptions-item label="时长">
            {{ formatDuration(selectedCall.duration) }}
          </n-descriptions-item>
          <n-descriptions-item label="状态">
            <n-tag :type="selectedCall.answered ? 'success' : 'error'">
              {{ selectedCall.answered ? '已接听' : '未接听' }}
            </n-tag>
          </n-descriptions-item>
          <n-descriptions-item label="方向">
            {{ getDirectionName(selectedCall.direction) }}
          </n-descriptions-item>
        </n-descriptions>

        <!-- Recording -->
        <div v-if="selectedCall.recordingId" class="call-recording">
          <h4>录音</h4>
          <audio controls :src="getRecordingUrl(selectedCall.recordingId)" class="audio-player"></audio>
          <n-space>
            <n-button size="small" @click="handleDownloadRecording(selectedCall)">
              <template #icon>
                <n-icon><Download /></n-icon>
              </template>
              下载录音
            </n-button>
          </n-space>
        </div>

        <!-- Participants -->
        <div class="call-participants">
          <h4>参与者</h4>
          <n-avatar-group :options="selectedCall.participants.map((p) => ({ name: p, src: '' }))" :size="32" />
        </div>
      </div>
    </n-modal>

    <!-- Delete All Confirmation Dialog -->
    <n-modal v-model:show="showDeleteAllDialog" preset="dialog" title="确认删除">
      <div>确定要删除所有通话记录吗？此操作不可撤销。</div>
      <template #action>
        <n-button @click="showDeleteAllDialog = false">取消</n-button>
        <n-button type="error" @click="handleDeleteAll" :loading="loading">删除全部</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  NInput,
  NButton,
  NIcon,
  NGrid,
  NGi,
  NStatistic,
  NSpin,
  NEmpty,
  NList,
  NListItem,
  NTag,
  NDropdown,
  NModal,
  NDescriptions,
  NDescriptionsItem,
  NAvatarGroup,
  useDialog,
  useMessage
} from 'naive-ui'
import { Search, Trash, PhoneCall, Video, DotsVertical, Download } from '@vicons/tabler'
import { useCallHistoryStore, type CallHistoryEntry } from '@/stores/callHistory'
import { logger } from '@/utils/logger'
import callRecordingStorage from '@/utils/callRecordingStorage'

const callHistoryStore = useCallHistoryStore()
const dialog = useDialog()
const message = useMessage()

const searchQuery = ref('')
const loading = ref(false)
const showDetailModal = ref(false)
const showDeleteAllDialog = ref(false)
const selectedCall = ref<CallHistoryEntry | null>(null)

// Computed
const filteredCalls = computed(() => {
  if (!searchQuery.value) {
    return callHistoryStore.sortedCalls
  }

  return callHistoryStore.searchCalls(searchQuery.value)
})

const groupedCalls = computed(() => {
  const groups: Record<string, CallHistoryEntry[]> = {}

  for (const call of filteredCalls.value) {
    const date = new Date(call.startTime).toISOString().split('T')[0]
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(call)
  }

  return groups
})

const analytics = computed(() => callHistoryStore.analytics)

// Methods
const handleSelectCall = (call: CallHistoryEntry) => {
  selectedCall.value = call
  showDetailModal.value = true
}

const getCallActions = (call: CallHistoryEntry) => [
  {
    label: '查看详情',
    key: 'view',
    icon: () => '👁️'
  },
  {
    label: '下载录音',
    key: 'download',
    icon: () => '⬇️',
    disabled: !call.recordingId
  },
  {
    label: '删除记录',
    key: 'delete',
    icon: () => '🗑️'
  }
]

const handleCallAction = async (action: string, call: CallHistoryEntry) => {
  switch (action) {
    case 'view':
      handleSelectCall(call)
      break
    case 'download':
      if (call.recordingId) {
        handleDownloadRecording(call)
      }
      break
    case 'delete':
      dialog.warning({
        title: '确认删除',
        content: '确定要删除此通话记录吗？',
        positiveText: '删除',
        negativeText: '取消',
        onPositiveClick: async () => {
          try {
            await callHistoryStore.deleteCall(call.id)
            message.success('通话记录已删除')
          } catch (error) {
            message.error('删除失败')
            logger.error('[CallHistory] Failed to delete call:', error)
          }
        }
      })
      break
  }
}

const handleDownloadRecording = (call: CallHistoryEntry) => {
  if (!call.recordingId) return

  const recording = callHistoryStore.getCallRecording(call.recordingId)
  if (recording) {
    callRecordingStorage.exportRecording(recording)
    message.success('录音下载已开始')
  }
}

const handleDeleteAll = () => {
  dialog.warning({
    title: '确认删除全部',
    content: '此操作将删除所有通话记录和录音，且不可撤销。',
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      loading.value = true
      try {
        await callHistoryStore.deleteAllCalls()
        message.success('所有通话记录已删除')
        showDeleteAllDialog.value = false
      } catch (error) {
        message.error('删除失败')
        logger.error('[CallHistory] Failed to delete all calls:', error)
      } finally {
        loading.value = false
      }
    }
  })
}

const getRecordingUrl = (recordingId: string): string => {
  const recording = callRecordingStorage.getRecording(recordingId)
  return recording?.blobUrl || ''
}

const getCallIconClass = (call: CallHistoryEntry): string => {
  if (!call.answered && call.direction === 'incoming') {
    return 'missed'
  }
  if (call.direction === 'incoming') {
    return 'incoming'
  }
  return 'outgoing'
}

const getCallTypeName = (type: string): string => {
  const types: Record<string, string> = {
    voice: '语音通话',
    video: '视频通话',
    group_voice: '群组语音',
    group_video: '群组视频'
  }
  return types[type] || type
}

const getDirectionName = (direction: string): string => {
  const directions: Record<string, string> = {
    incoming: '呼入',
    outgoing: '呼出',
    internal: '内部'
  }
  return directions[direction] || direction
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return '今天'
  } else if (date.toDateString() === yesterday.toDateString()) {
    return '昨天'
  } else {
    return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  }
}

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  } else if (minutes > 0) {
    return `${minutes}:${String(secs).padStart(2, '0')}`
  } else {
    return `${secs}秒`
  }
}

onMounted(() => {
  logger.info('[CallHistory] Component mounted')
})
</script>

<style lang="scss" scoped>
.call-detail-modal {
  width: 600px;
}

.call-history {
  height: 100%;
  display: flex;
  flex-direction: column;

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;

    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;

      .search-input {
        width: 250px;
      }
    }
  }

  .analytics-overview {
    padding: 0 16px 16px;
  }

  .calls-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 16px 16px;

    .calls-container {
      .date-group {
        margin-bottom: 24px;

        .date-header {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-color-3);
          margin-bottom: 8px;
          padding: 0 4px;
        }

        .missed-call {
          background: rgba(208, 48, 80, 0.1);
        }
      }
    }
  }

  .call-info {
    flex: 1;

    .call-main {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;

      .room-name {
        font-weight: 600;
        color: var(--text-color-1);
      }
    }

    .call-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
      color: var(--text-color-3);

      .call-time {
        font-weight: 500;
      }
    }
  }

  .call-detail {
    .call-recording,
    .call-participants {
      margin-top: 24px;

      h4 {
        margin: 0 0 12px 0;
        font-size: 16px;
        font-weight: 600;
      }

      .audio-player {
        width: 100%;
        margin-bottom: 12px;
      }
    }
  }
}

.call-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  &.missed {
    background: rgba(208, 48, 80, 0.1);
    color: #d03050;
  }

  &.incoming {
    background: rgba(24, 160, 88, 0.1);
    color: #18a058;
  }

  &.outgoing {
    background: rgba(51, 136, 255, 0.1);
    color: #3388ff;
  }
}
</style>
