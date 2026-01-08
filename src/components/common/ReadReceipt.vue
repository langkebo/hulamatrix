<template>
  <n-popover trigger="hover" placement="top">
    <template #trigger>
      <div class="read-receipt" :class="{ unread: !hasRead }">
        <template v-if="readers.length > 0">
          <n-avatar-group :options="avatarOptions" :size="20" :max="3" />
        </template>
        <n-text v-if="readCount > 0" class="read-count" depth="3">
          {{ readCount }}
        </n-text>
      </div>
    </template>
    <div class="read-receipt-detail">
      <n-list hoverable clickable>
        <n-list-item v-for="reader in readers" :key="reader.userId">
          <template #prefix>
            <n-avatar :src="reader.avatar" :size="32">
              {{ reader.displayName?.charAt(0) }}
            </n-avatar>
          </template>
          <div class="reader-info">
            <n-text strong>{{ reader.displayName }}</n-text>
            <n-text depth="3" class="read-time">
              {{ formatReadTime(reader.timestamp) }}
            </n-text>
          </div>
        </n-list-item>
        <n-list-item v-if="readers.length === 0">
          <n-empty :description="t('read_receipt.no_readers')" size="small" />
        </n-list-item>
      </n-list>
    </div>
  </n-popover>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { NPopover, NAvatarGroup, NAvatar, NText, NList, NListItem, NEmpty } from 'naive-ui'
import type { AvatarGroupOption } from 'naive-ui'
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

const avatarOptions = computed<AvatarGroupOption[]>(() => {
  return readers.value.slice(0, 3).map((reader) => ({
    src: reader.avatar || '',
    fallback: () => reader.displayName?.charAt(0) || '?'
  }))
})

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
.read-receipt {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 12px;
  background: var(--bg-color-secondary);
  cursor: pointer;

  &.unread {
    opacity: 0.5;
  }

  .read-count {
    font-size: 11px;
    margin-left: 4px;
  }
}

.read-receipt-detail {
  min-width: 200px;
  max-width: 300px;

  .reader-info {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .read-time {
      font-size: 12px;
    }
  }
}
</style>
