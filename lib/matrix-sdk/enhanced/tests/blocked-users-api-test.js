import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
/**
 * Blocked Users API 测试
 */

import { SynapseEnhancedClient } from "../index.js";
import { loadTestConfig } from "./config.js";
import { logger } from "../../logger.js";
var log = logger.getChild("enhanced:test:blocked-users-api");
export class BlockedUsersApiTests {
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
      log.info("Running Blocked Users API Tests...");
      log.info("=============================");
      var results = [];
      results.push(yield _this.testGetBlockedUsers());
      results.push(yield _this.testIsBlocked());
      results.push(yield _this.testBlockUser());
      results.push(yield _this.testUnblockUser());
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
    log.info("Blocked Users API Results: ".concat(passed, "/").concat(results.length, " passed"));
  }
  testGetBlockedUsers() {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var blockedUsers = yield _this2.client.friends.getBlockedUsers();
        return {
          name: "Get Blocked Users",
          passed: Array.isArray(blockedUsers),
          responseTime: Date.now() - startTime,
          response: {
            count: blockedUsers.length
          }
        };
      } catch (error) {
        return {
          name: "Get Blocked Users",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testIsBlocked() {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var isBlocked = yield _this3.client.friends.isBlocked("@test:example.com");
        return {
          name: "Is Blocked",
          passed: typeof isBlocked === "boolean",
          responseTime: Date.now() - startTime,
          response: {
            isBlocked
          }
        };
      } catch (error) {
        return {
          name: "Is Blocked",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testBlockUser() {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var result = yield _this4.client.friends.blockUser("@test:example.com", "Test reason");
        return {
          name: "Block User",
          passed: typeof result === "boolean",
          responseTime: Date.now() - startTime,
          response: {
            success: result
          }
        };
      } catch (error) {
        return {
          name: "Block User",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testUnblockUser() {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var result = yield _this5.client.friends.unblockUser("@test:example.com");
        return {
          name: "Unblock User",
          passed: typeof result === "boolean",
          responseTime: Date.now() - startTime,
          response: {
            success: result
          }
        };
      } catch (error) {
        return {
          name: "Unblock User",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
}
var tests = new BlockedUsersApiTests();
tests.runAllTests().catch(error => log.error(error));
//# sourceMappingURL=blocked-users-api-test.js.map