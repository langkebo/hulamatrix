/**
 * Core Store - Main Orchestrator
 * Coordinates all state managers into a unified Pinia store
 */

import { defineStore } from 'pinia'
import { computed } from 'vue'
import { AuthStateManager } from '../auth-state'
import { RoomStateManager } from '../room-state'
import { MediaStateManager } from '../media-state'
import { SearchStateManager } from '../search-state'
import { NotificationStateManager } from '../notification-state'
import { CallStateManager } from '../call-state'
import { CacheStateManager } from '../cache-state'
import { SettingsStateManager } from '../settings-state'
import type { MenuItem } from '../types'

/**
 * Core application store
 * Manages all application state through modular state managers
 */
export const useAppStore = defineStore('app', () => {
  // ========== State Manager Instances ==========

  // Authentication and user management
  const authState = new AuthStateManager()

  // Room and chat management
  const roomState = new RoomStateManager(
    () => authState.client.value,
    () => authState.auth.value.userId
  )

  // Media file management
  const mediaState = new MediaStateManager(
    () => authState.client.value,
    (roomId, content, type) => roomState.sendMessage(roomId, content, type)
  )

  // Search functionality
  const searchState = new SearchStateManager(
    () => authState.client.value,
    () => authState.users.value,
    () => roomState.rooms.value as any
  )

  // Notification management
  const notificationState = new NotificationStateManager()

  // RTC call management
  const callState = new CallStateManager()

  // Cache management
  const cacheState = new CacheStateManager(
    () => roomState.messages.value,
    () => roomState.rooms.value,
    (messages) => {
      roomState.messages.value = messages
    },
    (rooms) => {
      roomState.rooms.value = rooms
    }
  )

  // Settings and UI management
  const settingsState = new SettingsStateManager()

  // ========== Computed Properties ==========

  const isAuthenticated = computed(() => authState.isAuthenticated.value)
  const currentRoom = computed(() => roomState.currentRoom.value)
  const currentMessages = computed(() => roomState.currentMessages.value)
  const unreadCount = computed(() => roomState.unreadCount.value)
  const onlineFriends = computed(() => authState.onlineFriends.value)

  // ========== Authentication Methods ==========

  const login = async (credentials: { username: string; password: string; homeserver: string }) => {
    await authState.login(credentials)
    await roomState.loadInitialRooms()
  }

  const logout = () => {
    authState.logout()
    roomState.clearRoomData()
    mediaState.clearMediaFiles()
  }

  const loadCurrentUser = () => authState.loadCurrentUser()

  // ========== User Management Methods ==========

  const addFriend = (userId: string) => authState.addFriend(userId)
  const removeFriend = (userId: string) => authState.removeFriend(userId)
  const blockUser = (userId: string) => authState.blockUser(userId)
  const getUser = (userId: string) => authState.getUser(userId)
  const setUser = (userId: string, profile: Parameters<AuthStateManager['setUser']>[1]) =>
    authState.setUser(userId, profile)
  const updateUserPresence = (userId: string, presence: Parameters<AuthStateManager['updateUserPresence']>[1]) =>
    authState.updateUserPresence(userId, presence)

  // ========== Room Management Methods ==========

  const joinRoom = (roomId: string) => roomState.joinRoom(roomId)
  const leaveRoom = (roomId: string) => roomState.leaveRoom(roomId)
  const sendMessage = (roomId: string, content: Record<string, unknown>, type?: string) =>
    roomState.sendMessage(roomId, content, type)
  const switchToRoom = (roomId: string, preload?: boolean) => roomState.switchToRoom(roomId, preload)
  const updateRecentRoom = (roomId: string) => {
    roomState.updateRecentRoom(roomId)
    cacheState.updateRecentRoom(roomId)
  }
  const performLRUCleanup = () => cacheState.performLRUCleanup()
  const getRoom = (roomId: string) => roomState.getRoom(roomId)
  const setRoom = (roomId: string, room: Parameters<RoomStateManager['setRoom']>[1]) => roomState.setRoom(roomId, room)
  const updateRoom = (roomId: string, updates: Parameters<RoomStateManager['updateRoom']>[1]) =>
    roomState.updateRoom(roomId, updates)
  const getRoomMessages = (roomId: string) => roomState.getRoomMessages(roomId)
  const setRoomMessages = (roomId: string, messages: Parameters<RoomStateManager['setRoomMessages']>[1]) =>
    roomState.setRoomMessages(roomId, messages)
  const addMessage = (roomId: string, message: Parameters<RoomStateManager['addMessage']>[1]) =>
    roomState.addMessage(roomId, message)
  const addTypingUser = (roomId: string, userId: string) => roomState.addTypingUser(roomId, userId)
  const removeTypingUser = (roomId: string, userId: string) => roomState.removeTypingUser(roomId, userId)
  const clearTypingUsers = (roomId: string) => roomState.clearTypingUsers(roomId)
  const searchKnownRooms = (query: string) => roomState.searchKnownRooms(query)

  // ========== Media Methods ==========

  const uploadFile = (file: File, roomId: string) => mediaState.uploadFile(file, roomId)
  const getMediaFile = (fileId: string) => mediaState.getMediaFile(fileId)
  const addMediaFile = (file: Parameters<MediaStateManager['addMediaFile']>[0]) => mediaState.addMediaFile(file)
  const removeMediaFile = (fileId: string) => mediaState.removeMediaFile(fileId)
  const clearMediaFiles = () => mediaState.clearMediaFiles()
  const updateDownloadQueue = (updates: Parameters<MediaStateManager['updateDownloadQueue']>[0]) =>
    mediaState.updateDownloadQueue(updates)
  const addToDownloadQueue = (file: Parameters<MediaStateManager['addToDownloadQueue']>[0]) =>
    mediaState.addToDownloadQueue(file)
  const clearDownloadQueue = () => mediaState.clearDownloadQueue()

  // ========== Search Methods ==========

  const performSearch = (query: string) => searchState.performSearch(query)
  const searchUsers = (query: string) => searchState.searchUsers(query)
  const searchRooms = (query: string) => searchState.searchRooms(query, () => searchKnownRooms(query))
  const highlightSearchTerms = (text: string, query: string) => searchState.highlightSearchTerms(text, query)
  const clearSearchHistory = () => searchState.clearSearchHistory()
  const clearSearchResults = () => searchState.clearSearchResults()
  const setSearchFilters = (filters: Parameters<SearchStateManager['setSearchFilters']>[0]) =>
    searchState.setSearchFilters(filters)

  // ========== Notification Methods ==========

  const addNotificationRule = (rule: Parameters<NotificationStateManager['addNotificationRule']>[0]) =>
    notificationState.addNotificationRule(rule)
  const removeNotificationRule = (ruleId: string) => notificationState.removeNotificationRule(ruleId)
  const updateNotificationRule = (
    ruleId: string,
    updates: Parameters<NotificationStateManager['updateNotificationRule']>[1]
  ) => notificationState.updateNotificationRule(ruleId, updates)
  const toggleGlobalNotifications = () => notificationState.toggleGlobalNotifications()
  const toggleSoundNotifications = () => notificationState.toggleSoundNotifications()
  const toggleDoNotDisturb = () => notificationState.toggleDoNotDisturb()
  const setDoNotDisturbTime = (start: string, end: string) => notificationState.setDoNotDisturbTime(start, end)
  const updateRoomNotificationSettings = (
    roomId: string,
    settings: Parameters<NotificationStateManager['updateRoomNotificationSettings']>[1]
  ) => notificationState.updateRoomNotificationSettings(roomId, settings)
  const getRoomNotificationSettings = (roomId: string) => notificationState.getRoomNotificationSettings(roomId)
  const clearNotificationRules = () => notificationState.clearNotificationRules()
  const resetNotificationSettings = () => notificationState.resetToDefaults()

  // ========== RTC Call Methods ==========

  const startCall = (roomId: string, type: 'audio' | 'video') => callState.startCall(roomId, type)
  const endCall = () => callState.endCall()
  const toggleAudio = () => callState.toggleAudio()
  const toggleVideo = () => callState.toggleVideo()
  const toggleScreenShare = () => callState.toggleScreenShare()
  const resetCallState = () => callState.resetCallState()
  const isInCall = () => callState.isInCall()
  const getCallState = () => callState.getCallState()

  // ========== Cache Methods ==========

  const clearCache = (options?: Parameters<CacheStateManager['clearCache']>[0]) => cacheState.clearCache(options)
  const optimizeCache = () => cacheState.optimizeCache(searchState.search as any)
  const updateCacheSettings = (settings: Parameters<CacheStateManager['updateCacheSettings']>[0]) =>
    cacheState.updateCacheSettings(settings)
  const getCacheStats = () => cacheState.getCacheStats()

  // ========== Settings Methods ==========

  const setTheme = (theme: Parameters<SettingsStateManager['setTheme']>[0]) => settingsState.setTheme(theme)
  const setLanguage = (language: string) => settingsState.setLanguage(language)
  const setFontSize = (fontSize: Parameters<SettingsStateManager['setFontSize']>[0]) =>
    settingsState.setFontSize(fontSize)
  const setMessageDensity = (density: Parameters<SettingsStateManager['setMessageDensity']>[0]) =>
    settingsState.setMessageDensity(density)
  const toggleAutoPlayGifs = () => settingsState.toggleAutoPlayGifs()
  const toggleShowReadReceipts = () => settingsState.toggleShowReadReceipts()
  const toggleShowTypingNotifications = () => settingsState.toggleShowTypingNotifications()
  const toggleEnableEncryption = () => settingsState.toggleEnableEncryption()
  const setBackupFrequency = (frequency: Parameters<SettingsStateManager['setBackupFrequency']>[0]) =>
    settingsState.setBackupFrequency(frequency)
  const updateSettingsCache = (cache: Parameters<SettingsStateManager['updateCacheSettings']>[0]) =>
    settingsState.updateCacheSettings(cache)
  const updateSettingsNotifications = (
    notifications: Parameters<SettingsStateManager['updateNotificationSettings']>[0]
  ) => settingsState.updateNotificationSettings(notifications)
  const updateMenuTop = (newMenuTop: MenuItem[]) => settingsState.updateMenuTop(newMenuTop)
  const getTheme = () => settingsState.getTheme()
  const getLanguage = () => settingsState.getLanguage()
  const resetSettingsToDefaults = () => settingsState.resetToDefaults()
  const exportSettings = () => settingsState.exportSettings()
  const importSettings = (json: string) => settingsState.importSettings(json)

  // ========== Return Store API ==========

  return {
    // ========== Original State ==========
    client: authState.client,
    isInitialized: authState.isInitialized,
    isLoading: authState.isLoading,

    // ========== Authentication ==========
    auth: authState.auth,
    isAuthenticated,
    login,
    logout,
    loadCurrentUser,

    // ========== User Management ==========
    currentUser: authState.currentUser,
    users: authState.users,
    friends: authState.friends,
    blockedUsers: authState.blockedUsers,
    onlineFriends,
    addFriend,
    removeFriend,
    blockUser,
    getUser,
    setUser,
    updateUserPresence,

    // ========== Room & Chat ==========
    rooms: roomState.rooms,
    messages: roomState.messages,
    currentRoomId: roomState.currentRoomId,
    currentRoom,
    currentMessages,
    typingUsers: roomState.typingUsers,
    unreadCount,
    joinRoom,
    leaveRoom,
    sendMessage,
    switchToRoom,
    updateRecentRoom,
    performLRUCleanup,
    getRoom,
    setRoom,
    updateRoom,
    getRoomMessages,
    setRoomMessages,
    addMessage,
    addTypingUser,
    removeTypingUser,
    clearTypingUsers,
    searchKnownRooms,

    // ========== Media ==========
    mediaFiles: mediaState.mediaFiles,
    downloadQueue: mediaState.downloadQueue,
    uploadFile,
    getMediaFile,
    addMediaFile,
    removeMediaFile,
    clearMediaFiles,
    updateDownloadQueue,
    addToDownloadQueue,
    clearDownloadQueue,

    // ========== Search ==========
    search: searchState.search,
    performSearch,
    searchUsers,
    searchRooms,
    highlightSearchTerms,
    clearSearchHistory,
    clearSearchResults,
    setSearchFilters,

    // ========== Notifications ==========
    notifications: notificationState.notifications,
    addNotificationRule,
    removeNotificationRule,
    updateNotificationRule,
    toggleGlobalNotifications,
    toggleSoundNotifications,
    toggleDoNotDisturb,
    setDoNotDisturbTime,
    updateRoomNotificationSettings,
    getRoomNotificationSettings,
    clearNotificationRules,
    resetNotificationSettings,

    // ========== RTC Calls ==========
    callState: callState.callState,
    startCall,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    resetCallState,
    isInCall,
    getCallState,

    // ========== Cache ==========
    cacheSettings: cacheState.cacheSettings,
    cacheMetrics: cacheState.cacheMetrics,
    clearCache,
    optimizeCache,
    updateCacheSettings,
    getCacheStats,

    // ========== Settings ==========
    settings: settingsState.settings,
    menuTop: settingsState.menuTop,
    setTheme,
    setLanguage,
    setFontSize,
    setMessageDensity,
    toggleAutoPlayGifs,
    toggleShowReadReceipts,
    toggleShowTypingNotifications,
    toggleEnableEncryption,
    setBackupFrequency,
    updateSettingsCache,
    updateSettingsNotifications,
    updateMenuTop,
    getTheme,
    getLanguage,
    resetSettingsToDefaults,
    exportSettings,
    importSettings
  }
})

// Type exports
export type {
  MenuItem,
  UserProfile,
  AuthState,
  ChatMessage,
  Room,
  MediaFile,
  DownloadQueue,
  NotificationRule,
  NotificationSettings,
  CallState,
  Device,
  CacheSettings,
  CacheMetrics,
  SearchState,
  AppSettings,
  RoomSearchResult
} from '../types'
