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

import { mapParams, sanitizeLimit } from "../utils/api-mapping.js";
import { EnhancedApi } from "../constants/api.js";
import { handleApiResponse } from "../utils/response-formatter.js";
import { BaseApi } from "../utils/base-api.js";
export class PrivateChatApi extends BaseApi {
  constructor(httpClient) {
    super(httpClient);
  }
  createSession(params) {
    var _this = this;
    return _asyncToGenerator(function* () {
      var mappedParams = mapParams(params, "privateChat");
      var response = yield _this.httpClient.post(EnhancedApi.PRIVATE_SESSIONS, mappedParams);
      var data = handleApiResponse(response, "Failed to create session");
      return data.session_id || "";
    })();
  }
  getSessions(userId) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var mappedParams = mapParams({
        userId
      }, "privateChat");
      var response = yield _this2.httpClient.get(EnhancedApi.PRIVATE_SESSIONS, mappedParams);
      var data = handleApiResponse(response, "Failed to get sessions");
      return data.items || [];
    })();
  }
  getSessionDetail(sessionId) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      try {
        var response = yield _this3.httpClient.get(EnhancedApi.PRIVATE_SESSION_DETAIL.replace("{sessionId}", encodeURIComponent(sessionId)));
        return handleApiResponse(response, "Failed to get session detail");
      } catch (error) {
        if (error instanceof Error && (error.message.includes("not found") || error.message.includes("not exist"))) {
          return null;
        }
        throw error;
      }
    })();
  }
  closeSession(sessionId, userId) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var mappedParams = mapParams({
        sessionId,
        userId
      }, "privateChat");
      var response = yield _this4.httpClient.post(EnhancedApi.PRIVATE_SESSION_DELETE.replace("{sessionId}", encodeURIComponent(sessionId)), mappedParams);
      handleApiResponse(response, "Failed to close session");
      return true;
    })();
  }
  sendMessage(params) {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      var mappedParams = mapParams(params, "privateChat");
      var response = yield _this5.httpClient.post(EnhancedApi.PRIVATE_MESSAGES_SEND, mappedParams);
      var data = handleApiResponse(response, "Failed to send message");
      return data.message_id || "";
    })();
  }
  getMessages(sessionId, params) {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      var mappedParams = mapParams({
        session_id: sessionId,
        limit: params === null || params === void 0 ? void 0 : params.limit,
        before: params === null || params === void 0 ? void 0 : params.before,
        after: params === null || params === void 0 ? void 0 : params.after
      }, "privateChat");
      if (mappedParams.limit !== undefined) {
        mappedParams.limit = sanitizeLimit(mappedParams.limit);
      }
      var response = yield _this6.httpClient.get(EnhancedApi.PRIVATE_SESSION_MESSAGES.replace("{sessionId}", encodeURIComponent(sessionId)), mappedParams);
      var data = handleApiResponse(response, "Failed to get messages");
      return data.items || [];
    })();
  }
  markAsRead(messageId, userId) {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      var mappedParams = mapParams({
        messageId,
        userId
      }, "privateChat");
      var response = yield _this7.httpClient.post(EnhancedApi.PRIVATE_MESSAGE_READ.replace("{messageId}", encodeURIComponent(messageId)), mappedParams);
      handleApiResponse(response, "Failed to mark as read");
      return true;
    })();
  }
  getUnreadCount() {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this8.httpClient.get(EnhancedApi.PRIVATE_UNREAD_COUNT);
      var data = handleApiResponse(response, "Failed to get unread count");
      return {
        total_unread: data.unread_count || 0,
        by_room: []
      };
    })();
  }
  searchMessages(params) {
    var _this9 = this;
    return _asyncToGenerator(function* () {
      var {
        userId,
        query,
        limit = 50,
        roomId
      } = params;
      var queryParams = {
        userId,
        q: query,
        limit: limit.toString()
      };
      if (roomId) {
        queryParams.roomId = roomId;
      }
      var response = yield _this9.httpClient.get(EnhancedApi.PRIVATE_SEARCH, queryParams);
      var data = handleApiResponse(response, "Failed to search messages");
      return data.items || [];
    })();
  }

  /**
   * Search private chat sessions by query.
   *
   * @param params - Search parameters.
   * @param params.query - The search query string.
   * @param params.limit - Maximum number of results to return.
   * @param params.userId - Optional user ID to filter by.
   * @returns Promise resolving to an array of matching sessions.
   */
  searchSessions(params) {
    var _this0 = this;
    return _asyncToGenerator(function* () {
      var {
        query,
        limit = 20,
        userId
      } = params;
      var queryParams = {
        q: query,
        limit: limit.toString()
      };
      if (userId) {
        queryParams.user_id = userId;
      }
      var response = yield _this0.httpClient.get("".concat(EnhancedApi.PRIVATE_SESSIONS, "/search"), queryParams);
      var data = handleApiResponse(response, "Failed to search sessions");
      return data.items || [];
    })();
  }
  getSessionStatistics(sessionId) {
    var _this1 = this;
    return _asyncToGenerator(function* () {
      var _data$message_count, _data$participant_cou;
      var response = yield _this1.httpClient.get(EnhancedApi.PRIVATE_SESSION_STATS.replace("{sessionId}", encodeURIComponent(sessionId)));
      var data = handleApiResponse(response, "Failed to get session statistics");
      return {
        messageCount: (_data$message_count = data.message_count) !== null && _data$message_count !== void 0 ? _data$message_count : 0,
        participantCount: (_data$participant_cou = data.participant_count) !== null && _data$participant_cou !== void 0 ? _data$participant_cou : 0,
        lastActivity: data.last_activity
      };
    })();
  }
  getChatroomDetail(roomId) {
    var _this10 = this;
    return _asyncToGenerator(function* () {
      try {
        var response = yield _this10.httpClient.get(EnhancedApi.PRIVATE_SESSION_DETAIL.replace("{sessionId}", encodeURIComponent(roomId)));
        return handleApiResponse(response, "Failed to get chatroom detail");
      } catch (error) {
        if (error instanceof Error && (error.message.includes("not found") || error.message.includes("not exist"))) {
          return null;
        }
        throw error;
      }
    })();
  }
  leaveChatroom(roomId) {
    var _this11 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this11.httpClient.post(EnhancedApi.PRIVATE_ROOM_LEAVE.replace("{roomId}", encodeURIComponent(roomId)), {});
      var data = handleApiResponse(response, "Failed to leave chatroom");
      return data.room_id === roomId;
    })();
  }
  muteChatroom(roomId, mute) {
    var _this12 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this12.httpClient.post(EnhancedApi.PRIVATE_ROOM_MUTE.replace("{roomId}", encodeURIComponent(roomId)), {
        mute
      });
      var data = handleApiResponse(response, "Failed to mute chatroom");
      return data.mute === mute;
    })();
  }
  deleteMessage(_roomId, messageId) {
    var _this13 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this13.httpClient.delete(EnhancedApi.PRIVATE_MESSAGE_DELETE.replace("{messageId}", encodeURIComponent(messageId)));
      var data = handleApiResponse(response, "Failed to delete message");
      return data.message_id === messageId;
    })();
  }
  getFiles(roomId) {
    var _this14 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this14.httpClient.get(EnhancedApi.PRIVATE_ROOM_FILES.replace("{roomId}", encodeURIComponent(roomId)));
      var data = handleApiResponse(response, "Failed to get files");
      return data.files || [];
    })();
  }
  getVoiceMessages(roomId) {
    var _this15 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this15.httpClient.get(EnhancedApi.PRIVATE_ROOM_VOICE.replace("{roomId}", encodeURIComponent(roomId)));
      var data = handleApiResponse(response, "Failed to get voice messages");
      return data.voice_messages || [];
    })();
  }
}
//# sourceMappingURL=private-chat.js.map