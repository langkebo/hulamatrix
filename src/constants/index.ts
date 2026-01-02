/**
 * 应用程序常量配置
 * 集中管理所有硬编码的数值和配置
 */

// ==================== 文件大小限制 ====================
export const FILE_SIZE_LIMITS = {
  /** 图片最大上传大小 (2MB) */
  IMAGE_MAX_SIZE: 2 * 1024 * 1024,
  /** 视频最大上传大小 (100MB) */
  VIDEO_MAX_SIZE: 100 * 1024 * 1024,
  /** 文件最大上传大小 (100MB) */
  FILE_MAX_SIZE: 100 * 1024 * 1024,
  /** 语音最大录制时长 (60秒) */
  VOICE_MAX_DURATION: 60,
  /** 语音最大文件大小 (10MB) */
  VOICE_MAX_SIZE: 10 * 1024 * 1024
} as const

// ==================== 文本长度限制 ====================
export const TEXT_LIMITS = {
  /** 消息内容最大长度 */
  MESSAGE_MAX_LENGTH: 500,
  /** 用户昵称最大长度 */
  USERNAME_MAX_LENGTH: 20,
  /** 群组名称最大长度 */
  GROUP_NAME_MAX_LENGTH: 30,
  /** 个性签名最大长度 */
  BIO_MAX_LENGTH: 200,
  /** 动态内容最大长度 */
  DYNAMIC_MAX_LENGTH: 1000
} as const

// ==================== 时间间隔（毫秒） ====================
export const TIME_INTERVALS = {
  /** 防抖延迟（毫秒） */
  DEBOUNCE_DELAY: 300,
  /** 节流间隔（毫秒） */
  THROTTLE_DELAY: 100,
  /** 自动保存间隔（毫秒） */
  AUTO_SAVE_INTERVAL: 5000,
  /** 心跳间隔（毫秒） */
  HEARTBEAT_INTERVAL: 30000,
  /** 消息重试延迟（毫秒） */
  MESSAGE_RETRY_DELAY: 5000,
  /** Toast 显示时间（毫秒） */
  TOAST_DURATION: 3000,
  /** 页面切换动画时长（毫秒） */
  PAGE_TRANSITION_DURATION: 300,
  /** 输入法组合输入检测延迟（毫秒） */
  COMPOSITION_DELAY: 100
} as const

// ==================== API 配置 ====================
export const API_CONFIG = {
  /** 默认请求超时时间（毫秒） */
  DEFAULT_TIMEOUT: 10000,
  /** 上传超时时间（毫秒） */
  UPLOAD_TIMEOUT: 60000,
  /** 最大重试次数 */
  MAX_RETRY_COUNT: 3,
  /** 分页默认大小 */
  DEFAULT_PAGE_SIZE: 20,
  /** 最大分页大小 */
  MAX_PAGE_SIZE: 100
} as const

// ==================== 消息分页与并发策略 ====================
export const MESSAGES_CONFIG = {
  /** 默认分页大小（与 API_CONFIG 保持一致） */
  DEFAULT_PAGE_SIZE: 20,
  /** 并发抓取会话初始消息的最大并发数 */
  MAX_CONCURRENCY: 5,
  /** 微批节流窗口（毫秒），用于 UI 合并更新 */
  MICRO_BATCH_WINDOW_MS: 16
} as const

// ==================== 缓存配置 ====================
export const CACHE_CONFIG = {
  /** 消息缓存数量 */
  MESSAGE_CACHE_SIZE: 1000,
  /** 图片缓存数量 */
  IMAGE_CACHE_SIZE: 500,
  /** 用户信息缓存时间（毫秒） */
  USER_INFO_CACHE_TTL: 5 * 60 * 1000,
  /** 草稿保存时间（毫秒） */
  DRAFT_SAVE_TTL: 24 * 60 * 60 * 1000
} as const

// ==================== 文件类型 ====================
export const FILE_TYPES = {
  /** 支持的图片类型 */
  IMAGE: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  /** 支持的视频类型 */
  VIDEO: ['video/mp4', 'video/webm', 'video/ogg'],
  /** 支持的音频类型 */
  AUDIO: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'],
  /** 支持的文档类型 */
  DOCUMENT: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain'
  ]
} as const

// ==================== UI 常量 ====================
export const UI_CONSTANTS = {
  /** 默认头像大小 */
  DEFAULT_AVATAR_SIZE: 40,
  /** 最小窗口宽度 */
  MIN_WINDOW_WIDTH: 800,
  /** 最小窗口高度 */
  MIN_WINDOW_HEIGHT: 600,
  /** 侧边栏宽度 */
  SIDEBAR_WIDTH: 280,
  /** 聊天输入框最大高度 */
  INPUT_MAX_HEIGHT: 120,
  /** 虚拟列表项高度 */
  VIRTUAL_LIST_ITEM_HEIGHT: 60,
  /** 图片预览最大宽度 */
  IMAGE_PREVIEW_MAX_WIDTH: 800,
  /** 图片预览最大高度 */
  IMAGE_PREVIEW_MAX_HEIGHT: 600
} as const

