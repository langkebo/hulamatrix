import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import { BaseApi } from "../utils/base-api.js";
import { EnhancedApi } from "../constants/api.js";
export class FriendsBasicApi extends BaseApi {
  constructor(httpClient) {
    super(httpClient);
  }
  getFriends(params) {
    var _this = this;
    return _asyncToGenerator(function* () {
      return _this.get(EnhancedApi.FRIENDS, params);
    })();
  }
  getFriend(friendId) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this2.get(EnhancedApi.FRIENDS_DETAIL.replace("{userId}", encodeURIComponent(friendId)));
      return response.friend;
    })();
  }
  checkFriendship(otherUserId) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var _response$is_friend;
      var response = yield _this3.get(EnhancedApi.FRIENDS_CHECK.replace("{userId}", encodeURIComponent(otherUserId)));
      return (_response$is_friend = response.is_friend) !== null && _response$is_friend !== void 0 ? _response$is_friend : false;
    })();
  }
  setRemark(friendId, remark) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      try {
        yield _this4.put(EnhancedApi.FRIENDS_REMARK.replace("{userId}", encodeURIComponent(friendId)), {
          remark
        });
        return true;
      } catch (_unused) {
        return false;
      }
    })();
  }
  deleteFriend(friendId) {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this5.deleteRequest(EnhancedApi.FRIENDS_DELETE.replace("{userId}", encodeURIComponent(friendId)));
      return response.status === "ok";
    })();
  }
}
//# sourceMappingURL=friends-basic.js.map