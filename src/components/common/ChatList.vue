<template>
  <div class="chat-list-wrapper" :class="{ 'mobile-mode': isMobile }">
    <!-- Search Bar -->
    <div v-if="showSearch" class="chat-list-search">
      <n-input
        v-model:value="searchKeyword"
        :placeholder="searchPlaceholder || t('message.message_list.search_placeholder')"
        clearable
        @input="handleSearchInput">
        <template #prefix>
          <svg class="w-14px h-14px">
            <use href="#search"></use>
          </svg>
        </template>
      </n-input>
    </div>

    <!-- Category Tabs (if enabled) -->
    <div v-if="showCategories" class="chat-list-categories">
      <n-button
        v-for="cat in categories"
        :key="cat.id"
        :type="selectedCategory === cat.id ? 'primary' : 'default'"
        size="small"
        @click="handleCategoryClick(cat.id)">
        {{ cat.name }}
      </n-button>
    </div>

    <!-- Chat List Content -->
    <ChatListEnhancer
      :loading="loading"
      :is-empty="isEmpty"
      :error="error"
      :error-message="errorMessage"
      @retry="handleRetry"
      @refresh="handleRefresh"
      @start-chat="handleStartChat">
      <template #default>
        <!-- Virtual Scroll for PC, Normal Scroll for Mobile -->
        <template v-if="isMobile && filteredSessions.length > 0">
          <div class="chat-list-items mobile">
            <div
              v-for="(item, index) in filteredSessions"
              :key="item.roomId"
              v-on-long-press="[(e: PointerEvent) => handleLongPress(e, item), longPressOption]"
              :class="getItemClasses(item)"
              @click="handleClick(item)"
              @contextmenu.prevent="handleContextMenu(item, $event)">
              <slot name="item" :item="item" :index="index">
                <ChatListItem :session="item" :is-mobile="true" />
              </slot>
            </div>
          </div>
        </template>

        <!-- Desktop: Virtual Scroll or Normal Scroll based on props -->
        <template v-else-if="!isMobile && filteredSessions.length > 0">
          <!-- Virtual Scroll Mode (recommended for 100+ sessions) -->
          <template v-if="virtualScroll">
            <ChatListVirtualList :sessions="filteredSessions" :estimated-item-height="80" :buffer-size="5">
              <template #default="{ item, index }">
                <ContextMenu
                  :class="getItemClasses(item)"
                  :menu="getVisibleMenu(item)"
                  :special-menu="getVisibleSpecialMenu(item)"
                  :content="item"
                  @click="handleClick(item, $event)"
                  @dblclick="handleDblClick(item)"
                  @select="handleMenuSelect(item, $event)">
                  <slot name="item" :item="item" :index="index">
                    <ChatListItem :session="item" :is-mobile="false" />
                  </slot>
                </ContextMenu>
              </template>
            </ChatListVirtualList>
          </template>

          <!-- Normal Scroll Mode (fallback for compatibility) -->
          <template v-else>
            <n-scrollbar ref="scrollbarRef" style="max-height: calc(100vh / var(--page-scale, 1) - 120px)">
              <div class="chat-list-items desktop">
                <ContextMenu
                  v-for="(item, index) in filteredSessions"
                  :key="item.roomId"
                  :class="getItemClasses(item)"
                  :menu="getVisibleMenu(item)"
                  :special-menu="getVisibleSpecialMenu(item)"
                  :content="item"
                  @click="handleClick(item, $event)"
                  @dblclick="handleDblClick(item)"
                  @select="handleMenuSelect(item, $event)">
                  <slot name="item" :item="item" :index="index">
                    <ChatListItem :session="item" :is-mobile="false" />
                  </slot>
                </ContextMenu>
              </div>
            </n-scrollbar>
          </template>
        </template>

        <!-- Empty Slot -->
        <template v-if="!loading && filteredSessions.length === 0">
          <div class="chat-list-empty">
            <n-empty :description="emptyText || t('message.message_list.no_sessions')">
              <template #extra v-if="showEmptyAction">
                <n-button size="small" @click="handleStartChat">
                  {{ emptyActionText || t('message.message_list.start_chat') }}
                </n-button>
              </template>
            </n-empty>
          </div>
        </template>
      </template>
    </ChatListEnhancer>

    <!-- Mobile Long Press Menu -->
    <teleport to="body">
      <div
        v-if="isMobile && longPressState.showMenu"
        :style="{ top: longPressState.menuTop + 'px' }"
        class="mobile-long-press-menu">
        <div class="mobile-long-press-menu-content">
          <div v-for="action in mobileMenuActions" :key="action.key" @click="action.handler">
            {{ action.label }}
          </div>
        </div>
        <div class="mobile-long-press-menu-arrow"></div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts" generic="T extends SessionItem">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { vOnLongPress } from '@vueuse/components'
