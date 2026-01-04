<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        style="border-bottom: 1px solid; border-color: #dfdfdf"
        :hidden-right="true"
        room-name="群成员" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col flex-1 gap-15px py-15px px-20px">
          <!-- 搜索表单 -->
          <n-form @submit="handleSubmit" class="flex flex-wrap gap-8px md:gap-10px px-12px">
            <div class="flex flex-1">
              <input
                v-model="formData.keyword"
                placeholder="搜索"
                class="bg-gray-100 text-center border-none w-full rounded-10px min-h-36px" />
            </div>
          </n-form>

          <div class="relative flex flex-1">
            <div ref="measure" class="flex absolute w-full h-full top-0 left-0 z-1"></div>
            <div class="absolute z-10 w-full">
              <div v-if="filteredList.length === 0" class="flex w-full justify-center mt-20px">无数据</div>

              <n-virtual-list
                v-else
                :style="{ height: virtualScrollerHeight + 'px', width: '100%' }"
                :item-size="42"
                :items="filteredList">
                <template #default="{ item }">
                  <div @click="toFriendInfo(item.uid)" :key="item.uid" class="flex items-start h-48 md:h-52">
                    <div class="flex items-center gap-10px">
                      <n-avatar
                        :size="40"
                        :src="AvatarUtils.getAvatarUrl(item.avatar)"
                        fallback-src="/logo.png"
                        round />
                      <div class="line-clamp-1">
                        {{ item.name }}
                      </div>
                    </div>
                  </div>
                </template>
              </n-virtual-list>
            </div>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { UserItem } from '@/services/types'
import { useRoomStore } from '@/stores/room'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { toFriendInfoPage } from '@/utils/RouterUtils'

const measure = ref(null)

const virtualScrollerHeight = ref(0)

defineOptions({
  name: 'mobileGroupChatMember'
})

const roomStore = useRoomStore()

const formData = ref({
  keyword: ''
})

const memberList = computed(() => {
  return (roomStore.currentMembers || []).map(
    (m) =>
      ({
        uid: m.userId,
        name: m.displayName,
        avatar: m.avatarUrl || '',
        account: m.userId,
        myName: m.displayName // 映射
      }) as UserItem
  )
})

const filteredList = ref<UserItem[]>([])

onMounted(() => {
  filteredList.value = memberList.value

  // 使用 ResizeObserver 监听 measure 元素的高度变化
  // 动态更新 virtualScrollerHeight 以适应列表内容
  if (measure.value) {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        virtualScrollerHeight.value = entry.contentRect.height
      }
    })
    observer.observe(measure.value)

    // 组件卸载时记得断开
    onBeforeUnmount(() => {
      observer.disconnect()
    })
  }
})

const toFriendInfo = (uid: string) => toFriendInfoPage(uid)

const search = useDebounceFn(() => {
  const kw = formData.value.keyword.trim().toLowerCase()

  if (!kw) {
    // 关键字为空时，直接恢复完整列表
    filteredList.value = memberList.value
    return
  }

  filteredList.value = memberList.value.filter((item) => {
    return (
      item.name?.toLowerCase().includes(kw) ||
      item.account?.toLowerCase().includes(kw) ||
      item.myName?.toLowerCase().includes(kw)
    )
  })
}, 300)

// 利用表单submit识别enter键触发
const handleSubmit = (e: Event) => {
  e.preventDefault()
  search()
}

watch(() => formData.value.keyword, search)
watch(memberList, () => {
  // 当成员列表更新时（例如初始化加载完成），刷新显示列表
  if (!formData.value.keyword) {
    filteredList.value = memberList.value
  } else {
    search()
  }
})
</script>

<style scoped></style>
