<template>
  <div class="flex flex-1 flex-col">
    <img :src="bgImage" class="w-100% fixed z-0 top-0" alt="hula" />
    <AutoFixHeightPage :show-footer="false" class="z-1">
      <template #header>
        <HeaderBar
          :isOfficial="false"
          :hidden-right="true"
          :enable-default-background="false"
          :enable-shadow="false"
          room-name="编辑资料" />
      </template>

      <template #container>
        <div class="flex flex-col gap-1 overflow-auto h-full">
          <div class="flex flex-col p-[0px_20px_20px_20px] gap-15px">
            <!-- 头像 -->
            <div class="flex justify-center">
              <div class="rounded-full relative bg-white w-86px h-86px overflow-hidden" @click="openAvatarCropper">
                <n-avatar
                  class="absolute"
                  :size="86"
                  :src="AvatarUtils.getAvatarUrl(localUserInfo.avatar!)"
                  fallback-src="/logo.png"
                  round />
                <div
                  class="absolute h-50% w-full bottom-0 bg-[rgb(50,50,50)] bg-clip-padding backdrop-filter backdrop-blur-sm bg-opacity-15 backdrop-saturate-100 backdrop-contrast-100"></div>
                <div class="absolute bottom-25% text-center w-full text-12px text-white">更换头像</div>
              </div>
              <input
                ref="fileInput"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="hidden"
                @change="handleFileChange" />
              <AvatarCropper
                ref="cropperRef"
                v-model:show="showCropper"
                :image-url="localImageUrl"
                @crop="handleCrop" />
            </div>
            <!-- 个人信息 -->
            <form @submit.prevent="saveEditInfo">
              <div class="shadow rounded-8px p-12px bg-white">
                <!-- 昵称 -->
                <n-form-item label="昵称">
                  <n-input :value="localUserInfo.name ?? ''" disabled placeholder="请输入昵称" />
                </n-form-item>

                <!-- 性别 -->
                <n-form-item label="性别">
                  <n-select :options="pickerColumn.gender || []" :value="localUserInfo.sex ?? null" />
                </n-form-item>

                <!-- 生日 -->
                <n-form-item label="生日">
                  <n-input v-model:value="birthday" readonly placeholder="请选择生日" @click="toEditBirthday" />
                </n-form-item>

                <!-- 地区 -->
                <n-form-item label="地区选择">
                  <n-input v-model:value="region" readonly placeholder="点击选择省市区" />
                </n-form-item>

                <!-- 手机号 -->
                <n-form-item label="手机号">
                  <n-input :value="localUserInfo.phone ?? ''" disabled type="text" placeholder="请输入手机号" />
                </n-form-item>

                <!-- 简介 -->
                <n-form-item label="简介">
                  <n-input
                    :value="localUserInfo.resume ?? ''"
                    type="textarea"
                    placeholder="请输入个人简介"
                    rows="3"
                    @click="toEditBio" />
                </n-form-item>
              </div>

              <div class="flex justify-center mt-20px">
                <n-button type="primary" class="mobile-primary-btn" attr-type="submit">保存</n-button>
              </div>
            </form>
          </div>
        </div>
      </template>
    </AutoFixHeightPage>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
// removed @vant/area-data
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import bgImage from '@/assets/mobile/chat-home/background.webp'
import router from '@/router'
import type { ModifyUserInfoType, UserInfoType } from '@/services/types'
import { useGroupStore } from '@/stores/group'
import { useLoginHistoriesStore } from '@/stores/loginHistory'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { userProfileService } from '@/services/userProfileService'
import { logger } from '@/utils/logger'

import { msg } from '@/utils/SafeUI'
const region = ref('')

const birthday = ref('')

const pickerColumn = ref({
  gender: [
    { text: '男', value: 1 },
    { text: '女', value: 2 }
  ]
})

// pickerState 暂时未使用
// const pickerState = ref({
//   gender: false,
//   region: false,
//   date: false
// })

const {
  fileInput,
  localImageUrl,
  showCropper,
  cropperRef,
  openAvatarCropper,
  handleFileChange,
  handleCrop: onCrop
} = useAvatarUpload({
  onSuccess: async (downloadUrl) => {
    // 更新编辑信息
    localUserInfo.value.avatar = downloadUrl
    // 更新用户信息
    if (userStore.userInfo) {
      userStore.userInfo.avatar = downloadUrl
      // 更新头像更新时间
      userStore.userInfo.avatarUpdateTime = Date.now()
    }
    // 更新登录历史记录
    const userHistory = loginHistoriesStore.loginHistories.find((item) => item.uid === userStore.userInfo?.uid)
    if (userHistory) {
      userHistory.avatar = downloadUrl
    }
    // 更新缓存里面的用户信息
    updateCurrentUserCache('avatar', downloadUrl)
  }
})

// 处理裁剪，调用hook中的方法
const handleCrop = async (cropBlob: Blob) => {
  await onCrop(cropBlob)
}

const groupStore = useGroupStore()
const userStore = useUserStore()
const loginHistoriesStore = useLoginHistoriesStore()
const localUserInfo = ref<Partial<ModifyUserInfoType>>({
  name: '',
  sex: 1,
  phone: '',
  avatar: '',
  resume: '',
  modifyNameChance: 0
} as ModifyUserInfoType)

const toEditBirthday = () => {
  router.push('/mobile/mobileMy/editBirthday')
}

const toEditBio = () => {
  router.push('/mobile/mobileMy/editBio')
}

const updateCurrentUserCache = (key: 'name' | 'avatar', value: string) => {
  const uid = userStore.userInfo?.uid
  if (uid) {
    const currentUser = groupStore.getUserInfo(uid)
    if (currentUser) {
      currentUser[key] = value // 更新缓存里面的用户信息
    }
  }
}

const saveEditInfo = async () => {
  if (!localUserInfo.value.name || localUserInfo.value.name.trim() === '') {
    msg.error('昵称不能为空')
    return
  }
  // if (localUserInfo.value.modifyNameChance === 0) {
  //   msg.error('改名次数不足')
  //   return
  // }

  try {
    // 使用 Matrix SDK 更新用户昵称
    await userProfileService.setDisplayName(localUserInfo.value.name!)

    // 更新本地缓存的用户信息
    if (userStore.userInfo) {
      userStore.userInfo.name = localUserInfo.value.name!
      userStore.userInfo.sex = localUserInfo.value.sex ?? userStore.userInfo.sex
      userStore.userInfo.phone = localUserInfo.value.phone ?? userStore.userInfo.phone
      userStore.userInfo.resume = localUserInfo.value.resume ?? userStore.userInfo.resume
      loginHistoriesStore.updateLoginHistory(userStore.userInfo as UserInfoType) // 更新登录历史记录
      updateCurrentUserCache('name', localUserInfo.value.name!) // 更新缓存里面的用户信息
    }

    if (localUserInfo.value.modifyNameChance) {
      localUserInfo.value.modifyNameChance -= 1
    }
    msg.success('修改成功')
  } catch (error) {
    logger.error('修改用户信息失败:', error)
    msg.error('修改失败，请重试')
  }
}

onMounted(() => {
  if (userStore.userInfo) {
    localUserInfo.value = { ...userStore.userInfo }
  }
})
</script>

<style lang="scss" scoped>
@use '@/styles/scss/form-item.scss';

/* removed vant styles */

.custom-border-b-1 {
  border-bottom: 1px solid;
  border-color: #d9d9d9;
}
</style>
