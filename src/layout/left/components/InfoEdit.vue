<template>
  <n-modal v-model:show="editInfo.show" :mask-closable="false" class="rounded-8px" transform-origin="center">
    <div class="bg-[--bg-edit] w-480px h-fit box-border flex flex-col">
      <n-flex :size="6" vertical>
        <div
          v-if="isMac()"
          @click="editInfo.show = false"
          class="mac-close size-13px shadow-inner bg-#ed6a5eff rounded-50% mt-6px select-none absolute left-6px">
          <svg class="hidden size-7px color-#000 select-none absolute top-3px left-3px">
            <use href="#close"></use>
          </svg>
        </div>

        <n-flex class="text-(14px [--text-color]) select-none pt-6px" justify="center">
          {{ t('home.profile_edit.title') }}
        </n-flex>

        <svg
          v-if="isWindows()"
          class="size-14px cursor-pointer pt-6px select-none absolute right-6px"
          @click="editInfo.show = false">
          <use href="#close"></use>
        </svg>
        <span class="h-1px w-full bg-[--line-color]"></span>
      </n-flex>
      <n-flex :size="20" class="p-22px select-none" vertical>
        <!-- 头像 -->
        <n-flex justify="center">
          <n-popover trigger="hover" :delay="300" :duration="300" placement="bottom">
            <template #trigger>
              <div class="avatar-wrapper relative" @click="openAvatarCropper">
                <n-avatar :size="80" :src="AvatarUtils.getAvatarUrl(editInfo.content.avatar!)" round color="#00BFA5" />
                <div class="avatar-hover absolute size-full rounded-50% flex-center">
                  <span class="text-12px color-#606060">{{ t('home.profile_edit.avatar.change') }}</span>
                </div>
              </div>
            </template>
            <p class="text-12px text-[--chat-text-color] w-280px leading-5 p-4px">
              {{ t('home.profile_edit.avatar.tips') }}
            </p>
          </n-popover>
        </n-flex>
        <!-- 昵称编辑输入框 -->
        <n-popover placement="top-start" trigger="click">
          <template #trigger>
            <n-input
              ref="inputInstRef"
              v-model:value="localUserInfo.name"
              :count-graphemes="countGraphemes"
              :maxlength="8"
              class="rounded-6px"
              clearable
              spellcheck="false"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              :allow-input="noSideSpace"
              :placeholder="t('home.profile_edit.form.nickname.placeholder')"
              show-count
              type="text">
              <template #prefix>
                <span class="pr-6px text-[--hula-gray-500,#909090]">
                  {{ t('home.profile_edit.form.nickname.label') }}
                </span>
              </template>
            </n-input>
          </template>
          <span>
            {{ t('home.profile_edit.form.nickname.remaining', { count: editInfo.content.modifyNameChance || 0 }) }}
          </span>
        </n-popover>
      </n-flex>
      <n-flex class="p-12px" align="center" justify="center">
        <n-button
          class="save-button"
          :disabled="editInfo.content.name === localUserInfo.name || !backendConnected"
          :color="'#13987f'"
          @click="saveEditInfo(localUserInfo as ModifyUserInfoType)">
          {{ t('home.profile_edit.actions.save') }}
        </n-button>
      </n-flex>
    </div>
  </n-modal>
  <!-- 添加裁剪组件 -->
  <input
    ref="fileInput"
    type="file"
    accept="image/jpeg,image/png,image/webp"
    class="hidden"
    @change="handleFileChange" />
  <AvatarCropper ref="cropperRef" v-model:show="showCropper" :image-url="localImageUrl" @crop="handleCrop" />
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { useI18n } from 'vue-i18n'
import AvatarCropper from '@/components/common/AvatarCropper.vue'
import { IsYesEnum, MittEnum } from '@/enums'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import { useCommon } from '@/hooks/useCommon'
import { useMitt } from '@/hooks/useMitt'
import { useTauriListener } from '@/hooks/useTauriListener'
import { leftHook } from '@/layout/left/hook'
import type { ModifyUserInfoType } from '@/services/types'
import { useLoginHistoriesStore } from '@/stores/loginHistory'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { userProfileService } from '@/services/userProfileService'
import { isMac, isWindows } from '@/utils/PlatformConstants'

import { msg } from '@/utils/SafeUI'
import { useDevConnectivity } from '@/hooks/useDevConnectivity'

// WebWindowLike interface for cross-platform compatibility
interface WebWindowLike {
  label: string
  listen?: (_event: string, _handler: (...args: unknown[]) => void) => UnlistenFn | Promise<UnlistenFn>
}

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
const appWindow = isTauri
  ? WebviewWindow.getCurrent()
  : ({ label: 'web', listen: async () => () => {} } as WebWindowLike)
const { t } = useI18n()
const localUserInfo = ref<Partial<ModifyUserInfoType>>({})
const userStore = useUserStore()
const { addListener } = useTauriListener()
const loginHistoriesStore = useLoginHistoriesStore()
const { editInfo, updateCurrentUserCache, saveEditInfo } = leftHook()
const { countGraphemes } = useCommon()
const { backendConnected } = useDevConnectivity()
// 使用自定义hook处理头像上传
const {
  fileInput,
  localImageUrl,
  showCropper,
  cropperRef,
  openAvatarCropper,
  handleFileChange,
  handleCrop: onCrop
} = useAvatarUpload({
  onSuccess: async (mxcUrl) => {
    // 使用 Matrix SDK 设置头像 URL
    await userProfileService.setAvatarUrl(mxcUrl)
    // 更新编辑信息
    editInfo.value.content.avatar = mxcUrl
    // 更新用户信息
    userStore.userInfo!.avatar = mxcUrl
    // 更新头像更新时间
    userStore.userInfo!.avatarUpdateTime = Date.now()
    // 更新登录历史记录
    const historyItem = loginHistoriesStore.loginHistories.find((item) => item.uid === userStore.userInfo!.uid)
    if (historyItem) {
      historyItem.avatar = mxcUrl
    }
    // 更新缓存里面的用户信息
    updateCurrentUserCache('avatar', mxcUrl)
    msg.success(t('home.profile_edit.toast.avatar_update_success'))
  }
})

// 处理裁剪，调用hook中的方法
const handleCrop = async (cropBlob: Blob) => {
  await onCrop(cropBlob)
}

/** 不允许输入空格 */
const noSideSpace = (value: string) => !value.startsWith(' ') && !value.endsWith(' ')

const openEditInfo = () => {
  editInfo.value.show = true
  editInfo.value.content = userStore.userInfo!
  localUserInfo.value = { ...userStore.userInfo! }
}

onMounted(async () => {
  if (isTauri && appWindow.listen) {
    await addListener(
      Promise.resolve(
        appWindow.listen('open_edit_info', async () => {
          openEditInfo()
        })
      ),
      'open_edit_info'
    )
  }
  useMitt.on(MittEnum.OPEN_EDIT_INFO, () => {
    useMitt.emit(MittEnum.CLOSE_INFO_SHOW)
    openEditInfo()
  })
})
</script>
<style scoped lang="scss">
.mac-close:hover {
  svg {
    display: block;
  }
}

.save-button {
  color: #fff;
}

.avatar-wrapper {
  cursor: pointer;

  .avatar-hover {
    opacity: 0;
    transition: opacity 0.4s ease-in-out;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    top: 0;
    left: 0;
  }

  &:hover .avatar-hover {
    opacity: 1;
  }
}
</style>
