<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar :isOfficial="false" class="bg-white header-border" :hidden-right="true" room-name="设置" />
    </template>

    <template #container>
      <img :src="bgImage" class="w-100% absolute top-0 -z-1" alt="hula" />

      <div class="flex flex-col z-1">
        <div class="flex flex-col p-20px gap-20px">
          <!-- 设置项 -->
          <div
            v-for="item in settings"
            :key="item.key"
            class="flex justify-between items-center bg-white p-12px rounded-lg shadow-sm">
            <div class="text-base">{{ item.label }}</div>
            <div>
              <!-- 根据 type 渲染对应组件 -->
              <n-switch v-if="item.type === 'switch'" v-model:value="item.value" />
              <n-input v-else-if="item.type === 'input'" v-model="item.value" placeholder="请输入" class="w-40" />
              <n-select
                v-else-if="item.type === 'select'"
                v-model="item.value"
                :options="item.options || []"
                placeholder="请选择"
                class="w-40" />
            </div>
          </div>

          <!-- 退出登录按钮 -->
          <div class="mobile-action-footer">
            <n-button tertiary class="mobile-primary-btn" @click="router.back()">取消</n-button>
            <n-button
              type="error"
              class="mobile-primary-btn"
              @click="handleLogout"
              :disabled="isLoggingOut"
              :loading="isLoggingOut">
              退出登录
            </n-button>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { reactive, computed, ref } from 'vue'
import { info } from '@tauri-apps/plugin-log'
import bgImage from '@/assets/mobile/chat-home/background.webp'
import { ThemeEnum } from '@/enums'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'
import { useLogin } from '@/hooks/useLogin'
import router from '@/router'

import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'
const settingStore = useSettingStore()
const userStore = useUserStore()

// 定义设置项
const settings = reactive([
  {
    key: 'notifications',
    label: '消息通知',
    type: 'switch',
    value: computed({
      get: () => true,
      set: () => {
        /* 更新通知设置 */
      }
    })
  },
  {
    key: 'username',
    label: '昵称',
    type: 'input',
    value: computed({
      get: () => userStore.userInfo?.name || '',
      set: () => {}
    })
  },
  {
    key: 'theme',
    label: '界面主题',
    type: 'select',
    value: computed({
      get: () => settingStore.themes.content,
      set: (val) => settingStore.toggleTheme(val)
    }),
    options: [
      { label: '浅色', value: ThemeEnum.LIGHT },
      { label: '深色', value: ThemeEnum.DARK }
    ]
  },
  {
    key: 'language',
    label: '应用语言',
    type: 'select',
    value: computed({
      get: () => 'zh',
      set: () => {}
    }),
    options: [
      { label: '中文', value: 'zh' },
      { label: 'English', value: 'en' },
      { label: '日本語', value: 'ja' }
    ]
  }
])

const { logout, resetLoginState } = useLogin()

// 登出处理状态标志
const isLoggingOut = ref(false)

// 退出登录逻辑
async function handleLogout() {
  // 防止重复点击
  if (isLoggingOut.value) return
  isLoggingOut.value = true

  const confirm = () =>
    new Promise<void>((resolve, reject) => {
      window.$dialog?.warning({
        title: '退出登录',
        content: '确定要退出登录吗？',
        positiveText: '确定',
        negativeText: '取消',
        onPositiveClick: () => resolve(),
        onNegativeClick: () => reject()
      })
    })

  confirm()
    .then(async () => {
      // 无论服务器登出是否成功，都执行本地状态清理
      try {
        // 1. 重置登录状态
        await resetLoginState()
        // 2. 最后调用登出方法(这会创建登录窗口或发送登出事件)
        await logout()

        settingStore.toggleLogin(false, false)
        info('登出账号')
        // 保持托盘菜单状态由全局控制，不在此强制修改

        msg.success('登出成功')
        await router.push('/mobile/login')
      } catch (localError) {
        logger.error('本地登出清理失败：', localError)
        msg.error('本地登出清理失败，请重启应用')
      }
    })
    .catch(() => {
      info('用户点击取消')
    })
    .finally(() => {
      // 无论成功还是失败，都重置标志
      isLoggingOut.value = false
    })
}

// 你可以根据需要导出或操作 settings 数据
</script>

<style lang="scss" scoped>
.header-border {
  border-bottom: 1px solid;
  border-color: var(--hula-gray-200);
}
</style>
