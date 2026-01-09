<template>
  <div class="size-full bg-[--right-bg-color]">
    <ActionBar :shrink="false" :current-label="WebviewWindow.getCurrent().label" />
    <n-scrollbar
      class="preview-scrollbar w-full box-border bg-[--center-bg-color] rounded-b-8px border-(solid 1px [--line-color])">
      <div class="flex flex-col gap-4 bg-var(--hula-brand-primary)">
        <!-- @vue-office依赖已移除，暂时禁用文档预览功能 -->
        <div v-if="isShowWord || isShowPdf || isShowExcel || isShowPpt" class="flex items-center justify-center h-96">
          <div class="text-center">
            <div class="text-gray-500 mb-4">📄 文档预览功能暂时禁用</div>
            <div class="text-sm text-gray-400">由于依赖优化，{{ getFileTypeText() }}预览功能暂时不可用</div>
            <div class="mt-4">
              <button @click="openFileExternally" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                使用外部应用打开
              </button>
            </div>
          </div>
        </div>

        <div v-else class="text-gray-500 flex items-center justify-center h-96">📄 暂无文档可预览</div>
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, onMounted } from 'vue'
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { logger } from '@/utils/logger'
// @vue-office依赖已移除，暂时禁用文档预览功能
// const VueOfficeDocx = defineAsyncComponent(() => import('@vue-office/docx/lib/v3/vue-office-docx.mjs'))
// const VueOfficeExcel = defineAsyncComponent(() => import('@vue-office/excel/lib/v3/vue-office-excel.mjs'))
// const VueOfficePdf = defineAsyncComponent(() => import('@vue-office/pdf/lib/v3/vue-office-pdf.mjs'))
// const VueOfficePptx = defineAsyncComponent(() => import('@vue-office/pptx/lib/v3/vue-office-pptx.mjs'))
import type { FileTypeResult } from 'file-type'
// import '@vue-office/docx/lib/v3/index.css'
// import '@vue-office/excel/lib/v3/index.css'
import { listen } from '@tauri-apps/api/event'
import { merge } from 'es-toolkit'
import { useTauriListener } from '@/hooks/useTauriListener'
import { useWindow } from '@/hooks/useWindow'
import { getFile } from '@/utils/PathUtil'

// Tauri plugin-opener module interface
interface OpenerModule {
  open?: (path: string) => Promise<void>
  default?: (path: string) => Promise<void>
}

type PayloadData = {
  userId: string
  roomId: string
  messageId: string
  resourceFile: {
    fileName: string
    absolutePath: string | undefined
    nativePath: string | undefined
    url: string
    type: FileTypeResult | undefined
    localExists: boolean
  }
}

const uiData = reactive({
  payload: {
    messageId: '',
    userId: '',
    roomId: '',
    resourceFile: {
      fileName: '',
      absolutePath: '',
      nativePath: '',
      url: '',
      localExists: false,
      type: {
        ext: '',
        mime: ''
      }
    }
  } as PayloadData,

  file: new File([], ''), // 只有在找到本地文件时才用它
  fileBuffer: [] as unknown as ArrayBuffer,
  fileLoading: false
})

//

const fileExt = computed(() => uiData.payload.resourceFile.type?.ext || '')
const localExists = computed(() => uiData.payload.resourceFile.localExists)

const isShowWord = computed(() => {
  const match = ['doc', 'docx', 'cfb'].includes(fileExt.value)
  return match && (localExists.value ? uiData.fileLoading : true)
})

const isShowPdf = computed(() => {
  const match = fileExt.value === 'pdf'
  return match && (localExists.value ? uiData.fileLoading : true)
})

const isShowExcel = computed(() => {
  const match = fileExt.value === 'xlsx'
  return match && (localExists.value ? uiData.fileLoading : true)
})

const isShowPpt = computed(() => {
  const match = fileExt.value === 'pptx'
  return match && (localExists.value ? uiData.fileLoading : true)
})

const updateFile = async (absolutePath: string, exists: boolean) => {
  try {
    if (exists) {
      uiData.fileLoading = false // 初始设为 false，确保状态干净

      // 文件存在本地就更新
      const file = await getFile(absolutePath)
      uiData.file = file.file

      const buffer = await file.file.arrayBuffer()
      uiData.fileBuffer = buffer

      uiData.fileLoading = true // 文件加载完毕，准备好渲染
    } else {
      // 网络文件默认标记为可加载
      uiData.fileLoading = true
    }
  } catch (error) {
    logger.error('读取文件时出错：', error instanceof Error ? error : new Error(String(error)), 'previewFile')
    uiData.fileLoading = false // 读取失败也应标记为 false
  }
}

// 添加缺失的方法
const getFileTypeText = () => {
  const ext = uiData.payload.resourceFile.type?.ext.toLowerCase()
  switch (ext) {
    case 'docx':
    case 'doc':
      return 'Word文档'
    case 'pdf':
      return 'PDF文档'
    case 'xlsx':
    case 'xls':
      return 'Excel表格'
    case 'pptx':
    case 'ppt':
      return 'PowerPoint演示文稿'
    default:
      return '文档'
  }
}

const openFileExternally = async () => {
  const path = uiData.payload.resourceFile.absolutePath || uiData.payload.resourceFile.nativePath
  if (path) {
    try {
      const mod = (await import('@tauri-apps/plugin-opener')) as OpenerModule
      const open = mod.open || mod.default || (() => Promise.resolve())
      await open(path)
    } catch (error) {
      logger.error('打开文件失败:', error instanceof Error ? error : new Error(String(error)), 'previewFile')
      // 备用方案：打开文件所在的目录
      const mod2 = (await import('@tauri-apps/plugin-opener')) as OpenerModule
      const open = mod2.open || mod2.default || (() => Promise.resolve())
      const dir = path.substring(0, path.lastIndexOf('/'))
      await open(dir)
    }
  }
}

const { getWindowPayload } = useWindow()
const { addListener } = useTauriListener()

onMounted(async () => {
  const webviewWindow = getCurrentWebviewWindow()
  const label = webviewWindow.label

  await addListener(
    listen(`${label}:update`, (event: { payload: { payload: PayloadData } }) => {
      const payload: PayloadData = event.payload.payload
      logger.debug('payload更新：', payload, 'index')

      merge(uiData.payload, payload)

      updateFile(payload.resourceFile.absolutePath || '', payload.resourceFile.localExists)
    }),
    'preview-file-update'
  )

  try {
    const payload = await getWindowPayload<PayloadData>(label)
    logger.debug('获取的载荷信息：', payload, 'index')

    merge(uiData.payload, payload)

    updateFile(payload.resourceFile.absolutePath || '', payload.resourceFile.localExists)
  } catch (error) {
    logger.warn('获取错误：', error instanceof Error ? error : new Error(String(error)), 'previewFile')
  }

  await webviewWindow.show()
})
</script>

<style scoped lang="scss">
.preview-scrollbar {
  max-height: calc(100vh);
}
</style>
