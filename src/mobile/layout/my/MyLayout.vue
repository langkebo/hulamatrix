<template>
  <MobileLayout :topSafeAreaClass="computedTopAreaClass">
    <div class="h-full flex flex-col">
      <!-- 页面全部内容 -->
      <div class="flex flex-col flex-1">
        <RouterView v-slot="{ Component }">
          <div class="page-view">
            <component :is="Component" :key="route.fullPath" />
          </div>
        </RouterView>
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { logger } from '@/utils/logger'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { MittEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import router from '@/router'
import { useGlobalStore } from '@/stores/global'
import { useUserStore } from '@/stores/user'
import { getGroupDetail, scanQRCodeAPI } from '@/utils/ImRequestUtils'
import { msg } from '@/utils/SafeUI'

const route = useRoute()

interface ScanData {
  type: string // 必须有
  [key: string]: unknown // 允许有其他任意字段
}

const handleScanLogin = async (data: ScanData) => {
  if (!('qrId' in data)) {
    msg.warning('登录二维码不存在qrId')
    logger.warn('登录二维码不存在qrId', data)
    throw new Error('登录二维码不存在qrId')
  }

  const { qrId } = data
  const qrIdStr = typeof qrId === 'string' ? qrId : String(qrId)

  const result = (await scanQRCodeAPI({ qrId: qrIdStr })) as {
    ip: string
    expireTime: string
    deviceType: string
    locPlace?: string
  }

  router.push({
    name: 'mobileConfirmQRLogin',
    params: {
      ip: result.ip,
      expireTime: result.expireTime,
      deviceType: result.deviceType,
      locPlace: result.locPlace ? result.locPlace : '深圳',
      qrId: qrIdStr
    }
  })
}

const globalStore = useGlobalStore()
const userStore = useUserStore()

const handleScanAddFriend = async (data: ScanData) => {
  logger.debug('尝试扫码添加好友::', { data, component: 'MyLayout' })
  if (!('uid' in data)) {
    msg.warning('登录二维码不存在uid')
    logger.warn('登录二维码不存在uid', data)
    throw new Error('登录二维码不存在uid')
  }

  const uidStr = data.uid as string
  const uid = uidStr.split('&')[0]

  // 判断uid是不是自己的

  const selfUid = userStore.userInfo?.uid as string

  if (selfUid === uid) {
    msg.warning('不能添加自己为好友哦~', { duration: 4000 })
    logger.warn('用户尝试扫自己二维码添加好友但被拒绝', data)
    throw new Error('用户尝试扫自己二维码添加好友但被拒绝')
  }

  // Handle exactOptionalPropertyTypes by creating a new object with all required properties
  const currentInfo = globalStore.addFriendModalInfo
  if (currentInfo) {
    globalStore.addFriendModalInfo = { ...currentInfo, ...(uid !== undefined && { uid }) }
  } else {
    globalStore.addFriendModalInfo = { show: false, ...(uid !== undefined && { uid }) }
  }

  setTimeout(() => {
    router.push({ name: 'mobileConfirmAddFriend' })
  }, 100)
}

/**
 * 扫码进群
 */
const handleScanEnterGroup = async (data: ScanData) => {
  if (!('roomId' in data)) {
    msg.warning('加群二维码不存在roomId')
    logger.warn('加群二维码不存在roomId', data)
    throw new Error('加群二维码不存在roomId')
  }

  const roomId = data.roomId as string

  // 可能是扫码出来的
  const groupDetail = (await getGroupDetail(roomId)) as { account?: string; groupName?: string; avatar?: string }

  // Handle exactOptionalPropertyTypes by creating a new object with all required properties
  globalStore.addGroupModalInfo = {
    show: globalStore.addGroupModalInfo?.show || false,
    account: groupDetail.account || '',
    name: groupDetail.groupName || '',
    avatar: groupDetail.avatar || ''
  }

  setTimeout(() => {
    router.push({ name: 'mobileConfirmAddGroup' })
  }, 100)
}

/**
 * 监听事件扫码
 */
useMitt.on(MittEnum.QR_SCAN_EVENT, async (data: ScanData) => {
  if (!('type' in data)) {
    msg.warning('识别不到正确的二维码')
    logger.warn('二维码缺少type字段', data)
    throw new Error('二维码缺少type字段')
  }

  switch (data.type) {
    case 'login':
      try {
        await handleScanLogin(data)
      } catch (error) {
        logger.debug('扫码尝试获取Token失败:', error)
      }
      break
    case 'addFriend':
      try {
        await handleScanAddFriend(data)
      } catch (error) {
        logger.debug('扫码添加好友失败:', error)
      }
      break
    case 'scanEnterGroup':
      try {
        await handleScanEnterGroup(data)
      } catch (error) {
        logger.debug('扫码加入群失败:', error)
      }
      break
    default:
      msg.warning('识别不到正确的二维码')
      throw new Error('二维码缺少type字段:' + JSON.stringify(data))
  }
})

const computedTopAreaClass = computed(() => {
  return (route.name as string) !== 'mobileSimpleBio' ? 'bg-white' : ''
})
</script>

<style lang="scss" scoped>
// .page-view {
//   // 进入时的动画
//   animation: fade-slide-in 0.3s ease;
// }

// @keyframes fade-slide-in {
//   from {
//     transform: translateX(20px);
//     opacity: 0;
//   }
//   to {
//     transform: translateX(0);
//     opacity: 1;
//   }
// }
</style>
