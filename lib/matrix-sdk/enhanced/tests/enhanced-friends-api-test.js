import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
/**
 * Enhanced Friends API 功能测试
 *
 * 测试所有新增的 Friends API 方法
 */

import { SynapseEnhancedClient } from "../index.js";
import { loadTestConfig } from "./config.js";
import { logger } from "../../logger.js";
var log = logger.getChild("enhanced:test:enhanced-friends-api");
export class EnhancedFriendsApiTests {
  constructor() {
    _defineProperty(this, "client", void 0);
    _defineProperty(this, "config", void 0);
    this.config = loadTestConfig();
    this.client = new SynapseEnhancedClient({
      baseUrl: this.config.server.baseUrl,
      accessToken: this.config.server.accessToken,
      apiPrefix: this.config.server.apiPrefix,
      timeout: this.config.test.timeout
    });
  }
  runAllTests() {
    var _this = this;
    return _asyncToGenerator(function* () {
      log.info("");
      log.info("=============================");
      log.info("Running Enhanced Friends API Tests...");
      log.info("=============================");
      var results = [];
      results.push(yield _this.testGetMutualFriends());
      results.push(yield _this.testGetRecentFriends());
      results.push(yield _this.testGetFriendInteractions());
      results.push(yield _this.testGetFriendInteractionStats());
      results.push(yield _this.testSearchBlockedUsers());
      results.push(yield _this.testGetRequestTemplates());
      results.push(yield _this.testVerifyFriendship());
      _this.printResults(results);
      return results;
    })();
  }
  printResults(results) {
    for (var result of results) {
      var icon = result.passed ? "✓" : "✗";
      log.info("".concat(icon, " ").concat(result.name, ": ").concat(result.passed ? "PASSED" : "FAILED", " (").concat(result.responseTime, "ms)"));
      if (result.error) {
        log.error("  Error: ".concat(result.error));
      }
    }
    var passed = results.filter(r => r.passed).length;
    log.info("");
    log.info("Enhanced Friends API Results: ".concat(passed, "/").concat(results.length, " passed"));
  }
  testGetMutualFriends() {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var result = yield _this2.client.friends.getMutualFriends("@test:example.com", 1, 10);
        return {
          name: "Get Mutual Friends",
          passed: Array.isArray(result.items),
          responseTime: Date.now() - startTime,
          response: {
            count: result.items.length,
            total: result.pagination.total
          }
        };
      } catch (error) {
        return {
          name: "Get Mutual Friends",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testGetRecentFriends() {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var friends = yield _this3.client.friends.getRecentFriends(10);
        return {
          name: "Get Recent Friends",
          passed: Array.isArray(friends),
          responseTime: Date.now() - startTime,
          response: {
            count: friends.length
          }
        };
      } catch (error) {
        return {
          name: "Get Recent Friends",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testGetFriendInteractions() {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var result = yield _this4.client.friends.getFriendInteractions("@test:example.com", 1, 10);
        return {
          name: "Get Friend Interactions",
          passed: Array.isArray(result.items),
          responseTime: Date.now() - startTime,
          response: {
            count: result.items.length,
            total: result.pagination.total
          }
        };
      } catch (error) {
        return {
          name: "Get Friend Interactions",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testGetFriendInteractionStats() {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var stats = yield _this5.client.friends.getFriendInteractionStats("@test:example.com");
        return {
          name: "Get Friend Interaction Stats",
          passed: stats !== null && typeof stats === "object",
          responseTime: Date.now() - startTime,
          response: {
            totalInteractions: stats.totalInteractions
          }
        };
      } catch (error) {
        return {
          name: "Get Friend Interaction Stats",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testSearchBlockedUsers() {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var result = yield _this6.client.friends.searchBlockedUsers("test", 1, 10);
        return {
          name: "Search Blocked Users",
          passed: Array.isArray(result.items),
          responseTime: Date.now() - startTime,
          response: {
            count: result.items.length,
            total: result.pagination.total
          }
        };
      } catch (error) {
        return {
          name: "Search Blocked Users",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testGetRequestTemplates() {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var templates = yield _this7.client.friends.getRequestTemplates();
        return {
          name: "Get Request Templates",
          passed: Array.isArray(templates),
          responseTime: Date.now() - startTime,
          response: {
            count: templates.length
          }
        };
      } catch (error) {
        return {
          name: "Get Request Templates",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testVerifyFriendship() {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var verification = yield _this8.client.friends.verifyFriendship("@test:example.com");
        return {
          name: "Verify Friendship",
          passed: verification !== null && typeof verification === "object",
          responseTime: Date.now() - startTime,
          response: {
            verified: verification.verified
          }
        };
      } catch (error) {
        return {
          name: "Verify Friendship",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
}
//# sourceMappingURL=enhanced-friends-api-test.js.map