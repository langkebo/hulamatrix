<!--
  好友列表组件 v2.0
  使用 SDK v2.0 API 和 useFriendsStoreV2
  PC 端和移动端通用
-->
<template>
  <div class="p-16px max-w-1080px m-auto">
    <n-space align="center" justify="space-between">
      <div class="text-16px">好友（SDK v2.0）</div>
      <n-space>
        <n-button tertiary @click="refresh">刷新</n-button>
        <n-button tertiary type="primary" @click="showAddDialog = true">添加好友</n-button>
      </n-space>
    </n-space>

    <!-- 加载状态 -->
    <div v-if="friendsStore.loading" class="mt-8px">
      <n-skeleton height="20px" :repeat="8" />
    </div>

    <!-- 错误提示 -->
    <n-alert v-if="friendsStore.error" type="warning" :show-icon="true" class="mt-8px">
      {{ friendsStore.error }}
    </n-alert>

    <!-- 统计信息 -->
    <n-space v-if="!friendsStore.loading && !friendsStore.error" class="mt-8px" :size="16">
      <n-statistic label="好友总数" :value="friendsStore.totalFriendsCount" />
      <n-statistic label="在线好友" :value="friendsStore.onlineFriendsCount" />
      <n-statistic label="待处理请求" :value="friendsStore.pendingCount" />
    </n-space>

    <!-- 按分类显示好友 -->
    <div v-if="!friendsStore.loading" class="mt-16px">
      <n-tabs type="line" animated>
        <!-- 全部好友 -->
        <n-tab-pane name="all" :tab="`全部好友 (${friendsStore.friends.length})`">
          <n-grid x-gap="12" y-gap="12" cols="2 s:1" class="mt-8px">
            <n-grid-item v-for="f in friendsStore.friends" :key="f.user_id">
              <n-card size="small" :bordered="true">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-8px">
                    <n-avatar :size="40" round>
                      {{ (f.display_name || f.user_id)?.charAt(0)?.toUpperCase() }}
                    </n-avatar>
                    <div>
                      <div class="font-600">{{ f.display_name || f.user_id }}</div>
                      <div class="text-(12px #909090)">{{ f.user_id }}</div>
                      <div class="text-(12px #666)">状态: {{ f.presence || 'unknown' }}</div>
                    </div>
                  </div>
                  <n-space>
                    <n-button size="small" @click="startChat(f)">聊天</n-button>
                  </n-space>
                </div>
              </n-card>
            </n-grid-item>
          </n-grid>
        </n-tab-pane>

        <!-- 按分类显示 -->
        <n-tab-pane
          v-for="category in friendsStore.categories"
          :key="category.id"
          :name="category.id"
          :tab="`${category.name} (${getFriendsByCategory(category.id).length})`">
          <n-grid x-gap="12" y-gap="12" cols="2 s:1" class="mt-8px">
            <n-grid-item v-for="f in getFriendsByCategory(category.id)" :key="f.user_id">
              <n-card size="small" :bordered="true">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-8px">
                    <n-avatar :size="40" round>
                      {{ (f.display_name || f.user_id)?.charAt(0)?.toUpperCase() }}
                    </n-avatar>
                    <div>
                      <div class="font-600">{{ f.display_name || f.user_id }}</div>
                      <div class="text-(12px #909090)">{{ f.user_id }}</div>
                      <div class="text-(12px #666)">状态: {{ f.presence || 'unknown' }}</div>
                    </div>
                  </div>
                  <n-space>
                    <n-button size="small" @click="startChat(f)">聊天</n-button>
                  </n-space>
                </div>
              </n-card>
            </n-grid-item>
          </n-grid>
        </n-tab-pane>
      </n-tabs>
    </div>

    <!-- 待处理好友请求 -->
    <n-divider class="mt-16px">待处理好友请求 ({{ friendsStore.pendingRequests.length }})</n-divider>
    <n-list v-if="friendsStore.pendingRequests.length > 0">
      <n-list-item v-for="p in friendsStore.pendingRequests" :key="p.id">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-8px">
            <n-avatar :size="40" round>
              {{ (p.requester_display_name || p.requester_id)?.charAt(0)?.toUpperCase() }}
            </n-avatar>
            <div>
              <div class="font-600">{{ p.requester_display_name || p.requester_id }}</div>
              <div class="text-(12px #909090)">{{ p.requester_id }}</div>
              <div v-if="p.message" class="text-(12px #666) mt-4px">
                {{ p.message }}
              </div>
            </div>
          </div>
          <n-space>
            <n-button size="small" type="primary" @click="acceptRequest(p.id)">接受</n-button>
            <n-button size="small" type="error" @click="rejectRequest(p.id)">拒绝</n-button>
          </n-space>
        </div>
      </n-list-item>
    </n-list>
    <n-empty v-else description="暂无待处理请求" />

    <!-- 添加好友对话框 -->
    <n-modal v-model:show="showAddDialog" preset="card" title="添加好友" style="width: 90%; max-width: 400px">
      <n-form label-placement="left" label-width="80">
        <n-form-item label="用户 ID">
          <n-input v-model:value="addUserId" placeholder="请输入完整用户 ID，如 @user:cjystx.top" />
        </n-form-item>
        <n-form-item label="验证消息">
          <n-input
            v-model:value="addMessage"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder="请输入验证消息（可选）" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showAddDialog = false">取消</n-button>
          <n-button type="primary" @click="sendRequest" :loading="isSending">发送请求</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NSpace,
  NButton,
  NCard,
  NGrid,
  NGridItem,
  NStatistic,
  NAlert,
  NSkeleton,
  NTabs,
  NTabPane,
  NList,
  NListItem,
  NDivider,
  NEmpty,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NAvatar,
  useMessage
} from 'naive-ui'
import { useFriendsSDKStore } from '@/stores/friendsSDK'
import type { FriendWithProfile } from '@/stores/friendsSDK'

