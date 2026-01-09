<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar :isOfficial="false" class="header-bar" :hidden-right="true" :room-name="title + '设置'" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full relative">
        <img :src="bgImage" class="w-100% absolute top-0 -z-1" alt="hula" />
        <div class="flex flex-col gap-15px py-15px px-20px flex-1 min-h-0">
          <div class="flex shadow py-10px bg-white rounded-10px w-full items-center gap-10px" @click="clickInfo">
            <!-- 群头像 -->
            <div class="flex justify-center">
              <div class="rounded-full relative bg-white w-38px h-38px overflow-hidden avatar-container">
                <n-avatar
                  class="absolute"
                  :size="38"
                  :src="AvatarUtils.getAvatarUrl(currentSession?.avatar || '')"
                  fallback-src="/logo.png"
                  :style="{
                    'object-fit': 'cover',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)'
                  }"
                  round />
              </div>
              <input
                v-if="isGroup"
                ref="fileInput"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="hidden"
                @change="handleFileChange" />
              <AvatarCropper
                ref="cropperRef"
                v-model:show="showCropper"
                :image-url="localImageUrl"
                @crop="handleCrop" />
            </div>

            <div class="text-14px flex items-center h-full gap-5px">
              <span>
                {{ currentSession?.name || '' }}
              </span>
              <span v-if="currentSession?.hotFlag === 1">
                <svg class="w-18px h-18px iconpark-icon text-var(--hula-brand-primary)">
                  <use href="#auth"></use>
                </svg>
              </span>
            </div>
          </div>
          <!-- 群成员  -->
          <div v-if="isGroup" class="bg-white rounded-10px max-w-full p-[5px_10px_5x_10px] shadow">
            <div class="p-[15px_15px_0px_15px] flex flex-col">
              <!-- 群号 -->
              <div class="flex justify-between items-center">
                <div class="text-14px">群聊成员</div>
                <div @click="toGroupChatMember" class="text-12px text-var(--hula-gray-500) flex flex-wrap gap-10px items-center">
                  <div>
                    有
                    <span class="text-var(--hula-brand-primary)">
                      {{
                        formattedStats.hasData ? formattedStats.memberCount : roomStore.currentRoom?.memberCount || 0
                      }}
                    </span>
                    位成员
                  </div>
                  <div>
                    <svg class="w-14px h-14px iconpark-icon">
                      <use href="#right"></use>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div class="py-15px px-5px grid grid-cols-5 gap-15px text-12px">
              <div
                @click="toFriendInfo(i.uid)"
                v-for="i in groupMemberListSliced"
                :key="i.uid"
                class="flex flex-col justify-center items-center gap-5px">
                <div class="rounded-full relative bg-#E5EFEE w-36px h-36px flex items-center justify-center">
                  <!-- 蒙板 -->
                  <div
                    v-if="i.activeStatus !== OnlineEnum.ONLINE"
                    class="w-36px h-36px absolute rounded-full bg-var(--hula-gray-600) opacity-70 z-4"></div>
                  <n-avatar
                    class="absolute z-3"
                    :size="36"
                    :src="avatarSrc(i.avatar || '')"
                    fallback-src="/logo.png"
                    round />
                </div>
                <div class="truncate max-w-full text-var(--hula-gray-600)">{{ i.name }}</div>
              </div>
              <div
                @click="toInviteGroupMember"
                class="flex flex-col justify-center items-center gap-5px cursor-pointer">
                <div
                  class="rounded-full bg-#E5EFEE w-36px h-36px flex items-center justify-center hover:bg-#D5E5E0 transition-colors">
                  <svg class="iconpark-icon h-25px w-25px">
                    <use href="#plus"></use>
                  </svg>
                </div>
                <div>邀请</div>
              </div>
            </div>
          </div>

          <!-- 管理群成员 -->
          <div
            v-if="isGroup && (isLord || isAdmin) && globalStore.currentSessionRoomId !== '1'"
            class="bg-white p-15px rounded-10px shadow text-14px flex cursor-pointer"
            @click="toManageGroupMember">
            管理群成员
          </div>

          <div
            class="bg-white p-15px rounded-10px shadow text-14px flex cursor-pointer"
            @click="handleSearchChatContent">
            查找聊天内容
          </div>
          <!-- 群公告 -->
          <div class="flex bg-white rounded-10px w-full h-auto shadow">
            <div class="px-15px flex flex-col w-full">
              <!-- 群号 -->
              <div
                class="divider-bottom flex justify-between py-15px items-center"
                @click="handleCopy(currentSession?.account || '')">
                <div class="text-14px">{{ isGroup ? '群号/二维码' : 'Hula号/二维码' }}</div>
                <div class="text-12px text-var(--hula-gray-500) flex flex-wrap gap-10px items-center">
                  <div>{{ currentSession?.account || '' }}</div>
                  <div>
                    <svg class="w-14px h-14px iconpark-icon">
                      <use href="#saoma-i3589iic"></use>
                    </svg>
                  </div>
                </div>
              </div>

              <!-- 公告内容 -->
              <div @click="goToNotice" v-if="isGroup" class="pt-15px flex flex-col text-14px gap-10px">
                <div>群公告</div>
                <div class="text-var(--hula-gray-600) line-clamp-2 text-12px line-height-20px">
                  {{ announList.length > 0 ? announList[0]?.content : '' }}
                </div>
              </div>

              <div v-if="isGroup && (isLord || isAdmin)" class="flex justify-between py-15px items-center">
                <div class="text-14px">本群昵称</div>
                <div class="text-12px text-var(--hula-gray-500) flex flex-wrap gap-10px items-center">
                  <input
                    class="name-input"
                    v-model="nameValue"
                    @blur="handleGroupInfoUpdate"
                    placeholder="请输入群昵称" />
                </div>
              </div>

              <div v-if="isGroup" class="flex justify-between py-15px items-center">
                <div class="text-14px">我的群昵称</div>
                <div class="text-12px text-var(--hula-gray-500) flex flex-wrap gap-10px items-center">
                  <input
                    class="name-input"
                    v-model="nicknameValue"
                    @blur="handleInfoUpdate"
                    placeholder="请输入我的群昵称" />
                </div>
              </div>
            </div>
          </div>
          <!-- 备注 -->
          <div class="w-full flex flex-col gap-15px rounded-10px">
            <div class="ps-15px text-14px">
              <span>{{ title + '备注' }}</span>
              <span class="text-var(--hula-gray-500)">（仅自己可见）</span>
            </div>
            <div class="rounded-10px flex w-full bg-white shadow">
              <div class="w-full px-15px">
                <input
                  v-model="remarkValue"
                  class="h-50px w-full remark-input"
                  :placeholder="'请输入' + title + '备注'"
                  @blur="handleInfoUpdate" />
              </div>
            </div>
          </div>
          <div class="flex bg-white rounded-10px w-full h-auto shadow">
            <div class="px-15px flex flex-col w-full">
              <div class="pt-15px text-14px text-var(--hula-gray-500)">{{ title }}设置</div>
              <!-- 群号 -->
              <div class="divider-bottom flex justify-between py-12px items-center">
                <div class="text-14px">设置为置顶</div>
                <n-switch :value="!!currentSession?.top" @update:value="handleTop" />
              </div>
              <div class="divider-bottom flex justify-between py-12px items-center">
                <div class="text-14px">消息免打扰</div>
                <n-switch
                  @update:value="handleNotification"
                  :value="currentSession?.muteNotification === NotificationTypeEnum.NOT_DISTURB" />
              </div>
            </div>
          </div>
          <div class="shadow bg-white cursor-pointer text-red text-14px rounded-10px w-full mb-20px">
            <div class="p-15px">删除聊天记录</div>
          </div>
          <!-- 解散群聊、退出群聊、删除好友按钮 -->
          <div v-if="isGroup && globalStore.currentSessionRoomId !== '1'" class="mobile-action-footer">
            <n-button tertiary class="mobile-primary-btn" @click="router.back()">取消</n-button>
            <n-button type="error" class="mobile-primary-btn" @click="handleExit">
              {{ isGroup ? (isLord ? '解散群聊' : '退出群聊') : '删除好友' }}
            </n-button>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { logger } from '@/utils/logger'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useDialog } from 'naive-ui'
