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

import { MatrixClientApi } from "../constants/api.js";
import { handleApiResponse } from "../utils/response-formatter.js";
import { BaseApi } from "../utils/base-api.js";
export class PresenceApi extends BaseApi {
  constructor(httpClient) {
    super(httpClient);
  }
  getStatus(userId) {
    var _this = this;
    return _asyncToGenerator(function* () {
      var response = yield _this.httpClient.get("".concat(MatrixClientApi.PRESENCE, "/status"), {
        user_id: userId
      });
      var data = handleApiResponse(response, "Failed to get presence status");
      return data.presence || {
        user_id: userId,
        presence: "offline",
        last_active_ago: 0
      };
    })();
  }
  setStatus(params) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this2.httpClient.post("".concat(MatrixClientApi.PRESENCE, "/status"), params);
      handleApiResponse(response, "Failed to set presence status");
      return {
        status: "ok"
      };
    })();
  }
  getPresence(userId) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      return _this3.getStatus(userId);
    })();
  }
  updatePresence(userId, presence, statusMsg) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      yield _this4.setStatus({
        user_id: userId,
        status: presence,
        status_msg: statusMsg
      });
    })();
  }
}
//# sourceMappingURL=presence.js.map