const router = useRouter()
const message = useMessage()

// 使用 SDK Store
const friendsStore = useFriendsSDKStore()

// 本地状态
const showAddDialog = ref(false)
const addUserId = ref('')
const addMessage = ref('请加我好友')
const isSending = ref(false)

// 方法
const refresh = async () => {
  await friendsStore.refresh()
}

const getFriendsByCategory = (categoryId: string) => {
  return friendsStore.friends.filter((f) => f.category_id === categoryId)
}

const startChat = async (friend: FriendWithProfile) => {
  // 导航到私聊页面
  router.push({ path: '/private-chat', query: { userId: friend.user_id } })
}

const acceptRequest = async (requestId: string) => {
  try {
    await friendsStore.acceptFriendRequest(requestId, { categoryId: '1' })
    message.success('已接受好友请求')
  } catch (error) {
    message.error('接受请求失败: ' + error)
  }
}

const rejectRequest = async (requestId: string) => {
  try {
    await friendsStore.rejectFriendRequest(requestId)
    message.success('已拒绝好友请求')
  } catch (error) {
    message.error('拒绝请求失败: ' + error)
  }
}

const sendRequest = async () => {
  if (!addUserId.value.trim()) {
    message.warning('请输入用户 ID')
    return
  }

  isSending.value = true
  try {
    await friendsStore.sendFriendRequest(addUserId.value, { message: addMessage.value })
    message.success('好友请求已发送')
    showAddDialog.value = false
    addUserId.value = ''
    addMessage.value = '请加我好友'
  } catch (error) {
    message.error('发送请求失败: ' + error)
  } finally {
    isSending.value = false
  }
}

// 生命周期
onMounted(async () => {
  await friendsStore.initialize()
})
</script>

<style scoped>
.font-600 {
  font-weight: 600;
}
</style>
