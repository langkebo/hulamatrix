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
export declare const EnhancedApi: {
    readonly FRIENDS: "/friends";
    readonly FRIENDS_SEARCH: "/friends/search";
    readonly FRIENDS_DETAIL: "/friends/{userId}";
    readonly FRIENDS_REMARK: "/friends/{userId}/remark";
    readonly FRIENDS_DELETE: "/friends/{userId}";
    readonly FRIENDS_CHECK: "/friends/{userId}/check";
    readonly FRIENDS_REQUEST: "/friend/request";
    readonly FRIENDS_REQUESTS: "/friend/requests";
    readonly FRIENDS_REQUEST_ACCEPT: "/friend/request/{requestId}/accept";
    readonly FRIENDS_REQUEST_DECLINE: "/friend/request/{requestId}/decline";
    readonly FRIENDS_CATEGORIES: "/friends/categories";
    readonly FRIENDS_CATEGORY_CREATE: "/friends/categories";
    readonly FRIENDS_CATEGORY_UPDATE: "/friends/categories/{categoryName}";
    readonly FRIENDS_CATEGORY_DELETE: "/friends/categories/{categoryName}";
    readonly FRIENDS_BLOCKED_LIST: "/friends/blocked";
    readonly FRIENDS_BLOCK: "/friends/blocked";
    readonly FRIENDS_BLOCKED_CHECK: "/friends/blocked/{userId}";
    readonly FRIENDS_UNBLOCK: "/friends/blocked/{userId}";
    readonly CHATROOMS: "/chatrooms";
    readonly CHATROOMS_DETAIL: "/chatrooms/{roomId}";
    readonly CHATROOMS_MESSAGES: "/chatrooms/{roomId}/messages";
    readonly CHATROOMS_UNREAD: "/chatrooms/unread-count";
    readonly CHATROOMS_LEAVE: "/chatrooms/{roomId}/leave";
    readonly CHATROOMS_MARK_READ: "/chatrooms/{roomId}/read";
    readonly MESSAGES_SEARCH: "/messages/search";
    readonly MESSAGES_DELETE: "/messages/{messageId}";
    readonly PRIVATE_SESSIONS: "/private/sessions";
    readonly PRIVATE_SESSION_DETAIL: "/private/sessions/{sessionId}";
    readonly PRIVATE_SESSION_DELETE: "/private/sessions/{sessionId}/close";
    readonly PRIVATE_SESSION_MESSAGES: "/private/sessions/{sessionId}/messages";
    readonly PRIVATE_MESSAGES_SEND: "/private/messages";
    readonly PRIVATE_MESSAGE_DELETE: "/private/messages/{messageId}";
    readonly PRIVATE_MESSAGE_READ: "/private/messages/{messageId}/read";
    readonly PRIVATE_UNREAD_COUNT: "/private/unread-count";
    readonly PRIVATE_SEARCH: "/private/search";
    readonly PRIVATE_SESSION_STATS: "/private/sessions/{sessionId}/statistics";
    readonly PRIVATE_ROOM_LEAVE: "/private/rooms/{roomId}/leave";
    readonly PRIVATE_ROOM_MUTE: "/private/rooms/{roomId}/mute";
    readonly PRIVATE_ROOM_FILES: "/private/rooms/{roomId}/files";
    readonly PRIVATE_ROOM_VOICE: "/private/rooms/{roomId}/voice";
    readonly VOICE: "/voice";
    readonly VOICE_CONFIG: "/voice/config";
    readonly VOICE_UPLOAD: "/voice/upload";
    readonly VOICE_CONVERT: "/voice/convert";
    readonly VOICE_OPTIMIZE: "/voice/optimize";
    readonly VOICE_STATS: "/voice/stats";
    readonly VOICE_DETAIL: "/voice/{messageId}";
    readonly VOICE_DELETE: "/voice/{messageId}";
    readonly VOICE_DOWNLOAD: "/voice/{messageId}/download";
    readonly VOICE_USER: "/voice/user/{userId}";
    readonly VOICE_USER_STATS: "/voice/user/{userId}/stats";
    readonly VOICE_ROOM: "/voice/room/{roomId}";
    readonly SECURITY: "/security";
    readonly SECURITY_CHECK_USER: "/security/check-user/{userId}";
    readonly SECURITY_CHECK_IP: "/security/check-ip/{ip}";
    readonly SECURITY_BLOCK_IP: "/security/block-ip";
    readonly SECURITY_UNBLOCK_IP: "/security/unblock-ip/{ip}";
    readonly SECURITY_SENSITIVE: "/security/sensitive";
    readonly SECURITY_DESTROY: "/security/destroy";
    readonly SECURITY_EVENTS: "/security/events";
    readonly PRESENCE: "/presence";
    readonly PRESENCE_STATUS: "/presence/{userId}";
    readonly PRESENCE_SET: "/presence/status";
};
/**
 * Standard Matrix Client-Server API paths (full paths)
 * These are used when directly calling Matrix standard endpoints
 */
