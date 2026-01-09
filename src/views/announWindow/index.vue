<template>
  <main v-cloak class="size-full bg-[--right-bg-color] select-none cursor-default">
    <ActionBar :shrink="false" :max-w="false" />
    <!-- 编辑公告视图 -->
    <n-flex v-if="viewType === '0' && isAdmin" vertical class="size-full flex-center">
      <div class="text-(14px [--chat-text-color]) flex-start-center w-95% h-40px">{{ title }}</div>
      <div class="w-95%">
        <n-input
          class="max-h-480px border-(1px solid var(--hula-brand-primary)80) rounded-6px bg-[--center-bg-color]"
          v-model:value="announContent"
          type="textarea"
          :placeholder="t('announcement.form.placeholder')"
          :autosize="announcementAutosize"
          maxlength="600"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          show-count
          autofocus />
      </div>
      <n-flex justify="space-between" class="w-95%">
        <div class="w-40% h-42px flex-start-center">
          <!--是否置顶-->
          <n-switch
            class="bg-[--button-bg]"
            size="small"
            v-model:value="isTop"
            :true-value="true"
            :false-value="false" />
          <span class="text-(14px [--text-color]) ml-10px">{{ t('announcement.form.pinned') }}</span>
        </div>
        <div class="w-45% h-42px flex-end-center">
          <n-button quaternary size="small" class="bg-[--button-bg]" @click="handleCancel">
            {{ t('announcement.form.actions.cancel') }}
          </n-button>
          <n-button
            secondary
            type="primary"
            size="small"
            class="bg-[--button-bg] ml-5px"
            @click="handlePushAnnouncement">
            {{ t('announcement.form.actions.publish') }}
          </n-button>
        </div>
      </n-flex>
    </n-flex>
    <!-- 查看公告列表视图 -->
    <n-flex v-else vertical :size="6" class="size-full flex-center">
      <div class="text-(14px [--chat-text-color]) flex-between-center w-95% pt-10px">
        <span>{{ title }}</span>
        <n-button v-if="isAdmin" size="small" secondary @click="handleNew">
          {{ t('announcement.form.actions.new') }}
        </n-button>
      </div>
      <!--暂无数据-->
      <div v-if="!announList || announList.length === 0" class="flex-center">
        <n-empty
          class="empty-state"
          :description="t('announcement.list.empty')">
          <template #icon>
            <n-icon>
              <svg>
                <use href="#explosion"></use>
              </svg>
            </n-icon>
          </template>
        </n-empty>
      </div>
      <n-scrollbar @scroll="handleScroll" v-else class="h-95%">
        <!-- 展示公告列表 -->
        <div class="w-full flex-col-x-center">
          <div
            v-for="announcement in announList"
            :key="announcement.id"
            class="w-91% h-auto bg-[--group-notice-list-bg] flex-start-center flex-col p-[0px_8px_12px_8px] border-[1px --group-notice-list-bg] mt-10px rounded-6px">
            <div class="w-full h-40px flex-start-center">
              <div class="size-full flex-between-center">
                <n-flex align="center" :size="16" class="pl-4px pt-4px">
                  <n-flex align="center" :size="6">
                    <n-avatar
                      round
                      :size="28"
                      :src="avatarSrc(announcement.uid)"
                      :color="themes.content === ThemeEnum.DARK ? 'var(--hula-brand-primary)' : '#fff'"
                      :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'" />
                    <n-flex vertical :size="4">
                      <div class="text-(12px [--chat-text-color])">
                        {{ groupStore.getUserInfo(announcement.uid)?.name }}
                      </div>
                      <div class="text-(12px [var(--hula-brand-primary)])">
                        {{ formatTimestamp(announcement?.createTime != null ? Number(announcement.createTime) : 0) }}
                      </div>
                    </n-flex>
                  </n-flex>
                  <div
                    v-if="announcement?.top"
                    class="p-[3px_4px] bg-[var(--hula-brand-primary)] c-#fff rounded-3px text-[10px] flex-center">
                    <span>{{ t('announcement.form.pinned') }}</span>
                  </div>
                </n-flex>
                <n-flex align="center" :size="6">
                  <n-button class="rounded-6px" v-if="isAdmin" @click="handleEdit(announcement)" quaternary size="tiny">
                    <template #icon>
                      <svg class="size-14px">
                        <use href="#edit"></use>
                      </svg>
                    </template>
                  </n-button>
                  <n-popconfirm
                    v-if="isAdmin && announcementStates[announcement.id]"
                    v-model:show="announcementStates[announcement.id]!.showDeleteConfirm">
                    <template #icon>
                      <svg class="size-22px"><use href="#explosion"></use></svg>
                    </template>
                    <template #action>
                      <n-button
                        size="small"
                        tertiary
                        @click.stop="
                          announcementStates[announcement.id] &&
                          (announcementStates[announcement.id]!.showDeleteConfirm = false)
                        ">
                        {{ t('announcement.list.delete.cancel') }}
                      </n-button>
                      <n-button
                        size="small"
                        type="error"
                        :loading="announcementStates[announcement.id]?.deleteLoading"
                        @click="handleDel(announcement)">
                        {{ t('announcement.list.delete.confirm') }}
                      </n-button>
                    </template>
                    <template #trigger>
                      <n-button class="rounded-6px" quaternary size="tiny">
                        <template #icon>
                          <svg class="size-14px">
                            <use href="#delete"></use>
                          </svg>
                        </template>
                      </n-button>
                    </template>
                    {{ t('announcement.list.deleteConfirm') }}
                  </n-popconfirm>
                </n-flex>
              </div>
            </div>
            <div
              class="w-full select-text cursor-auto text-(13px [--text-color]) ws-pre-wrap line-height-tight pt-12px break-words">
              <div
                :class="[
                  'content-wrapper',
                  { 'content-collapsed': !announcement.expanded && needsExpansion(announcement.content) }
                ]">
                <template
                  v-for="(segment, index) in extractLinkSegments(announcement?.content || '')"
                  :key="`segment-${segment.text}-${index}`">
                  <span v-if="segment.isLink" class="announcement-link" @click.stop="openExternalUrl(segment.text)">
                    {{ segment.text }}
                  </span>
                  <template v-else>{{ segment.text }}</template>
                </template>
              </div>
              <div
                v-if="needsExpansion(announcement.content)"
                class="expand-button"
                @click.stop="toggleExpand(announcement)">
                <span>
                  {{ announcement.expanded ? t('announcement.list.collapse') : t('announcement.list.expand') }}
                </span>
                <svg class="size-12px ml-2px" :class="{ 'rotate-180': announcement.expanded }">
                  <use href="#arrow-down"></use>
                </svg>
              </div>
            </div>
          </div>
        </div>
        <!-- 加载更多 -->
        <div v-if="announList.length > 0" class="w-full h-40px flex-center mt-10px">
          <!-- <n-button v-if="!isLast" class="bg-[--button-bg]" @click="handleLoadMore">加载更多</n-button> -->
          <img v-if="isLoading" class="size-16px" src="@/assets/img/loading.svg" alt="" />
          <span v-if="isLast && !isLoading" class="text-[12px] color-[var(--hula-brand-primary)]">
            {{ t('announcement.list.noMore') }}
          </span>
        </div>
        <div class="w-full h-40px"></div>
      </n-scrollbar>
    </n-flex>
  </main>
