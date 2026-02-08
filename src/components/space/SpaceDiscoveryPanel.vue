<template>
  <n-card :title="t('space_discovery.title')" :bordered="false" class="space-discovery-panel">
    <n-form :model="searchForm" label-placement="top" label-width="auto">
      <n-form-item :label="t('space_discovery.search')">
        <n-input
          v-model:value="searchForm.query"
          :placeholder="t('space_discovery.search_placeholder')"
          clearable
          @keyup.enter="handleSearch">
          <template #prefix>
            <svg class="w-16px h-16px text-gray-400">
              <use href="#search"></use>
            </svg>
          </template>
          <template #suffix>
            <n-button
              type="primary"
              size="small"
              :loading="searching"
              @click="handleSearch">
              {{ t('space_discovery.search_button') }}
            </n-button>
          </template>
        </n-input>
      </n-form-item>

      <n-form-item :label="t('space_discovery.filters')">
        <n-flex :size="12">
          <n-select
            v-model:value="searchForm.category"
            :options="categoryOptions"
            :placeholder="t('space_discovery.all_categories')"
            clearable
            style="width: 200px" />
          
          <n-select
            v-model:value="searchForm.language"
            :options="languageOptions"
            :placeholder="t('space_discovery.all_languages')"
            clearable
            style="width: 150px" />
          
          <n-select
            v-model:value="searchForm.sortBy"
            :options="sortOptions"
            style="width: 150px" />
        </n-flex>
      </n-form-item>
    </n-form>

    <n-divider style="margin: 8px 0" />

    <n-spin :show="searching">
      <n-empty v-if="spaces.length === 0 && !searching" :description="t('space_discovery.no_spaces')" />

      <n-list v-else hoverable clickable>
        <n-list-item v-for="space in spaces" :key="space.roomId" @click="handleSpaceClick(space)">
          <n-thing>
            <template #header>
              <n-flex align="center" justify="space-between">
                <n-flex align="center" :size="12">
                  <n-avatar
                    :size="48"
                    :src="space.avatarUrl || ''"
                    :name="space.name || space.roomId" />
                  <n-flex vertical :size="4">
                    <span class="text-16px font-medium">{{ space.name || space.roomId }}</span>
                    <span class="text-12px text-gray-500">{{ space.topic || t('space_discovery.no_topic') }}</span>
                  </n-flex>
                </n-flex>
                <n-tag v-if="space.joined" type="success" size="small">
                  {{ t('space_discovery.joined') }}
                </n-tag>
              </n-flex>
            </template>
            <template #description>
              <n-flex :size="12" vertical>
                <n-flex align="center" :size="8">
                  <svg class="w-14px h-14px text-gray-400">
                    <use href="#users"></use>
                  </svg>
                  <span class="text-12px text-gray-600">{{ space.memberCount || 0 }} {{ t('space_discovery.members') }}</span>
                </n-flex>
                <n-flex align="center" :size="8">
                  <svg class="w-14px h-14px text-gray-400">
                    <use href="#hash"></use>
                  </svg>
                  <span class="text-12px text-gray-600">{{ space.roomCount || 0 }} {{ t('space_discovery.rooms') }}</span>
                </n-flex>
                <n-flex v-if="space.category" align="center" :size="8">
                  <svg class="w-14px h-14px text-gray-400">
                    <use href="#tag"></use>
                  </svg>
                  <span class="text-12px text-gray-600">{{ space.category }}</span>
                </n-flex>
                <n-flex v-if="space.language" align="center" :size="8">
                  <svg class="w-14px h-14px text-gray-400">
                    <use href="#globe"></use>
                  </svg>
                  <span class="text-12px text-gray-600">{{ space.language }}</span>
                </n-flex>
              </n-flex>
            </template>
            <template #action>
              <n-button
                v-if="!space.joined"
                type="primary"
                size="small"
                :loading="joining === space.roomId"
                @click.stop="handleJoinSpace(space)">
                {{ t('space_discovery.join') }}
              </n-button>
              <n-button
                v-else
                size="small"
                @click.stop="handleViewSpace(space)">
                {{ t('space_discovery.view') }}
              </n-button>
            </template>
          </n-thing>
        </n-list-item>
      </n-list>

      <n-flex v-if="hasMore" justify="center" class="mt-4">
        <n-button @click="handleLoadMore" :loading="loadingMore">
          {{ t('space_discovery.load_more') }}
        </n-button>
      </n-flex>
    </n-spin>
  </n-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import MatrixSpacesService from '@/services/matrix/MatrixSpacesService'

