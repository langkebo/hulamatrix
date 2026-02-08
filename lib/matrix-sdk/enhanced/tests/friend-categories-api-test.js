import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
/**
 * Friend Categories API 测试
 */

import { SynapseEnhancedClient } from "../index.js";
import { loadTestConfig } from "./config.js";
import { logger } from "../../logger.js";
var log = logger.getChild("enhanced:test:friend-categories-api");
export class FriendCategoriesApiTests {
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
      log.info("Running Friend Categories API Tests...");
      log.info("=============================");
      var results = [];
      results.push(yield _this.testGetCategories());
      results.push(yield _this.testCreateCategory());
      results.push(yield _this.testDeleteCategory());
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
    log.info("Friend Categories API Results: ".concat(passed, "/").concat(results.length, " passed"));
  }
  testGetCategories() {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var categories = yield _this2.client.friends.getCategories();
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
  testCreateCategory() {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var category = yield _this3.client.friends.createCategory("Test Category");
        return {
          name: "Create Category",
          passed: category !== null && category.name === "Test Category",
          responseTime: Date.now() - startTime,
          response: {
            categoryId: category.id
          }
        };
      } catch (error) {
        return {
          name: "Create Category",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testDeleteCategory() {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var result = yield _this4.client.friends.deleteCategory("test-category");
        return {
          name: "Delete Category",
          passed: typeof result === "boolean",
          responseTime: Date.now() - startTime,
          response: {
            success: result
          }
        };
      } catch (error) {
        return {
          name: "Delete Category",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
}
var tests = new FriendCategoriesApiTests();
tests.runAllTests().catch(error => log.error(error));
//# sourceMappingURL=friend-categories-api-test.js.map