// ==================== 正则表达式 ====================
export const REGEX_PATTERNS = {
  /** 邮箱正则 */
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  /** 手机号正则（中国大陆） */
  PHONE: /^1[3-9]\d{9}$/,
  /** 密码正则（至少包含字母和数字，8-20位） */
  PASSWORD: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,20}$/,
  /** URL 正则 */
  URL: /^https?:\/\/.+/,
  /** 提及用户正则 */
  MENTION: /@([^\s@]+)/g,
  /** 表情符号正则 */
  EMOJI:
    /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu
} as const

// ==================== 存储键名 ====================
export const STORAGE_KEYS = {
  /** 用户 Token */
  USER_TOKEN: 'user_token',
  /** 用户信息 */
  USER_INFO: 'user_info',
  /** 主题设置 */
  THEME: 'theme',
  /** 语言设置 */
  LANGUAGE: 'language',
  /** 消息草稿 */
  MESSAGE_DRAFT: 'message_draft_',
  /** 设置配置 */
  SETTINGS: 'settings',
  /** 搜索历史 */
  SEARCH_HISTORY: 'search_history',
  /** 文件上传记录 */
  UPLOAD_RECORDS: 'upload_records'
} as const

// ==================== 错误消息 ====================
export const ERROR_MESSAGES = {
  /** 网络错误 */
  NETWORK_ERROR: '网络连接异常，请检查网络设置',
  /** 服务器错误 */
  SERVER_ERROR: '服务器繁忙，请稍后重试',
  /** 登录过期 */
  LOGIN_EXPIRED: '登录已过期，请重新登录',
  /** 权限不足 */
  PERMISSION_DENIED: '权限不足，无法执行此操作',
  /** 文件过大 */
  FILE_TOO_LARGE: '文件大小超过限制',
  /** 格式不支持 */
  FORMAT_NOT_SUPPORTED: '文件格式不支持',
  /** 消息过长 */
  MESSAGE_TOO_LONG: '消息内容过长，请分段发送',
  /** 参数错误 */
  INVALID_PARAMS: '参数错误',
  /** 操作失败 */
  OPERATION_FAILED: '操作失败，请重试'
} as const

// ==================== 成功消息 ====================
export const SUCCESS_MESSAGES = {
  /** 保存成功 */
  SAVE_SUCCESS: '保存成功',
  /** 发送成功 */
  SEND_SUCCESS: '发送成功',
  /** 上传成功 */
  UPLOAD_SUCCESS: '上传成功',
  /** 删除成功 */
  DELETE_SUCCESS: '删除成功',
  /** 复制成功 */
  COPY_SUCCESS: '复制成功',
  /** 更新成功 */
  UPDATE_SUCCESS: '更新成功',
  /** 操作成功 */
  OPERATION_SUCCESS: '操作成功'
} as const

// ==================== 默认配置 ====================
export const DEFAULT_CONFIG = {
  /** 默认主题 */
  THEME: 'light',
  /** 默认语言 */
  LANGUAGE: 'zh-CN',
  /** 默认发送快捷键 */
  SEND_KEY: 'enter',
  /** 默认通知设置 */
  NOTIFICATION: true,
  /** 默认声音设置 */
  SOUND: true,
  /** 默认振动设置 */
  VIBRATION: false,
  /** 默认在线状态 */
  ONLINE_STATUS: 'online'
} as const

// ==================== 路由名称 ====================
export const ROUTE_NAMES = {
  /** 登录页 */
  LOGIN: 'login',
  /** 主页 */
  HOME: 'home',
  /** 聊天页 */
  CHAT: 'chat',
  /** 设置页 */
  SETTINGS: 'settings',
  /** 个人资料页 */
  PROFILE: 'profile',
  /** 文件管理页 */
  FILE_MANAGER: 'file-manager',
  /** 搜索页 */
  SEARCH: 'search'
} as const

// ==================== 事件名称 ====================
export const EVENT_NAMES = {
  /** 用户上线 */
  USER_ONLINE: 'user:online',
  /** 用户下线 */
  USER_OFFLINE: 'user:offline',
  /** 新消息 */
  NEW_MESSAGE: 'message:new',
  /** 消息已读 */
  MESSAGE_READ: 'message:read',
  /** 消息撤回 */
  MESSAGE_RECALL: 'message:recall',
  /** 开始输入 */
  TYPING_START: 'typing:start',
  /** 停止输入 */
  TYPING_STOP: 'typing:stop',
  /** 文件上传进度 */
  UPLOAD_PROGRESS: 'upload:progress',
  /** 网络状态变化 */
  NETWORK_CHANGE: 'network:change'
} as const

// ==================== 导出所有常量 ====================
export const CONSTANTS = {
  FILE_SIZE_LIMITS,
  TEXT_LIMITS,
  TIME_INTERVALS,
  API_CONFIG,
  MESSAGES_CONFIG,
  CACHE_CONFIG,
  FILE_TYPES,
  UI_CONSTANTS,
  REGEX_PATTERNS,
  STORAGE_KEYS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  DEFAULT_CONFIG,
  ROUTE_NAMES,
  EVENT_NAMES
} as const
