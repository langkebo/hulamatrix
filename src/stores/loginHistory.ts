import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'
import type { UserInfoType } from '@/services/types'

export const useLoginHistoriesStore = defineStore(
  StoresEnum.LOGIN_HISTORY,
  () => {
    const loginHistories = ref<UserInfoType[]>([])

    const getLoginHistoryIndex = (loginHistory: UserInfoType) => {
      return loginHistories.value.findIndex((i) => i.account === loginHistory.account)
    }

    const addLoginHistory = (loginHistory: UserInfoType) => {
      const index = getLoginHistoryIndex(loginHistory)
      const newList = [...loginHistories.value]
      if (index !== -1) {
        // 如果已存在，先删除旧的
        newList.splice(index, 1)
      }
      // 添加到数组开头
      newList.unshift(loginHistory)
      // 创建新数组以强制触发 Vue 响应式更新
      loginHistories.value = newList
    }

    const updateLoginHistory = (loginHistory: UserInfoType) => {
      const index = getLoginHistoryIndex(loginHistory)
      if (index !== -1) {
        // 创建新数组以强制触发 Vue 响应式更新
        const newList = [...loginHistories.value]
        newList[index] = loginHistory
        loginHistories.value = newList
      }
    }

    const removeLoginHistory = (loginHistory: UserInfoType) => {
      const index = getLoginHistoryIndex(loginHistory)
      if (index !== -1) {
        // 创建新数组以强制触发 Vue 响应式更新
        const newList = [...loginHistories.value]
        newList.splice(index, 1)
        loginHistories.value = newList
      }
    }

    return { loginHistories, addLoginHistory, updateLoginHistory, removeLoginHistory }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  } as { share: { enable: boolean; initialize: boolean } }
)
import { ref } from 'vue'
