import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
function _asyncIterator(r) { var n, t, o, e = 2; for ("undefined" != typeof Symbol && (t = Symbol.asyncIterator, o = Symbol.iterator); e--;) { if (t && null != (n = r[t])) return n.call(r); if (o && null != (n = r[o])) return new AsyncFromSyncIterator(n.call(r)); t = "@@asyncIterator", o = "@@iterator"; } throw new TypeError("Object is not async iterable"); }
function AsyncFromSyncIterator(r) { function AsyncFromSyncIteratorContinuation(r) { if (Object(r) !== r) return Promise.reject(new TypeError(r + " is not an object.")); var n = r.done; return Promise.resolve(r.value).then(function (r) { return { value: r, done: n }; }); } return AsyncFromSyncIterator = function AsyncFromSyncIterator(r) { this.s = r, this.n = r.next; }, AsyncFromSyncIterator.prototype = { s: null, n: null, next: function next() { return AsyncFromSyncIteratorContinuation(this.n.apply(this.s, arguments)); }, return: function _return(r) { var n = this.s.return; return void 0 === n ? Promise.resolve({ value: r, done: !0 }) : AsyncFromSyncIteratorContinuation(n.apply(this.s, arguments)); }, throw: function _throw(r) { var n = this.s.return; return void 0 === n ? Promise.reject(r) : AsyncFromSyncIteratorContinuation(n.apply(this.s, arguments)); } }, new AsyncFromSyncIterator(r); }
/**
 * Friends API 集成测试
 *
 * 本文档测试完整的用户流程，包括好友请求、接受、分类等
 */

import { SynapseEnhancedClient } from "../index.js";
import { loadTestConfig } from "./config.js";
import { logger } from "../../logger.js";
var log = logger.getChild("enhanced:test:friends-integration");
export class FriendsApiIntegrationTests {
  constructor() {
    _defineProperty(this, "client", void 0);
    _defineProperty(this, "config", void 0);
    _defineProperty(this, "createdCategoryIds", []);
    _defineProperty(this, "sentRequestIds", []);
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
      log.info("Running Friends API Integration Tests...");
      log.info("=============================");
      var results = [];
      results.push(yield _this.testCompleteFriendRequestFlow());
      results.push(yield _this.testCategoryManagementFlow());
      results.push(yield _this.testBatchOperationsFlow());
      results.push(yield _this.testStreamingFlow());
      yield _this.cleanup();
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
    log.info("Friends API Integration Results: ".concat(passed, "/").concat(results.length, " passed"));
  }
  testCompleteFriendRequestFlow() {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        log.info("Testing complete friend request flow...");
        var targetUserId = "@integration-test-".concat(Date.now(), ":example.com");
        var requestResult = yield _this2.client.friends.sendFriendRequest({
          target_id: targetUserId,
          message: "Hello, let's be friends!"
        });
        if (requestResult.request_id) {
          _this2.sentRequestIds.push(requestResult.request_id);
        }
        var receivedRequests = yield _this2.client.friends.getReceivedRequests();
        var foundRequest = receivedRequests.find(r => r.request_id === requestResult.request_id);
        return {
          name: "Complete Friend Request Flow",
          passed: foundRequest !== undefined,
          responseTime: Date.now() - startTime,
          response: {
            requestId: requestResult.request_id,
            found: foundRequest !== undefined
          }
        };
      } catch (error) {
        return {
          name: "Complete Friend Request Flow",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testCategoryManagementFlow() {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        log.info("Testing category management flow...");
        var categoryName = "Integration Test Category ".concat(Date.now());
        var createdCategory = yield _this3.client.friends.createCategory(categoryName);
        if (createdCategory && createdCategory.id) {
          _this3.createdCategoryIds.push(createdCategory.id);
        }
        var categories = yield _this3.client.friends.getCategories();
        var foundCategory = categories.find(c => c.id === (createdCategory === null || createdCategory === void 0 ? void 0 : createdCategory.id));
        var deleted = false;
        if (createdCategory !== null && createdCategory !== void 0 && createdCategory.id) {
          deleted = yield _this3.client.friends.deleteCategory(createdCategory.id);
          var index = _this3.createdCategoryIds.indexOf(createdCategory.id);
          if (index > -1) {
            _this3.createdCategoryIds.splice(index, 1);
          }
        }
        return {
          name: "Category Management Flow",
          passed: foundCategory !== undefined && deleted,
          responseTime: Date.now() - startTime,
          response: {
            created: foundCategory !== undefined,
            deleted
          }
        };
      } catch (error) {
        return {
          name: "Category Management Flow",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testBatchOperationsFlow() {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        log.info("Testing batch operations flow...");
        var userIds = ["@test1:example.com", "@test2:example.com", "@test3:example.com"];
        var friendsMap = yield _this4.client.friends.getFriendsBatch(userIds);
        var remarks = new Map([["@test1:example.com", "Colleague"], ["@test2:example.com", "Family"], ["@test3:example.com", "Friend"]]);
        var updateResults = yield _this4.client.friends.updateRemarksBatch(remarks);
        var successCount = Array.from(updateResults.values()).filter(r => r).length;
        return {
          name: "Batch Operations Flow",
          passed: successCount === userIds.length,
          responseTime: Date.now() - startTime,
          response: {
            fetched: friendsMap.size,
            updated: successCount
          }
        };
      } catch (error) {
        return {
          name: "Batch Operations Flow",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testStreamingFlow() {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        log.info("Testing streaming flow...");
        var friends = [];
        var count = 0;
        var _iteratorAbruptCompletion = false;
        var _didIteratorError = false;
        var _iteratorError;
        try {
          for (var _iterator = _asyncIterator(_this5.client.friends.streamFriends({
              limit: 10
            })), _step; _iteratorAbruptCompletion = !(_step = yield _iterator.next()).done; _iteratorAbruptCompletion = false) {
            var friend = _step.value;
            {
              friends.push(friend);
              count++;
              if (count >= 5) {
                break;
              }
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (_iteratorAbruptCompletion && _iterator.return != null) {
              yield _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
        return {
          name: "Streaming Flow",
          passed: friends.length > 0,
          responseTime: Date.now() - startTime,
          response: {
            streamed: friends.length
          }
        };
      } catch (error) {
        return {
          name: "Streaming Flow",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  cleanup() {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      log.info("Cleaning up test data...");
      for (var categoryId of _this6.createdCategoryIds) {
        try {
          yield _this6.client.friends.deleteCategory(categoryId);
        } catch (_unused) {}
      }
      _this6.createdCategoryIds = [];
      _this6.sentRequestIds = [];
    })();
  }
}
var tests = new FriendsApiIntegrationTests();
tests.runAllTests().catch(error => log.error(error));
//# sourceMappingURL=friends-integration-test.js.map