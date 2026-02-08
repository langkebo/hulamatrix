import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import { mapParams } from "../utils/api-mapping.js";
import { validateString } from "../utils/validator.js";
import { MatrixClientApi } from "../constants/api.js";
import { handleApiResponse } from "../utils/response-formatter.js";
import { BaseApi } from "../utils/base-api.js";
export class FriendsVerificationApi extends BaseApi {
  constructor(httpClient) {
    super(httpClient);
  }
  removeFriend(friendId) {
    var _this = this;
    return _asyncToGenerator(function* () {
      validateString(friendId, "friendId", {
        minLength: 1
      });
      var mappedParams = mapParams({
        friendId
      }, "friends");
      var response = yield _this.httpClient.delete("".concat(MatrixClientApi.FRIENDS, "/").concat(encodeURIComponent(friendId)), mappedParams);
      handleApiResponse(response, "Failed to remove friend");
      return true;
    })();
  }
}
//# sourceMappingURL=friends-verification.js.map