import ChatListEnhancer from './ChatListEnhancer.vue'
import ContextMenu, { type MenuItem } from './ContextMenu.vue'
import ChatListItem from './ChatListItem.vue'
import ChatListVirtualList from './ChatListVirtualList.vue'
import type { SessionItem } from '@/services/types'
import type { ChatListFilter, SessionCategory } from '@/types/chat'
import { RoomTypeEnum, NotificationTypeEnum, UserType } from '@/enums'
import { usePlatform } from '@/composables'
import { logger } from '@/utils/logger'
import {
  getDefaultMenuItems,
  getSpecialMenuItems,
  filterBotMenuItems,
  filterVisibleMenuItems,
  toLegacyMenuItem
} from '@/utils/chatListMenu'

// Props
const props = withDefaults(
  defineProps<{
    /** Session items */
    sessions: SessionItem[]
    /** Current session room ID */
    currentRoomId?: string
    /** Show search bar */
    showSearch?: boolean
    /** Show category tabs */
    showCategories?: boolean
    /** Enable virtual scroll */
    virtualScroll?: boolean
    /** Loading state */
    loading?: boolean
    /** Error state */
    error?: boolean
    /** Error message */
    errorMessage?: string
    /** Search placeholder */
    searchPlaceholder?: string
    /** Empty text */
    emptyText?: string
    /** Show empty action button */
    showEmptyAction?: boolean
    /** Empty action text */
    emptyActionText?: string
    /** Initial filter */
    initialFilter?: Partial<ChatListFilter>
    /** Available categories */
    categories?: SessionCategory[]
  }>(),
  {
    showSearch: false,
    showCategories: false,
    virtualScroll: false,
    loading: false,
    error: false,
    errorMessage: '',
    showEmptyAction: true
  }
)

// Emits
const emit = defineEmits<{
  click: [item: SessionItem, event?: MouseEvent]
  dblclick: [item: SessionItem]
  contextmenu: [item: SessionItem, event: MouseEvent]
  search: [keyword: string]
  categoryChange: [categoryId: string]
  refresh: []
  retry: []
  startChat: []
}>()

// Composables
const { t } = useI18n()
const platform = usePlatform()

// Computed
const isMobile = computed(() => platform.isMobile)

// State
const searchKeyword = ref('')
const selectedCategory = ref<string>('all')
const scrollbarRef = ref<HTMLElement | null>(null)
const longPressState = ref({
  showMenu: false,
  menuTop: 0,
  active: false,
  currentItem: null as SessionItem | null
})

// Long press option
const longPressOption = ref({
  delay: 200,
  modifiers: { prevent: true, stop: true },
  reset: true,
  windowResize: true,
  windowScroll: true,
  immediate: true,
  updateTiming: 'sync'
})

// Computed
const filter = computed<ChatListFilter>(() => ({
  keyword: searchKeyword.value,
  type: 'all',
  category: selectedCategory.value,
  pinnedOnly: false,
  unreadOnly: false
}))

const filteredSessions = computed(() => {
  let result = [...props.sessions]

  // Filter by keyword
  if (filter.value.keyword) {
    const keyword = filter.value.keyword.toLowerCase()
    result = result.filter(
      (item) => item.name.toLowerCase().includes(keyword) || item.text?.toLowerCase().includes(keyword)
    )
  }

  // Filter by category
  if (filter.value.category && filter.value.category !== 'all') {
    switch (filter.value.category) {
      case 'pinned':
        result = result.filter((item) => item.top)
        break
      case 'unread':
        result = result.filter((item) => item.unreadCount > 0)
        break
      case 'direct':
        result = result.filter((item) => item.type === RoomTypeEnum.SINGLE)
        break
      case 'group':
        result = result.filter((item) => item.type === RoomTypeEnum.GROUP)
        break
    }
  }

  return result
})

const isEmpty = computed(() => !props.loading && filteredSessions.value.length === 0)

// Mobile menu actions
const mobileMenuActions = computed(() => [
  {
    key: 'delete',
    label: '删除',
    handler: () => handleMobileMenuAction('delete')
  },
  {
    key: 'toggleTop',
    label: longPressState.value.currentItem?.top ? '取消置顶' : '置顶',
    handler: () => handleMobileMenuAction('toggleTop')
  },
  {
    key: 'toggleRead',
    label: (longPressState.value.currentItem?.unreadCount ?? 0) > 0 ? '已读' : '未读',
    handler: () => handleMobileMenuAction('toggleRead')
  }
])

// Methods
const handleSearchInput = () => {
  emit('search', searchKeyword.value)
}

const handleCategoryClick = (categoryId: string) => {
  selectedCategory.value = categoryId
  emit('categoryChange', categoryId)
}

const handleClick = (item: SessionItem, event?: MouseEvent) => {
  if (longPressState.value.active) return
  emit('click', item, event)
}

const handleDblClick = (item: SessionItem) => {
  emit('dblclick', item)
}

const handleContextMenu = (item: SessionItem, event: MouseEvent) => {
  emit('contextmenu', item, event)
}

