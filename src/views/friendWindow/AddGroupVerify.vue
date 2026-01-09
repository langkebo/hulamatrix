<template>
  <div class="h-full w-full bg-[--center-bg-color] select-none cursor-default">
    <!-- 窗口头部 -->
    <ActionBar
      class="absolute right-0 w-full z-999"
      :shrink="false"
      :max-w="false"
      :current-label="WebviewWindow.getCurrent().label" />

    <!-- 标题 -->
    <p
      class="absolute-x-center h-fit pt-6px text-(13px [--text-color]) select-none cursor-default"
      data-tauri-drag-region>
      {{ t('message.group_verify.title') }}
    </p>

    <!-- 内容区域 -->
    <div class="bg-[--bg-edit] w-380px h-full box-border flex flex-col">
      <n-flex vertical justify="center" :size="20" class="p-[55px_20px]" data-tauri-drag-region>
        <n-flex align="center" justify="center" :size="20" data-tauri-drag-region>
          <n-avatar round size="large" :src="userInfo.avatar ?? ''" />

          <n-flex vertical :size="10">
            <p class="text-[--text-color]">{{ userInfo.name }}</p>
            <p class="text-(12px [--text-color])">
              {{ t('message.group_verify.account', { account: userInfo.account }) }}
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
          :placeholder="t('message.group_verify.placeholder')" />

        <n-button class="mt-120px" :color="'#13987f'" @click="addFriend">
          {{ t('message.group_verify.send_btn') }}
        </n-button>
      </n-flex>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useCommon } from '@/hooks/useCommon'
import { useGlobalStore } from '@/stores/global'
import { useUserStore } from '@/stores/user'
import { useI18n } from 'vue-i18n'
import { logger, toError } from '@/utils/logger'

import { msg } from '@/utils/SafeUI'

const { t } = useI18n()
const globalStore = useGlobalStore()
const userStore = useUserStore()
const { countGraphemes } = useCommon()
const requestMsgAutosize = { minRows: 3, maxRows: 3 }
const userInfo = ref(globalStore.addGroupModalInfo)
const requestMsg = ref('')

watch(
  () => globalStore.addGroupModalInfo,
  (newUid: { show: boolean; name?: string; avatar?: string; account?: string }) => {
    userInfo.value = { ...newUid }
  }
)

/**
 * 申请加入群组
 *
 * @deprecated 原有 WebSocket API (apply_group) 已废弃
 *
 * Matrix 替代方案：
 * 1. 如果房间是公开的：使用 joinRoom(roomId) 直接加入
 * 2. 如果房间需要邀请：需要管理员邀请
 * 3. 如果需要申请：发送房间消息申请加入，由管理员审核
 *
 * 当前实现：直接尝试加入房间，如果失败则提示用户联系管理员
 */
const addFriend = async () => {
  try {
    const roomId = globalStore.addGroupModalInfo.roomId
    if (!roomId) {
      msg.error(t('message.group_verify.toast_error'))
      return
    }

    // 使用 Matrix rooms 模块的 joinRoom 加入房间
    const { joinRoom: matrixJoinRoom } = await import('@/integrations/matrix/rooms')
    await matrixJoinRoom(roomId)

    // 如果有申请消息，可以作为欢迎消息发送
    if (requestMsg.value.trim()) {
      const { unifiedMessageService } = await import('@/services/unified-message-service')
      await unifiedMessageService.sendMessage({
        roomId,
        type: 1, // TEXT
        body: { text: requestMsg.value }
      })
    }

    msg.success(t('message.group_verify.toast_success'))
    setTimeout(async () => {
      await getCurrentWebviewWindow().close()
    }, 2000)
  } catch (error) {
    logger.error('加入群组失败:', toError(error))
    msg.error(t('message.group_verify.toast_error'))
  }
}

onMounted(async () => {
  await getCurrentWebviewWindow().show()
  requestMsg.value = t('message.group_verify.default_msg', { name: userStore.userInfo!.name })
})
</script>

<style scoped lang="scss"></style>
