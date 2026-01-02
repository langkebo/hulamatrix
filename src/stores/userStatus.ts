import { averageColorFromImage } from '@/utils/AverageColor'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { StoresEnum } from '@/enums'
import type { UserStateType } from '@/services/wsType'

interface UserStateWithColor extends UserStateType {
  bgColor?: string
}

// 状态图标颜色
const ensureStateColor = (state?: UserStateWithColor) => {
  if (!state || state.bgColor || !state.url) return

  const img = new Image()
  img.src = state.url
  img.onload = async () => {
    try {
      const [r, g, b] = await averageColorFromImage(img)
      state.bgColor = `rgba(${r},${g},${b}, 0.4)`
    } catch {
      const [r, g, b] = await averageColorFromImage(img)
      state.bgColor = `rgba(${r},${g},${b}, 0.4)`
    }
  }
}

export const useUserStatusStore = defineStore(
  StoresEnum.USER_STATE,
  () => {
    /** 在线状态列表 */
    const stateList = ref<UserStateWithColor[]>([])

    const stateId = ref<string>('1')

    const currentState = computed(() => {
      const item = stateList.value.find((state: { id: string }) => state.id === stateId.value)

      if (!item) {
        const defaultItem = stateList.value.find((state: { id: string }) => state.id === '1')
        if (defaultItem) {
          ensureStateColor(defaultItem)
          return defaultItem
        }
      }

      if (item) {
        ensureStateColor(item)
      }
      return item as UserStateWithColor
    })

    watch(
      stateList,
      (list) => {
        if (Array.isArray(list)) {
          list.forEach((state: UserStateType) => ensureStateColor(state))
        }
      },
      { immediate: true }
    )

    return {
      stateList,
      stateId,
      currentState,
      setStateId: (id: string) => {
        stateId.value = id
      }
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  } as { share: { enable: boolean; initialize: boolean } }
)
