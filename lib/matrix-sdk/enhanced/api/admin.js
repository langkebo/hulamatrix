import _defineProperty from "@babel/runtime/helpers/defineProperty";
import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
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

import { BatchOperationError } from "../utils/batch-errors.js";
import { mapParams, sanitizeLimit } from "../utils/api-mapping.js";
import { SynapseAdminApi } from "../constants/api.js";
import { extractItemsFromDataResponse, handleApiResponse } from "../utils/response-formatter.js";
import { BaseApi } from "../utils/base-api.js";

/**
 * Admin API - Administration API endpoints
 * Provides user management, room management, system statistics,
 * blacklist management and other administrative functions
 */
export class AdminApi extends BaseApi {
  /**
   * Create an AdminApi instance
   * @param httpClient - HTTP client instance
   */
  constructor(httpClient) {
    super(httpClient);
  }

  /**
   * Get the blacklist
   * @param params - Optional query parameters
   * @param params.type - Filter type, defaults to 'all'
   * @param params.page - Page number, starting from 1
   * @param params.limit - Items per page limit
   * @returns Blacklist and pagination information
   */
  getBlacklist(params) {
    var _this = this;
    return _asyncToGenerator(function* () {
      var mappedParams = mapParams(params || {}, "admin");
      if (mappedParams.limit !== undefined) {
        mappedParams.limit = sanitizeLimit(mappedParams.limit);
      }
      mappedParams.type = mappedParams.type || "all";
      var response = yield _this.httpClient.get(SynapseAdminApi.BLACKLIST_LIST, mappedParams);
      var data = handleApiResponse(response, "Failed to get blacklist");
      return data !== null && data !== void 0 && data.blacklist ? {
        blacklist: data.blacklist,
        pagination: data.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          total_pages: 0
        }
      } : {
        blacklist: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          total_pages: 0
        }
      };
    })();
  }

  /**
   * Add to blacklist
   * @param params - Blacklist parameters
   * @param params.type - Target type (user/room/ip)
   * @param params.target - Target identifier
   * @param params.reason - Reason for adding
   * @param params.duration_hours - Ban duration in hours, optional
   * @returns Whether the operation was successful
   */
  addToBlacklist(params) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this2.httpClient.post(SynapseAdminApi.BLACKLIST_ADD, params);
      handleApiResponse(response, "Failed to add to blacklist");
      return true;
    })();
  }

  /**
   * Remove from blacklist
   * @param params - Removal parameters
   * @param params.type - Target type (user/room/ip)
   * @param params.target - Target identifier
   * @param params.reason - Reason for removal, optional
   * @returns Whether the operation was successful
   */
  removeFromBlacklist(params) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this3.httpClient.request(SynapseAdminApi.BLACKLIST_REMOVE, {
        method: "DELETE",
        body: params
      });
      handleApiResponse(response, "Failed to remove from blacklist");
      return true;
    })();
  }

  /**
   * Get user list
   * @param params - Optional query parameters
   * @param params.page - Page number, starting from 1
   * @param params.limit - Items per page limit
   * @param params.search - Search keyword
   * @returns User list and pagination information
   */
  getUsers(params) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var queryParams = {};
      if ((params === null || params === void 0 ? void 0 : params.page) !== undefined) {
        queryParams.page = params.page;
      }
      if ((params === null || params === void 0 ? void 0 : params.limit) !== undefined) {
        queryParams.limit = params.limit;
      }
      if (params !== null && params !== void 0 && params.search) {
        queryParams.search = params.search;
      }
      var response = yield _this4.httpClient.get(SynapseAdminApi.USERS, queryParams);
      handleApiResponse(response, "Failed to get users");
      var result = extractItemsFromDataResponse(response);
      var returnValue = {
        items: result.items,
        total: result.total,
        offset: (result.page - 1) * result.limit,
        limit: result.limit,
        pagination: {
          page: result.page,
          total_pages: Math.ceil(result.total / result.limit),
          has_next: result.page * result.limit < result.total,
          has_before: result.page > 1
        }
      };
      return returnValue;
    })();
  }

  /**
   * Get user details
   * @param userId - User ID
   * @returns User details, null if user doesn't exist
   */
  getUserDetail(userId) {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      var endpoint = SynapseAdminApi.USERS_DETAILS.replace("{userId}", encodeURIComponent(userId));
      var response = yield _this5.httpClient.get(endpoint, {});
      try {
        return handleApiResponse(response, "Failed to get user detail");
      } catch (error) {
        if (error instanceof Error && (error.message.toLowerCase().includes("failed") || error.message.toLowerCase().includes("not found"))) {
          return null;
        }
        throw error;
      }
    })();
  }

  /**
   * Get room list
   * @param params - Optional query parameters
   * @param params.page - Page number, starting from 1
   * @param params.limit - Items per page limit
   * @param params.search - Search keyword
   * @param params.state - Room state filter
   * @returns Room list and pagination information
   */
  getRooms(params) {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      var queryParams = {};
      if ((params === null || params === void 0 ? void 0 : params.page) !== undefined) {
        queryParams.page = params.page;
      }
      if ((params === null || params === void 0 ? void 0 : params.limit) !== undefined) {
        queryParams.limit = params.limit;
      }
      if (params !== null && params !== void 0 && params.search) {
        queryParams.search = params.search;
      }
      if (params !== null && params !== void 0 && params.state) {
        queryParams.state = params.state;
      }
      var response = yield _this6.httpClient.get(SynapseAdminApi.ROOMS, queryParams);
      handleApiResponse(response, "Failed to get rooms");
      var result = extractItemsFromDataResponse(response);
      var returnValue = {
        items: result.items,
        total: result.total,
        offset: (result.page - 1) * result.limit,
        limit: result.limit,
        pagination: {
          page: result.page,
          total_pages: Math.ceil(result.total / result.limit),
          has_next: result.page * result.limit < result.total,
          has_before: result.page > 1
        }
      };
      return returnValue;
    })();
  }

  /**
   * Get system statistics data
   * @param period - Statistics period (day/week/month), optional
   * @returns System statistics data
   */
  getStatistics(period) {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      var queryParams = {};
      if (period) {
        queryParams.period = period;
      }
      var response = yield _this7.httpClient.get(SynapseAdminApi.STATS, queryParams);
      return handleApiResponse(response, "Failed to get statistics") || {
        total_users: 0,
        active_users: 0,
        total_rooms: 0,
        total_messages: 0,
        memory_usage: 0,
        database_size: 0,
        storage_used: 0
      };
    })();
  }

  /**
   * Get system health status
   * @returns System health status information
   */
  getHealth() {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this8.httpClient.get(SynapseAdminApi.HEALTH, {});
      return handleApiResponse(response, "Failed to get health status");
    })();
  }

  // User Management Methods

  /**
   * Suspend user
   * @param userId - User ID
   * @param reason - Suspension reason, optional
   * @returns Operation result
   */
  suspendUser(userId, reason) {
    var _this9 = this;
    return _asyncToGenerator(function* () {
      var endpoint = SynapseAdminApi.USERS_SUSPEND.replace("{userId}", encodeURIComponent(userId));
      var response = yield _this9.httpClient.post(endpoint, {
        reason
      });
      var data = handleApiResponse(response, "Failed to suspend user");
      return {
        success: true,
        deleted_at: data.deleted_at || new Date().toISOString()
      };
    })();
  }

  /**
   * Activate user
   * @param userId - User ID
   * @returns Operation result
   */
  activateUser(userId) {
    var _this0 = this;
    return _asyncToGenerator(function* () {
      var endpoint = SynapseAdminApi.USERS_ACTIVATE.replace("{userId}", encodeURIComponent(userId));
      var response = yield _this0.httpClient.post(endpoint, {});
      var data = handleApiResponse(response, "Failed to activate user");
      return {
        success: true,
        deleted_at: data.deleted_at || new Date().toISOString()
      };
    })();
  }

  // Room Management Methods

  /**
   * Get room details
   * @param roomId - Room ID
   * @returns Room details, null if room doesn't exist
   */
  getRoomDetail(roomId) {
    var _this1 = this;
    return _asyncToGenerator(function* () {
      var endpoint = SynapseAdminApi.ROOMS_DETAILS.replace("{roomId}", encodeURIComponent(roomId));
      var response = yield _this1.httpClient.get(endpoint, {});
      try {
        return handleApiResponse(response, "Failed to get room detail");
      } catch (error) {
        if (error instanceof Error && (error.message.toLowerCase().includes("failed") || error.message.toLowerCase().includes("not found"))) {
          return null;
        }
        throw error;
      }
    })();
  }

  /**
   * Get room messages
   * @param roomId - Room ID
   * @param limit - Message count limit, optional
   * @returns Room messages list and pagination information
   */
  getRoomMessages(roomId, limit) {
    var _this10 = this;
    return _asyncToGenerator(function* () {
      var queryParams = {
        room_id: roomId
      };
      if (limit !== undefined) {
        queryParams.limit = limit;
      }
      var endpoint = SynapseAdminApi.ROOMS_MESSAGES.replace("{roomId}", encodeURIComponent(roomId));
      var response = yield _this10.httpClient.get(endpoint, queryParams);
      var data = handleApiResponse(response, "Failed to get room messages");
      return {
        messages: (data === null || data === void 0 ? void 0 : data.messages) || [],
        pagination: (data === null || data === void 0 ? void 0 : data.pagination) || {
          page: 1,
          page_size: 20,
          total: 0,
          total_pages: 0
        }
      };
    })();
  }

  /**
   * Delete room
   * @param roomId - Room ID
   * @param reason - Deletion reason, optional
   * @returns Whether the operation was successful
   */
  deleteRoom(roomId, reason) {
    var _this11 = this;
    return _asyncToGenerator(function* () {
      var endpoint = SynapseAdminApi.ROOMS_DELETE.replace("{roomId}", encodeURIComponent(roomId));
      var response = yield _this11.httpClient.request(endpoint, {
        method: "DELETE",
        body: {
          reason
        }
      });
      handleApiResponse(response, "Failed to delete room");
      return true;
    })();
  }

  // Message Management Methods

  /**
   * Get message list
   * @param roomId - Room ID
   * @param params - Optional pagination parameters
   * @param params.page - Page number
   * @param params.limit - Items per page
   * @returns Message list and pagination information
   */
  getMessageList(roomId, params) {
    var _this12 = this;
    return _asyncToGenerator(function* () {
      var queryParams = {
        room_id: roomId
      };
      if ((params === null || params === void 0 ? void 0 : params.page) !== undefined) {
        queryParams.page = params.page;
      }
      if ((params === null || params === void 0 ? void 0 : params.limit) !== undefined) {
        queryParams.limit = params.limit;
      }
      var response = yield _this12.httpClient.get(SynapseAdminApi.MESSAGES, queryParams);
      var data = handleApiResponse(response, "Failed to get message list");
      return {
        messages: (data === null || data === void 0 ? void 0 : data.messages) || [],
        pagination: (data === null || data === void 0 ? void 0 : data.pagination) || {
          page: 1,
          page_size: 20,
          total: 0,
          total_pages: 0
        }
      };
    })();
  }

  /**
   * Delete message
   * @param messageId - Message ID
   * @param reason - Deletion reason, optional
   * @returns Whether the operation was successful
   */
  deleteMessage(messageId, reason) {
    var _this13 = this;
    return _asyncToGenerator(function* () {
      var endpoint = SynapseAdminApi.MESSAGES_DETAILS.replace("{messageId}", encodeURIComponent(messageId));
      var response = yield _this13.httpClient.request(endpoint, {
        method: "DELETE",
        body: {
          reason
        }
      });
      handleApiResponse(response, "Failed to delete message");
      return true;
    })();
  }

  /**
   * Search messages
   * @param query - Search keyword
   * @param params - Optional pagination parameters
   * @param params.page - Page number
   * @param params.limit - Items per page
   * @returns Matching message list and pagination information
   */
  searchMessages(query, params) {
    var _this14 = this;
    return _asyncToGenerator(function* () {
      var queryParams = {
        query
      };
      if ((params === null || params === void 0 ? void 0 : params.page) !== undefined) {
        queryParams.page = params.page;
      }
      if ((params === null || params === void 0 ? void 0 : params.limit) !== undefined) {
        queryParams.limit = params.limit;
      }
      var response = yield _this14.httpClient.get(SynapseAdminApi.MESSAGES_SEARCH, queryParams);
      var data = handleApiResponse(response, "Failed to search messages");
      return {
        messages: (data === null || data === void 0 ? void 0 : data.messages) || [],
        pagination: (data === null || data === void 0 ? void 0 : data.pagination) || {
          page: 1,
          page_size: 20,
          total: 0,
          total_pages: 0
        }
      };
    })();
  }

  // System Management Methods

  /**
   * Get dashboard statistics data
   * @returns System statistics data
   */
  getDashboardStats() {
    var _this15 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this15.httpClient.get(SynapseAdminApi.DASHBOARD, {});
      return handleApiResponse(response, "Failed to get dashboard stats") || {
        total_users: 0,
        active_users: 0,
        total_rooms: 0,
        total_messages: 0,
        memory_usage: 0,
        database_size: 0,
        storage_used: 0
      };
    })();
  }

  // Admin Management Methods

  /**
   * Get administrator list
   * @param params - Optional pagination parameters
   * @param params.page - Page number
   * @param params.limit - Items per page
   * @returns Administrator list and pagination information
   */
  getAdminList(params) {
    var _this16 = this;
    return _asyncToGenerator(function* () {
      var queryParams = {};
      if ((params === null || params === void 0 ? void 0 : params.page) !== undefined) {
        queryParams.page = params.page;
      }
      if ((params === null || params === void 0 ? void 0 : params.limit) !== undefined) {
        queryParams.limit = params.limit;
      }
      var response = yield _this16.httpClient.get(SynapseAdminApi.ADMINS, queryParams);
      var data = handleApiResponse(response, "Failed to get admin list");
      return {
        admins: (data === null || data === void 0 ? void 0 : data.admins) || [],
        total: (data === null || data === void 0 ? void 0 : data.total) || 0,
        pagination: (data === null || data === void 0 ? void 0 : data.pagination) || {
          page: 1,
          limit: 20,
          total_pages: 0
        }
      };
    })();
  }

  /**
   * Get current administrator profile
   * @returns Administrator profile information
   */
  getAdminProfile() {
    var _this17 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this17.httpClient.get(SynapseAdminApi.ADMINS_PROFILE, {});
      return handleApiResponse(response, "Failed to get admin profile");
    })();
  }

  /**
   * Create new administrator
   * @param params - Creation parameters (user_id, is_root, etc.)
   * @returns Created administrator ID
   */
  createAdmin(params) {
    var _this18 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this18.httpClient.post(SynapseAdminApi.ADMINS, params);
      var data = handleApiResponse(response, "Failed to create admin");
      return {
        admin_id: (data === null || data === void 0 ? void 0 : data.admin_id) || ""
      };
    })();
  }

  /**
   * Update administrator role
   * @param params - Update parameters (admin_id, new_role)
   * @returns Whether the operation was successful
   */
  updateAdminRole(params) {
    var _this19 = this;
    return _asyncToGenerator(function* () {
      var endpoint = SynapseAdminApi.ADMINS_ROLE.replace("{adminId}", encodeURIComponent(params.admin_id));
      var response = yield _this19.httpClient.put(endpoint, {
        role: params.new_role
      });
      handleApiResponse(response, "Failed to update admin role");
      return true;
    })();
  }

  /**
   * Delete administrator
   * @param adminId - Administrator ID
   * @returns Whether the operation was successful
   */
  deleteAdmin(adminId) {
    var _this20 = this;
    return _asyncToGenerator(function* () {
      var endpoint = SynapseAdminApi.ADMINS + "/" + encodeURIComponent(adminId);
      var response = yield _this20.httpClient.request(endpoint, {
        method: "DELETE"
      });
      handleApiResponse(response, "Failed to delete admin");
      return true;
    })();
  }

  /**
   * Get audit logs
   * @param params - Optional pagination parameters
   * @param params.page - Page number
   * @param params.limit - Items per page
   * @returns Audit log list and pagination information
   */
  getAuditLogs(params) {
    var _this21 = this;
    return _asyncToGenerator(function* () {
      var queryParams = {};
      if ((params === null || params === void 0 ? void 0 : params.page) !== undefined) {
        queryParams.page = params.page;
      }
      if ((params === null || params === void 0 ? void 0 : params.limit) !== undefined) {
        queryParams.limit = params.limit;
      }
      var response = yield _this21.httpClient.get(SynapseAdminApi.AUDIT_LOGS, queryParams);
      var data = handleApiResponse(response, "Failed to get audit logs");
      return {
        logs: (data === null || data === void 0 ? void 0 : data.logs) || [],
        total: (data === null || data === void 0 ? void 0 : data.total) || 0,
        pagination: (data === null || data === void 0 ? void 0 : data.pagination) || {
          page: 1,
          limit: 20,
          total_pages: 0
        }
      };
    })();
  }

  // Config Management Methods

  /**
   * Get system configuration
   * @returns System configuration information
   */
  getSystemConfig() {
    var _this22 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this22.httpClient.get(SynapseAdminApi.CONFIG, {});
      return handleApiResponse(response, "Failed to get system config");
    })();
  }

  /**
   * Update system configuration
   * @param config - Configuration object
   * @returns Updated system configuration information
   */
  updateSystemConfig(config) {
    var _this23 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this23.httpClient.put(SynapseAdminApi.CONFIG, {
        config
      });
      return handleApiResponse(response, "Failed to update system config");
    })();
  }

  // Batch User Operations

  /**
   * Get user permissions
   * @param userId - User ID
   * @returns User permission information
   */
  getUserPermissions(userId) {
    var _this24 = this;
    return _asyncToGenerator(function* () {
      var endpoint = SynapseAdminApi.USERS_PERMISSIONS.replace("{userId}", encodeURIComponent(userId));
      var response = yield _this24.httpClient.get(endpoint, {});
      return handleApiResponse(response, "Failed to get user permissions");
    })();
  }

  /**
   * Executes multiple user operations in a single request.
   * Supports suspending, activating, and deleting users.
   *
   * @param operations - Array of user operations to execute
   * @returns Promise resolving to the batch operation response with individual results
   * @throws {SynapseEnhancedError} When input validation fails or API request fails
   * @throws {BatchOperationError} When one or more operations fail, containing details of each failure
   */
  batchUserOperations(operations) {
    var _this25 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this25.httpClient.post(SynapseAdminApi.USERS_BATCH, {
        operations
      });
      var data = handleApiResponse(response, "Failed to execute batch user operations");
      var failedOperations = data.results.filter(r => !r.success);
      if (failedOperations.length > 0 && failedOperations.length === data.results.length) {
        throw BatchOperationError.fromBatchResponse("batchUserOperations", data.results.length, failedOperations.map(r => ({
          itemId: r.user_id,
          error: r.error || "Unknown error"
        })), "All batch user operations failed");
      }
      return data;
    })();
  }

  // Room Search and Batch Operations

  /**
   * Search rooms
   * @param criteria - Search criteria
   * @param params - Optional pagination parameters
   * @param params.page - Page number
   * @param params.limit - Items per page
   * @returns Search results and pagination information
   */
  searchRooms(criteria, params) {
    var _this26 = this;
    return _asyncToGenerator(function* () {
      var queryParams = _objectSpread({}, criteria);
      if ((params === null || params === void 0 ? void 0 : params.page) !== undefined) {
        queryParams.page = params.page;
      }
      if ((params === null || params === void 0 ? void 0 : params.limit) !== undefined) {
        queryParams.limit = params.limit;
      }
      var response = yield _this26.httpClient.get(SynapseAdminApi.ROOMS_SEARCH, queryParams);
      return handleApiResponse(response, "Failed to search rooms");
    })();
  }

  /**
   * Executes multiple room operations in a single request.
   * Supports deleting, archiving, and changing room visibility.
   *
   * @param operations - Array of room operations to execute
   * @returns Promise resolving to the batch operation response with individual results
   * @throws {SynapseEnhancedError} When input validation fails or API request fails
   * @throws {BatchOperationError} When one or more operations fail, containing details of each failure
   */
  batchRoomOperations(operations) {
    var _this27 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this27.httpClient.post(SynapseAdminApi.ROOMS_BATCH, {
        operations
      });
      var data = handleApiResponse(response, "Failed to execute batch room operations");
      var failedOperations = data.results.filter(r => !r.success);
      if (failedOperations.length > 0) {
        throw BatchOperationError.fromBatchResponse("batchRoomOperations", data.results.length, failedOperations.map(r => ({
          itemId: r.room_id,
          error: r.error || "Unknown error"
        })), "Some room batch operations failed");
      }
      return data;
    })();
  }

  // Message Batch and Moderation Operations

  /**
   * Deletes multiple messages matching the specified criteria.
   * Allows bulk deletion based on user ID, room ID, time range, and limit.
   *
   * @param params - Criteria for selecting messages to delete
   * @returns Promise resolving to the delete result with counts of deleted and failed items
   * @throws {SynapseEnhancedError} When input validation fails or API request fails
   * @throws {BatchOperationError} When one or more deletions fail
   */
  batchDeleteMessages(params) {
    var _this28 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this28.httpClient.post(SynapseAdminApi.MESSAGES_BATCH, params);
      var result = handleApiResponse(response, "Failed to batch delete messages");
      if (result.failed_ids.length > 0) {
        var failures = result.failed_ids.map(id => ({
          itemId: id,
          error: "Delete operation failed"
        }));
        throw BatchOperationError.fromBatchResponse("batchDeleteMessages", result.deleted_count + result.failed_ids.length, failures, "Some message deletions failed");
      }
      return result;
    })();
  }

  /**
   * Moderate messages
   * @param params - Moderation parameters
   * @returns Moderation results
   */
  moderateMessages(params) {
    var _this29 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this29.httpClient.post(SynapseAdminApi.MESSAGES_MODERATE, params);
      return handleApiResponse(response, "Failed to moderate messages");
    })();
  }

  // Admin Activity

  /**
   * Get administrator activity logs
   * @param params - Optional pagination parameters
   * @param params.page - Page number
   * @param params.limit - Items per page
   * @returns Administrator activity records and pagination information
   */
  getAdminActivity(params) {
    var _this30 = this;
    return _asyncToGenerator(function* () {
      var queryParams = {};
      if ((params === null || params === void 0 ? void 0 : params.page) !== undefined) {
        queryParams.page = params.page;
      }
      if ((params === null || params === void 0 ? void 0 : params.limit) !== undefined) {
        queryParams.limit = params.limit;
      }
      var response = yield _this30.httpClient.get(SynapseAdminApi.ADMINS_ACTIVITY, queryParams);
      return handleApiResponse(response, "Failed to get admin activity");
    })();
  }

  // Config Export and Versions

  /**
   * Export system configuration
   * @returns System configuration export information
   */
  exportConfig() {
    var _this31 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this31.httpClient.get(SynapseAdminApi.CONFIG_EXPORT, {});
      return handleApiResponse(response, "Failed to export config");
    })();
  }

  /**
   * Get configuration version history
   * @returns Configuration version information
   */
  getConfigVersions() {
    var _this32 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this32.httpClient.get(SynapseAdminApi.CONFIG_VERSIONS, {});
      return handleApiResponse(response, "Failed to get config versions");
    })();
  }
}
//# sourceMappingURL=admin.js.map