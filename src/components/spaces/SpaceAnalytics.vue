<template>
  <div class="space-analytics">
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <n-spin size="large" />
    </div>

    <!-- Analytics Content -->
    <div v-else class="analytics-content">
      <!-- Overview Cards -->
      <div class="overview-cards">
        <n-grid :cols="4" :x-gap="16" :y-gap="16">
          <n-gi>
            <n-statistic label="总空间数" :value="analytics.totalSpaces">
              <template #suffix>
                <n-icon size="20" color="var(--hula-brand-primary)">
                  <Space />
                </n-icon>
              </template>
            </n-statistic>
          </n-gi>
          <n-gi>
            <n-statistic label="总房间数" :value="analytics.totalRooms">
              <template #suffix>
                <n-icon size="20" color="var(--hula-brand-primary)">
                  <Hash />
                </n-icon>
              </template>
            </n-statistic>
          </n-gi>
          <n-gi>
            <n-statistic label="总成员数" :value="analytics.totalMembers">
              <template #suffix>
                <n-icon size="20" color="var(--hula-brand-primary)">
                  <Users />
                </n-icon>
              </template>
            </n-statistic>
          </n-gi>
          <n-gi>
            <n-statistic label="加密房间" :value="analytics.encryptedRooms">
              <template #suffix>
                <n-icon size="20" :color="analytics.encryptedRooms > 0 ? 'var(--hula-brand-primary)' : 'var(--hula-brand-primary)'">
                  <Lock />
                </n-icon>
              </template>
            </n-statistic>
          </n-gi>
        </n-grid>
      </div>

      <!-- Charts Section -->
      <div class="charts-section">
        <n-grid :cols="2" :x-gap="16" :y-gap="16">
          <!-- Space Type Distribution -->
          <n-gi>
            <n-card title="空间类型分布" :bordered="false">
              <div class="chart-container">
                <n-progress
                  type="circle"
                  :percentage="analytics.spaceTypePercentage.space"
                  :color="spaceTypeColors.space"
                  :stroke-width="12">
                  <template #default="{ percentage }">
                    <div class="progress-content">
                      <span class="progress-value">{{ percentage }}%</span>
                      <span class="progress-label">空间</span>
                    </div>
                  </template>
                </n-progress>
                <div class="type-legend">
                  <div class="legend-item">
                    <div class="legend-color" :style="{ background: spaceTypeColors.space }"></div>
                    <span>空间 ({{ analytics.spaceTypes.space }})</span>
                  </div>
                  <div class="legend-item">
                    <div class="legend-color" :style="{ background: spaceTypeColors.room }"></div>
                    <span>房间 ({{ analytics.spaceTypes.room }})</span>
                  </div>
                  <div class="legend-item">
                    <div class="legend-color" :style="{ background: spaceTypeColors.dm }"></div>
                    <span>私聊 ({{ analytics.spaceTypes.dm }})</span>
                  </div>
                </div>
              </div>
            </n-card>
          </n-gi>

          <!-- Encryption Distribution -->
          <n-gi>
            <n-card title="加密状态分布" :bordered="false">
              <div class="encryption-stats">
                <div class="stat-row">
                  <div class="stat-label">已加密</div>
                  <n-progress
                    type="line"
                    :percentage="analytics.encryptionPercentage"
                    :color="'var(--hula-brand-primary)'"
                    :show-indicator="false" />
                  <div class="stat-value">{{ analytics.encryptedRooms }}</div>
                </div>
                <div class="stat-row">
                  <div class="stat-label">未加密</div>
                  <n-progress
                    type="line"
                    :percentage="100 - analytics.encryptionPercentage"
                    :color="'var(--hula-brand-primary)'"
                    :show-indicator="false" />
                  <div class="stat-value">{{ analytics.totalRooms - analytics.encryptedRooms }}</div>
                </div>
              </div>
            </n-card>
          </n-gi>

          <!-- Join Rule Distribution -->
          <n-gi>
            <n-card title="加入规则分布" :bordered="false">
              <div class="join-rule-stats">
                <div v-for="(count, rule) in analytics.joinRules" :key="rule" class="rule-item">
                  <div class="rule-header">
                    <span class="rule-label">{{ getJoinRuleLabel(rule) }}</span>
                    <span class="rule-count">{{ count }}</span>
                  </div>
                  <n-progress
                    type="line"
                    :percentage="(count / analytics.totalRooms) * 100"
                    :color="getJoinRuleColor(rule)" />
                </div>
              </div>
            </n-card>
          </n-gi>

          <!-- Top Spaces by Members -->
          <n-gi>
            <n-card title="按成员排序" :bordered="false">
              <div class="top-spaces">
                <div v-for="(space, index) in analytics.topSpaces" :key="space.roomId" class="top-space-item">
                  <div class="space-rank">{{ index + 1 }}</div>
                  <n-avatar :size="32" :src="space.avatar" :fallback-text="space.name?.charAt(0) || '?'" />
                  <div class="space-info">
                    <div class="space-name">{{ space.name || '未命名空间' }}</div>
                    <div class="space-meta">
                      <n-icon size="14"><Users /></n-icon>
                      <span>{{ space.memberCount || 0 }}</span>
                    </div>
                  </div>
                </div>
                <n-empty v-if="analytics.topSpaces.length === 0" description="暂无数据" size="small" />
              </div>
            </n-card>
          </n-gi>
        </n-grid>
      </div>

      <!-- Recent Spaces -->
      <div class="recent-spaces">
        <n-card title="最近创建的空间" :bordered="false">
          <n-list hoverable clickable>
            <n-list-item v-for="space in recentSpaces" :key="space.roomId" @click="handleSpaceClick(space)">
              <template #prefix>
                <n-avatar :size="40" :src="space.avatar" :fallback-text="space.name?.charAt(0) || '?'" />
              </template>
              <div class="space-content">
                <div class="space-name">{{ space.name || '未命名空间' }}</div>
                <div class="space-meta">
                  <span class="space-type">{{ getSpaceTypeLabel(space.spaceType) }}</span>
                  <span v-if="space.memberCount" class="space-members">{{ space.memberCount }} 成员</span>
                </div>
              </div>
              <template #suffix>
                <n-tag :type="space.encrypted ? 'success' : 'default'" size="small">
                  {{ space.encrypted ? '已加密' : '未加密' }}
                </n-tag>
              </template>
            </n-list-item>
            <n-list-item v-if="recentSpaces.length === 0">
              <n-empty description="暂无最近创建的空间" size="small" />
            </n-list-item>
          </n-list>
        </n-card>
      </div>
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
  NIcon,
  NSpin,
  NProgress,
  NTag,
  NList,
  NListItem,
  NAvatar,
  NEmpty,
  useMessage
} from 'naive-ui'
import { Space, Hash, Users, Lock } from '@vicons/tabler'
import { useSpacesStore } from '@/stores/spaces'
import type { SpaceInfo } from '@/matrix/services/room/spaces'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const message = useMessage()