import { MittEnum, NotificationTypeEnum, OnlineEnum, RoomTypeEnum } from '@/enums'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import { useMitt } from '@/hooks/useMitt'
import { useMyRoomInfoUpdater } from '@/hooks/useMyRoomInfoUpdater'
import router from '@/router'
import { useCachedStore } from '@/stores/dataCache'
import { useChatStore } from '@/stores/chat'
import { useFriendsStore, useFriendsStoreV2 } from '@/stores/friendsSDK'
import { useGlobalStore } from '@/stores/global'
import { useRoomStore } from '@/stores/room'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { useRoomStats } from '@/composables/useRoomStats'
import { sessionSettingsService } from '@/services/sessionSettingsService'
import { toFriendInfoPage } from '@/utils/RouterUtils'
import bgImage from '@/assets/mobile/chat-home/background.webp'
import { msg } from '@/utils/SafeUI'

defineOptions({
  name: 'mobileChatSetting'
})

const dialog = useDialog()
const chatStore = useChatStore()
const globalStore = useGlobalStore()
const roomStore = useRoomStore()
const cacheStore = useCachedStore()
const friendsStore = useFriendsStore()
const friendsStoreV2 = useFriendsStoreV2() // compatibility alias from friendsSDK
const { persistMyRoomInfo } = useMyRoomInfoUpdater()

