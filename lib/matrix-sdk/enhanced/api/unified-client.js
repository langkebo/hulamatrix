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

import { SynapseEnhancedHttpClient, SynapseEnhancedError } from "../utils/http.js";
import { ErrorCode } from "../utils/error-codes.js";
import { SynapseEnhancedClient } from "../index.js";
function toRecord(obj) {
  return obj;
}
/**
 * UnifiedMatrixClient - Unified Matrix client
 * Integrates standard Matrix Client API and Synapse enhanced features
 */
export class UnifiedMatrixClient {
  constructor(config) {
    _defineProperty(this, "httpClient", void 0);
    _defineProperty(this, "enhancedClient", void 0);
    _defineProperty(this, "basePath", void 0);
    /**
     * Authentication related operations
     */
    _defineProperty(this, "auth", void 0);
    /**
     * User account related operations
     */
    _defineProperty(this, "user", void 0);
    /**
     * Room related operations
     */
    _defineProperty(this, "room", void 0);
    /**
     * Message related operations
     */
    _defineProperty(this, "message", void 0);
    /**
     * Enhanced features client
     */
    _defineProperty(this, "enhanced", void 0);
    this.basePath = "/_matrix/client/v3";
    this.httpClient = new SynapseEnhancedHttpClient({
      baseUrl: config.baseUrl,
      accessToken: config.accessToken,
      apiPrefix: this.basePath,
      timeout: config.timeout
    });
    this.enhancedClient = new SynapseEnhancedClient({
      baseUrl: config.baseUrl,
      accessToken: config.accessToken,
      apiPrefix: config.apiPrefix,
      timeout: config.timeout
    });
    this.auth = {
      register: this.register.bind(this),
      login: this.login.bind(this),
      logout: this.logout.bind(this),
      logoutAll: this.logoutAll.bind(this),
      refreshToken: this.refreshToken.bind(this)
    };
    this.user = {
      whoami: this.whoami.bind(this),
      getProfile: this.getProfile.bind(this),
      updateDisplayname: this.updateDisplayname.bind(this),
      updateAvatar: this.updateAvatar.bind(this),
      changePassword: this.changePassword.bind(this),
      deactivateAccount: this.deactivateAccount.bind(this)
    };
    this.room = {
      createRoom: this.createRoom.bind(this),
      joinRoom: this.joinRoom.bind(this),
      leaveRoom: this.leaveRoom.bind(this),
      inviteUser: this.inviteUser.bind(this),
      kickUser: this.kickUser.bind(this),
      banUser: this.banUser.bind(this),
      unbanUser: this.unbanUser.bind(this),
      getRoomInfo: this.getRoomInfo.bind(this),
      deleteRoom: this.deleteRoom.bind(this),
      getPublicRooms: this.getPublicRooms.bind(this),
      getUserRooms: this.getUserRooms.bind(this)
    };
    this.message = {
      sendMessage: this.sendMessage.bind(this),
      getMessages: this.getMessages.bind(this),
      editMessage: this.editMessage.bind(this),
      replyMessage: this.replyMessage.bind(this),
      redactEvent: this.redactEvent.bind(this)
    };
    this.enhanced = this.enhancedClient.getEnhancedClient();
  }
  register(params) {
    var _this = this;
    return _asyncToGenerator(function* () {
      var response = yield _this.httpClient.post("/register", {
        username: params.username,
        password: params.password,
        auth: params.auth,
        device_id: params.device_id,
        initial_device_display_name: params.initial_device_display_name,
        inhibit_login: params.inhibit_login,
        admin: params.admin,
        displayname: params.displayname
      });
      if (!response.data) {
        throw new SynapseEnhancedError("Registration failed", ErrorCode.UNKNOWN, undefined, 500);
      }
      return response.data;
    })();
  }
  login(params) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this2.httpClient.post("/login", {
        type: params.type,
        user: params.user,
        password: params.password,
        device_id: params.device_id,
        initial_device_display_name: params.initial_device_display_name
      });
      if (!response.data) {
        throw new SynapseEnhancedError("Login failed", ErrorCode.UNKNOWN, undefined, 500);
      }
      return response.data;
    })();
  }
  logout() {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      yield _this3.httpClient.post("/logout");
    })();
  }
  logoutAll() {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      yield _this4.httpClient.post("/logout/all");
    })();
  }
  refreshToken(params) {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this5.httpClient.post("/refresh", {
        refresh_token: params.refresh_token
      });
      if (!response.data) {
        throw new SynapseEnhancedError("Token refresh failed", ErrorCode.UNKNOWN, undefined, 500);
      }
      return response.data;
    })();
  }
  whoami() {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this6.httpClient.get("/account/whoami");
      if (!response.data) {
        throw new SynapseEnhancedError("Failed to get user info", ErrorCode.UNKNOWN, undefined, 500);
      }
      return response.data;
    })();
  }
  getProfile(userId) {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this7.httpClient.get("/account/profile/".concat(encodeURIComponent(userId)));
      if (!response.data) {
        throw new SynapseEnhancedError("Failed to get profile", ErrorCode.UNKNOWN, undefined, 500);
      }
      return response.data;
    })();
  }
  updateDisplayname(userId, displayname) {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      yield _this8.httpClient.put("/account/profile/".concat(encodeURIComponent(userId), "/displayname"), {
        displayname
      });
    })();
  }
  updateAvatar(userId, avatarUrl) {
    var _this9 = this;
    return _asyncToGenerator(function* () {
      yield _this9.httpClient.put("/account/profile/".concat(encodeURIComponent(userId), "/avatar_url"), {
        avatar_url: avatarUrl
      });
    })();
  }
  changePassword(newPassword, auth) {
    var _this0 = this;
    return _asyncToGenerator(function* () {
      yield _this0.httpClient.post("/account/password", {
        new_password: newPassword,
        auth
      });
    })();
  }
  deactivateAccount(auth, idServer) {
    var _this1 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this1.httpClient.post("/account/deactivate", {
        auth,
        id_server: idServer
      });
      if (!response.data) {
        throw new SynapseEnhancedError("Account deactivation failed", ErrorCode.UNKNOWN, undefined, 500);
      }
      return response.data;
    })();
  }
  createRoom(params) {
    var _this10 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this10.httpClient.post("/createRoom", {
        preset: params.preset,
        room_alias_name: params.room_alias_name,
        name: params.name,
        topic: params.topic,
        invite: params.invite,
        invite_3pid: params.invite_3pid,
        creation_content: params.creation_content,
        initial_state: params.initial_state,
        room_version: params.room_version
      });
      if (!response.data) {
        throw new SynapseEnhancedError("Failed to create room", ErrorCode.UNKNOWN, undefined, 500);
      }
      return response.data;
    })();
  }
  joinRoom(roomId, params) {
    var _this11 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this11.httpClient.post("/rooms/".concat(encodeURIComponent(roomId), "/join"), params ? toRecord(params) : undefined);
      if (!response.data) {
        throw new SynapseEnhancedError("Failed to join room", ErrorCode.UNKNOWN, undefined, 500);
      }
      return response.data;
    })();
  }
  leaveRoom(roomId, params) {
    var _this12 = this;
    return _asyncToGenerator(function* () {
      yield _this12.httpClient.post("/rooms/".concat(encodeURIComponent(roomId), "/leave"), params ? toRecord(params) : undefined);
    })();
  }
  inviteUser(roomId, params) {
    var _this13 = this;
    return _asyncToGenerator(function* () {
      yield _this13.httpClient.post("/rooms/".concat(encodeURIComponent(roomId), "/invite"), {
        user_id: params.user_id,
        reason: params.reason
      });
    })();
  }
  kickUser(roomId, userId, reason) {
    var _this14 = this;
    return _asyncToGenerator(function* () {
      yield _this14.httpClient.post("/rooms/".concat(encodeURIComponent(roomId), "/kick"), {
        user_id: userId,
        reason
      });
    })();
  }
  banUser(roomId, userId, reason) {
    var _this15 = this;
    return _asyncToGenerator(function* () {
      yield _this15.httpClient.post("/rooms/".concat(encodeURIComponent(roomId), "/ban"), {
        user_id: userId,
        reason
      });
    })();
  }
  unbanUser(roomId, userId) {
    var _this16 = this;
    return _asyncToGenerator(function* () {
      yield _this16.httpClient.post("/rooms/".concat(encodeURIComponent(roomId), "/unban"), {
        user_id: userId
      });
    })();
  }
  getRoomInfo(roomId) {
    var _this17 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this17.httpClient.get("/directory/room/".concat(encodeURIComponent(roomId)));
      if (!response.data) {
        throw new SynapseEnhancedError("Failed to get room info", ErrorCode.UNKNOWN, undefined, 500);
      }
      return response.data;
    })();
  }
  deleteRoom(roomId) {
    var _this18 = this;
    return _asyncToGenerator(function* () {
      yield _this18.httpClient.delete("/directory/room/".concat(encodeURIComponent(roomId)));
    })();
  }
  getPublicRooms(params) {
    var _this19 = this;
    return _asyncToGenerator(function* () {
      var queryParams = {};
      if (params !== null && params !== void 0 && params.limit) queryParams.limit = params.limit.toString();
      if (params !== null && params !== void 0 && params.since) queryParams.since = params.since;
      if (params !== null && params !== void 0 && params.server) queryParams.server = params.server;
      if (params !== null && params !== void 0 && params.search_term) queryParams.search_term = params.search_term;
      var response = yield _this19.httpClient.get("/publicRooms", queryParams);
      if (!response.data) {
        throw new SynapseEnhancedError("Failed to get public rooms", ErrorCode.UNKNOWN, undefined, 500);
      }
      return response.data;
    })();
  }
  getUserRooms(userId) {
    var _this20 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this20.httpClient.get("/user/".concat(encodeURIComponent(userId), "/rooms"));
      if (!response.data) {
        throw new SynapseEnhancedError("Failed to get user rooms", ErrorCode.UNKNOWN, undefined, 500);
      }
      return response.data;
    })();
  }
  sendMessage(roomId, eventType, content, txnId) {
    var _this21 = this;
    return _asyncToGenerator(function* () {
      var transactionId = txnId || _this21.generateTransactionId();
      var response = yield _this21.httpClient.post("/rooms/".concat(encodeURIComponent(roomId), "/send/").concat(encodeURIComponent(eventType), "/").concat(transactionId), toRecord(content));
      if (!response.data) {
        throw new SynapseEnhancedError("Failed to send message", ErrorCode.UNKNOWN, undefined, 500);
      }
      return response.data;
    })();
  }
  getMessages(roomId, params) {
    var _this22 = this;
    return _asyncToGenerator(function* () {
      var queryParams = {
        from: params.from,
        dir: params.dir
      };
      if (params.limit) queryParams.limit = params.limit.toString();
      if (params.to) queryParams.to = params.to;
      if (params.filter) queryParams.filter = params.filter;
      var response = yield _this22.httpClient.get("/rooms/".concat(encodeURIComponent(roomId), "/messages"), queryParams);
      if (!response.data) {
        throw new SynapseEnhancedError("Failed to get messages", ErrorCode.UNKNOWN, undefined, 500);
      }
      return response.data;
    })();
  }
  editMessage(roomId, _eventId, eventType, params, txnId) {
    var _this23 = this;
    return _asyncToGenerator(function* () {
      var transactionId = txnId || _this23.generateTransactionId();
      var response = yield _this23.httpClient.put("/rooms/".concat(encodeURIComponent(roomId), "/send/").concat(encodeURIComponent(eventType), "/").concat(transactionId), {
        "body": params.body,
        "msgtype": params.msgtype,
        "m.new_content": params["m.new_content"],
        "m.relates_to": params["m.relates_to"]
      });
      if (!response.data) {
        throw new SynapseEnhancedError("Failed to edit message", ErrorCode.UNKNOWN, undefined, 500);
      }
      return response.data;
    })();
  }
  replyMessage(roomId, eventId, content) {
    var _this24 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this24.httpClient.post("/rooms/".concat(encodeURIComponent(roomId), "/send/m.room.message"), {
        "msgtype": content.msgtype,
        "body": content.body,
        "m.relates_to": {
          rel_type: "m.reply",
          event_id: eventId
        }
      });
      if (!response.data) {
        throw new SynapseEnhancedError("Failed to reply to message", ErrorCode.UNKNOWN, undefined, 500);
      }
      return response.data;
    })();
  }
  redactEvent(roomId, eventId, params, txnId) {
    var _this25 = this;
    return _asyncToGenerator(function* () {
      var transactionId = txnId || _this25.generateTransactionId();
      var response = yield _this25.httpClient.put("/rooms/".concat(encodeURIComponent(roomId), "/redact/").concat(encodeURIComponent(eventId), "/").concat(transactionId), params ? toRecord(params) : undefined);
      if (!response.data) {
        throw new SynapseEnhancedError("Failed to redact event", ErrorCode.UNKNOWN, undefined, 500);
      }
      return response.data;
    })();
  }
  generateTransactionId() {
    return "m".concat(Date.now()).concat(Math.random().toString(36).substring(2, 10));
  }
  getEnhancedClient() {
    return this.enhancedClient;
  }
  getHttpClient() {
    return this.httpClient;
  }
}
//# sourceMappingURL=unified-client.js.map