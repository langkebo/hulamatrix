<template>
  <div class="min-w-0 cursor-default select-none flex-1 flex flex-col bg-[--right-bg-color] overflow-hidden">
    <!-- 内容头部 -->
    <div class="flex-shrink-0 px-20px py-16px border-b border-solid border-[--line-color]">
      <div class="flex items-center justify-between gap-32px">
        <n-flex vertical class="flex-shrink-0">
          <h2 class="text-18px font-600 text-[--text-color] m-0">
            {{ getContentTitle() }}
          </h2>
          <p class="text-14px text-[--text-color] opacity-60 m-0 mt-4px">
            {{ getContentSubtitle() }}
          </p>
        </n-flex>

        <!-- 搜索框 -->
        <n-input
          v-model:value="fileSearchKeyword"
          :placeholder="getFileSearchPlaceholder()"
          :input-props="{ spellcheck: false }"
          clearable
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          class="file-search-input rounded-6px border-(solid 1px [--line-color])"
          size="small">
          <template #prefix>
            <svg class="size-16px text-[--text-color] opacity-60">
              <use href="#search"></use>
            </svg>
          </template>
        </n-input>
      </div>
    </div>

    <!-- 文件列表区域 -->
    <div class="relative overflow-hidden flex-1">
      <!-- 文件列表 -->
      <n-scrollbar v-if="displayedTimeGroupedFiles.length > 0">
        <div class="p-20px flex flex-col gap-24px">
          <!-- 时间分组 -->
          <div v-for="timeGroup in displayedTimeGroupedFiles" :key="timeGroup.date" class="flex flex-col gap-12px">
            <div class="time-group">
              <span class="text-14px font-600">{{ timeGroup.displayDate || timeGroup.date }}</span>
              <span class="text-12px">{{ t('fileManager.list.fileCount', { count: timeGroup.files.length }) }}</span>
            </div>
            <!-- 文件列表 -->
            <div class="flex flex-col gap-15px">
              <ContextMenu
                v-for="file in timeGroup.files"
                :key="(file as FileType).id"
                :menu="fileContextMenu"
                :content="file as Record<string, unknown>"
                class="flex flex-col gap-8px"
                @select="handleFileMenuSelect($event, file as FileType)">
                <File :body="convertToFileBody(file)" :search-keyword="fileSearchKeyword" />
                <!-- 文件元信息 -->
                <div class="file-meta-info">
                  <div class="flex-center gap-4px">
                    <p>{{ t('fileManager.list.meta.from') }}</p>
                    <p class="file-sender">{{ getUserDisplayName(String((file as FileType).sender?.id || '')) }}</p>
                  </div>
                  <p class="opacity-80">{{ (file as FileType).uploadTime }}</p>
                </div>
              </ContextMenu>
            </div>
          </div>
        </div>
      </n-scrollbar>

      <!-- 空状态 -->
      <EmptyState v-else :icon="getEmptyStateIcon()" :title="getEmptyStateTitle()">
        <template #actions>
          <n-button v-if="hasActiveSearch" @click="clearSearch" secondary type="primary" size="small">
            {{ t('fileManager.search.clear') }}
          </n-button>

          <n-button v-if="selectedUser" @click="clearUserFilter" ghost :color="'#13987f'" size="small">
            {{ t('fileManager.search.showAllUsers') }}
          </n-button>
        </template>
      </EmptyState>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, type Ref } from 'vue'
