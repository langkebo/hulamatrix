import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
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

import { ErrorCode } from "../utils/error-codes.js";
import { SynapseAdminApi } from "../constants/api.js";
import { handleApiResponse } from "../utils/response-formatter.js";
import { BaseApi } from "../utils/base-api.js";
export class VoiceUserApi extends BaseApi {
  constructor(httpClient) {
    super(httpClient);
    _defineProperty(this, "endpoint", "".concat(SynapseAdminApi.VOICE, "/user"));
  }

  /**
   * Get complete user voice configuration
   */
  getConfig() {
    var _this = this;
    return _asyncToGenerator(function* () {
      var response = yield _this.httpClient.get(_this.endpoint);
      var data = handleApiResponse(response, "Failed to get user voice config");
      return data.user_config;
    })();
  }

  /**
   * Get user voice preferences
   */
  getPreferences() {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var config = yield _this2.getConfig();
      return config.preferences;
    })();
  }

  /**
   * Update user voice preferences
   */
  updatePreferences(preferences) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      if (!preferences || typeof preferences !== "object") {
        throw _this3.createError("Preferences must be a valid object", ErrorCode.INVALID_PARAM);
      }
      var response = yield _this3.httpClient.post(_this3.endpoint, {
        preferences
      });
      var data = handleApiResponse(response, "Failed to update voice preferences");
      return data.preferences;
    })();
  }

  /**
   * Get user voice quota information
   */
  getQuota() {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this4.httpClient.get("".concat(_this4.endpoint, "/quota"));
      var data = handleApiResponse(response, "Failed to get voice quota");
      return data.quota;
    })();
  }

  /**
   * Get user voice usage statistics
   */
  getStats() {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this5.httpClient.get("".concat(_this5.endpoint, "/stats"));
      var data = handleApiResponse(response, "Failed to get voice stats");
      return data.stats;
    })();
  }

  /**
   * Check if user has exceeded their voice quota
   */
  hasQuotaExceeded() {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      var quota = yield _this6.getQuota();
      return quota.is_exhausted;
    })();
  }

  /**
   * Get remaining quota in seconds
   */
  getRemainingQuota() {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      var quota = yield _this7.getQuota();
      return Math.max(0, quota.limit_seconds - quota.used_seconds);
    })();
  }

  /**
   * Get quota usage percentage
   */
  getQuotaPercentage() {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      var quota = yield _this8.getQuota();
      return quota.percentage_used;
    })();
  }

  /**
   * Check if a specific preference is enabled
   */
  isPreferenceEnabled(preference) {
    var _this9 = this;
    return _asyncToGenerator(function* () {
      var preferences = yield _this9.getPreferences();
      return Boolean(preferences[preference]);
    })();
  }

  /**
   * Get formatted quota information
   */
  getFormattedQuota() {
    var _this0 = this;
    return _asyncToGenerator(function* () {
      var quota = yield _this0.getQuota();
      var formatDuration = seconds => {
        var hours = Math.floor(seconds / 3600);
        var minutes = Math.floor(seconds % 3600 / 60);
        if (hours > 0) {
          return "".concat(hours, "h ").concat(minutes, "m");
        }
        return "".concat(minutes, "m");
      };
      return {
        used: formatDuration(quota.used_seconds),
        limit: formatDuration(quota.limit_seconds),
        remaining: formatDuration(Math.max(0, quota.limit_seconds - quota.used_seconds)),
        percentage: "".concat(quota.percentage_used.toFixed(1), "%")
      };
    })();
  }
}
//# sourceMappingURL=voice-user.js.map