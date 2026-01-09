<template>
  <van-popover v-model:show="showPopover" placement="top">
    <div class="read-receipt-popover">
      <div v-for="reader in readers" :key="reader.userId" class="reader-item">
        <van-image round width="32" height="32" :src="reader.avatar">
          <template #error>
            <van-icon name="user" />
          </template>
        </van-image>
        <div class="reader-info">
          <div class="reader-name">{{ reader.displayName }}</div>
          <div class="reader-time">{{ formatReadTime(reader.timestamp) }}</div>
        </div>
      </div>

      <van-empty v-if="readers.length === 0" :description="t('read_receipt.no_readers')" image-size="60" />
    </div>

    <template #reference>
      <div class="mobile-read-receipt" :class="{ unread: !hasRead }" @click="handleClick">
        <div class="avatar-group">
          <div
            v-for="(reader, index) in readers.slice(0, 3)"
            :key="reader.userId"
            class="avatar-item"
            :style="{ zIndex: 10 - index }">
            <van-image round width="20" height="20" :src="reader.avatar">
              <template #error>
                <span class="avatar-placeholder">
                  {{ reader.displayName?.charAt(0) }}
                </span>
              </template>
            </van-image>
          </div>
        </div>

        <div v-if="readCount > 0" class="read-count">
          {{ readCount }}
        </div>
      </div>
    </template>
  </van-popover>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Popover as VanPopover, Image as VanImage, Icon as VanIcon, Empty as VanEmpty } from 'vant'
import { useRoomStore } from '@/stores/room'
import { useUserStore } from '@/stores/user'

interface Reader {
  userId: string
  displayName: string
  avatar?: string
  timestamp: number
}

interface Props {
  roomId: string
  eventId: string
}

const props = defineProps<Props>()

const { t } = useI18n()
const roomStore = useRoomStore()
const userStore = useUserStore()

const showPopover = ref(false)

const readers = computed<Reader[]>(() => {
  const receipts = roomStore.getReadReceipts?.(props.roomId, props.eventId) || []
  const myUserId = userStore.userInfo?.uid

  return receipts
    .filter((r) => r.userId !== myUserId)
    .map((r) => ({
      userId: r.userId,
      displayName: userStore.getDisplayName(r.userId) || r.userId,
      avatar: userStore.getUserAvatar(r.userId),
      timestamp: r.timestamp
    }))
})

const readCount = computed(() => readers.value.length)

const hasRead = computed(() => readCount.value > 0)

function handleClick() {
  if (hasRead.value) {
    showPopover.value = !showPopover.value
  }
}

function formatReadTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return t('read_receipt.just_now')
  if (diff < 3600000) return t('read_receipt.minutes_ago', { minutes: Math.floor(diff / 60000) })
  if (diff < 86400000) return t('read_receipt.hours_ago', { hours: Math.floor(diff / 3600000) })
  return t('read_receipt.date', { date: new Date(timestamp).toLocaleDateString() })
}
</script>

<style lang="scss" scoped>
.mobile-read-receipt {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 12px;
  background: rgba(var(--hula-black-rgb), 0.05);
  cursor: pointer;

  &.unread {
    opacity: 0.5;
  }

  .avatar-group {
    display: flex;
    position: relative;

    .avatar-item {
      margin-left: -8px;
      border: 2px solid var(--hula-white);
      border-radius: 50%;

      &:first-child {
        margin-left: 0;
      }

      .avatar-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        background: var(--van-gray-2);
        font-size: 10px;
        color: var(--van-text-color-2);
      }
    }
  }

  .read-count {
    font-size: 11px;
    color: var(--van-text-color-3);
    margin-left: 4px;
  }
}

.read-receipt-popover {
  min-width: 200px;
  max-width: 280px;
  max-height: 300px;
  overflow-y: auto;
  padding: 12px;

  .reader-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--van-gray-1);

    &:last-child {
      border-bottom: none;
    }

    .reader-info {
      flex: 1;

      .reader-name {
        font-size: 14px;
        font-weight: 500;
      }

      .reader-time {
        font-size: 11px;
        color: var(--van-text-color-3);
        margin-top: 2px;
      }
    }
  }
}
</style>
