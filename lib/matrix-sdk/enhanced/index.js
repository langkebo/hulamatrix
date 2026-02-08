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

import { handleApiResponse } from "./utils/response-formatter.js";
import { SynapseEnhancedHttpClient } from "./utils/http.js";
import { FriendsApi } from "./api/friends.js";
import { PrivateChatApi } from "./api/private-chat.js";
import { PrivateChatStatusApi } from "./api/private-chat-status.js";
import { ChatroomApi } from "./api/chatroom.js";
import { SecurityApi } from "./api/security.js";
import { VoiceApi } from "./api/voice.js";
import { VoiceUserApi } from "./api/voice-user.js";
import { AdminApi } from "./api/admin.js";
import { PresenceApi } from "./api/presence.js";
import { MessagesApi } from "./api/messages.js";
import { SecurityAdminApi } from "./api/security-admin.js";
import { EnhancedInitApi } from "./api/enhanced.js";
import { FriendRequestsApi } from "./api/friend-requests.js";
import { FriendCategoriesApi } from "./api/friend-categories.js";
import { BlockedUsersApi } from "./api/blocked-users.js";
import { PrivateChatAdminApi } from "./api/private-chat-admin.js";
import { AudioUploadApi } from "./api/audio-upload.js";
/**
 * SynapseEnhancedClient - Client entry point for Synapse enhanced features
 * Integrates enhanced APIs including friends management, private chat, chat room,
 * security detection, voice processing, etc.
 */
export class SynapseEnhancedClient {
  constructor(config) {
    _defineProperty(this, "baseUrl", void 0);
    _defineProperty(this, "accessToken", void 0);
    _defineProperty(this, "apiPrefix", void 0);
    _defineProperty(this, "timeout", void 0);
    _defineProperty(this, "httpClient", void 0);
    _defineProperty(this, "_friends", void 0);
    _defineProperty(this, "_privateChat", void 0);
    _defineProperty(this, "_privateChatStatus", void 0);
    _defineProperty(this, "_chatroom", void 0);
    _defineProperty(this, "_security", void 0);
    _defineProperty(this, "_voice", void 0);
    _defineProperty(this, "_voiceUser", void 0);
    _defineProperty(this, "_admin", void 0);
    _defineProperty(this, "_presence", void 0);
    _defineProperty(this, "_messages", void 0);
    _defineProperty(this, "_securityAdmin", void 0);
    _defineProperty(this, "_enhanced", void 0);
    _defineProperty(this, "_friendRequests", void 0);
    _defineProperty(this, "_friendCategories", void 0);
    _defineProperty(this, "_blockedUsers", void 0);
    _defineProperty(this, "_privateChatAdmin", void 0);
    _defineProperty(this, "_audioUpload", void 0);
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.accessToken = config.accessToken;
    this.apiPrefix = config.apiPrefix || "/_synapse/client";
    this.timeout = config.timeout || 30000;
    this.httpClient = new SynapseEnhancedHttpClient({
      baseUrl: this.baseUrl,
      accessToken: this.accessToken,
      apiPrefix: this.apiPrefix,
      timeout: this.timeout
    });
    this._friends = new FriendsApi(this.httpClient);
    this._privateChat = new PrivateChatApi(this.httpClient);
    this._privateChatStatus = new PrivateChatStatusApi(this.httpClient);
    this._chatroom = new ChatroomApi(this.httpClient);
    this._security = new SecurityApi(this.httpClient);
    this._voice = new VoiceApi(this.httpClient);
    this._voiceUser = new VoiceUserApi(this.httpClient);
    this._admin = new AdminApi(this.httpClient);
    this._presence = new PresenceApi(this.httpClient);
    this._messages = new MessagesApi(this.httpClient);
    this._securityAdmin = new SecurityAdminApi(this.httpClient);
    this._enhanced = new EnhancedInitApi(this.httpClient);
    this._friendRequests = new FriendRequestsApi(this.httpClient);
    this._friendCategories = new FriendCategoriesApi(this.httpClient);
    this._blockedUsers = new BlockedUsersApi(this.httpClient);
    this._privateChatAdmin = new PrivateChatAdminApi(this.httpClient);
    this._audioUpload = new AudioUploadApi(this.httpClient);
  }
  get friends() {
    return this._friends;
  }
  get privateChat() {
    return this._privateChat;
  }
  get privateChatStatus() {
    return this._privateChatStatus;
  }
  get chatroom() {
    return this._chatroom;
  }
  get security() {
    return this._security;
  }
  get voice() {
    return this._voice;
  }
  get admin() {
    return this._admin;
  }
  get presence() {
    return this._presence;
  }
  get messages() {
    return this._messages;
  }
  get securityAdmin() {
    return this._securityAdmin;
  }
  get enhanced() {
    return this._enhanced;
  }
  get voiceUser() {
    return this._voiceUser;
  }
  get friendRequests() {
    return this._friendRequests;
  }
  get friendCategories() {
    return this._friendCategories;
  }
  get blockedUsers() {
    return this._blockedUsers;
  }
  get privateChatAdmin() {
    return this._privateChatAdmin;
  }
  get audioUpload() {
    return this._audioUpload;
  }
  getHttpClient() {
    return this.httpClient;
  }
  getEnhancedClient() {
    return {
      friends: this._friends,
      privateChat: this._privateChat,
      privateChatStatus: this._privateChatStatus,
      chatroom: this._chatroom,
      security: this._security,
      voice: this._voice,
      voiceUser: this._voiceUser,
      admin: this._admin,
      presence: this._presence,
      messages: this._messages,
      securityAdmin: this._securityAdmin,
      enhanced: this._enhanced,
      friendRequests: this._friendRequests,
      friendCategories: this._friendCategories,
      blockedUsers: this._blockedUsers,
      privateChatAdmin: this._privateChatAdmin,
      audioUpload: this._audioUpload
    };
  }

  /**
   * Get the runtime status of Synapse enhanced features
   * @returns Status information including version, initialization state, and supported features
   */
  getStatus() {
    var _this = this;
    return _asyncToGenerator(function* () {
      var response = yield _this.httpClient.get("/status");
      var data = handleApiResponse(response, "Failed to get status");
      return {
        version: data.version || "unknown",
        status: "healthy",
        initialized: data.initialized,
        features: data.features
      };
    })();
  }
}
export { SynapseEnhancedHttpClient, SynapseEnhancedError } from "./utils/http.js";
export { BatchOperationError, isBatchOperationError, extractBatchFailures } from "./utils/batch-errors.js";
export { MessagesApi } from "./api/messages.js";
export { SecurityAdminApi } from "./api/security-admin.js";
export { EnhancedInitApi } from "./api/enhanced.js";
export { PrivateChatStatusApi } from "./api/private-chat-status.js";
export { VoiceUserApi } from "./api/voice-user.js";
export { ChatroomApi } from "./api/chatroom.js";
export { FriendRequestsApi } from "./api/friend-requests.js";
export { FriendCategoriesApi } from "./api/friend-categories.js";
export { BlockedUsersApi } from "./api/blocked-users.js";
export { PrivateChatAdminApi } from "./api/private-chat-admin.js";
export { AudioUploadApi } from "./api/audio-upload.js";
export { UnifiedMatrixClient } from "./api/unified-client.js";
//# sourceMappingURL=index.js.map