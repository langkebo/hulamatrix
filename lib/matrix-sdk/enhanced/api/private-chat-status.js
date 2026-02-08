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

import { SynapseEnhancedError } from "../utils/http.js";
import { ErrorCode } from "../utils/error-codes.js";
export class PrivateChatStatusApi {
  constructor(httpClient) {
    _defineProperty(this, "httpClient", void 0);
    _defineProperty(this, "baseUrl", "/private/status");
    this.httpClient = httpClient;
  }

  /**
   * Get private chat features status
   */
  getStatus() {
    var _this = this;
    return _asyncToGenerator(function* () {
      var response = yield _this.httpClient.get(_this.baseUrl);
      if (response.data.status !== "ok") {
        throw new SynapseEnhancedError(response.data.error || "Failed to get private chat status", ErrorCode.UNKNOWN);
      }
      if (!response.data.features) {
        throw new SynapseEnhancedError("No features data returned", ErrorCode.UNKNOWN);
      }
      return response.data.features;
    })();
  }

  /**
   * Get private chat capabilities
   */
  getCapabilities() {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this2.httpClient.get("".concat(_this2.baseUrl, "/capabilities"));
      if (response.data.status !== "ok") {
        throw new SynapseEnhancedError(response.data.error || "Failed to get private chat capabilities", ErrorCode.UNKNOWN);
      }
      if (!response.data.capabilities) {
        throw new SynapseEnhancedError("No capabilities data returned", ErrorCode.UNKNOWN);
      }
      return response.data.capabilities;
    })();
  }

  /**
   * Check if private chat feature is available
   */
  checkAvailability() {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      try {
        var status = yield _this3.getStatus();
        return status.sessions.available && status.messages.available && status.encryption.available;
      } catch (_unused) {
        return false;
      }
    })();
  }

  /**
   * Check if encryption is required for private chats
   */
  isEncryptionRequired() {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var capabilities = yield _this4.getCapabilities();
      return capabilities.encryption_required;
    })();
  }

  /**
   * Get maximum message length allowed
   */
  getMaxMessageLength() {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      var capabilities = yield _this5.getCapabilities();
      return capabilities.max_message_length;
    })();
  }

  /**
   * Get supported message types
   */
  getSupportedMessageTypes() {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      var capabilities = yield _this6.getCapabilities();
      return capabilities.supported_message_types;
    })();
  }

  /**
   * Check if a specific feature is enabled
   */
  isFeatureEnabled(feature) {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      var capabilities = yield _this7.getCapabilities();
      var featureMap = {
        encryption: ["encryption"],
        retention: ["retention"],
        ttl: ["ttl"]
      };
      var enabledFeatures = capabilities.features || [];
      var requiredFeatures = featureMap[feature] || [];
      return requiredFeatures.some(f => enabledFeatures.includes(f));
    })();
  }

  /**
   * Get configuration summary
   */
  getConfigSummary() {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      var [capabilities] = yield Promise.all([_this8.getCapabilities()]);
      return {
        encryption: capabilities.encryption_required,
        retention_days: capabilities.default_retention_days,
        max_participants: capabilities.max_participants_per_session,
        max_sessions: capabilities.max_sessions_per_user
      };
    })();
  }
}
//# sourceMappingURL=private-chat-status.js.map