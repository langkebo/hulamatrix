import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import { validateUserId, validateRoomId, validateString } from "../utils/validator.js";
import { EnhancedApi } from "../constants/api.js";
import { handleApiResponse } from "../utils/response-formatter.js";
export class FriendRequestsApi {
  constructor(httpClient) {
    this.httpClient = httpClient;
  }

  /**
   * Send a friend request to a user
   * POST /_synapse/enhanced/friend/request
   */
  sendFriendRequest(params) {
    var _this = this;
    return _asyncToGenerator(function* () {
      validateUserId(params.target_user_id);
      if (params.message !== undefined) {
        validateString(params.message, "message", {
          maxLength: 1000
        });
      }

      // Use the friend/request endpoint (singular)
      var endpoint = "/friend/request";
      var response = yield _this.httpClient.post(endpoint, params);
      return handleApiResponse(response, "Failed to send friend request");
    })();
  }

  /**
   * Get pending friend requests
   * GET /_synapse/enhanced/friend/requests
   */
  getFriendRequests() {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var _handleApiResponse;
      var response = yield _this2.httpClient.get(EnhancedApi.FRIENDS_REQUESTS);
      return ((_handleApiResponse = handleApiResponse(response, "Failed to get friend requests")) === null || _handleApiResponse === void 0 ? void 0 : _handleApiResponse.requests) || [];
    })();
  }

  /**
   * Accept a friend request
   * POST /_synapse/enhanced/friend/request/{request_id}/accept
   */
  acceptFriendRequest(roomId) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      validateRoomId(roomId);
      var response = yield _this3.httpClient.post(EnhancedApi.FRIENDS_REQUEST_ACCEPT.replace("{requestId}", encodeURIComponent(roomId)), {});
      return handleApiResponse(response, "Failed to accept friend request");
    })();
  }

  /**
   * Reject (decline) a friend request
   * POST /_synapse/enhanced/friend/request/{request_id}/decline
   */
  rejectFriendRequest(roomId) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      validateRoomId(roomId);
      var response = yield _this4.httpClient.post(EnhancedApi.FRIENDS_REQUEST_DECLINE.replace("{requestId}", encodeURIComponent(roomId)), {});
      return handleApiResponse(response, "Failed to reject friend request");
    })();
  }
}
//# sourceMappingURL=friend-requests.js.map