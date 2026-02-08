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
import { sanitizeContent, validateRoomId, validateMessageId } from "../utils/validator.js";
import { GLOBAL_RATE_LIMITER } from "../utils/rate-limiter.js";
import { EnhancedApi, PaginationDefaults, MessageLimits } from "../constants/api.js";
import { handleApiResponse } from "../utils/response-formatter.js";
import { BaseApi } from "../utils/base-api.js";
export class ChatroomApi extends BaseApi {
  constructor(httpClient) {
    super(httpClient);
  }
  checkRateLimit(operation) {
    var {
      allowed,
      resetAt
    } = GLOBAL_RATE_LIMITER.checkLimit("chatroom:".concat(operation));
    if (!allowed) {
      var retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      this.throwRateLimitError(retryAfter);
    }
  }

  /**
   * Retrieves a paginated list of chatrooms for the current user.
   *
   * @param params - Optional parameters for filtering and pagination
   * @param params.state - Filter by chatroom state (active, archived, or all)
   * @param params.page - Page number for pagination (default: 1)
   * @param params.limit - Number of items per page (default: 50, max: 1000)
   * @returns Promise resolving to array of chatrooms
   * @throws SynapseEnhancedError on API failure
   */
  getChatrooms(params) {
    var _this = this;
    return _asyncToGenerator(function* () {
      _this.checkRateLimit("getChatrooms");
      var queryParams = {
        user_id: params === null || params === void 0 ? void 0 : params.user_id,
        state: (params === null || params === void 0 ? void 0 : params.state) || "active",
        page: (params === null || params === void 0 ? void 0 : params.page) || PaginationDefaults.PAGE,
        limit: (params === null || params === void 0 ? void 0 : params.limit) || PaginationDefaults.LIMIT
      };
      var response = yield _this.httpClient.get(EnhancedApi.CHATROOMS, queryParams);
      var data = handleApiResponse(response, "Failed to get chatrooms");
      return data.chatrooms || [];
    })();
  }