</template>
<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { emitTo } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import { useRoute } from 'vue-router'
import { ThemeEnum } from '@/enums'
import { useCachedStore } from '@/stores/dataCache'
import { useGroupStore } from '@/stores/group'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatTimestamp } from '@/utils/ComputedTime'
import { extractLinkSegments, openExternalUrl } from '@/hooks/useLinkSegments'
import { msg } from '@/utils/SafeUI'
import { useI18n } from 'vue-i18n'
import { logger, toError } from '@/utils/logger'
import {
  getAnnouncementList,
  pushAnnouncement,
  editAnnouncement,
  deleteAnnouncement
} from '@/services/matrixAnnouncementService'

// Type definition for announcement items
interface AnnouncementItem {
  id: string
  uid: string // For backward compatibility, same as creatorId
  creatorId?: string // New field from Matrix service
  userName?: string
  name?: string
  content: string
  top?: boolean
  expanded?: boolean
  createTime?: string | number
}

// 定义响应式变量
const title = ref('')
const announContent = ref('')
const roomId = ref('')
const $route = useRoute()
const viewType = ref('0')
const announList = ref<AnnouncementItem[]>([])
const isBack = ref(false)
const isTop = ref(false)
const isEdit = ref(false)
const editAnnoouncement = ref<Partial<AnnouncementItem>>({})
const announcementAutosize = { minRows: 20 }
// 分页参数
const pageSize = 10
const pageNum = ref(1)
// 已经到底了
const isLast = ref(false)
const isLoading = ref(false)
const announcementStates = ref<Record<string, { showDeleteConfirm: boolean; deleteLoading: boolean }>>({})
// 引入 group store
const groupStore = useGroupStore()
const cachedStore = useCachedStore()
const userStore = useUserStore()
const settingStore = useSettingStore()
const { t } = useI18n()
const themes = computed(() => settingStore.themes)
const isAdmin = computed(() => {
  const LordId = groupStore.currentLordId
  const adminUserTds = groupStore.adminUidList
  const uid = useUserStore().userInfo?.uid
  // 由于 uid 可能为 undefined，需要进行类型检查，确保其为 string 类型
  if (uid && (uid === LordId || adminUserTds.includes(uid))) {
    return true
  }
  return false
})
watch(
  () => viewType.value,
  (newVal: string) => {
    if (newVal === '0') {
      title.value = t('announcement.title.create')
    }
  }
)
const avatarSrc = (uid: string) => AvatarUtils.getAvatarUrl(groupStore.getUserInfo(uid)!.avatar as string)
// 初始化函数，获取群公告列表
const handleInit = async () => {
  if (roomId.value) {
    try {
      pageNum.value = 1
      isLast.value = false
      // Use new Matrix announcement service
      const data = await getAnnouncementList(roomId.value)
      if (data && data.length > 0) {
        // Map Matrix service response to AnnouncementItem format
        announList.value = data.map((item) => ({
          ...item,
          // Map creatorId to uid for backward compatibility
          uid: item.creatorId || ''
        })) as AnnouncementItem[]

        if (announList.value.length === 0) {
          viewType.value = '0'
          return
        }
        // 处理公告的userName getUserGroupNickname
        announList.value.forEach((item: AnnouncementItem) => {
          const user = groupStore.getUser(roomId.value, item.uid)
          const fallbackName = item.userName || item?.name || ''
          item.userName = user?.myName || user?.name || fallbackName
          // 添加展开/收起状态控制
          item.expanded = false
          announcementStates.value[item?.id] = {
            showDeleteConfirm: false,
            deleteLoading: false
          }
        })
        // 处理置顶公告，置顶的公告排在列表前面 (already sorted by service, but sort again for safety)
        announList.value.sort((a: AnnouncementItem, b: AnnouncementItem) => {
          if (a.top && !b.top) return -1
          if (!a.top && b.top) return 1
          return 0
        })
        pageNum.value++
        // Since Matrix service returns all announcements, we're on the last page
        isLast.value = true
      } else {
        announList.value = []
        viewType.value = '0'
      }
    } catch (error) {
      logger.error('获取群公告列表失败:', toError(error))
    }
  }
}
/**
 * 处理滚动事件
 * @param event 滚动事件
 */