interface SpaceInfo {
  roomId: string
  name: string
  topic: string
  avatarUrl: string
  memberCount: number
  roomCount: number
  category: string
  language: string
  joined: boolean
}

const { t } = useI18n()
const spacesService = MatrixSpacesService.getInstance()

const searchForm = ref({
  query: '',
  category: null as string | null,
  language: null as string | null,
  sortBy: 'popular' as string
})

const searching = ref(false)
const loadingMore = ref(false)
const joining = ref<string | null>(null)
const spaces = ref<SpaceInfo[]>([])
const hasMore = ref(false)

const categoryOptions = [
  { label: t('space_discovery.category.general'), value: 'general' },
  { label: t('space_discovery.category.technology'), value: 'technology' },
  { label: t('space_discovery.category.gaming'), value: 'gaming' },
  { label: t('space_discovery.category.art'), value: 'art' },
  { label: t('space_discovery.category.music'), value: 'music' },
  { label: t('space_discovery.category.sports'), value: 'sports' }
]

const languageOptions = [
  { label: 'English', value: 'en' },
  { label: '简体中文', value: 'zh-CN' },
  { label: 'Español', value: 'es' },
  { label: 'Français', value: 'fr' },
  { label: 'Deutsch', value: 'de' },
  { label: '日本語', value: 'ja' }
]

const sortOptions = [
  { label: t('space_discovery.sort.popular'), value: 'popular' },
  { label: t('space_discovery.sort.newest'), value: 'newest' },
  { label: t('space_discovery.sort.members'), value: 'members' }
]

const handleSearch = async () => {
  try {
    searching.value = true
    const results = await spacesService.searchSpaces(searchForm.value.query, true, 20)

    spaces.value = results.map((space) => ({
      roomId: space.roomId,
      name: space.name,
      topic: space.topic || '',
      avatarUrl: space.avatar || '',
      memberCount: space.memberCount,
      roomCount: 0,
      category: searchForm.value.category || 'general',
      language: searchForm.value.language || 'all',
      joined: false
    }))
    hasMore.value = results.length >= 20
  } catch (error) {
    console.error('Failed to search spaces:', error)
    window.$message.error(t('space_discovery.search_failed'))
  } finally {
    searching.value = false
  }
}

const handleLoadMore = async () => {
  if (loadingMore.value || !hasMore.value) return

  try {
    loadingMore.value = true
    const results = await spacesService.searchSpaces(searchForm.value.query, true, 20)

    const newSpaces = results
      .filter((space) => !spaces.value.find((s) => s.roomId === space.roomId))
      .map((space) => ({
        roomId: space.roomId,
        name: space.name,
        topic: space.topic || '',
        avatarUrl: space.avatar || '',
        memberCount: space.memberCount,
        roomCount: 0,
        category: searchForm.value.category || 'general',
        language: searchForm.value.language || 'all',
        joined: false
      }))

    spaces.value = [...spaces.value, ...newSpaces]
    hasMore.value = newSpaces.length >= 20
  } catch (error) {
    console.error('Failed to load more spaces:', error)
    window.$message.error(t('space_discovery.load_more_failed'))
  } finally {
    loadingMore.value = false
  }
}

const handleSpaceClick = (space: SpaceInfo) => {
  if (space.joined) {
    handleViewSpace(space)
  } else {
    handleJoinSpace(space)
  }
}

const handleJoinSpace = async (space: SpaceInfo) => {
  try {
    joining.value = space.roomId
    const success = await spacesService.joinSpace(space.roomId)
    if (success) {
      window.$message.success(t('space_discovery.join_success'))
      space.joined = true
    } else {
      window.$message.error(t('space_discovery.join_failed'))
    }
  } catch (error) {
    console.error('Failed to join space:', error)
    window.$message.error(t('space_discovery.join_failed'))
  } finally {
    joining.value = null
  }
}

const handleViewSpace = (space: SpaceInfo) => {
  window.$message.info(t('space_discovery.viewing_space', { name: space.name }))
}

onMounted(() => {
  handleSearch()
})
</script>

<style scoped>
.space-discovery-panel {
  background: var(--bg-color);
}
</style>
