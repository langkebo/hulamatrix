import { defineStore } from 'pinia'
import { StoresEnum, SexEnum } from '@/enums'
import type { UserInfoType } from '@/services/types'
import { requestWithFallback } from '@/utils/MatrixApiBridgeAdapter'
import * as PathUtil from '@/utils/PathUtil'
import { useGlobalStore } from './global'
import { computed, ref } from 'vue'
import { logger } from '@/utils/logger'
import { useMatrixClient } from '@/composables'

/**
 * 默认用户信息（开发环境降级使用）
 */
const DEFAULT_USER_INFO: UserInfoType = {
  uid: '',
  name: '未登录用户',
  account: 'guest@hula.dev',
  email: '',
  avatar: '',
  modifyNameChance: 0,
  sex: SexEnum.MAN,
  userStateId: '',
  avatarUpdateTime: 0,
  client: 'web',
  resume: ''
}

export const useUserStore = defineStore(
  StoresEnum.USER,
  () => {
    const userInfo = ref<UserInfoType>(DEFAULT_USER_INFO)
    const globalStore = useGlobalStore()
    const isInitialized = ref(false)

    const getUserDetailAction = async () => {
      try {
        const res = (await requestWithFallback({
          url: 'get_user_info'
        })) as Partial<UserInfoType>
        userInfo.value = { ...userInfo.value, ...res }
        isInitialized.value = true
      } catch (e) {
        logger.error('获取用户详情失败:', e)
        // 保留默认值，不覆盖
      }
    }

    const isMe = computed(() => (id: string) => {
      return userInfo.value?.uid === id
    })

    const getUserRoomDir = async () => {
      if (!userInfo.value?.uid) {
        logger.warn('[UserStore] 用户未登录，无法获取用户目录')
        return ''
      }
      return await PathUtil.getUserVideosDir(userInfo.value!.uid, globalStore.currentSessionRoomId)
    }

    const getUserRoomAbsoluteDir = async () => {
      if (!userInfo.value?.uid) {
        logger.warn('[UserStore] 用户未登录，无法获取用户目录')
        return ''
      }
      return await PathUtil.getUserAbsoluteVideosDir(userInfo.value!.uid, globalStore.currentSessionRoomId)
    }

    /**
     * 重置用户信息（用于登出）
     */
    const reset = () => {
      userInfo.value = DEFAULT_USER_INFO
      isInitialized.value = false
    }

    /**
     * 设置用户信息（用于登录）
     */
    const setUserInfo = (info: Partial<UserInfoType>) => {
      userInfo.value = { ...DEFAULT_USER_INFO, ...info }
      isInitialized.value = true
    }

    /**
     * 获取用户显示名称
     * 优先使用缓存，其次从 Matrix 客户端获取
     */
    const getDisplayName = (userId: string): string | undefined => {
      if (userId === userInfo.value?.uid) {
        return userInfo.value?.name
      }

      const { client } = useMatrixClient()
      if (!client.value) {
        logger.warn('[UserStore] Cannot get display name: Matrix client not available')
        return undefined
      }

      try {
        const matrixClient = client.value as unknown as {
          getUser?: (userId: string) => { displayName?: string } | null
        }
        const user = matrixClient.getUser?.(userId)
        return user?.displayName
      } catch (error) {
        logger.error('[UserStore] Failed to get display name:', error)
        return undefined
      }
    }

    /**
     * 获取用户头像 URL
     * 优先使用缓存，其次从 Matrix 客户端获取
     */
    const getUserAvatar = (userId: string): string | undefined => {
      if (userId === userInfo.value?.uid) {
        return userInfo.value?.avatar
      }

      const { client } = useMatrixClient()
      if (!client.value) {
        return undefined
      }

      try {
        const matrixClient = client.value as unknown as {
          getUser?: (userId: string) => { avatarUrl?: string } | null
          mxcUrlToHttp?: (mxcUrl: string) => string
        }
        const user = matrixClient.getUser?.(userId)
        const mxcUrl = user?.avatarUrl
        if (mxcUrl && matrixClient.mxcUrlToHttp) {
          return matrixClient.mxcUrlToHttp(mxcUrl)
        }
        return mxcUrl
      } catch (error) {
        logger.error('[UserStore] Failed to get avatar:', error)
        return undefined
      }
    }

    // 别名：为了兼容性添加 `user` 属性
    const user = computed(() => ({
      userId: userInfo.value?.uid,
      ...userInfo.value
    }))

    return {
      userInfo,
      user,
      getUserDetailAction,
      isMe,
      getUserRoomDir,
      getUserRoomAbsoluteDir,
      reset,
      setUserInfo,
      isInitialized,
      getDisplayName,
      getUserAvatar
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  } as { share: { enable: boolean; initialize: boolean } }
)
