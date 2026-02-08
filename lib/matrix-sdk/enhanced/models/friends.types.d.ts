import type { IPaginationParams } from "./security.types.ts";
export interface IFriend {
    friend_id: string;
    display_name?: string;
    avatar_url?: string;
    remark?: string;
    category_id?: string;
    category_name?: string;
    status: "pending" | "accepted" | "rejected";
    created_at: string;
    last_interaction?: string;
}
export interface IFriendRequest {
    request_id: string;
    requester_id: string;
    target_id: string;
    message?: string;
    status: "pending" | "accepted" | "rejected" | "cancelled";
    category_id?: string;
    created_at: string;
}
export interface IFriendRequestResponse {
    request_id?: string;
    status: string;
    error?: string;
}
export interface IUnreadCount {
    unread_count?: number;
    unread_requests?: number;
    total_unread?: number;
    by_room?: Array<{
        room_id: string;
        unread: number;
    }>;
}
export interface IFriendCategory {
    id: string;
    name: string;
    created_at: string;
    friend_count?: number;
}
export interface IBlockedUser {
    user_id: string;
    display_name?: string;
    reason?: string;
    blocked_at?: string;
}
export interface IFriendStatistics {
    total_friends: number;
    pending_requests: number;
    sent_requests: number;
    categories_count: number;
    blocked_count: number;
    recent_friends_count?: number;
}
export interface IMutualFriend {
    userId: string;
    displayName?: string;
    avatarUrl?: string;
    remark?: string;
    mutualCount?: number;
}
export interface IRecentFriend {
    userId: string;
    displayName?: string;
    avatarUrl?: string;
    remark?: string;
    lastInteraction?: string;
    interactionCount?: number;
}
export interface IInteractionRecord {
    interactionId: string;
    interactionType: string;
    content?: string;
    metadata?: Record<string, unknown>;
    createdAt?: string;
}
export interface IInteractionStats {
    userId: string;
    friendId?: string;
    totalInteractions: number;
    messagesCount: number;
    friendRequestsCount: number;
    roomJoinsCount: number;
    lastInteraction?: string;
}
export interface IFriendsByCategoryResponse {
    category: IFriendCategory;
    friends: IFriend[];
}
export interface ICategoryFriendList {
    friends: IFriend[];
    pagination: {
        cursor?: string;
        has_more: boolean;
    };
}
export interface IFriendInteractionStats {
    total_messages: number;
    total_calls: number;
    last_interaction: string;
    total_interactions?: number;
    messages_count?: number;
    friend_requests_count?: number;
    room_joins_count?: number;
    last_interaction_date?: string;
}
export interface IFriendRecommendation {
    user_id: string;
    display_name?: string;
    reason: string;
    score: number;
}
export interface IFriendRecommendationResponse {
    recommendations: IFriendRecommendation[];
    pagination?: {
        cursor?: string;
        has_more: boolean;
        page?: number;
        page_size?: number;
        total?: number;
        total_pages?: number;
    };
}
export interface IBatchCategoryOperation {
    friend_id: string;
    target_category_id: string;
}
export interface IBatchCategoryResult {
    friend_id: string;
    success: boolean;
    error?: string;
}
export interface IBatchCategoryResponse {
    status: string;
    results: IBatchCategoryResult[];
    total_success: number;
    total_failed: number;
}
export interface IBlockedSearchResult {
    user_id: string;
    display_name?: string;
    reason?: string;
    blocked_at: string;
}
export interface IBlockedSearchResponse {
    results: IBlockedSearchResult[];
    pagination?: {
        page?: number;
        page_size?: number;
        limit?: number;
        total?: number;
        total_pages?: number;
    };
}
export interface IFriendRequestTemplate {
    templateId: string;
    name: string;
    message: string;
    categoryId?: string;
    createdAt?: string;
}
export interface IFriendRequestTemplatesResponse {
    templates: IFriendRequestTemplate[];
}
export interface IFriendshipVerification {
    verified: boolean;
    friendId: string;
    relationshipType?: string;
    since?: string;
}
export interface IFriendEvent {
    type: "request_received" | "request_accepted" | "request_rejected" | "friend_added" | "friend_removed" | "friend_updated";
    userId: string;
    timestamp: string;
    data?: Record<string, unknown>;
}
export interface IFriendStreamParams {
    category?: string;
    limit?: number;
}
export interface IFriendVerificationResult {
    verified: boolean;
    friend_id: string;
    relationship_type: string;
    since?: string;
    is_friend?: boolean;
    friend_since?: string;
    details?: Record<string, unknown>;
}
export interface IFriendVerificationResponse {
    status: string;
    verification?: IFriendVerificationResult;
    data?: IFriendVerificationResult;
}
export interface ISendFriendRequest {
    target_id: string;
    message?: string;
    category_id?: string;
}
export interface IFriendSearchResult {
    friend_id: string;
    remark?: string;
    display_name?: string;
    match_score: number;
}
export interface IUserSearchResult {
    userId: string;
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
}
export interface IPaginatedResult<T> {
    items: T[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}
/**
 * Friends API - Read Operations
 * Handles all read-only operations for friends management
 */
export interface IFriendsReadApi {
    getFriends(params?: {
        category?: string;
        page?: number;
        limit?: number;
    }): Promise<IFriend[]>;
    getFriendDetail(friendId: string): Promise<IFriend | null>;
    isFriend(otherUserId: string): Promise<boolean>;
    getPendingRequests(params?: IPaginationParams): Promise<IFriendRequest[]>;
    getReceivedRequests(): Promise<IFriendRequest[]>;
    getSentRequests(params?: IPaginationParams): Promise<IFriendRequest[]>;
    getRequestDetail(requestId: string): Promise<IFriendRequest | null>;
    getCategories(): Promise<IFriendCategory[]>;
    getCategoryDetail(categoryId: string): Promise<IFriendCategory | null>;
    getFriendStats(): Promise<IFriendStatistics>;
}
/**
 * Friends API - Write Operations
 * Handles all write operations for friends management
 */
export interface IFriendsWriteApi {
    removeFriend(friendId: string): Promise<boolean>;
    sendFriendRequest(request: ISendFriendRequest): Promise<IFriendRequestResponse>;
    acceptFriendRequest(requestId: string, categoryId?: string): Promise<IFriendRequestResponse>;
    rejectFriendRequest(requestId: string, reason?: string): Promise<boolean>;
    cancelFriendRequest(requestId: string): Promise<boolean>;
    createCategory(name: string): Promise<IFriendCategory>;
    deleteCategory(categoryId: string): Promise<boolean>;
    moveFriendToCategory(friendId: string, categoryId: string): Promise<boolean>;
    setRemark(friendId: string, remark: string): Promise<boolean>;
}
/**
 * Friends API - Search Operations
 * Handles search-related operations
 */
export interface IFriendsSearchApi {
    searchFriends(query: string, limit?: number): Promise<IFriendSearchResult[]>;
    searchUsers(query: string, limit?: number): Promise<IUserSearchResult[]>;
}
/**
 * Friends API - Security Operations
 * Handles blocking and unblocking operations
 */
export interface IFriendsSecurityApi {
    getBlockedUsers(): Promise<IBlockedUser[]>;
    blockUser(userId: string, reason?: string): Promise<boolean>;
    unblockUser(userId: string): Promise<boolean>;
    isBlocked(userId: string): Promise<boolean>;
}
/**
 * Combined Friends API interface that inherits all specialized interfaces.
 * This interface maintains backward compatibility while providing better organization.
 */
export interface IFriendsApi extends IFriendsReadApi, IFriendsWriteApi, IFriendsSecurityApi, IFriendsSearchApi {
    getFriends(params?: {
        category?: string;
        page?: number;
        limit?: number;
    }): Promise<IFriend[]>;
    getFriendDetail(friendId: string): Promise<IFriend | null>;
    isFriend(otherUserId: string): Promise<boolean>;
    removeFriend(friendId: string): Promise<boolean>;
    sendFriendRequest(request: ISendFriendRequest): Promise<IFriendRequestResponse>;
    getPendingRequests(params?: IPaginationParams): Promise<IFriendRequest[]>;
    getReceivedRequests(): Promise<IFriendRequest[]>;
    getSentRequests(params?: IPaginationParams): Promise<IFriendRequest[]>;
    getRequestDetail(requestId: string): Promise<IFriendRequest | null>;
    acceptFriendRequest(requestId: string, categoryId?: string): Promise<IFriendRequestResponse>;
    rejectFriendRequest(requestId: string, reason?: string): Promise<boolean>;
    cancelFriendRequest(requestId: string): Promise<boolean>;
    getCategories(): Promise<IFriendCategory[]>;
    createCategory(name: string): Promise<IFriendCategory>;
    deleteCategory(categoryId: string): Promise<boolean>;
    getCategoryDetail(categoryId: string): Promise<IFriendCategory | null>;
    moveFriendToCategory(friendId: string, categoryId: string): Promise<boolean>;
    getBlockedUsers(): Promise<IBlockedUser[]>;
    blockUser(userId: string, reason?: string): Promise<boolean>;
    unblockUser(userId: string): Promise<boolean>;
    isBlocked(userId: string): Promise<boolean>;
    getFriendStats(): Promise<IFriendStatistics>;
    searchFriends(query: string, limit?: number): Promise<IFriendSearchResult[]>;
    searchUsers(query: string, limit?: number): Promise<IUserSearchResult[]>;
    setRemark(friendId: string, remark: string): Promise<boolean>;
    getMutualFriends(userId: string, page?: number, pageSize?: number): Promise<IPaginatedResult<IMutualFriend>>;
    getRecentFriends(limit?: number): Promise<IRecentFriend[]>;
    getFriendInteractions(friendId: string, page?: number, pageSize?: number): Promise<IPaginatedResult<IInteractionRecord>>;
    getFriendInteractionStats(userId: string): Promise<IInteractionStats>;
    searchBlockedUsers(query?: string, page?: number, pageSize?: number): Promise<IPaginatedResult<IBlockedUser>>;
    getRequestTemplates(): Promise<IFriendRequestTemplate[]>;
    verifyFriendship(friendId: string): Promise<IFriendshipVerification>;
    getFriendsBatch(userIds: string[]): Promise<Map<string, IFriend>>;
    sendFriendRequestsBatch(requests: ISendFriendRequest[]): Promise<IFriendRequestResponse[]>;
    updateRemarksBatch(remarks: Map<string, string>): Promise<Map<string, boolean>>;
    streamFriends(params?: IFriendStreamParams): AsyncIterable<IFriend>;
    subscribeToFriendEvents(callback: (event: IFriendEvent) => void): () => void;
}
//# sourceMappingURL=friends.types.d.ts.map