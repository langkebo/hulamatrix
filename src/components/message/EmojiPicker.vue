import { msg } from '@/utils/SafeUI'
<template>
  <div class="emoji-picker" :class="{ 'is-inline': inline }">
    <!-- 搜索栏 -->
    <div class="emoji-search">
      <n-input
        v-model:value="searchQuery"
        placeholder="搜索表情..."
        size="small"
        clearable
        @input="searchEmojis"
      >
        <template #prefix>
          <n-icon><Search /></n-icon>
        </template>
      </n-input>
    </div>

    <!-- 分类标签 -->
    <div class="emoji-categories">
      <div
        v-for="category in categories"
        :key="category.id"
        class="category-tab"
        :class="{ active: activeCategory === category.id }"
        @click="selectCategory(category.id)"
      >
        <span class="category-icon">{{ category.icon }}</span>
        <span class="category-name">{{ category.name }}</span>
      </div>
    </div>

    <!-- 表情网格 -->
    <div class="emoji-grid" ref="emojiGridRef">
      <div
        v-for="emoji in filteredEmojis"
        :key="emoji.unicode"
        class="emoji-item"
        :class="{ 'is-recent': isRecentEmoji(emoji.unicode) }"
        @click="selectEmoji(emoji)"
        @mouseenter="(event) => showEmojiInfo(emoji, event)"
        @mouseleave="hideEmojiInfo"
      >
        <span class="emoji-char">{{ emoji.unicode }}</span>
        <div v-if="emoji.shortcodes && emoji.shortcodes.length > 0" class="emoji-shortcode">
          :{{ emoji.shortcodes[0] }}:
        </div>
      </div>
    </div>

    <!-- 皮肤选择 -->
    <div class="emoji-skin-tones">
      <span class="skin-tones-label">肤色:</span>
      <div class="skin-tones-selector">
        <div
          v-for="tone in skinTones"
          :key="tone.value"
          class="skin-tone"
          :class="{ active: selectedSkinTone === tone.value }"
          :style="{ backgroundColor: tone.color }"
          @click="selectSkinTone(tone.value)"
        >
          <span>{{ tone.preview }}</span>
        </div>
      </div>
    </div>

    <!-- 浮动提示 -->
    <div
      v-if="hoveredEmoji"
      class="emoji-tooltip"
      :style="tooltipStyle"
    >
      <div class="tooltip-content">
        <div class="emoji-preview">{{ hoveredEmoji.unicode }}</div>
        <div class="emoji-details">
          <div class="emoji-name">{{ hoveredEmoji.name }}</div>
          <div v-if="hoveredEmoji.shortcodes && hoveredEmoji.shortcodes.length > 0" class="emoji-shortcodes">
            {{ hoveredEmoji.shortcodes.join(', ') }}
          </div>
        </div>
      </div>
      <div class="tooltip-actions">
        <n-button size="tiny" quaternary @click="addToFavorites(hoveredEmoji)">
          <template #icon>
            <n-icon>
              <Heart v-if="isFavoriteEmoji(hoveredEmoji.unicode)" />
              <HeartBroken v-else />
            </n-icon>
          </template>
        </n-button>
        <n-button size="tiny" quaternary @click="copyEmoji(hoveredEmoji)">
          <template #icon>
            <n-icon><Copy /></n-icon>
          </template>
        </n-button>
      </div>
    </div>

    <!-- 最近使用 -->
    <div v-if="activeCategory === 'recent' && recentEmojis.length === 0" class="empty-state">
      <n-empty description="暂无最近使用的表情">
        <template #icon>
          <n-icon size="48"><Clock /></n-icon>
        </template>
      </n-empty>
    </div>

    <!-- 收藏表情 -->
    <div v-if="activeCategory === 'favorites' && favoriteEmojis.length === 0" class="empty-state">
      <n-empty description="暂无收藏的表情">
        <template #icon>
          <n-icon size="48"><Heart /></n-icon>
        </template>
      </n-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NInput, NIcon, NButton, NEmpty } from 'naive-ui'
import { Search } from '@vicons/tabler'
import { msg } from '@/utils/SafeUI'

interface Props {
  inline?: boolean
}