  /**
   * Retrieves the total unread message count across all chatrooms.
   *
   * @returns Promise resolving to unread count object with total and per-room breakdown
   * @throws SynapseEnhancedError on API failure
   */
  getUnreadCount() {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      _this2.checkRateLimit("getUnreadCount");
      var response = yield _this2.httpClient.get(EnhancedApi.CHATROOMS_UNREAD);
      var data = handleApiResponse(response, "Failed to get unread count");
      return {
        total_unread: data.total_unread || 0,
        by_room: data.by_room || []
      };
    })();
  }

  /**
   * Retrieves detailed information about a specific chatroom.
   *
   * @param roomId - The Matrix room ID (e.g., "!roomid:example.com")
   * @returns Promise resolving to chatroom details or null if not found
   * @throws SynapseEnhancedError on API failure (other than not found)
   */
  getChatroomDetail(roomId) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      validateRoomId(roomId);
      try {
        var response = yield _this3.httpClient.get("".concat(EnhancedApi.CHATROOMS, "/").concat(roomId));
        return handleApiResponse(response, "Failed to get chatroom detail");
      } catch (error) {
        if (error instanceof Error && (error.message.includes("not found") || error.message.includes("not exist"))) {
          return null;
        }
        throw error;
      }
    })();
  }

  /**
   * Leaves a chatroom, removing the user from the room members.
   *
   * @param roomId - The Matrix room ID to leave
   * @returns Promise resolving to true on success
   * @throws SynapseEnhancedError on API failure
   */
  leaveChatroom(roomId) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      validateRoomId(roomId);
      _this4.checkRateLimit("leaveChatroom");
      var response = yield _this4.httpClient.post("".concat(EnhancedApi.CHATROOMS, "/").concat(roomId, "/leave"), {});
      handleApiResponse(response, "Failed to leave chatroom");
      return true;
    })();
  }

  /**
   * Marks all messages in a chatroom as read.
   *
   * @param roomId - The Matrix room ID to mark as read
   * @returns Promise resolving to true on success
   * @throws SynapseEnhancedError on API failure
   */
  markAsRead(roomId) {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      validateRoomId(roomId);
      _this5.checkRateLimit("markAsRead");
      var response = yield _this5.httpClient.post("".concat(EnhancedApi.CHATROOMS, "/").concat(roomId, "/read"), {});
      handleApiResponse(response, "Failed to mark chatroom as read");
      return true;
    })();
  }

  /**
   * Retrieves messages from a chatroom with pagination support.
   *
   * @param roomId - The Matrix room ID to fetch messages from
   * @param params - Optional pagination parameters
   * @param params.limit - Maximum number of messages to return (default: 50)
   * @param params.before - Event ID to fetch messages before
   * @param params.after - Event ID to fetch messages after
   * @returns Promise resolving to messages array and has_more flag
   * @throws SynapseEnhancedError on API failure
   */
  getMessages(roomId, params) {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      validateRoomId(roomId);
      _this6.checkRateLimit("getMessages");
      var queryParams = {
        room_id: roomId
      };
      if ((params === null || params === void 0 ? void 0 : params.limit) !== undefined) queryParams.limit = params.limit;
      if ((params === null || params === void 0 ? void 0 : params.before) !== undefined) queryParams.before = params.before;
      if ((params === null || params === void 0 ? void 0 : params.after) !== undefined) queryParams.after = params.after;
      var response = yield _this6.httpClient.get("".concat(EnhancedApi.CHATROOMS, "/").concat(roomId, "/messages"), queryParams);
      var data = handleApiResponse(response, "Failed to get messages");
      return {
        messages: data.messages || [],
        has_more: data.has_more || false
      };
    })();
  }

  /**
   * Sends a message to a chatroom with optional reply functionality.
   *
   * @param roomId - The Matrix room ID to send message to
   * @param content - The message content (will be sanitized for XSS prevention)
   * @param type - The message type (default: "m.text")
   * @param replyTo - Optional event ID to reply to
   * @returns Promise resolving to the sent message
   * @throws SynapseEnhancedError on API failure or invalid input
   */
  sendMessage(roomId, content) {
    var _arguments = arguments,
      _this7 = this;
    return _asyncToGenerator(function* () {
      var type = _arguments.length > 2 && _arguments[2] !== undefined ? _arguments[2] : "m.text";
      var replyTo = _arguments.length > 3 ? _arguments[3] : undefined;
      validateRoomId(roomId);
      _this7.checkRateLimit("sendMessage");
      if (!content || typeof content !== "string") {
        throw _this7.createError("Message content is required and must be a string", ErrorCode.INVALID_PARAM);
      }
      var sanitizedContent = sanitizeContent(content, {
        maxLength: MessageLimits.MAX_CONTENT_LENGTH
      });
      var body = {
        content: sanitizedContent,
        msgtype: type
      };
      if (replyTo) body["m.relates_to"] = {
        ["m.in_reply_to"]: {
          event_id: replyTo
        }
      };
      var response = yield _this7.httpClient.post("".concat(EnhancedApi.CHATROOMS, "/").concat(roomId, "/messages"), body);
      var data = handleApiResponse(response, "Failed to send message");
      return data.message || {
        message_id: "",
        room_id: roomId,
        content: content,
        type: type,
        sender: "",
        timestamp: new Date().toISOString(),
        reply_to: replyTo,
        is_deleted: false
      };
    })();
  }

  /**
   * Deletes a message from a chatroom.
   *
   * @param roomId - The Matrix room ID containing the message
   * @param messageId - The message event ID to delete
   * @returns Promise resolving to true on success
   * @throws SynapseEnhancedError on API failure or invalid input
   */
  deleteMessage(roomId, messageId) {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      validateRoomId(roomId);
      validateMessageId(messageId);
      _this8.checkRateLimit("deleteMessage");
      var response = yield _this8.httpClient.delete("".concat(EnhancedApi.CHATROOMS, "/").concat(roomId, "/messages/").concat(encodeURIComponent(messageId)));
      handleApiResponse(response, "Failed to delete message");
      return true;
    })();
  }

  /**
   * Searches for messages in a chatroom matching a query string.
   *
   * @param roomId - The Matrix room ID to search in
   * @param params - Search parameters
   * @param params.query - The search query string (required)
   * @param params.page - Page number for pagination (default: 1)
   * @param params.limit - Maximum number of results (default: 50)
   * @returns Promise resolving to matching messages and total count
   * @throws SynapseEnhancedError on API failure or invalid input
   */
  searchMessages(roomId, params) {
    var _this9 = this;
    return _asyncToGenerator(function* () {
      validateRoomId(roomId);
      _this9.checkRateLimit("searchMessages");
      if (!params.query || typeof params.query !== "string") {
        throw _this9.createError("Search query is required and must be a string", ErrorCode.INVALID_PARAM);
      }
      var queryParams = {
        room_id: roomId,
        query: params.query,
        page: params.page || PaginationDefaults.PAGE,
        limit: params.limit || PaginationDefaults.LIMIT
      };
      var response = yield _this9.httpClient.get(EnhancedApi.MESSAGES_SEARCH, queryParams);
      var data = handleApiResponse(response, "Failed to search messages");
      return {
        messages: data.messages || [],
        total: data.total || 0
      };
    })();
  }
}
//# sourceMappingURL=chatroom.js.map