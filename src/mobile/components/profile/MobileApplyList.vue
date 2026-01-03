<template>
  <n-flex vertical class="select-none">
    <n-flex
      v-if="props.closeHeader === true ? false : true"
      align="center"
      justify="space-between"
      class="color-[--text-color] px-20px py-10px">
      <p class="text-16px">{{ props.type === 'friend' ? '好友通知' : '群通知' }}</p>
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
      <template #default="{ item }">
        <div class="flex gap-2 w-full text-14px mb-15px">
          <div class="flex h-full">
            <n-avatar
              round
              size="large"
              :src="
                props.type === 'friend'
                  ? avatarSrc(getUserInfo(item)?.avatar || '')
                  : avatarSrc(groupDetailsMap[item.roomId]?.avatar || '/default-group-avatar.png')
              " />
          </div>
          <div class="flex-1 flex flex-col gap-10px">
            <div
              @click="isCurrentUser(item.senderId) ? (currentUserId = item.operateId) : (currentUserId = item.senderId)"
              class="flex justify-between text-14px text-#2DA38D">
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
            <div v-else class="flex gap-2 flex-1 text-12px text-gray-500">
              <div class="whitespace-nowrap">处理人:</div>
              <n-ellipsis :tooltip="true" expand-trigger="click" line-clamp="2" style="max-width: 100%">
                {{ groupStore.getUserInfo(item.senderId)?.name || '未知用户' }}
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
            <span class="text-(12px #909090)" v-else-if="item.status === RequestNoticeAgreeStatus.IGNORE">已忽略</span>
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
      <n-empty :description="props.type === 'friend' ? '暂无好友申请' : '暂无群通知'" />
    </n-flex>
  </n-flex>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { uniq } from 'es-toolkit'
import { NoticeType, RequestNoticeAgreeStatus } from '@/services/types'
import { useFriendsStore } from '@/stores/friends'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { useGroupStore } from '@/stores/group'
import type { NoticeItem } from '@/services/types'
import { logger } from '@/utils/logger'

const userStore = useUserStore()
const friendsStore = useFriendsStore()
const groupStore = useGroupStore()
const currentUserId = ref('0')
const loadingMap = ref<Record<string, boolean>>({})
const virtualListRef = ref()
const isLoadingMore = ref(false)
const props = defineProps<{
  type: 'friend' | 'group'
  customHeight?: number
  closeHeader?: boolean
}>()

// 存储群组信息的响应式对象
const groupDetailsMap = ref<Record<string, { name: string; avatar?: string }>>({})
const loadingGroups = ref<Set<string>>(new Set())

// 检查好友申请是否已被接受
type MinimalNotice = Pick<NoticeItem, 'status' | 'senderId' | 'eventType' | 'roomId' | 'operateId' | 'applyId'>
const isAccepted = (item: MinimalNotice) => {
  return item.status !== RequestNoticeAgreeStatus.UNTREATED
}

const applyList = computed<MinimalNotice[]>(() => {
  if (props.type === 'friend') {
    return (friendsStore.pending || []).map((p: { request_id: string; requester_id: string }) => ({
      applyId: p.request_id,
      senderId: p.requester_id,
      operateId: p.requester_id,
      eventType: NoticeType.FRIEND_APPLY,
      roomId: '',
      status: RequestNoticeAgreeStatus.UNTREATED
    }))
  }
  return friendsStore.pendingGroups || []
})

// 获取群组信息的函数
const getGroupDetail = async (roomId: string) => {
  if (!roomId) return null

  // 如果已经在加载中，直接返回
  if (loadingGroups.value.has(roomId)) {
    return null
  }

  // 如果已经有缓存，直接返回
  if (groupDetailsMap.value[roomId]) {
    return groupDetailsMap.value[roomId]
  }

  // 开始加载
  loadingGroups.value.add(roomId)
  try {
    // 使用 groupStore 获取群组信息
    const groupDetail = await groupStore.fetchGroupDetailSafely(roomId)
    if (groupDetail) {
      const groupInfo = {
        name: groupDetail.groupName || '',
        avatar: groupDetail.avatar || ''
      }
      groupDetailsMap.value[roomId] = groupInfo
      return groupInfo
    }
  } catch (error) {
    logger.error('获取群组信息失败:', error)
  } finally {
    loadingGroups.value.delete(roomId)
  }

  return null
}

