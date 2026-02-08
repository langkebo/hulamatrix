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

import { AdminApi } from "./api/admin.js";
import { SynapseEnhancedError } from "./utils/http.js";
import { ErrorCode } from "./utils/error-codes.js";
class MockHttpClient {
  constructor() {
    _defineProperty(this, "responses", new Map());
    _defineProperty(this, "errorResponses", new Map());
  }
  getUrlKey(url) {
    var withoutQuery = url.split("?")[0];
    try {
      return decodeURIComponent(withoutQuery);
    } catch (_unused) {
      return withoutQuery;
    }
  }
  getResponse(url) {
    return this.responses.get(url) || this.responses.get(this.getUrlKey(url));
  }
  getError(url) {
    return this.errorResponses.get(url) || this.errorResponses.get(this.getUrlKey(url));
  }
  setResponse(url, response) {
    this.responses.set(url, response);
  }
  setError(url, error) {
    this.errorResponses.set(url, error);
  }
  get(url, _params) {
    var _this = this;
    return _asyncToGenerator(function* () {
      if (_this.getError(url)) {
        throw _this.getError(url);
      }
      var response = _this.getResponse(url);
      if (!response) {
        throw new Error("No mock response for URL: ".concat(url));
      }
      return response;
    })();
  }
  post(url, _body) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      if (_this2.getError(url)) {
        throw _this2.getError(url);
      }
      var response = _this2.getResponse(url);
      if (!response) {
        throw new Error("No mock response for URL: ".concat(url));
      }
      return response;
    })();
  }
  put(url, _body) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      if (_this3.getError(url)) {
        throw _this3.getError(url);
      }
      var response = _this3.getResponse(url);
      if (!response) {
        throw new Error("No mock response for URL: ".concat(url));
      }
      return response;
    })();
  }
  request(url, _options) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      if (_this4.getError(url)) {
        throw _this4.getError(url);
      }
      var response = _this4.getResponse(url);
      if (!response) {
        throw new Error("No mock response for URL: ".concat(url));
      }
      return response;
    })();
  }
}
describe("AdminApi", () => {
  var adminApi;
  var mockHttpClient;
  var mockUser = {
    user_id: "@testuser:example.com",
    display_name: "Test User",
    avatar_url: "mxc://example.com/avatar",
    created_at: "2024-01-01T00:00:00Z",
    is_admin: false,
    friend_count: 10,
    session_count: 5,
    last_active: "2024-01-19T00:00:00Z",
    admin: false,
    deactivated: false,
    creation_ts: 1704067200000
  };
  var mockRoom = {
    room_id: "!testroom:example.com",
    name: "Test Room",
    creator: "@testuser:example.com",
    creator_id: "@testuser:example.com",
    version: "1",
    federatable: true,
    public: true,
    join_rules: "invite",
    guest_access: "forbidden",
    history_visibility: "joined",
    creation_ts: 1704067200000,
    member_count: 50,
    created_at: "2024-01-01T00:00:00Z",
    state: "public"
  };
  var mockStats = {
    total_users: 1000,
    active_users: 500,
    total_rooms: 100,
    total_friendships: 2000,
    total_sessions: 1500,
    total_messages: 10000,
    memory_usage: 2048,
    database_size: 1073741824,
    storage_used: "1GB"
  };
  var mockHealth = {
    status: "healthy",
    version: "1.0.0",
    uptime: 86400,
    uptime_seconds: 86400,
    health: {
      cpu_percent: 25,
      memory_percent: 45,
      disk_percent: 60,
      network_rx: 1000,
      network_tx: 2000,
      database: {
        connections: 10,
        size: 1073741824,
        status: "ok",
        latency_ms: 5
      }
    }
  };
  beforeEach(() => {
    mockHttpClient = new MockHttpClient();
    adminApi = new AdminApi(mockHttpClient);
  });
  describe("User Management", () => {
    it("should get users with pagination", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: {
            items: [mockUser],
            total: 1,
            page: 1,
            limit: 20
          }
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/users", mockResponse);
      var result = yield adminApi.getUsers({
        page: 1,
        limit: 20
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].user_id).toBe("@testuser:example.com");
      expect(result.total).toBe(1);
    }));
    it("should get user detail", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: mockUser
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/users/@testuser:example.com", mockResponse);
      var result = yield adminApi.getUserDetail("@testuser:example.com");
      expect(result === null || result === void 0 ? void 0 : result.user_id).toBe("@testuser:example.com");
      expect(result === null || result === void 0 ? void 0 : result.display_name).toBe("Test User");
    }));
    it("should return null for non-existent user", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "failed"
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/users/@nonexistent:example.com", mockResponse);
      var result = yield adminApi.getUserDetail("@nonexistent:example.com");
      expect(result).toBeNull();
    }));
    it("should suspend user", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: {
            deleted_at: "2024-01-19T12:00:00Z"
          }
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/users/@testuser:example.com/suspend", mockResponse);
      var result = yield adminApi.suspendUser("@testuser:example.com", "Spam behavior");
      expect(result.success).toBe(true);
      expect(result.deleted_at).toBeDefined();
    }));
    it("should activate user", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: {
            deleted_at: "2024-01-19T12:00:00Z"
          }
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/users/@testuser:example.com/activate", mockResponse);
      var result = yield adminApi.activateUser("@testuser:example.com");
      expect(result.success).toBe(true);
    }));
    it("should throw error on suspend failure", /*#__PURE__*/_asyncToGenerator(function* () {
      mockHttpClient.setError("/_synapse/admin/v2/users/@testuser:example.com/suspend", new SynapseEnhancedError("Failed to suspend user", ErrorCode.UNKNOWN));
      yield expect(adminApi.suspendUser("@testuser:example.com")).rejects.toThrow(SynapseEnhancedError);
    }));
    it("should get user permissions", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: {
            user_id: "@testuser:example.com",
            permissions: [{
              permission: "send_message",
              description: "Send messages",
              granted: true
            }]
          }
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/users/@testuser:example.com/permissions", mockResponse);
      var result = yield adminApi.getUserPermissions("@testuser:example.com");
      expect(result.user_id).toBe("@testuser:example.com");
      expect(result.permissions).toHaveLength(1);
    }));
    it("should execute batch user operations", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: {
            results: [{
              user_id: "@user1:example.com",
              success: true
            }, {
              user_id: "@user2:example.com",
              success: false,
              error: "User not found"
            }],
            total_success: 1,
            total_failed: 1
          }
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/users/batch", mockResponse);
      var result = yield adminApi.batchUserOperations([{
        user_id: "@user1:example.com",
        action: "suspend"
      }, {
        user_id: "@user2:example.com",
        action: "activate"
      }]);
      expect(result.total_success).toBe(1);
      expect(result.total_failed).toBe(1);
    }));
  });
  describe("Room Management", () => {
    it("should get rooms with pagination", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: {
            items: [mockRoom],
            total: 1,
            page: 1,
            limit: 20
          }
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/rooms", mockResponse);
      var result = yield adminApi.getRooms({
        page: 1,
        limit: 20
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].room_id).toBe("!testroom:example.com");
    }));
    it("should get room detail", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockRoomDetail = {
        room_id: "!testroom:example.com",
        name: "Test Room",
        creator: "@testuser:example.com",
        version: "1",
        federatable: true,
        public: true,
        join_rules: "invite",
        guest_access: "forbidden",
        history_visibility: "joined",
        creation_ts: 1704067200000,
        state_events: 10,
        is_encrypted: true
      };
      var mockResponse = {
        data: {
          status: "ok",
          data: mockRoomDetail
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/rooms/!testroom:example.com", mockResponse);
      var result = yield adminApi.getRoomDetail("!testroom:example.com");
      expect(result === null || result === void 0 ? void 0 : result.room_id).toBe("!testroom:example.com");
      expect(result === null || result === void 0 ? void 0 : result.is_encrypted).toBe(true);
    }));
    it("should get room messages", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockMessagesResponse = {
        messages: [{
          message_id: "$msg1",
          room_id: "!testroom:example.com",
          sender_id: "@testuser:example.com",
          content: "Hello",
          type: "m.room.message",
          message_type: "m.text",
          created_at: "2024-01-19T10:00:00Z"
        }],
        pagination: {
          page: 1,
          page_size: 20,
          total: 1,
          total_pages: 1
        }
      };
      var mockResponse = {
        data: {
          status: "ok",
          data: mockMessagesResponse
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/rooms/!testroom:example.com/messages", mockResponse);
      var result = yield adminApi.getRoomMessages("!testroom:example.com", 20);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toBe("Hello");
    }));
    it("should delete room", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok"
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/rooms/!testroom%3Aexample.com/delete", mockResponse);
      var result = yield adminApi.deleteRoom("!testroom:example.com", "Spam room");
      expect(result).toBe(true);
    }));
    it("should search rooms with criteria", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: {
            rooms: [mockRoom],
            pagination: {
              page: 1,
              page_size: 20,
              total: 1,
              total_pages: 1
            }
          }
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/rooms/search", mockResponse);
      var result = yield adminApi.searchRooms({
        name: "Test",
        state: "public"
      }, {
        page: 1,
        limit: 20
      });
      expect(result.rooms).toHaveLength(1);
    }));
    it("should execute batch room operations", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: {
            results: [{
              room_id: "!room1:example.com",
              success: true
            }],
            total_success: 1,
            total_failed: 0
          }
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/rooms/batch", mockResponse);
      var result = yield adminApi.batchRoomOperations([{
        room_id: "!room1:example.com",
        action: "archive"
      }]);
      expect(result.total_success).toBe(1);
    }));
  });
  describe("Message Management", () => {
    it("should search messages", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockMessagesResponse = {
        messages: [{
          message_id: "$msg1",
          room_id: "!testroom:example.com",
          sender_id: "@testuser:example.com",
          content: "Hello World",
          type: "m.room.message",
          message_type: "m.text",
          created_at: "2024-01-19T10:00:00Z"
        }],
        pagination: {
          page: 1,
          page_size: 20,
          total: 1,
          total_pages: 1
        }
      };
      var mockResponse = {
        data: {
          status: "ok",
          data: mockMessagesResponse
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/messages/search", mockResponse);
      var result = yield adminApi.searchMessages("Hello", {
        page: 1,
        limit: 20
      });
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain("Hello");
    }));
    it("should delete message", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok"
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/messages/$msg1", mockResponse);
      var result = yield adminApi.deleteMessage("$msg1", "Inappropriate content");
      expect(result).toBe(true);
    }));
    it("should batch delete messages", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: {
            deleted_count: 2,
            deleted_ids: ["$msg1", "$msg2"],
            failed_ids: []
          }
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/messages/batch", mockResponse);
      var result = yield adminApi.batchDeleteMessages({
        criteria: {
          before: "2024-01-19T00:00:00Z",
          limit: 10
        },
        reason: "Clean up old messages"
      });
      expect(result.deleted_count).toBe(2);
    }));
    it("should moderate messages", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: {
            results: [{
              message_id: "$msg1",
              action: "delete",
              success: true
            }],
            total_processed: 1
          }
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/messages/moderate", mockResponse);
      var result = yield adminApi.moderateMessages({
        message_ids: ["$msg1"],
        action: "delete",
        reason: "Spam"
      });
      expect(result.total_processed).toBe(1);
    }));
  });
  describe("System Management", () => {
    it("should get statistics", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: mockStats
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/stats", mockResponse);
      var result = yield adminApi.getStatistics("week");
      expect(result.total_users).toBe(1000);
      expect(result.active_users).toBe(500);
      expect(result.storage_used).toBe("1GB");
    }));
    it("should get dashboard stats", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: mockStats
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/dashboard", mockResponse);
      var result = yield adminApi.getDashboardStats();
      expect(result.total_users).toBe(1000);
    }));
    it("should get health status", /*#__PURE__*/_asyncToGenerator(function* () {
      var _result$health$databa;
      var mockResponse = {
        data: {
          status: "ok",
          data: mockHealth
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/health", mockResponse);
      var result = yield adminApi.getHealth();
      expect(result.status).toBe("healthy");
      expect((_result$health$databa = result.health.database) === null || _result$health$databa === void 0 ? void 0 : _result$health$databa.status).toBe("ok");
      expect(result.uptime_seconds).toBe(86400);
    }));
  });
  describe("Admin Management", () => {
    it("should get admin list", /*#__PURE__*/_asyncToGenerator(function* () {
      var _result$admins;
      var mockAdmin = {
        user_id: "@admin:example.com",
        admin: true,
        deactivated: false,
        creation_ts: 1704067200000,
        id: "admin1",
        username: "admin",
        email: "admin@example.com",
        role: "super_admin",
        status: "active",
        created_at: "2024-01-01T00:00:00Z"
      };
      var mockResponse = {
        data: {
          status: "ok",
          data: {
            admins: [mockAdmin],
            pagination: {
              page: 1,
              page_size: 20,
              total: 1,
              total_pages: 1
            }
          }
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/admins", mockResponse);
      var result = yield adminApi.getAdminList({
        page: 1,
        limit: 20
      });
      expect(result.admins).toHaveLength(1);
      expect((_result$admins = result.admins) === null || _result$admins === void 0 || (_result$admins = _result$admins[0]) === null || _result$admins === void 0 ? void 0 : _result$admins.role).toBe("super_admin");
    }));
    it("should get admin profile", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockAdmin = {
        user_id: "@admin:example.com",
        admin: true,
        deactivated: false,
        creation_ts: 1704067200000,
        id: "admin1",
        username: "admin",
        email: "admin@example.com",
        role: "admin",
        status: "active",
        created_at: "2024-01-01T00:00:00Z"
      };
      var mockResponse = {
        data: {
          status: "ok",
          data: mockAdmin
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/profile", mockResponse);
      var result = yield adminApi.getAdminProfile();
      expect(result.username).toBe("admin");
      expect(result.email).toBe("admin@example.com");
    }));
    it("should create admin", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: {
            admin_id: "admin2"
          }
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/admins", mockResponse);
      var result = yield adminApi.createAdmin({
        user_id: "@newadmin:example.com",
        username: "newadmin",
        email: "newadmin@example.com",
        password: "securepassword",
        role: "admin"
      });
      expect(result.admin_id).toBe("admin2");
    }));
    it("should update admin role", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok"
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/admins/admin1/role", mockResponse);
      var result = yield adminApi.updateAdminRole({
        admin_id: "admin1",
        admin: true,
        new_role: "super_admin"
      });
      expect(result).toBe(true);
    }));
    it("should delete admin", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok"
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/admins/admin1", mockResponse);
      var result = yield adminApi.deleteAdmin("admin1");
      expect(result).toBe(true);
    }));
    it("should get audit logs", /*#__PURE__*/_asyncToGenerator(function* () {
      var _result$logs;
      var mockResponse = {
        data: {
          status: "ok",
          data: {
            logs: [{
              id: "log1",
              admin_id: "admin1",
              action: "suspend_user",
              target_type: "user",
              target_id: "@user1:example.com",
              created_at: "2024-01-19T10:00:00Z"
            }],
            pagination: {
              page: 1,
              page_size: 20,
              total: 1,
              total_pages: 1
            }
          }
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/audit-logs", mockResponse);
      var result = yield adminApi.getAuditLogs({
        page: 1,
        limit: 20
      });
      expect(result.logs).toHaveLength(1);
      expect((_result$logs = result.logs) === null || _result$logs === void 0 || (_result$logs = _result$logs[0]) === null || _result$logs === void 0 ? void 0 : _result$logs.action).toBe("suspend_user");
    }));
    it("should get admin activity", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: {
            activities: [{
              id: "act1",
              admin_id: "admin1",
              admin_username: "admin",
              action: "get_users",
              endpoint: "/admin/users",
              method: "GET",
              created_at: "2024-01-19T10:00:00Z"
            }],
            pagination: {
              page: 1,
              page_size: 20,
              total: 1,
              total_pages: 1
            }
          }
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/admins/activity", mockResponse);
      var result = yield adminApi.getAdminActivity({
        page: 1,
        limit: 20
      });
      expect(result.activities).toHaveLength(1);
      expect(result.activities[0].action).toBe("get_users");
    }));
  });
  describe("Config Management", () => {
    it("should get system config", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockConfig = {
        config: {
          max_upload_size: "10M",
          allow_guest_access: true
        },
        updated_at: "2024-01-19T00:00:00Z"
      };
      var mockResponse = {
        data: {
          status: "ok",
          data: mockConfig
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/config", mockResponse);
      var result = yield adminApi.getSystemConfig();
      expect(result.config.max_upload_size).toBe("10M");
    }));
    it("should update system config", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockConfig = {
        config: {
          max_upload_size: "20M"
        },
        updated_at: "2024-01-19T12:00:00Z"
      };
      var mockResponse = {
        data: {
          status: "ok",
          data: mockConfig
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/config", mockResponse);
      var result = yield adminApi.updateSystemConfig({
        max_upload_size: "20M"
      });
      expect(result.config.max_upload_size).toBe("20M");
    }));
    it("should export config", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockExport = {
        config: {
          max_upload_size: "10M"
        },
        exported_at: "2024-01-19T12:00:00Z",
        version: "1.0.0"
      };
      var mockResponse = {
        data: {
          status: "ok",
          data: mockExport
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/config/export", mockResponse);
      var result = yield adminApi.exportConfig();
      expect(result.version).toBe("1.0.0");
      expect(result.exported_at).toBeDefined();
    }));
    it("should get config versions", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockVersions = {
        versions: [{
          version: "1.0.0",
          created_at: "2024-01-01T00:00:00Z",
          created_by: "admin"
        }, {
          version: "1.0.1",
          created_at: "2024-01-19T00:00:00Z",
          created_by: "admin",
          description: "Update config"
        }],
        current_version: "1.0.1"
      };
      var mockResponse = {
        data: {
          status: "ok",
          data: mockVersions
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/config/versions", mockResponse);
      var result = yield adminApi.getConfigVersions();
      expect(result.versions).toHaveLength(2);
      expect(result.current_version).toBe("1.0.1");
    }));
  });
  describe("Blacklist Management", () => {
    it("should get blacklist", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: {
            blacklist: [{
              type: "user",
              target: "@spamuser:example.com",
              reason: "Spam",
              created_at: "2024-01-19T10:00:00Z"
            }],
            pagination: {
              page: 1,
              limit: 20,
              total: 1,
              total_pages: 1
            }
          }
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/blacklist/list", mockResponse);
      var result = yield adminApi.getBlacklist({
        type: "user",
        page: 1,
        limit: 20
      });
      expect(result.blacklist).toHaveLength(1);
      expect(result.blacklist[0].type).toBe("user");
    }));
    it("should add to blacklist", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok"
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/blacklist/add", mockResponse);
      var result = yield adminApi.addToBlacklist({
        type: "user",
        target: "@spamuser:example.com",
        reason: "Spam behavior",
        duration_hours: "24"
      });
      expect(result).toBe(true);
    }));
    it("should remove from blacklist", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok"
        },
        status: 200
      };
      mockHttpClient.setResponse("/_synapse/admin/v2/blacklist/remove", mockResponse);
      var result = yield adminApi.removeFromBlacklist({
        type: "user",
        target: "@user:example.com",
        reason: "Appealed successfully"
      });
      expect(result).toBe(true);
    }));
  });
});
//# sourceMappingURL=admin.test.js.map