const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  const isBottom = target.scrollHeight - target.scrollTop === target.clientHeight
  if (isBottom && !isLast.value) {
    handleLoadMore()
  }
}
// 加载更多公告 (No-op for Matrix service - all announcements loaded at once)
const handleLoadMore = async () => {
  // Matrix service returns all announcements at once, no pagination needed
  isLast.value = true
}
// 切换到编辑公告视图
const handleNew = () => {
  announContent.value = ''
  viewType.value = '0'
  isBack.value = true
  isEdit.value = false
  title.value = t('announcement.title.create')
}
// 处理取消操作
const handleCancel = () => {
  announContent.value = ''
  if (isBack.value) {
    viewType.value = '1'
    isBack.value = false
    title.value = t('announcement.title.view')
    return
  }
  getCurrentWebviewWindow().close()
}
// 删除公告
const handleDel = async (announcement: AnnouncementItem) => {
  try {
    const st = (announcementStates.value[announcement.id] ||= { showDeleteConfirm: false, deleteLoading: false })
    st.deleteLoading = true
    // Use new Matrix announcement service
    await deleteAnnouncement({
      roomId: roomId.value,
      announcementId: announcement.id
    })
    // 重置该公告的确认框状态
    const st2 = (announcementStates.value[announcement.id] ||= { showDeleteConfirm: false, deleteLoading: false })
    st2.showDeleteConfirm = false
    st2.deleteLoading = false
    st2.deleteLoading = false
    // 重新获取公告列表
    await handleInit()
    // 找出新的置顶公告
    let newTopAnnouncement: AnnouncementItem | null = null
    if (announList.value.length > 0) {
      newTopAnnouncement = announList.value.find((item: AnnouncementItem) => item.top) || null
    }
    // 发送刷新消息通知其他组件
    if (announList.value.length === 0) {
      // 如果没有公告了，发送清空事件
      await emitTo('home', 'announcementClear')
    }
    // 无论如何都要发送更新事件，携带最新状态
    await emitTo('home', 'announcementUpdated', {
      hasAnnouncements: announList.value.length > 0,
      topAnnouncement: newTopAnnouncement
    })
  } catch (error) {
    logger.error('删除公告失败:', toError(error))
    const st3 = (announcementStates.value[announcement.id] ||= { showDeleteConfirm: false, deleteLoading: false })
    st3.deleteLoading = false
  }
}
// 编辑公告
const handleEdit = (announcement: AnnouncementItem) => {
  isEdit.value = true
  editAnnoouncement.value = announcement
  announContent.value = announcement.content
  isTop.value = announcement.top || false
  viewType.value = '0'
  isBack.value = true
  title.value = t('announcement.title.edit')
}
// 验证公告内容
const validateAnnouncement = (content: string) => {
  if (content.length < 1) {
    msg.error(t('announcement.toast.contentRequired'))
    return false
  }
  if (content.length > 600) {
    msg.error(t('announcement.toast.contentTooLong'))
    return false
  }
  return true
}
// 发布公告
const handlePushAnnouncement = async () => {
  if (!validateAnnouncement(announContent.value)) {
    return
  }
  // Use new Matrix announcement service
  const apiCall = isEdit.value
    ? () =>
        editAnnouncement({
          id: editAnnoouncement.value.id!,
          roomId: roomId.value,
          content: announContent.value,
          top: isTop.value
        })
    : () =>
        pushAnnouncement({
          roomId: roomId.value,
          content: announContent.value,
          top: isTop.value
        })
  const successMessage = isEdit.value ? t('announcement.toast.editSuccess') : t('announcement.toast.createSuccess')
  const errorMessage = isEdit.value ? t('announcement.toast.editFail') : t('announcement.toast.createFail')
  try {
    await apiCall()
    msg.success(successMessage)
    // 重新获取公告列表
    await handleInit()
    // 找出新的置顶公告
    let newTopAnnouncement: AnnouncementItem | null = null
    if (announList.value.length > 0) {
      newTopAnnouncement = announList.value.find((item: AnnouncementItem) => item.top) || null
    }
    info(`发送更新事件通知home: `)
    // 发送更新事件通知其他组件
    await emitTo('home', 'announcementUpdated', {
      hasAnnouncements: announList.value.length > 0,
      topAnnouncement: newTopAnnouncement
    })
    if (!isEdit.value) {
      setTimeout(() => {
        getCurrentWebviewWindow().close()
      }, 1000)
    } else {
      viewType.value = '1'
      isBack.value = false
    }
  } catch (error) {
    logger.error(errorMessage, toError(error))
    msg.error(errorMessage)
  }
}
// 控制内容展开/收起
const needsExpansion = (content: string) => {
  return content && content.length > 80 // 根据实际情况调整，大约200px的文本量
}
// 切换展开/收起状态
const toggleExpand = (announcement: AnnouncementItem) => {
  announcement.expanded = !announcement.expanded
}
// 组件挂载时执行初始化操作
onMounted(async () => {
  try {
    await nextTick()
    roomId.value = $route.params.roomId as string
    viewType.value = $route.params.type as string
    await handleInit()
    setTimeout(async () => {
      const currentWindow = getCurrentWebviewWindow()
      await currentWindow.show()
      await currentWindow.setFocus()
      title.value = await currentWindow.title()
    }, 200)
  } catch (error) {
    logger.error('组件挂载初始化失败:', toError(error))
  }
})
</script>
<style scoped lang="scss">
.empty-state {
  height: calc(100vh / var(--page-scale, 1) - 100px);
}

[v-cloak] {
  display: none;
}
.content-wrapper {
  position: relative;
  overflow: hidden;
  transition: max-height 0.3s ease;
}
.content-collapsed {
  max-height: 100px; // 设置为约200px的显示高度
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1) 60%, rgba(0, 0, 0, 0));
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1) 60%, rgba(0, 0, 0, 0));
}
.expand-button {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 4px;
  color: var(--hula-brand-primary);
  cursor: pointer;
  font-size: 12px;
  svg {
    transition: transform 0.3s ease;
  }
}
.announcement-link {
  color: var(--hula-brand-primary);
  cursor: pointer;
  word-break: break-all;
  line-height: 2.1rem;
  &:hover {
    opacity: 0.8;
    text-decoration: underline;
  }
}
</style>