interface Emoji {
  unicode: string
  name: string
  category: string
  shortcodes?: string[]
  keywords?: string[]
  hasSkinTone?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  inline: false
})

const emit = defineEmits<{
  select: [emoji: string]
  close: []
}>()

const message = msg

// 状态管理
const searchQuery = ref('')
const activeCategory = ref('smileys')
const selectedSkinTone = ref('default')
const hoveredEmoji = ref<Emoji | null>(null)
const tooltipStyle = ref({})

// 引用
const emojiGridRef = ref()

// 数据
const categories = ref([
  { id: 'recent', name: '最近', icon: '🕐' },
  { id: 'favorites', name: '收藏', icon: '❤️' },
  { id: 'smileys', name: '笑脸', icon: '😊' },
  { id: 'people', name: '人物', icon: '👤' },
  { id: 'animals', name: '动物', icon: '🐾' },
  { id: 'food', name: '食物', icon: '🍔' },
  { id: 'activities', name: '活动', icon: '⚽' },
  { id: 'travel', name: '旅行', icon: '🚗' },
  { id: 'objects', name: '物品', icon: '💡' },
  { id: 'symbols', name: '符号', icon: '❗' },
  { id: 'flags', name: '旗帜', icon: '🏳️' }
])

const skinTones = ref([
  { value: 'default', color: '#FDBCB4', preview: '👋' },
  { value: 'light', color: '#FFDDA1', preview: '👋🏻' },
  { value: 'medium-light', color: '#F5DEB3', preview: '👋🏼' },
  { value: 'medium', color: '#F4C2A1', preview: '👋🏽' },
  { value: 'medium-dark', color: '#E5B887', preview: '👋🏾' },
  { value: 'dark', color: '#C88B5A', preview: '👋🏿' }
])

const allEmojis = ref<Emoji[]>([])
const recentEmojis = ref<string[]>([])
const favoriteEmojis = ref<string[]>([])

// 计算属性
const filteredEmojis = computed(() => {
  let emojis = allEmojis.value

  // 按分类筛选
  if (activeCategory.value === 'recent') {
    emojis = emojis.filter((emoji) => recentEmojis.value.includes(emoji.unicode))
  } else if (activeCategory.value === 'favorites') {
    emojis = emojis.filter((emoji) => favoriteEmojis.value.includes(emoji.unicode))
  } else {
    emojis = emojis.filter((emoji) => emoji.category === activeCategory.value)
  }

  // 按搜索查询筛选
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    emojis = emojis.filter((emoji) => {
      return (
        emoji.name.toLowerCase().includes(query) ||
        emoji.shortcodes?.some((code) => code.toLowerCase().includes(query)) ||
        emoji.keywords?.some((keyword) => keyword.toLowerCase().includes(query))
      )
    })
  }

  return emojis
})

// ========== 方法 ==========

