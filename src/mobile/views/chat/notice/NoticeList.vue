<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar :isOfficial="false" class="bg-white header-border" :hidden-right="true" room-name="群公告" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full relative">
        <img :src="bgImage" class="w-100% absolute top-0 -z-1" alt="hula" />
        <div class="flex flex-col flex-1 gap-15px py-15px px-20px">
          <!-- vue-virtual-scroller依赖已移除，使用普通列表替代 -->
          <div v-for="item in announList" :key="item.id" class="flex flex-col gap-15px">
            <!-- 公告内容块 -->
            <div @click="goToNoticeDetail(String(item.id))" class="shadow flex p-15px bg-white rounded-10px">
              <div class="flex flex-col w-full gap-10px">
                <!-- 时间/阅读人数 -->
                <div class="flex items-center justify-between text-14px">
                  <span class="flex gap-5px">
                    <span class="text-#717171">发布人:</span>
                    <span class="text-black">{{ groupStore.getUserInfo(item.uid)?.name }}</span>
                  </span>
                  <span v-if="item.isTop" class="top-badge">置顶</span>
                </div>
                <!-- 公告内容 -->
                <div class="text-14px line-clamp-3 line-height-20px text-#717171 max-h-60px">
                  {{ item.content }}
                </div>

                <div class="flex items-center justify-between text-12px">
                  <span class="flex gap-5px text-#717171">{{ formatTimestamp(item.createTime) }}</span>
                  <span class="text-#13987F">128人已读</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="canAddAnnouncement" class="fixed right-20px bottom-20px z-50">
          <n-button circle type="primary" size="large" @click="goToAddNotice">
            <svg class="w-20px h-20px"><use href="#plus"></use></svg>
          </n-button>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
// vue-virtual-scroller依赖已移除，暂时禁用虚拟滚动功能
// import { RecycleScroller } from 'vue-virtual-scroller'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user'
import { useGlobalStore } from '@/stores/global'
import { useCachedStore } from '@/stores/dataCache'
import { formatTimestamp } from '@/utils/ComputedTime'
import { ref, computed, onMounted, onActivated } from 'vue'
import bgImage from '@/assets/mobile/chat-home/background.webp'
import { logger } from '@/utils/logger'

defineOptions({
  name: 'mobileChatNoticeList'
})

const route = useRoute()
const router = useRouter()

// Type definition for announcement items
interface AnnouncementItem {
  id: string | number
  uid: string
  content: string
  createTime: number
  isTop?: boolean
  top?: boolean
  [key: string]: unknown
}

const announList = ref<AnnouncementItem[]>([])
const groupStore = useGroupStore()
const userStore = useUserStore()
const globalStore = useGlobalStore()
const cacheStore = useCachedStore()

// 判断当前用户是否有权限添加公告（仅群主和管理员）
const canAddAnnouncement = computed(() => {
  if (!userStore.userInfo?.uid) return false

  const isLord = groupStore.isCurrentLord(userStore.userInfo.uid) ?? false
  const isAdmin = groupStore.isAdmin(userStore.userInfo.uid) ?? false

  return isLord || isAdmin
})

// 加载群公告列表
const loadAnnouncementList = async () => {
  try {
    const roomId = globalStore.currentSessionRoomId
    if (!roomId) {
      logger.error('当前会话没有roomId')
      return
    }

    const data = await cacheStore.getGroupAnnouncementList(roomId, 1, 10)
    if (data) {
      const dataWithRecords = data as { records?: unknown[] }
      if (dataWithRecords.records) {
        announList.value = dataWithRecords.records as AnnouncementItem[]
        // 处理置顶公告
        if (announList.value && announList.value.length > 0) {
          const topAnnouncement = announList.value.find((item: AnnouncementItem) => item.top)
          if (topAnnouncement) {
            announList.value = [topAnnouncement, ...announList.value.filter((item: AnnouncementItem) => !item.top)]
          }
        }
      }
    }
  } catch (error) {
    logger.error('加载群公告失败:', error)
  }
}

const goToNoticeDetail = (id: string) => {
  // 跳转到公告详情页面
  router.push(`/mobile/chatRoom/notice/detail/${id}`)
}

const goToAddNotice = () => {
  // 跳转到新增公告页面
  logger.debug('跳转到新增公告页面', undefined, 'NoticeList')
  router.push('/mobile/chatRoom/notice/add')
}

onMounted(() => {
  // 首次加载时从路由参数获取数据
  if (route.query.announList) {
    announList.value = JSON.parse(route.query.announList as string)
  } else {
    // 如果没有路由参数，则从服务器加载
    loadAnnouncementList()
  }
})

// 当页面被激活时（从其他页面返回），重新加载数据
onActivated(() => {
  loadAnnouncementList()
})
</script>

<style scoped>
.header-border {
  border-bottom: 1px solid;
  border-color: var(--hula-gray-200);
}

.top-badge {
  color: var(--hula-brand-primary);
  border: 1px solid;
  border-color: var(--hula-brand-primary);
  border-radius: 15px;
  padding: 5px 7px;
  font-size: 12px;
}
</style>
