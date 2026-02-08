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
export class EnhancedInitApi {
  constructor(httpClient) {
    _defineProperty(this, "httpClient", void 0);
    _defineProperty(this, "baseUrl", "/enhanced");
    this.httpClient = httpClient;
  }

  /**
   * Initialize the enhanced module
   */
  initialize(params) {
    var _this = this;
    return _asyncToGenerator(function* () {
      if (!params.init_key || typeof params.init_key !== "string" || params.init_key.trim().length === 0) {
        throw new SynapseEnhancedError("init_key is required and must be a non-empty string", ErrorCode.INVALID_PARAM);
      }
      if (params.db_config) {
        if (!params.db_config.host || typeof params.db_config.host !== "string") {
          throw new SynapseEnhancedError("db_config.host is required and must be a string", ErrorCode.INVALID_PARAM);
        }
        if (typeof params.db_config.port !== "number" || params.db_config.port < 1 || params.db_config.port > 65535) {
          throw new SynapseEnhancedError("db_config.port must be a number between 1 and 65535", ErrorCode.INVALID_PARAM);
        }
      }
      var response = yield _this.httpClient.post("".concat(_this.baseUrl, "/init"), params);
      if (response.data.status !== "ok") {
        throw new SynapseEnhancedError(response.data.error || "Failed to initialize enhanced module", ErrorCode.UNKNOWN);
      }
      return response.data.result;
    })();
  }

  /**
   * Get module status
   */
  getStatus() {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this2.httpClient.get("".concat(_this2.baseUrl, "/status"));
      if (response.data.status !== "ok") {
        throw new SynapseEnhancedError(response.data.error || "Failed to get module status", ErrorCode.UNKNOWN);
      }
      return response.data.module_status;
    })();
  }

  /**
   * Check module health
   */
  checkHealth() {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      try {
        var status = yield _this3.getStatus();
        return status.initialized && status.database.connected;
      } catch (_unused) {
        return false;
      }
    })();
  }

  /**
   * Get module configuration
   */
  getConfig() {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this4.httpClient.get("".concat(_this4.baseUrl, "/config"));
      if (response.data.status !== "ok") {
        throw new SynapseEnhancedError(response.data.error || "Failed to get module config", ErrorCode.UNKNOWN);
      }
      return response.data.config || {};
    })();
  }

  /**
   * Reinitialize the module (useful after configuration changes)
   */
  reinitialize(params) {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      return _this5.initialize(params);
    })();
  }

  /**
   * Check if module is already initialized
   */
  isInitialized() {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      try {
        var status = yield _this6.getStatus();
        return status.initialized;
      } catch (_unused2) {
        return false;
      }
    })();
  }

  /**
   * Get module version
   */
  getVersion() {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      var status = yield _this7.getStatus();
      return status.version;
    })();
  }

  /**
   * Get enabled features
   */
  getEnabledFeatures() {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      var status = yield _this8.getStatus();
      return status.features;
    })();
  }

  /**
   * Check if a specific feature is enabled
   */
  isFeatureEnabled(feature) {
    var _this9 = this;
    return _asyncToGenerator(function* () {
      if (!feature || typeof feature !== "string" || feature.trim().length === 0) {
        throw new SynapseEnhancedError("feature is required and must be a non-empty string", ErrorCode.INVALID_PARAM);
      }
      var features = yield _this9.getEnabledFeatures();
      return features[feature] || false;
    })();
  }

  /**
   * Get database connection status
   */
  getDatabaseStatus() {
    var _this0 = this;
    return _asyncToGenerator(function* () {
      var status = yield _this0.getStatus();
      return status.database;
    })();
  }

  /**
   * Get module uptime in seconds
   */
  getUptime() {
    var _this1 = this;
    return _asyncToGenerator(function* () {
      var status = yield _this1.getStatus();
      return status.uptime_seconds;
    })();
  }
}
//# sourceMappingURL=enhanced.js.map