// 房间统计信息
const { formattedStats } = useRoomStats()

const title = computed(() => (isGroup.value ? '群' : '好友'))
const isGroup = computed(() => globalStore.currentSession?.type === RoomTypeEnum.GROUP)

const isLord = computed(() => roomStore.currentUserRole === 'owner')
const isAdmin = computed(() => roomStore.currentUserRole === 'admin')

const groupMemberListSliced = computed(() => {
  return (roomStore.currentMembers || []).slice(0, 9).map((m) => ({
    uid: m.userId,
    name: m.displayName,
    avatar: m.avatarUrl,
    activeStatus: OnlineEnum.OFFLINE // RoomStore 暂未同步详细在线状态，默认离线
  }))
})

const avatarSrc = (url: string) => AvatarUtils.getAvatarUrl(url)

const announError = ref(false)
const announNum = ref(0)
const isAddAnnoun = ref(false)

interface Announcement {
  id?: string
  content?: string
  title?: string
  [key: string]: unknown
}

const announList = ref<Announcement[]>([])
const remarkValue = ref('')
const nameValue = ref('')
const avatarValue = ref('')
const nicknameValue = ref('')
const currentSession = computed(() => globalStore.currentSession)
const friend = computed(() =>
  (friendsStore.friends || []).find(
    (f: { user_id?: string }) => f.user_id && String(f.user_id) === String(currentSession.value?.detailId)
  )
)

// 保存初始值，用于判断是否真正修改了内容
const initialRemarkValue = ref('')
const initialNicknameValue = ref('')
const initialNameValue = ref('')

const {
  fileInput,
  localImageUrl,
  showCropper,
  cropperRef,
  openAvatarCropper,
  handleFileChange,
  handleCrop: onCrop
} = useAvatarUpload({
  onSuccess: async (downloadUrl) => {
    avatarValue.value = downloadUrl
    // 如果是群组，自动更新头像
    if (isGroup.value) {
      await handleGroupInfoUpdate()
    }
  }
})

const handleCrop = async (cropBlob: Blob) => {
  await onCrop(cropBlob)
}

const handleCopy = (val: string) => {
  if (val) {
    navigator.clipboard.writeText(val)
    msg.success(`复制成功 ${val}`)
  }
}

const toFriendInfo = (uid: string) => {
  toFriendInfoPage(uid)
}

const toGroupChatMember = () => {
  router.push({ name: 'mobileGroupChatMember' })
}

const toInviteGroupMember = () => {
  router.push({ name: 'mobileInviteGroupMember' })
}

const toManageGroupMember = () => {
  router.push({ name: 'manageGroupMember' })
}

const goToNotice = () => {
  router.push({
    path: '/mobile/chatRoom/notice',
    query: {
      announList: JSON.stringify(announList.value),
      roomId: globalStore.currentSessionRoomId
    }
  })
}

