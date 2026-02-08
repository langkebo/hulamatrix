import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
/**
 * Private Chat V2 API Tests
 */

import { SynapseEnhancedClient } from "../index.js";
import { loadTestConfig } from "./config.js";
import { logger } from "../../logger.js";
var log = logger.getChild("enhanced:test:private-chat-api");
export class PrivateChatApiTests {
  constructor() {
    _defineProperty(this, "client", void 0);
    _defineProperty(this, "config", void 0);
    _defineProperty(this, "createdSessionId", null);
    _defineProperty(this, "creatorId", void 0);
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
      log.info("Running Private Chat V2 API Tests...");
      log.info("=============================");
      var results = [];

      // Sequential tests as they depend on each other (create -> message -> close)

      // 1. Create Session
      results.push(yield _this.testCreateSession());

      // 2. Get Sessions
      if (_this.createdSessionId) {
        results.push(yield _this.testGetSessions());

        // 3. Send Message
        results.push(yield _this.testSendMessage());

        // 4. Get Messages
        results.push(yield _this.testGetMessages());

        // 5. Get Unread Count
        results.push(yield _this.testGetUnreadCount());

        // 6. Close Session (cleanup)
        results.push(yield _this.testCloseSession());
      } else {
        log.warn("Skipping dependent tests due to session creation failure");
      }
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
    log.info("Private Chat API Results: ".concat(passed, "/").concat(results.length, " passed"));
  }
  testCreateSession() {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var creatorId = "@testuser:".concat(new URL(_this2.config.server.baseUrl).hostname);
        var otherUserId = "@targetuser:".concat(new URL(_this2.config.server.baseUrl).hostname);
        var sessionId = yield _this2.client.privateChat.createSession({
          creator_id: creatorId,
          participants: [otherUserId]
        });
        _this2.createdSessionId = sessionId;
        _this2.creatorId = creatorId;
        return {
          name: "Create Session",
          passed: !!sessionId,
          responseTime: Date.now() - startTime,
          response: {
            sessionId
          }
        };
      } catch (error) {
        return {
          name: "Create Session",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testGetSessions() {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var sessions = yield _this3.client.privateChat.getSessions();
        var found = sessions.some(s => s.session_id === _this3.createdSessionId);
        return {
          name: "Get Sessions",
          passed: Array.isArray(sessions) && found,
          responseTime: Date.now() - startTime,
          response: {
            count: sessions.length
          }
        };
      } catch (error) {
        return {
          name: "Get Sessions",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testSendMessage() {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        if (!_this4.createdSessionId) throw new Error("No session ID");
        var messageId = yield _this4.client.privateChat.sendMessage({
          room_id: _this4.createdSessionId,
          content: "Hello from SDK Test",
          type: "m.text"
        });
        return {
          name: "Send Message",
          passed: !!messageId,
          responseTime: Date.now() - startTime,
          response: {
            messageId
          }
        };
      } catch (error) {
        return {
          name: "Send Message",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testGetMessages() {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        if (!_this5.createdSessionId) throw new Error("No session ID");
        var messages = yield _this5.client.privateChat.getMessages(_this5.createdSessionId, {
          limit: 10
        });
        return {
          name: "Get Messages",
          passed: Array.isArray(messages) && messages.length > 0,
          responseTime: Date.now() - startTime,
          response: {
            count: messages.length
          }
        };
      } catch (error) {
        return {
          name: "Get Messages",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testGetUnreadCount() {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        var count = yield _this6.client.privateChat.getUnreadCount();
        return {
          name: "Get Unread Count",
          passed: typeof count === "number",
          responseTime: Date.now() - startTime,
          response: {
            count
          }
        };
      } catch (error) {
        return {
          name: "Get Unread Count",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
  testCloseSession() {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      var startTime = Date.now();
      try {
        if (!_this7.createdSessionId || !_this7.creatorId) throw new Error("No session ID or Creator ID");
        var result = yield _this7.client.privateChat.closeSession(_this7.createdSessionId, _this7.creatorId);
        return {
          name: "Close Session",
          passed: result === true,
          responseTime: Date.now() - startTime,
          response: {
            result
          }
        };
      } catch (error) {
        return {
          name: "Close Session",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    })();
  }
}

// Execute directly
var tests = new PrivateChatApiTests();
tests.runAllTests().catch(error => log.error(error));
//# sourceMappingURL=private-chat-test.js.map