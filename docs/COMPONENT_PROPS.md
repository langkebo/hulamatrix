# Component Props 文档

> HuLaMatrix 组件 Props 接口文档

## 目录
- [概述](#概述)
- [聊天组件](#聊天组件)
- [RTC 通话组件](#rtc-通话组件)
- [E2EE 加密组件](#e2ee-加密组件)
- [空间组件](#空间组件)
- [搜索组件](#搜索组件)
- [设置组件](#设置组件)
- [通用组件](#通用组件)

## 概述

本文档列出了 HuLaMatrix 主要 Vue 组件的 Props 接口。所有组件使用 Vue 3 Composition API 和 `<script setup>` 语法。

### Props 命名约定

- **camelCase** - Vue 标准
- **可选** - 标记为 `?:` 的属性为可选
- **默认值** - 在 `withDefaults` 中定义

### 使用示例

```vue
<template>
  <ChatRoom
    :room-id="currentRoomId"
    :show-avatar="true"
    :message-limit="50"
    @message-sent="handleMessageSent"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ChatRoom from '@/components/chat-room/ChatRoom.vue'

const currentRoomId = ref('!room:server.com')

const handleMessageSent = (message) => {
  console.log('Message sent:', message)
}
</script>
```

## 聊天组件

### ChatBox

聊天框组件，显示消息列表和输入框。

**文件：** `src/components/rightBox/chatBox/index.vue`

```typescript
interface Props {
  /** 房间 ID */
  roomId: string
  /** 是否显示头像 */
  showAvatar?: boolean
  /** 是否显示时间戳 */
  showTimestamp?: boolean
  /** 消息列表限制 */
  messageLimit?: number
  /** 是否启用虚拟滚动 */
  enableVirtualScroll?: boolean
  /** 是否只读模式 */
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showAvatar: true,
  showTimestamp: true,
  messageLimit: 50,
  enableVirtualScroll: true,
  readonly: false
})
```

**事件：**
- `@message-sent` - 消息发送成功
- `@message-edit` - 消息编辑
- `@message-delete` - 消息删除
- `@reply-click` - 点击回复

### MessageInput

消息输入组件。

**文件：** `src/components/rightBox/MsgInput.vue`

```typescript
interface Props {
  /** 房间 ID */
  roomId: string
  /** 是否禁用 */
  disabled?: boolean
  /** 占位符文本 */
  placeholder?: string
  /** 最大长度 */
  maxLength?: number
  /** 回复的消息 ID */
  replyTo?: string
  /** 提及的用户 ID 列表 */
  mentions?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  placeholder: 'Type a message...',
  maxLength: 10000,
  replyTo: undefined,
  mentions: () => []
})
```

**事件：**
- `@send` - 发送消息
- `@cancel-reply` - 取消回复
- `@upload-file` - 上传文件

### MessageBubble

消息气泡组件。

**文件：** `src/components/message/MessageBubble.vue`

```typescript
interface Props {
  /** 消息数据 */
  message: any
  /** 是否是当前用户发送的 */
  isOwn: boolean
  /** 显示模式 */
  display?: 'bubble' | 'inline' | 'compact'
  /** 是否显示时间戳 */
  showTimestamp?: boolean
  /** 是否显示发送者 */
  showSender?: boolean
  /** 是否可编辑 */
  editable?: boolean
  /** 是否可回复 */
  replyable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  display: 'bubble',
  showTimestamp: true,
  showSender: true,
  editable: true,
  replyable: true
})
```

**事件：**
- `@edit` - 编辑消息
- `@reply` - 回复消息
- `@delete` - 删除消息
- `@retry` - 重试发送

### VirtualList

虚拟列表组件。

**文件：** `src/components/common/VirtualList.vue`

```typescript
interface Props {
  /** 列表项数据 */
  items: Array<any>
  /** 预估项高度 */
  estimatedItemHeight?: number
  /** 缓冲区大小 */
  buffer?: number
  /** 是否正在加载更多 */
  isLoadingMore?: boolean
  /** 是否是最后一页 */
  isLast?: boolean
  /** 列表键（用于强制刷新） */
  listKey?: string | number
}

const props = withDefaults(defineProps<Props>(), {
  estimatedItemHeight: 80,
  buffer: 5,
  isLoadingMore: false,
  isLast: false,
  listKey: undefined
})
```

**事件：**
- `@scroll` - 滚动事件
- `@scroll-direction-change` - 滚动方向改变
- `@load-more` - 加载更多
- `@visible-items-change` - 可见项改变

**插槽：**
```vue
<VirtualList :items="messages" @load-more="loadMore">
  <template #default="{ item, index }">
    <div :key="item.message?.id">
      {{ item.message.body }}
    </div>
  </template>
</VirtualList>
```

## RTC 通话组件

### CallInterface

1v1 通话界面。

**文件：** `src/components/rtc/CallInterface.vue`

```typescript
interface Props {
  /** 房间 ID */
  roomId: string
  /** 通话 ID */
  callId: string
  /** 是否是视频通话 */
  isVideo?: boolean
  /** 是否显示本地预览 */
  showLocalPreview?: boolean
  /** 是否全屏 */
  fullscreen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isVideo: false,
  showLocalPreview: true,
  fullscreen: false
})
```

**事件：**
- `@hangup` - 挂断通话
- `@toggle-audio` - 切换音频
- `@toggle-video` - 切换视频
- `@screen-share` - 屏幕共享

### GroupCallInterface

群组通话界面。

**文件：** `src/components/rtc/GroupCallInterface.vue`

```typescript
interface Props {
  /** 房间 ID */
  roomId: string
  /** 群组通话 ID */
  callId: string
  /** 是否视频通话 */
  isVideo?: boolean
  /** 最大参与者数量 */
  maxParticipants?: number
  /** 显示参与者列表 */
  showParticipants?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isVideo: true,
  maxParticipants: 10,
  showParticipants: true
})
```

**事件：**
- `@leave` - 离开通话
- `@toggle-mic` - 切换麦克风
- `@toggle-camera` - 切换摄像头
- `@invite-participant` - 邀请参与者

### CallControls

通话控制组件。

**文件：** `src/components/rtc/CallControls.vue`

```typescript
interface Props {
  /** 是否静音 */
  muted?: boolean
  /** 是否视频关闭 */
  videoOff?: boolean
  /** 是否在屏幕共享 */
  screenSharing?: boolean
  /** 通话时长（秒） */
  duration?: number
  /** 显示的按钮 */
  buttons?: ('mic' | 'camera' | 'screen-share' | 'hangup' | 'settings')[]
  /** 按钮布局 */
  layout?: 'horizontal' | 'vertical'
}

const props = withDefaults(defineProps<Props>(), {
  muted: false,
  videoOff: false,
  screenSharing: false,
  duration: 0,
  buttons: () => ['mic', 'camera', 'screen-share', 'hangup'],
  layout: 'horizontal'
})
```

**事件：**
- `@toggle-mute` - 切换静音
- `@toggle-video` - 切换视频
- `@toggle-screen-share` - 切换屏幕共享
- `@hangup` - 挂断
- `@show-settings` - 显示设置

## E2EE 加密组件

### VerificationWizard

设备验证向导。

**文件：** `src/views/e2ee/VerificationWizard.vue`

```typescript
interface Props {
  /** 要验证的用户 ID */
  userId: string
  /** 要验证的设备 ID */
  deviceId: string
  /** 验证方法 */
  method?: 'sas' | 'qrcode'
  /** 是否显示取消按钮 */
  showCancel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  method: 'sas',
  showCancel: true
})
```

**事件：**
- `@complete` - 验证完成
- `@cancel` - 取消验证

### BackupRecovery

密钥备份/恢复。

**文件：** `src/views/e2ee/BackupRecovery.vue`

```typescript
interface Props {
  /** 模式 */
  mode: 'backup' | 'restore'
  /** 是否显示进度 */
  showProgress?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showProgress: true
})
```

**事件：**
- `@backup-complete` - 备份完成
- `@restore-complete` - 恢复完成
- `@error` - 错误

### DeviceVerificationDialog

设备验证对话框。

**文件：** `src/components/e2ee/DeviceVerificationDialog.vue`

```typescript
interface Props {
  /** 设备信息 */
  device: {
    userId: string
    deviceId: string
    displayName: string
    lastSeen: number
  }
  /** 是否打开 */
  open?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  open: false
})
```

**事件：**
- `@verify` - 验证设备
- `@close` - 关闭对话框

## 空间组件

### SpaceList

空间列表。

**文件：** `src/components/spaces/SpaceList.vue`

```typescript
interface Props {
  /** 是否显示创建按钮 */
  showCreateButton?: boolean
  /** 是否显示搜索框 */
  showSearch?: boolean
  /** 空间过滤条件 */
  filter?: 'all' | 'joined' | 'invited'
  /** 列表样式 */
  listStyle?: 'list' | 'grid'
}

const props = withDefaults(defineProps<Props>(), {
  showCreateButton: true,
  showSearch: true,
  filter: 'all',
  listStyle: 'list'
})
```

**事件：**
- `@space-click` - 点击空间
- `@create-space` - 创建空间

### SpaceCard

空间卡片。

**文件：** `src/components/spaces/SpaceCard.vue`

```typescript
interface Props {
  /** 空间信息 */
  space: {
    id: string
    name: string
    topic?: string
    avatar?: string
    rooms?: string[]
    memberCount?: number
  }
  /** 是否显示成员数量 */
  showMemberCount?: boolean
  /** 是否显示房间数量 */
  showRoomCount?: boolean
  /** 卡片样式 */
  variant?: 'default' | 'compact' | 'detailed'
}

const props = withDefaults(defineProps<Props>(), {
  showMemberCount: true,
  showRoomCount: true,
  variant: 'default'
})
```

**事件：**
- `@click` - 点击卡片
- `@join` - 加入空间
- `@leave` - 离开空间

### ManageSpaceDialog

管理空间对话框。

**文件：** `src/components/spaces/ManageSpaceDialog.vue`

```typescript
interface Props {
  /** 空间 ID */
  spaceId: string
  /** 对话框是否打开 */
  open?: boolean
  /** 标签页 */
  activeTab?: 'info' | 'members' | 'rooms' | 'settings'
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  activeTab: 'info'
})
```

**事件：**
- `@update:space` - 空间更新
- @close` - 关闭对话框

### JoinSpaceDialog

加入空间对话框。

**文件：** `src/components/spaces/JoinSpaceDialog.vue`

```typescript
interface Props {
  /** 空间 ID */
  spaceId: string
  /** 对话框是否打开 */
  open?: boolean
  /** 是否通过链接加入 */
  viaLink?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  viaLink: false
})
```

**事件：**
- `@join` - 加入空间
- `@cancel` - 取消加入

## 搜索组件

### EnhancedSearch

增强搜索组件。

**文件：** `src/components/search/EnhancedSearch.vue`

```typescript
interface Props {
  /** 初始搜索词 */
  initialQuery?: string
  /** 搜索范围 */
  scope?: 'all' | 'messages' | 'rooms' | 'people'
  /** 是否显示过滤器 */
  showFilters?: boolean
  /** 占位符 */
  placeholder?: string
  /** 最小输入长度 */
  minInputLength?: number
  /** 搜索延迟（毫秒） */
  debounceMs?: number
}

const props = withDefaults(defineProps<Props>(), {
  initialQuery: '',
  scope: 'all',
  showFilters: true,
  placeholder: 'Search...',
  minInputLength: 2,
  debounceMs: 300
})
```

**事件：**
- `@search` - 执行搜索
- `@clear` - 清除搜索

### SearchResultsViewer

搜索结果查看器。

**文件：** `src/components/search/SearchResultsViewer.vue`

```typescript
interface Props {
  /** 搜索结果 */
  results: {
    messages?: Array<any>
    rooms?: Array<any>
    people?: Array<any>
  }
  /** 是否显示分页 */
  showPagination?: boolean
  /** 每页数量 */
  pageSize?: number
  /** 结果显示模式 */
  displayMode?: 'list' | 'grid'
}

const props = withDefaults(defineProps<Props>(), {
  showPagination: true,
  pageSize: 20,
  displayMode: 'list'
})
```

**事件：**
- `@result-click` - 点击结果
- `@load-more` - 加载更多

## 设置组件

### SettingsSkeleton

设置页面骨架屏。

**文件：** `src/components/settings/SettingsSkeleton.vue`

```typescript
interface Props {
  /** 骨架屏类型 */
  type?: 'list' | 'card' | 'table'
  /** 行数 */
  rows?: number
  /** 是否显示动画 */
  animated?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'list',
  rows: 5,
  animated: true
})
```

### NotificationSettings

通知设置。

**文件：** `src/components/settings/NotificationSettings.vue`

```typescript
interface Props {
  /** 房间 ID（可选，用于房间特定设置） */
  roomId?: string
  /** 设置类型 */
  type?: 'global' | 'room'
  /** 是否显示高级选项 */
  showAdvanced?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'global',
  showAdvanced: false
})
```

### PushRulesSettings

推送规则设置。

**文件：** `src/components/settings/PushRulesSettings.vue`

```typescript
interface Props {
  /** 规则类型 */
  ruleType?: 'override' | 'underride' | 'sender' | 'room' | 'content'
  /** 是否显示已禁用的规则 */
  showDisabled?: boolean
  /** 是否可编辑 */
  editable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  ruleType: 'override',
  showDisabled: false,
  editable: true
})
```

## 通用组件

### ButtonGroup

按钮组。

**文件：** `src/components/common/ButtonGroup.vue`

```typescript
interface Props {
  /** 按钮配置 */
  buttons: Array<{
    label: string
    value: string
    icon?: string
    disabled?: boolean
    variant?: 'default' | 'primary' | 'danger'
  }>
  /** 选中的值 */
  modelValue: string
  /** 按钮样式 */
  size?: 'small' | 'medium' | 'large'
  /** 是否禁用整个组 */
  disabled?: boolean
  /** 按钮排列方向 */
  direction?: 'horizontal' | 'vertical'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  disabled: false,
  direction: 'horizontal'
})
```

**事件：**
- `@update:modelValue` - 值改变

### IconButton

图标按钮。

**文件：** `src/components/common/IconButton.vue`

```typescript
interface Props {
  /** 图标 */
  icon: string
  /** 按钮类型 */
  type?: 'button' | 'submit' | 'reset'
  /** 变体 */
  variant?: 'text' | 'flat' | 'outlined' | 'contained'
  /** 颜色 */
  color?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  /** 大小 */
  size?: 'small' | 'medium' | 'large'
  /** 是否禁用 */
  disabled?: boolean
  /** 是否圆形 */
  circular?: boolean
  /** 加载状态 */
  loading?: boolean
  /** 提示文本 */
  tooltip?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  variant: 'text',
  color: 'default',
  size: 'medium',
  disabled: false,
  circular: false,
  loading: false
})
```

### Tooltip

工具提示。

**文件：** `src/components/common/Tooltip.vue`

```typescript
interface Props {
  /** 提示文本 */
  text: string
  /** 位置 */
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** 触发方式 */
  trigger?: 'hover' | 'click' | 'focus'
  /** 是否禁用 */
  disabled?: boolean
  /** 延迟（毫秒） */
  delay?: number
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'top',
  trigger: 'hover',
  disabled: false,
  delay: 100
})
```

### LoadingSpinner

加载动画。

**文件：** `src/components/common/LoadingSpinner.vue`

```typescript
interface Props {
  /** 大小 */
  size?: 'small' | 'medium' | 'large'
  /** 颜色 */
  color?: string
  /** 是否全屏覆盖 */
  fullscreen?: boolean
  /** 加载文本 */
  text?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  color: '#13987f',
  fullscreen: false
})
```

### InfoPopover

信息弹出框。

**文件：** `src/components/common/InfoPopover.vue`

```typescript
interface Props {
  /** 触发器插槽内容 */
  trigger?: any
  /** 标题 */
  title?: string
  /** 内容 */
  content?: string
  /** 宽度 */
  width?: number | string
  /** 位置 */
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** 是否显示箭头 */
  showArrow?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  width: 300,
  placement: 'bottom',
  showArrow: true
})
```

## 移动端组件

### MobileChatMain

移动端聊天主界面。

**文件：** `src/mobile/views/chat-room/MobileChatMain.vue`

```typescript
interface Props {
  /** 房间 ID */
  roomId: string
  /** 是否显示返回按钮 */
  showBack?: boolean
  /** 是否全屏 */
  fullscreen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showBack: true,
  fullscreen: false
})
```

### PullToRefresh

下拉刷新组件。

**文件：** `src/mobile/components/PullToRefresh.vue`

```typescript
interface Props {
  /** 是否正在刷新 */
  refreshing?: boolean
  /** 触发距离（像素） */
  triggerDistance?: number
  /** 是否启用 */
  disabled?: boolean
  /** 提示文本 */
  pullText?: string
  /** 释放提示文本 */
  releaseText?: string
  /** 刷新中提示文本 */
  refreshingText?: string
}

