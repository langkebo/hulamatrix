<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { NInput, NButton, NSpin, NEmpty, NCard, NAvatar, NTag, NSpace, NGrid, NGridItem } from 'naive-ui'
import { useSpacesStore } from '@/stores/spaces'
import type { SpaceInfo } from '@/types/space'

const spacesStore = useSpacesStore()

const searchQuery = ref('')
const searchResults = ref<SpaceInfo[]>([])
const loading = ref(false)
const showAllPublicSpaces = ref(false)

async function handleSearch() {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }

  loading.value = true
  try {
    searchResults.value = await spacesStore.searchPublicSpaces(searchQuery.value, 20)
  } finally {
    loading.value = false
  }
}

async function handleJoinSpace(space: SpaceInfo) {
  const success = await spacesStore.joinSpace(space.roomId)
  if (success) {
    await spacesStore.fetchSpaces(true)
    window.$message?.success(`已加入空间: ${space.name}`)
  }
}

function handleViewSpace(space: SpaceInfo) {
  spacesStore.setCurrentSpace(space)
  console.log('Viewing space:', space.roomId)
}

async function loadAllPublicSpaces() {
  loading.value = true
  showAllPublicSpaces.value = true
  try {
    await spacesStore.fetchPublicSpaces(50, true)
  } finally {
    loading.value = false
  }
}

function renderSpaceCard(space: SpaceInfo) {
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
                  space.isPublic ? h(NTag, { size: 'small', type: 'success' }, () => '公开') : null
                ]
              }
            )
          ])
        ]),
        h('div', { class: 'mt-4 flex gap-2' }, [
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
        ])
      ]
    }
  )
}

onMounted(() => {
  loadAllPublicSpaces()
})
</script>

<template>
  <div class="space-explorer">
    <div class="search-bar mb-4">
      <NInput
        v-model:value="searchQuery"
        placeholder="搜索公开空间..."
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
      <div v-if="searchQuery && searchResults.length > 0" class="search-results">
        <h3 class="text-lg font-semibold mb-3">搜索结果</h3>
        <NGrid :x-gap="16" :y-gap="16" :cols="3" responsive="screen">
          <NGridItem v-for="space in searchResults" :key="space.roomId" span="1 s:1 m:1 l:1">
            <component :is="renderSpaceCard(space)" />
          </NGridItem>
        </NGrid>
      </div>

      <div v-else-if="showAllPublicSpaces && spacesStore.publicSpaces.length > 0" class="public-spaces">
        <h3 class="text-lg font-semibold mb-3">公开空间</h3>
        <NGrid :x-gap="16" :y-gap="16" :cols="3" responsive="screen">
          <NGridItem v-for="space in spacesStore.publicSpaces" :key="space.roomId" span="1 s:1 m:1 l:1">
            <component :is="renderSpaceCard(space)" />
          </NGridItem>
        </NGrid>
      </div>

      <NEmpty v-else description="暂无公开空间" />
    </NSpin>
  </div>
</template>

<style scoped>
.space-explorer {
  height: 100%;
  overflow-y: auto;
}

.search-bar {
  padding: 16px;
  background: var(--bg-color);
  border-bottom: 1px solid var(--border-color);
}

.search-results,
.public-spaces {
  padding: 16px;
}

.space-card {
  transition: transform 0.2s, box-shadow 0.2s;
}

.space-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>
