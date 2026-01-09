<template>
  <div class="private-chat-settings">
    <!-- E2EE 设置部分 -->
    <div class="settings-section">
      <div class="section-header">
        <h3 class="section-title">
          <svg class="size-18px">
            <use href="#lock"></use>
          </svg>
          {{ t('privateChat.settings.e2ee_title') }}
        </h3>
        <n-switch v-model:value="e2eeEnabled" :disabled="e2eeEnabled" @update:value="handleToggleE2EE" />
      </div>

      <div class="section-content">
        <div v-if="e2eeEnabled" class="e2ee-enabled">
          <div class="info-item">
            <span class="info-label">{{ t('privateChat.settings.encryption_algorithm') }}</span>
            <span class="info-value">AES-GCM-256</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('privateChat.settings.key_derivation') }}</span>
            <span class="info-value">PBKDF2 (100,000 iterations)</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('privateChat.settings.key_rotation') }}</span>
            <span class="info-value">{{ t('privateChat.settings.every_24_hours') }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('privateChat.settings.key_expiration') }}</span>
            <span class="info-value">{{ t('privateChat.settings.7_days') }}</span>
          </div>
        </div>
        <div v-else class="e2ee-disabled">
          <n-alert type="warning" :bordered="false">
            {{ t('privateChat.settings.e2ee_disabled_warning') }}
          </n-alert>
        </div>
      </div>
    </div>

    <!-- 存储设置部分 -->
    <div class="settings-section">
      <div class="section-header">
        <h3 class="section-title">
          <svg class="size-18px">
            <use href="#database"></use>
          </svg>
          {{ t('privateChat.settings.storage_title') }}
        </h3>
        <n-switch v-model:value="storageEnabled" :disabled="storageEnabled" @update:value="handleToggleStorage" />
      </div>

      <div class="section-content">
        <div v-if="storageEnabled" class="storage-enabled">
          <div class="info-item">
            <span class="info-label">{{ t('privateChat.settings.storage_type') }}</span>
            <span class="info-value">{{ storageType }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('privateChat.settings.storage_used') }}</span>
            <span class="info-value">{{ formatBytes(storageUsed) }} / {{ formatBytes(storageQuota) }}</span>
          </div>
          <!-- 存储使用进度条 -->
          <div class="storage-progress">
            <n-progress
              type="line"
              :percentage="storageUsagePercentage"
              :color="getStorageColor(storageUsagePercentage)"
              :show-indicator="false" />
            <span class="progress-text">{{ storageUsagePercentage.toFixed(1) }}%</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('privateChat.settings.messages_cached') }}</span>
            <span class="info-value">{{ cachedMessagesCount }}</span>
          </div>
          <div class="storage-actions">
            <n-button size="small" type="warning" @click="handleClearCache" :loading="isClearingCache">
              <template #icon>
                <svg class="size-14px">
                  <use href="#trash"></use>
                </svg>
              </template>
              {{ t('privateChat.settings.clear_cache') }}
            </n-button>
          </div>
        </div>
        <div v-else class="storage-disabled">
          <n-alert type="info" :bordered="false">
            {{ t('privateChat.settings.storage_disabled_info') }}
          </n-alert>
        </div>
      </div>
    </div>

    <!-- 同步设置部分 -->
    <div class="settings-section">
      <div class="section-header">
        <h3 class="section-title">
          <svg class="size-18px">
            <use href="#sync"></use>
          </svg>
          {{ t('privateChat.settings.sync_title') }}
        </h3>
      </div>

      <div class="section-content">
        <div class="info-item">
          <span class="info-label">{{ t('privateChat.settings.last_sync') }}</span>
          <span class="info-value">{{ lastSyncTime }}</span>
        </div>
        <div class="sync-actions">
          <n-button size="small" @click="handleSyncNow" :loading="isSyncing">
            <template #icon>
              <svg class="size-14px">
                <use href="#refresh"></use>
              </svg>
            </template>
            {{ t('privateChat.settings.sync_now') }}
          </n-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePrivateChatSDKStore } from '@/stores/privateChatSDK'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const privateChatStore = usePrivateChatSDKStore()