export declare const MatrixClientApi: {
    readonly BASE: "/_matrix/client/r0";
    readonly FRIENDS: "/_matrix/client/r0/friends";
    readonly FRIENDS_REQUESTS: "/_matrix/client/r0/friends/requests";
    readonly FRIENDS_CATEGORIES: "/_matrix/client/r0/friends/categories";
    readonly FRIENDS_BLOCKED: "/_matrix/client/r0/friends/blocked";
    readonly FRIENDS_STATS: "/_matrix/client/r0/friends/stats";
    readonly FRIENDS_VERIFICATION: "/_matrix/client/r0/friends/verification";
    readonly CHATROOMS: "/_matrix/client/r0/chatrooms";
    readonly CHATROOMS_MESSAGES: "/_matrix/client/r0/chatrooms/{roomId}/messages";
    readonly CHATROOMS_UNREAD: "/_matrix/client/r0/chatrooms/unread-count";
    readonly CHATROOMS_LEAVE: "/_matrix/client/r0/chatrooms/{roomId}/leave";
    readonly CHATROOMS_MARK_READ: "/_matrix/client/r0/chatrooms/{roomId}/read";
    readonly MESSAGES_SEARCH: "/_matrix/client/r0/messages/search";
    readonly MESSAGES_DELETE: "/_matrix/client/r0/messages/{messageId}";
    readonly PRIVATE_CHAT: "/_matrix/client/r0/private_chat";
    readonly PRIVATE_CHAT_SESSIONS: "/_matrix/client/r0/private_chat/sessions";
    readonly PRIVATE_CHAT_MESSAGES: "/_matrix/client/r0/private_chat/sessions/{sessionId}/messages";
    readonly PRIVATE_CHAT_FILES: "/_matrix/client/r0/private_chat/sessions/{sessionId}/files";
    readonly PRIVATE_CHAT_VOICE: "/_matrix/client/r0/private_chat/sessions/{sessionId}/voice";
    readonly PRIVATE_CHAT_DELETE: "/_matrix/client/r0/private_chat/sessions/{sessionId}/close";
    readonly VOICE: "/_matrix/client/r0/voice";
    readonly VOICE_CALLS: "/_matrix/client/r0/voice/calls";
    readonly VOICE_CALLS_ANSWER: "/_matrix/client/r0/voice/calls/{callId}/answer";
    readonly VOICE_CALLS_HANGUP: "/_matrix/client/r0/voice/calls/{callId}/hangup";
    readonly SECURITY: "/_matrix/client/r0/security";
    readonly SECURITY_SENSITIVE: "/_matrix/client/r0/security/sensitive";
    readonly SECURITY_DESTROY: "/_matrix/client/r0/security/destroy";
    readonly PRESENCE: "/_matrix/client/r0/presence";
};
export declare const SynapseAdminApi: {
    readonly BASE: "/_synapse/admin/v2";
    readonly VOICE: "/_synapse/admin/v2/voice";
    readonly PRIVATE_CHAT: "/_synapse/admin/v2/private_chat";
    readonly PRIVATE_CHAT_USERS: "/_synapse/admin/v2/private_chat/users";
    readonly PRIVATE_CHAT_CONFIG: "/_synapse/admin/v2/private_chat/config";
    readonly PRIVATE_CHAT_ENABLED: "/_synapse/admin/v2/private_chat/users/enabled";
    readonly PRIVATE_CHAT_ADMIN: "/_synapse/admin/v2/private_chat/admin";
    readonly PRIVATE_CHAT_ADMIN_SESSIONS: "/_synapse/admin/v2/private_chat/admin/sessions";
    readonly PRIVATE_CHAT_ADMIN_MESSAGES: "/_synapse/admin/v2/private_chat/admin/messages";
    readonly USERS: "/_synapse/admin/v2/users";
    readonly USERS_CREATE: "/_synapse/admin/v2/users/create";
    readonly USERS_DETAILS: "/_synapse/admin/v2/users/{userId}";
    readonly USERS_SUSPEND: "/_synapse/admin/v2/users/{userId}/suspend";
    readonly USERS_ACTIVATE: "/_synapse/admin/v2/users/{userId}/activate";
    readonly USERS_DEACTIVATE: "/_synapse/admin/v2/users/{userId}/deactivate";
    readonly USERS_PASSWORD: "/_synapse/admin/v2/users/{userId}/password";
    readonly USERS_ROOMS: "/_synapse/admin/v2/users/{userId}/rooms";
    readonly USERS_DEVICE: "/_synapse/admin/v2/users/{userId}/devices";
    readonly USERS_PERMISSIONS: "/_synapse/admin/v2/users/{userId}/permissions";
    readonly USERS_BATCH: "/_synapse/admin/v2/users/batch";
    readonly ROOMS: "/_synapse/admin/v2/rooms";
    readonly ROOMS_CREATE: "/_synapse/admin/v2/rooms/create";
    readonly ROOMS_DETAILS: "/_synapse/admin/v2/rooms/{roomId}";
    readonly ROOMS_DELETE: "/_synapse/admin/v2/rooms/{roomId}/delete";
    readonly ROOMS_MEMBERS: "/_synapse/admin/v2/rooms/{roomId}/members";
    readonly ROOMS_MESSAGES: "/_synapse/admin/v2/rooms/{roomId}/messages";
    readonly ROOMS_STATE: "/_synapse/admin/v2/rooms/{roomId}/state";
    readonly ROOMS_BATCH: "/_synapse/admin/v2/rooms/batch";
    readonly ROOMS_SEARCH: "/_synapse/admin/v2/rooms/search";
    readonly MESSAGES: "/_synapse/admin/v2/messages";
    readonly MESSAGES_SEARCH: "/_synapse/admin/v2/messages/search";
    readonly MESSAGES_BATCH: "/_synapse/admin/v2/messages/batch";
    readonly MESSAGES_MODERATE: "/_synapse/admin/v2/messages/moderate";
    readonly MESSAGES_DETAILS: "/_synapse/admin/v2/messages/{messageId}";
    readonly STATS: "/_synapse/admin/v2/stats";
    readonly STATS_USAGE: "/_synapse/admin/v2/stats/usage";
    readonly STATS_ROOM: "/_synapse/admin/v2/stats/room";
    readonly DASHBOARD: "/_synapse/admin/v2/dashboard";
    readonly ADMINS: "/_synapse/admin/v2/admins";
    readonly ADMINS_PROFILE: "/_synapse/admin/v2/profile";
    readonly ADMINS_ROLE: "/_synapse/admin/v2/admins/{adminId}/role";
    readonly ADMINS_ACTIVITY: "/_synapse/admin/v2/admins/activity";
    readonly AUDIT_LOGS: "/_synapse/admin/v2/audit-logs";
    readonly CONFIG: "/_synapse/admin/v2/config";
    readonly CONFIG_EXPORT: "/_synapse/admin/v2/config/export";
    readonly CONFIG_VERSIONS: "/_synapse/admin/v2/config/versions";
    readonly BLACKLIST: "/_synapse/admin/v2/blacklist";
    readonly BLACKLIST_ADD: "/_synapse/admin/v2/blacklist/add";
    readonly BLACKLIST_REMOVE: "/_synapse/admin/v2/blacklist/remove";
    readonly BLACKLIST_LIST: "/_synapse/admin/v2/blacklist/list";
    readonly HEALTH: "/_synapse/admin/v2/health";
    readonly MEDIA: "/_synapse/admin/v2/media";
    readonly MEDIA_DETAILS: "/_synapse/admin/v2/media/{serverName}/{mediaId}";
    readonly MEDIA_DELETE: "/_synapse/admin/v2/media/{serverName}/{mediaId}/delete";
    readonly SECURITY_ADMIN: "/_synapse/admin/v2/security";
    readonly SECURITY_ADMIN_EVENTS: "/_synapse/admin/v2/security/events";
    readonly SECURITY_ADMIN_BLOCK: "/_synapse/admin/v2/security/block";
    readonly SECURITY_ADMIN_UNBLOCK: "/_synapse/admin/v2/security/unblock";
};
export declare const ApiVersion: {
    readonly MATRIX_CLIENT: "r0";
    readonly SYNAPSE_ADMIN: "v2";
};
export declare const PaginationDefaults: {
    readonly PAGE: 1;
    readonly LIMIT: 50;
    readonly MAX_LIMIT: 1000;
};
export declare const RateLimitDefaults: {
    readonly MAX_REQUESTS: 100;
    readonly WINDOW_MS: 60000;
};
export declare const MessageLimits: {
    readonly MAX_CONTENT_LENGTH: 65536;
    readonly MAX_MESSAGE_ID_LENGTH: 255;
    readonly MAX_ROOM_ID_LENGTH: 255;
    readonly MAX_USER_ID_LENGTH: 255;
};
/**
 * Backend profile types for different Matrix server implementations
 */
