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

import { handleApiResponse } from "../utils/response-formatter.js";
import { mapParams, sanitizeLimit } from "../utils/api-mapping.js";
import { registerDeprecation } from "../utils/deprecation.js";
import { EnhancedApi } from "../constants/api.js";
import { BaseApi } from "../utils/base-api.js";
registerDeprecation({
  method: "FriendsStatsApi.getRecommendations",
  since: "2.0.0",
  removedIn: "3.0.0",
  alternative: "FriendsBasicApi.searchFriends",
  migrationGuide: "Use FriendsBasicApi.searchFriends() with appropriate search parameters instead. This method will be removed in version 3.0.0.",
  severity: "medium"
});
registerDeprecation({
  method: "FriendsStatsApi.searchUsers",
  since: "2.0.0",
  removedIn: "3.0.0",
  alternative: "FriendsBasicApi.searchFriends",
  migrationGuide: "This is a Synapse-specific extension. Use FriendsBasicApi.searchFriends() for standard Matrix API compatibility.",
  severity: "low"
});
registerDeprecation({
  method: "FriendsStatsApi.getMutualFriends",
  since: "2.0.0",
  removedIn: "3.0.0",
  alternative: "FriendsBasicApi.getFriends",
  migrationGuide: "This is a Synapse-specific extension. For standard Matrix API, use FriendsBasicApi.getFriends() and filter for mutual connections on the client side if needed.",
  severity: "medium"
});
registerDeprecation({
  method: "FriendsStatsApi.getRecentFriends",
  since: "2.0.0",
  removedIn: "3.0.0",
  alternative: "FriendsBasicApi.getFriends",
  migrationGuide: "This is a Synapse-specific extension. For standard Matrix API, maintain a local cache of recently interacted friends using FriendsBasicApi.getFriends() with timestamp tracking.",
  severity: "low"
});
registerDeprecation({
  method: "FriendsStatsApi.getFriendInteractions",
  since: "2.0.0",
  removedIn: "3.0.0",
  alternative: "N/A",
  migrationGuide: "This is a Synapse-specific extension. Store interaction history locally using FriendsBasicApi events for standard Matrix API compatibility.",
  severity: "low"
});
registerDeprecation({
  method: "FriendsStatsApi.recordInteraction",
  since: "2.0.0",
  removedIn: "3.0.0",
  alternative: "N/A",
  migrationGuide: "This is a Synapse-specific extension. Use FriendsBasicApi.sendMessage() to record interactions as room events for standard Matrix API compatibility.",
  severity: "low"
});
registerDeprecation({
  method: "FriendsStatsApi.getInteractionStats",
  since: "2.0.0",
  removedIn: "3.0.0",
  alternative: "N/A",
  migrationGuide: "This is a Synapse-specific extension. Calculate interaction statistics locally using FriendsBasicApi.getEvents() for standard Matrix API compatibility.",
  severity: "low"
});
registerDeprecation({
  method: "FriendsStatsApi.searchBlockedUsers",
  since: "2.0.0",
  removedIn: "3.0.0",
  alternative: "FriendsBlockApi.getBlockedUsers",
  migrationGuide: "This is a Synapse-specific extension. For standard Matrix API, use FriendsBlockApi.getBlockedUsers() and filter locally.",
  severity: "low"
});
registerDeprecation({
  method: "FriendsStatsApi.getRequestTemplates",
  since: "2.0.0",
  removedIn: "3.0.0",
  alternative: "N/A",
  migrationGuide: "This is a Synapse-specific extension with no direct alternative. Store request templates locally for standard Matrix API compatibility.",
  severity: "low"
});
registerDeprecation({
  method: "FriendsStatsApi.createRequestTemplate",
  since: "2.0.0",
  removedIn: "3.0.0",
  alternative: "N/A",
  migrationGuide: "This is a Synapse-specific extension with no direct alternative. Create and store request templates locally for standard Matrix API compatibility.",
  severity: "low"
});
registerDeprecation({
  method: "FriendsStatsApi.deleteRequestTemplate",
  since: "2.0.0",
  removedIn: "3.0.0",
  alternative: "N/A",
  migrationGuide: "This is a Synapse-specific extension with no direct alternative. Remove request templates from local storage for standard Matrix API compatibility.",
  severity: "low"
});
registerDeprecation({
  method: "FriendsStatsApi.verifyFriendship",
  since: "2.0.0",
  removedIn: "3.0.0",
  alternative: "FriendsVerificationApi.verifyRelationship",
  migrationGuide: "This is a Synapse-specific extension. Use FriendsVerificationApi.verifyRelationship() for standard Matrix API compatibility.",
  severity: "low"
});
export class FriendsStatsApi extends BaseApi {
  constructor(httpClient) {
    super(httpClient);
  }
  getFriendStats() {
    var _this = this;
    return _asyncToGenerator(function* () {
      var _stats$total_friends, _stats$pending_reques, _stats$sent_requests, _stats$categories_cou, _stats$blocked_count;
      var response = yield _this.httpClient.get("".concat(EnhancedApi.FRIENDS, "/stats"));
      var data = handleApiResponse(response, "Failed to get friend stats");
      var stats = data.statistics;
      return {
        total_friends: (_stats$total_friends = stats === null || stats === void 0 ? void 0 : stats.total_friends) !== null && _stats$total_friends !== void 0 ? _stats$total_friends : 0,
        pending_requests: (_stats$pending_reques = stats === null || stats === void 0 ? void 0 : stats.pending_requests) !== null && _stats$pending_reques !== void 0 ? _stats$pending_reques : 0,
        sent_requests: (_stats$sent_requests = stats === null || stats === void 0 ? void 0 : stats.sent_requests) !== null && _stats$sent_requests !== void 0 ? _stats$sent_requests : 0,
        categories_count: (_stats$categories_cou = stats === null || stats === void 0 ? void 0 : stats.categories_count) !== null && _stats$categories_cou !== void 0 ? _stats$categories_cou : 0,
        blocked_count: (_stats$blocked_count = stats === null || stats === void 0 ? void 0 : stats.blocked_count) !== null && _stats$blocked_count !== void 0 ? _stats$blocked_count : 0,
        recent_friends_count: stats === null || stats === void 0 ? void 0 : stats.recent_friends_count
      };
    })();
  }

