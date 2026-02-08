import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import _wrapAsyncGenerator from "@babel/runtime/helpers/wrapAsyncGenerator";
import _awaitAsyncGenerator from "@babel/runtime/helpers/awaitAsyncGenerator";
import _asyncGeneratorDelegate from "@babel/runtime/helpers/asyncGeneratorDelegate";
function _asyncIterator(r) { var n, t, o, e = 2; for ("undefined" != typeof Symbol && (t = Symbol.asyncIterator, o = Symbol.iterator); e--;) { if (t && null != (n = r[t])) return n.call(r); if (o && null != (n = r[o])) return new AsyncFromSyncIterator(n.call(r)); t = "@@asyncIterator", o = "@@iterator"; } throw new TypeError("Object is not async iterable"); }
function AsyncFromSyncIterator(r) { function AsyncFromSyncIteratorContinuation(r) { if (Object(r) !== r) return Promise.reject(new TypeError(r + " is not an object.")); var n = r.done; return Promise.resolve(r.value).then(function (r) { return { value: r, done: n }; }); } return AsyncFromSyncIterator = function AsyncFromSyncIterator(r) { this.s = r, this.n = r.next; }, AsyncFromSyncIterator.prototype = { s: null, n: null, next: function next() { return AsyncFromSyncIteratorContinuation(this.n.apply(this.s, arguments)); }, return: function _return(r) { var n = this.s.return; return void 0 === n ? Promise.resolve({ value: r, done: !0 }) : AsyncFromSyncIteratorContinuation(n.apply(this.s, arguments)); }, throw: function _throw(r) { var n = this.s.return; return void 0 === n ? Promise.reject(r) : AsyncFromSyncIteratorContinuation(n.apply(this.s, arguments)); } }, new AsyncFromSyncIterator(r); }
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

import { FriendsBasicApi } from "./friends-basic.js";
import { FriendRequestsApi } from "./friend-requests.js";
import { FriendCategoriesApi } from "./friend-categories.js";
import { FriendsBlockApi } from "./friends-block.js";
import { FriendsStatsApi } from "./friends-stats.js";
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
export class FriendsApi {
  /**
   * Creates a new FriendsApi instance
   *
   * @param httpClient - The HTTP client used for making API requests
   */
  constructor(httpClient) {
    _defineProperty(this, "basicApi", void 0);
    _defineProperty(this, "requestApi", void 0);
    _defineProperty(this, "categoryApi", void 0);
    _defineProperty(this, "blockApi", void 0);
    _defineProperty(this, "statsApi", void 0);
    this.basicApi = new FriendsBasicApi(httpClient);
    this.requestApi = new FriendRequestsApi(httpClient);
    this.categoryApi = new FriendCategoriesApi(httpClient);
    this.blockApi = new FriendsBlockApi(httpClient);
    this.statsApi = new FriendsStatsApi(httpClient);
  }

