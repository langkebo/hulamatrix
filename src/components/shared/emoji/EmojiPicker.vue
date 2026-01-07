/** * EmojiPicker - 表情选择器组件 * 使用 public/emoji/ 目录下的自定义表情 */
<template>
  <div class="emoji-picker" :class="{ mobile: isMobile }">
    <!-- 搜索框 -->
    <div v-if="showSearch" class="emoji-search">
      <n-input v-model:value="searchQuery" placeholder="搜索表情..." size="small" clearable @input="handleSearch">
        <template #prefix>
          <n-icon><SearchIcon /></n-icon>
        </template>
      </n-input>
    </div>

    <!-- 分类标签 -->
    <div v-if="showCategories" class="emoji-categories">
      <div
        v-for="category in categories"
        :key="category.id"
        class="category-tab"
        :class="{ active: activeCategory === category.id }"
        @click="setCategory(category.id)">
        <img :src="category.icon" :alt="category.name" class="category-icon" />
        <span class="category-name">{{ category.name }}</span>
      </div>
    </div>

    <!-- 表情网格 -->
    <div class="emoji-grid">
      <div
        v-for="emoji in filteredEmojis"
        :key="emoji.name"
        class="emoji-item"
        :class="{ selected: isSelected(emoji) }"
        @click="selectEmoji(emoji)"
        @mouseenter="handleHover(emoji)">
        <img :src="emoji.url" :alt="emoji.name" class="emoji-img" loading="lazy" />
        <span v-if="showLabels" class="emoji-label">{{ emoji.label }}</span>
      </div>
    </div>

    <!-- 最近使用 -->
    <div v-if="showRecent && recentEmojis.length > 0" class="emoji-recent">
      <div class="recent-header">
        <span class="recent-title">最近使用</span>
        <n-button text size="tiny" @click="clearRecent">清除</n-button>
      </div>
      <div class="recent-grid">
        <div v-for="emoji in recentEmojis" :key="emoji.name" class="recent-item" @click="selectEmoji(emoji)">
          <img :src="emoji.url" :alt="emoji.name" />
        </div>
      </div>
    </div>

    <!-- 预览浮层 -->
    <transition name="fade">
      <div v-if="hoveredEmoji && showPreview" class="emoji-preview">
        <img :src="hoveredEmoji.url" :alt="hoveredEmoji.name" />
        <span class="preview-label">{{ hoveredEmoji.label }}</span>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NInput, NButton, NIcon } from 'naive-ui'
import { EmojiLoader } from '@/utils/assetLoader'

/**
 * 表情数据
 */
interface Emoji {
  name: string
  url: string
  label: string
  category: string
}

/**
 * 表情分类
 */
interface EmojiCategory {
  id: string
  name: string
  icon: string
}

/**
 * Props定义
 */
interface Props {
  /** 是否显示搜索框 */
  showSearch?: boolean
  /** 是否显示分类 */
  showCategories?: boolean
  /** 是否显示标签 */
  showLabels?: boolean
  /** 是否显示最近使用 */
  showRecent?: boolean
  /** 是否显示预览 */
  showPreview?: boolean
  /** 最大最近数量 */
  maxRecent?: number
}

const props = withDefaults(defineProps<Props>(), {
  showSearch: true,
  showCategories: true,
  showLabels: false,
  showRecent: true,
  showPreview: true,
  maxRecent: 10
})

const emit = defineEmits<{
  select: [emoji: Emoji]
  close: []
}>()

/**
 * 所有可用的表情
 */