const loadEmojis = async () => {
  // 模拟加载表情数据
  allEmojis.value = [
    // 笑脸表情
    { unicode: '😀', name: 'grinning face', category: 'smileys', shortcodes: ['grinning'] },
    { unicode: '😃', name: 'grinning face with big eyes', category: 'smileys', shortcodes: ['smiley'] },
    { unicode: '😄', name: 'grinning face with smiling eyes', category: 'smileys', shortcodes: ['smile'] },
    { unicode: '😁', name: 'beaming face with smiling eyes', category: 'smileys', shortcodes: ['grin'] },
    { unicode: '😅', name: 'grinning face with sweat', category: 'smileys', shortcodes: ['sweat_smile'] },
    { unicode: '😂', name: 'face with tears of joy', category: 'smileys', shortcodes: ['joy'] },
    { unicode: '🤣', name: 'rolling on the floor laughing', category: 'smileys', shortcodes: ['rofl'] },
    { unicode: '😊', name: 'smiling face with smiling eyes', category: 'smileys', shortcodes: ['blush'] },
    { unicode: '😇', name: 'smiling face with halo', category: 'smileys', shortcodes: ['innocent'] },
    { unicode: '🙂', name: 'slightly smiling face', category: 'smileys', shortcodes: ['slightly_smiling_face'] },
    { unicode: '😉', name: 'winking face', category: 'smileys', shortcodes: ['wink'] },
    { unicode: '😌', name: 'relieved face', category: 'smileys', shortcodes: ['relieved'] },
    { unicode: '😍', name: 'heart eyes', category: 'smileys', shortcodes: ['heart_eyes'] },
    { unicode: '🥰', name: 'smiling face with hearts', category: 'smileys', shortcodes: ['smiling_face_with_hearts'] },
    { unicode: '😘', name: 'face blowing a kiss', category: 'smileys', shortcodes: ['kissing_heart'] },
    { unicode: '😗', name: 'kissing face', category: 'smileys', shortcodes: ['kissing'] },
    {
      unicode: '😙',
      name: 'kissing face with smiling eyes',
      category: 'smileys',
      shortcodes: ['kissing_smiling_eyes']
    },
    { unicode: '😚', name: 'kissing face with closed eyes', category: 'smileys', shortcodes: ['kissing_closed_eyes'] },
    { unicode: '😋', name: 'face savoring food', category: 'smileys', shortcodes: ['yum'] },
    { unicode: '😛', name: 'face with tongue', category: 'smileys', shortcodes: ['stuck_out_tongue'] },
    {
      unicode: '😜',
      name: 'winking face with tongue',
      category: 'smileys',
      shortcodes: ['stuck_out_tongue_winking_eye']
    },
    { unicode: '🤪', name: 'zany face', category: 'smileys', shortcodes: ['zany_face'] },
    {
      unicode: '😝',
      name: 'squinting face with tongue',
      category: 'smileys',
      shortcodes: ['stuck_out_tongue_closed_eyes']
    },
    { unicode: '🤗', name: 'hugging face', category: 'smileys', shortcodes: ['hugging'] },
    {
      unicode: '🤭',
      name: 'face with hand over mouth',
      category: 'smileys',
      shortcodes: ['face_with_hand_over_mouth']
    },
    { unicode: '🤫', name: 'shushing face', category: 'smileys', shortcodes: ['shushing_face'] },
    { unicode: '🤔', name: 'thinking face', category: 'smileys', shortcodes: ['thinking'] },

    // 手势表情
    { unicode: '👋', name: 'waving hand', category: 'people', shortcodes: ['wave'], hasSkinTone: true },
    { unicode: '👍', name: 'thumbs up', category: 'people', shortcodes: ['+1', 'thumbsup'], hasSkinTone: true },
    { unicode: '👎', name: 'thumbs down', category: 'people', shortcodes: ['-1', 'thumbsdown'], hasSkinTone: true },
    { unicode: '👌', name: 'ok hand', category: 'people', shortcodes: ['ok_hand'], hasSkinTone: true },
    { unicode: '✌️', name: 'victory hand', category: 'people', shortcodes: ['v'], hasSkinTone: true },
    { unicode: '🤞', name: 'crossed fingers', category: 'people', shortcodes: ['crossed_fingers'], hasSkinTone: true },
    {
      unicode: '🤟',
      name: 'love-you gesture',
      category: 'people',
      shortcodes: ['love_you_gesture'],
      hasSkinTone: true
    },
    { unicode: '🤘', name: 'sign of the horns', category: 'people', shortcodes: ['metal'], hasSkinTone: true },
    { unicode: '👏', name: 'clapping hands', category: 'people', shortcodes: ['clap'], hasSkinTone: true },
    { unicode: '🙌', name: 'raising hands', category: 'people', shortcodes: ['raised_hands'], hasSkinTone: true },
    { unicode: '👐', name: 'open hands', category: 'people', shortcodes: ['open_hands'], hasSkinTone: true },
    {
      unicode: '🤲',
      name: 'palms up together',
      category: 'people',
      shortcodes: ['palms_up_together'],
      hasSkinTone: true
    },

    // 心形表情
    { unicode: '❤️', name: 'red heart', category: 'symbols', shortcodes: ['heart'] },
    { unicode: '🧡', name: 'orange heart', category: 'symbols', shortcodes: ['orange_heart'] },
    { unicode: '💛', name: 'yellow heart', category: 'symbols', shortcodes: ['yellow_heart'] },
    { unicode: '💚', name: 'green heart', category: 'symbols', shortcodes: ['green_heart'] },
    { unicode: '💙', name: 'blue heart', category: 'symbols', shortcodes: ['blue_heart'] },
    { unicode: '💜', name: 'purple heart', category: 'symbols', shortcodes: ['purple_heart'] },
    { unicode: '🖤', name: 'black heart', category: 'symbols', shortcodes: ['black_heart'] },
    { unicode: '🤍', name: 'white heart', category: 'symbols', shortcodes: ['white_heart'] },
    { unicode: '🤎', name: 'brown heart', category: 'symbols', shortcodes: ['brown_heart'] },
    { unicode: '💔', name: 'broken heart', category: 'symbols', shortcodes: ['broken_heart'] },
    { unicode: '❣️', name: 'exclamation heart', category: 'symbols', shortcodes: ['exclamation_heart'] },
    { unicode: '💕', name: 'two hearts', category: 'symbols', shortcodes: ['two_hearts'] },
    { unicode: '💞', name: 'revolving hearts', category: 'symbols', shortcodes: ['revolving_hearts'] },
    { unicode: '💓', name: 'beating heart', category: 'symbols', shortcodes: ['heartbeat'] },
    { unicode: '💗', name: 'growing heart', category: 'symbols', shortcodes: ['heartpulse'] },
    { unicode: '💖', name: 'sparkling heart', category: 'symbols', shortcodes: ['sparkling_heart'] }
  ]
}

