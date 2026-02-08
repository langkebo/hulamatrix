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

/**
 * Federation API for Matrix server-server communication.
 *
 * This module provides methods for interacting with Matrix federation endpoints.
 * @see https://spec.matrix.org/v1.11/server-server-api/
 */

/**
 * Configuration for FederationApi.
 */

/**
 * Federation API class for handling federation operations.
 */
export class FederationApi {
  /**
   * Creates a new FederationApi instance.
   *
   * @param config - The configuration for the API.
   */
  constructor(config) {
    _defineProperty(this, "baseUrl", void 0);
    _defineProperty(this, "accessToken", void 0);
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.accessToken = config.accessToken;
  }

  /**
   * Build the full URL for a federation endpoint.
   */
  buildUrl(path) {
    return "".concat(this.baseUrl).concat(path);
  }

  /**
   * Get request headers including authorization if available.
   */
  getHeaders() {
    var headers = {
      "Content-Type": "application/json"
    };
    if (this.accessToken) {
      headers["Authorization"] = "Bearer ".concat(this.accessToken);
    }
    return headers;
  }

  /**
   * Perform a GET request to a federation endpoint.
   */
  get(path) {
    var _this = this;
    return _asyncToGenerator(function* () {
      var url = _this.buildUrl(path);
      var response = yield fetch(url, {
        method: "GET",
        headers: _this.getHeaders()
      });
      if (!response.ok) {
        throw new Error("Federation GET request failed: ".concat(response.status, " ").concat(response.statusText));
      }
      return response.json();
    })();
  }

