import { computed, type ComputedRef, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { OnlineEnum } from '@/enums'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user'
import { useUserStatusStore } from '@/stores/userStatus'
import { usePresenceStore } from '@/stores/presence'

// 在线状态管理(仅是在线和离线)
export const useOnlineStatus = (uid?: ComputedRef<string | undefined> | Ref<string | undefined>) => {
  const { t } = useI18n()
  const userStore = useUserStore()
  const groupStore = useGroupStore()
  const userStatusStore = useUserStatusStore()
  const presenceStore = usePresenceStore()
  const { currentState } = storeToRefs(userStatusStore)

  // 如果传入了uid参数，使用传入的uid对应的用户信息；否则使用当前登录用户的信息
  const currentUser = uid
    ? computed(() => (uid.value ? groupStore.getUserInfo(uid.value) : undefined))
    : computed(() => {
        // 没有传入uid时，这是当前登录用户
        // 优先从 groupStore 获取以获得 activeStatus
        const currentUid = userStore.userInfo?.uid
        if (currentUid) {
          const groupUserInfo = groupStore.getUserInfo(currentUid)
          if (groupUserInfo) {
            return groupUserInfo
          }
        }
        // 如果 groupStore 中没有，创建一个基础的用户信息对象
        return userStore.userInfo
          ? {
              uid: userStore.userInfo.uid,
              name: userStore.userInfo.name,
              avatar: userStore.userInfo.avatar,
              account: userStore.userInfo.account,
              activeStatus: OnlineEnum.ONLINE, // 当前登录用户默认在线
              userStateId: userStore.userInfo.userStateId || '1'
            }
          : undefined
      })

  // userStateId优先从userStore获取（保证响应式更新），如果没有则从currentUser获取
  const userStateId = uid
    ? computed(() => currentUser.value?.userStateId)
    : computed(() => userStore.userInfo?.userStateId)

  // 对于当前登录用户，使用 presenceStore 的状态；对于其他用户，使用 groupStore 的 activeStatus
  const activeStatus = computed(() => {
    if (!uid) {
      // 当前登录用户 - 检查 presenceStore
      const currentUid = userStore.userInfo?.uid
      if (currentUid) {
        const presence = presenceStore.getPresence(currentUid)
        if (presence === 'online') return OnlineEnum.ONLINE
        if (presence === 'offline') return OnlineEnum.OFFLINE
      }
      // 默认在线（因为已经登录了）
      return OnlineEnum.ONLINE
    }
    // 其他用户 - 使用 groupStore 的 activeStatus
    return currentUser.value?.activeStatus ?? OnlineEnum.OFFLINE
  })

  const hasCustomState = computed(() => {
    const stateId = userStateId.value
    // 只有 '0' 表示清空状态（无自定义状态），其他都是自定义状态
    return !!stateId && stateId !== '0'
  })

  // 获取用户的状态信息
  const userStatus = computed(() => {
    if (!userStateId.value) return null
    return userStatusStore.stateList.find((state: { id: string }) => state.id === userStateId.value)
  })

  const isOnline = computed(() => activeStatus.value === OnlineEnum.ONLINE)

  const statusIcon = computed(() => {
    if (hasCustomState.value && userStatus.value?.url) {
      return userStatus.value.url
    }
    return isOnline.value ? '/status/online.png' : '/status/offline.png'
  })

  const statusTitle = computed(() => {
    if (hasCustomState.value && userStatus.value?.title) {
      const key = `auth.onlineStatus.states.${userStatus.value.title}`
      const translated = t(key)
      return translated === key ? userStatus.value.title : translated
    }
    return isOnline.value ? t('home.profile_card.status.online') : t('home.profile_card.status.offline')
  })

  const statusBgColor = computed(() => {
    if (hasCustomState.value && userStatus.value?.bgColor) {
      return userStatus.value.bgColor
    }
    return isOnline.value ? 'rgba(26, 178, 146, 0.4)' : 'rgba(144, 144, 144, 0.4)'
  })

  return {
    currentState,
    activeStatus,
    statusIcon,
    statusTitle,
    statusBgColor,
    isOnline,
    hasCustomState,
    userStatus
  }
}
