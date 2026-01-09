<template>
  <n-flex vertical class="select-none">
    <n-flex align="center" justify="space-between" class="color-[--text-color] px-20px py-10px">
      <p class="text-16px">
        {{ t('home.apply_list.friend_notice') }}
      </p>
    </n-flex>

    <n-virtual-list
      class="virtual-list-container"
      :items="applyList"
      :item-size="102"
      :item-resizable="true"
      @scroll="handleScroll"
      ref="virtualListRef">
      <template #default="{ item }">
        <n-flex vertical :size="10" class="p-[10px_30px] box-border">
          <n-flex
            align="center"
            justify="space-between"
            :size="10"
            class="bg-[--center-bg-color] rounded-10px p-20px box-border border-(1px solid [--bg-popover])">
            <n-flex align="center" :size="10" class="min-w-0 flex-1">
              <n-avatar
                round
                size="large"
                :src="avatarSrc(getUserInfo(item)?.avatar || '')"
                class="mr-10px" />
              <n-flex vertical :size="12" class="min-w-0 flex-1">
                <n-flex align="center" :size="10" class="min-w-0 flex-1 gap-10px">
                  <p
                    @click="currentUserId = item.senderId"
                    class="text-(14px) text-brand cursor-pointer shrink-0 max-w-150px truncate">
                    {{ getUserInfo(item)?.name || t('home.apply_list.unknown_user') }}
                  </p>

                  <div class="flex items-center min-w-0 flex-1 gap-6px">
                    <p class="text-(14px [--text-color]) min-w-0 truncate whitespace-nowrap">
                      {{ applyMsg(item) }}
                    </p>

                    <p class="text-(10px [--hula-gray-500,var(--hula-brand-primary)]) shrink-0 whitespace-nowrap">{{ formatTimestamp(item.createTime) }}</p>
                  </div>
                </n-flex>
                <p
                  :title="t('home.apply_list.message_label') + item.content"
                  v-if="isFriendApplyOrGroupInvite(item)"
                  class="text-(12px [--text-color]) cursor-default w-340px truncate">
                  {{ t('home.apply_list.message_label') }}{{ item.content }}
                </p>
                <p v-else class="text-(12px [--text-color])">
                  {{
                    t('home.apply_list.handler_label', {
                      name: getUserInfo(item)?.name || t('home.apply_list.unknown_user')
                    })
                  }}
                </p>
              </n-flex>
            </n-flex>

            <div v-if="isFriendApplyOrGroupInvite(item)" class="shrink-0 flex items-center gap-10px">
              <n-flex
                align="center"
                :size="10"
                class="shrink-0"
                v-if="item.status === RequestNoticeAgreeStatus.UNTREATED && !isCurrentUser(item.senderId)">
                <n-button secondary :loading="loadingMap[item.applyId]" @click="handleAgree(item)">
                  {{ t('home.apply_list.accept') }}
                </n-button>
                <n-dropdown
                  trigger="click"
                  :options="dropdownOptions"
                  @select="(key: string) => handleFriendAction(key, item.applyId)">
                  <n-icon class="cursor-pointer px-6px">
                    <svg class="size-16px color-[--text-color]">
                      <use href="#more"></use>
                    </svg>
                  </n-icon>
                </n-dropdown>
              </n-flex>
              <span class="text-(12px var(--hula-brand-primary))" v-else-if="item.status === RequestNoticeAgreeStatus.ACCEPTED">
                {{ t('home.apply_list.status.accepted') }}
              </span>
              <span class="text-(12px var(--hula-brand-primary))" v-else-if="item.status === RequestNoticeAgreeStatus.REJECTED">
                {{ t('home.apply_list.status.rejected') }}
              </span>
              <span class="text-(12px [--hula-gray-500,var(--hula-brand-primary)])" v-else-if="item.status === RequestNoticeAgreeStatus.IGNORE">
                {{ t('home.apply_list.status.ignored') }}
              </span>
              <span
                class="text-(12px var(--hula-brand-primary))"
                :class="{ 'text-(12px var(--hula-brand-primary))': item.status === RequestNoticeAgreeStatus.REJECTED }"
                v-else-if="isCurrentUser(item.senderId)">
                {{
                  isAccepted(item)
                    ? t('home.apply_list.status.accepted')
                    : item.status === RequestNoticeAgreeStatus.REJECTED
                      ? t('home.apply_list.status.rejected_by_other')
                      : t('home.apply_list.status.pending')
                }}
              </span>
            </div>
          </n-flex>
        </n-flex>
      </template>
    </n-virtual-list>

    <!-- 空数据提示 -->
    <n-flex v-if="applyList.length === 0" vertical justify="center" align="center" class="py-40px">
      <n-empty :description="t('home.apply_list.empty_friend')" />
    </n-flex>
  </n-flex>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NoticeItem } from '@/services/types'