  /**
   * Perform a POST request to a federation endpoint.
   */
  post(path, body) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var url = _this2.buildUrl(path);
      var response = yield fetch(url, {
        method: "POST",
        headers: _this2.getHeaders(),
        body: body ? JSON.stringify(body) : undefined
      });
      if (!response.ok) {
        throw new Error("Federation POST request failed: ".concat(response.status, " ").concat(response.statusText));
      }
      return response.json();
    })();
  }

  /**
   * Perform a PUT request to a federation endpoint.
   */
  put(path, body) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var url = _this3.buildUrl(path);
      var response = yield fetch(url, {
        method: "PUT",
        headers: _this3.getHeaders(),
        body: body ? JSON.stringify(body) : undefined
      });
      if (!response.ok) {
        throw new Error("Federation PUT request failed: ".concat(response.status, " ").concat(response.statusText));
      }
      return response.json();
    })();
  }

  // =========================================================================
  // Key and Discovery Endpoints (Section 5.1)
  // =========================================================================

  /**
   * Get the server's public keys.
   *
   * @returns The server key response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv2server
   */
  getServerKey() {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      return _this4.get("/_matrix/federation/v2/server");
    })();
  }

  /**
   * Query for keys from another server.
   *
   * @param serverName - The server name to query.
   * @param keyId - The key ID to query.
   * @returns The server key response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv2queryserver_namekey_id
   */
  queryKey(serverName, keyId) {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      var path = "/_matrix/federation/v2/query/".concat(encodeURIComponent(serverName), "/").concat(encodeURIComponent(keyId));
      return _this5.get(path);
    })();
  }

  /**
   * Get the federation version of the server.
   *
   * @returns The federation version response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1version
   */
  getVersion() {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      return _this6.get("/_matrix/federation/v1/version");
    })();
  }

  // =========================================================================
  // Room Operation Endpoints (Section 5.2)
  // =========================================================================

  /**
   * Get public rooms from the server.
   *
   * @param limit - Optional limit on the number of rooms to return.
   * @param since - Optional pagination token.
   * @returns The public rooms response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1publicrooms
   */
  getPublicRooms(limit, since) {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      var params = new URLSearchParams();
      if (limit !== undefined) {
        params.set("limit", limit.toString());
      }
      if (since !== undefined) {
        params.set("since", since);
      }
      var queryString = params.toString();
      var path = "/_matrix/federation/v1/publicRooms".concat(queryString ? "?".concat(queryString) : "");
      return _this7.get(path);
    })();
  }

  /**
   * Send a transaction to another server.
   *
   * @param txnId - The transaction ID.
   * @param pdus - The events to send.
   * @returns The transaction response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#put_matrixfederationv1sendtxn_id
   */
  sendTransaction(txnId, pdus) {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      var path = "/_matrix/federation/v1/send/".concat(encodeURIComponent(txnId));
      return _this8.put(path, {
        pdus
      });
    })();
  }

  /**
   * Create a template for joining a room.
   *
   * @param roomId - The room ID to join.
   * @param userId - The user ID joining the room.
   * @returns The make join response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1make_joinroom_iduser_id
   */
  makeJoin(roomId, userId) {
    var _this9 = this;
    return _asyncToGenerator(function* () {
      var path = "/_matrix/federation/v1/make_join/".concat(encodeURIComponent(roomId), "/").concat(encodeURIComponent(userId));
      return _this9.get(path);
    })();
  }

  /**
   * Create a template for leaving a room.
   *
   * @param roomId - The room ID to leave.
   * @param userId - The user ID leaving the room.
   * @returns The make leave response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1make_leaveroom_iduser_id
   */
  makeLeave(roomId, userId) {
    var _this0 = this;
    return _asyncToGenerator(function* () {
      var path = "/_matrix/federation/v1/make_leave/".concat(encodeURIComponent(roomId), "/").concat(encodeURIComponent(userId));
      return _this0.get(path);
    })();
  }

  /**
   * Send a join event to a room.
   *
   * @param roomId - The room ID.
   * @param eventId - The event ID.
   * @param event - The join event.
   * @returns The send join response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#put_matrixfederationv1send_joinroom_idevent_id
   */
  sendJoin(roomId, eventId, event) {
    var _this1 = this;
    return _asyncToGenerator(function* () {
      var path = "/_matrix/federation/v1/send_join/".concat(encodeURIComponent(roomId), "/").concat(encodeURIComponent(eventId));
      return _this1.put(path, event);
    })();
  }

  /**
   * Send a leave event to a room.
   *
   * @param roomId - The room ID.
   * @param eventId - The event ID.
   * @param event - The leave event.
   * @returns The send leave response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#put_matrixfederationv1send_leaveroom_idevent_id
   */
  sendLeave(roomId, eventId, event) {
    var _this10 = this;
    return _asyncToGenerator(function* () {
      var path = "/_matrix/federation/v1/send_leave/".concat(encodeURIComponent(roomId), "/").concat(encodeURIComponent(eventId));
      return _this10.put(path, event);
    })();
  }

  /**
   * Invite a user to a room.
   *
   * @param roomId - The room ID.
   * @param eventId - The event ID.
   * @param event - The invite event.
   * @returns The transaction response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#put_matrixfederationv1inviteroom_idevent_id
   */
  invite(roomId, eventId, event) {
    var _this11 = this;
    return _asyncToGenerator(function* () {
      var path = "/_matrix/federation/v1/invite/".concat(encodeURIComponent(roomId), "/").concat(encodeURIComponent(eventId));
      return _this11.put(path, event);
    })();
  }

  /**
   * Get missing events for a room.
   *
   * @param request - The missing events request.
   * @returns The missing events response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#post_matrixfederationv1get_missing_eventsroom_id
   */
  getMissingEvents(request) {
    var _this12 = this;
    return _asyncToGenerator(function* () {
      var path = "/_matrix/federation/v1/get_missing_events/".concat(encodeURIComponent(request.room_id));
      return _this12.post(path, request);
    })();
  }

  /**
   * Get event authorization for an event.
   *
   * @param roomId - The room ID.
   * @param eventId - The event ID.
   * @returns The event auth response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1get_event_authroom_idevent_id
   */
  getEventAuth(roomId, eventId) {
    var _this13 = this;
    return _asyncToGenerator(function* () {
      var path = "/_matrix/federation/v1/get_event_auth/".concat(encodeURIComponent(roomId), "/").concat(encodeURIComponent(eventId));
      return _this13.get(path);
    })();
  }

  /**
   * Get the current state of a room.
   *
   * @param roomId - The room ID.
   * @returns The room state response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1stateroom_id
   */
  getState(roomId) {
    var _this14 = this;
    return _asyncToGenerator(function* () {
      var path = "/_matrix/federation/v1/state/".concat(encodeURIComponent(roomId));
      return _this14.get(path);
    })();
  }

  /**
   * Get a single event.
   *
   * @param eventId - The event ID.
   * @returns The event response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1eventevent_id
   */
  getEvent(eventId) {
    var _this15 = this;
    return _asyncToGenerator(function* () {
      var path = "/_matrix/federation/v1/event/".concat(encodeURIComponent(eventId));
      return _this15.get(path);
    })();
  }

  /**
   * Get the state IDs for a room.
   *
   * @param roomId - The room ID.
   * @returns The room state IDs response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1state_idsroom_id
   */
  getStateIds(roomId) {
    var _this16 = this;
    return _asyncToGenerator(function* () {
      var path = "/_matrix/federation/v1/state_ids/".concat(encodeURIComponent(roomId));
      return _this16.get(path);
    })();
  }

  /**
   * Query the directory for a room.
   *
   * @param roomId - The room ID.
   * @returns The directory lookup response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1querydirectoryroomroom_id
   */
  queryDirectoryRoom(roomId) {
    var _this17 = this;
    return _asyncToGenerator(function* () {
      var path = "/_matrix/federation/v1/query/directory/room/".concat(encodeURIComponent(roomId));
      return _this17.get(path);
    })();
  }

  /**
   * Query the profile of a user.
   *
   * @param userId - The user ID.
   * @returns The profile lookup response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1queryprofileuser_id
   */
  queryProfile(userId) {
    var _this18 = this;
    return _asyncToGenerator(function* () {
      var path = "/_matrix/federation/v1/query/profile/".concat(encodeURIComponent(userId));
      return _this18.get(path);
    })();
  }

  /**
   * Backfill events for a room.
   *
   * @param request - The backfill request.
   * @returns The events.
   * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1backfillroom_id
   */
  backfill(request) {
    var _this19 = this;
    return _asyncToGenerator(function* () {
      var params = new URLSearchParams();
      params.set("v", request.v.join(","));
      params.set("limit", request.limit.toString());
      var path = "/_matrix/federation/v1/backfill/".concat(encodeURIComponent(request.room_id), "?").concat(params.toString());
      var response = yield _this19.get(path);
      return response.events || response.pdus || [];
    })();
  }

  /**
   * Claim one-time keys for devices.
   *
   * @param request - The key claim request.
   * @returns The key claim response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#post_matrixfederationv1keysclaim
   */
  claimKeys(request) {
    var _this20 = this;
    return _asyncToGenerator(function* () {
      return _this20.post("/_matrix/federation/v1/keys/claim", request);
    })();
  }

  /**
   * Upload device keys.
   *
   * @param deviceKeys - The device keys to upload.
   * @returns The key upload response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#post_matrixfederationv1keysupload
   */
  uploadKeys(deviceKeys) {
    var _this21 = this;
    return _asyncToGenerator(function* () {
      return _this21.post("/_matrix/federation/v1/keys/upload", deviceKeys);
    })();
  }

  /**
   * Query user keys.
   *
   * @param request - The user keys query request.
   * @returns The user keys query response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#post_matrixfederationv2userkeysquery
   */
  queryUserKeys(request) {
    var _this22 = this;
    return _asyncToGenerator(function* () {
      return _this22.post("/_matrix/federation/v2/user/keys/query", request);
    })();
  }

  // =========================================================================
  // Additional Federation Endpoints (Section 5.3)
  // =========================================================================

  /**
   * Exchange federation keys.
   *
   * @param request - The key exchange request.
   * @returns The key query response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#post_matrixfederationv1keysquery
   */
  queryKeys(request) {
    var _this23 = this;
    return _asyncToGenerator(function* () {
      return _this23.post("/_matrix/federation/v1/keys/query", request);
    })();
  }

  /**
   * Get all members of a room.
   *
   * @param roomId - The room ID.
   * @returns The federation members response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1membersroom_id
   */
  getMembers(roomId) {
    var _this24 = this;
    return _asyncToGenerator(function* () {
      var path = "/_matrix/federation/v1/members/".concat(encodeURIComponent(roomId));
      return _this24.get(path);
    })();
  }

  /**
   * Get joined members of a room.
   *
   * @param roomId - The room ID.
   * @returns The room members response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1membersroom_idjoined
   */
  getJoinedMembers(roomId) {
    var _this25 = this;
    return _asyncToGenerator(function* () {
      var path = "/_matrix/federation/v1/members/".concat(encodeURIComponent(roomId), "/joined");
      return _this25.get(path);
    })();
  }

  /**
   * Get devices for a user.
   *
   * @param userId - The user ID.
   * @returns The user devices response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1userdevicesuser_id
   */
  getUserDevices(userId) {
    var _this26 = this;
    return _asyncToGenerator(function* () {
      var path = "/_matrix/federation/v1/user/devices/".concat(encodeURIComponent(userId));
      return _this26.get(path);
    })();
  }

  /**
   * Get room auth chain.
   *
   * @param roomId - The room ID.
   * @returns The room auth response.
   * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1room_authroom_id
   */
  getRoomAuth(roomId) {
    var _this27 = this;
    return _asyncToGenerator(function* () {
      var path = "/_matrix/federation/v1/room_auth/".concat(encodeURIComponent(roomId));
      return _this27.get(path);
    })();
  }
}
//# sourceMappingURL=index.js.map