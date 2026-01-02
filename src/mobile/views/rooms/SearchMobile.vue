<template>
  <div class="rooms-search p-12px box-border">
    <n-page-header title="房间搜索">
      <template #extra>
        <n-space>
          <RouterLink to="/mobile/rooms/manage"><n-button tertiary>房间管理</n-button></RouterLink>
        </n-space>
      </template>
    </n-page-header>

    <n-form label-placement="left" label-width="80">
      <n-form-item label="关键字"><n-input v-model:value="search.query" placeholder="房间名称/ID" clearable /></n-form-item>
      <n-form-item label="模式"><n-select v-model:value="search.mode" :options="searchModeOptions" /></n-form-item>
      <n-form-item label="排序"><n-select v-model:value="search.sortBy" :options="sortOptions" /></n-form-item>
      <n-form-item label="筛选"><n-select v-model:value="search.filter" multiple :options="filterOptions" /></n-form-item>
      <n-space>
        <n-button type="primary" :loading="searching" @click="doSearch">搜索房间</n-button>
        <n-button tertiary @click="resetSearch">重置</n-button>
      </n-space>
    </n-form>

    <n-list class="mt-12px">
      <n-list-item v-for="row in pagedResults" :key="row.id">
        <div class="flex items-center justify-between">
          <div class="flex-1 truncate">
            <div class="text-14px truncate">{{ row.name }}</div>
            <div class="text-12px text-#909090 truncate">{{ row.id }}</div>
          </div>
          <n-button size="small" type="primary" @click="joinRoom(row.id)">加入</n-button>
        </div>
      </n-list-item>
    </n-list>

    <n-pagination v-model:page="pagination.page" :page-count="pagination.pageCount" :page-size="pagination.pageSize" />
  </div>
</template>

<script setup lang="ts">
import { useRoomSearch } from '@/composables'

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
} = useRoomSearch({ platform: 'mobile' })
</script>

<style scoped>
.rooms-search { padding-right: 12px; }
</style>
