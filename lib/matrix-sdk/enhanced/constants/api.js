/*
Copyright 2024 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * Enhanced Module API paths (relative to apiPrefix)
 * These paths are designed to work with the apiPrefix (default: /_synapse/enhanced)
 * The full URL will be: baseUrl + apiPrefix + path
 *
 * For standard Matrix Client-Server API paths (that don't use apiPrefix),
 * use the full paths starting with /_matrix/client/r0 directly in the API classes.
 *
 * Reference: docs/sdk/api-SDK/rust-api.md
 */
export var EnhancedApi = {
  // Friends API (matches rust-api.md Section 9)
  FRIENDS: "/friends",
  FRIENDS_SEARCH: "/friends/search",
  FRIENDS_DETAIL: "/friends/{userId}",
  FRIENDS_REMARK: "/friends/{userId}/remark",
  FRIENDS_DELETE: "/friends/{userId}",
  FRIENDS_CHECK: "/friends/{userId}/check",
  FRIENDS_REQUEST: "/friend/request",
  FRIENDS_REQUESTS: "/friend/requests",
  FRIENDS_REQUEST_ACCEPT: "/friend/request/{requestId}/accept",
  FRIENDS_REQUEST_DECLINE: "/friend/request/{requestId}/decline",
  FRIENDS_CATEGORIES: "/friends/categories",
  FRIENDS_CATEGORY_CREATE: "/friends/categories",
  FRIENDS_CATEGORY_UPDATE: "/friends/categories/{categoryName}",
  FRIENDS_CATEGORY_DELETE: "/friends/categories/{categoryName}",
  FRIENDS_BLOCKED_LIST: "/friends/blocked",
  FRIENDS_BLOCK: "/friends/blocked",
  FRIENDS_BLOCKED_CHECK: "/friends/blocked/{userId}",
  FRIENDS_UNBLOCK: "/friends/blocked/{userId}",
  // Chatrooms API (backward compatibility - not in rust-api.md)
  CHATROOMS: "/chatrooms",
  CHATROOMS_DETAIL: "/chatrooms/{roomId}",
  CHATROOMS_MESSAGES: "/chatrooms/{roomId}/messages",
  CHATROOMS_UNREAD: "/chatrooms/unread-count",
  CHATROOMS_LEAVE: "/chatrooms/{roomId}/leave",
  CHATROOMS_MARK_READ: "/chatrooms/{roomId}/read",
  // Messages API
  MESSAGES_SEARCH: "/messages/search",
  MESSAGES_DELETE: "/messages/{messageId}",
  // Private Chat API (matches rust-api.md Section 10)
  PRIVATE_SESSIONS: "/private/sessions",
  PRIVATE_SESSION_DETAIL: "/private/sessions/{sessionId}",
  PRIVATE_SESSION_DELETE: "/private/sessions/{sessionId}/close",
  PRIVATE_SESSION_MESSAGES: "/private/sessions/{sessionId}/messages",
  PRIVATE_MESSAGES_SEND: "/private/messages",
  PRIVATE_MESSAGE_DELETE: "/private/messages/{messageId}",
  PRIVATE_MESSAGE_READ: "/private/messages/{messageId}/read",
  PRIVATE_UNREAD_COUNT: "/private/unread-count",
  PRIVATE_SEARCH: "/private/search",
  PRIVATE_SESSION_STATS: "/private/sessions/{sessionId}/statistics",
  PRIVATE_ROOM_LEAVE: "/private/rooms/{roomId}/leave",
  PRIVATE_ROOM_MUTE: "/private/rooms/{roomId}/mute",
  PRIVATE_ROOM_FILES: "/private/rooms/{roomId}/files",
  PRIVATE_ROOM_VOICE: "/private/rooms/{roomId}/voice",
  // Voice API (uses full Matrix path, not relative to apiPrefix)
  VOICE: "/voice",
  VOICE_CONFIG: "/voice/config",
  VOICE_UPLOAD: "/voice/upload",
  VOICE_CONVERT: "/voice/convert",
  VOICE_OPTIMIZE: "/voice/optimize",
  VOICE_STATS: "/voice/stats",
  VOICE_DETAIL: "/voice/{messageId}",
  VOICE_DELETE: "/voice/{messageId}",
  VOICE_DOWNLOAD: "/voice/{messageId}/download",
  VOICE_USER: "/voice/user/{userId}",
  VOICE_USER_STATS: "/voice/user/{userId}/stats",
  VOICE_ROOM: "/voice/room/{roomId}",
  // Security API
  SECURITY: "/security",
  SECURITY_CHECK_USER: "/security/check-user/{userId}",
  SECURITY_CHECK_IP: "/security/check-ip/{ip}",
  SECURITY_BLOCK_IP: "/security/block-ip",
  SECURITY_UNBLOCK_IP: "/security/unblock-ip/{ip}",
  SECURITY_SENSITIVE: "/security/sensitive",
  SECURITY_DESTROY: "/security/destroy",
  SECURITY_EVENTS: "/security/events",
  // Presence API
  PRESENCE: "/presence",
  PRESENCE_STATUS: "/presence/{userId}",
  PRESENCE_SET: "/presence/status"
};