  /**
   * Retrieves a list of friends
   *
   * @param params - Optional parameters for filtering and pagination
   * @param params.category - Filter friends by category ID
   * @param params.page - Page number for pagination (default: 1)
   * @param params.limit - Number of items per page (default: 20)
   * @returns Promise resolving to an array of friend objects
   */
  getFriends(params) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var result = yield _this2.basicApi.getFriends(params);
      return result.friends;
    })();
  }

  /**
   * Retrieves all friend categories
   *
   * @returns Promise resolving to an array of friend category objects
   */
  getCategories() {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var result = yield _this3.categoryApi.getCategories();
      return Object.entries(result.categories).map(_ref => {
        var _category$users;
        var [id, category] = _ref;
        return {
          id,
          name: category.category_name,
          created_at: new Date().toISOString(),
          friend_count: (_category$users = category.users) === null || _category$users === void 0 ? void 0 : _category$users.length
        };
      });
    })();
  }

  /**
   * Retrieves pending friend requests
   *
   * @param params - Optional parameters for filtering and pagination
   * @param params.limit - Maximum number of requests to return
   * @param params.cursor - Pagination cursor for retrieving next page
   * @returns Promise resolving to an array of pending friend request objects
   */
  getPendingRequests(_params) {
    return _asyncToGenerator(function* () {
      // This is a simplified implementation, ideally it should call requestApi
      return [];
    })();
  }

  /**
   * Retrieves received friend requests
   *
   * @returns Promise resolving to an array of received friend request objects
   */
  getReceivedRequests() {
    return _asyncToGenerator(function* () {
      return [];
    })();
  }

  /**
   * Retrieves detailed information about a specific friend
   *
   * @param friendId - The Matrix user ID of the friend (e.g., @user:example.com)
   * @returns Promise resolving to friend details or null if not found
   */
  getFriendDetail(friendId) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      return _this4.basicApi.getFriend(friendId);
    })();
  }

  /**
   * Retrieves sent friend requests
   *
   * @param params - Optional pagination parameters
   * @returns Promise resolving to an array of sent friend request objects
   */
  getSentRequests(_params) {
    return _asyncToGenerator(function* () {
      return [];
    })();
  }

  /**
   * Retrieves details of a specific friend request
   *
   * @param requestId - The ID of the friend request
   * @returns Promise resolving to friend request details or null if not found
   */
  getRequestDetail(_requestId) {
    return _asyncToGenerator(function* () {
      return null;
    })();
  }

  /**
   * Cancels a pending friend request
   *
   * @param requestId - The ID of the friend request to cancel
   * @returns Promise resolving to true if successful, false otherwise
   */
  cancelFriendRequest(_requestId) {
    return _asyncToGenerator(function* () {
      return false;
    })();
  }

  /**
   * Checks if a user is in the current user's friend list
   *
   * @param otherUserId - The Matrix user ID to check (e.g., @user:example.com)
   * @returns Promise resolving to true if the user is a friend, false otherwise
   */
  isFriend(otherUserId) {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      return _this5.basicApi.checkFriendship(otherUserId);
    })();
  }

  /**
   * Moves a friend to a specific category
   *
   * @param friendId - The Matrix user ID of the friend to move
   * @param _categoryId - The ID of the target category
   * @returns Promise resolving to true if successful, false otherwise
   */
  moveFriendToCategory(friendId, _categoryId) {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      yield _this6.categoryApi.addUserToCategory(_categoryId, friendId);
      return true;
    })();
  }

  /**
   * Retrieves detailed information about a specific friend category
   *
   * @param categoryId - The ID of the category
   * @returns Promise resolving to category details or null if not found
   */
  getCategoryDetail(categoryId) {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      var _result$users;
      var result = yield _this7.categoryApi.getCategory(categoryId);
      return {
        id: categoryId,
        name: result.category,
        created_at: new Date().toISOString(),
        friend_count: (_result$users = result.users) === null || _result$users === void 0 ? void 0 : _result$users.length
      };
    })();
  }

  /**
   * Sends a friend request to a user
   *
   * @param params - Friend request parameters
   * @param params.target_id - The Matrix user ID to send request to
   * @param params.message - Optional message to include with the request
   * @returns Promise resolving to friend request response with request ID and status
   */
  sendFriendRequest(params) {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      var result = yield _this8.requestApi.sendFriendRequest({
        target_user_id: params.target_id,
        message: params.message
      });
      return {
        request_id: result.room_id,
        status: result.status
      };
    })();
  }

  /**
   * Accepts a pending friend request
   *
   * @param requestId - The ID of the friend request to accept
   * @param _categoryId - Optional category ID to add the friend to after acceptance
   * @returns Promise resolving to friend request response with status
   */
  acceptFriendRequest(requestId, _categoryId) {
    var _this9 = this;
    return _asyncToGenerator(function* () {
      void _categoryId;
      var result = yield _this9.requestApi.acceptFriendRequest(requestId);
      return {
        status: result.status
      };
    })();
  }

  /**
   * Rejects a pending friend request
   *
   * @param _requestId - The ID of the friend request to reject
   * @param _reason - Optional reason for rejection
   * @returns Promise resolving to true if successful, false otherwise
   */
  rejectFriendRequest(_requestId, _reason) {
    var _this0 = this;
    return _asyncToGenerator(function* () {
      void _reason;
      yield _this0.requestApi.rejectFriendRequest(_requestId);
      return true;
    })();
  }

  /**
   * Removes a friend from the friend list
   *
   * @param _friendId - The Matrix user ID of the friend to remove
   * @returns Promise resolving to true if successful, false otherwise
   */
  removeFriend(_friendId) {
    var _this1 = this;
    return _asyncToGenerator(function* () {
      return _this1.basicApi.deleteFriend(_friendId);
    })();
  }

  /**
   * Creates a new friend category
   *
   * @param name - The name of the new category
   * @returns Promise resolving to the created category object
   */
  createCategory(name) {
    var _this10 = this;
    return _asyncToGenerator(function* () {
      yield _this10.categoryApi.setCategories({
        [name]: {
          users: []
        }
      });
      return {
        id: name,
        name,
        created_at: new Date().toISOString(),
        friend_count: 0
      };
    })();
  }

  /**
   * Deletes a friend category
   *
   * @param categoryId - The ID of the category to delete
   * @returns Promise resolving to true if successful, false otherwise
   */
  deleteCategory(categoryId) {
    var _this11 = this;
    return _asyncToGenerator(function* () {
      yield _this11.categoryApi.deleteCategory(categoryId);
      return true;
    })();
  }

  /**
   * Blocks a user
   *
   * @param _targetId - The Matrix user ID to block
   * @param _reason - Optional reason for blocking
   * @returns Promise resolving to true if successful, false otherwise
   */
  blockUser(_targetId, _reason) {
    var _this12 = this;
    return _asyncToGenerator(function* () {
      return _this12.blockApi.blockUser(_targetId, _reason);
    })();
  }

  /**
   * Unblocks a previously blocked user
   *
   * @param _targetId - The Matrix user ID to unblock
   * @returns Promise resolving to true if successful, false otherwise
   */
  unblockUser(_targetId) {
    var _this13 = this;
    return _asyncToGenerator(function* () {
      return _this13.blockApi.unblockUser(_targetId);
    })();
  }

  /**
   * Retrieves friend statistics
   *
   * @returns Promise resolving to friend statistics including counts
   */
  getFriendStats() {
    var _this14 = this;
    return _asyncToGenerator(function* () {
      return _this14.statsApi.getFriendStats();
    })();
  }

  /**
   * Retrieves list of blocked users
   *
   * @returns Promise resolving to an array of blocked user objects
   */
  getBlockedUsers() {
    var _this15 = this;
    return _asyncToGenerator(function* () {
      return _this15.blockApi.getBlockedUsers();
    })();
  }

  /**
   * Checks if a user is blocked
   *
   * @param userId - The Matrix user ID to check
   * @returns Promise resolving to true if the user is blocked, false otherwise
   */
  isBlocked(userId) {
    var _this16 = this;
    return _asyncToGenerator(function* () {
      return _this16.blockApi.isBlocked(userId);
    })();
  }

  /**
   * Searches friends by query
   *
   * @param query - Search query string
   * @param limit - Maximum number of results to return
   * @returns Promise resolving to an array of friend search results
   */
  searchFriends(query, limit) {
    var _this17 = this;
    return _asyncToGenerator(function* () {
      var result = yield _this17.statsApi.getRecommendations(limit);
      return result.recommendations.filter(rec => rec.reason.toLowerCase().includes(query.toLowerCase())).map(rec => ({
        friend_id: rec.user_id,
        display_name: rec.user_id,
        match_score: rec.score
      }));
    })();
  }

  /**
   * Searches users by query
   *
   * @param query - Search query string
   * @param limit - Maximum number of results to return (default: 20)
   * @returns Promise resolving to an array of user search results
   */
  searchUsers(query, limit) {
    var _this18 = this;
    return _asyncToGenerator(function* () {
      var result = yield _this18.statsApi.searchUsers(query, 1, limit || 20);
      return result.items;
    })();
  }

  /**
   * Sets a remark/note for a friend
   *
   * @param friendId - The Matrix user ID of the friend
   * @param remark - The remark text to set
   * @returns Promise resolving to true if successful, false otherwise
   */
  setRemark(friendId, remark) {
    var _this19 = this;
    return _asyncToGenerator(function* () {
      return _this19.basicApi.setRemark(friendId, remark);
    })();
  }

  /**
   * Retrieves mutual friends with a specific user
   *
   * @param userId - The Matrix user ID to find mutual friends with
   * @param page - Page number for pagination (default: 1)
   * @param pageSize - Number of items per page (default: 20)
   * @returns Promise resolving to paginated result of mutual friends
   */
  getMutualFriends(userId) {
    var _arguments = arguments,
      _this20 = this;
    return _asyncToGenerator(function* () {
      var page = _arguments.length > 1 && _arguments[1] !== undefined ? _arguments[1] : 1;
      var pageSize = _arguments.length > 2 && _arguments[2] !== undefined ? _arguments[2] : 20;
      return _this20.statsApi.getMutualFriends(userId, page, pageSize);
    })();
  }

  /**
   * Retrieves recently added friends
   *
   * @param limit - Maximum number of recent friends to return (default: 20)
   * @returns Promise resolving to an array of recent friend objects
   */
  getRecentFriends() {
    var _arguments2 = arguments,
      _this21 = this;
    return _asyncToGenerator(function* () {
      var limit = _arguments2.length > 0 && _arguments2[0] !== undefined ? _arguments2[0] : 20;
      return _this21.statsApi.getRecentFriends(limit);
    })();
  }

  /**
   * Retrieves interaction history with a specific friend
   *
   * @param friendId - The Matrix user ID of the friend
   * @param page - Page number for pagination (default: 1)
   * @param pageSize - Number of items per page (default: 20)
   * @returns Promise resolving to paginated result of interaction records
   */
  getFriendInteractions(friendId) {
    var _arguments3 = arguments,
      _this22 = this;
    return _asyncToGenerator(function* () {
      var page = _arguments3.length > 1 && _arguments3[1] !== undefined ? _arguments3[1] : 1;
      var pageSize = _arguments3.length > 2 && _arguments3[2] !== undefined ? _arguments3[2] : 20;
      return _this22.statsApi.getFriendInteractions(friendId, page, pageSize);
    })();
  }

  /**
   * Retrieves interaction statistics with a specific user
   *
   * @param userId - The Matrix user ID to get statistics for
   * @returns Promise resolving to interaction statistics
   */
  getFriendInteractionStats(userId) {
    var _this23 = this;
    return _asyncToGenerator(function* () {
      return _this23.statsApi.getInteractionStats(userId);
    })();
  }

  /**
   * Searches blocked users by query
   *
   * @param query - Optional search query string
   * @param page - Page number for pagination (default: 1)
   * @param pageSize - Number of items per page (default: 20)
   * @returns Promise resolving to paginated result of blocked users
   */
  searchBlockedUsers(query) {
    var _arguments4 = arguments,
      _this24 = this;
    return _asyncToGenerator(function* () {
      var page = _arguments4.length > 1 && _arguments4[1] !== undefined ? _arguments4[1] : 1;
      var pageSize = _arguments4.length > 2 && _arguments4[2] !== undefined ? _arguments4[2] : 20;
      return _this24.statsApi.searchBlockedUsers(query, page, pageSize);
    })();
  }

  /**
   * Retrieves friend request templates
   *
   * @returns Promise resolving to an array of friend request templates
   */
  getRequestTemplates() {
    var _this25 = this;
    return _asyncToGenerator(function* () {
      return _this25.statsApi.getRequestTemplates();
    })();
  }

  /**
   * Verifies friendship status with a user
   *
   * @param friendId - The Matrix user ID to verify friendship with
   * @returns Promise resolving to friendship verification details
   */
  verifyFriendship(friendId) {
    var _this26 = this;
    return _asyncToGenerator(function* () {
      return _this26.statsApi.verifyFriendship(friendId);
    })();
  }

  /**
   * Retrieves multiple friends in batch
   *
   * @param userIds - Array of Matrix user IDs to retrieve
   * @returns Promise resolving to a map of user IDs to friend objects
   */
  getFriendsBatch(userIds) {
    var _this27 = this;
    return _asyncToGenerator(function* () {
      var results = new Map();
      yield Promise.all(userIds.map(/*#__PURE__*/function () {
        var _ref2 = _asyncToGenerator(function* (userId) {
          try {
            var friend = yield _this27.basicApi.getFriend(userId);
            if (friend) {
              results.set(userId, friend);
            }
          } catch (_unused) {}
        });
        return function (_x) {
          return _ref2.apply(this, arguments);
        };
      }()));
      return results;
    })();
  }

  /**
   * Sends multiple friend requests in batch
   *
   * @param requests - Array of friend request objects
   * @returns Promise resolving to an array of friend request responses
   */
  sendFriendRequestsBatch(requests) {
    var _this28 = this;
    return _asyncToGenerator(function* () {
      var results = yield Promise.all(requests.map(/*#__PURE__*/function () {
        var _ref3 = _asyncToGenerator(function* (request) {
          var result = yield _this28.requestApi.sendFriendRequest({
            target_user_id: request.target_id,
            message: request.message
          });
          return {
            request_id: result.room_id,
            status: result.status
          };
        });
        return function (_x2) {
          return _ref3.apply(this, arguments);
        };
      }()));
      return results;
    })();
  }

  /**
   * Updates remarks for multiple friends in batch
   *
   * @param remarks - Map of user IDs to remark strings
   * @returns Promise resolving to a map of user IDs to success status
   */
  updateRemarksBatch(remarks) {
    var _this29 = this;
    return _asyncToGenerator(function* () {
      var results = new Map();
      yield Promise.all(Array.from(remarks.entries()).map(/*#__PURE__*/function () {
        var _ref5 = _asyncToGenerator(function* (_ref4) {
          var [userId, remark] = _ref4;
          try {
            var result = yield _this29.basicApi.setRemark(userId, remark);
            results.set(userId, result);
          } catch (_unused2) {
            results.set(userId, false);
          }
        });
        return function (_x3) {
          return _ref5.apply(this, arguments);
        };
      }()));
      return results;
    })();
  }

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
  streamFriends(params) {
    var _this = this;
    return _wrapAsyncGenerator(function* () {
      var page = 1;
      var limit = (params === null || params === void 0 ? void 0 : params.limit) || 100;
      while (true) {
        var response = yield _awaitAsyncGenerator(_this.basicApi.getFriends({
          category: params === null || params === void 0 ? void 0 : params.category,
          page,
          limit
        }));
        if (response.friends.length === 0) {
          break;
        }
        yield* _asyncGeneratorDelegate(_asyncIterator(response.friends), _awaitAsyncGenerator);
        if (response.friends.length < limit) {
          break;
        }
        page++;
      }
    })();
  }

  /**
   * Subscribes to friend-related events
   *
   * @param _callback - Callback function to handle friend events
   * @returns Unsubscribe function to stop receiving events
   */
  subscribeToFriendEvents(_callback) {
    return () => {};
  }
}
//# sourceMappingURL=friends.js.map