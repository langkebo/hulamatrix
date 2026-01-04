<!-- Mobile Search History - Search history management for mobile -->
<template>
  <div class="mobile-search-history">
    <!-- Search History List -->
    <div v-if="searchHistory.length > 0" class="history-section">
      <div class="section-header">
        <span class="section-title">最近搜索</span>
        <n-button text size="small" @click="handleClearAll">
          <template #icon>
            <n-icon><Trash /></n-icon>
          </template>
          清空
        </n-button>
      </div>

      <div class="history-list">
        <div
          v-for="item in displayHistory"
          :key="item.id"
          class="history-item"
          @click="handleSelectHistory(item)"
        >
          <div class="item-left">
            <n-icon size="18" class="history-icon">
              <Clock />
            </n-icon>
            <div class="item-content">
              <div class="item-query">{{ item.query }}</div>
              <div class="item-meta">
                <span class="item-type">{{ getTypeLabel(item.type) }}</span>
                <span class="item-time">{{ formatTime(item.timestamp) }}</span>
              </div>
            </div>
          </div>
          <div class="item-right">
            <n-button text size="small" @click.stop="handleDeleteItem(item)">
              <template #icon>
                <n-icon><X /></n-icon>
              </template>
            </n-button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <n-empty description="暂无搜索历史">
        <template #icon>
          <n-icon size="48">
            <Clock />
          </n-icon>
        </template>
      </n-empty>
    </div>

    <!-- Clear All Confirmation Dialog -->
    <n-modal v-model:show="showClearDialog" preset="dialog" title="清空搜索历史">
      <div class="clear-dialog-content">
        <n-alert type="warning" class="mb-3">
          确定要清空所有搜索历史吗？此操作不可撤销。
        </n-alert>
        <div class="history-stats">
          <div class="stat-item">
            <span class="stat-label">总记录数</span>
            <span class="stat-value">{{ searchHistory.length }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">消息搜索</span>
            <span class="stat-value">{{ getHistoryCount('message') }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">用户搜索</span>
            <span class="stat-value">{{ getHistoryCount('user') }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">房间搜索</span>
            <span class="stat-value">{{ getHistoryCount('room') }}</span>
          </div>
        </div>
      </div>
      <template #action>
        <n-button @click="showClearDialog = false">取消</n-button>
        <n-button type="error" :loading="isClearing" @click="confirmClearAll">
          清空全部
        </n-button>
      </template>
    </n-modal>

    <!-- Settings Modal -->
    <n-modal v-model:show="showSettingsModal" preset="card" title="搜索历史设置">
      <div class="settings-content">
        <n-form-item label="历史记录保留时间">
          <n-select
            v-model:value="settings.retentionDays"
            :options="retentionOptions"
            @update:value="handleUpdateSettings"
          />
        </n-form-item>
        <n-form-item label="最大记录数量">
          <n-input-number
            v-model:value="settings.maxItems"
            :min="10"
            :max="500"
            :step="10"
            @update:value="handleUpdateSettings"
          />
        </n-form-item>
        <n-checkbox v-model:checked="settings.saveMessageSearch" @update:checked="handleUpdateSettings">
          保存消息搜索历史
        </n-checkbox>
        <n-checkbox v-model:checked="settings.saveUserSearch" @update:checked="handleUpdateSettings">
          保存用户搜索历史
        </n-checkbox>
        <n-checkbox v-model:checked="settings.saveRoomSearch" @update:checked="handleUpdateSettings">
          保存房间搜索历史
        </n-checkbox>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  NButton,
  NIcon,
  NEmpty,
  NModal,
  NAlert,
  NForm,
  NFormItem,
  NInputNumber,
  NSelect,
  NCheckbox,
  useDialog,
  useMessage
} from 'naive-ui'
import { Clock, Trash, X } from '@vicons/tabler'
import { useSearchHistory, type SearchHistoryItem, type SearchType } from '@/composables/useSearchHistory'
import { formatSearchTime, getSearchTypeLabel } from '@/composables/useSearchHistory'

// ==================== Props & Emits ====================

interface Props {
  type?: SearchType
  showSettings?: boolean
}

interface Emits {
  (e: 'select', item: SearchHistoryItem): void
  (e: 'clear'): void
}

const props = withDefaults(defineProps<Props>(), {
  type: 'all',
  showSettings: true
})

const emit = defineEmits<Emits>()

const dialog = useDialog()
const message = useMessage()

// ==================== Use Composable ====================

const { searchHistory, settings, historyCount, clearHistory, getHistoryByType, cleanOldHistory, updateSettings } =
  useSearchHistory()

// ==================== State ====================

const showClearDialog = ref(false)
const showSettingsModal = ref(false)
const isClearing = ref(false)

const retentionOptions = [
  { label: '7天', value: 7 },
  { label: '14天', value: 14 },
  { label: '30天', value: 30 },
  { label: '60天', value: 60 },
  { label: '永久', value: 0 }
]

// ==================== Computed ====================

const displayHistory = computed(() => {
  return getHistoryByType(props.type)
})

// ==================== Methods ====================

/**
 * Handle selecting a history item
 */
const handleSelectHistory = (item: SearchHistoryItem) => {
  emit('select', item)
}

/**
 * Handle deleting a single history item
 */
const handleDeleteItem = (item: SearchHistoryItem) => {
  const { removeHistory } = useSearchHistory()
  removeHistory(item.id)
  message.success('已删除搜索记录')
}

/**
 * Handle clearing all history
 */
const handleClearAll = () => {
  showClearDialog.value = true
}

/**
 * Confirm clearing all history
 */
const confirmClearAll = () => {
  isClearing.value = true
  try {
    clearHistory()
    showClearDialog.value = false
    emit('clear')
    message.success('搜索历史已清空')
  } catch (error) {
    message.error('清空失败')
  } finally {
    isClearing.value = false
  }
}

/**
 * Get count by type
 */
const getHistoryCount = (type: SearchType): number => {
  const { messageSearchCount, userSearchCount, roomSearchCount } = useSearchHistory()
  switch (type) {
    case 'message':
      return messageSearchCount.value
    case 'user':
      return userSearchCount.value
    case 'room':
      return roomSearchCount.value
    default:
      return historyCount.value
  }
}

/**
 * Get type label
 */
const getTypeLabel = (type: SearchType): string => {
  return getSearchTypeLabel(type)
}

/**
 * Format timestamp to relative time
 */
const formatTime = (timestamp: number): string => {
  return formatSearchTime(timestamp)
}

/**
 * Handle settings update
 */
const handleUpdateSettings = () => {
  updateSettings(settings.value)
  cleanOldHistory()
  message.success('设置已保存')
}

// ==================== Expose ====================

defineExpose({
  openSettings: () => {
    showSettingsModal.value = true
  }
})
</script>

<style scoped lang="scss">
.mobile-search-history {
  width: 100%;
  padding: 0;
}

.history-section {
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-1);
    }
  }

  .history-list {
    padding: 0 16px 16px;
  }
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  margin-bottom: 8px;
  background: var(--card-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:active {
    background: var(--item-hover-bg);
    transform: scale(0.98);
  }
}

.item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.history-icon {
  color: var(--text-color-3);
  flex-shrink: 0;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-query {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-color-1);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.item-type {
  color: var(--primary-color);
  background: var(--primary-color-hover);
  padding: 2px 6px;
  border-radius: 4px;
}

.item-time {
  color: var(--text-color-3);
}

.item-right {
  flex-shrink: 0;
}

.empty-state {
  padding: 48px 16px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.clear-dialog-content {
  .history-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-top: 16px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    background: var(--item-hover-bg);
    border-radius: 8px;
  }

  .stat-label {
    font-size: 12px;
    color: var(--text-color-3);
  }

  .stat-value {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-color-1);
  }
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 16px;

  :deep(.n-form-item) {
    margin-bottom: 0;
  }
}

// Safe area for mobile
@supports (padding: env(safe-area-inset-bottom)) {
  .history-list {
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
  }
}
</style>
