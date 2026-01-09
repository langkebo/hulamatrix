<template>
  <n-flex vertical class="select-none">
    <n-flex
      v-if="props.closeHeader === true ? false : true"
      align="center"
      justify="space-between"
      class="color-[--text-color] px-20px py-10px">
      <p class="text-16px">好友通知</p>
      <svg class="size-18px cursor-pointer">
        <use href="#delete"></use>
      </svg>
    </n-flex>

    <n-virtual-list
      :style="{
        maxHeight: props.customHeight
          ? props.customHeight + 'px'
          : 'max-height: calc(100vh / var(--page-scale, 1) - 80px)'
      }"
      :items="applyList"
      :item-size="87"
      :item-resizable="true"
      @scroll="handleScroll"
      ref="virtualListRef">
      <template var(--hula-gray-100)ult="{ item }">
        <div class="flex gap-2 w-full text-14px mb-15px">
          <div class="flex h-full">
            <n-avatar round size="large" :src="avatarSrc(getUserInfo(item)?.avatar || '')" />
          </div>
          <div class="flex-1 flex flex-col gap-10px">
            <div @click="currentUserId = item.senderId" class="flex justify-between text-14px text-#2DA38D">
              {{ getUserInfo(item)?.name || '未知用户' }}
            </div>
            <div class="flex justify-between text-gray-500 text-12px">
              <span>
                {{ applyMsg(item) }}
              </span>
            </div>
            <div v-if="isFriendApplyOrGroupInvite(item)" class="flex gap-2 flex-1 text-12px text-gray-500">
              <div class="whitespace-nowrap">留言:</div>
              <n-ellipsis :tooltip="true" expand-trigger="click" line-clamp="2" style="max-width: 100%">
                {{ item.content }}
              </n-ellipsis>
            </div>
          </div>
          <div
            v-if="isFriendApplyOrGroupInvite(item)"
            class="flex w-17 max-h-64px flex-col items-center justify-center">
            <n-flex
              align="center"
              :size="10"
              v-if="item.status === RequestNoticeAgreeStatus.UNTREATED && !isCurrentUser(item.senderId)">
              <n-button size="small" secondary :loading="loadingMap[item.applyId]" @click="handleAgree(item)">
                接受
              </n-button>
            </n-flex>
            <n-dropdown
              trigger="click"
              :options="dropdownOptions"
              @select="(key: string) => handleFriendAction(key, item.applyId)"
              v-if="item.status === RequestNoticeAgreeStatus.UNTREATED && !isCurrentUser(item.senderId)">
              <n-icon class="cursor-pointer px-15px py-3px rounded-5px mt-10px bg-gray-300 h-50% items-center flex">
                <svg class="size-16px color-[--text-color]">
                  <use href="#more"></use>
                </svg>
              </n-icon>
            </n-dropdown>
            <span class="text-(12px #64a29c)" v-else-if="item.status === RequestNoticeAgreeStatus.ACCEPTED">
              已同意
            </span>
            <span class="text-(12px #c14053)" v-else-if="item.status === RequestNoticeAgreeStatus.REJECTED">
              已拒绝
            </span>
            <span class="text-(12px var(--hula-gray-400))" v-else-if="item.status === RequestNoticeAgreeStatus.IGNORE">已忽略</span>
            <span
              class="text-(12px #64a29c)"
              :class="{ 'text-(12px #c14053)': item.status === RequestNoticeAgreeStatus.REJECTED }"
              v-else-if="isCurrentUser(item.senderId)">
              {{
                isAccepted(item)
                  ? '已同意'
                  : item.status === RequestNoticeAgreeStatus.REJECTED
                    ? '对方已拒绝'
                    : '等待验证'
              }}
            </span>
          </div>
        </div>
      </template>
    </n-virtual-list>

    <!-- 空数据提示 -->
    <n-flex v-if="applyList.length === 0" vertical justify="center" align="center" class="py-40px">
      <n-empty description="暂无好友申请" />
    </n-flex>
  </n-flex>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RequestNoticeAgreeStatus } from '@/services/types'
import type { NoticeItem } from '@/services/types'
import { useFriendsStore } from '@/stores/friendsSDK'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'

