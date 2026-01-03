<template>
  <div class="h-15rem w-full">
    <div class="h-full">
      <div class="px-15px pt-15px pb-30px grid grid-cols-4 gap-3 auto-rows-18">
        <div
          @click="handleClickIcon(item)"
          v-for="item in options"
          :key="item.label"
          class="flex flex-col gap-8px items-center justify-center rounded-2">
          <svg
            v-if="item.label !== '文件' && item.label !== '图片' && item.isShow()"
            class="h-24px w-24px iconpark-icon">
            <use :href="`#${item.icon}`"></use>
          </svg>

          <button v-if="item.label === '文件' && item.isShow()" @click="triggerFileInput" class="bg-transparent">
            <svg class="h-24px w-24px iconpark-icon">
              <use :href="`#${item.icon}`"></use>
            </svg>
            <svg
              v-if="item.showArrow"
              :class="['h-15px w-15px iconpark-icon transition-transform duration-300', item.isRotate ? 'rotate' : '']">
              <use href="#down" />
            </svg>
          </button>

          <button v-if="item.label === '图片' && item.isShow()" @click="triggerImageInput" class="bg-transparent">
            <svg class="h-24px w-24px iconpark-icon">
              <use :href="`#${item.icon}`"></use>
            </svg>
            <svg
              v-if="item.showArrow"
              :class="['h-15px w-15px iconpark-icon transition-transform duration-300', item.isRotate ? 'rotate' : '']">
              <use href="#down" />
            </svg>
          </button>

          <div class="text-10px" v-if="item.isShow()">
            {{ item.label }}
          </div>
        </div>
      </div>
    </div>
    <input ref="fileInputRef" type="file" multiple accept="*/*" class="hidden" @change="onFileChange" />
    <input ref="imageInputRef" type="file" multiple accept="image/*" class="hidden" @change="onImageChange" />

    <n-modal v-model:show="pickRtcCall" preset="dialog" title="选择通话类型" :show-icon="false">
      <div class="flex flex-col gap-12px">
        <n-button block type="primary" @click="startCall(CallTypeEnum.VIDEO)">视频通话</n-button>
        <n-button block type="primary" @click="startCall(CallTypeEnum.AUDIO)">语音通话</n-button>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { CallTypeEnum, RoomTypeEnum } from '@/enums'
import router from '@/router'
import { useGlobalStore } from '@/stores/global'

const globalStore = useGlobalStore()

const isGroup = computed(() => globalStore.currentSession?.type === RoomTypeEnum.GROUP)

const pickRtcCall = ref(false)

// Define interface for option items
interface OptionItem {
  label: string
  icon: string
  showArrow: boolean
  isRotate: boolean
  onClick: () => void
  isShow: () => boolean
}

// ==== 展开面板 ====
const options = ref<OptionItem[]>([
  { label: '文件', icon: 'file', showArrow: false, isRotate: true, onClick: () => {}, isShow: () => true },
  { label: '图片', icon: 'photo', showArrow: false, isRotate: true, onClick: () => {}, isShow: () => true },
  { label: '视频', icon: 'voice', showArrow: true, isRotate: false, onClick: () => {}, isShow: () => true },
  { label: '历史', icon: 'history', showArrow: true, isRotate: false, onClick: () => {}, isShow: () => true },
  {
    label: '视频通话',
    icon: 'video-one',
    showArrow: true,
    isRotate: false,
    onClick: () => {
      pickRtcCall.value = true
    },
    isShow: () => {
      return !isGroup.value
    }
  }
])

//

const handleClickIcon = (item: OptionItem) => {
  item.onClick()
}

const startCall = (callType: CallTypeEnum) => {
  const currentSession = globalStore.currentSession
  if (!currentSession?.detailId) {
    pickRtcCall.value = false
    return
  }
  router.push({
    path: `/mobile/rtcCall`,
    query: {
      remoteUserId: currentSession.detailId,
      roomId: globalStore.currentSessionRoomId,
      callType: callType
    }
  })
}

const emit = defineEmits<(e: 'sendFiles', files: File[]) => void>()

const selectedFiles = ref<File[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const triggerFileInput = () => fileInputRef.value?.click()
const triggerImageInput = () => imageInputRef.value?.click()

const afterReadFile = (files: File[]) => {
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif']
  for (const rawFile of files) {
    if (imageTypes.includes(rawFile.type)) continue
    selectedFiles.value.push(rawFile)
  }
  if (selectedFiles.value.length > 0) {
    emit('sendFiles', [...selectedFiles.value])
    selectedFiles.value = []
  }
}

const afterReadImage = (files: File[]) => {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif']
  for (const rawFile of files) {
    if (!validTypes.includes(rawFile.type)) continue
    selectedFiles.value.push(rawFile)
  }
  if (selectedFiles.value.length > 0) {
    emit('sendFiles', [...selectedFiles.value])
    selectedFiles.value = []
  }
}

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  afterReadFile(files)
  input.value = ''
}

const onImageChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  afterReadImage(files)
  input.value = ''
}
</script>

<style scoped></style>