import { RequestNoticeAgreeStatus } from '@/services/types'
import { useFriendsStore } from '@/stores/friendsSDK'
import type { PendingItem } from '@/stores/friendsSDK'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatTimestamp } from '@/utils/ComputedTime'

// 群组相关导入已移除 - 仅处理好友请求

const userStore = useUserStore()
const friendsStore = useFriendsStore()
const { t } = useI18n()
const currentUserId = ref('0')
const loadingMap = ref<Record<string, boolean>>({})
const virtualListRef = ref()

// 群邀请功能已移除，组件仅处理好友请求
const props = defineProps<{
  type: 'friend'
}>()

// 群组信息相关代码已移除 - 仅处理好友请求

// 检查好友申请是否已被接受
const isAccepted = (item: NoticeItem) => {
  return item.status !== RequestNoticeAgreeStatus.UNTREATED
}

// 简化为仅处理好友请求
const applyList = computed(() => {
  return (friendsStore.pending || []).map((p: PendingItem) => ({
    applyId: p.id,
    senderId: p.requester_id,
    operateId: p.requester_id,
    type: 2,
    eventType: 2,
    roomId: ''
  }))
})

// 群组信息相关代码已移除 - 仅处理好友请求

// 简化消息显示 - 仅处理好友请求
const applyMsg = computed(() => (item: NoticeItem) => {
  return isCurrentUser(item.senderId)
    ? isAccepted(item)
      ? t('home.apply_list.friend.accepted_you')
      : t('home.apply_list.friend.pending')
    : t('home.apply_list.friend.request')
})

// 下拉菜单选项
const dropdownOptions = computed(() => [
  {
    label: t('home.apply_list.dropdown.reject'),
    key: 'reject'
  },
  {
    label: t('home.apply_list.dropdown.ignore'),
    key: 'ignore'
  }
])

const avatarSrc = (url: string) => AvatarUtils.getAvatarUrl(url)

// 判断是否为当前登录用户
const isCurrentUser = (uid: string) => {
  return uid === userStore.userInfo!.uid
}

/**
 * 获取用户信息
 * @param item 通知消息
 * @returns 用户信息或 undefined
 */
// 简化为仅处理好友请求
const getUserInfo = (item: NoticeItem): { avatar?: string; name?: string } | undefined => {
  // 好友请求场景：获取发送者信息
  const senderId = item.senderId
  if (!senderId) return undefined

  // 尝试从 userStore 获取用户信息
  const userInfo = userStore.userInfo
  if (userInfo?.uid === senderId) {
    return { avatar: userInfo.avatar, name: userInfo.name }
  }

  // 返回 undefined，让 UI 使用默认值
  return undefined
}

// 简化为仅判断好友申请
const isFriendApplyOrGroupInvite = (item: NoticeItem) => {
  return item.eventType === 2 // FRIEND_APPLY
}

// 处理滚动事件
const handleScroll = (_e: Event) => {}

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

// 处理好友请求操作（拒绝或忽略）- 仅处理好友请求
const handleFriendAction = async (action: string, applyId: string) => {
  loadingMap.value[applyId] = true
  try {
    if (action === 'reject') {
      await friendsStore.reject(applyId)
      await friendsStore.refreshAll()
    } else if (action === 'ignore') {
      await friendsStore.refreshAll()
    }
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

<style scoped lang="scss">
.virtual-list-container {
  max-height: calc(100vh / var(--page-scale, 1) - 80px);
}
</style>