/**
 * Standard Matrix Client-Server API paths (full paths)
 * These are used when directly calling Matrix standard endpoints
 */
export var MatrixClientApi = {
  BASE: "/_matrix/client/r0",
  FRIENDS: "/_matrix/client/r0/friends",
  FRIENDS_REQUESTS: "/_matrix/client/r0/friends/requests",
  FRIENDS_CATEGORIES: "/_matrix/client/r0/friends/categories",
  FRIENDS_BLOCKED: "/_matrix/client/r0/friends/blocked",
  FRIENDS_STATS: "/_matrix/client/r0/friends/stats",
  FRIENDS_VERIFICATION: "/_matrix/client/r0/friends/verification",
  CHATROOMS: "/_matrix/client/r0/chatrooms",
  CHATROOMS_MESSAGES: "/_matrix/client/r0/chatrooms/{roomId}/messages",
  CHATROOMS_UNREAD: "/_matrix/client/r0/chatrooms/unread-count",
  CHATROOMS_LEAVE: "/_matrix/client/r0/chatrooms/{roomId}/leave",
  CHATROOMS_MARK_READ: "/_matrix/client/r0/chatrooms/{roomId}/read",
  MESSAGES_SEARCH: "/_matrix/client/r0/messages/search",
  MESSAGES_DELETE: "/_matrix/client/r0/messages/{messageId}",
  PRIVATE_CHAT: "/_matrix/client/r0/private_chat",
  PRIVATE_CHAT_SESSIONS: "/_matrix/client/r0/private_chat/sessions",
  PRIVATE_CHAT_MESSAGES: "/_matrix/client/r0/private_chat/sessions/{sessionId}/messages",
  PRIVATE_CHAT_FILES: "/_matrix/client/r0/private_chat/sessions/{sessionId}/files",
  PRIVATE_CHAT_VOICE: "/_matrix/client/r0/private_chat/sessions/{sessionId}/voice",
  PRIVATE_CHAT_DELETE: "/_matrix/client/r0/private_chat/sessions/{sessionId}/close",
  VOICE: "/_matrix/client/r0/voice",
  VOICE_CALLS: "/_matrix/client/r0/voice/calls",
  VOICE_CALLS_ANSWER: "/_matrix/client/r0/voice/calls/{callId}/answer",
  VOICE_CALLS_HANGUP: "/_matrix/client/r0/voice/calls/{callId}/hangup",
  SECURITY: "/_matrix/client/r0/security",
  SECURITY_SENSITIVE: "/_matrix/client/r0/security/sensitive",
  SECURITY_DESTROY: "/_matrix/client/r0/security/destroy",
  PRESENCE: "/_matrix/client/r0/presence"
};
export var SynapseAdminApi = {
  BASE: "/_synapse/admin/v2",
  VOICE: "/_synapse/admin/v2/voice",
  PRIVATE_CHAT: "/_synapse/admin/v2/private_chat",
  PRIVATE_CHAT_USERS: "/_synapse/admin/v2/private_chat/users",
  PRIVATE_CHAT_CONFIG: "/_synapse/admin/v2/private_chat/config",
  PRIVATE_CHAT_ENABLED: "/_synapse/admin/v2/private_chat/users/enabled",
  PRIVATE_CHAT_ADMIN: "/_synapse/admin/v2/private_chat/admin",
  PRIVATE_CHAT_ADMIN_SESSIONS: "/_synapse/admin/v2/private_chat/admin/sessions",
  PRIVATE_CHAT_ADMIN_MESSAGES: "/_synapse/admin/v2/private_chat/admin/messages",
  USERS: "/_synapse/admin/v2/users",
  USERS_CREATE: "/_synapse/admin/v2/users/create",
  USERS_DETAILS: "/_synapse/admin/v2/users/{userId}",
  USERS_SUSPEND: "/_synapse/admin/v2/users/{userId}/suspend",
  USERS_ACTIVATE: "/_synapse/admin/v2/users/{userId}/activate",
  USERS_DEACTIVATE: "/_synapse/admin/v2/users/{userId}/deactivate",
  USERS_PASSWORD: "/_synapse/admin/v2/users/{userId}/password",
  USERS_ROOMS: "/_synapse/admin/v2/users/{userId}/rooms",
  USERS_DEVICE: "/_synapse/admin/v2/users/{userId}/devices",
  USERS_PERMISSIONS: "/_synapse/admin/v2/users/{userId}/permissions",
  USERS_BATCH: "/_synapse/admin/v2/users/batch",
  ROOMS: "/_synapse/admin/v2/rooms",
  ROOMS_CREATE: "/_synapse/admin/v2/rooms/create",
  ROOMS_DETAILS: "/_synapse/admin/v2/rooms/{roomId}",
  ROOMS_DELETE: "/_synapse/admin/v2/rooms/{roomId}/delete",
  ROOMS_MEMBERS: "/_synapse/admin/v2/rooms/{roomId}/members",
  ROOMS_MESSAGES: "/_synapse/admin/v2/rooms/{roomId}/messages",
  ROOMS_STATE: "/_synapse/admin/v2/rooms/{roomId}/state",
  ROOMS_BATCH: "/_synapse/admin/v2/rooms/batch",
  ROOMS_SEARCH: "/_synapse/admin/v2/rooms/search",
  MESSAGES: "/_synapse/admin/v2/messages",
  MESSAGES_SEARCH: "/_synapse/admin/v2/messages/search",
  MESSAGES_BATCH: "/_synapse/admin/v2/messages/batch",
  MESSAGES_MODERATE: "/_synapse/admin/v2/messages/moderate",
  MESSAGES_DETAILS: "/_synapse/admin/v2/messages/{messageId}",
  STATS: "/_synapse/admin/v2/stats",
  STATS_USAGE: "/_synapse/admin/v2/stats/usage",
  STATS_ROOM: "/_synapse/admin/v2/stats/room",
  DASHBOARD: "/_synapse/admin/v2/dashboard",
  ADMINS: "/_synapse/admin/v2/admins",
  ADMINS_PROFILE: "/_synapse/admin/v2/profile",
  ADMINS_ROLE: "/_synapse/admin/v2/admins/{adminId}/role",
  ADMINS_ACTIVITY: "/_synapse/admin/v2/admins/activity",
  AUDIT_LOGS: "/_synapse/admin/v2/audit-logs",
  CONFIG: "/_synapse/admin/v2/config",
  CONFIG_EXPORT: "/_synapse/admin/v2/config/export",
  CONFIG_VERSIONS: "/_synapse/admin/v2/config/versions",
  BLACKLIST: "/_synapse/admin/v2/blacklist",
  BLACKLIST_ADD: "/_synapse/admin/v2/blacklist/add",
  BLACKLIST_REMOVE: "/_synapse/admin/v2/blacklist/remove",
  BLACKLIST_LIST: "/_synapse/admin/v2/blacklist/list",
  HEALTH: "/_synapse/admin/v2/health",
  MEDIA: "/_synapse/admin/v2/media",
  MEDIA_DETAILS: "/_synapse/admin/v2/media/{serverName}/{mediaId}",
  MEDIA_DELETE: "/_synapse/admin/v2/media/{serverName}/{mediaId}/delete",
  SECURITY_ADMIN: "/_synapse/admin/v2/security",
  SECURITY_ADMIN_EVENTS: "/_synapse/admin/v2/security/events",
  SECURITY_ADMIN_BLOCK: "/_synapse/admin/v2/security/block",
  SECURITY_ADMIN_UNBLOCK: "/_synapse/admin/v2/security/unblock"
};
export var ApiVersion = {
  MATRIX_CLIENT: "r0",
  SYNAPSE_ADMIN: "v2"
};
export var PaginationDefaults = {
  PAGE: 1,
  LIMIT: 50,
  MAX_LIMIT: 1000
};
export var RateLimitDefaults = {
  MAX_REQUESTS: 100,
  WINDOW_MS: 60000
};
export var MessageLimits = {
  MAX_CONTENT_LENGTH: 65536,
  MAX_MESSAGE_ID_LENGTH: 255,
  MAX_ROOM_ID_LENGTH: 255,
  MAX_USER_ID_LENGTH: 255
};