// 群邀请功能已移除 - 仅处理好友请求
const userStore = useUserStore()
const friendsStore = useFriendsStore()
const currentUserId = ref('0')
const loadingMap = ref<Record<string, boolean>>({})
const virtualListRef = ref()
const isLoadingMore = ref(false)
const props = defineProps<{
  type: 'friend'
  customHeight?: number
  closeHeader?: boolean
}>()

// 检查好友申请是否已被接受
type MinimalNotice = Pick<NoticeItem, 'status' | 'senderId' | 'eventType' | 'roomId' | 'operateId' | 'applyId'>
const isAccepted = (item: MinimalNotice) => {
  return item.status !== RequestNoticeAgreeStatus.UNTREATED
}

// 简化为仅处理好友请求
const applyList = computed<MinimalNotice[]>(() => {
  return (friendsStore.pending || []).map((p: { id: string; requester_id: string }) => ({
    applyId: p.id,
    senderId: p.requester_id,
    operateId: p.requester_id,
    eventType: 2, // FRIEND_APPLY
    roomId: '',
    status: RequestNoticeAgreeStatus.UNTREATED
  }))
})

// 群组相关代码已移除 - 仅处理好友请求

// 简化消息显示 - 仅处理好友请求
const applyMsg = computed(() => (item: MinimalNotice) => {
  return isCurrentUser(item.senderId) ? (isAccepted(item) ? '已同意你的请求' : '正在验证你的邀请') : '请求加为好友'
})

// 下拉菜单选项
const dropdownOptions = [
  {
    label: '拒绝',
    key: 'reject'
  },
  {
    label: '忽略',
    key: 'ignore'
  }
]

const avatarSrc = (url: string) => AvatarUtils.getAvatarUrl(url)

// 判断是否为当前登录用户
const isCurrentUser = (uid: string) => {
  return uid === (userStore.userInfo?.uid || '')
}

/**
 * 获取当前用户查询视角 - 仅处理好友请求
 * @param item 通知消息
 */
const getUserInfo = (_item: MinimalNotice) => {
  interface UserInfo {
    uid: string
    name: string
    avatar: string
    [key: string]: unknown
  }

  // 简化为仅处理好友请求 - 发送者信息需要从好友列表获取
  // 这里返回 undefined，让 UI 使用默认值
  const userInfo = undefined

  return (
    userInfo || {
      uid: '',
      name: '未知用户',
      avatar: ''
    }
  )
}

// 简化为仅判断好友申请
const isFriendApplyOrGroupInvite = (item: MinimalNotice) => {
  return item.eventType === 2 // FRIEND_APPLY
}

// 处理滚动事件
const handleScroll = (e: Event) => {
  if (isLoadingMore.value) return

  const { scrollTop, scrollHeight, clientHeight } = e.target as HTMLElement
  // 当滚动到距离底部20px以内时触发加载更多
  if (scrollHeight - scrollTop - clientHeight < 20) {
    loadMoreFriendRequests()
  }
}

// 加载更多好友申请
const loadMoreFriendRequests = async () => {
  // 如果已经是最后一页或正在加载中，则不再加载
  // 功能暂时禁用
  return
}

// 接受好友请求 - 仅处理好友请求
const handleAgree = async (item: NoticeItem) => {
  const applyId = item.applyId
  loadingMap.value[applyId] = true
  try {
    await friendsStore.accept(applyId)
    await friendsStore.refreshAll()
  } finally {
    setTimeout(() => {
      loadingMap.value[applyId] = false
    }, 600)
  }
}

// 处理好友请求操作 - 仅处理好友请求
const handleFriendAction = async (action: string, applyId: string) => {
  loadingMap.value[applyId] = true
  try {
    if (action === 'reject') await friendsStore.reject(applyId)
    await friendsStore.refreshAll()
  } finally {
    setTimeout(() => {
      loadingMap.value[applyId] = false
    }, 600)
  }
}

onMounted(async () => {
  await friendsStore.refreshAll()
})

// 群组信息监听已移除 - 仅处理好友请求
</script>

<style scoped lang="scss"></style>
