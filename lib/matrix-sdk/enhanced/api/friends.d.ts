import { type SynapseEnhancedHttpClient } from "../utils/http.ts";
import type { IFriend, IFriendCategory, IFriendRequest, IFriendStatistics, IBlockedUser, ISendFriendRequest, IPaginationParams, IFriendRequestResponse, IFriendSearchResult, IUserSearchResult, IMutualFriend, IRecentFriend, IInteractionRecord, IInteractionStats, IFriendRequestTemplate, IFriendshipVerification, IPaginatedResult, IFriendEvent, IFriendStreamParams } from "../models/types.ts";
import type { IFriendsApi } from "../models/friends.types.ts";
/**
 * FriendsApi - Main API class for managing friend relationships
 *
 * This class provides a comprehensive interface for managing friend-related operations including:
 * - Managing friend lists and categories
 * - Handling friend requests (send, accept, reject)
 * - Managing blocked users
 * - Searching friends and users
 * - Getting friend statistics and interactions
 */
export declare class FriendsApi implements IFriendsApi {
    private basicApi;
    private requestApi;
    private categoryApi;
    private blockApi;
    private statsApi;
    /**
     * Creates a new FriendsApi instance
     *
     * @param httpClient - The HTTP client used for making API requests
     */
    constructor(httpClient: SynapseEnhancedHttpClient);
    /**
     * Retrieves a list of friends
     *
     * @param params - Optional parameters for filtering and pagination
     * @param params.category - Filter friends by category ID
     * @param params.page - Page number for pagination (default: 1)
     * @param params.limit - Number of items per page (default: 20)
     * @returns Promise resolving to an array of friend objects
     */
    getFriends(params?: {
        category?: string;
        page?: number;
        limit?: number;
    }): Promise<IFriend[]>;
    /**
     * Retrieves all friend categories
     *
     * @returns Promise resolving to an array of friend category objects
     */
    getCategories(): Promise<IFriendCategory[]>;
    /**
     * Retrieves pending friend requests
     *
     * @param params - Optional parameters for filtering and pagination
     * @param params.limit - Maximum number of requests to return
     * @param params.cursor - Pagination cursor for retrieving next page
     * @returns Promise resolving to an array of pending friend request objects
     */
    getPendingRequests(_params?: {
        limit?: number;
        cursor?: string;
    }): Promise<IFriendRequest[]>;
    /**
     * Retrieves received friend requests
     *
     * @returns Promise resolving to an array of received friend request objects
     */
    getReceivedRequests(): Promise<IFriendRequest[]>;
    /**
     * Retrieves detailed information about a specific friend
     *
     * @param friendId - The Matrix user ID of the friend (e.g., @user:example.com)
     * @returns Promise resolving to friend details or null if not found
     */
    getFriendDetail(friendId: string): Promise<IFriend | null>;
    /**
     * Retrieves sent friend requests
     *
     * @param params - Optional pagination parameters
     * @returns Promise resolving to an array of sent friend request objects
     */
    getSentRequests(_params?: IPaginationParams): Promise<IFriendRequest[]>;
    /**
     * Retrieves details of a specific friend request
     *
     * @param requestId - The ID of the friend request
     * @returns Promise resolving to friend request details or null if not found
     */
    getRequestDetail(_requestId: string): Promise<IFriendRequest | null>;
    /**
     * Cancels a pending friend request
     *
     * @param requestId - The ID of the friend request to cancel
     * @returns Promise resolving to true if successful, false otherwise
     */
    cancelFriendRequest(_requestId: string): Promise<boolean>;
    /**
     * Checks if a user is in the current user's friend list
     *
     * @param otherUserId - The Matrix user ID to check (e.g., @user:example.com)
     * @returns Promise resolving to true if the user is a friend, false otherwise
     */
    isFriend(otherUserId: string): Promise<boolean>;
    /**
     * Moves a friend to a specific category
     *
     * @param friendId - The Matrix user ID of the friend to move
     * @param _categoryId - The ID of the target category
     * @returns Promise resolving to true if successful, false otherwise
     */
    moveFriendToCategory(friendId: string, _categoryId: string): Promise<boolean>;
    /**
     * Retrieves detailed information about a specific friend category
     *
     * @param categoryId - The ID of the category
     * @returns Promise resolving to category details or null if not found
     */
    getCategoryDetail(categoryId: string): Promise<IFriendCategory | null>;
    /**
     * Sends a friend request to a user
     *
     * @param params - Friend request parameters
     * @param params.target_id - The Matrix user ID to send request to
     * @param params.message - Optional message to include with the request
     * @returns Promise resolving to friend request response with request ID and status
     */
    sendFriendRequest(params: ISendFriendRequest): Promise<IFriendRequestResponse>;
    /**
     * Accepts a pending friend request
     *
     * @param requestId - The ID of the friend request to accept
     * @param _categoryId - Optional category ID to add the friend to after acceptance
     * @returns Promise resolving to friend request response with status
     */
    acceptFriendRequest(requestId: string, _categoryId?: string): Promise<IFriendRequestResponse>;
    /**
     * Rejects a pending friend request
     *
     * @param _requestId - The ID of the friend request to reject
     * @param _reason - Optional reason for rejection
     * @returns Promise resolving to true if successful, false otherwise
     */
    rejectFriendRequest(_requestId: string, _reason?: string): Promise<boolean>;
    /**
     * Removes a friend from the friend list
     *
     * @param _friendId - The Matrix user ID of the friend to remove
     * @returns Promise resolving to true if successful, false otherwise
     */
    removeFriend(_friendId: string): Promise<boolean>;
    /**
     * Creates a new friend category
     *
     * @param name - The name of the new category
     * @returns Promise resolving to the created category object
     */
    createCategory(name: string): Promise<IFriendCategory>;
    /**
     * Deletes a friend category
     *
     * @param categoryId - The ID of the category to delete
     * @returns Promise resolving to true if successful, false otherwise
     */
    deleteCategory(categoryId: string): Promise<boolean>;
    /**
     * Blocks a user
     *
     * @param _targetId - The Matrix user ID to block
     * @param _reason - Optional reason for blocking
     * @returns Promise resolving to true if successful, false otherwise
     */
    blockUser(_targetId: string, _reason?: string): Promise<boolean>;
    /**
     * Unblocks a previously blocked user
     *
     * @param _targetId - The Matrix user ID to unblock
     * @returns Promise resolving to true if successful, false otherwise
     */
    unblockUser(_targetId: string): Promise<boolean>;
    /**
     * Retrieves friend statistics
     *
     * @returns Promise resolving to friend statistics including counts
     */
    getFriendStats(): Promise<IFriendStatistics>;
    /**
     * Retrieves list of blocked users
     *
     * @returns Promise resolving to an array of blocked user objects
     */
    getBlockedUsers(): Promise<IBlockedUser[]>;
    /**
     * Checks if a user is blocked
     *
     * @param userId - The Matrix user ID to check
     * @returns Promise resolving to true if the user is blocked, false otherwise
     */
    isBlocked(userId: string): Promise<boolean>;
    /**
     * Searches friends by query
     *
     * @param query - Search query string
     * @param limit - Maximum number of results to return
     * @returns Promise resolving to an array of friend search results
     */
    searchFriends(query: string, limit?: number): Promise<IFriendSearchResult[]>;
    /**
     * Searches users by query
     *
     * @param query - Search query string
     * @param limit - Maximum number of results to return (default: 20)
     * @returns Promise resolving to an array of user search results
     */
    searchUsers(query: string, limit?: number): Promise<IUserSearchResult[]>;
    /**
     * Sets a remark/note for a friend
     *
     * @param friendId - The Matrix user ID of the friend
     * @param remark - The remark text to set
     * @returns Promise resolving to true if successful, false otherwise
     */
    setRemark(friendId: string, remark: string): Promise<boolean>;
    /**
     * Retrieves mutual friends with a specific user
     *
     * @param userId - The Matrix user ID to find mutual friends with
     * @param page - Page number for pagination (default: 1)
     * @param pageSize - Number of items per page (default: 20)
     * @returns Promise resolving to paginated result of mutual friends
     */
    getMutualFriends(userId: string, page?: number, pageSize?: number): Promise<IPaginatedResult<IMutualFriend>>;
    /**
     * Retrieves recently added friends
     *
     * @param limit - Maximum number of recent friends to return (default: 20)
     * @returns Promise resolving to an array of recent friend objects
     */
    getRecentFriends(limit?: number): Promise<IRecentFriend[]>;
    /**
     * Retrieves interaction history with a specific friend
     *
     * @param friendId - The Matrix user ID of the friend
     * @param page - Page number for pagination (default: 1)
     * @param pageSize - Number of items per page (default: 20)
     * @returns Promise resolving to paginated result of interaction records
     */
    getFriendInteractions(friendId: string, page?: number, pageSize?: number): Promise<IPaginatedResult<IInteractionRecord>>;
    /**
     * Retrieves interaction statistics with a specific user
     *
     * @param userId - The Matrix user ID to get statistics for
     * @returns Promise resolving to interaction statistics
     */
    getFriendInteractionStats(userId: string): Promise<IInteractionStats>;
    /**
     * Searches blocked users by query
     *
     * @param query - Optional search query string
     * @param page - Page number for pagination (default: 1)
     * @param pageSize - Number of items per page (default: 20)
     * @returns Promise resolving to paginated result of blocked users
     */
    searchBlockedUsers(query?: string, page?: number, pageSize?: number): Promise<IPaginatedResult<IBlockedUser>>;
    /**
     * Retrieves friend request templates
     *
     * @returns Promise resolving to an array of friend request templates
     */
    getRequestTemplates(): Promise<IFriendRequestTemplate[]>;
    /**
     * Verifies friendship status with a user
     *
     * @param friendId - The Matrix user ID to verify friendship with
     * @returns Promise resolving to friendship verification details
     */
    verifyFriendship(friendId: string): Promise<IFriendshipVerification>;
    /**
     * Retrieves multiple friends in batch
     *
     * @param userIds - Array of Matrix user IDs to retrieve
     * @returns Promise resolving to a map of user IDs to friend objects
     */
    getFriendsBatch(userIds: string[]): Promise<Map<string, IFriend>>;
    /**
     * Sends multiple friend requests in batch
     *
     * @param requests - Array of friend request objects
     * @returns Promise resolving to an array of friend request responses
     */
    sendFriendRequestsBatch(requests: ISendFriendRequest[]): Promise<IFriendRequestResponse[]>;
    /**
     * Updates remarks for multiple friends in batch
     *
     * @param remarks - Map of user IDs to remark strings
     * @returns Promise resolving to a map of user IDs to success status
     */
    updateRemarksBatch(remarks: Map<string, string>): Promise<Map<string, boolean>>;
    /**
     * Streams friends using an async generator
     *
     * This method yields friends page by page, automatically handling pagination.
     * Useful for processing large friend lists without loading all data at once.
     *
     * @param params - Optional streaming parameters
     * @param params.category - Filter friends by category ID
     * @param params.limit - Number of items per page (default: 100)
     * @returns Async generator yielding friend objects
     */
    streamFriends(params?: IFriendStreamParams): AsyncIterable<IFriend>;
    /**
     * Subscribes to friend-related events
     *
     * @param _callback - Callback function to handle friend events
     * @returns Unsubscribe function to stop receiving events
     */
    subscribeToFriendEvents(_callback: (event: IFriendEvent) => void): () => void;
}
//# sourceMappingURL=friends.d.ts.map