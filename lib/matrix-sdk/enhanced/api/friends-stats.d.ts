import { type SynapseEnhancedHttpClient } from "../utils/http.ts";
import type { IFriendStatistics, IFriendRecommendationResponse, IPaginationParams, IUserSearchResult, IMutualFriend, IRecentFriend, IInteractionRecord, IInteractionStats, IBlockedUser, IFriendRequestTemplate, IFriendshipVerification, IPaginatedResult } from "../models/types.ts";
import { BaseApi } from "../utils/base-api.ts";
export declare class FriendsStatsApi extends BaseApi {
    constructor(httpClient: SynapseEnhancedHttpClient);
    getFriendStats(): Promise<IFriendStatistics>;
    /**
     * @deprecated Use FriendsBasicApi.searchFriends() instead. This method will be removed in version 3.0.0.
     */
    getRecommendations(limit?: number, params?: IPaginationParams): Promise<IFriendRecommendationResponse>;
    /**
     * @deprecated This is a Synapse-specific extension. Use FriendsBasicApi.searchFriends() for standard Matrix API compatibility.
     */
    searchUsers(query: string, page?: number, pageSize?: number): Promise<IPaginatedResult<IUserSearchResult>>;
    /**
     * @deprecated This is a Synapse-specific extension. For standard Matrix API, use FriendsBasicApi.getFriends() and filter for mutual connections on the client side if needed.
     */
    getMutualFriends(userId: string, page?: number, pageSize?: number): Promise<IPaginatedResult<IMutualFriend>>;
    /**
     * @deprecated This is a Synapse-specific extension. For standard Matrix API, maintain a local cache of recently interacted friends using FriendsBasicApi.getFriends() with timestamp tracking.
     */
    getRecentFriends(limit?: number): Promise<IRecentFriend[]>;
    /**
     * @deprecated This is a Synapse-specific extension. Store interaction history locally using FriendsBasicApi events for standard Matrix API compatibility.
     */
    getFriendInteractions(friendId: string, page?: number, pageSize?: number): Promise<IPaginatedResult<IInteractionRecord>>;
    /**
     * @deprecated This is a Synapse-specific extension. Use FriendsBasicApi.sendMessage() to record interactions as room events for standard Matrix API compatibility.
     */
    recordInteraction(friendId: string, interactionType: string, content?: string, metadata?: Record<string, unknown>): Promise<string>;
    /**
     * @deprecated This is a Synapse-specific extension. Calculate interaction statistics locally using FriendsBasicApi.getEvents() for standard Matrix API compatibility.
     */
    getInteractionStats(userId: string): Promise<IInteractionStats>;
    /**
     * @deprecated This is a Synapse-specific extension. For standard Matrix API, use FriendsBlockApi.getBlockedUsers() and filter locally.
     */
    searchBlockedUsers(query?: string, page?: number, pageSize?: number): Promise<IPaginatedResult<IBlockedUser>>;
    /**
     * @deprecated This is a Synapse-specific extension with no direct alternative. Store request templates locally for standard Matrix API compatibility.
     */
    getRequestTemplates(): Promise<IFriendRequestTemplate[]>;
    /**
     * @deprecated This is a Synapse-specific extension with no direct alternative. Create and store request templates locally for standard Matrix API compatibility.
     */
    createRequestTemplate(name: string, message: string, categoryId?: string): Promise<string>;
    /**
     * @deprecated This is a Synapse-specific extension with no direct alternative. Remove request templates from local storage for standard Matrix API compatibility.
     */
    deleteRequestTemplate(templateId: string): Promise<boolean>;
    /**
     * @deprecated This is a Synapse-specific extension. Use FriendsVerificationApi.verifyRelationship() for standard Matrix API compatibility.
     */
    verifyFriendship(friendId: string): Promise<IFriendshipVerification>;
}
//# sourceMappingURL=friends-stats.d.ts.map