  /**
   * @deprecated Use FriendsBasicApi.searchFriends() instead. This method will be removed in version 3.0.0.
   */
  getRecommendations(limit, params) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var _responsePagination$h, _responsePagination$p, _responsePagination$l, _responsePagination$t;
      var mappedParams = mapParams({
        limit,
        cursor: params === null || params === void 0 ? void 0 : params.cursor
      }, "friends");
      if (mappedParams.limit !== undefined) {
        mappedParams.limit = sanitizeLimit(mappedParams.limit);
      }
      var response = yield _this2.httpClient.get("".concat(EnhancedApi.FRIENDS, "/recommendations"), mappedParams);
      var data = handleApiResponse(response, "Failed to get friend recommendations");
      var responsePagination = data.pagination;
      return {
        recommendations: data.items || [],
        pagination: {
          has_more: (_responsePagination$h = responsePagination === null || responsePagination === void 0 ? void 0 : responsePagination.has_more) !== null && _responsePagination$h !== void 0 ? _responsePagination$h : false,
          page: (_responsePagination$p = responsePagination === null || responsePagination === void 0 ? void 0 : responsePagination.page) !== null && _responsePagination$p !== void 0 ? _responsePagination$p : 1,
          page_size: (_responsePagination$l = responsePagination === null || responsePagination === void 0 ? void 0 : responsePagination.limit) !== null && _responsePagination$l !== void 0 ? _responsePagination$l : limit || 10,
          total: (_responsePagination$t = responsePagination === null || responsePagination === void 0 ? void 0 : responsePagination.total) !== null && _responsePagination$t !== void 0 ? _responsePagination$t : 0,
          cursor: responsePagination === null || responsePagination === void 0 ? void 0 : responsePagination.cursor
        }
      };
    })();
  }

  /**
   * @deprecated This is a Synapse-specific extension. Use FriendsBasicApi.searchFriends() for standard Matrix API compatibility.
   */
  searchUsers(query) {
    var _arguments = arguments,
      _this3 = this;
    return _asyncToGenerator(function* () {
      var _data$page, _data$page_size, _data$total, _data$total_pages;
      var page = _arguments.length > 1 && _arguments[1] !== undefined ? _arguments[1] : 1;
      var pageSize = _arguments.length > 2 && _arguments[2] !== undefined ? _arguments[2] : 20;
      var mappedParams = mapParams({
        q: query,
        page,
        page_size: pageSize
      }, "friends");
      var response = yield _this3.httpClient.get("".concat(EnhancedApi.FRIENDS, "/stats/users"), mappedParams);
      var data = handleApiResponse(response, "Failed to search users");
      return {
        items: (data.items || []).map(item => ({
          userId: item.user_id,
          displayName: item.display_name,
          avatarUrl: item.avatar_url,
          bio: item.bio
        })),
        pagination: {
          page: (_data$page = data.page) !== null && _data$page !== void 0 ? _data$page : page,
          pageSize: (_data$page_size = data.page_size) !== null && _data$page_size !== void 0 ? _data$page_size : pageSize,
          total: (_data$total = data.total) !== null && _data$total !== void 0 ? _data$total : 0,
          totalPages: (_data$total_pages = data.total_pages) !== null && _data$total_pages !== void 0 ? _data$total_pages : 0
        }
      };
    })();
  }

  /**
   * @deprecated This is a Synapse-specific extension. For standard Matrix API, use FriendsBasicApi.getFriends() and filter for mutual connections on the client side if needed.
   */
  getMutualFriends(userId) {
    var _arguments2 = arguments,
      _this4 = this;
    return _asyncToGenerator(function* () {
      var _data$page2, _data$page_size2, _data$total2, _data$total_pages2;
      var page = _arguments2.length > 1 && _arguments2[1] !== undefined ? _arguments2[1] : 1;
      var pageSize = _arguments2.length > 2 && _arguments2[2] !== undefined ? _arguments2[2] : 20;
      var mappedParams = mapParams({
        user_id: userId,
        page,
        page_size: pageSize
      }, "friends");
      var response = yield _this4.httpClient.get("".concat(EnhancedApi.FRIENDS, "/stats/mutual"), mappedParams);
      var data = handleApiResponse(response, "Failed to get mutual friends");
      return {
        items: (data.items || []).map(item => ({
          userId: item.user_id,
          displayName: item.display_name,
          avatarUrl: item.avatar_url,
          remark: item.remark,
          mutualCount: item.mutual_count
        })),
        pagination: {
          page: (_data$page2 = data.page) !== null && _data$page2 !== void 0 ? _data$page2 : page,
          pageSize: (_data$page_size2 = data.page_size) !== null && _data$page_size2 !== void 0 ? _data$page_size2 : pageSize,
          total: (_data$total2 = data.total) !== null && _data$total2 !== void 0 ? _data$total2 : 0,
          totalPages: (_data$total_pages2 = data.total_pages) !== null && _data$total_pages2 !== void 0 ? _data$total_pages2 : 0
        }
      };
    })();
  }

  /**
   * @deprecated This is a Synapse-specific extension. For standard Matrix API, maintain a local cache of recently interacted friends using FriendsBasicApi.getFriends() with timestamp tracking.
   */
  getRecentFriends() {
    var _arguments3 = arguments,
      _this5 = this;
    return _asyncToGenerator(function* () {
      var limit = _arguments3.length > 0 && _arguments3[0] !== undefined ? _arguments3[0] : 20;
      var mappedParams = mapParams({
        limit
      }, "friends");
      var response = yield _this5.httpClient.get("".concat(EnhancedApi.FRIENDS, "/stats/recent"), mappedParams);
      var data = handleApiResponse(response, "Failed to get recent friends");
      return (data.items || []).map(item => ({
        userId: item.user_id,
        displayName: item.display_name,
        avatarUrl: item.avatar_url,
        remark: item.remark,
        lastInteraction: item.last_interaction,
        interactionCount: item.interaction_count
      }));
    })();
  }

  /**
   * @deprecated This is a Synapse-specific extension. Store interaction history locally using FriendsBasicApi events for standard Matrix API compatibility.
   */
  getFriendInteractions(friendId) {
    var _arguments4 = arguments,
      _this6 = this;
    return _asyncToGenerator(function* () {
      var _data$page3, _data$page_size3, _data$total3, _data$total_pages3;
      var page = _arguments4.length > 1 && _arguments4[1] !== undefined ? _arguments4[1] : 1;
      var pageSize = _arguments4.length > 2 && _arguments4[2] !== undefined ? _arguments4[2] : 20;
      var mappedParams = mapParams({
        friend_id: friendId,
        page,
        page_size: pageSize
      }, "friends");
      var response = yield _this6.httpClient.get("".concat(EnhancedApi.FRIENDS, "/stats/interactions"), mappedParams);
      var data = handleApiResponse(response, "Failed to get friend interactions");
      return {
        items: (data.items || []).map(item => ({
          interactionId: item.interaction_id,
          interactionType: item.interaction_type,
          content: item.content,
          metadata: item.metadata,
          createdAt: item.created_at
        })),
        pagination: {
          page: (_data$page3 = data.page) !== null && _data$page3 !== void 0 ? _data$page3 : page,
          pageSize: (_data$page_size3 = data.page_size) !== null && _data$page_size3 !== void 0 ? _data$page_size3 : pageSize,
          total: (_data$total3 = data.total) !== null && _data$total3 !== void 0 ? _data$total3 : 0,
          totalPages: (_data$total_pages3 = data.total_pages) !== null && _data$total_pages3 !== void 0 ? _data$total_pages3 : 0
        }
      };
    })();
  }

  /**
   * @deprecated This is a Synapse-specific extension. Use FriendsBasicApi.sendMessage() to record interactions as room events for standard Matrix API compatibility.
   */
  recordInteraction(friendId, interactionType, content, metadata) {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this7.httpClient.post("".concat(EnhancedApi.FRIENDS, "/stats/interactions"), {
        friend_id: friendId,
        interaction_type: interactionType,
        content,
        metadata
      });
      var data = handleApiResponse(response, "Failed to record interaction");
      return data.interaction_id || "";
    })();
  }

  /**
   * @deprecated This is a Synapse-specific extension. Calculate interaction statistics locally using FriendsBasicApi.getEvents() for standard Matrix API compatibility.
   */
  getInteractionStats(userId) {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      var _data$total_interacti, _data$messages_count, _data$friend_requests, _data$room_joins_coun;
      var response = yield _this8.httpClient.get("".concat(EnhancedApi.FRIENDS, "/stats/").concat(encodeURIComponent(userId)));
      var data = handleApiResponse(response, "Failed to get interaction stats");
      return {
        userId: data.user_id || userId,
        friendId: data.friend_id,
        totalInteractions: (_data$total_interacti = data.total_interactions) !== null && _data$total_interacti !== void 0 ? _data$total_interacti : 0,
        messagesCount: (_data$messages_count = data.messages_count) !== null && _data$messages_count !== void 0 ? _data$messages_count : 0,
        friendRequestsCount: (_data$friend_requests = data.friend_requests_count) !== null && _data$friend_requests !== void 0 ? _data$friend_requests : 0,
        roomJoinsCount: (_data$room_joins_coun = data.room_joins_count) !== null && _data$room_joins_coun !== void 0 ? _data$room_joins_coun : 0,
        lastInteraction: data.last_interaction
      };
    })();
  }

  /**
   * @deprecated This is a Synapse-specific extension. For standard Matrix API, use FriendsBlockApi.getBlockedUsers() and filter locally.
   */
  searchBlockedUsers(query) {
    var _arguments5 = arguments,
      _this9 = this;
    return _asyncToGenerator(function* () {
      var _data$page4, _data$page_size4, _data$total4, _data$total_pages4;
      var page = _arguments5.length > 1 && _arguments5[1] !== undefined ? _arguments5[1] : 1;
      var pageSize = _arguments5.length > 2 && _arguments5[2] !== undefined ? _arguments5[2] : 20;
      var mappedParams = mapParams({
        q: query,
        page,
        page_size: pageSize
      }, "friends");
      var response = yield _this9.httpClient.get("".concat(EnhancedApi.FRIENDS, "/stats/blocked/search"), mappedParams);
      var data = handleApiResponse(response, "Failed to search blocked users");
      return {
        items: (data.items || []).map(item => ({
          user_id: item.user_id,
          display_name: undefined,
          reason: item.reason,
          blocked_at: item.blocked_at
        })),
        pagination: {
          page: (_data$page4 = data.page) !== null && _data$page4 !== void 0 ? _data$page4 : page,
          pageSize: (_data$page_size4 = data.page_size) !== null && _data$page_size4 !== void 0 ? _data$page_size4 : pageSize,
          total: (_data$total4 = data.total) !== null && _data$total4 !== void 0 ? _data$total4 : 0,
          totalPages: (_data$total_pages4 = data.total_pages) !== null && _data$total_pages4 !== void 0 ? _data$total_pages4 : 0
        }
      };
    })();
  }

  /**
   * @deprecated This is a Synapse-specific extension with no direct alternative. Store request templates locally for standard Matrix API compatibility.
   */
  getRequestTemplates() {
    var _this0 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this0.httpClient.get("".concat(EnhancedApi.FRIENDS, "/stats/templates"));
      var data = handleApiResponse(response, "Failed to get request templates");
      return (data.templates || []).map(template => ({
        templateId: template.template_id,
        name: template.name,
        message: template.message,
        categoryId: template.category_id,
        createdAt: template.created_at
      }));
    })();
  }

  /**
   * @deprecated This is a Synapse-specific extension with no direct alternative. Create and store request templates locally for standard Matrix API compatibility.
   */
  createRequestTemplate(name, message, categoryId) {
    var _this1 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this1.httpClient.post("".concat(EnhancedApi.FRIENDS, "/stats/templates"), {
        name,
        message,
        category_id: categoryId
      });
      var data = handleApiResponse(response, "Failed to create request template");
      return data.template_id || "";
    })();
  }

  /**
   * @deprecated This is a Synapse-specific extension with no direct alternative. Remove request templates from local storage for standard Matrix API compatibility.
   */
  deleteRequestTemplate(templateId) {
    var _this10 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this10.httpClient.delete("".concat(EnhancedApi.FRIENDS, "/stats/templates/").concat(encodeURIComponent(templateId)));
      handleApiResponse(response, "Failed to delete request template");
      return true;
    })();
  }

  /**
   * @deprecated This is a Synapse-specific extension. Use FriendsVerificationApi.verifyRelationship() for standard Matrix API compatibility.
   */
  verifyFriendship(friendId) {
    var _this11 = this;
    return _asyncToGenerator(function* () {
      var _data$verified;
      var response = yield _this11.httpClient.get("".concat(EnhancedApi.FRIENDS, "/").concat(encodeURIComponent(friendId), "/verify"));
      var data = handleApiResponse(response, "Failed to verify friendship");
      return {
        verified: (_data$verified = data.verified) !== null && _data$verified !== void 0 ? _data$verified : false,
        friendId: data.friend_id || friendId,
        relationshipType: data.relationship_type,
        since: data.since
      };
    })();
  }
}
//# sourceMappingURL=friends-stats.js.map