const loadUserData = () => {
  // 加载最近使用的表情
  const recent = localStorage.getItem('recent-emojis')
  if (recent) {
    recentEmojis.value = JSON.parse(recent)
  }

  // 加载收藏的表情
  const favorites = localStorage.getItem('favorite-emojis')
  if (favorites) {
    favoriteEmojis.value = JSON.parse(favorites)
  }

  // 加载肤色设置
  const skinTone = localStorage.getItem('selected-skin-tone')
  if (skinTone) {
    selectedSkinTone.value = skinTone
  }
}

const saveUserData = () => {
  localStorage.setItem('recent-emojis', JSON.stringify(recentEmojis.value))
  localStorage.setItem('favorite-emojis', JSON.stringify(favoriteEmojis.value))
  localStorage.setItem('selected-skin-tone', selectedSkinTone.value)
}

const searchEmojis = () => {
  // 搜索功能已在计算属性中处理
}

const selectCategory = (categoryId: string) => {
  activeCategory.value = categoryId
}

const selectEmoji = (emoji: Emoji) => {
  let emojiChar = emoji.unicode

  // 应用肤色设置
  if (emoji.hasSkinTone && selectedSkinTone.value !== 'default') {
    emojiChar = applySkinTone(emoji.unicode, selectedSkinTone.value)
  }

  // 添加到最近使用
  addToRecent(emoji.unicode)

  // 触发选择事件
  emit('select', emojiChar)

  // 如果是内联模式，选择后关闭
  if (props.inline) {
    emit('close')
  }
}

const addToRecent = (emoji: string) => {
  // 移除重复项
  const index = recentEmojis.value.indexOf(emoji)
  if (index > -1) {
    recentEmojis.value.splice(index, 1)
  }

  // 添加到开头
  recentEmojis.value.unshift(emoji)

  // 限制数量
  if (recentEmojis.value.length > 50) {
    recentEmojis.value = recentEmojis.value.slice(0, 50)
  }

  saveUserData()
}

const addToFavorites = (emoji: Emoji) => {
  const index = favoriteEmojis.value.indexOf(emoji.unicode)
  if (index > -1) {
    favoriteEmojis.value.splice(index, 1)
    message.success('已从收藏中移除')
  } else {
    favoriteEmojis.value.push(emoji.unicode)
    message.success('已添加到收藏')
  }
  saveUserData()
}

const copyEmoji = async (emoji: Emoji) => {
  try {
    await navigator.clipboard.writeText(emoji.unicode)
    message.success('表情已复制到剪贴板')
  } catch (error) {
    message.error('复制失败')
  }
}

const selectSkinTone = (tone: string) => {
  selectedSkinTone.value = tone
  saveUserData()
}

