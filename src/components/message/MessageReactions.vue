<template>
  <div class="message-reactions">
    <!-- Reactions List -->
    <div v-if="displayReactions.length > 0" class="reactions-list">
      <div
        v-for="reaction in displayReactions"
        :key="reaction.key"
        class="reaction-item"
        :class="{
          'user-reacted': reaction.userMarked,
          'reaction-compact': compactMode
        }"
        @click="handleToggleReaction(reaction.key)"
        :title="getReactionTooltip(reaction)">
        <span class="reaction-emoji">{{ reaction.key }}</span>
        <span v-if="!compactMode" class="reaction-count">{{ reaction.count }}</span>
      </div>
    </div>

    <!-- Add Reaction Button -->
    <div v-if="showAddButton" class="add-reaction-btn" @click="showReactionPicker = true">
      <Icon icon="mdi:emoticon-outline" size="16" />
      <span v-if="!compactMode">{{ t('reaction.add') }}</span>
    </div>

    <!-- Reaction Picker Modal -->
    <n-modal
      v-model:show="showReactionPicker"
      :mask-closable="true"
      preset="dialog"
      :title="t('reaction.addReaction')"
      class="reaction-picker-modal">
      <div class="reaction-picker">
        <!-- Category Tabs -->
        <div class="reaction-categories">
          <n-tabs v-model:value="activeCategory" type="segment">
            <n-tab-pane
              v-for="category in categories"
              :key="category.name"
              :name="category.name"
              :tab="category.name" />
          </n-tabs>
        </div>

        <!-- Reactions Grid -->
        <div class="reaction-grid">
          <div
            v-for="emoji in currentCategoryEmojis"
            :key="emoji"
            class="reaction-emoji-item"
            @click="handleSelectReaction(emoji)"
            :class="{ 'has-reaction': hasUserReactionLocal(emoji) }">
            <span class="emoji">{{ emoji }}</span>
            <div v-if="hasUserReactionLocal(emoji)" class="user-indicator">
              <Icon icon="mdi:check" size="12" />
            </div>
          </div>
        </div>

        <!-- Custom Input -->
        <div class="custom-reaction">
          <n-input
            v-model:value="customReaction"
            :placeholder="t('reaction.custom')"
            maxlength="10"
            @keyup.enter="handleSelectReaction(customReaction)">
            <template #suffix>
              <n-button
                size="small"
                type="primary"
                :disabled="!customReaction.trim()"
                @click="handleSelectReaction(customReaction)">
                {{ t('common.add') }}
              </n-button>
            </template>
          </n-input>
        </div>
      </div>
    </n-modal>

    <!-- Loading State -->
    <div v-if="isLoading" class="reactions-loading">
      <n-spin size="small" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NTabs, NTabPane, NInput, NButton, NSpin } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { useMessageReactions } from '@/composables'
import { logger } from '@/utils/logger'

interface Props {
  roomId: string
  eventId: string
  compactMode?: boolean
  showAddButton?: boolean
}

