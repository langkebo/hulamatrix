/** * EmojiReactionPicker - 快速表情反应选择器 * 用于消息快捷表情反应 */
<template>
  <div class="emoji-reaction-picker" :class="{ mobile: isMobile }">
    <div
      v-for="emoji in quickReactions"
      :key="emoji.name"
      class="reaction-item"
      :class="{ active: isActive(emoji) }"
      @click="handleReaction(emoji)">
      <img :src="emoji.url" :alt="emoji.label" :title="emoji.label" />
      <span v-if="showCount && (emoji.count ?? 0) > 0" class="reaction-count">{{ emoji.count ?? 0 }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

/**
 * 表情数据
 */
interface Emoji {
  name: string
  url: string
  label: string
  count?: number
}

/**
 * Props定义
 */
interface Props {
  /** 是否显示计数 */
  showCount?: boolean
  /** 已反应的表情列表 */
  activeReactions?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  showCount: true,
  activeReactions: () => []
})

const emit = defineEmits<{
  react: [emojiName: string]
  unreact: [emojiName: string]
}>()

/**
 * 快速反应表情（常用表情）
 */
const quickReactions = ref<Emoji[]>([
  { name: 'party-popper', url: '/emoji/party-popper.webp', label: '庆祝' },
  { name: 'fire', url: '/emoji/fire.webp', label: '火焰' },
  { name: 'rocket', url: '/emoji/rocket.webp', label: '火箭' },
  { name: 'bug', url: '/emoji/bug.webp', label: 'Bug' },
  { name: 'alien-monster', url: '/emoji/alien-monster.webp', label: '外星人' },
  { name: 'comet', url: '/emoji/comet.webp', label: '彗星' }
])

/**
 * 检测是否为移动端
 */
const isMobile = computed(() => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
})

/**
 * 检查表情是否已反应
 */
function isActive(emoji: Emoji): boolean {
  return props.activeReactions.includes(emoji.name)
}

/**
 * 处理表情反应
 */
function handleReaction(emoji: Emoji): void {
  if (isActive(emoji)) {
    emit('unreact', emoji.name)
  } else {
    emit('react', emoji.name)
  }
}

/**
 * 更新表情计数（供父组件调用）
 */
function updateCounts(counts: Record<string, number>): void {
  quickReactions.value = quickReactions.value.map((emoji) => ({
    ...emoji,
    count: counts[emoji.name] || 0
  }))
}

// 暴露方法供父组件调用
defineExpose({
  updateCounts
})
</script>

<style scoped>
.emoji-reaction-picker {
  display: flex;
  gap: var(--space-xs, 4px);
  padding: var(--space-sm, 8px);
  background: var(--pc-bg-elevated, var(--hula-brand-primary));
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--shadow-dark-md, 0 4px 12px rgba(0, 0, 0, 0.1));
}

.reaction-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: all 0.2s ease;
}

.reaction-item:hover {
  background: var(--pc-bg-hover, rgba(0, 0, 0, 0.05));
  transform: scale(1.1);
}

.reaction-item.active {
  background: var(--pc-accent-primary, var(--hula-brand-primary));
}

.reaction-item img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.reaction-count {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--pc-error, var(--hula-brand-primary));
  color: white;
  font-size: 10px;
  font-weight: var(--font-semibold, 600);
  border-radius: var(--radius-full, 9999px);
  border: 2px solid var(--pc-bg-elevated, var(--hula-brand-primary));
}

/* 移动端样式 */
@media (max-width: 768px) {
  .emoji-reaction-picker {
    background: var(--mobile-bg-secondary, var(--hula-brand-primary));
    box-shadow: 0 2px 8px rgba(0, 184, 148, 0.1);
  }

  .reaction-item {
    width: 40px;
    height: 40px;
  }

  .reaction-item img {
    width: 28px;
    height: 28px;
  }
}
</style>
