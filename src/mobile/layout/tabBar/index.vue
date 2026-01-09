<template>
  <div class="tab-bar flex justify-around items-end pt-3">
    <RouterLink
      v-for="item in navItems"
      :key="item.path"
      :to="item.path"
      class="tab-item flex flex-col flex-1 items-center no-underline relative"
      :class="route.path === item.path ? 'color-[--tab-bar-icon-color]' : 'text-var(--hula-black)'">
      <n-badge
        class="flex flex-col w-55% flex-1 relative items-center"
        :offset="[-6, 6]"
        color="red"
        :value="getUnReadCount(item.label)"
        :max="99">
        <svg class="w-22px h-22px">
          <use :href="`#${route.path === item.path ? item.actionIcon : item.icon}`"></use>
        </svg>
        <span class="text-xs mt-1">{{ item.label }}</span>
      </n-badge>
    </RouterLink>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
// REMOVED: useFeedStore - Moments/Feed feature removed (custom backend no longer supported)
type NavItem = {
  label: string
  path: string
  icon: string
  actionIcon: string
}
const route = useRoute()
// REMOVED: feedStore and unreadCount - Moments/Feed feature removed
const getUnReadCount = (_label: string) => {
  // REMOVED: Feed unread count for '房间' label
  // 其他未读计数暂时关闭（message页面有问题）
  // if (label === '消息') {
  //   return unReadMark.value.newMsgUnreadCount
  // } else if (label === '联系人') {
  //   return unReadMark.value.newFriendUnreadCount
  // }
  return 0
}
const navItems: NavItem[] = [
  {
    label: '消息',
    path: '/mobile/message',
    icon: 'message',
    actionIcon: 'message-action'
  },
  {
    label: '联系人',
    path: '/mobile/mobileFriends',
    icon: 'avatar',
    actionIcon: 'avatar-action'
  },
  {
    label: '空间',
    path: '/mobile/spaces',
    icon: 'rectangle-small',
    actionIcon: 'rectangle-small'
  },
  {
    label: '我的',
    path: '/mobile/my',
    icon: 'wode',
    actionIcon: 'wode-action'
  }
]
</script>
<style scoped lang="scss">
.tab-bar {
  border-top: 0.5px solid #e3e3e3;
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}
</style>
