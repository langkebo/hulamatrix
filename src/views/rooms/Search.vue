<template>
  <div class="rooms-search p-16px box-border">
    <n-page-header title="房间搜索">
      <template #extra>
        <n-space>
          <n-button tertiary @click="router.push('/spaces')">返回空间</n-button>
        </n-space>
      </template>
    </n-page-header>

    <n-card size="small" class="mt-12px" hoverable>
      <n-form label-placement="left" label-width="80">
        <n-grid cols="1 s:2 m:4" x-gap="12" y-gap="8">
          <n-form-item label="关键字"><n-input v-model:value="search.query" placeholder="房间名称/ID" clearable /></n-form-item>
          <n-form-item label="模式"><n-select v-model:value="search.mode" :options="searchModeOptions" /></n-form-item>
          <n-form-item label="排序"><n-select v-model:value="search.sortBy" :options="sortOptions" /></n-form-item>
          <n-form-item label="筛选"><n-select v-model:value="search.filter" multiple :options="filterOptions" /></n-form-item>
        </n-grid>
        <n-space>
          <n-button type="primary" :loading="searching" @click="doSearch">搜索房间</n-button>
          <n-button tertiary @click="resetSearch">重置</n-button>
        </n-space>
      </n-form>
    </n-card>

    <n-card size="small" class="mt-16px" hoverable>
      <template #header>搜索结果</template>
      <n-data-table :columns="columns" :data="pagedResults" :pagination="pagination" />
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomSearch } from '@/composables'
import type { RoomRow } from '@/views/rooms/search-logic'

const router = useRouter()

// Use the shared composable
const {
  search,
  searching,
  pagination,
  pagedResults,
  searchModeOptions,
  sortOptions,
  filterOptions,
  doSearch,
  resetSearch,
  joinRoom
} = useRoomSearch({ platform: 'desktop' })

// Table columns definition
const columns = [
  { title: '房间名', key: 'name' },
  { title: '房间ID', key: 'id' },
  { title: '创建时间', key: 'created', render: (row: RoomRow) => new Date(row.created).toLocaleString() },
  {
    title: '操作',
    key: 'action',
    render: (row: RoomRow) => {
      return h('n-space', {}, [
        h(
          'n-button',
          {
            size: 'small',
            type: 'primary',
            onClick: () => joinRoom(row.id)
          },
          '加入'
        )
      ])
    }
  }
]
</script>

<style scoped>
.rooms-search { padding-right: 24px; }
</style>
