<template>
  <div class="h-full w-full bg-[--center-bg-color] select-none cursor-default">
    <!-- 窗口头部 -->
    <ActionBar
      class="absolute right-0 w-full z-999"
      :shrink="false"
      :max-w="false"
      :current-label="WebviewWindow.getCurrent().label" />

    <!-- 标题 -->
    <p class="absolute-x-center h-fit pt-6px text-(13px [--text-color]) select-none cursor-default">
      {{ t('message.friend_verify.title') }}
    </p>

    <!-- 内容区域 -->
    <div class="bg-[--bg-edit] w-380px h-full box-border flex flex-col">
      <n-flex vertical justify="center" :size="20" class="p-[55px_20px]" data-tauri-drag-region>
        <n-flex align="center" justify="center" :size="20" data-tauri-drag-region>
          <n-avatar round size="large" :src="avatarSrc" />

          <n-flex vertical :size="10">
            <p class="text-[--text-color]">{{ userInfo.name }}</p>
            <p class="text-(12px [--text-color])">
              {{ t('message.friend_verify.account', { account: userInfo.account }) }}
            </p>
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
          :placeholder="t('message.friend_verify.placeholder')" />

        <n-button class="mt-30px" :color="'var(--hula-accent, #13987f)'" :loading="loading" :disabled="loading" @click="addFriend">
          {{ t('message.friend_verify.send_btn') }}
        </n-button>
      </n-flex>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useCommon } from '@/hooks/useCommon'
import { useGlobalStore } from '@/stores/global'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { requestWithFallback } from '@/utils/MatrixApiBridgeAdapter'
import { useGroupStore } from '@/stores/group'
import { useFriendsStore } from '@/stores/friends'
import { useI18n } from 'vue-i18n'

import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const globalStore = useGlobalStore()
const userStore = useUserStore()
const groupStore = useGroupStore()
const friendsStore = useFriendsStore()
const { countGraphemes } = useCommon()
const requestMsgAutosize = { minRows: 3, maxRows: 3 }
const userInfo = ref(groupStore.getUserInfo(globalStore.addFriendModalInfo.uid!)!)
const avatarSrc = computed(() => AvatarUtils.getAvatarUrl(userInfo.value!.avatar as string))
const requestMsg = ref()
const loading = ref(false)

watch(
  () => globalStore.addFriendModalInfo.uid,
  (newUid: string | number | undefined) => {
    if (newUid != null) {
      userInfo.value = groupStore.getUserInfo(String(newUid))!
    }
  }
)

const addFriend = async () => {
  if (loading.value) return

  loading.value = true
  try {
    const targetUid = globalStore.addFriendModalInfo.uid as string

    // 检查是否是 Matrix 用户 ID（格式：@username:server）
    const isMatrixUser = targetUid.startsWith('@')

    if (isMatrixUser) {
      // 使用 Matrix Friends API 发送好友请求
      logger.info('[AddFriendVerify] Sending Matrix friend request', { targetUid })
      await friendsStore.request(targetUid, requestMsg.value)
    } else {
      // 使用旧的接口发送好友请求（fallback）
      logger.info('[AddFriendVerify] Sending legacy friend request', { targetUid })
      await requestWithFallback({
        url: 'send_add_friend_request',
        body: {
          msg: requestMsg.value,
          targetUid
        }
      })
    }

    msg.success(t('message.friend_verify.toast_success'))
    setTimeout(async () => {
      await getCurrentWebviewWindow().close()
    }, 2000)
  } catch (error: unknown) {
    logger.error('[AddFriendVerify] Failed to send friend request', { error })
    const errorMessage =
      error && typeof error === 'object' && 'message' in error ? String(error.message) : '发送好友请求失败'
    msg.error(errorMessage)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await getCurrentWebviewWindow().show()
  requestMsg.value = t('message.friend_verify.default_msg', { name: userStore.userInfo!.name })
})
</script>

<style scoped lang="scss"></style>
