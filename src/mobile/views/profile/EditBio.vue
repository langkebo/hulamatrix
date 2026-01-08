<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        class="bg-white header-border"
        :hidden-right="true"
        room-name="编辑简介" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full relative">
        <img :src="bgImage" class="w-100% absolute top-0 -z-1" alt="hula" />
        <div class="flex flex-col flex-1 gap-20px py-15px px-20px">
          <n-form class="bg-white rounded-15px p-10px shadow" label-placement="left" label-width="100px">
            <n-form-item>
              <n-input
                v-model:value="localBio"
                type="textarea"
                placeholder="介绍一下你自己~"
                class="w-full"
                :autosize="bioAutosize"
                :maxlength="300"
                :show-count="true" />
            </n-form-item>
          </n-form>

          <div class="mobile-action-footer">
            <n-button tertiary class="mobile-primary-btn" @click="router.back()">取消</n-button>
            <n-button type="primary" class="mobile-primary-btn" @click="handleSave">保存</n-button>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user.ts'
import bgImage from '@/assets/mobile/chat-home/background.webp'

const userStore = useUserStore()
const bioAutosize = { minRows: 5, maxRows: 20 }

const router = useRouter()
const localBio = ref(userStore.userInfo?.resume || '')

// 保存个人简介
const handleSave = () => {
  userStore.userInfo!.resume = localBio.value

  router.back()
}

onMounted(() => {
  localBio.value = userStore.userInfo?.resume || ''
})
</script>

<style lang="scss" scoped>
@use '@/styles/scss/form-item.scss';

.header-border {
  border-bottom: 1px solid;
  border-color: #dfdfdf;
}
</style>
