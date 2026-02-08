import { SynapseEnhancedHttpClient } from "../utils/http.ts";
import { SynapseEnhancedClient, type ISynapseEnhancedConfig } from "../index.ts";
import type { IRegisterParams, IRegisterResponse, IUnifiedLoginParams, ILoginResponse, IRefreshParams, IRefreshResponse, IUserProfile, ICreateRoomParams, ICreateRoomResponse, IRoomInfo, IPublicRoomsParams, IPublicRoomsResponse, ISendMessageParams, IUnifiedSendEventResponse, IMessagesParams, IMessagesResponse, IEditMessageParams, IRedactParams, IRedactResponse, IUserRoomsResponse, IInviteParams, IJoinRoomParams, ILeaveRoomParams } from "./unified-client.types.ts";
export interface IUnifiedClientConfig extends ISynapseEnhancedConfig {
    baseUrl: string;
    accessToken: string;
}
/**
 * UnifiedMatrixClient - Unified Matrix client
 * Integrates standard Matrix Client API and Synapse enhanced features
 */
export declare class UnifiedMatrixClient {
    private readonly httpClient;
    private readonly enhancedClient;
    private readonly basePath;
    /**
     * Authentication related operations
     */
    readonly auth: {
        register: (params: IRegisterParams) => Promise<IRegisterResponse>;
        login: (params: IUnifiedLoginParams) => Promise<ILoginResponse>;
        logout: () => Promise<void>;
        logoutAll: () => Promise<void>;
        refreshToken: (params: IRefreshParams) => Promise<IRefreshResponse>;
    };
    /**
     * User account related operations
     */
    readonly user: {
        whoami: () => Promise<{
            user_id: string;
            device_id?: string;
        }>;
        getProfile: (userId: string) => Promise<IUserProfile>;
        updateDisplayname: (userId: string, displayname: string) => Promise<void>;
        updateAvatar: (userId: string, avatarUrl: string) => Promise<void>;
        changePassword: (newPassword: string, auth?: Record<string, unknown>) => Promise<void>;
        deactivateAccount: (auth?: Record<string, unknown>, idServer?: string) => Promise<{
            id_server_unbind_result: string;
        }>;
    };
    /**
     * Room related operations
     */
    readonly room: {
        createRoom: (params: ICreateRoomParams) => Promise<ICreateRoomResponse>;
        joinRoom: (roomId: string, params?: IJoinRoomParams) => Promise<{
            room_id: string;
        }>;
        leaveRoom: (roomId: string, params?: ILeaveRoomParams) => Promise<void>;
        inviteUser: (roomId: string, params: IInviteParams) => Promise<void>;
        kickUser: (roomId: string, userId: string, reason?: string) => Promise<void>;
        banUser: (roomId: string, userId: string, reason?: string) => Promise<void>;
        unbanUser: (roomId: string, userId: string) => Promise<void>;
        getRoomInfo: (roomId: string) => Promise<IRoomInfo>;
        deleteRoom: (roomId: string) => Promise<void>;
        getPublicRooms: (params?: IPublicRoomsParams) => Promise<IPublicRoomsResponse>;
        getUserRooms: (userId: string) => Promise<IUserRoomsResponse>;
    };
    /**
     * Message related operations
     */
    readonly message: {
        sendMessage: (roomId: string, eventType: string, content: ISendMessageParams, txnId?: string) => Promise<IUnifiedSendEventResponse>;
        getMessages: (roomId: string, params: IMessagesParams) => Promise<IMessagesResponse>;
        editMessage: (roomId: string, eventId: string, eventType: string, params: IEditMessageParams, txnId?: string) => Promise<IUnifiedSendEventResponse>;
        replyMessage: (roomId: string, eventId: string, content: ISendMessageParams) => Promise<IUnifiedSendEventResponse>;
        redactEvent: (roomId: string, eventId: string, params?: IRedactParams, txnId?: string) => Promise<IRedactResponse>;
    };
    /**
     * Enhanced features client
     */
    readonly enhanced: ReturnType<SynapseEnhancedClient["getEnhancedClient"]>;
    constructor(config: IUnifiedClientConfig);
    private register;
    private login;
    private logout;
    private logoutAll;
    private refreshToken;
    private whoami;
    private getProfile;
    private updateDisplayname;
    private updateAvatar;
    private changePassword;
    private deactivateAccount;
    private createRoom;
    private joinRoom;
    private leaveRoom;
    private inviteUser;
    private kickUser;
    private banUser;
    private unbanUser;
    private getRoomInfo;
    private deleteRoom;
    private getPublicRooms;
    private getUserRooms;
    private sendMessage;
    private getMessages;
    private editMessage;
    private replyMessage;
    private redactEvent;
    private generateTransactionId;
    getEnhancedClient(): SynapseEnhancedClient;
    getHttpClient(): SynapseEnhancedHttpClient;
}
//# sourceMappingURL=unified-client.d.ts.map