const applySkinTone = (emoji: string, tone: string): string => {
  // 这里需要根据不同的表情和肤色来调整
  // 简化的实现，实际需要更复杂的映射
  const skinToneMap: Record<string, string> = {
    light: '🏻',
    'medium-light': '🏼',
    medium: '🏽',
    'medium-dark': '🏾',
    dark: '🏿'
  }

  // 对于手势类表情，可以应用肤色修饰符
  if (['👋', '👍', '👎', '👌', '👏', '🙌'].includes(emoji)) {
    return emoji + (skinToneMap[tone] || '')
  }

  return emoji
}

const showEmojiInfo = (emoji: Emoji, event: MouseEvent) => {
  hoveredEmoji.value = emoji

  // 计算提示框位置
  const rect = (event.target as HTMLElement).getBoundingClientRect()
  tooltipStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 8}px`,
    left: `${rect.left}px`,
    zIndex: 1000
  }
}

const hideEmojiInfo = () => {
  hoveredEmoji.value = null
}

const isRecentEmoji = (emoji: string): boolean => {
  return recentEmojis.value.includes(emoji)
}

const isFavoriteEmoji = (emoji: string): boolean => {
  return favoriteEmojis.value.includes(emoji)
}

// ========== 生命周期 ==========

onMounted(() => {
  loadEmojis()
  loadUserData()
})
</script>

<style lang="scss" scoped>
.emoji-picker {
  background: var(--card-color);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  max-width: 400px;
  max-height: 500px;
  display: flex;
  flex-direction: column;
  position: relative;

  &.is-inline {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    max-height: 400px;
  }

  .emoji-search {
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .emoji-categories {
    display: flex;
    padding: 8px 12px;
    gap: 4px;
    border-bottom: 1px solid var(--border-color);
    overflow-x: auto;

    .category-tab {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
      flex-shrink: 0;

      &:hover {
        background: var(--bg-color-hover);
      }

      &.active {
        background: var(--primary-color);
        color: white;
      }

      .category-icon {
        font-size: 16px;
      }

      .category-name {
        font-size: 12px;
        font-weight: 500;
      }
    }
  }

  .emoji-grid {
    flex: 1;
    padding: 12px;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
    gap: 4px;

    .emoji-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 8px 4px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;

      &:hover {
        background: var(--bg-color-hover);
        transform: scale(1.1);
      }

      &.is-recent::after {
        content: '';
        position: absolute;
        top: 2px;
        right: 2px;
        width: 6px;
        height: 6px;
        background: var(--primary-color);
        border-radius: 50%;
      }

      .emoji-char {
        font-size: 24px;
        line-height: 1;
      }

      .emoji-shortcode {
        font-size: 10px;
        color: var(--text-color-3);
        text-align: center;
        margin-top: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        width: 100%;
      }
    }
  }

  .emoji-skin-tones {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid var(--border-color);

    .skin-tones-label {
      font-size: 12px;
      color: var(--text-color-2);
      font-weight: 500;
    }

    .skin-tones-selector {
      display: flex;
      gap: 4px;

      .skin-tone {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border: 2px solid transparent;
        transition: all 0.2s ease;

        &:hover {
          transform: scale(1.1);
        }

        &.active {
          border-color: var(--primary-color);
        }

        span {
          font-size: 16px;
        }
      }
    }
  }

  .emoji-tooltip {
    background: var(--card-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
    padding: 12px;
    min-width: 200px;
    z-index: 1000;

    .tooltip-content {
      display: flex;
      gap: 12px;
      align-items: flex-start;

      .emoji-preview {
        font-size: 32px;
        line-height: 1;
      }

      .emoji-details {
        flex: 1;

        .emoji-name {
          font-weight: 600;
          color: var(--text-color-1);
          margin-bottom: 4px;
        }

        .emoji-shortcodes {
          font-size: 12px;
          color: var(--text-color-3);
          font-family: monospace;
        }
      }
    }

    .tooltip-actions {
      display: flex;
      gap: 4px;
      margin-top: 8px;
      justify-content: flex-end;
    }
  }

  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
  }
}

// 响应式设计
@media (max-width: 480px) {
  .emoji-picker {
    max-width: 100vw;
    max-height: 70vh;

    .emoji-grid {
      grid-template-columns: repeat(auto-fill, minmax(32px, 1fr));
    }

    .emoji-categories {
      .category-name {
        display: none;
      }
    }
  }
}
</style>