const allEmojis: Emoji[] = [
  // 兴趣与活动
  { name: 'party-popper', url: '/emoji/party-popper.webp', label: '庆祝', category: 'activity' },
  { name: 'rocket', url: '/emoji/rocket.webp', label: '火箭', category: 'activity' },
  { name: 'test-tube', url: '/emoji/test-tube.webp', label: '实验', category: 'activity' },

  // 动物与自然
  { name: 'alien-monster', url: '/emoji/alien-monster.webp', label: '外星人', category: 'nature' },
  { name: 'bug', url: '/emoji/bug.webp', label: '虫子', category: 'nature' },
  { name: 'comet', url: '/emoji/comet.webp', label: '彗星', category: 'nature' },
  { name: 'fire', url: '/emoji/fire.webp', label: '火焰', category: 'nature' },

  // 物品
  { name: 'gear', url: '/emoji/gear.webp', label: '齿轮', category: 'objects' },
  { name: 'hammer-and-wrench', url: '/emoji/hammer-and-wrench.webp', label: '工具', category: 'objects' },
  { name: 'lipstick', url: '/emoji/lipstick.webp', label: '口红', category: 'objects' },
  { name: 'memo', url: '/emoji/memo.webp', label: '备忘录', category: 'objects' },
  { name: 'package', url: '/emoji/package.webp', label: '包裹', category: 'objects' },
  { name: 'recycling-symbol', url: '/emoji/recycling-symbol.webp', label: '回收', category: 'objects' },
  { name: 'right-arrow-curving-left', url: '/emoji/right-arrow-curving-left.webp', label: '返回', category: 'objects' }
]

/**
 * 表情分类
 */
const categories: EmojiCategory[] = [
  { id: 'all', name: '全部', icon: '/emoji/party-popper.webp' },
  { id: 'activity', name: '活动', icon: '/emoji/rocket.webp' },
  { id: 'nature', name: '自然', icon: '/emoji/bug.webp' },
  { id: 'objects', name: '物品', icon: '/emoji/gear.webp' }
]

const searchQuery = ref('')
const activeCategory = ref('all')
const hoveredEmoji = ref<Emoji | null>(null)
const recentEmojis = ref<Emoji[]>([])
const selectedEmoji = ref<Emoji | null>(null)

/**
 * 检测是否为移动端
 */
const isMobile = computed(() => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
})

/**
 * 根据搜索和分类过滤表情
 */
const filteredEmojis = computed(() => {
  let emojis = allEmojis

  // 分类过滤
  if (activeCategory.value !== 'all') {
    emojis = emojis.filter((e) => e.category === activeCategory.value)
  }

  // 搜索过滤
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    emojis = emojis.filter((e) => e.name.toLowerCase().includes(query) || e.label.toLowerCase().includes(query))
  }

  return emojis
})

/**
 * 设置分类
 */
function setCategory(categoryId: string): void {
  activeCategory.value = categoryId
}

/**
 * 选择表情
 */
function selectEmoji(emoji: Emoji): void {
  selectedEmoji.value = emoji
  emit('select', emoji)

  // 添加到最近使用
  addToRecent(emoji)
}

/**
 * 是否选中
 */
function isSelected(emoji: Emoji): boolean {
  return selectedEmoji.value?.name === emoji.name
}

/**
 * 鼠标悬停
 */
function handleHover(emoji: Emoji): void {
  if (props.showPreview) {
    hoveredEmoji.value = emoji
  }
}

/**
 * 搜索处理
 */
function handleSearch(): void {
  // 搜索是响应式的，不需要额外处理
}

/**
 * 添加到最近使用
 */
function addToRecent(emoji: Emoji): void {
  const existing = recentEmojis.value.findIndex((e) => e.name === emoji.name)

  if (existing !== -1) {
    recentEmojis.value.splice(existing, 1)
  }

  recentEmojis.value.unshift(emoji)

  // 限制数量
  if (recentEmojis.value.length > props.maxRecent) {
    recentEmojis.value = recentEmojis.value.slice(0, props.maxRecent)
  }

  // 保存到localStorage
  saveRecent()
}

/**
 * 清除最近使用
 */
function clearRecent(): void {
  recentEmojis.value = []
  saveRecent()
}

/**
 * 保存最近使用到localStorage
 */
function saveRecent(): void {
  try {
    const names = recentEmojis.value.map((e) => e.name)
    localStorage.setItem('emoji-recent', JSON.stringify(names))
  } catch {
    // 忽略错误
  }
}

/**
 * 从localStorage加载最近使用
 */
function loadRecent(): void {
  try {
    const saved = localStorage.getItem('emoji-recent')
    if (saved) {
      const names = JSON.parse(saved) as string[]
      recentEmojis.value = names
        .map((name) => allEmojis.find((e) => e.name === name))
        .filter((e): e is Emoji => e !== undefined)
    }
  } catch {
    // 忽略错误
  }
}