interface Emits {
  (e: 'reaction-added', reaction: string): void
  (e: 'reaction-removed', reaction: string): void
  (e: 'reaction-toggle', reaction: string, added: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  compactMode: false,
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
const showReactionPicker = ref(false)
const activeCategory = ref('表情')
const customReaction = ref('')

// Get categories from Matrix module
const categories = getCategories()

// Computed
const displayReactions = computed(() => {
  if (!reactionSummary.value) return []
  return Object.values(reactionSummary.value.reactions)
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
})

const currentCategoryEmojis = computed(() => {
  const category = categories.find((c) => c.name === activeCategory.value)
  return category?.reactions || getPopularReactions()
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
    logger.error('[MessageReactions] Failed to toggle reaction:', error)
  }
}

const handleSelectReaction = async (reaction: string) => {
  if (!reaction?.trim()) return

  showReactionPicker.value = false
  customReaction.value = ''
  await handleToggleReaction(reaction)
}

const getReactionTooltip = (reaction: { key: string; users?: string[] }): string => {
  const users = reaction.users || []
  const userNames = users
    .map((userId: string) => (userId.split(':')[0] || userId).replace('@', ''))
    .slice(0, 3)
    .join(', ')

  const moreCount = users.length > 3 ? users.length - 3 : 0
  const moreText = moreCount > 0 ? ` +${moreCount}` : ''

  return `${reaction.key} ${users.length}${moreText}: ${userNames}`
}

// Expose methods for parent components
defineExpose({
  refresh: () => toggleReaction(props.eventId, ''),
  toggleReaction: handleToggleReaction
})
</script>

<style scoped>
.reaction-picker-modal {
  width: 400px;
}

.message-reactions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.reactions-list {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.reaction-item {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  background: rgba(var(--hula-black-rgb), 0.05);
  border: 1px solid rgba(var(--hula-black-rgb), 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
  user-select: none;
}

.reaction-item:hover {
  background: rgba(var(--hula-black-rgb), 0.08);
  transform: translateY(-1px);
}

.reaction-item.user-reacted {
  background: rgba(var(--hula-info-rgb), 0.1);
  border-color: rgba(var(--hula-info-rgb), 0.3);
}

.reaction-compact {
  padding: 4px;
  min-width: 24px;
  justify-content: center;
}

.reaction-emoji {
  font-size: 14px;
  line-height: 1;
}

.reaction-count {
  font-size: 11px;
  color: var(--hula-gray-700);
  min-width: 12px;
  text-align: center;
}

.add-reaction-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(var(--hula-black-rgb), 0.03);
  border: 1px dashed rgba(var(--hula-black-rgb), 0.2);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
  color: var(--hula-gray-700);
}

.add-reaction-btn:hover {
  background: rgba(var(--hula-black-rgb), 0.06);
  border-color: rgba(var(--hula-black-rgb), 0.3);
  color: var(--hula-gray-900);
}

.reactions-loading {
  display: flex;
  align-items: center;
  padding: 8px;
}

.reaction-picker {
  padding: 16px 0;
}

.reaction-categories {
  margin-bottom: 16px;
}

.reaction-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  margin-bottom: 16px;
  max-height: 200px;
  overflow-y: auto;
}

.reaction-emoji-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid rgba(var(--hula-black-rgb), 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reaction-emoji-item:hover {
  background: rgba(var(--hula-black-rgb), 0.05);
  transform: scale(1.1);
}

.reaction-emoji-item.has-reaction {
  background: rgba(var(--hula-info-rgb), 0.1);
  border-color: rgba(var(--hula-info-rgb), 0.3);
}

.emoji {
  font-size: 20px;
  line-height: 1;
}

.user-indicator {
  position: absolute;
  top: -2px;
  right: -2px;
  background: var(--hula-brand-primary);
  color: white;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
}

.custom-reaction {
  padding: 0 16px;
}

/* Responsive design */
@media (max-width: 768px) {
  .reaction-grid {
    grid-template-columns: repeat(6, 1fr);
  }

  .reaction-emoji-item {
    width: 36px;
    height: 36px;
  }

  .emoji {
    font-size: 18px;
  }
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .reaction-item {
    background: rgba(var(--hula-white-rgb), 0.05);
    border-color: rgba(var(--hula-white-rgb), 0.1);
  }

  .reaction-item:hover {
    background: rgba(var(--hula-white-rgb), 0.08);
  }

  .add-reaction-btn {
    background: rgba(var(--hula-white-rgb), 0.03);
    border-color: rgba(var(--hula-white-rgb), 0.2);
    color: var(--hula-gray-400);
  }

  .add-reaction-btn:hover {
    background: rgba(var(--hula-white-rgb), 0.06);
    border-color: rgba(var(--hula-white-rgb), 0.3);
    color: var(--hula-gray-300);
  }
}
</style>
