import { SynapseEnhancedHttpClient } from "./utils/http.ts";
import { PrivateChatStatusApi } from "./api/private-chat-status.ts";
import { ChatroomApi } from "./api/chatroom.ts";
import { VoiceUserApi } from "./api/voice-user.ts";
import { AdminApi } from "./api/admin.ts";
import { PresenceApi } from "./api/presence.ts";
import { MessagesApi } from "./api/messages.ts";
import { SecurityAdminApi } from "./api/security-admin.ts";
import { EnhancedInitApi } from "./api/enhanced.ts";
import { FriendRequestsApi } from "./api/friend-requests.ts";
import { FriendCategoriesApi } from "./api/friend-categories.ts";
import { BlockedUsersApi } from "./api/blocked-users.ts";
import { PrivateChatAdminApi } from "./api/private-chat-admin.ts";
import { AudioUploadApi } from "./api/audio-upload.ts";
import type { ISynapseEnhancedConfig, ISynapseStatus, IFriendsApi, IPrivateChatApi, ISecurityApi, IVoiceApi, IAdminApi, IPresenceApi } from "./models/types.ts";
/**
 * SynapseEnhancedClient - Client entry point for Synapse enhanced features
 * Integrates enhanced APIs including friends management, private chat, chat room,
 * security detection, voice processing, etc.
 */