/**
 * 预加载表情资源
 */
async function preloadEmojis(): Promise<void> {
  try {
    await EmojiLoader.preloadEmojis()
  } catch (error) {
    console.warn('Failed to preload emojis:', error)
  }
}

onMounted(() => {
  loadRecent()
  preloadEmojis()
})

// SearchIcon component (简单SVG图标)
const SearchIcon = {
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>
  `
}
</script>

<style scoped>
.emoji-picker {
  position: relative;
  background: var(--pc-bg-elevated, #ffffff);
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--shadow-dark-lg, 0 8px 24px rgba(0, 0, 0, 0.15));
  padding: var(--space-md, 16px);
  max-width: 360px;
  width: 100%;
}

/* 移动端样式 */
.emoji-picker.mobile {
  max-width: 100%;
  border-radius: var(--radius-lg, 12px) var(--radius-lg, 12px) 0 0;
}

/* 搜索框 */
.emoji-search {
  margin-bottom: var(--space-md, 16px);
}

/* 分类标签 */
.emoji-categories {
  display: flex;
  gap: var(--space-sm, 8px);
  margin-bottom: var(--space-md, 16px);
  overflow-x: auto;
  padding-bottom: var(--space-xs, 4px);
}

.category-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs, 4px);
  padding: var(--space-sm, 8px);
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.category-tab:hover {
  background: var(--pc-bg-hover, rgba(0, 0, 0, 0.05));
}

.category-tab.active {
  background: var(--pc-accent-primary, #00bfa5);
}

.category-tab.active .category-name {
  color: white;
}

.category-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.category-name {
  font-size: var(--font-xs, 12px);
  color: var(--pc-text-secondary, #666);
}

/* 表情网格 */
.emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: var(--space-sm, 8px);
  max-height: 200px;
  overflow-y: auto;
}

.emoji-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs, 4px);
  padding: var(--space-sm, 8px);
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: all 0.2s ease;
}

.emoji-item:hover {
  background: var(--pc-bg-hover, rgba(0, 0, 0, 0.05));
  transform: scale(1.1);
}

.emoji-item.selected {
  background: var(--pc-accent-primary, #00bfa5);
}

.emoji-img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.emoji-label {
  font-size: var(--font-xs, 10px);
  color: var(--pc-text-secondary, #666);
  text-align: center;
}

/* 最近使用 */
.emoji-recent {
  margin-top: var(--space-md, 16px);
  padding-top: var(--space-md, 16px);
  border-top: 1px solid var(--pc-border, #e0e0e0);
}

.recent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-sm, 8px);
}

.recent-title {
  font-size: var(--font-sm, 14px);
  font-weight: var(--font-medium, 500);
  color: var(--pc-text-primary, #333);
}

.recent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
  gap: var(--space-sm, 8px);
}

.recent-item {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-xs, 4px);
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: all 0.2s ease;
}

.recent-item:hover {
  background: var(--pc-bg-hover, rgba(0, 0, 0, 0.05));
}

.recent-item img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

/* 预览浮层 */
.emoji-preview {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs, 4px);
  padding: var(--space-sm, 8px);
  background: var(--pc-bg-elevated, #ffffff);
  border-radius: var(--radius-md, 8px);
  box-shadow: var(--shadow-dark-md, 0 4px 12px rgba(0, 0, 0, 0.15));
  margin-bottom: var(--space-sm, 8px);
  z-index: 10;
}

.emoji-preview img {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.preview-label {
  font-size: var(--font-sm, 14px);
  color: var(--pc-text-primary, #333);
}

/* 动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .emoji-picker {
    background: var(--mobile-bg-secondary, #ffffff);
    box-shadow: 0 -2px 8px rgba(0, 184, 148, 0.1);
  }

  .emoji-grid {
    grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
    max-height: 180px;
  }

  .category-name {
    font-size: 10px;
  }

  .category-icon {
    width: 20px;
    height: 20px;
  }
}
</style>
