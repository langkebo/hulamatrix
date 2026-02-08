import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import { validateUserId, validateNumber } from "../utils/validator.js";
import { SynapseAdminApi } from "../constants/api.js";
import { handleApiResponse } from "../utils/response-formatter.js";
import { BaseApi } from "../utils/base-api.js";
export class PrivateChatAdminApi extends BaseApi {
  constructor(httpClient) {
    super(httpClient);
  }
  createPrivateChat(params) {
    var _this = this;
    return _asyncToGenerator(function* () {
      var _params$is_encrypted, _params$ttl;
      validateUserId(params.target_user_id);
      if (params.ttl !== undefined) {
        validateNumber(params.ttl, "ttl", {
          min: 1,
          max: 31536000
        });
      }
      var response = yield _this.httpClient.post("".concat(SynapseAdminApi.PRIVATE_CHAT, "/create"), {
        target_user_id: params.target_user_id,
        is_encrypted: (_params$is_encrypted = params.is_encrypted) !== null && _params$is_encrypted !== void 0 ? _params$is_encrypted : true,
        ttl: (_params$ttl = params.ttl) !== null && _params$ttl !== void 0 ? _params$ttl : 86400
      });
      var data = handleApiResponse(response, "Failed to create private chat");
      return {
        room_id: data.room_id,
        is_encrypted: data.is_encrypted,
        ttl: data.ttl
      };
    })();
  }
  listPrivateChats(params) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      if ((params === null || params === void 0 ? void 0 : params.page) !== undefined) {
        validateNumber(params.page, "page", {
          min: 1
        });
      }
      if ((params === null || params === void 0 ? void 0 : params.page_size) !== undefined) {
        validateNumber(params.page_size, "page_size", {
          min: 1,
          max: 100
        });
      }
      var queryParams = {};
      if ((params === null || params === void 0 ? void 0 : params.page) !== undefined) queryParams.page = params.page;
      if ((params === null || params === void 0 ? void 0 : params.page_size) !== undefined) queryParams.page_size = params.page_size;
      var response = yield _this2.httpClient.get("".concat(SynapseAdminApi.PRIVATE_CHAT, "/list"), queryParams);
      var data = handleApiResponse(response, "Failed to list private chats");
      return {
        rooms: data.rooms || [],
        total: data.total || 0,
        page: data.page || 1,
        page_size: data.page_size || 20
      };
    })();
  }
  getPrivateChatDetail(roomId) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      try {
        var response = yield _this3.httpClient.get("".concat(SynapseAdminApi.PRIVATE_CHAT, "/").concat(encodeURIComponent(roomId)));
        return handleApiResponse(response, "Failed to get private chat detail");
      } catch (error) {
        if (error instanceof Error && (error.message.includes("not found") || error.message.includes("not exist"))) {
          return null;
        }
        throw error;
      }
    })();
  }
  deletePrivateChat(roomId) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this4.httpClient.post("".concat(SynapseAdminApi.PRIVATE_CHAT, "/").concat(encodeURIComponent(roomId), "/delete"), {});
      var data = handleApiResponse(response, "Failed to delete private chat");
      return {
        room_id: data.room_id,
        status: data.status
      };
    })();
  }
}
//# sourceMappingURL=private-chat-admin.js.map