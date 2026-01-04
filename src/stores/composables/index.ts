/**
 * 聊天Store Composables
 *
 * 将大型 chat.ts 拆分为多个可管理的模块
 */

export { useChatSessions } from './chat-session'
export { useChatMessages } from './chat-messages'
export { useChatThreads } from './chat-threads'
export { useChatUnread } from './chat-unread'
export { useChatRecall } from './chat-recall'

export type {
  ChatSessionComposables,
  ChatSessionDeps
} from './chat-session'

export type {
  ChatMessagesComposables,
  ChatMessagesDeps
} from './chat-messages'

export type {
  ChatThreadsComposables,
  ChatThreadsDeps
} from './chat-threads'

export type {
  ChatUnreadComposables,
  ChatUnreadDeps
} from './chat-unread'

export type {
  ChatRecallComposables,
  ChatRecallDeps
} from './chat-recall'
