import { type SynapseEnhancedHttpClient } from "../utils/http.ts";
import type { IAdminUser, IAdminRoom, IAdminParams, IAdminPaginationResult, ISystemStatistics, IHealthResponse, IPaginationParams, IRoomDetail, IRoomMessagesResponse, IAdminProfile, IAdminListResponse, IAuditLogResponse, ICreateAdminParams, IUpdateRoleParams, IDeleteResult, IConfigResponse, IBatchUserOperation, IBatchUserResponse, IBatchRoomOperation, IBatchRoomResponse, IBatchDeleteParams, IBatchDeleteResult, IUserPermissionsResponse, IRoomSearchCriteria, IRoomSearchResponse, IMessageModerationParams, IMessageModerationResponse, IConfigExport, IAdminActivityResponse, IBlacklistResponse } from "../models/types.ts";
import { type IAdminApi } from "../models/security.types.ts";
import { BaseApi } from "../utils/base-api.ts";
/**
 * Admin API - Administration API endpoints
 * Provides user management, room management, system statistics,
 * blacklist management and other administrative functions
 */
export declare class AdminApi extends BaseApi implements IAdminApi {
    /**
     * Create an AdminApi instance
     * @param httpClient - HTTP client instance
     */
    constructor(httpClient: SynapseEnhancedHttpClient);
    /**
     * Get the blacklist
     * @param params - Optional query parameters
     * @param params.type - Filter type, defaults to 'all'
     * @param params.page - Page number, starting from 1
     * @param params.limit - Items per page limit
     * @returns Blacklist and pagination information
     */
    getBlacklist(params?: {
        type?: string;
        page?: number;
        limit?: number;
    }): Promise<IBlacklistResponse>;
    /**
     * Add to blacklist
     * @param params - Blacklist parameters
     * @param params.type - Target type (user/room/ip)
     * @param params.target - Target identifier
     * @param params.reason - Reason for adding
     * @param params.duration_hours - Ban duration in hours, optional
     * @returns Whether the operation was successful
     */
    addToBlacklist(params: {
        type: string;
        target: string;
        reason: string;
        duration_hours?: string;
    }): Promise<boolean>;
    /**
     * Remove from blacklist
     * @param params - Removal parameters
     * @param params.type - Target type (user/room/ip)
     * @param params.target - Target identifier
     * @param params.reason - Reason for removal, optional
     * @returns Whether the operation was successful
     */
    removeFromBlacklist(params: {
        type: string;
        target: string;
        reason?: string;
    }): Promise<boolean>;
    /**
     * Get user list
     * @param params - Optional query parameters
     * @param params.page - Page number, starting from 1
     * @param params.limit - Items per page limit
     * @param params.search - Search keyword
     * @returns User list and pagination information
     */
    getUsers(params?: IAdminParams): Promise<IAdminPaginationResult<IAdminUser>>;
    /**
     * Get user details
     * @param userId - User ID
     * @returns User details, null if user doesn't exist
     */
    getUserDetail(userId: string): Promise<IAdminUser | null>;
    /**
     * Get room list
     * @param params - Optional query parameters
     * @param params.page - Page number, starting from 1
     * @param params.limit - Items per page limit
     * @param params.search - Search keyword
     * @param params.state - Room state filter
     * @returns Room list and pagination information
     */
    getRooms(params?: IAdminParams): Promise<IAdminPaginationResult<IAdminRoom>>;
    /**
     * Get system statistics data
     * @param period - Statistics period (day/week/month), optional
     * @returns System statistics data
     */
    getStatistics(period?: "day" | "week" | "month"): Promise<ISystemStatistics>;
    /**
     * Get system health status
     * @returns System health status information
     */
    getHealth(): Promise<IHealthResponse>;
    /**
     * Suspend user
     * @param userId - User ID
     * @param reason - Suspension reason, optional
     * @returns Operation result
     */
    suspendUser(userId: string, reason?: string): Promise<IDeleteResult>;
    /**
     * Activate user
     * @param userId - User ID
     * @returns Operation result
     */
    activateUser(userId: string): Promise<IDeleteResult>;
    /**
     * Get room details
     * @param roomId - Room ID
     * @returns Room details, null if room doesn't exist
     */
    getRoomDetail(roomId: string): Promise<IRoomDetail | null>;
    /**
     * Get room messages
     * @param roomId - Room ID
     * @param limit - Message count limit, optional
     * @returns Room messages list and pagination information
     */
    getRoomMessages(roomId: string, limit?: number): Promise<IRoomMessagesResponse>;
    /**
     * Delete room
     * @param roomId - Room ID
     * @param reason - Deletion reason, optional
     * @returns Whether the operation was successful
     */
    deleteRoom(roomId: string, reason?: string): Promise<boolean>;
    /**
     * Get message list
     * @param roomId - Room ID
     * @param params - Optional pagination parameters
     * @param params.page - Page number
     * @param params.limit - Items per page
     * @returns Message list and pagination information
     */
    getMessageList(roomId: string, params?: IPaginationParams): Promise<IRoomMessagesResponse>;
    /**
     * Delete message
     * @param messageId - Message ID
     * @param reason - Deletion reason, optional
     * @returns Whether the operation was successful
     */
    deleteMessage(messageId: string, reason?: string): Promise<boolean>;
    /**
     * Search messages
     * @param query - Search keyword
     * @param params - Optional pagination parameters
     * @param params.page - Page number
     * @param params.limit - Items per page
     * @returns Matching message list and pagination information
     */
    searchMessages(query: string, params?: IPaginationParams): Promise<IRoomMessagesResponse>;
    /**
     * Get dashboard statistics data
     * @returns System statistics data
     */
    getDashboardStats(): Promise<ISystemStatistics>;
    /**
     * Get administrator list
     * @param params - Optional pagination parameters
     * @param params.page - Page number
     * @param params.limit - Items per page
     * @returns Administrator list and pagination information
     */
    getAdminList(params?: IPaginationParams): Promise<IAdminListResponse>;
    /**
     * Get current administrator profile
     * @returns Administrator profile information
     */
    getAdminProfile(): Promise<IAdminProfile>;
    /**
     * Create new administrator
     * @param params - Creation parameters (user_id, is_root, etc.)
     * @returns Created administrator ID
     */
    createAdmin(params: ICreateAdminParams): Promise<{
        admin_id: string;
    }>;
    /**
     * Update administrator role
     * @param params - Update parameters (admin_id, new_role)
     * @returns Whether the operation was successful
     */
    updateAdminRole(params: IUpdateRoleParams): Promise<boolean>;
    /**
     * Delete administrator
     * @param adminId - Administrator ID
     * @returns Whether the operation was successful
     */
    deleteAdmin(adminId: string): Promise<boolean>;
    /**
     * Get audit logs
     * @param params - Optional pagination parameters
     * @param params.page - Page number
     * @param params.limit - Items per page
     * @returns Audit log list and pagination information
     */
    getAuditLogs(params?: IPaginationParams): Promise<IAuditLogResponse>;
    /**
     * Get system configuration
     * @returns System configuration information
     */
    getSystemConfig(): Promise<IConfigResponse>;
    /**
     * Update system configuration
     * @param config - Configuration object
     * @returns Updated system configuration information
     */
    updateSystemConfig(config: Record<string, unknown>): Promise<IConfigResponse>;
    /**
     * Get user permissions
     * @param userId - User ID
     * @returns User permission information
     */
    getUserPermissions(userId: string): Promise<IUserPermissionsResponse>;
    /**
     * Executes multiple user operations in a single request.
     * Supports suspending, activating, and deleting users.
     *
     * @param operations - Array of user operations to execute
     * @returns Promise resolving to the batch operation response with individual results
     * @throws {SynapseEnhancedError} When input validation fails or API request fails
     * @throws {BatchOperationError} When one or more operations fail, containing details of each failure
     */
    batchUserOperations(operations: IBatchUserOperation[]): Promise<IBatchUserResponse>;
    /**
     * Search rooms
     * @param criteria - Search criteria
     * @param params - Optional pagination parameters
     * @param params.page - Page number
     * @param params.limit - Items per page
     * @returns Search results and pagination information
     */
    searchRooms(criteria: IRoomSearchCriteria, params?: IPaginationParams): Promise<IRoomSearchResponse>;
    /**
     * Executes multiple room operations in a single request.
     * Supports deleting, archiving, and changing room visibility.
     *
     * @param operations - Array of room operations to execute
     * @returns Promise resolving to the batch operation response with individual results
     * @throws {SynapseEnhancedError} When input validation fails or API request fails
     * @throws {BatchOperationError} When one or more operations fail, containing details of each failure
     */
    batchRoomOperations(operations: IBatchRoomOperation[]): Promise<IBatchRoomResponse>;
    /**
     * Deletes multiple messages matching the specified criteria.
     * Allows bulk deletion based on user ID, room ID, time range, and limit.
     *
     * @param params - Criteria for selecting messages to delete
     * @returns Promise resolving to the delete result with counts of deleted and failed items
     * @throws {SynapseEnhancedError} When input validation fails or API request fails
     * @throws {BatchOperationError} When one or more deletions fail
     */
    batchDeleteMessages(params: IBatchDeleteParams): Promise<IBatchDeleteResult>;
    /**
     * Moderate messages
     * @param params - Moderation parameters
     * @returns Moderation results
     */
    moderateMessages(params: IMessageModerationParams): Promise<IMessageModerationResponse>;
    /**
     * Get administrator activity logs
     * @param params - Optional pagination parameters
     * @param params.page - Page number
     * @param params.limit - Items per page
     * @returns Administrator activity records and pagination information
     */
    getAdminActivity(params?: IPaginationParams): Promise<IAdminActivityResponse>;
    /**
     * Export system configuration
     * @returns System configuration export information
     */
    exportConfig(): Promise<IConfigExport>;
    /**
     * Get configuration version history
     * @returns Configuration version information
     */
    getConfigVersions(): Promise<IConfigVersionsResponse>;
}
export interface IConfigVersionsResponse {
    versions: string[];
    current_version: string;
}
//# sourceMappingURL=admin.d.ts.map