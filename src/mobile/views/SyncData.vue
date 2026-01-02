<template>
  <MobileLayout class="bg-gray-100 px-20px" :safeAreaTop="true" :safeAreaBottom="true">
    <HeaderBar
      :isOfficial="false"
      :hidden-right="true"
      :enable-default-background="false"
      :enable-shadow="false"
      room-name="登录确认" />

    <div
      class="flex flex-col rounded-15px bg-white pt-30px py-20px items-center justify-between gap-20px mt-40px h-70%">
      <div class="flex flex-col items-center gap-20px">
        <div class="flex items-center">
          <div class="text-26px">登录</div>
        </div>

        <n-checkbox-group v-model:value="checkedValues" class="flex flex-col gap-14px text-14px">
          <n-checkbox value="syncRecentMessages">同步最近的消息</n-checkbox>
          <n-checkbox value="autoLogin">自动登录该设备</n-checkbox>
        </n-checkbox-group>
      </div>
      <div class="mobile-action-footer">
        <n-button tertiary class="mobile-primary-btn" @click="handleCancelLogin">取消登录</n-button>
        <n-button type="primary" class="mobile-primary-btn" @click="handleConfirmLogin">确定登录</n-button>
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingStore } from '@/stores/setting'
import { logger } from '@/utils/logger'

const router = useRouter()
const settingStore = useSettingStore()

// 使用数组管理选中的复选框
const checkedValues = ref(['syncRecentMessages', ''])

const shouldAutoLogin = computed(() => {
  return checkedValues.value.includes('autoLogin')
})

const handleConfirmLogin = async () => {
  try {
    // 设置自动登录状态
    settingStore.setAutoLogin(shouldAutoLogin.value)

    // 跳转到主页面
    router.push('/mobile/home')
  } catch (error) {
    logger.error('登录确认失败:', error)
  }
}

const handleCancelLogin = () => {
  // 取消登录时不设置自动登录
  settingStore.setAutoLogin(false)
  router.back()
}
</script>

<style lang="scss" scoped></style>
