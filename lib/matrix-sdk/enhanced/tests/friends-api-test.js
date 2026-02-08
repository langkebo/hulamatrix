import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
/**
 * Friends V2 API Tests
 */

import { SynapseEnhancedClient } from "../index.js";
import { loadTestConfig } from "./config.js";
import { logger } from "../../logger.js";
var log = logger.getChild("enhanced:test:friends-api");
export class FriendsApiTests {
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
      log.info("Running Friends V2 API Tests...");
      log.info("=============================");
      var results = [];
      results.push(yield _this.testGetFriends());
      results.push(yield _this.testGetCategories());
      results.push(yield _this.testSearchUsers());
      results.push(yield _this.testGetPendingRequests());
      results.push(yield _this.testGetStatistics());
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
    log.info("Friends API Results: ".concat(passed, "/").concat(results.length, " passed"));
  }
  testGetFriends() {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var friends = yield _this2.client.friends.getFriends();
        return {
          name: "Get Friends List",
          passed: Array.isArray(friends),
          responseTime: Date.now() - startTime,
          response: {
            count: friends.length
          }
        };
      } catch (error) {
        return {
          name: "Get Friends List",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testGetCategories() {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var categories = yield _this3.client.friends.getCategories();
        return {
          name: "Get Categories",
          passed: Array.isArray(categories),
          responseTime: Date.now() - startTime,
          response: {
            count: categories.length
          }
        };
      } catch (error) {
        return {
          name: "Get Categories",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testSearchUsers() {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var results = yield _this4.client.friends.searchUsers("test", 5);
        return {
          name: "Search Users",
          passed: Array.isArray(results),
          responseTime: Date.now() - startTime,
          response: {
            count: results.length
          }
        };
      } catch (error) {
        return {
          name: "Search Users",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testGetPendingRequests() {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var requests = yield _this5.client.friends.getPendingRequests();
        return {
          name: "Get Pending Requests",
          passed: Array.isArray(requests),
          responseTime: Date.now() - startTime,
          response: {
            count: requests.length
          }
        };
      } catch (error) {
        return {
          name: "Get Pending Requests",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testGetStatistics() {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var stats = yield _this6.client.friends.getFriendStats();
        return {
          name: "Get Statistics",
          passed: typeof stats.total_friends === "number",
          responseTime: Date.now() - startTime,
          response: stats
        };
      } catch (error) {
        return {
          name: "Get Statistics",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
}

// Execute directly
var tests = new FriendsApiTests();
tests.runAllTests().catch(error => log.error(error));
//# sourceMappingURL=friends-api-test.js.map