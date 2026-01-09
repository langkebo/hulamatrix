<template>
  <div class="cache-settings" role="region" :aria-label="t('setting.cache.title', { default: '缓存设置' })">
    <!-- Cache Statistics Overview -->
    <div class="stats-section">
      <h2>{{ t('setting.cache.stats_title', { default: '缓存统计' }) }}</h2>
      <n-grid :cols="3" :x-gap="12" :y-gap="12">
        <n-gi>
          <n-card :bordered="true" class="stat-card">
            <n-statistic :label="t('setting.cache.total_size', { default: '总大小' })">
              <n-number-animation :from="0" :to="stats.totalSize / (1024 * 1024)" :precision="2" />
              <template #suffix>
                <span class="unit-suffix">MB</span>
              </template>
            </n-statistic>
          </n-card>
        </n-gi>
        <n-gi>
          <n-card :bordered="true" class="stat-card">
            <n-statistic :label="t('setting.cache.item_count', { default: '文件数量' })">
              <n-number-animation :from="0" :to="stats.itemCount" :precision="0" />
            </n-statistic>
          </n-card>
        </n-gi>
        <n-gi>
          <n-card :bordered="true" class="stat-card">
            <n-statistic :label="t('setting.cache.domain_count', { default: '域名数量' })">
              <n-number-animation :from="0" :to="domainCount" :precision="0" />
            </n-statistic>
          </n-card>
        </n-gi>
      </n-grid>
    </div>

    <!-- Cache Size Limit -->
    <div class="limit-section">
      <h2>{{ t('setting.cache.limit_title', { default: '缓存限制' }) }}</h2>
      <n-card :bordered="true">
        <n-form-item :label="t('setting.cache.max_size', { default: '最大缓存大小' })">
          <n-input-number
            v-model:value="maxSizeMB"
            :min="50"
            :max="2048"
            :step="50"
            :precision="0"
            class="max-size-input">
            <template #suffix>
              <span>MB</span>
            </template>
          </n-input-number>
          <template var(--hula-brand-primary)ck>
            <n-text depth="3" class="description-text">
              {{ t('setting.cache.limit_desc', { default: '建议 100-500MB，最大 2GB' }) }}
            </n-text>
          </template>
        </n-form-item>
        <n-progress type="line" :percentage="usagePercentage" :status="usageStatus" :show-indicator="false" />
        <n-text depth="3" class="usage-text">
          {{ usageText }}
        </n-text>
      </n-card>
    </div>

    <!-- Cache by Domain -->
    <div class="domain-section">
      <div class="section-header">
        <h2>{{ t('setting.cache.by_domain', { default: '按域名统计' }) }}</h2>
        <n-button size="small" @click="handleRefresh" :aria-label="t('setting.cache.refresh', { default: '刷新' })">
          <template #icon>
            <n-icon><Refresh aria-hidden="true" /></n-icon>
          </template>
          {{ t('setting.cache.refresh', { default: '刷新' }) }}
        </n-button>
      </div>
      <n-card :bordered="true">
        <n-list v-if="domainList.length > 0" hoverable clickable>
          <n-list-item v-for="domain in domainList" :key="domain.name">
            <template #prefix>
              <n-icon size="20" :aria-hidden="true">
                <Server />
              </n-icon>
            </template>
            <div class="domain-item">
              <div class="domain-name">{{ domain.name }}</div>
              <div class="domain-stats">
                <n-tag size="small" type="info">
                  {{ formatSize(domain.size) }}
                </n-tag>
                <n-tag size="small">{{ domain.count }} {{ t('setting.cache.files', { default: '文件' }) }}</n-tag>
              </div>
            </div>
            <template #suffix>
              <n-button
                size="tiny"
                quaternary
                type="error"
                @click="handleClearDomain(domain.name)"
                :aria-label="t('setting.cache.clear_domain', { default: '清除' })">
                <template #icon>
                  <n-icon><Trash aria-hidden="true" /></n-icon>
                </template>
              </n-button>
            </template>
          </n-list-item>
        </n-list>
        <n-empty v-else :description="t('setting.cache.no_cache', { default: '暂无缓存' })" size="small" />
      </n-card>
    </div>

    <!-- Actions -->
    <div class="actions-section">
      <h2>{{ t('setting.cache.actions', { default: '操作' }) }}</h2>
      <n-space>
        <n-button type="error" @click="handleClearAll" :loading="clearing">
          <template #icon>
            <n-icon><Trash aria-hidden="true" /></n-icon>
          </template>
          {{ t('setting.cache.clear_all', { default: '清除所有缓存' }) }}
        </n-button>
        <n-button type="default" @click="handleRefresh" :loading="loading">
          <template #icon>
            <n-icon><Refresh aria-hidden="true" /></n-icon>
          </template>
          {{ t('setting.cache.refresh', { default: '刷新统计' }) }}
        </n-button>
      </n-space>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NGrid,
  NGi,
  NStatistic,
  NNumberAnimation,
  NFormItem,
  NInputNumber,
  NProgress,
  NText,
  NList,
  NListItem,
  NTag,
  NIcon,
  NButton,
  NSpace,
  NEmpty,
  useMessage,
  useDialog
} from 'naive-ui'
import { Refresh, Trash, Server } from '@vicons/tabler'
import { PersistentMediaCache } from '@/utils/indexedDBCache'
import { logger } from '@/utils/logger'