/**
 * Backend profile types for different Matrix server implementations
 */

/**
 * Backend profile configuration
 * Each profile has its own path prefix and API version preferences
 */
export var BackendProfiles = {
  /**
   * Standard Matrix.org Client-Server API
   */
  matrix: {
    name: "matrix",
    clientBase: "/_matrix/client/r0",
    adminBase: "/_synapse/admin/v2",
    friendsPrefix: "/_matrix/client/r0/friends",
    privateChatPrefix: "/_matrix/client/r0/private_chat",
    voicePrefix: "/_matrix/client/r0/voice",
    useMultipartVoice: true,
    responseFormat: "wrapped"
  },
  /**
   * Synapse Rust (Enhanced) Backend
   * Uses different path structure and response format
   * Matches the API specification in docs/sdk/api-SDK/rust-api.md
   */
  synapse_rust: {
    name: "synapse_rust",
    clientBase: "/_matrix/client/r0",
    adminBase: "/_synapse/admin/v1",
    friendsPrefix: "/_synapse/enhanced/friends",
    privateChatPrefix: "/_synapse/enhanced/private",
    voicePrefix: "/_matrix/client/r0/voice",
    useMultipartVoice: false,
    // Uses JSON base64 instead
    responseFormat: "raw" // Supports bare responses
  },
  /**
   * Synapse Python (Legacy) Backend
   */
  synapse_python: {
    name: "synapse_python",
    clientBase: "/_matrix/client/r0",
    adminBase: "/_synapse/admin/v2",
    friendsPrefix: "/_matrix/client/r0/friends",
    privateChatPrefix: "/_matrix/client/r0/private_chat",
    voicePrefix: "/_matrix/client/r0/voice",
    useMultipartVoice: true,
    responseFormat: "wrapped"
  }
};