const spacesStore = useSpacesStore()
const loading = ref(false)

const spaceTypeColors = {
  space: 'var(--hula-brand-primary)',
  room: 'var(--hula-brand-primary)',
  dm: 'var(--hula-brand-primary)'
}

interface AnalyticsData {
  totalSpaces: number
  totalRooms: number
  totalMembers: number
  encryptedRooms: number
  encryptionPercentage: number
  spaceTypes: {
    space: number
    room: number
    dm: number
  }
  spaceTypePercentage: {
    space: number
    room: number
    dm: number
  }
  joinRules: Record<string, number>
  topSpaces: Array<{
    roomId: string
    name: string
    avatar?: string
    memberCount?: number
  }>
}

const analytics = ref<AnalyticsData>({
  totalSpaces: 0,
  totalRooms: 0,
  totalMembers: 0,
  encryptedRooms: 0,
  encryptionPercentage: 0,
  spaceTypes: {
    space: 0,
    room: 0,
    dm: 0
  },
  spaceTypePercentage: {
    space: 0,
    room: 0,
    dm: 0
  },
  joinRules: {},
  topSpaces: []
})

const recentSpaces = ref<SpaceInfo[]>([])

// Computed
const allSpaces = computed(() => Object.values(spacesStore.spaces))

// Methods
const calculateAnalytics = () => {
  const spaces = allSpaces.value
  const totalSpaces = spaces.length
  const totalRooms = spaces.reduce((sum, space) => sum + (space.children?.length || 0), 0)
  const totalMembers = spaces.reduce((sum, space) => sum + (space.memberCount || 0), 0)
  const encryptedRooms = spaces.filter((s) => s.encrypted).length
  const encryptionPercentage = totalSpaces > 0 ? Math.round((encryptedRooms / totalSpaces) * 100) : 0

  // Count by type
  const spaceTypes = {
    space: 0,
    room: 0,
    dm: 0
  }
  spaces.forEach((space) => {
    spaceTypes[space.spaceType]++
  })

  const spaceTypePercentage = {
    space: totalSpaces > 0 ? Math.round((spaceTypes.space / totalSpaces) * 100) : 0,
    room: totalSpaces > 0 ? Math.round((spaceTypes.room / totalSpaces) * 100) : 0,
    dm: totalSpaces > 0 ? Math.round((spaceTypes.dm / totalSpaces) * 100) : 0
  }

  // Join rules
  const joinRules: Record<string, number> = {}
  spaces.forEach((space) => {
    joinRules[space.joinRule] = (joinRules[space.joinRule] || 0) + 1
  })

  // Top spaces by members
  const topSpaces = [...spaces]
    .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))
    .slice(0, 5)
    .map((space) => ({
      roomId: space.roomId,
      name: space.name,
      avatar: space.avatar,
      memberCount: space.memberCount
    }))

  // Recent spaces (by created timestamp)
  const recentSpacesData = [...spaces]
    .filter((s) => s.created)
    .sort((a, b) => (b.created || 0) - (a.created || 0))
    .slice(0, 5)

  analytics.value = {
    totalSpaces,
    totalRooms,
    totalMembers,
    encryptedRooms,
    encryptionPercentage,
    spaceTypes,
    spaceTypePercentage,
    joinRules,
    topSpaces
  }

  recentSpaces.value = recentSpacesData
}