// 状态
const e2eeEnabled = ref(false)
const storageEnabled = ref(false)
const storageUsed = ref(0)
const storageQuota = ref(0)
const cachedMessagesCount = ref(0)
const lastSyncTime = ref<string>('-')
const isClearingCache = ref(false)
const isSyncing = ref(false)

// 计算属性
const storageType = computed(() => {
  // 检测存储类型
  try {
    if ('indexedDB' in window) {
      return 'IndexedDB'
    }
  } catch {
    return 'localStorage'
  }
  return 'Unknown'
})

const storageUsagePercentage = computed(() => {
  if (storageQuota.value === 0) return 0
  return (storageUsed.value / storageQuota.value) * 100
})

// 方法
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / k ** i) * 100) / 100 + ' ' + sizes[i]
}

const getStorageColor = (percentage: number): string => {
  if (percentage < 50) return 'var(--hula-brand-primary)'
  if (percentage < 80) return 'var(--hula-brand-primary)'
  return 'var(--hula-brand-primary)'
}

const handleToggleE2EE = async (value: boolean) => {
  if (value) {
    // 启用 E2EE
    msg.info(t('privateChat.settings.e2ee_enabling'))
    // 实际实现需要调用 SDK 初始化 E2EE
    logger.info('[PrivateChatSettings] Enabling E2EE')
  } else {
    msg.warning(t('privateChat.settings.e2ee_disable_warning'))
  }
}

const handleToggleStorage = async (value: boolean) => {
  if (value) {
    msg.info(t('privateChat.settings.storage_enabling'))
    // 实际实现需要调用 SDK 初始化存储
    logger.info('[PrivateChatSettings] Enabling storage')
  } else {
    msg.warning(t('privateChat.settings.storage_disable_warning'))
  }
}

const handleClearCache = async () => {
  isClearingCache.value = true
  try {
    // 实际实现需要调用 SDK 清除缓存
    await new Promise((resolve) => setTimeout(resolve, 1000))
    storageUsed.value = 0
    cachedMessagesCount.value = 0
    msg.success(t('privateChat.settings.cache_cleared'))
    logger.info('[PrivateChatSettings] Storage cache cleared')
  } catch (error) {
    msg.error(t('privateChat.settings.clear_cache_failed'))
    logger.error('[PrivateChatSettings] Failed to clear cache:', error)
  } finally {
    isClearingCache.value = false
  }
}

const handleSyncNow = async () => {
  isSyncing.value = true
  try {
    // 实际实现需要调用 SDK 同步方法
    await new Promise((resolve) => setTimeout(resolve, 1000))
    lastSyncTime.value = new Date().toLocaleString()
    msg.success(t('privateChat.settings.sync_completed'))
    logger.info('[PrivateChatSettings] Sync completed')
  } catch (error) {
    msg.error(t('privateChat.settings.sync_failed'))
    logger.error('[PrivateChatSettings] Sync failed:', error)
  } finally {
    isSyncing.value = false
  }
}

// 生命周期
onMounted(() => {
  // 检查 E2EE 和存储状态
  e2eeEnabled.value = false // 实际需要从 SDK 获取
  storageEnabled.value = true // 实际需要从 SDK 获取

  // 获取存储信息
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    navigator.storage.estimate().then((estimate) => {
      storageUsed.value = estimate.usage || 0
      storageQuota.value = estimate.quota || 0
    })
  }

  // 计算缓存的消息数量
  cachedMessagesCount.value = Array.from(privateChatStore.messages.values()).reduce((sum, msgs) => sum + msgs.length, 0)
})
</script>

<style scoped lang="scss">
.private-chat-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.settings-section {
  background: var(--card-color);
  border-radius: 8px;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--line-color);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.section-content {
  padding: 16px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.info-label {
  font-size: 14px;
  color: var(--text-color-2);
}

.info-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color-1);
}

.e2ee-enabled,
.storage-enabled {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.e2ee-disabled,
.storage-disabled {
  padding: 8px 0;
}

.storage-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;

  .progress-text {
    font-size: 12px;
    color: var(--text-color-2);
    min-width: 50px;
    text-align: right;
  }
}

.storage-actions,
.sync-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid var(--line-color);
  margin-top: 8px;
}
</style>
