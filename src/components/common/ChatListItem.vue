<template>
  <div class="chat-list-item" :class="itemClasses">
    <n-flex :size="isMobile ? 6 : 10" align="center" class="item-flex">
      <!-- Avatar -->
      <div class="chat-list-item-avatar">
        <n-badge
          :offset="[-6, 6]"
          :color="item.muteNotification === NotificationTypeEnum.NOT_DISTURB ? 'grey' : 'var(--hula-brand-primary)'"
          :value="item.unreadCount"
          :max="99">
          <n-avatar
            :size="isMobile ? 52 : 44"
            :color="isDark ? '' : 'var(--hula-white)'"
            :fallback-src="isDark ? '/logoL.png' : '/logoD.png'"
            :src="AvatarUtils.getAvatarUrl(item.avatar)"
            round />
        </n-badge>
      </div>

      <!-- Content -->
      <n-flex class="chat-list-item-content" vertical :size="isMobile ? 2 : 4">
        <!-- Name row -->
        <n-flex justify="space-between" align="center" class="chat-list-item-name-row">
          <n-flex :size="0" align="center" class="chat-list-item-name">
            <span class="chat-list-item-name-text">{{ displayName }}</span>
            <!-- Official badge -->
            <n-popover v-if="item.hotFlag === 1" trigger="hover">
              <template #trigger>
                <svg class="size-20px select-none outline-none cursor-pointer text-brand">
                  <use href="#auth"></use>
                </svg>
              </template>
              <span>{{ t('message.message_list.official_popover') }}</span>
            </n-popover>
            <!-- Bot badge -->
            <n-popover v-if="item.account === 'bot'" trigger="hover">
              <template #trigger>
                <svg class="size-20px select-none outline-none cursor-pointer text-brand">
                  <use href="#authenticationUser"></use>
                </svg>
              </template>
              <span>{{ t('message.message_list.bot_popover') }}</span>
            </n-popover>
          </n-flex>
          <span class="chat-list-item-time">{{ formattedTime }}</span>
        </n-flex>

        <!-- Message row -->
        <n-flex align="center" justify="space-between" class="chat-list-item-message-row">
          <template v-if="item.shield">
            <span class="chat-list-item-message shield">
              {{
                item.type === RoomTypeEnum.GROUP
                  ? t('message.message_list.shield_group')
                  : t('message.message_list.shield_user')
              }}
            </span>
          </template>
          <template v-else>
            <span class="chat-list-item-message" :class="{ 'text-bot': item.account === 'bot' }">
              {{ displayMessage }}
            </span>
          </template>

          <!-- Status indicators -->
          <template v-if="item.shield">
            <svg class="size-14px color-var(--hula-brand-primary)">
              <use href="#forbid"></use>
            </svg>
          </template>
          <template v-else-if="item.muteNotification === NotificationTypeEnum.NOT_DISTURB && !item.unreadCount">
            <svg class="size-14px color-var(--hula-brand-primary)">
              <use href="#close-remind"></use>
            </svg>
          </template>
        </n-flex>
      </n-flex>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatTimestamp } from '@/utils/ComputedTime'
import { RoomTypeEnum, NotificationTypeEnum } from '@/enums'
import type { SessionItem } from '@/services/types'
import { useSettingStore } from '@/stores/setting'

// Props
const props = defineProps<{
  session: SessionItem
  isMobile?: boolean
}>()

// Composables
const { t } = useI18n()
const settingStore = useSettingStore()

// Computed
const item = computed(() => props.session)

const isDark = computed(() => settingStore.themes.content === 'dark')

const displayName = computed(() => {
  // Use group remark if available
  if (item.value.type === RoomTypeEnum.GROUP && item.value.remark) {
    return item.value.remark
  }
  return item.value.name
})

const displayMessage = computed(() => {
  const text = item.value.text || t('message.message_list.default_last_msg')
  return String(text).replace(':', '：')
})

const formattedTime = computed(() => {
  return formatTimestamp(item.value.activeTime)
})

const itemClasses = computed(() => ({
  'is-mobile': props.isMobile,
  'is-desktop': !props.isMobile,
  'is-pinned': item.value.top,
  'is-muted': item.value.muteNotification === NotificationTypeEnum.NOT_DISTURB,
  'is-shield': item.value.shield,
  'has-unread': item.value.unreadCount > 0
}))
</script>

<style scoped lang="scss">
.chat-list-item {
  padding: var(--hula-spacing-xs) var(--hula-spacing-sm);
  border-radius: var(--hula-radius-md);
  transition: background-color 0.2s ease;

  &.is-mobile {
    padding: var(--hula-spacing-md) var(--hula-spacing-lg);
    min-height: 75px;
  }

  &.is-pinned {
    background-color: var(--item-pinned-bg, rgba(var(--hula-brand-rgb), 0.1));
  }

  .item-flex {
    height: var(--hula-spacing-md);

    .is-desktop & {
      height: var(--hula-spacing-xl);
    }
  }
}

.chat-list-item-avatar {
  flex-shrink: 0;
}

.chat-list-item-content {
  flex: 1;
  min-width: 0;
}

.chat-list-item-name-row {
  width: 100%;
}

.chat-list-item-name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--hula-spacing-xs);
  min-width: 0;
}

.chat-list-item-name-text {
  font-size: var(--hula-text-sm);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-color);

  .is-mobile & {
    font-size: var(--hula-text-base);
    font-weight: bold;
  }
}

.chat-list-item-time {
  font-size: var(--hula-text-xs);
  color: var(--text-color-secondary);
  white-space: nowrap;
  margin-left: var(--hula-spacing-xs);

  .is-mobile & {
    font-size: var(--hula-text-sm);
  }
}

.chat-list-item-message-row {
  width: 100%;
}

.chat-list-item-message {
  flex: 1;
  font-size: var(--hula-text-sm);
  color: var(--text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  .is-mobile & {
    font-size: var(--hula-text-base);
  }

  &.text-bot {
    color: var(--text-color-secondary);
  }

  &.shield {
    color: var(--shield-color);
  }
}
</style>
