<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        class="bg-white header-border"
        :hidden-right="true"
        :room-name="isEditMode ? '编辑群公告' : '新增群公告'" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full relative">
        <img :src="bgImage" class="w-100% absolute top-0 -z-1" alt="hula" />
        <div class="flex flex-col flex-1 gap-20px py-15px px-20px">
          <!-- 公告内容编辑区域 -->
          <div class="bg-white rounded-15px p-15px shadow">
            <n-form label-placement="top" size="medium">
              <n-form-item label="公告内容" required>
                <n-input
                  v-model:value="announcementContent"
                  type="textarea"
                  placeholder="请输入公告内容..."
                  class="w-full"
                  :autosize="announcementAutosize"
                  :maxlength="1000"
                  :show-count="true" />
              </n-form-item>

              <n-form-item label="上传图片（暂不支持）">
                <div class="upload-image-container">
                  <n-upload
                    action="https://www.mocky.io/v2/5e4bafc63100007100d8b70f"
                    list-type="image-card"
                    :max="4"
                    disabled>
                    <div class="upload-trigger">
                      <svg class="size-24px text-var(--hula-gray-400)">
                        <use href="#plus"></use>
                      </svg>
                      <span class="text-12px text-var(--hula-gray-400) mt-5px">点击上传</span>
                    </div>
                  </n-upload>
                </div>
              </n-form-item>
            </n-form>
          </div>

          <!-- 置顶设置区域 -->
          <div class="bg-white rounded-15px shadow">
            <div class="flex flex-col w-full">
              <div class="flex justify-between py-15px px-15px items-center border-b border-gray-200">
                <div class="flex flex-col">
                  <div class="text-14px font-medium">设为置顶</div>
                  <div class="text-12px text-gray-500 mt-5px">公告将显示在群公告列表顶部</div>
                </div>
                <n-switch v-model:value="top" />
              </div>
            </div>
          </div>

          <div class="mobile-action-footer">
            <n-button tertiary class="mobile-primary-btn" @click="handleCancel">取消</n-button>
            <n-button type="primary" class="mobile-primary-btn" @click="handleSubmit" :loading="submitting">
              保存
            </n-button>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { logger } from '@/utils/logger'
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGlobalStore } from '@/stores/global'
import { getAnnouncementDetail, editAnnouncement, pushAnnouncement } from '@/services/matrixAnnouncementService'
import bgImage from '@/assets/mobile/chat-home/background.webp'

import { msg } from '@/utils/SafeUI'
defineOptions({
  name: 'mobileChatNoticeEdit'
})

const route = useRoute()
const router = useRouter()
const globalStore = useGlobalStore()
const announcementAutosize = { minRows: 5, maxRows: 10 }

// 判断是编辑模式还是新增模式
const isEditMode = computed(() => !!route.params.id)

// 公告内容
const announcementContent = ref('')
const top = ref(false)
const submitting = ref(false)

// 加载公告详情
const loadAnnouncementDetail = async () => {
  // 如果是新增模式，不需要加载详情
  if (!isEditMode.value) {
    return
  }

  try {
    const data = (await getAnnouncementDetail({
      roomId: globalStore.currentSessionRoomId,
      announcementId: route.params.id as string
    })) as { content: string; top?: boolean }

    // 填充表单数据
    announcementContent.value = data.content
    top.value = data.top || false
    logger.debug('announcementContent', { value: announcementContent.value, component: 'NoticeEdit' })
  } catch (error) {
    logger.error('加载公告详情失败:', error)
  }
}

// 处理取消
const handleCancel = () => {
  router.back()
}

// 处理提交
const handleSubmit = async () => {
  // 简单验证
  if (!announcementContent.value.trim()) {
    msg.error('请输入公告内容')
    return
  }

  submitting.value = true

  try {
    if (isEditMode.value) {
      // 编辑模式
      const announcementData = {
        id: route.params.id as string,
        roomId: (route.query.roomId as string) || globalStore.currentSessionRoomId,
        content: announcementContent.value,
        top: top.value
      }

      await editAnnouncement(announcementData)
      msg.success('公告修改成功')
      router.push({
        path: `/mobile/chatRoom/notice/detail/${announcementData.id}`
      })
    } else {
      // 新增模式
      const announcementData = {
        roomId: (route.query.roomId as string) || globalStore.currentSessionRoomId,
        content: announcementContent.value,
        top: top.value
      }

      await pushAnnouncement(announcementData)
      msg.success('公告发布成功')
      router.back()
    }
  } catch (error) {
    logger.error('保存公告失败:', error)
    msg.error('保存公告失败，请重试')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadAnnouncementDetail()
})
</script>

<style scoped>
.header-border {
  border-bottom: 1px solid;
  border-color: var(--hula-gray-200);
}

.upload-image-container {
  width: 100%;
}
.upload-image-container :deep(.n-upload) {
  width: 100%;
}
.upload-image-container :deep(.n-upload-trigger) {
  width: 100px;
  height: 100px;
}
.upload-trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border: 1px dashed var(--hula-gray-300);
  border-radius: 8px;
  background-color: var(--hula-gray-50);
}
.upload-image-container :deep(.n-upload-file-list) {
  display: grid;
  grid-template-columns: repeat(auto-fill, 100px);
  gap: 10px;
}
</style>
