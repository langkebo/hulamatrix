<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar :isOfficial="false" class="bg-white header-border" :hidden-right="true" room-name="我的消息" />
    </template>

    <template #container>
      <div class="flex flex-col bg-var(--hula-white) gap-1 overflow-auto h-full">
        <div class="flex flex-col p-[10px_20px_0px_20px] gap-20px">
          <CommunityTab @update="onUpdate" :options="tabOptions" active-tab-name="friend-message">
            <template #friend-message>
              <MobileApplyList :close-header="true" type="friend" />
            </template>

            <template #group-message>
              <MobileApplyList :close-header="true" type="group" />
            </template>
          </CommunityTab>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { logger } from '@/utils/logger'
import { reactive } from 'vue'

const onUpdate = (newTab: string) => {
  logger.debug('已更新：:', { data: newTab, component: 'MyMessages' })
}

const tabOptions = reactive([
  {
    tab: '好友消息',
    name: 'friend-message'
  },
  {
    tab: '群聊消息',
    name: 'group-message'
  }
])
</script>

<style scoped>
.header-border {
  border-bottom: 1px solid;
  border-color: var(--hula-gray-200);
}
</style>