const props = withDefaults(defineProps<Props>(), {
  refreshing: false,
  triggerDistance: 80,
  disabled: false,
  pullText: 'Pull to refresh',
  releaseText: 'Release to refresh',
  refreshingText: 'Refreshing...'
})
```

**事件：**
- `@refresh` - 刷新触发

## Props 验证

### Runtime Props 验证

组件可以在运行时验证 props：

```vue
<script setup lang="ts">
interface Props {
  /** 用户 ID */
  userId: string
  /** 消息内容 */
  message: string
}

const props = defineProps<Props>()

// 运行时验证
if (!props.userId) {
  console.warn('userId is required')
}
</script>
```

### Props 默认值

使用 `withDefaults` 设置默认值：

```vue
<script setup lang="ts">
interface Props {
  /** 是否显示 */
  visible?: boolean
  /** 大小 */
  size?: 'small' | 'medium' | 'large'
}

const props = withDefaults(defineProps<Props>(), {
  visible: true,
  size: 'medium'
})
</script>
```

## Props 类型定义

### 复杂类型定义

对于复杂的 Props，建议在单独的文件中定义类型：

```typescript
// types/chat.ts
export interface Message {
  id: string
  roomId: string
  senderId: string
  body: string
  timestamp: number
  attachments?: Attachment[]
}

