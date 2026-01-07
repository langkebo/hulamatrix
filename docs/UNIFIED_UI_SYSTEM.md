# HuLa Matrix 统一UI系统设计方案 4.0

> **核心理念**：打造一套统一、美观、功能完善的UI系统，PC端和移动端共享设计语言和组件库
> **设计原则**：Single Source of Truth - 一套设计系统，双端适配实现
> **参考设计**：preview/img2-*.webp (PC) | preview/img3-*.webp (Mobile)
> **资源基础**：public/ 目录下的所有静态资源

生成时间: 2026-01-07
版本: 4.0 (统一设计系统)

---

## 📋 目录

1. [设计系统概览](#设计系统概览)
2. [设计令牌(Design Tokens)](#设计令牌designtokens)
3. [统一组件架构](#统一组件架构)
4. [资源整合方案](#资源整合方案)
5. [实施路线图](#实施路线图)
6. [质量保证](#质量保证)

---

## 🎨 设计系统概览

### 核心设计理念

基于预览图分析，HuLa Matrix的设计系统具有以下特征：

1. **PC端**：深色主题，三栏布局，专业高效
2. **移动端**：浅色主题，底部导航，简洁友好
3. **统一语言**：相同的设计元素和交互模式
4. **响应式适配**：自动根据屏幕尺寸调整布局

### 设计矩阵

```
┌─────────────────────────────────────────────────────────────────┐
│                     HuLa Design Matrix                          │
├──────────────────┬──────────────────────────────────────────────┤
│                  │ PC Desktop        │ Mobile                │
├──────────────────┼───────────────────┼───────────────────────┤
│ 主题模式         │ Dark              │ Light                 │
│ 主色调           │ #2D5A5A (Teal)   │ #E6F7F0 (Mint)       │
│ 强调色           │ #00BFA5 (Cyan)   │ #00B894 (Green)       │
│ 布局模式         │ Three-Column      │ Bottom-Tab            │
│ 导航位置         │ Left Sidebar      │ Bottom Bar            │
│ 圆角大小         │ 8-12px            │ 12-16px               │
│ 阴影强度         │ Subtle            │ Soft                  │
│ 字号基准         │ 14px              │ 16px                  │
└──────────────────┴───────────────────┴───────────────────────┘
```

---

## 🎯 设计令牌(Design Tokens)

### 颜色系统

#### PC端颜色令牌 (Dark Theme)

```scss
// 主色调 - PC Dark
--pc-bg-primary: #2D5A5A;      // 左侧导航背景
--pc-bg-secondary: #2A2A2A;    // 中间列表背景
--pc-bg-tertiary: #3A3A3A;     // 右侧聊天背景
--pc-bg-elevated: #4A4A4A;     // 卡片/弹窗背景

// 文字颜色 - PC
--pc-text-primary: #FFFFFF;     // 主要文字
--pc-text-secondary: #E0E0E0;   // 次要文字
--pc-text-tertiary: #A0A0A0;    // 辅助文字
--pc-text-disabled: #707070;    // 禁用文字

// 强调色 - PC
--pc-accent-primary: #00BFA5;   // 主强调色(亮绿)
--pc-accent-hover: #00E6C8;     // 悬停状态
--pc-accent-active: #009A8A;    // 激活状态
--pc-accent-subtle: #1FDDD4;    // 柔和强调

// 功能色 - PC
--pc-success: #00BFA5;          // 成功
--pc-warning: #FFB84D;          // 警告
--pc-error: #FF6B6B;            // 错误
--pc-info: #4A90E2;             // 信息

// 消息气泡 - PC
--pc-bubble-sent: #00BFA5;      // 发送气泡
--pc-bubble-sent-text: #FFFFFF; // 发送文字
--pc-bubble-received: #4A4A4A;  // 接收气泡
--pc-bubble-received-text: #E0E0E0; // 接收文字
```

#### 移动端颜色令牌 (Light Theme)

```scss
// 主色调 - Mobile Light
--mobile-bg-primary: #E6F7F0;   // 主背景(薄荷绿)
--mobile-bg-secondary: #FFFFFF; // 次级背景(白色)
--mobile-bg-tertiary: #F5F5F5;  // 第三级背景
--mobile-bg-elevated: #FFFFFF;  // 卡片背景

// 文字颜色 - Mobile
--mobile-text-primary: #333333;   // 主要文字
--mobile-text-secondary: #666666; // 次要文字
--mobile-text-tertiary: #999999;  // 辅助文字
--mobile-text-disabled: #CCCCCC;  // 禁用文字

// 强调色 - Mobile
--mobile-accent-primary: #00B894;  // 主强调色(绿色)
--mobile-accent-hover: #00A883;    // 悬停状态
--mobile-accent-active: #00967B;   // 激活状态
--mobile-accent-subtle: #A8D5C1;   // 柔和强调

// 功能色 - Mobile
--mobile-success: #00B894;         // 成功
--mobile-warning: #FFB84D;         // 警告
--mobile-error: #FF6B6B;           // 错误
--mobile-info: #4A90E2;            // 信息

// 消息气泡 - Mobile
--mobile-bubble-sent: #00B894;      // 发送气泡
--mobile-bubble-sent-text: #FFFFFF; // 发送文字
--mobile-bubble-received: #FFFFFF;  // 接收气泡
--mobile-bubble-received-text: #333333; // 接收文字
```

### 间距系统

```scss
// 基础间距单位 (4px基准)
--space-xs: 4px;    // 极小间距
--space-sm: 8px;    // 小间距
--space-md: 16px;   // 中等间距
--space-lg: 24px;   // 大间距
--space-xl: 32px;   // 超大间距
--space-xxl: 48px;  // 特大间距
```

### 圆角系统

```scss
// 圆角大小
--radius-sm: 4px;    // 小圆角 (按钮、标签)
--radius-md: 8px;    // 中圆角 (输入框、卡片)
--radius-lg: 12px;   // 大圆角 (对话框)
--radius-xl: 16px;   // 超大圆角 (移动端卡片)
--radius-full: 9999px; // 完全圆角 (头像、徽章)
```

### 阴影系统

```scss
// 阴影层级
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);

// PC深色主题阴影
--shadow-dark-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-dark-md: 0 4px 6px rgba(0, 0, 0, 0.4);
--shadow-dark-lg: 0 10px 15px rgba(0, 0, 0, 0.5);

// 移动端浅色主题阴影
--shadow-light-sm: 0 1px 3px rgba(0, 184, 148, 0.1);
--shadow-light-md: 0 4px 8px rgba(0, 184, 148, 0.15);
--shadow-light-lg: 0 8px 16px rgba(0, 184, 148, 0.2);
```

### 字体系统

```scss
// 字体大小
--font-xs: 12px;
--font-sm: 14px;
--font-md: 16px;
--font-lg: 18px;
--font-xl: 20px;
--font-2xl: 24px;
--font-3xl: 30px;

// 字重
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;

// 行高
--leading-tight: 1.2;
--leading-normal: 1.5;
--leading-loose: 1.8;
```

---

## 🏗️ 统一组件架构

### 组件目录结构

```
src/components/
├── shared/                    # 跨平台共享组件
│   ├── avatar/               # 头像组件
│   │   ├── UserAvatar.vue    # 用户头像(支持在线状态)
│   │   ├── GroupAvatar.vue   # 群组头像
│   │   └── AvatarGroup.vue   # 头像组
│   ├── button/               # 按钮组件
│   │   ├── PrimaryButton.vue # 主按钮
│   │   ├── IconButton.vue    # 图标按钮
│   │   └── TextButton.vue    # 文字按钮
│   ├── message/              # 消息组件
│   │   ├── MessageBubble.vue # 消息气泡
│   │   ├── MessageList.vue   # 消息列表
│   │   ├── MessageInput.vue  # 消息输入
│   │   └── MessageActions.vue # 消息操作
│   ├── status/               # 状态组件
│   │   ├── OnlineStatus.vue  # 在线状态
│   │   ├── TypingIndicator.vue # 输入指示器
│   │   └── PresenceBadge.vue # 在线徽章
│   └── feedback/             # 反馈组件
│       ├── LoadingSpinner.vue # 加载动画
│       ├── EmptyState.vue    # 空状态
│       └── ErrorState.vue    # 错误状态
│
├── pc/                        # PC端专用组件
│   ├── layout/               # 布局组件
│   │   ├── LeftSidebar.vue   # 左侧导航栏
│   │   ├── CenterPanel.vue   # 中间会话列表
│   │   └── RightPanel.vue    # 右侧聊天区域
│   └── navigation/           # 导航组件
│       ├── NavIcon.vue       # 导航图标
│       └── NavSection.vue    # 导航区块
│
└── mobile/                    # 移动端专用组件
    ├── layout/               # 布局组件
    │   ├── TopBar.vue        # 顶部栏
    │   └── TabBar.vue        # 底部导航栏
    └── gesture/              # 手势组件
        ├── SwipeAction.vue   # 滑动操作
        └── PullRefresh.vue   # 下拉刷新
```

### 组件设计规范

#### 1. 头像组件 (UserAvatar)

```vue
<template>
  <div class="user-avatar" :class="[size, { withStatus }]">
    <!-- 头像图片 -->
    <img
      :src="avatarUrl"
      :alt="displayName"
      @error="handleError"
    />

    <!-- 在线状态指示器 -->
    <div v-if="showStatus && status" class="status-indicator" :class="status">
      <span v-if="status === 'online'" class="pulse"></span>
    </div>

    <!-- 未读消息数 -->
    <div v-if="unreadCount > 0" class="unread-badge">
      {{ unreadCount > 99 ? '99+' : unreadCount }}
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  userId: string
  displayName?: string
  avatarUrl?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showStatus?: boolean
  status?: 'online' | 'offline' | 'away' | 'busy'
  unreadCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  showStatus: true,
  unreadCount: 0
})

// 使用 public/avatar/ 中的默认头像
const defaultAvatars = import.meta.glob('/avatar/*.webp', { eager: true })
</script>

<style scoped>
.user-avatar {
  position: relative;
  border-radius: var(--radius-full);
  overflow: hidden;
  background: var(--pc-bg-elevated);
}

/* 响应式尺寸 */
.user-avatar.xs { width: 32px; height: 32px; }
.user-avatar.sm { width: 40px; height: 40px; }
.user-avatar.md { width: 48px; height: 48px; }
.user-avatar.lg { width: 64px; height: 64px; }
.user-avatar.xl { width: 80px; height: 80px; }

/* 在线状态 */
.status-indicator {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--pc-bg-elevated);
}

.status-indicator.online { background: var(--pc-success); }
.status-indicator.away { background: var(--pc-warning); }
.status-indicator.busy { background: var(--pc-error); }
.status-indicator.offline { background: var(--pc-text-tertiary); }

/* 脉冲动画 */
.pulse {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(2); opacity: 0; }
}

/* PC端适配 */
@media (min-width: 769px) {
  .user-avatar {
    border: 2px solid var(--pc-accent-subtle);
    box-shadow: var(--shadow-dark-md);
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .user-avatar {
    border: 2px solid var(--mobile-bg-secondary);
    box-shadow: var(--shadow-light-sm);
  }
}
</style>
```

#### 2. 消息气泡组件 (MessageBubble)

```vue
<template>
  <div class="message-bubble" :class="[direction, type]">
    <!-- 发送者信息 (仅接收消息) -->
    <div v-if="direction === 'received'" class="sender-info">
      <UserAvatar
        :user-id="senderId"
        :display-name="senderName"
        :avatar-url="senderAvatar"
        size="sm"
      />
      <span class="sender-name">{{ senderName }}</span>
      <span class="timestamp">{{ formatTime(timestamp) }}</span>
    </div>

    <!-- 消息内容 -->
    <div class="bubble-content">
      <!-- 文本消息 -->
      <div v-if="type === 'text'" class="text-content">
        {{ content }}
      </div>

      <!-- 图片消息 -->
      <div v-else-if="type === 'image'" class="image-content">
        <img :src="content" :alt="'图片'" @click="previewImage" />
      </div>

      <!-- 文件消息 -->
      <div v-else-if="type === 'file'" class="file-content">
        <FileIcon :type="fileType" />
        <div class="file-info">
          <div class="file-name">{{ fileName }}</div>
          <div class="file-size">{{ formatFileSize(fileSize) }}</div>
        </div>
      </div>

      <!-- 表情消息 (使用 public/emoji/) -->
      <div v-else-if="type === 'emoji'" class="emoji-content">
        <img :src="getEmojiUrl(content)" :alt="content" />
      </div>
    </div>

    <!-- 消息状态 -->
    <div v-if="direction === 'sent'" class="message-status">
      <CheckCircleIcon v-if="status === 'delivered'" />
      <CheckCircleIcon v-else-if="status === 'read'" :filled="true" />
      <ClockIcon v-else-if="status === 'sending'" :spin="true" />
      <ExclamationIcon v-else-if="status === 'failed'" />
    </div>

    <!-- 快捷操作 -->
    <div class="message-actions">
      <button @click="handleReply">回复</button>
      <button @click="handleForward">转发</button>
      <button @click="handleDelete">删除</button>
      <button @click="handleReact">表情</button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  messageId: string
  direction: 'sent' | 'received'
  type: 'text' | 'image' | 'file' | 'emoji'
  content: string
  senderId?: string
  senderName?: string
  senderAvatar?: string
  timestamp: number
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  fileType?: string
  fileName?: string
  fileSize?: number
}

const getEmojiUrl = (emoji: string) => {
  const emojiMap: Record<string, string> = {
    'party': '/emoji/party-popper.webp',
    'rocket': '/emoji/rocket.webp',
    'fire': '/emoji/fire.webp',
    // ... more mappings
  }
  return emojiMap[emoji] || emoji
}
</script>

<style scoped>
.message-bubble {
  display: flex;
  flex-direction: column;
  margin-bottom: var(--space-md);
  max-width: 70%;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* PC端样式 */
@media (min-width: 769px) {
  .message-bubble.sent {
    align-self: flex-end;
    align-items: flex-end;
  }

  .message-bubble.received {
    align-self: flex-start;
    align-items: flex-start;
  }

  .message-bubble.sent .bubble-content {
    background: var(--pc-bubble-sent);
    color: var(--pc-bubble-sent-text);
    border-radius: var(--radius-lg) 0 var(--radius-lg) var(--radius-lg);
    box-shadow: var(--shadow-dark-sm);
  }

  .message-bubble.received .bubble-content {
    background: var(--pc-bubble-received);
    color: var(--pc-bubble-received-text);
    border-radius: 0 var(--radius-lg) var(--radius-lg) var(--radius-lg);
    box-shadow: var(--shadow-dark-sm);
  }
}

/* 移动端样式 */
@media (max-width: 768px) {
  .message-bubble {
    max-width: 80%;
  }

  .message-bubble.sent .bubble-content {
    background: var(--mobile-bubble-sent);
    color: var(--mobile-bubble-sent-text);
    border-radius: var(--radius-lg) var(--radius-lg) 0 var(--radius-lg);
    box-shadow: var(--shadow-light-sm);
  }

  .message-bubble.received .bubble-content {
    background: var(--mobile-bubble-received);
    color: var(--mobile-bubble-received-text);
    border-radius: var(--radius-lg) var(--radius-lg) var(--radius-lg) 0;
    box-shadow: var(--shadow-light-sm);
  }
}

.bubble-content {
  padding: var(--space-sm) var(--space-md);
  word-wrap: break-word;
}

.text-content {
  line-height: var(--leading-normal);
  font-size: var(--font-md);
}

.image-content img {
  max-width: 100%;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.emoji-content img {
  width: 64px;
  height: 64px;
}

.message-actions {
  display: none;
  margin-top: var(--space-xs);
  gap: var(--space-sm);
}

.message-bubble:hover .message-actions {
  display: flex;
}

.message-actions button {
  background: transparent;
  border: none;
  color: var(--pc-text-secondary);
  cursor: pointer;
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.message-actions button:hover {
  background: var(--pc-bg-elevated);
  color: var(--pc-text-primary);
}
</style>
```

#### 3. PC左侧导航栏 (LeftSidebar)

```vue
<template>
  <div class="left-sidebar">
    <!-- Logo区域 -->
    <div class="logo-section">
      <img src="/logo.png" alt="HuLa" class="logo" />
    </div>

    <!-- 导航图标 -->
    <nav class="nav-icons">
      <NavItem
        v-for="item in navItems"
        :key="item.id"
        :icon="item.icon"
        :label="item.label"
        :active="activeNav === item.id"
        :badge="item.badge"
        @click="handleNav(item.id)"
      />
    </nav>

    <!-- 底部设置 -->
    <div class="bottom-actions">
      <NavItem
        icon="settings"
        label="设置"
        @click="openSettings"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const activeNav = ref('messages')

const navItems = [
  { id: 'profile', icon: 'user', label: '个人资料' },
  { id: 'messages', icon: 'message', label: '消息', badge: 3 },
  { id: 'discover', icon: 'compass', label: '发现' },
  { id: 'favorites', icon: 'bookmark', label: '收藏' },
]

const handleNav = (id: string) => {
  activeNav.value = id
  // 导航逻辑
}
</script>

<style scoped>
.left-sidebar {
  width: 80px;
  height: 100vh;
  background: var(--pc-bg-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-md) 0;
  box-shadow: var(--shadow-dark-md);
  z-index: 100;
}

.logo-section {
  margin-bottom: var(--space-xl);
}

.logo {
  width: 48px;
  height: 48px;
}

.nav-icons {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  width: 100%;
  align-items: center;
}

.bottom-actions {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}
</style>
```

#### 4. 移动端底部导航栏 (TabBar)

```vue
<template>
  <div class="tab-bar">
    <TabItem
      v-for="tab in tabs"
      :key="tab.id"
      :icon="tab.icon"
      :label="tab.label"
      :active="activeTab === tab.id"
      :badge="tab.badge"
      @click="handleTab(tab.id)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const activeTab = ref('message')

const tabs = [
  { id: 'message', icon: 'message', label: '消息', badge: 5 },
  { id: 'rooms', icon: 'users', label: '群聊' },
  { id: 'spaces', icon: 'grid', label: '空间' },
  { id: 'friends', icon: 'user-friends', label: '好友' },
  { id: 'profile', icon: 'user', label: '我的' },
]

const handleTab = (id: string) => {
  activeTab.value = id
  // 导航逻辑
}
</script>

<style scoped>
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: var(--mobile-bg-secondary);
  display: flex;
  justify-content: space-around;
  align-items: center;
  box-shadow: 0 -2px 8px rgba(0, 184, 148, 0.1);
  z-index: 1000;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

@media (min-width: 769px) {
  .tab-bar {
    display: none;
  }
}
</style>
```

---

## 📦 资源整合方案

### 资源映射表

#### 头像资源 (`/public/avatar/`)

```
用途: 用户默认头像
格式: WebP (优化后)
大小: 10-15KB/个
总数: 23个
使用场景:
- 新用户注册默认头像
- 无头像用户显示
- 群组默认图标
```

#### 表情资源 (`/public/emoji/`)

```
当前: 11个WebP文件
优化方案:
1. 分类表情 (party, rocket, fire, alien, bug, comet等)
2. 消息状态表情
3. 反应表情
新增建议:
- 更多常用表情
- 自定义表情包支持
- 动画表情
```

#### 文件类型图标 (`/public/file/`)

```
当前: 35个SVG文件
已完整覆盖常见文件类型
使用组件: FileIcon.vue
动态加载: 按需导入
```

#### 状态指示器 (`/public/status/`)

```
当前: 55个PNG文件
使用率: 3.6% (仅2/55)
优化方案:
1. 实现完整的在线状态系统
2. 支持自定义状态
3. 情绪状态
4. 活动状态
```

#### 声音资源 (`/public/sound/`)

```
当前:
- hula_bell.mp3: 通知铃声
- message.mp3: 消息提示音

使用场景:
- 新消息通知
- 好友请求
- 群邀请
- 系统通知
```

### 资源加载优化

```typescript
// src/utils/assetLoader.ts

/**
 * 预加载关键资源
 */
export async function preloadCriticalAssets() {
  const criticalAssets = [
    '/logo.png',
    '/avatar/default.webp',
    '/emoji/party-popper.webp',
    '/sound/message.mp3',
  ]

  await Promise.allSettled(
    criticalAssets.map(src => {
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = resolve
        img.onerror = reject
        img.src = src
      })
    })
  )
}

/**
 * 动态加载头像
 */
export function getAvatarUrl(userId: string): string {
  const hash = hashCode(userId)
  const index = Math.abs(hash) % 23 + 1
  const paddedIndex = index.toString().padStart(3, '0')
  return `/avatar/${paddedIndex}.webp`
}

/**
 * 动态加载表情
 */
export function getEmojiUrl(emojiName: string): string {
  return `/emoji/${emojiName}.webp`
}

/**
 * 获取文件类型图标
 */
export function getFileIconUrl(fileType: string): string {
  return `/file/${fileType}.svg`
}
```

---

## 🚀 实施路线图

### Phase 1: 设计令牌系统 (1天)

**目标**: 建立统一的设计令牌系统

**任务**:
- [ ] 创建 `src/styles/tokens/` 目录
- [ ] 定义PC端和移动端的设计令牌
- [ ] 创建SCSS变量和CSS自定义属性
- [ ] 编写令牌使用文档

**产出**:
```
src/styles/tokens/
├── index.scss           # 令牌入口
├── colors.scss          # 颜色令牌
├── spacing.scss         # 间距令牌
├── typography.scss      # 字体令牌
├── shadows.scss         # 阴影令牌
└── breakpoints.scss     # 断点令牌
```

### Phase 2: 共享组件库 (2天)

**目标**: 创建跨平台共享的基础组件

**任务**:
- [ ] UserAvatar组件 (支持在线状态、未读数)
- [ ] MessageBubble组件 (支持多种消息类型)
- [ ] MessageInput组件 (支持富文本、表情、文件)
- [ ] Loading/Empty/Error状态组件
- [ ] Button组件系列

### Phase 3: PC端组件 (2天)

**目标**: 实现PC端专用组件

**任务**:
- [ ] LeftSidebar三栏布局左侧导航
- [ ] CenterPanel中间会话列表
- [ ] RightPanel右侧聊天区域
- [ ] NavItem导航图标组件
- [ ] PC端响应式适配

### Phase 4: 移动端组件 (2天)

**目标**: 实现移动端专用组件

**任务**:
- [ ] TabBar底部五项导航
- [ ] TopBar顶部栏
- [ ] SwipeAction滑动操作
- [ ] PullRefresh下拉刷新
- [ ] 移动端手势支持

### Phase 5: 资源整合 (1天)

**目标**: 整合public目录资源到UI系统

**任务**:
- [ ] 实现头像动态加载系统
- [ ] 实现表情资源管理
- [ ] 实现状态指示器系统
- [ ] 实现声音播放系统
- [ ] 优化资源加载性能

### Phase 6: 测试与优化 (1天)

**目标**: 全面测试和性能优化

**任务**:
- [ ] 组件单元测试
- [ ] 响应式布局测试
- [ ] 性能测试和优化
- [ ] 可访问性测试
- [ ] 浏览器兼容性测试

---

## ✅ 质量保证

### 组件检查清单

每个组件必须满足:

- [ ] 支持PC和移动端响应式
- [ ] 使用统一的设计令牌
- [ ] 支持深色/浅色主题
- [ ] 支持国际化(i18n)
- [ ] 具有TypeScript类型定义
- [ ] 具有单元测试
- [ ] 具有使用文档
- [ ] 遵循无障碍(a11y)标准

### 性能指标

- [ ] 首次内容绘制(FCP) < 1.5s
- [ ] 最大内容绘制(LCP) < 2.5s
- [ ] 首次输入延迟(FID) < 100ms
- [ ] 累积布局偏移(CLS) < 0.1
- [ ] 资源加载大小 < 500KB (gzipped)

### 浏览器支持

- [ ] Chrome 90+
- [ ] Firefox 88+
- [ ] Safari 14+
- [ ] Edge 90+
- [ ] 移动端 Safari (iOS 14+)
- [ ] 移动端 Chrome (Android 10+)

---

## 📚 附录

### A. 设计令牌速查表

```
颜色: var(--pc-bg-primary), var(--mobile-accent-primary)
间距: var(--space-sm), var(--space-md), var(--space-lg)
圆角: var(--radius-md), var(--radius-lg)
阴影: var(--shadow-md), var(--shadow-lg)
字体: var(--font-md), var(--font-lg)
```

### B. 组件使用示例

```vue
<template>
  <div class="chat-page">
    <!-- PC端布局 -->
    <div class="pc-layout">
      <LeftSidebar />
      <CenterPanel />
      <RightPanel />
    </div>

    <!-- 移动端布局 -->
    <div class="mobile-layout">
      <TopBar />
      <MessageList />
      <TabBar />
    </div>
  </div>
</template>

<style scoped>
/* 使用设计令牌 */
.chat-page {
  background: var(--pc-bg-secondary);
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}
</style>
```

### C. 迁移指南

从旧组件迁移到新组件系统:

1. 识别旧组件使用的硬编码值
2. 替换为对应的设计令牌
3. 更新组件接口以匹配新的props
4. 添加响应式断点
5. 测试PC和移动端显示

---

**文档版本**: 4.0
**最后更新**: 2026-01-07
**维护者**: HuLa Matrix Team
