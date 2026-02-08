import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
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

import { ErrorCode } from "../utils/error-codes.js";
import { mapParams, sanitizeLimit } from "../utils/api-mapping.js";
import { MatrixClientApi, SynapseAdminApi } from "../constants/api.js";
import { handleApiResponse } from "../utils/response-formatter.js";
import { BaseApi } from "../utils/base-api.js";
import { InputValidator } from "../utils/validator.js";

// Maximum query length to prevent DoS attacks
var MAX_QUERY_LENGTH = 500;
// Minimum query length to prevent empty searches
var MIN_QUERY_LENGTH = 1;
export class MessagesApi extends BaseApi {
  constructor(httpClient) {
    super(httpClient);
  }

  /**
   * Sanitize search query to prevent injection attacks
   * @param query - The raw search query
   * @returns Sanitized query string
   */
  sanitizeSearchQuery(query) {
    if (!query || typeof query !== "string") {
      throw this.createError("query is required and must be a string", ErrorCode.INVALID_PARAM);
    }

    // Trim and check length
    query = query.trim();
    if (query.length < MIN_QUERY_LENGTH || query.length > MAX_QUERY_LENGTH) {
      throw this.createError("query length must be between ".concat(MIN_QUERY_LENGTH, " and ").concat(MAX_QUERY_LENGTH, " characters"), ErrorCode.INVALID_PARAM);
    }

    // Sanitize to remove potentially dangerous characters
    query = InputValidator.sanitizeString(query, MAX_QUERY_LENGTH);

    // Additional check for SQL injection patterns
    if (InputValidator.checkForSqlInjection(query)) {
      throw this.createError("query contains potentially dangerous patterns", ErrorCode.INVALID_PARAM);
    }
    return query;
  }

  /**
   * Search messages for a user
   */
  searchMessages(params) {
    var _this = this;
    return _asyncToGenerator(function* () {
      if (!params.user_id || typeof params.user_id !== "string" || params.user_id.trim().length === 0) {
        throw _this.createError("user_id is required and must be a non-empty string", ErrorCode.INVALID_PARAM);
      }

      // Sanitize query to prevent injection attacks
      var sanitizedQuery = _this.sanitizeSearchQuery(params.query);
      if (params.limit !== undefined && (typeof params.limit !== "number" || params.limit < 1 || params.limit > 100)) {
        throw _this.createError("limit must be a number between 1 and 100", ErrorCode.INVALID_PARAM);
      }
      var mappedParams = mapParams({
        user_id: params.user_id,
        query: sanitizedQuery,
        limit: params.limit || 50,
        room_id: params.room_id
      }, "messages");
      var response = yield _this.httpClient.get(MatrixClientApi.MESSAGES_SEARCH, mappedParams);
      var data = handleApiResponse(response, "Failed to search messages");
      return data.results || [];
    })();
  }

  /**
   * Search messages with pagination
   */
  searchMessagesWithPagination(params) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      if (!params.user_id || typeof params.user_id !== "string" || params.user_id.trim().length === 0) {
        throw _this2.createError("user_id is required and must be a non-empty string", ErrorCode.INVALID_PARAM);
      }

      // Sanitize query to prevent injection attacks
      var sanitizedQuery = _this2.sanitizeSearchQuery(params.query);
      var page = params.page || 1;
      var limit = sanitizeLimit(params.limit) || 20;
      var offset = (page - 1) * limit;
      if (page < 1) {
        throw _this2.createError("page must be a positive number", ErrorCode.INVALID_PARAM);
      }
      if (limit < 1 || limit > 100) {
        throw _this2.createError("limit must be a number between 1 and 100", ErrorCode.INVALID_PARAM);
      }
      var mappedParams = mapParams({
        user_id: params.user_id,
        query: sanitizedQuery,
        limit: limit,
        offset: offset,
        room_id: params.room_id
      }, "messages");
      var response = yield _this2.httpClient.get(MatrixClientApi.MESSAGES_SEARCH, mappedParams);
      var data = handleApiResponse(response, "Failed to search messages");
      var results = data.results || [];
      var total = data.total || results.length;
      return {
        items: results,
        pagination: {
          page: page,
          limit: limit,
          total: total,
          has_more: offset + results.length < total
        }
      };
    })();
  }

  /**
   * Search messages in a specific room
   */
  searchMessagesInRoom(roomId, userId, query, limit) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      // Sanitize query to prevent injection attacks
      var sanitizedQuery = _this3.sanitizeSearchQuery(query);
      var mappedParams = mapParams({
        user_id: userId,
        query: sanitizedQuery,
        limit: limit || 50
      }, "messages");
      var endpoint = SynapseAdminApi.ROOMS_MESSAGES.replace("{roomId}", encodeURIComponent(roomId));
      var response = yield _this3.httpClient.get(endpoint, mappedParams);
      var data = handleApiResponse(response, "Failed to search messages in room");
      return data.results || [];
    })();
  }

  /**
   * Get recent messages for a user
   */
  getRecentMessages(userId) {
    var _arguments = arguments,
      _this4 = this;
    return _asyncToGenerator(function* () {
      var limit = _arguments.length > 1 && _arguments[1] !== undefined ? _arguments[1] : 50;
      var mappedParams = mapParams({
        user_id: userId,
        limit: limit
      }, "messages");
      var response = yield _this4.httpClient.get(MatrixClientApi.MESSAGES_SEARCH + "/recent", mappedParams);
      var data = handleApiResponse(response, "Failed to get recent messages");
      return data.results || [];
    })();
  }
}
//# sourceMappingURL=messages.js.map