// 退出登录逻辑
async function handleExit() {
  dialog.error({
    title: '提示',
    content: isGroup.value ? (isLord.value ? '确定要解散群聊吗？' : '确定要退出群聊吗？') : '删除好友',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      const session = currentSession.value
      if (!session) {
        msg.warning('当前会话不存在')
        return
      }
      try {
        if (isGroup.value) {
          const service = roomStore.getService()
          if (!service) {
            msg.error('服务未初始化')
            return
          }

          // Matrix 中没有明确的"解散"，通常是踢出所有人或自己离开
          // 这里统一调用 leaveRoom，如果是群主且想解散，逻辑可能需要更复杂（踢人），暂且先 leave
          await service.leaveRoom(session.roomId)

          msg.success(isLord.value ? '已解散群聊' : '已退出群聊')
          // 删除当前的会话
          useMitt.emit(MittEnum.DELETE_SESSION, session.roomId)
        } else {
          const detailId = session.detailId
          if (!detailId) {
            msg.warning('无法获取好友信息')
            return
          }
          // 使用 v2 service 删除好友
          await friendsStoreV2.removeFriend(detailId)
          msg.success('删除好友成功')
        }

        router.push('/mobile/message')
      } catch (error) {
        logger.error('退出/解散失败:', error)
      }
    },
    onNegativeClick: () => {
      logger.debug('用户点击了取消', undefined, 'ChatSetting')
    }
  })
}

const clickInfo = () => {
  if (isGroup.value) {
    openAvatarCropper()
  } else {
    const detailId = currentSession.value?.detailId
    if (!detailId) {
      msg.warning('当前会话信息未就绪')
      return
    }
    router.push(`/mobile/mobileFriends/friendInfo/${detailId}`)
  }
}
/**
 * 加载群公告
 */
const handleLoadGroupAnnoun = async () => {
  try {
    const roomId = globalStore.currentSessionRoomId
    if (!roomId) {
      logger.error('当前会话没有roomId')
      return
    }
    // 设置是否可以添加公告（仅群主和管理员）
    isAddAnnoun.value = isLord.value || isAdmin.value
    // 获取群公告列表
    const data = await cacheStore.getGroupAnnouncementList(roomId, 1, 10)
    if (data) {
      const dataWithRecords = data as { records?: unknown[]; total?: string | number }
      announList.value = (dataWithRecords.records || []) as Announcement[]
      // 处理置顶公告
      if (announList.value && announList.value.length > 0) {
        const topAnnouncement = announList.value.find((item: Announcement) => !!item.top)
        if (topAnnouncement) {
          announList.value = [topAnnouncement, ...announList.value.filter((item: Announcement) => !item.top)]
        }
      }
      announNum.value = parseInt(String(dataWithRecords.total ?? '0'), 10)
      announError.value = false
    } else {
      announError.value = false
    }
  } catch (error) {
    logger.error('加载群公告失败:', error)
    announError.value = true
  }
}

/** 置顶 */
const handleTop = async (value: boolean) => {
  const session = currentSession.value
  if (!session) return
  try {
    // 使用 Matrix SDK 设置会话置顶
    await sessionSettingsService.setSessionTop(session.roomId, value)
    // 更新本地会话状态
    chatStore.updateSession(session.roomId, { top: value })
    msg.success(value ? '已置顶' : '已取消置顶')
  } catch (error) {
    logger.error('置顶失败:', error)
    msg.error('置顶失败')
  }
}

// 处理群备注更新
const handleInfoUpdate = async () => {
  // 检查是否真正修改了内容
  const remarkChanged = remarkValue.value !== initialRemarkValue.value
  const nicknameChanged = nicknameValue.value !== initialNicknameValue.value

  // 如果群聊和单聊的备注、昵称都没有改变，则不调用接口
  if (!remarkChanged && !nicknameChanged) {
    return
  }

  if (isGroup.value) {
    await persistMyRoomInfo({
      roomId: globalStore.currentSessionRoomId,
      remark: remarkValue.value,
      myName: nicknameValue.value
    })
    // 更新初始值
    initialRemarkValue.value = remarkValue.value
    initialNicknameValue.value = nicknameValue.value
  } else {
    // 单聊只检查备注是否修改
    if (!remarkChanged) {
      return
    }

    const detailId = currentSession.value?.detailId
    if (!detailId) {
      msg.warning('无法获取好友信息')
      return
    }
    // 使用 Matrix SDK 设置好友备注
    await sessionSettingsService.setFriendRemark(globalStore.currentSessionRoomId, remarkValue.value)

    if (friend.value) {
      const friendWithRemark = friend.value as typeof friend.value & { remark?: string }
      friendWithRemark.remark = remarkValue.value
    }
    // 更新初始值
    initialRemarkValue.value = remarkValue.value
  }
  msg.success(title.value + '备注更新成功')
}

