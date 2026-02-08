import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
/**
 * Friends Basic API 测试
 */

import { SynapseEnhancedClient } from "../index.js";
import { loadTestConfig } from "./config.js";
import { logger } from "../../logger.js";
var log = logger.getChild("enhanced:test:friends-basic-api");
export class FriendsBasicApiTests {
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
      log.info("Running Friends Basic API Tests...");
      log.info("=============================");
      var results = [];
      results.push(yield _this.testGetFriends());
      results.push(yield _this.testGetFriend());
      results.push(yield _this.testCheckFriendship());
      results.push(yield _this.testSetRemark());
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
    log.info("Friends Basic API Results: ".concat(passed, "/").concat(results.length, " passed"));
  }
  testGetFriends() {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var result = yield _this2.client.friends.getFriends({
          page: 1,
          limit: 10
        });
        return {
          name: "Get Friends",
          passed: Array.isArray(result),
          responseTime: Date.now() - startTime,
          response: {
            count: result.length
          }
        };
      } catch (error) {
        return {
          name: "Get Friends",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testGetFriend() {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var friend = yield _this3.client.friends.getFriendDetail("@test:example.com");
        return {
          name: "Get Friend Detail",
          passed: friend !== null,
          responseTime: Date.now() - startTime,
          response: {
            found: friend !== null
          }
        };
      } catch (error) {
        return {
          name: "Get Friend Detail",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testCheckFriendship() {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var isFriend = yield _this4.client.friends.isFriend("@test:example.com");
        return {
          name: "Check Friendship",
          passed: typeof isFriend === "boolean",
          responseTime: Date.now() - startTime,
          response: {
            isFriend
          }
        };
      } catch (error) {
        return {
          name: "Check Friendship",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testSetRemark() {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var result = yield _this5.client.friends.setRemark("@test:example.com", "Test Remark");
        return {
          name: "Set Remark",
          passed: typeof result === "boolean",
          responseTime: Date.now() - startTime,
          response: {
            success: result
          }
        };
      } catch (error) {
        return {
          name: "Set Remark",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
}
var tests = new FriendsBasicApiTests();
tests.runAllTests().catch(error => log.error(error));
//# sourceMappingURL=friends-basic-api-test.js.map