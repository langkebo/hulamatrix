import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import { ErrorCode } from "../utils/error-codes.js";
import { EnhancedApi } from "../constants/api.js";
import { handleApiResponse } from "../utils/response-formatter.js";
import { BaseApi } from "../utils/base-api.js";
export class FriendsBlockApi extends BaseApi {
  constructor(httpClient) {
    super(httpClient);
  }
  getBlockedUsers() {
    var _this = this;
    return _asyncToGenerator(function* () {
      var response = yield _this.httpClient.get(EnhancedApi.FRIENDS_BLOCKED_LIST);
      var data = handleApiResponse(response, "Failed to get blocked users");
      var blockedUsers = data.blocked_users || [];
      return blockedUsers.map(user => ({
        user_id: user.user_id,
        display_name: undefined,
        reason: user.reason,
        blocked_at: user.blocked_at
      }));
    })();
  }
  blockUser(targetId, reason) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      if (!targetId || typeof targetId !== "string") {
        throw _this2.createError("Invalid target ID", ErrorCode.INVALID_PARAM);
      }
      var response = yield _this2.httpClient.post(EnhancedApi.FRIENDS_BLOCK, {
        user_id: targetId,
        reason
      });
      handleApiResponse(response, "Failed to block user");
      return true;
    })();
  }
  unblockUser(targetId) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      if (!targetId || typeof targetId !== "string") {
        throw _this3.createError("Invalid target ID", ErrorCode.INVALID_PARAM);
      }
      var response = yield _this3.httpClient.delete(EnhancedApi.FRIENDS_UNBLOCK.replace("{userId}", encodeURIComponent(targetId)));
      handleApiResponse(response, "Failed to unblock user");
      return true;
    })();
  }
  isBlocked(userId) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      if (!userId || typeof userId !== "string") {
        throw _this4.createError("Invalid user ID", ErrorCode.INVALID_PARAM);
      }
      var response = yield _this4.httpClient.get(EnhancedApi.FRIENDS_BLOCKED_CHECK.replace("{userId}", encodeURIComponent(userId)));
      var data = handleApiResponse(response, "Failed to check if user is blocked");
      return data.is_blocked || false;
    })();
  }
}
//# sourceMappingURL=friends-block.js.map