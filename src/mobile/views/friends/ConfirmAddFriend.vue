<template>
  <div class="flex flex-1 flex-col">
    <img :src="bgImage" class="w-100% absolute top-0 -z-1" alt="hula" />
    <AutoFixHeightPage :show-footer="false">
      <template #header>
        <HeaderBar
          :isOfficial="false"
          :hidden-right="true"
          :enable-default-background="false"
          :enable-shadow="false"
          room-name="添加好友" />
      </template>

      <template #container>
        <div class="flex flex-col gap-1 overflow-auto h-full">
          <!-- 内容区域 -->
          <div class="w-full h-full box-border flex flex-col">
            <n-flex vertical justify="center" :size="20" class="p-[55px_20px] m-20px rounded-15px bg-white">
              <n-flex align="center" justify="center" :size="20">
                <n-avatar round size="large" :src="avatarSrc" />

                <n-flex vertical :size="10">
                  <p class="text-[--text-color]">{{ userInfo.name }}</p>
                  <p class="text-(12px [--text-color])">账号: {{ userInfo.account }}</p>
                </n-flex>
              </n-flex>

              <n-input
                v-model:value="requestMsg"
                :allow-input="(value: string) => !value.startsWith(' ') && !value.endsWith(' ')"
                :autosize="requestMsgAutosize"
                :maxlength="60"
                :count-graphemes="countGraphemes"
                show-count
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                type="textarea"
                placeholder="输入几句话，对TA说些什么吧" />

              <n-button class="mt-30px" :color="'#13987f'" @click="addFriend">添加好友</n-button>
            </n-flex>
          </div>
        </div>
      </template>
    </AutoFixHeightPage>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useCommon } from '@/hooks/useCommon'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { friendsServiceV2 } from '@/services/friendsServiceV2'
import router from '@/router'
import bgImage from '@/assets/mobile/chat-home/background.webp'

import { msg } from '@/utils/SafeUI'
const globalStore = useGlobalStore()
const userStore = useUserStore()
const groupStore = useGroupStore()
const { countGraphemes } = useCommon()
const requestMsgAutosize = { minRows: 3, maxRows: 3 }
const userInfo = ref(groupStore.getUserInfo(globalStore.addFriendModalInfo.uid!)!)
const avatarSrc = computed(() => AvatarUtils.getAvatarUrl(userInfo.value!.avatar as string))
const requestMsg = ref()

watch(
  () => globalStore.addFriendModalInfo.uid,
  (newUid) => {
    userInfo.value = groupStore.getUserInfo(newUid!)!
  }
)

const addFriend = async () => {
  try {
    await friendsServiceV2.sendFriendRequest(globalStore.addFriendModalInfo.uid as string, requestMsg.value)
    msg.success?.('已发送好友申请')
    setTimeout(() => {
      router.push('/mobile/message')
    }, 2000)
  } catch (error) {
    msg.error?.('发送好友申请失败，请重试')
  }
}

onMounted(async () => {
  requestMsg.value = `我是${userStore.userInfo!.name}`
})
</script>

<style scoped lang="scss"></style>
