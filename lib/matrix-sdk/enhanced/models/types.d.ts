/**
 * Types for Matrix Synapse Enhanced Features SDK
 *
 * This file re-exports types from modular type files for backward compatibility.
 * New types should be added to the appropriate module file in models/.
 */
import type { IFriendsApi } from "./friends.types.ts";
import type { IPrivateChatApi, ISecurityApi, IAdminApi } from "./security.types.ts";
import type { IVoiceApi } from "./voice.types.ts";
import type { IPresenceApi } from "./presence.types.ts";
export { type PaginationParams, type OffsetPaginationParams, type PaginatedResult, type CursorPaginatedResult, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, DEFAULT_PAGE, } from "../api/pagination.ts";
export type * from "./friends.types.ts";
export { type ISendFriendRequestParams, type IAcceptFriendRequestResult, type IRejectFriendRequestResult, type IFriendRequestsApi, type IFriendRequestV2, } from "./friend-requests.types.ts";
export { type IFriendCategories, type ISetCategoriesResult, type IGetCategoryResult, type IUpdateCategoryResult, type IDeleteCategoryResult, type IAddUserToCategoryResult, type IRemoveUserFromCategoryResult, type IFriendCategoriesApi, type IFriendCategoryV2, } from "./friend-categories.types.ts";
export { type IGetBlockedResult, type IAddUserToBlockedResult, type ICheckBlockedResult, type IRemoveBlockedResult, type IBatchBlockUsersResult, type IBlockedUsersApi, type IBlockedUserV2, } from "./blocked-users.types.ts";
export type * from "./admin.types.ts";
export type * from "./security.types.ts";
export type * from "./presence.types.ts";
export type * from "./voice.types.ts";
export type * from "./private-chat-admin.types.ts";
export interface ISynapseEnhancedConfig {
    /** Base URL of the Synapse homeserver */
    baseUrl: string;
    /** Access token for authentication */
    accessToken: string;
    /** Prefix for enhanced API endpoints */
    apiPrefix?: string;
    /** Request timeout in milliseconds */
    timeout?: number;
}
export interface ISynapseEnhancedClient {
    /** The base URL of the homeserver */
    readonly baseUrl: string;
    /** The access token used for authentication */
    readonly accessToken: string;
    /** Friends API client */
    readonly friends: IFriendsApi;
    /** Private Chat API client */
    readonly privateChat: IPrivateChatApi;
    /** Security API client */
    readonly security: ISecurityApi;
    /** Voice Messages API client */
    readonly voice: IVoiceApi;
    /** Admin API client */
    readonly admin: IAdminApi;
    /** Presence API client */
    readonly presence: IPresenceApi;
    /** Get the module status */
    getStatus(): Promise<ISynapseStatus>;
}
export interface ISynapseStatus {
    version: string;
    status: "healthy" | "degraded" | "unhealthy";
    initialized?: boolean;
    features: {
        friends: boolean;
        admin: boolean;
        security: boolean;
        voice: boolean;
    };
    modules?: {
        friends: boolean;
        admin: boolean;
        security: boolean;
        voice: boolean;
    };
}
export interface ISynapseError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
export interface ISynapseResponse<T = unknown> {
    status: string;
    data?: T;
    error?: ISynapseError;
}
//# sourceMappingURL=types.d.ts.map