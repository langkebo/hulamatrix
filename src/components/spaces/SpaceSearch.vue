<script setup lang="ts">
import { ref, computed, h } from 'vue'
import {
  NInput,
  NButton,
  NSpin,
  NEmpty,
  NCard,
  NAvatar,
  NTag,
  NSpace,
  NTabs,
  NTabPane,
  NGrid,
  NGridItem
} from 'naive-ui'
import { useSpacesStore } from '@/stores/spaces'
import type { SpaceInfo } from '@/types/space'

const spacesStore = useSpacesStore()

const searchQuery = ref('')
const activeTab = ref('all')
const loading = ref(false)
const searchResults = ref<{
  joined: SpaceInfo[]
  public: SpaceInfo[]
}>({
  joined: [],
  public: []
})

const allResults = computed(() => {
  if (activeTab.value === 'all') {
    return [...searchResults.value.joined, ...searchResults.value.public]
  }
  if (activeTab.value === 'joined') {
    return searchResults.value.joined
  }
  return searchResults.value.public
})

async function handleSearch() {
  if (!searchQuery.value.trim()) {
    searchResults.value = { joined: [], public: [] }
    return
  }

  loading.value = true
  try {
    const joined = await spacesStore.searchJoinedSpaces(searchQuery.value)
    const publicSpaces = await spacesStore.searchPublicSpaces(searchQuery.value, 20)

    searchResults.value = {
      joined,
      public: publicSpaces
    }
  } finally {
    loading.value = false
  }
}

async function handleJoinSpace(space: SpaceInfo) {
  const success = await spacesStore.joinSpace(space.roomId)
  if (success) {
    window.$message?.success(`已加入空间: ${space.name}`)
    await handleSearch()
  }
}

function handleViewSpace(space: SpaceInfo) {
  spacesStore.setCurrentSpace(space)
  console.log('Viewing space:', space.roomId)
}

function handleEnterRoom(space: SpaceInfo) {
  console.log('Entering room:', space.roomId)
}

function renderSpaceCard(space: SpaceInfo, isJoined: boolean) {
  return h(
    NCard,
    { hoverable: true, class: 'space-card' },
    {
      default: () => [
        h('div', { class: 'flex items-start gap-3' }, [
          h(NAvatar, {
            size: 'large',
            round: true,
            src: space.avatar,
            'fallback-src':
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Cpath d='M9 3v18'/%3E%3Cpath d='M3 9h6'/%3E%3Cpath d='M3 15h6'/%3E%3C/svg%3E"
          }),
          h('div', { class: 'flex-1' }, [
            h('h4', { class: 'font-semibold text-base mb-1' }, space.name),
            space.topic ? h('p', { class: 'text-sm text-gray-500 mb-2 line-clamp-2' }, space.topic) : null,
            h(
              NSpace,
              { vertical: true, size: 'small' },
              {
                default: () => [
                  h(NTag, { size: 'small', type: 'info' }, () => `${space.memberCount} 成员`),
                  space.isPublic ? h(NTag, { size: 'small', type: 'success' }, () => '公开') : null,
                  isJoined ? h(NTag, { size: 'small', type: 'primary' }, () => '已加入') : null
                ]
              }
            )
          ])
        ]),
        h('div', { class: 'mt-4 flex gap-2' }, [
          isJoined
            ? [
                h(
                  NButton,
                  {
                    type: 'primary',
                    size: 'small',
                    block: true,
                    onClick: () => handleEnterRoom(space)
                  },
                  () => '进入'
                ),
                h(
                  NButton,
                  {
                    size: 'small',
                    block: true,
                    onClick: () => handleViewSpace(space)
                  },
                  () => '查看'
                )
              ]
            : [
                h(
                  NButton,
                  {
                    type: 'primary',
                    size: 'small',
                    block: true,
                    onClick: () => handleJoinSpace(space)
                  },
                  () => '加入'
                ),
                h(
                  NButton,
                  {
                    size: 'small',
                    block: true,
                    onClick: () => handleViewSpace(space)
                  },
                  () => '查看'
                )
              ]
        ])
      ]
    }
  )
}
</script>

<template>
  <div class="space-search">
    <div class="search-bar mb-4">
      <NInput
        v-model:value="searchQuery"
        placeholder="搜索空间..."
        size="large"
        clearable
        @keyup.enter="handleSearch"
      >
        <template #suffix>
          <NButton type="primary" size="small" @click="handleSearch">搜索</NButton>
        </template>
      </NInput>
    </div>

    <NSpin :show="loading">
      <div v-if="searchQuery && (searchResults.joined.length > 0 || searchResults.public.length > 0)" class="search-results">
        <NTabs v-model:value="activeTab" type="segment">
          <NTabPane name="all" :tab="`全部 (${allResults.length})`">
            <NGrid :x-gap="16" :y-gap="16" :cols="3" responsive="screen">
              <NGridItem v-for="space in allResults" :key="space.roomId" span="1 s:1 m:1 l:1">
                <component :is="renderSpaceCard(space, searchResults.joined.some((s) => s.roomId === space.roomId))" />
              </NGridItem>
            </NGrid>
          </NTabPane>
          <NTabPane name="joined" :tab="`已加入 (${searchResults.joined.length})`">
            <NGrid :x-gap="16" :y-gap="16" :cols="3" responsive="screen">
              <NGridItem v-for="space in searchResults.joined" :key="space.roomId" span="1 s:1 m:1 l:1">
                <component :is="renderSpaceCard(space, true)" />
              </NGridItem>
            </NGrid>
          </NTabPane>
          <NTabPane name="public" :tab="`公开 (${searchResults.public.length})`">
            <NGrid :x-gap="16" :y-gap="16" :cols="3" responsive="screen">
              <NGridItem v-for="space in searchResults.public" :key="space.roomId" span="1 s:1 m:1 l:1">
                <component :is="renderSpaceCard(space, false)" />
              </NGridItem>
            </NGrid>
          </NTabPane>
        </NTabs>
      </div>

      <NEmpty v-else-if="searchQuery" description="未找到匹配的空间" />

      <div v-else class="empty-state">
        <div class="text-center text-gray-500">
          <div class="text-6xl mb-4">🔍</div>
          <p class="text-lg">搜索空间</p>
          <p class="text-sm">输入关键词搜索已加入的空间或公开空间</p>
        </div>
      </div>
    </NSpin>
  </div>
</template>

<style scoped>
.space-search {
  height: 100%;
  overflow-y: auto;
}

.search-bar {
  padding: 16px;
  background: var(--bg-color);
  border-bottom: 1px solid var(--border-color);
}

.search-results {
  padding: 16px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 400px;
}

.space-card {
  transition: transform 0.2s, box-shadow 0.2s;
}

.space-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>