export declare class SynapseEnhancedClient implements ISynapseEnhancedConfig {
    readonly baseUrl: string;
    readonly accessToken: string;
    readonly apiPrefix: string;
    readonly timeout: number;
    private readonly httpClient;
    private readonly _friends;
    private readonly _privateChat;
    private readonly _privateChatStatus;
    private readonly _chatroom;
    private readonly _security;
    private readonly _voice;
    private readonly _voiceUser;
    private readonly _admin;
    private readonly _presence;
    private readonly _messages;
    private readonly _securityAdmin;
    private readonly _enhanced;
    private readonly _friendRequests;
    private readonly _friendCategories;
    private readonly _blockedUsers;
    private readonly _privateChatAdmin;
    private readonly _audioUpload;
    constructor(config: ISynapseEnhancedConfig);
    get friends(): IFriendsApi;
    get privateChat(): IPrivateChatApi;
    get privateChatStatus(): PrivateChatStatusApi;
    get chatroom(): ChatroomApi;
    get security(): ISecurityApi;
    get voice(): IVoiceApi;
    get admin(): IAdminApi;
    get presence(): IPresenceApi;
    get messages(): MessagesApi;
    get securityAdmin(): SecurityAdminApi;
    get enhanced(): EnhancedInitApi;
    get voiceUser(): VoiceUserApi;
    get friendRequests(): FriendRequestsApi;
    get friendCategories(): FriendCategoriesApi;
    get blockedUsers(): BlockedUsersApi;
    get privateChatAdmin(): PrivateChatAdminApi;
    get audioUpload(): AudioUploadApi;
    getHttpClient(): SynapseEnhancedHttpClient;
    getEnhancedClient(): {
        friends: IFriendsApi;
        privateChat: IPrivateChatApi;
        privateChatStatus: PrivateChatStatusApi;
        chatroom: ChatroomApi;
        security: ISecurityApi;
        voice: IVoiceApi;
        voiceUser: VoiceUserApi;
        admin: AdminApi;
        presence: PresenceApi;
        messages: MessagesApi;
        securityAdmin: SecurityAdminApi;
        enhanced: EnhancedInitApi;
        friendRequests: FriendRequestsApi;
        friendCategories: FriendCategoriesApi;
        blockedUsers: BlockedUsersApi;
        privateChatAdmin: PrivateChatAdminApi;
        audioUpload: AudioUploadApi;
    };
    /**
     * Get the runtime status of Synapse enhanced features
     * @returns Status information including version, initialization state, and supported features
     */
    getStatus(): Promise<ISynapseStatus>;
}
export type { IFriend, IFriendRequest, IFriendCategory, IBlockedUser, IFriendStatistics, IFriendSearchResult, IUserSearchResult, ISendFriendRequest, IPaginationParams, IPaginationResult, } from "./models/types.ts";
export type { IPrivateSession, IPrivateMessage, ISessionKey, ICreateSession, ISendMessage, ISessionStatistics, } from "./models/types.ts";
export type { IThreatDetection, IThreatResult, IBlockedIp, IHighRiskIp, IReputationStats, ISecurityEvent, ISecurityEventParams, IIpStatus, } from "./models/types.ts";
export type { ISecurityRule, ISecurityPolicy, ISecurityConfig } from "./models/types.ts";
export type { IPrivateChatFeatures, IPrivateChatCapabilities } from "./api/private-chat-status.ts";
export type { IVoiceUserPreferences, IVoiceUserQuota, IVoiceUserConfig, IVoiceUserStats } from "./api/voice-user.ts";
export type { IMessageSearchResult, IMessageSearchParams } from "./api/messages.ts";
export type { ISecurityEvent as ISecurityEventDetail, ISecurityStats } from "./api/security-admin.ts";
export type { IDbConfig, IInitializationParams, IInitializationResult, IModuleStatus } from "./api/enhanced.ts";
export type { IVoiceMessage, IVoiceInfo, IVoiceUploadParams, IVoiceConvertParams, IVoiceOptimizeParams, IConvertResult, IOptimizeResult, } from "./models/types.ts";
export type { IChatroom, IChatroomParams, IUnreadCount, IPagination } from "./api/chatroom.ts";
export type { IAdminUser, IAdminRoom, ISystemStatistics, IAdminParams, IAdminPaginationResult, ISystemHealth, IHealthResponse, } from "./models/types.ts";
export type { ISynapseStatus, ISynapseError, ISynapseResponse } from "./models/types.ts";
export { SynapseEnhancedHttpClient, SynapseEnhancedError } from "./utils/http.ts";
export type { BatchOperationFailure, BatchOperationResult } from "./utils/batch-errors.ts";
export { BatchOperationError, isBatchOperationError, extractBatchFailures } from "./utils/batch-errors.ts";
export { MessagesApi } from "./api/messages.ts";
export { SecurityAdminApi } from "./api/security-admin.ts";
export { EnhancedInitApi } from "./api/enhanced.ts";
export { PrivateChatStatusApi } from "./api/private-chat-status.ts";
export { VoiceUserApi } from "./api/voice-user.ts";
export { ChatroomApi } from "./api/chatroom.ts";
export { FriendRequestsApi } from "./api/friend-requests.ts";
export { FriendCategoriesApi } from "./api/friend-categories.ts";
export { BlockedUsersApi } from "./api/blocked-users.ts";
export { PrivateChatAdminApi } from "./api/private-chat-admin.ts";
export { AudioUploadApi } from "./api/audio-upload.ts";
export { UnifiedMatrixClient, type IUnifiedClientConfig } from "./api/unified-client.ts";
export type { IRegisterParams, IRegisterResponse, IUnifiedLoginParams, ILoginResponse, } from "./api/unified-client.types.ts";
export type { IRefreshParams, IRefreshResponse, IUserProfile, ICreateRoomParams } from "./api/unified-client.types.ts";
export type { ICreateRoomResponse, IRoomInfo, IPublicRoomsParams, IPublicRoomsResponse, } from "./api/unified-client.types.ts";
export type { ISendMessageParams, IUnifiedSendEventResponse, IMessagesParams, IMessagesResponse, } from "./api/unified-client.types.ts";
export type { IEditMessageParams, IRedactParams, IRedactResponse, IUserRoomsResponse, } from "./api/unified-client.types.ts";
export type { IInviteParams, IKickBanParams, IJoinRoomParams, ILeaveRoomParams } from "./api/unified-client.types.ts";
export type { ISynapseEnhancedConfig } from "./models/types.ts";
//# sourceMappingURL=index.d.ts.map