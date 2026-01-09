<!-- Mobile Message Reactions - Emoji reactions for mobile messages -->
<template>
  <div class="mobile-message-reactions">
    <!-- Reactions List -->
    <div v-if="displayReactions.length > 0" class="reactions-list">
      <div
        v-for="reaction in displayReactions"
        :key="reaction.key"
        class="reaction-chip"
        :class="{ 'user-reacted': reaction.userMarked }"
        @click="handleToggleReaction(reaction.key)">
        <span class="reaction-emoji">{{ reaction.key }}</span>
        <span v-if="reaction.count > 1" class="reaction-count">{{ reaction.count }}</span>
      </div>
    </div>

    <!-- Add Reaction Button -->
    <div v-if="showAddButton" class="add-reaction-btn" @click="openReactionPicker">
      <van-icon name="smile-o" :size="20" />
    </div>

    <!-- Reaction Picker Bottom Sheet -->
    <van-popup v-model:show="showPicker" position="bottom" :style="{ height: '70%', borderRadius: '16px 16px 0 0' }">
      <div class="reaction-picker-popup">
        <!-- Handle bar -->
        <div class="handle-bar"></div>

        <!-- Header -->
        <div class="picker-header">
          <span>{{ t('reaction.addReaction') }}</span>
          <van-icon name="cross" :size="20" @click="showPicker = false" />
        </div>

        <!-- Content -->
        <div class="reaction-picker-content">
          <!-- Category Tabs -->
          <div class="category-tabs">
            <div
              v-for="category in categories"
              :key="category.name"
              class="category-tab"
              :class="{ active: activeCategory === category.name }"
              @click="activeCategory = category.name">
              {{ category.name }}
            </div>
          </div>

          <!-- Emoji Grid -->
          <div class="emoji-grid">
            <div
              v-for="emoji in currentEmojis"
              :key="emoji"
              class="emoji-item"
              :class="{ 'has-reaction': hasUserReactionLocal(emoji) }"
              @click="selectEmoji(emoji)">
              <span class="emoji">{{ emoji }}</span>
              <div v-if="hasUserReactionLocal(emoji)" class="check-indicator">
                <van-icon name="success" :size="12" />
              </div>
            </div>
          </div>

          <!-- Custom Emoji Input -->
          <div class="custom-input-section">
            <van-field
              v-model="customEmoji"
              :placeholder="t('reaction.custom')"
              :maxlength="4"
              @keyup.enter="selectEmoji(customEmoji)">
              <template #button>
                <van-button
                  type="primary"
                  size="small"
                  :disabled="!customEmoji.trim()"
                  @click="selectEmoji(customEmoji)">
                  {{ t('common.add') }}
                </van-button>
              </template>
            </van-field>
          </div>

          <!-- User's Reactions -->
          <div v-if="userReactions.length > 0" class="user-reactions-section">
            <div class="section-title">{{ t('reaction.yourReactions') }}</div>
            <div class="user-reactions-list">
              <div v-for="emoji in userReactions" :key="emoji" class="user-reaction-item" @click="selectEmoji(emoji)">
                <span class="emoji">{{ emoji }}</span>
                <van-icon name="cross" :size="16" />
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="picker-footer">
          <van-button block @click="showPicker = false">
            {{ t('common.close') }}
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-overlay">
      <van-loading size="20" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
// No imports needed from Naive UI - using Vant components
import { useMessageReactions } from '@/composables'
import { logger } from '@/utils/logger'

interface Props {
  roomId: string
  eventId: string
  showAddButton?: boolean
}

interface Emits {
  (e: 'reaction-added', reaction: string): void
  (e: 'reaction-removed', reaction: string): void
  (e: 'reaction-toggle', reaction: string, added: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  showAddButton: true
})

const emit = defineEmits<Emits>()
const { t } = useI18n()

// Use the shared composable
const { isLoading, reactionSummary, toggleReaction, getCategories, getPopularReactions } = useMessageReactions({
  roomId: props.roomId,
  eventId: props.eventId
})

// UI State
const showPicker = ref(false)
const activeCategory = ref('smileys')
const customEmoji = ref('')

// Get categories from composable
const categories = getCategories()

// Computed
const displayReactions = computed(() => {
  if (!reactionSummary.value) return []
  return Object.values(reactionSummary.value.reactions)
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
})

const currentEmojis = computed(() => {
  const category = categories.find((c) => c.name === activeCategory.value)
  return category?.reactions || getPopularReactions()
})

