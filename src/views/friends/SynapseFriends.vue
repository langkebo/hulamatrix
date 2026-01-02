<template>
  <div class="p-16px max-w-1080px m-auto">
    <n-space align="center" justify="space-between">
      <div class="text-16px">好友（Synapse 扩展）</div>
      <n-space>
        <n-button tertiary @click="refresh">刷新</n-button>
      </n-space>
    </n-space>
    <div v-if="store.loading" class="mt-8px"><n-skeleton height="20px" :repeat="8" /></div>
    <n-alert v-if="store.error" type="warning" :show-icon="true" class="mt-8px">{{ store.error }}</n-alert>
    <n-grid x-gap="12" y-gap="12" cols="2 s:1" class="mt-8px">
      <n-grid-item v-for="cat in store.categories" :key="cat.id">
        <n-card size="small" :title="cat.name" :bordered="true">
          <n-list>
            <n-list-item
              v-for="f in store.friends.filter((x) => (x.category_id || 'default') === cat.id)"
              :key="f.user_id">
              <div class="flex items-center justify-between">
                <span>{{ f.user_id }}</span>
                <n-space>
                  <n-button size="small" @click="openRequest(f.user_id)">请求</n-button>
                </n-space>
              </div>
            </n-list-item>
          </n-list>
        </n-card>
      </n-grid-item>
    </n-grid>
    <n-divider>待处理好友请求</n-divider>
    <n-list>
      <n-list-item v-for="p in store.pending" :key="p.request_id">
        <div class="flex items-center justify-between">
          <span>{{ p.requester_id }} → {{ p.target_id }}</span>
          <n-space>
            <n-button size="small" type="primary" @click="accept(p.request_id)">接受</n-button>
            <n-button size="small" type="error" @click="reject(p.request_id)">拒绝</n-button>
          </n-space>
        </div>
      </n-list-item>
    </n-list>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useFriendsStore } from '@/stores/friends'
const store = useFriendsStore()
const refresh = async () => {
  await store.refreshAll()
}
onMounted(refresh)
const openRequest = async (target: string) => {
  await store.request(target)
}
const accept = async (rid: string) => {
  await store.accept(rid)
}
const reject = async (rid: string) => {
  await store.reject(rid)
}
</script>

<style scoped></style>