// 异步获取群组信息的计算属性
const applyMsg = computed(() => (item: MinimalNotice) => {
  if (props.type === 'friend') {
    return isCurrentUser(item.senderId) ? (isAccepted(item) ? '已同意你的请求' : '正在验证你的邀请') : '请求加为好友'
  } else {
    const groupDetail = groupDetailsMap.value[item.roomId]
    if (!groupDetail) {
      if (item.roomId && !loadingGroups.value.has(item.roomId)) {
        getGroupDetail(item.roomId)
      }
      return '加载中...'
    }

    if (item.eventType === NoticeType.GROUP_APPLY) {
      return '申请加入 [' + groupDetail.name + ']'
    } else if (item.eventType === NoticeType.GROUP_INVITE) {
      const inviter = item.operateId ? groupStore.getUserInfo(item.operateId)?.name || '未知用户' : '未知用户'
      return '邀请' + inviter + '加入 [' + groupDetail.name + ']'
    } else if (isFriendApplyOrGroupInvite(item)) {
      return isCurrentUser(item.senderId)
        ? '已同意加入 [' + groupDetail.name + ']'
        : '邀请你加入 [' + groupDetail.name + ']'
    } else if (item.eventType === NoticeType.GROUP_MEMBER_DELETE) {
      const operator = item.senderId ? groupStore.getUserInfo(item.senderId)?.name || '未知用户' : '未知用户'
      return '已被' + operator + '踢出 [' + groupDetail.name + ']'
    } else if (item.eventType === NoticeType.GROUP_SET_ADMIN) {
      return '已被群主设置为 [' + groupDetail.name + '] 的管理员'
    } else if (item.eventType === NoticeType.GROUP_RECALL_ADMIN) {
      return '已被群主取消 [' + groupDetail.name + '] 的管理员权限'
    }
    return '通知'
  }
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
 * 获取当前用户查询视角
 * @param item 通知消息
 */
const getUserInfo = (item: MinimalNotice) => {
  interface UserInfo {
    uid: string
    name: string
    avatar: string
    [key: string]: unknown
  }

  let userInfo: UserInfo | undefined
  switch (item.eventType) {
    case NoticeType.FRIEND_APPLY:
    case NoticeType.GROUP_MEMBER_DELETE:
    case NoticeType.GROUP_SET_ADMIN:
    case NoticeType.GROUP_RECALL_ADMIN:
      userInfo = item.operateId ? groupStore.getUserInfo(item.operateId) : undefined
      break
    case NoticeType.ADD_ME:
    case NoticeType.GROUP_INVITE:
    case NoticeType.GROUP_INVITE_ME:
    case NoticeType.GROUP_APPLY:
      userInfo = item.senderId ? groupStore.getUserInfo(item.senderId) : undefined
      break
    default:
      userInfo = undefined
  }

  return (
    userInfo || {
      uid: '',
      name: '未知用户',
      avatar: ''
    }
  )
}

// 判断是否为好友申请或者群申请、群邀请
const isFriendApplyOrGroupInvite = (item: MinimalNotice) => {
  return (
    item.eventType === NoticeType.FRIEND_APPLY ||
    item.eventType === NoticeType.GROUP_APPLY ||
    item.eventType === NoticeType.GROUP_INVITE ||
    item.eventType === NoticeType.GROUP_INVITE_ME ||
    item.eventType === NoticeType.ADD_ME
  )
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

const handleAgree = async (item: NoticeItem) => {
  const applyId = item.applyId
  loadingMap.value[applyId] = true
  try {
    if (props.type === 'friend') {
      await friendsStore.accept(applyId)
      await friendsStore.refreshAll()
    } else {
      await friendsStore.acceptGroupInvite(applyId)
    }
  } finally {
    setTimeout(() => {
      loadingMap.value[applyId] = false
    }, 600)
  }
}

// 处理好友请求操作
const handleFriendAction = async (action: string, applyId: string) => {
  loadingMap.value[applyId] = true
  try {
    if (props.type === 'friend') {
      if (action === 'reject') await friendsStore.reject(applyId)
      await friendsStore.refreshAll()
    } else {
      if (action === 'reject') await friendsStore.rejectGroupInvite(applyId)
      await friendsStore.refreshGroupPending()
    }
  } finally {
    setTimeout(() => {
      loadingMap.value[applyId] = false
    }, 600)
  }
}

onMounted(async () => {
  await friendsStore.refreshAll()
  await friendsStore.refreshGroupPending()
})

// 监听applyList变化，批量加载群组信息
watch(
  () => applyList.value,
  (newList) => {
    const roomIds = uniq(newList.filter((item) => item.roomId && Number(item.roomId) > 0).map((item) => item.roomId))

    if (roomIds.length > 0) {
      // 批量加载群组信息
      roomIds.forEach((roomId) => {
        if (!groupDetailsMap.value[roomId] && !loadingGroups.value.has(roomId)) {
          getGroupDetail(roomId)
        }
      })
    }
  },
  { immediate: true, deep: true }
)
</script>

<style scoped lang="scss"></style>