// 处理群名称更新
const handleGroupInfoUpdate = async () => {
  const session = currentSession.value
  if (!session) return
  // 检查群名称是否真正修改了
  if (nameValue.value === initialNameValue.value && avatarValue.value === session.avatar) {
    return
  }

  try {
    const service = roomStore.getService()
    if (service) {
      await service.updateRoomInfo(session.roomId, {
        name: nameValue.value,
        avatar: avatarValue.value
      })
      session.avatar = avatarValue.value

      // 更新初始值
      initialNameValue.value = nameValue.value
      msg.success('群信息更新成功')
    }
  } catch (e) {
    logger.error('更新群信息失败', e)
  }
}

/**
 *
 * 消息免打扰相关功能
 *
 *
 */

/** 处理屏蔽消息 */
const handleShield = async (value: boolean) => {
  const session = currentSession.value
  if (!session) return
  try {
    // 使用 Matrix SDK 设置会话屏蔽
    await sessionSettingsService.setSessionShield(session.roomId, value)
    // 更新本地会话状态
    chatStore.updateSession(session.roomId, {
      shield: value
    })

    // 1. 先保存当前聊天室ID
    const tempRoomId = globalStore.currentSessionRoomId

    // 3. 在下一个tick中恢复原来的聊天室ID，触发重新加载消息
    nextTick(() => {
      globalStore.updateCurrentSessionRoomId(tempRoomId)
    })

    msg.success(value ? '已屏蔽消息' : '已取消屏蔽')
  } catch (error) {
    logger.error('设置屏蔽失败:', error)
    msg.error('设置失败')
  }
}

/** 处理消息免打扰 */
const handleNotification = async (value: boolean) => {
  const session = currentSession.value
  if (!session) return
  const newMode = value ? 'not_disturb' : 'reception'
  // 如果当前是屏蔽状态，需要先取消屏蔽
  if (session.shield) {
    await handleShield(false)
  }
  try {
    // 使用 Matrix SDK 设置通知模式
    await sessionSettingsService.setNotificationMode(session.roomId, newMode)
    // 更新本地会话状态
    const newType = value ? NotificationTypeEnum.NOT_DISTURB : NotificationTypeEnum.RECEPTION
    chatStore.updateSession(session.roomId, {
      muteNotification: newType
    })

    // 如果从免打扰切换到允许提醒，需要重新计算全局未读数
    if (session.muteNotification === NotificationTypeEnum.NOT_DISTURB && newType === NotificationTypeEnum.RECEPTION) {
      chatStore.updateTotalUnreadCount()
    }

    // 如果设置为免打扰，也需要更新全局未读数，因为该会话的未读数将不再计入
    if (newType === NotificationTypeEnum.NOT_DISTURB) {
      chatStore.updateTotalUnreadCount()
    }

    msg.success(value ? '已设置接收消息但不提醒' : '已允许消息提醒')
  } catch (error) {
    logger.error('设置通知模式失败:', error)
    msg.error('设置失败')
  }
}

/**
 *
 * 消息免打扰相关功能（结束）
 *
 *  */

/** 处理查找聊天内容 */
const handleSearchChatContent = () => {
  router.push({
    name: 'mobileSearchChatContent'
  })
}

/**
 * 这里直接监听状态的值
 */
onMounted(async () => {
  await handleLoadGroupAnnoun()
  if (isGroup.value) {
    const roomId = globalStore.currentSessionRoomId
    await roomStore.initRoom(roomId)
    const room = roomStore.rooms[roomId]

    if (room) {
      nameValue.value = room.name || ''
      avatarValue.value = room.avatar || ''

      // 保存初始值
      initialNameValue.value = nameValue.value
    }
  } else {
    // 这里需要拿到好友的信息
    const friendWithRemark = friend.value as (typeof friend.value & { remark?: string }) | undefined
    remarkValue.value = friendWithRemark?.remark || ''
    // 保存初始值
    initialRemarkValue.value = remarkValue.value
  }
})
</script>

<style scoped>
.header-bar {
  border-bottom: 1px solid;
  border-color: var(--hula-gray-200);
}

.avatar-container {
  margin-left: 10px;
}

.divider-bottom {
  border-bottom: 1px solid;
  border-color: var(--hula-gray-200);
}

.name-input {
  height: 17px;
  border: none;
  text-align: right;
  outline: none;
  font-size: 14px;
}

.remark-input {
  border: none;
  outline: none;
  font-size: 14px;
}
</style>