export interface Attachment {
  id: string
  type: 'image' | 'video' | 'file'
  url: string
  size?: number
}

// components/chat/MessageList.vue
<script setup lang="ts">
import type { Message } from '@/types/chat'

interface Props {
  messages: Message[]
  roomId: string
}

defineProps<Props>()
</script>
```

## 最佳实践

### 1. Props 命名

- 使用 **camelCase**
- 名称应具有描述性
- 避免缩写

```typescript
// ✅ 推荐
interface Props {
  maxRetries: number
  showTimestamp: boolean
  enableEncryption: boolean
}

// ❌ 不推荐
interface Props {
  max: number
  ts: boolean
  enc: boolean
}
```

### 2. Props 类型

- 优先使用原始类型
- 避免使用 `any`
- 使用联合类型限制取值

```typescript
// ✅ 推荐
interface Props {
  size: 'small' | 'medium' | 'large'
  count?: number
}

// ❌ 不推荐
interface Props {
  size: string
  count?: any
}
```

### 3. Props 文档

每个 Prop 都应有注释说明：

```typescript
interface Props {
  /** 用户 ID (必需) */
  userId: string
  /** 消息内容 */
  message: string
  /** 是否显示头像 (默认: true) */
  showAvatar?: boolean
  /** 附加数据 */
  extraData?: Record<string, unknown>
}
```

### 4. Props 验证

使用 PropType 进行运行时验证（如果需要）：

```typescript
<script setup lang="ts">
import { PropTypes } from '@/utils/propTypes'