const userReactions = computed(() => {
  if (!reactionSummary.value) return []
  return displayReactions.value.filter((r) => r.userMarked).map((r) => r.key)
})

// Methods
const hasUserReactionLocal = (emoji: string): boolean => {
  if (!reactionSummary.value) return false
  return !!reactionSummary.value.reactions[emoji]?.userMarked
}

const handleToggleReaction = async (reaction: string) => {
  try {
    await toggleReaction(props.eventId, reaction)
    emit('reaction-toggle', reaction, hasUserReactionLocal(reaction))
    if (hasUserReactionLocal(reaction)) {
      emit('reaction-added', reaction)
    } else {
      emit('reaction-removed', reaction)
    }
  } catch (error) {
    logger.error('[MobileReactions] Failed to toggle reaction:', error)
  }
}

const openReactionPicker = () => {
  showPicker.value = true
}

const handlePickerClose = () => {
  customEmoji.value = ''
}

const selectEmoji = async (emoji: string) => {
  if (!emoji?.trim()) return

  showPicker.value = false
  customEmoji.value = ''
  await handleToggleReaction(emoji)
}

// Expose methods
defineExpose({
  refresh: () => toggleReaction(props.eventId, ''),
  toggleReaction: handleToggleReaction
})
</script>

<style scoped lang="scss">
.mobile-message-reactions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 0;
}

.reactions-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
}

.reaction-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;

  &:active {
    transform: scale(0.95);
  }

  &.user-reacted {
    background: rgba(24, 160, 88, 0.1);
    border-color: rgba(24, 160, 88, 0.3);
  }
}

.reaction-emoji {
  font-size: 18px;
  line-height: 1;
}

.reaction-count {
  font-size: 12px;
  color: var(--text-color-2);
  min-width: 14px;
  text-align: center;
  font-weight: 500;
}

.add-reaction-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--bg-color);
  border: 1px dashed var(--border-color);
  border-radius: 50%;
  cursor: pointer;
  color: var(--text-color-3);
  transition: all 0.2s;

  &:active {
    background: var(--item-hover-bg);
    transform: scale(0.95);
  }
}

.loading-overlay {
  display: flex;
  align-items: center;
  padding: 8px;
}

.reaction-picker-popup {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  margin: 8px auto;
  flex-shrink: 0;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;

  span:first-child {
    font-size: 16px;
    font-weight: 600;
    color: var(--hula-gray-900);
  }

  .van-icon {
    cursor: pointer;
    color: var(--hula-gray-700);
    padding: 8px;

    &:active {
      opacity: 0.6;
    }
  }
}

.reaction-picker-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.picker-footer {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.category-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 0;
  margin-bottom: 12px;

  &::-webkit-scrollbar {
    display: none;
  }
}

.category-tab {
  flex-shrink: 0;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  color: var(--text-color-2);
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s;

  &.active {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
  }

  &:active {
    transform: scale(0.95);
  }
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
  padding: 12px 0;
  max-height: 200px;
  overflow-y: auto;
}

.emoji-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  font-size: 24px;
  background: var(--bg-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:active {
    background: var(--item-hover-bg);
    transform: scale(0.9);
  }

  &.has-reaction {
    background: rgba(24, 160, 88, 0.1);

    .emoji {
      filter: brightness(1.1);
    }
  }

  .emoji {
    line-height: 1;
  }
}

.check-indicator {
  position: absolute;
  top: -2px;
  right: -2px;
  background: #18a058;
  color: white;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-input-section {
  padding: 12px 0;
  border-top: 1px solid var(--divider-color);
  margin-top: 12px;
}

.user-reactions-section {
  padding: 12px 0;
  border-top: 1px solid var(--divider-color);
  margin-top: 12px;

  .section-title {
    font-size: 13px;
    color: var(--text-color-3);
    margin-bottom: 8px;
  }
}

.user-reactions-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.user-reaction-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;

  &:active {
    background: var(--item-hover-bg);
    transform: scale(0.95);
  }

  .emoji {
    font-size: 18px;
  }

  .van-icon {
    color: var(--text-color-3);
  }
}

// Optimized touch targets
@media (pointer: coarse) {
  .reaction-chip,
  .add-reaction-btn,
  .emoji-item,
  .category-tab,
  .user-reaction-item {
    min-height: 44px;
    min-width: 44px;
  }
}
</style>