const handleMenuSelect = async (item: SessionItem, menuItem: MenuItem) => {
  logger.debug('[ChatList handleMenuSelect] Called with:', {
    itemRoomId: item.roomId,
    menuItemLabel: typeof menuItem.label === 'function' ? menuItem.label(item) : menuItem.label,
    hasClick: !!menuItem.click
  })

  if (menuItem.click) {
    logger.debug('[ChatList handleMenuSelect] Calling menuItem.click with item:', item)
    await menuItem.click(item)
    logger.debug('[ChatList handleMenuSelect] Click handler completed')
  } else {
    logger.warn('[ChatList handleMenuSelect] Menu item has no click handler!')
  }
}

const handleLongPress = (e: PointerEvent, item: SessionItem) => {
  if (!isMobile.value) return

  e.stopPropagation()
  longPressState.value.active = true
  longPressState.value.currentItem = item
  longPressState.value.showMenu = true
  longPressState.value.menuTop = e.clientY - 50
}

const handleMobileMenuAction = (_action: string) => {
  const item = longPressState.value.currentItem
  if (!item) return

  closeMobileMenu()
  emit('contextmenu', item, new MouseEvent('contextmenu', { bubbles: true }))
}

const closeMobileMenu = () => {
  longPressState.value.showMenu = false
  longPressState.value.active = false
  longPressState.value.currentItem = null
}

const handleRetry = () => {
  emit('retry')
}

const handleRefresh = () => {
  emit('refresh')
}

const handleStartChat = () => {
  emit('startChat')
}

const getItemClasses = (item: SessionItem) => {
  const isCurrent = props.currentRoomId === item.roomId
  return {
    'chat-list-item': true,
    'chat-list-item-current': isCurrent,
    'chat-list-item-pinned': item.top,
    'chat-list-item-unread': item.unreadCount > 0,
    'chat-list-item-muted': item.muteNotification === NotificationTypeEnum.NOT_DISTURB,
    'chat-list-item-shield': item.shield
  }
}

// Get visible menu items for a session
const getVisibleMenu = (item: SessionItem): MenuItem[] => {
  let menuItems = getDefaultMenuItems()

  // Filter for bot accounts (fewer menu options)
  if (item.account === UserType.BOT) {
    menuItems = filterBotMenuItems(menuItems)
  }

  // Filter by visibility
  const visibleItems = filterVisibleMenuItems(menuItems, item)

  // Convert to MenuItem format
  return visibleItems.map(toLegacyMenuItem) as MenuItem[]
}

// Get visible special menu items (destructive actions)
const getVisibleSpecialMenu = (item: SessionItem): MenuItem[] => {
  let specialItems = getSpecialMenuItems()

  // Filter for bot accounts
  if (item.account === UserType.BOT) {
    specialItems = filterBotMenuItems(specialItems)
  }

  // Filter by visibility
  const visibleItems = filterVisibleMenuItems(specialItems, item)

  // Convert to MenuItem format
  return visibleItems.map(toLegacyMenuItem) as MenuItem[]
}

// Watch for initial filter
watch(
  () => props.initialFilter,
  (newFilter) => {
    if (newFilter) {
      if (newFilter.keyword !== undefined) {
        searchKeyword.value = newFilter.keyword
      }
      if (newFilter.category !== undefined) {
        selectedCategory.value = newFilter.category
      }
    }
  },
  { immediate: true }
)

// Close mobile menu when clicking outside
if (isMobile.value) {
  document.addEventListener('click', (e) => {
    if (longPressState.value.showMenu) {
      const menuEl = document.querySelector('.mobile-long-press-menu')
      if (menuEl && !menuEl.contains(e.target as Node)) {
        closeMobileMenu()
      }
    }
  })
}
</script>

<style scoped lang="scss">
.chat-list-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: transparent;

  &.mobile-mode {
    .chat-list-search {
      padding: 8px 16px;
    }
  }
}

.chat-list-search {
  padding: 8px;
  background: transparent;
}

.chat-list-categories {
  display: flex;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid var(--border-color);
}

.chat-list-items {
  &.desktop {
    padding: 4px 8px;
  }

  &.mobile {
    padding: 0;
  }
}

.chat-list-item {
  cursor: pointer;
  transition: background-color 0.2s;
  border-radius: 8px;

  &:hover {
    background-color: var(--item-hover-bg, rgba(0, 0, 0, 0.05));
  }

  &.chat-list-item-current {
    background-color: var(--item-active-bg, rgba(51, 206, 171, 0.1));
  }

  &.chat-list-item-pinned {
    background-color: var(--item-pinned-bg, rgba(100, 162, 156, 0.1));
  }
}

.chat-list-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 20px;
}

/* Mobile Long Press Menu */
.mobile-long-press-menu {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
  pointer-events: auto;
}

.mobile-long-press-menu-content {
  display: flex;
  justify-content: space-between;
  padding: 18px;
  color: white;
  font-size: 16px;
  gap: 22px;
  white-space: nowrap;
  border-radius: 16px;
  background: #4e4e4e;
  pointer-events: auto;

  > div {
    cursor: pointer;
    &:active {
      opacity: 0.7;
    }
  }
}

.mobile-long-press-menu-arrow {
  display: flex;
  justify-content: center;
  width: 100%;
  height: 13px;

  svg {
    width: 35px;
    height: 13px;
    path {
      fill: #4e4e4e;
    }
  }
}
</style>