interface Props {
  /** 用户 ID (必需) */
  userId: string
  /** 年龄 (必须大于等于0) */
  age: number
}

defineProps<Props>()

// 自定义验证
if (props.age < 0) {
  throw new Error('age must be >= 0')
}
</script>
```

## 组件事件定义

### Emit 事件定义

```typescript
interface Emits {
  (e: 'change', value: string): void
  (e: 'submit', data: FormData): void
  (e: 'cancel'): void
}

const emit = defineEmits<Emits>()

// 触发事件
emit('change', 'new value')
emit('submit', formData)
emit('cancel')
```

### 组件暴露方法

使用 `defineExpose` 暴露方法给父组件：

```typescript
const refresh = async () => {
  // 刷新逻辑
}

const scrollToTop = () => {
  // 滚动到顶部
}

defineExpose({
  refresh,
  scrollToTop
})
```

父组件中调用：

```vue
<template>
  <MessageList ref="messageListRef" />
</template>

<script setup lang="ts">
const messageListRef = ref()

// 调用子组件方法
await messageListRef.value.refresh()
</script>
```

## 总结

### Props 设计原则

1. **最小化** - 只接收必要的 props
2. **类型安全** - 使用 TypeScript 类型
3. **默认值** - 为可选 props 提供合理默认值
4. **文档化** - 为所有 props 提供注释
5. **验证** - 对关键 props 进行验证

### 组件设计最佳实践

1. **单一职责** - 每个组件只做一件事
2. **可复用** - 组件应该可以在不同上下文中使用
3. **可组合** - 小组件组合成大组件
4. **性能优化** - 合理使用虚拟滚动、懒加载等
