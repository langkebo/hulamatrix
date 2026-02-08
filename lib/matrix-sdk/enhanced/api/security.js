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

import { handleApiResponse } from "../utils/response-formatter.js";
import { ErrorCode } from "../utils/error-codes.js";
import { EnhancedApi } from "../constants/api.js";
import { assertValidIpAddress } from "../utils/validator.js";
import { BaseApi } from "../utils/base-api.js";

/**
 * Security API - Security-related API endpoints
 * Provides threat detection, IP blocking, security policy management and other functions
 */
export class SecurityApi extends BaseApi {
  /**
   * Create a SecurityApi instance
   * @param httpClient - HTTP client instance
   */
  constructor(httpClient) {
    super(httpClient);
    _defineProperty(this, "endpoint", EnhancedApi.SECURITY);
  }

  /**
   * Get all security policies
   * @returns Security policy list
   */
  getPolicies() {
    var _this = this;
    return _asyncToGenerator(function* () {
      var response = yield _this.httpClient.get("".concat(_this.endpoint, "/policies"), {});
      var data = handleApiResponse(response, "Failed to get security policies");
      return data.policies || [];
    })();
  }

  /**
   * Detect threats in content
   * @param content - Content to be checked
   * @param context - Optional context information
   * @returns Threat detection results
   */
  detectThreats(content, context) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var body = {
        action: "detect",
        content
      };
      if (context) {
        body.context = context;
      }
      var response = yield _this2.httpClient.post(_this2.endpoint, body);
      return handleApiResponse(response, "Failed to detect threats") || {
        threats: [],
        scan_id: "",
        scanned_at: "",
        status: "clean",
        safe: true
      };
    })();
  }

  /**
   * Block IP address
   * @param params - Blocking parameters
   * @param params.ip_address - IP address to block
   * @param params.reason - Blocking reason, optional
   * @param params.duration_hours - Blocking duration in hours, optional
   * @param params.permanent - Whether to block permanently, optional
   * @returns Whether the operation was successful
   */
  blockIp(params) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      // Validate IP address format before sending request
      assertValidIpAddress(params.ip_address);
      var body = {
        ip: params.ip_address
      };
      if (params.reason) {
        body.reason = params.reason;
      }
      if (params.duration_hours !== undefined) {
        body.duration_hours = params.duration_hours;
      }
      if (params.permanent !== undefined) {
        body.permanent = params.permanent;
      }
      var response = yield _this3.httpClient.post("".concat(_this3.endpoint, "/block-ip"), body);
      handleApiResponse(response, "Failed to block IP");
      return true;
    })();
  }

  /**
   * Unblock IP address
   * @param ipAddress - IP address to unblock
   * @returns Whether the operation was successful
   */
  unblockIp(ipAddress) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      // Validate IP address format before sending request
      assertValidIpAddress(ipAddress);
      var response = yield _this4.httpClient.post(_this4.endpoint, {
        action: "unblock",
        ip_address: ipAddress
      });
      handleApiResponse(response, "Failed to unblock IP");
      return true;
    })();
  }

  /**
   * Get IP address status
   * @param ipAddress - IP address to query
   * @returns IP status information (whether blocked, reputation score, etc.)
   */
  getIpStatus(ipAddress) {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      // Validate IP address format before sending request
      assertValidIpAddress(ipAddress);
      var response = yield _this5.httpClient.get(_this5.endpoint, {
        action: "ip_status",
        ip_address: ipAddress
      });
      var data = handleApiResponse(response, "Failed to get IP status");
      return {
        ip: ipAddress,
        blocked: data.blocked || false,
        reputation_score: data.reputation_score || 0,
        last_checked: data.last_checked || new Date().toISOString(),
        threat_score: data.threat_score
      };
    })();
  }

  /**
   * Get blocked IP list
   * @returns Blocked IP list
   */
  getBlockedIps() {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this6.httpClient.get(_this6.endpoint, {
        action: "blocked_ips"
      });
      var data = handleApiResponse(response, "Failed to get blocked IPs");
      return data.blocked_ips || [];
    })();
  }

  /**
   * Get high risk IP list
   * @param threshold - Risk score threshold, optional, defaults to all high risk IPs
   * @returns High risk IP list
   */
  getHighRiskIps(threshold) {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      var params = {
        action: "high_risk_ips"
      };
      if (threshold !== undefined) {
        params.threshold = threshold;
      }
      var response = yield _this7.httpClient.get(_this7.endpoint, params);
      var data = handleApiResponse(response, "Failed to get high risk IPs");
      return data.high_risk_ips || [];
    })();
  }

  /**
   * Get reputation statistics
   * @returns Reputation statistics information
   */
  getReputationStats() {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this8.httpClient.get(_this8.endpoint, {
        action: "reputation_stats"
      });
      return handleApiResponse(response, "Failed to get reputation stats") || {
        total_blocked: 0,
        active_blocked: 0,
        high_risk_count: 0,
        average_threat_score: 0
      };
    })();
  }

  /**
   * Get security event list
   * @param params - Optional query parameters (user ID, event type, severity, limit, etc.)
   * @returns Security event list
   */
  getSecurityEvents(params) {
    var _this9 = this;
    return _asyncToGenerator(function* () {
      var queryParams = {
        action: "events"
      };
      if (params !== null && params !== void 0 && params.user_id) {
        queryParams.user_id = params.user_id;
      }
      if (params !== null && params !== void 0 && params.event_type) {
        queryParams.event_type = params.event_type;
      }
      if (params !== null && params !== void 0 && params.severity) {
        queryParams.severity = params.severity;
      }
      if ((params === null || params === void 0 ? void 0 : params.limit) !== undefined) {
        queryParams.limit = params.limit;
      }
      if ((params === null || params === void 0 ? void 0 : params.offset) !== undefined) {
        queryParams.offset = params.offset;
      }
      var response = yield _this9.httpClient.get(_this9.endpoint, queryParams);
      var data = handleApiResponse(response, "Failed to get security events");
      return data.events || [];
    })();
  }

  /**
   * Resolve (close) security event
   * @param eventId - Event ID
   * @returns Whether the operation was successful
   */
  resolveEvent(eventId) {
    var _this0 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this0.httpClient.post(_this0.endpoint, {
        action: "resolve_event",
        event_id: eventId
      });
      handleApiResponse(response, "Failed to resolve event");
      return true;
    })();
  }

  // =========================================================================
  // Security Policies CRUD Operations
  // =========================================================================

  /**
   * Create new security policy
   * @param params - Policy parameters
   * @param params.name - Policy name
   * @param params.description - Policy description, optional
   * @param params.rules - Policy rule list
   * @param params.enabled - Whether to enable, optional
   * @returns Created policy
   */
  createPolicy(params) {
    var _this1 = this;
    return _asyncToGenerator(function* () {
      if (!params.name || typeof params.name !== "string" || params.name.trim().length === 0) {
        throw _this1.createError("Policy name is required and must be a non-empty string", ErrorCode.INVALID_PARAM);
      }
      if (!params.rules || !Array.isArray(params.rules) || params.rules.length === 0) {
        throw _this1.createError("Policy rules are required and must be a non-empty array", ErrorCode.INVALID_PARAM);
      }
      var response = yield _this1.httpClient.post("".concat(_this1.endpoint, "/policies/create"), params);
      return handleApiResponse(response, "Failed to create security policy");
    })();
  }

  /**
   * Update security policy
   * @param policyId - Policy ID
   * @param updates - Update content
   * @returns Updated policy
   */
  updatePolicy(policyId, updates) {
    var _this10 = this;
    return _asyncToGenerator(function* () {
      if (!policyId || typeof policyId !== "string" || policyId.trim().length === 0) {
        throw _this10.createError("Policy ID is required and must be a non-empty string", ErrorCode.INVALID_PARAM);
      }
      var response = yield _this10.httpClient.put("".concat(_this10.endpoint, "/policies/").concat(policyId), updates);
      return handleApiResponse(response, "Failed to update security policy");
    })();
  }

  /**
   * Delete security policy
   * @param policyId - Policy ID
   * @returns Whether the operation was successful
   */
  deletePolicy(policyId) {
    var _this11 = this;
    return _asyncToGenerator(function* () {
      if (!policyId || typeof policyId !== "string" || policyId.trim().length === 0) {
        throw _this11.createError("Policy ID is required and must be a non-empty string", ErrorCode.INVALID_PARAM);
      }
      var response = yield _this11.httpClient.request("".concat(_this11.endpoint, "/policies/").concat(policyId), {
        method: "DELETE"
      });
      handleApiResponse(response, "Failed to delete security policy");
      return true;
    })();
  }

  /**
   * Set policy enabled status
   * @param policyId - Policy ID
   * @param enabled - Whether to enable
   * @returns Updated policy
   */
  setPolicyEnabled(policyId, enabled) {
    var _this12 = this;
    return _asyncToGenerator(function* () {
      return _this12.updatePolicy(policyId, {
        enabled
      });
    })();
  }

  /**
   * Add rule to policy
   * @param policyId - Policy ID
   * @param rule - Rule to add
   * @returns Updated policy
   */
  addPolicyRule(policyId, rule) {
    var _this13 = this;
    return _asyncToGenerator(function* () {
      if (!policyId || typeof policyId !== "string" || policyId.trim().length === 0) {
        throw _this13.createError("Policy ID is required and must be a non-empty string", ErrorCode.INVALID_PARAM);
      }
      if (!rule || typeof rule !== "object") {
        throw _this13.createError("Rule must be a valid object", ErrorCode.INVALID_PARAM);
      }
      var response = yield _this13.httpClient.post("".concat(_this13.endpoint, "/policies/").concat(policyId, "/rules"), {
        action: "add",
        rule
      });
      return handleApiResponse(response, "Failed to add policy rule");
    })();
  }

  /**
   * Remove rule from policy
   * @param policyId - Policy ID
   * @param ruleIndex - Rule index
   * @returns Updated policy
   */
  removePolicyRule(policyId, ruleIndex) {
    var _this14 = this;
    return _asyncToGenerator(function* () {
      if (!policyId || typeof policyId !== "string" || policyId.trim().length === 0) {
        throw _this14.createError("Policy ID is required and must be a non-empty string", ErrorCode.INVALID_PARAM);
      }
      if (typeof ruleIndex !== "number" || ruleIndex < 0) {
        throw _this14.createError("Rule index must be a non-negative number", ErrorCode.INVALID_PARAM);
      }
      var response = yield _this14.httpClient.post("".concat(_this14.endpoint, "/policies/").concat(policyId, "/rules"), {
        action: "remove",
        rule_index: ruleIndex
      });
      return handleApiResponse(response, "Failed to remove policy rule");
    })();
  }

  /**
   * Get security configuration
   * @returns Security configuration information
   */
  getConfig() {
    var _this15 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this15.httpClient.get("".concat(_this15.endpoint, "/config"));
      return handleApiResponse(response, "Failed to get security config");
    })();
  }

  /**
   * Update security configuration
   * @param config - Configuration updates
   * @returns Updated security configuration
   */
  updateConfig(config) {
    var _this16 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this16.httpClient.put("".concat(_this16.endpoint, "/config"), config);
      return handleApiResponse(response, "Failed to update security config");
    })();
  }
}
//# sourceMappingURL=security.js.map