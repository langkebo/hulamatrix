import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
/**
 * Friend Requests API 测试
 */

import { SynapseEnhancedClient } from "../index.js";
import { loadTestConfig } from "./config.js";
import { logger } from "../../logger.js";
var log = logger.getChild("enhanced:test:friend-requests-api");
export class FriendRequestsApiTests {
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
      log.info("Running Friend Requests API Tests...");
      log.info("=============================");
      var results = [];
      results.push(yield _this.testGetReceivedRequests());
      results.push(yield _this.testGetSentRequests());
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
    log.info("Friend Requests API Results: ".concat(passed, "/").concat(results.length, " passed"));
  }
  testGetReceivedRequests() {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var requests = yield _this2.client.friends.getReceivedRequests();
        return {
          name: "Get Received Requests",
          passed: Array.isArray(requests),
          responseTime: Date.now() - startTime,
          response: {
            count: requests.length
          }
        };
      } catch (error) {
        return {
          name: "Get Received Requests",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testGetSentRequests() {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var requests = yield _this3.client.friends.getSentRequests({
          page: 1,
          limit: 10
        });
        return {
          name: "Get Sent Requests",
          passed: Array.isArray(requests),
          responseTime: Date.now() - startTime,
          response: {
            count: requests.length
          }
        };
      } catch (error) {
        return {
          name: "Get Sent Requests",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
}
var tests = new FriendRequestsApiTests();
tests.runAllTests().catch(error => log.error(error));
//# sourceMappingURL=friend-requests-api-test.js.map