interface CacheStats {
  totalSize: number
  itemCount: number
  byDomain: Record<string, { count: number; size: number }>
}

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()

const cache = new PersistentMediaCache()
const loading = ref(false)
const clearing = ref(false)
const maxSizeMB = ref(500)
const stats = ref<CacheStats>({
  totalSize: 0,
  itemCount: 0,
  byDomain: {}
})

const domainCount = computed(() => Object.keys(stats.value.byDomain).length)

const usagePercentage = computed(() => {
  const maxSizeBytes = maxSizeMB.value * 1024 * 1024
  return Math.min((stats.value.totalSize / maxSizeBytes) * 100, 100)
})

const usageStatus = computed<'success' | 'warning' | 'error'>(() => {
  if (usagePercentage.value < 50) return 'success'
  if (usagePercentage.value < 80) return 'warning'
  return 'error'
})

const usageText = computed(() => {
  const maxSizeBytes = maxSizeMB.value * 1024 * 1024
  const used = stats.value.totalSize
  const percentage = (used / maxSizeBytes) * 100
  return `${formatSize(used)} / ${formatSize(maxSizeBytes)} (${percentage.toFixed(1)}%)`
})

const domainList = computed(() => {
  return Object.entries(stats.value.byDomain)
    .map(([name, data]) => ({
      name,
      count: data.count,
      size: data.size
    }))
    .sort((a, b) => b.size - a.size)
})

async function loadStats() {
  loading.value = true
  try {
    await cache.init()
    const newStats = await cache.getStats()
    stats.value = newStats
  } catch (error) {
    logger.error('[CacheSettings] Failed to load stats:', error)
    message.error(t('setting.cache.load_failed', { default: '加载缓存统计失败' }))
  } finally {
    loading.value = false
  }
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb < 1) {
    return `${(bytes / 1024).toFixed(2)} KB`
  }
  return `${mb.toFixed(2)} MB`
}

async function handleRefresh() {
  await loadStats()
  message.success(t('setting.cache.refreshed', { default: '已刷新' }))
}

async function handleClearAll() {
  dialog.warning({
    title: t('setting.cache.clear_confirm_title', { default: '确认清除所有缓存?' }),
    content: t('setting.cache.clear_confirm_desc', { default: '此操作将清除所有缓存文件，无法恢复。' }),
    positiveText: t('common.confirm', { default: '确认' }),
    negativeText: t('common.cancel', { default: '取消' }),
    onPositiveClick: async () => {
      clearing.value = true
      try {
        await cache.clear()
        await loadStats()
        message.success(t('setting.cache.cleared', { default: '缓存已清除' }))
      } catch (error) {
        logger.error('[CacheSettings] Failed to clear cache:', error)
        message.error(t('setting.cache.clear_failed', { default: '清除缓存失败' }))
      } finally {
        clearing.value = false
      }
    }
  })
}

async function handleClearDomain(domain: string) {
  dialog.info({
    title: t('setting.cache.clear_domain_confirm_title', { default: '清除域名缓存?' }),
    content: t('setting.cache.clear_domain_confirm_desc', { domain, default: `清除 ${domain} 的缓存?` }),
    positiveText: t('common.confirm', { default: '确认' }),
    negativeText: t('common.cancel', { default: '取消' }),
    onPositiveClick: async () => {
      try {
        await cache.clearDomain(domain)
        await loadStats()
        message.success(t('setting.cache.domain_cleared', { default: '域名缓存已清除' }))
      } catch (error) {
        logger.error('[CacheSettings] Failed to clear domain cache:', error)
        message.error(t('setting.cache.clear_failed', { default: '清除失败' }))
      }
    }
  })
}

onMounted(() => {
  loadStats()
})
</script>

<style lang="scss" scoped>
.cache-settings {
  padding: 24px;

  h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 16px 0;
    color: var(--text-color-1);
  }

  .unit-suffix {
    font-size: 14px;
  }

  .max-size-input {
    width: 200px;
  }

  .description-text {
    font-size: 12px;
  }

  .usage-text {
    font-size: 12px;
    margin-top: 8px;
    display: block;
  }

  .stats-section,
  .limit-section,
  .domain-section,
  .actions-section {
    margin-bottom: 32px;
  }

  .stat-card {
    text-align: center;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;

    h2 {
      margin: 0;
    }
  }

  .domain-item {
    flex: 1;

    .domain-name {
      font-weight: 500;
      color: var(--text-color-1);
      margin-bottom: 4px;
    }

    .domain-stats {
      display: flex;
      gap: 8px;
    }
  }
}
</style>