const getJoinRuleLabel = (rule: string): string => {
  const labels: Record<string, string> = {
    public: '公开',
    invite: '邀请',
    knock: '申请',
    restricted: '受限'
  }
  return labels[rule] || rule
}

const getJoinRuleColor = (rule: string): string => {
  const colors: Record<string, string> = {
    public: 'var(--hula-brand-primary)',
    invite: 'var(--hula-brand-primary)',
    knock: 'var(--hula-brand-primary)',
    restricted: 'var(--hula-brand-primary)'
  }
  return colors[rule] || 'var(--hula-brand-primary)'
}

const getSpaceTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    space: '空间',
    room: '房间',
    dm: '私聊'
  }
  return labels[type] || type
}

const handleSpaceClick = (space: SpaceInfo) => {
  logger.info('[SpaceAnalytics] Space clicked', { spaceId: space.roomId })
  spacesStore.selectSpace(space.roomId)
  // Navigate to space details
}

// Lifecycle
onMounted(async () => {
  loading.value = true
  try {
    if (!spacesStore.initialized) {
      await spacesStore.initialize()
    }
    calculateAnalytics()
  } catch (error) {
    logger.error('[SpaceAnalytics] Failed to load analytics:', error)
    message.error('加载分析数据失败')
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
.space-analytics {
  padding: 24px;

  .loading-state {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 400px;
  }

  .analytics-content {
    .overview-cards {
      margin-bottom: 24px;
    }

    .charts-section {
      margin-bottom: 24px;

      .chart-container {
        padding: 16px 0;

        .progress-content {
          display: flex;
          flex-direction: column;
          align-items: center;

          .progress-value {
            font-size: 28px;
            font-weight: 600;
          }

          .progress-label {
            font-size: 12px;
            color: var(--text-color-3);
          }
        }

        .type-legend {
          margin-top: 24px;

          .legend-item {
            display: flex;
            align-items: center;
            margin-bottom: 8px;

            .legend-color {
              width: 12px;
              height: 12px;
              border-radius: 2px;
              margin-right: 8px;
            }
          }
        }
      }

      .encryption-stats {
        .stat-row {
          margin-bottom: 20px;

          &:last-child {
            margin-bottom: 0;
          }

          .stat-label {
            margin-bottom: 8px;
            font-weight: 500;
          }

          .stat-value {
            float: right;
            font-weight: 600;
            color: var(--text-color-1);
          }
        }
      }

      .join-rule-stats {
        .rule-item {
          margin-bottom: 16px;

          &:last-child {
            margin-bottom: 0;
          }

          .rule-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;

            .rule-label {
              font-weight: 500;
            }

            .rule-count {
              font-weight: 600;
            }
          }
        }
      }

      .top-spaces {
        .top-space-item {
          display: flex;
          align-items: center;
          padding: 12px 0;

          &:not(:last-child) {
            border-bottom: 1px solid var(--divider-color);
          }

          .space-rank {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: var(--primary-color);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            margin-right: 12px;
          }

          .space-info {
            flex: 1;
            margin-left: 12px;

            .space-name {
              font-weight: 500;
              margin-bottom: 4px;
            }

            .space-meta {
              display: flex;
              align-items: center;
              gap: 4px;
              font-size: 12px;
              color: var(--text-color-3);
            }
          }
        }
      }
    }

    .recent-spaces {
      .space-content {
        flex: 1;

        .space-name {
          font-weight: 500;
          margin-bottom: 4px;
        }

        .space-meta {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: var(--text-color-3);
        }
      }
    }
  }
}
</style>
