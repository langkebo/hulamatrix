<template>
  <div class="space-list-component">
    <!-- Toolbar -->
    <div class="mb-16px flex justify-between items-center">
      <n-space align="center">
        <n-input
          v-model:value="localSearchQuery"
          placeholder="搜索我的空间..."
          clearable
          class="w-240px"
          @input="handleLocalSearch">
          <template #prefix>
            <n-icon><Search /></n-icon>
          </template>
        </n-input>

        <n-select v-model:value="currentSort" :options="sortOptions" class="w-140px" size="medium" />

        <n-popselect
          v-model:value="activeQuickFilter"
          :options="filterOptions"
          trigger="click"
          @update:value="handleFilterChange">
          <n-button dashed size="medium">
            <template #icon>
              <n-icon><Filter /></n-icon>
            </template>
            {{ activeFilterLabel }}
          </n-button>
        </n-popselect>
      </n-space>

      <n-space>
        <slot name="extra-actions" />
      </n-space>
    </div>

    <!-- Content -->
    <n-spin :show="loading">
      <div v-if="localDisplaySpaces.length === 0" class="py-32px text-center">
        <n-empty :description="localSearchQuery ? '未找到匹配的空间' : '暂无空间'" />
      </div>

      <n-grid v-else cols="1 s:2 m:3 l:4" x-gap="16" y-gap="16">
        <n-grid-item v-for="space in localDisplaySpaces" :key="space.id">
          <n-card size="small" hoverable class="h-full">
            <n-flex align="center" :size="10" class="mb-12px">
              <n-avatar round :size="36" :src="space.avatar || ''" :fallback-src="fallbackAvatar" />
              <div class="flex-1 overflow-hidden">
                <div class="text-14px font-bold truncate">{{ space.name }}</div>
                <div class="text-12px text-gray-500 truncate">
                  {{ space.topic || '暂无主题' }}
                </div>
              </div>
              <n-badge
                :value="getUnread(space).highlight + getUnread(space).notification"
                :max="99"
                v-if="getUnread(space).highlight + getUnread(space).notification > 0" />
            </n-flex>

            <n-space size="small" align="center" class="text-12px text-gray-400 mb-12px">
              <span class="flex items-center">
                <n-icon class="mr-4px"><Users /></n-icon>
                {{ space.memberCount || 0 }}
              </span>
              <span class="flex items-center" v-if="space.encrypted">
                <n-icon class="mr-4px"><Lock /></n-icon>
                加密
              </span>
              <span class="flex items-center" v-if="space.isPublic">
                <n-icon class="mr-4px"><World /></n-icon>
                公开
              </span>
            </n-space>

            <n-divider class="my-8px" />

            <n-space justify="end" size="small">
              <n-button size="small" @click="$emit('view', space)">查看</n-button>
              <n-dropdown
                trigger="click"
                :options="getActionOptions(space)"
                @select="(key) => handleAction(key, space)">
                <n-button size="small" tertiary circle>
                  <template #icon>
                    <n-icon><Dots /></n-icon>
                  </template>
                </n-button>
              </n-dropdown>
            </n-space>
          </n-card>
        </n-grid-item>
      </n-grid>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, toRef, type DeepReadonly } from 'vue'
import {
  NSpace,
  NInput,
  NIcon,
  NSelect,
  NPopselect,
  NButton,
  NSpin,
  NGrid,
  NGridItem,
  NCard,
  NFlex,
  NAvatar,
  NBadge,
  NDivider,
  NEmpty,
  NDropdown,
  type DropdownOption
} from 'naive-ui'
import { Search, Filter, Users, Lock, World, Dots } from '@vicons/tabler'
import { useSpaceList } from '@/composables/useSpaceList'
import type { Space, SpaceChild } from '@/hooks/useMatrixSpaces'

const props = defineProps<{
  spaces: Space[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'view', space: Space): void
  (e: 'create-room', space: Space): void
  (e: 'invite', space: Space): void
  (e: 'leave', space: Space): void
}>()

// Use Space List shared logic with local search only
const { searchQuery, currentSort, activeQuickFilter, displaySpaces, handleSearch, toggleQuickFilter } = useSpaceList({
  userSpaces: computed(() => props.spaces) as ComputedRef<DeepReadonly<Space[]>>,
  searchResults: computed(() => []) as ComputedRef<DeepReadonly<Space[]>>,
  searchSpaces: async () => [],
  clearSearchResults: () => {}
})

// Local search state wrapper to handle input
const localSearchQuery = ref('')
const handleLocalSearch = (val: string) => {
  localSearchQuery.value = val
  // We perform local filtering instead of calling handleSearch
}

const localDisplaySpaces = computed(() => {
  let spaces = displaySpaces.value
  if (localSearchQuery.value) {
    const q = localSearchQuery.value.toLowerCase()
    spaces = spaces.filter((s) => s.name.toLowerCase().includes(q) || (s.topic && s.topic.toLowerCase().includes(q)))
  }
  return spaces
})

// UI Helpers
const fallbackAvatar = '/logoD.png'

const sortOptions = [
  { label: '最近活动', value: 'activity' },
  { label: '成员数量', value: 'members' },
  { label: '名称', value: 'name' }
]

const filterOptions = [
  { label: '全部空间', value: 'all' },
  { label: '未读消息', value: 'unread' },
  { label: '加密空间', value: 'encrypted' },
  { label: '公开空间', value: 'public' }
]

const activeFilterLabel = computed(() => {
  const found = filterOptions.find((o) => o.value === activeQuickFilter.value)
  return found ? found.label : '筛选'
})

const handleFilterChange = (val: string) => {
  toggleQuickFilter(val)
}

const getUnread = (space: Space) => {
  let highlight = space.notifications?.highlightCount ?? 0
  let notification = space.notifications?.notificationCount ?? 0

  if (space.children && Array.isArray(space.children)) {
    space.children.forEach((child: SpaceChild) => {
      if (child.notifications) {
        highlight += child.notifications.highlightCount || 0
        notification += child.notifications.notificationCount || 0
      }
    })
  }

  return {
    highlight,
    notification
  }
}

// Actions
const getActionOptions = (_space: Space): DropdownOption[] => {
  return [
    { label: '创建房间', key: 'create-room' },
    { label: '邀请成员', key: 'invite' },
    { label: '退出空间', key: 'leave', props: { style: { color: 'var(--error-color)' } } }
  ]
}

const handleAction = (key: string, space: Space) => {
  switch (key) {
    case 'create-room':
      emit('create-room', space)
      break
    case 'invite':
      emit('invite', space)
      break
    case 'leave':
      emit('leave', space)
      break
  }
}
</script>

<style scoped>
.space-card {
  transition: all 0.2s ease-in-out;
}
</style>
