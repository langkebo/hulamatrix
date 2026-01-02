<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        class="bg-white"
        style="border-bottom: 1px solid; border-color: #dfdfdf"
        :hidden-right="true"
        room-name="编辑生日" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full relative">
        <img :src="bgImage" class="w-100% absolute top-0 -z-1" alt="hula" />
        <div class="flex flex-col flex-1 gap-20px py-15px px-20px">
          <div class="flex justify-center w-full bg-white rounded-10px shadow">
            <n-date-picker panel type="date" />
          </div>

          <div class="flex bg-white rounded-10px w-full h-auto shadow">
            <div class="px-15px flex flex-col w-full">
              <!-- 群号 -->
              <div
                style="border-bottom: 1px solid; border-color: #ebebeb"
                class="flex justify-between py-12px items-center">
                <div class="text-14px">展示生日标签</div>
                <n-switch />
              </div>
            </div>
          </div>

          <div class="flex bg-white rounded-10px w-full h-auto shadow">
            <div class="px-15px flex flex-col w-full">
              <div
                style="border-bottom: 1px solid; border-color: #ebebeb"
                class="flex justify-between py-12px items-center">
                <div class="text-14px">展示年龄</div>
                <n-switch />
              </div>
              <div
                style="border-bottom: 1px solid; border-color: #ebebeb"
                class="flex justify-between py-12px items-center">
                <div class="text-14px">展示星座</div>
                <n-switch />
              </div>
            </div>
          </div>

          <div class="mobile-action-footer">
            <n-button tertiary class="mobile-primary-btn" @click="router.back()">取消</n-button>
            <n-button type="primary" class="mobile-primary-btn">保存</n-button>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import router from '@/router'
import bgImage from '@/assets/mobile/chat-home/background.webp'
</script>

<style lang="scss" scoped></style>