export type BackendProfile = "matrix" | "synapse_rust" | "synapse_python";
/**
 * Backend profile configuration
 * Each profile has its own path prefix and API version preferences
 */
export declare const BackendProfiles: {
    /**
     * Standard Matrix.org Client-Server API
     */
    readonly matrix: {
        readonly name: "matrix";
        readonly clientBase: "/_matrix/client/r0";
        readonly adminBase: "/_synapse/admin/v2";
        readonly friendsPrefix: "/_matrix/client/r0/friends";
        readonly privateChatPrefix: "/_matrix/client/r0/private_chat";
        readonly voicePrefix: "/_matrix/client/r0/voice";
        readonly useMultipartVoice: true;
        readonly responseFormat: "wrapped";
    };
    /**
     * Synapse Rust (Enhanced) Backend
     * Uses different path structure and response format
     * Matches the API specification in docs/sdk/api-SDK/rust-api.md
     */
    readonly synapse_rust: {
        readonly name: "synapse_rust";
        readonly clientBase: "/_matrix/client/r0";
        readonly adminBase: "/_synapse/admin/v1";
        readonly friendsPrefix: "/_synapse/enhanced/friends";
        readonly privateChatPrefix: "/_synapse/enhanced/private";
        readonly voicePrefix: "/_matrix/client/r0/voice";
        readonly useMultipartVoice: false;
        readonly responseFormat: "raw";
    };
    /**
     * Synapse Python (Legacy) Backend
     */
    readonly synapse_python: {
        readonly name: "synapse_python";
        readonly clientBase: "/_matrix/client/r0";
        readonly adminBase: "/_synapse/admin/v2";
        readonly friendsPrefix: "/_matrix/client/r0/friends";
        readonly privateChatPrefix: "/_matrix/client/r0/private_chat";
        readonly voicePrefix: "/_matrix/client/r0/voice";
        readonly useMultipartVoice: true;
        readonly responseFormat: "wrapped";
    };
};
/**
 * Get the current backend profile configuration
 */
export declare function getBackendProfile(): BackendProfile;
/**
 * Set the backend profile for API requests
 * Use this to switch between different Matrix server implementations
 */
export declare function setBackendProfile(profile: BackendProfile): void;
/**
 * Get configuration for the current backend profile
 */
export declare function getBackendConfig(): (typeof BackendProfiles)[BackendProfile];
/**
 * Check if the current profile is Synapse Rust
 */
export declare function isSynapseRust(): boolean;
/**
 * Check if the current profile uses wrapped response format
 */
export declare function useWrappedResponse(): boolean;
/**
 * Get the appropriate admin API base path for current profile
 */
export declare function getAdminBasePath(): string;
/**
 * Get the appropriate friends API prefix for current profile
 */
export declare function getFriendsPrefix(): string;
/**
 * Get the appropriate private chat prefix for current profile
 */
export declare function getPrivateChatPrefix(): string;
/**
 * Check if voice upload should use multipart (vs JSON base64)
 */
export declare function useMultipartVoiceUpload(): boolean;
//# sourceMappingURL=api.d.ts.map