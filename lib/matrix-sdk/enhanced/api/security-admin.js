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

import { ErrorCode } from "../utils/error-codes.js";
import { mapParams } from "../utils/api-mapping.js";
import { SynapseAdminApi } from "../constants/api.js";
import { handleApiResponse } from "../utils/response-formatter.js";
import { BaseApi } from "../utils/base-api.js";
export class SecurityAdminApi extends BaseApi {
  constructor(httpClient) {
    super(httpClient);
  }

  /**
   * Get security events with optional filtering
   */
  getEvents(params) {
    var _this = this;
    return _asyncToGenerator(function* () {
      var queryParams = {};
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
      if ((params === null || params === void 0 ? void 0 : params.resolved) !== undefined) {
        queryParams.resolved = params.resolved;
      }
      var response = yield _this.httpClient.get(SynapseAdminApi.SECURITY_ADMIN_EVENTS, queryParams);
      var data = handleApiResponse(response, "Failed to get security events");
      return data.events || [];
    })();
  }

  /**
   * Get a specific security event by ID
   */
  getEvent(eventId) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      if (!eventId || typeof eventId !== "string" || eventId.trim().length === 0) {
        throw _this2.createError("eventId is required and must be a non-empty string", ErrorCode.INVALID_PARAM);
      }
      try {
        var response = yield _this2.httpClient.get("".concat(SynapseAdminApi.SECURITY_ADMIN_EVENTS, "/").concat(encodeURIComponent(eventId)));
        var data = handleApiResponse(response, "Failed to get security event");
        return data.event || null;
      } catch (error) {
        if (error instanceof Error && (error.message.includes("404") || error.message.includes("failed"))) {
          return null;
        }
        throw error;
      }
    })();
  }

  /**
   * Resolve a security event
   */
  resolveEvent(eventId, resolution) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var mappedParams = mapParams({
        eventId,
        resolution
      }, "securityAdmin");
      var response = yield _this3.httpClient.post("".concat(SynapseAdminApi.SECURITY_ADMIN_EVENTS, "/").concat(encodeURIComponent(eventId), "/resolve"), mappedParams);
      handleApiResponse(response, "Failed to resolve security event");
      return true;
    })();
  }

  /**
   * Get security statistics
   */
  getStats() {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this4.httpClient.get("".concat(SynapseAdminApi.SECURITY_ADMIN, "/stats"));
      var data = handleApiResponse(response, "Failed to get security stats");
      return data.stats;
    })();
  }

  /**
   * Get events for a specific user
   */
  getEventsByUser(userId) {
    var _arguments = arguments,
      _this5 = this;
    return _asyncToGenerator(function* () {
      var limit = _arguments.length > 1 && _arguments[1] !== undefined ? _arguments[1] : 50;
      return _this5.getEvents({
        user_id: userId,
        limit: limit
      });
    })();
  }

  /**
   * Get events for a specific room
   */
  getEventsByRoom(roomId) {
    var _arguments2 = arguments,
      _this6 = this;
    return _asyncToGenerator(function* () {
      var limit = _arguments2.length > 1 && _arguments2[1] !== undefined ? _arguments2[1] : 50;
      var response = yield _this6.httpClient.get(SynapseAdminApi.SECURITY_ADMIN_EVENTS, {
        room_id: roomId,
        limit: limit
      });
      var data = handleApiResponse(response, "Failed to get room security events");
      return data.events || [];
    })();
  }

  /**
   * Get all unresolved events
   */
  getUnresolvedEvents() {
    var _arguments3 = arguments,
      _this7 = this;
    return _asyncToGenerator(function* () {
      var limit = _arguments3.length > 0 && _arguments3[0] !== undefined ? _arguments3[0] : 50;
      return _this7.getEvents({
        resolved: false,
        limit: limit
      });
    })();
  }

  /**
   * Get events by severity level
   */
  getEventsBySeverity(severity) {
    var _arguments4 = arguments,
      _this8 = this;
    return _asyncToGenerator(function* () {
      var limit = _arguments4.length > 1 && _arguments4[1] !== undefined ? _arguments4[1] : 50;
      return _this8.getEvents({
        severity: severity,
        limit: limit
      });
    })();
  }

  /**
   * Get critical events that need immediate attention
   */
  getCriticalEvents() {
    var _arguments5 = arguments,
      _this9 = this;
    return _asyncToGenerator(function* () {
      var limit = _arguments5.length > 0 && _arguments5[0] !== undefined ? _arguments5[0] : 20;
      return _this9.getEventsBySeverity("critical", limit);
    })();
  }

  /**
   * Get event count by type
   */
  getEventCountByType() {
    var _this0 = this;
    return _asyncToGenerator(function* () {
      var stats = yield _this0.getStats();
      return stats.events_by_type;
    })();
  }

  /**
   * Check if there are any unresolved critical events
   */
  hasCriticalEvents() {
    var _this1 = this;
    return _asyncToGenerator(function* () {
      var criticalEvents = yield _this1.getCriticalEvents(1);
      return criticalEvents.length > 0;
    })();
  }
}
//# sourceMappingURL=security-admin.js.map