import { sumBy } from 'es-toolkit'
import { useI18n } from 'vue-i18n'
import ContextMenu from '@/components/common/ContextMenu.vue'
import { fileService } from '@/services/file-service'
import { writeFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import type { FileBody } from '@/services/types'
import { useGroupStore } from '@/stores/group'
import { saveFileAttachmentAs, saveVideoAttachmentAs } from '@/utils/AttachmentSaver'
import type { SaveAttachmentOptions } from '@/utils/AttachmentSaver'
import EmptyState from './EmptyState.vue'
import { logger } from '@/utils/logger'

type TimeGroup = {
  date: string
  displayDate: string
  files: unknown[]
}

type User = {
  id: string
  name: string
}

type FileManagerState = {
  timeGroupedFiles: Ref<TimeGroup[]>
  loading: Ref<boolean>
  searchKeyword: Ref<string>
  activeNavigation: Ref<string>
  selectedUser: Ref<string>
  userList: Ref<User[]>
  setSearchKeyword: (keyword: string) => void
  setSelectedUser: (userId: string) => void
}

const groupStore = useGroupStore()
const { t } = useI18n()
const fileManagerState = inject<FileManagerState>('fileManagerState')!
const { timeGroupedFiles, searchKeyword, activeNavigation, selectedUser, userList, setSearchKeyword, setSelectedUser } =
  fileManagerState

const fileSearchKeyword = computed({
  get: () => searchKeyword.value,
  set: (value: string) => {
    if (value === searchKeyword.value) {
      return
    }
    setSearchKeyword(value)
  }
})

const normalizedFileSearchKeyword = computed(() => fileSearchKeyword.value.trim().toLowerCase())
const hasActiveSearch = computed(() => normalizedFileSearchKeyword.value.length > 0)

// 检查文件是否匹配搜索关键词
interface FileItem {
  fileName?: string
  name?: string
  originalName?: string
  title?: string
  sender?: { name?: string }
  fileType?: string
  downloadUrl?: string
  url?: string
  [key: string]: unknown
}

const matchesFileByKeyword = (file: FileItem, keyword: string) => {
  if (!keyword) {
    return true
  }

  const candidates = [
    file.fileName,
    file.name,
    file.originalName,
    file.title,
    file.sender?.name,
    file.fileType,
    file.downloadUrl,
    file.url
  ]

  return candidates.some((candidate) => {
    if (candidate == null) {
      return false
    }
    return String(candidate).toLowerCase().includes(keyword)
  })
}

// 过滤显示的时间分组文件
const displayedTimeGroupedFiles = computed(() => {
  const keyword = normalizedFileSearchKeyword.value
  if (!keyword) {
    return timeGroupedFiles.value
  }

  return timeGroupedFiles.value
    .map((group) => {
      const matchedFiles = (group.files as FileItem[]).filter((file) => matchesFileByKeyword(file, keyword) === true)
      if (matchedFiles.length === 0) {
        return null
      }

      const filteredGroup: TimeGroup = {
        ...group,
        files: matchedFiles
      }

      return filteredGroup
    })
    .filter((group): group is TimeGroup => group !== null)
})

// 计算过滤后的文件总数
const totalDisplayedFiles = computed(() => sumBy(displayedTimeGroupedFiles.value, (group) => group.files.length))

const downloadFile = async (url: string, savePath: string, baseDir: BaseDirectory = BaseDirectory.AppData) => {
  const res = await fileService.downloadWithResume(url)
  const blob = res.blob as Blob
  const buffer = await blob.arrayBuffer()
  const data = new Uint8Array(buffer)
  await writeFile(savePath, data, { baseDir })
}

// Local MenuItem interface for ContextMenu
interface MenuItem {
  visible?: (content?: Record<string, unknown>) => boolean
  click?: (content?: Record<string, unknown>) => void | Promise<void>
  children?: MenuItem[] | ((content?: Record<string, unknown>) => MenuItem[])
  icon?: string | ((content?: Record<string, unknown>) => string)
  label?: string | ((content?: Record<string, unknown>) => string)
  disabled?: boolean
  [key: string]: unknown
}

const fileContextMenu = computed((): MenuItem[] => [
  {
    label: t('menu.save_as'),
    icon: 'Importing',
    click: async (content?: Record<string, unknown>) => {
      const targetFile = content as FileType
      const downloadUrl = targetFile.downloadUrl || targetFile.url
      const defaultName = targetFile.fileName ? String(targetFile.fileName) : undefined
      const isVideo = targetFile.fileType === 'video'
      const saveParams: SaveAttachmentOptions = {
        downloadFile
      }

      // 只有在有 downloadUrl 时才添加 url 属性
      if (downloadUrl) {
        saveParams.url = downloadUrl
      }

      if (defaultName) {
        saveParams.defaultFileName = defaultName
      }

      saveParams.successMessage = isVideo
        ? t('fileManager.notifications.saveVideoSuccess')
        : t('fileManager.notifications.saveFileSuccess')
      saveParams.errorMessage = isVideo
        ? t('fileManager.notifications.saveVideoFail')
        : t('fileManager.notifications.saveFileFail')
      try {
        if (isVideo) {
          await saveVideoAttachmentAs(saveParams)
        } else {
          await saveFileAttachmentAs(saveParams)
        }
      } catch (error) {
        logger.error('文件另存为失败:', error)
      }
    }
  }
])

const handleFileMenuSelect = async (menuItem: MenuItem, file: FileType) => {
  if (!menuItem || typeof menuItem.click !== 'function') {
    return
  }

  try {
    await menuItem.click(file as Record<string, unknown>)
  } catch (error) {
    logger.error('执行文件菜单操作失败:', error)
  }
}

// 根据 uid 获取用户显示名称
const getUserDisplayName = (uid: string) => {
  const groupName = groupStore.getUserDisplayName(uid)
  if (groupName) {
    return groupName
  }
  return t('fileManager.common.unknownUser')
}

// 获取文件搜索占位符
const getFileSearchPlaceholder = () => {
  switch (activeNavigation.value) {
    case 'myFiles':
      return t('fileManager.search.placeholder.myFiles')
    case 'senders':
      return t('fileManager.search.placeholder.senders')
    case 'sessions':
      return t('fileManager.search.placeholder.sessions')
    case 'groups':
      return t('fileManager.search.placeholder.groups')
    default:
      return t('fileManager.search.placeholder.default')
  }
}

// 获取内容标题
const getContentTitle = () => {
  const navigationTitles: { [key: string]: string } = {
    myFiles: t('fileManager.header.titles.myFiles'),
    senders: t('fileManager.header.titles.senders'),
    sessions: t('fileManager.header.titles.sessions'),
    groups: t('fileManager.header.titles.groups')
  }

  return navigationTitles[activeNavigation.value] || t('fileManager.header.titles.default')
}

// 获取内容副标题
const getContentSubtitle = () => {
  const totalFiles = totalDisplayedFiles.value

  if (selectedUser.value) {
    const user = userList.value.find((u: User) => u.id === selectedUser.value)
    if (user) {
      return t('fileManager.header.subtitle.userFiles', { name: user.name, total: totalFiles })
    }
  }

  const keyword = fileSearchKeyword.value.trim()
  if (keyword) {
    return t('fileManager.header.subtitle.search', { total: totalFiles })
  }

  return t('fileManager.header.subtitle.total', { total: totalFiles })
}

const getEmptyStateIcon = () => {
  if (hasActiveSearch.value) {
    return 'search'
  }

  const navigationIcons: { [key: string]: string } = {
    myFiles: 'folder',
    senders: 'user',
    sessions: 'message',
    groups: 'group'
  }

  return navigationIcons[activeNavigation.value] || 'folder'
}

const getEmptyStateTitle = () => {
  if (hasActiveSearch.value) {
    return t('fileManager.empty.search')
  }

  if (selectedUser.value) {
    const user = userList.value.find((u: User) => u.id === selectedUser.value)
    return user ? t('fileManager.empty.userHasNoFiles', { name: user.name }) : t('fileManager.empty.default')
  }

  const navigationTitles: { [key: string]: string } = {
    myFiles: t('fileManager.empty.default'),
    senders: t('fileManager.empty.senders'),
    sessions: t('fileManager.empty.sessions'),
    groups: t('fileManager.empty.groups')
  }

  return navigationTitles[activeNavigation.value] || t('fileManager.empty.default')
}

// 清除搜索
const clearSearch = () => {
  setSearchKeyword('')
}

// 清除用户筛选
const clearUserFilter = () => {
  setSelectedUser('')
}

// 定义文件类型
interface FileType {
  id: string | number
  fileName?: string
  fileSize?: number
  url?: string
  downloadUrl?: string
  sender?: {
    id: string | number
    name?: string
  }
  uploadTime?: string
  [key: string]: unknown
}

// 转换文件数据为 FileBody 格式
const convertToFileBody = (file: unknown): FileBody => {
  const f = file as FileType
  return {
    fileName: f.fileName || '',
    size: f.fileSize || 0,
    url: f.url || f.downloadUrl || ''
  }
}
</script>

<style scoped lang="scss">
.file-search-input {
  width: 200px;
}

.time-group {
  @apply sticky top-10px z-10 flex items-center justify-between p-12px rounded-6px text-[--text-color] bg-#e3e3e380 dark:bg-#30303080 backdrop-blur-md;
}

.file-meta-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 4px;
  font-size: 12px;
  color: #909090;
}

.file-sender {
  color: #13987f;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}
</style>
