import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import { validateUserId, validateArray } from "../utils/validator.js";
export class BlockedUsersApi {
  constructor(httpClient) {
    this.httpClient = httpClient;
  }
  getBlocked() {
    var _this = this;
    return _asyncToGenerator(function* () {
      var response = yield _this.httpClient.get("/_matrix/client/v1/friends/blocked");
      return response.data;
    })();
  }
  addUserToBlocked(userId) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      validateUserId(userId);
      var response = yield _this2.httpClient.post("/_matrix/client/v1/friends/blocked", {
        user_id: userId
      });
      return response.data;
    })();
  }
  checkBlocked(userId) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      validateUserId(userId);
      var response = yield _this3.httpClient.get("/_matrix/client/v1/friends/blocked/".concat(encodeURIComponent(userId)));
      return response.data;
    })();
  }
  removeBlocked(userId) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      validateUserId(userId);
      var response = yield _this4.httpClient.delete("/_matrix/client/v1/friends/blocked/".concat(encodeURIComponent(userId)));
      return response.data;
    })();
  }
  batchBlockUsers(userIds) {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      validateArray(userIds, "userIds", {
        minLength: 1,
        maxLength: 100,
        itemValidator: item => validateUserId(item)
      });
      var response = yield _this5.httpClient.post("/_matrix/client/v1/friends/blocked/batch", {
        user_ids: userIds
      });
      return response.data;
    })();
  }
}
//# sourceMappingURL=blocked-users.js.map