/**
 * Current active backend profile
 * Can be changed via setBackendProfile()
 */
var currentProfile = "matrix";

/**
 * Get the current backend profile configuration
 */
export function getBackendProfile() {
  return currentProfile;
}

/**
 * Set the backend profile for API requests
 * Use this to switch between different Matrix server implementations
 */
export function setBackendProfile(profile) {
  currentProfile = profile;
}

/**
 * Get configuration for the current backend profile
 */
export function getBackendConfig() {
  return BackendProfiles[currentProfile];
}

/**
 * Check if the current profile is Synapse Rust
 */
export function isSynapseRust() {
  return currentProfile === "synapse_rust";
}

/**
 * Check if the current profile uses wrapped response format
 */
export function useWrappedResponse() {
  return getBackendConfig().responseFormat === "wrapped";
}

/**
 * Get the appropriate admin API base path for current profile
 */
export function getAdminBasePath() {
  return getBackendConfig().adminBase;
}

/**
 * Get the appropriate friends API prefix for current profile
 */
export function getFriendsPrefix() {
  return getBackendConfig().friendsPrefix;
}

/**
 * Get the appropriate private chat prefix for current profile
 */
export function getPrivateChatPrefix() {
  return getBackendConfig().privateChatPrefix;
}

/**
 * Check if voice upload should use multipart (vs JSON base64)
 */
export function useMultipartVoiceUpload() {
  return getBackendConfig().useMultipartVoice;
}
//# sourceMappingURL=api.js.map