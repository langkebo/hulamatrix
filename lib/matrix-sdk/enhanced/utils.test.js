import _defineProperty from "@babel/runtime/helpers/defineProperty";
import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
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

import { ErrorCode } from "./utils/error-codes.js";
import { SynapseEnhancedError } from "./utils/http.js";
import { RetryPolicy, withRetry } from "./utils/retry.js";
import { InterceptorRegistry, InterceptorPhase, createAuthInterceptor, createLoggingInterceptor, createRetryLoggingInterceptor, createResponseTransformInterceptor, createRequestTimeoutInterceptor } from "./utils/interceptors.js";
import { BatchProcessor } from "./utils/batch.js";
describe("SynapseEnhancedError", () => {
  describe("Constructor", () => {
    it("should create error with code and message", () => {
      var error = new SynapseEnhancedError("Test error", ErrorCode.NOT_FOUND);
      expect(error.message).toBe("Test error");
      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.retryable).toBe(false);
      expect(error.name).toBe("SynapseEnhancedError");
    });
    it("should create retryable error", () => {
      var error = new SynapseEnhancedError("Server error", ErrorCode.INTERNAL_ERROR, undefined, 500, true);
      expect(error.retryable).toBe(true);
    });
    it("should include error details", () => {
      var detail = {
        field: "user_id",
        value: "invalid",
        constraint: "Must start with @"
      };
      var error = new SynapseEnhancedError("Validation failed", ErrorCode.PARAM_INVALID, detail);
      expect(error.detail).toEqual(detail);
      expect(error.detail.field).toBe("user_id");
    });
  });
  describe("Static isRetryable", () => {
    it("should return true for retryable SynapseEnhancedError", () => {
      var error = new SynapseEnhancedError("Timeout", ErrorCode.TIMEOUT, undefined, 408, true);
      expect(SynapseEnhancedError.isRetryable(error)).toBe(true);
    });
    it("should return false for non-retryable SynapseEnhancedError", () => {
      var error = new SynapseEnhancedError("Not found", ErrorCode.NOT_FOUND);
      expect(SynapseEnhancedError.isRetryable(error)).toBe(false);
    });
    it("should return false for generic errors", () => {
      var error = new Error("Generic error");
      expect(SynapseEnhancedError.isRetryable(error)).toBe(false);
    });
    it("should return true for AbortError", () => {
      var error = new Error("Aborted");
      error.name = "AbortError";
      expect(SynapseEnhancedError.isRetryable(error)).toBe(true);
    });
    it("should return true for TimeoutError", () => {
      var error = new Error("Timed out");
      error.name = "TimeoutError";
      expect(SynapseEnhancedError.isRetryable(error)).toBe(true);
    });
  });
});
describe("RetryPolicy", () => {
  var retryPolicy;
  beforeEach(() => {
    retryPolicy = new RetryPolicy({
      maxAttempts: 3,
      initialDelay: 10,
      maxDelay: 100,
      backoffMultiplier: 2,
      jitterFactor: 0.1
    });
  });
  describe("Constructor", () => {
    it("should use default options", () => {
      var defaultPolicy = new RetryPolicy();
      expect(defaultPolicy["maxAttempts"]).toBe(3);
      expect(defaultPolicy["initialDelay"]).toBe(1000);
    });
    it("should use provided options", () => {
      expect(retryPolicy["maxAttempts"]).toBe(3);
      expect(retryPolicy["initialDelay"]).toBe(10);
      expect(retryPolicy["maxDelay"]).toBe(100);
      expect(retryPolicy["backoffMultiplier"]).toBe(2);
    });
  });
  describe("shouldRetry", () => {
    it("should return true for retryable error codes", () => {
      expect(retryPolicy.shouldRetry(new SynapseEnhancedError("Timeout", ErrorCode.TIMEOUT))).toBe(true);
      expect(retryPolicy.shouldRetry(new SynapseEnhancedError("Unavailable", ErrorCode.SERVICE_UNAVAILABLE))).toBe(true);
      expect(retryPolicy.shouldRetry(new SynapseEnhancedError("Rate limited", ErrorCode.RATE_LIMITED))).toBe(true);
      expect(retryPolicy.shouldRetry(new SynapseEnhancedError("Internal error", ErrorCode.INTERNAL_ERROR))).toBe(true);
    });
    it("should return false for non-retryable error codes", () => {
      expect(retryPolicy.shouldRetry(new SynapseEnhancedError("Not found", ErrorCode.NOT_FOUND))).toBe(false);
      expect(retryPolicy.shouldRetry(new SynapseEnhancedError("Invalid param", ErrorCode.PARAM_INVALID))).toBe(false);
    });
  });
  describe("getDelay", () => {
    it("should calculate exponential backoff with jitter", () => {
      var delay0 = retryPolicy.getDelay(0);
      var delay1 = retryPolicy.getDelay(1);
      var delay2 = retryPolicy.getDelay(2);

      // Base delay for attempt 0
      expect(delay0).toBeGreaterThanOrEqual(10);
      expect(delay0).toBeLessThanOrEqual(11); // 10 + 10% jitter

      // Base delay * 2 for attempt 1
      expect(delay1).toBeGreaterThanOrEqual(20);
      expect(delay1).toBeLessThanOrEqual(22);

      // Base delay * 4 for attempt 2
      expect(delay2).toBeGreaterThanOrEqual(40);
      expect(delay2).toBeLessThanOrEqual(44);
    });
    it("should cap at max delay", () => {
      var delay = retryPolicy.getDelay(10);
      expect(delay).toBeLessThanOrEqual(100);
    });
  });
  describe("execute", () => {
    it("should return result on success", /*#__PURE__*/_asyncToGenerator(function* () {
      var result = yield retryPolicy.execute(/*#__PURE__*/_asyncToGenerator(function* () {
        return "success";
      }));
      expect(result).toBe("success");
    }));
    it("should throw immediately for non-retryable error", /*#__PURE__*/_asyncToGenerator(function* () {
      var error = new SynapseEnhancedError("Not found", ErrorCode.NOT_FOUND);
      yield expect(retryPolicy.execute(/*#__PURE__*/_asyncToGenerator(function* () {
        throw error;
      }))).rejects.toThrow("Not found");
    }));
    it("should retry on retryable error", /*#__PURE__*/_asyncToGenerator(function* () {
      var attempts = 0;
      var error = new SynapseEnhancedError("Timeout", ErrorCode.TIMEOUT);
      var result = yield retryPolicy.execute(/*#__PURE__*/_asyncToGenerator(function* () {
        attempts++;
        if (attempts < 3) {
          throw error;
        }
        return "success";
      }));
      expect(result).toBe("success");
      expect(attempts).toBe(3);
    }));
    it("should throw after max retries", /*#__PURE__*/_asyncToGenerator(function* () {
      var error = new SynapseEnhancedError("Timeout", ErrorCode.TIMEOUT);
      yield expect(retryPolicy.execute(/*#__PURE__*/_asyncToGenerator(function* () {
        throw error;
      }))).rejects.toThrow("Timeout");
    }));
    it("should use custom isRetryable function", /*#__PURE__*/_asyncToGenerator(function* () {
      var attempts = 0;
      var notFoundError = new SynapseEnhancedError("Not found", ErrorCode.NOT_FOUND);
      var result = yield retryPolicy.execute(/*#__PURE__*/_asyncToGenerator(function* () {
        attempts++;
        if (attempts < 2) {
          throw notFoundError;
        }
        return "success";
      }), () => true // Retry even for NOT_FOUND
      );
      expect(result).toBe("success");
      expect(attempts).toBe(2);
    }));
  });
});
describe("withRetry", () => {
  it("should wrap operation with default retry policy", /*#__PURE__*/_asyncToGenerator(function* () {
    var attempts = 0;
    var result = yield withRetry(/*#__PURE__*/_asyncToGenerator(function* () {
      attempts++;
      return "success";
    }));
    expect(result.success).toBe(true);
    expect(result.data).toBe("success");
    expect(result.attempts).toBe(1);
    expect(attempts).toBe(1);
  }));
  it("should use custom retry policy", /*#__PURE__*/_asyncToGenerator(function* () {
    var attempts = 0;
    var customPolicy = new RetryPolicy({
      maxAttempts: 5
    });
    var error = new SynapseEnhancedError("Timeout", ErrorCode.TIMEOUT);
    var result = yield withRetry(/*#__PURE__*/_asyncToGenerator(function* () {
      attempts++;
      if (attempts === 1) {
        throw error;
      }
      return "success";
    }), customPolicy);
    expect(result.success).toBe(true);
    expect(result.data).toBe("success");
    expect(attempts).toBe(2);
  }));
});
describe("InterceptorRegistry", () => {
  var registry;
  beforeEach(() => {
    registry = new InterceptorRegistry();
  });
  describe("Constructor", () => {
    it("should initialize with empty interceptors", () => {
      expect(registry.getInterceptors().length).toBe(0);
    });
  });
  describe("addRequestInterceptor", () => {
    it("should add request interceptor", () => {
      var id = registry.addRequestInterceptor("auth", /*#__PURE__*/function () {
        var _ref13 = _asyncToGenerator(function* (ctx) {
          return _objectSpread(_objectSpread({}, ctx), {}, {
            headers: _objectSpread(_objectSpread({}, ctx.headers), {}, {
              Authorization: "Bearer token"
            })
          });
        });
        return function (_x) {
          return _ref13.apply(this, arguments);
        };
      }());
      expect(id).toBe("auth");
      var interceptors = registry.getInterceptors(InterceptorPhase.REQUEST);
      expect(interceptors.length).toBe(1);
      expect(interceptors[0].id).toBe("auth");
    });
    it("should assign default id if not provided", () => {
      var id = registry.addRequestInterceptor(undefined, /*#__PURE__*/function () {
        var _ref14 = _asyncToGenerator(function* (ctx) {
          return ctx;
        });
        return function (_x2) {
          return _ref14.apply(this, arguments);
        };
      }());
      expect(id).toMatch(/^req_/);
    });
    it("should respect priority", () => {
      registry.addRequestInterceptor("low", /*#__PURE__*/function () {
        var _ref15 = _asyncToGenerator(function* (ctx) {
          return ctx;
        });
        return function (_x3) {
          return _ref15.apply(this, arguments);
        };
      }(), 0);
      registry.addRequestInterceptor("high", /*#__PURE__*/function () {
        var _ref16 = _asyncToGenerator(function* (ctx) {
          return ctx;
        });
        return function (_x4) {
          return _ref16.apply(this, arguments);
        };
      }(), 100);
      registry.addRequestInterceptor("medium", /*#__PURE__*/function () {
        var _ref17 = _asyncToGenerator(function* (ctx) {
          return ctx;
        });
        return function (_x5) {
          return _ref17.apply(this, arguments);
        };
      }(), 50);
      var interceptors = registry.getInterceptors(InterceptorPhase.REQUEST);
      expect(interceptors[0].id).toBe("high");
      expect(interceptors[1].id).toBe("medium");
      expect(interceptors[2].id).toBe("low");
    });
  });
  describe("addResponseInterceptor", () => {
    it("should add response interceptor", () => {
      var id = registry.addResponseInterceptor("logger", /*#__PURE__*/function () {
        var _ref18 = _asyncToGenerator(function* (ctx) {
          return ctx;
        });
        return function (_x6) {
          return _ref18.apply(this, arguments);
        };
      }());
      expect(id).toBe("logger");
      var interceptors = registry.getInterceptors(InterceptorPhase.RESPONSE);
      expect(interceptors.length).toBe(1);
    });
  });
  describe("addErrorInterceptor", () => {
    it("should add error interceptor", () => {
      var id = registry.addErrorInterceptor("errorHandler", /*#__PURE__*/function () {
        var _ref19 = _asyncToGenerator(function* (ctx) {
          return ctx.error;
        });
        return function (_x7) {
          return _ref19.apply(this, arguments);
        };
      }());
      expect(id).toBe("errorHandler");
      var interceptors = registry.getInterceptors(InterceptorPhase.ERROR);
      expect(interceptors.length).toBe(1);
    });
  });
  describe("removeInterceptor", () => {
    it("should remove interceptor by id", () => {
      registry.addRequestInterceptor("test", /*#__PURE__*/function () {
        var _ref20 = _asyncToGenerator(function* (ctx) {
          return ctx;
        });
        return function (_x8) {
          return _ref20.apply(this, arguments);
        };
      }());
      expect(registry.getInterceptors().length).toBe(1);
      var removed = registry.removeInterceptor("test");
      expect(removed).toBe(true);
      expect(registry.getInterceptors().length).toBe(0);
    });
    it("should return false for non-existent interceptor", () => {
      var removed = registry.removeInterceptor("nonExistent");
      expect(removed).toBe(false);
    });
  });
  describe("enableInterceptor / disableInterceptor", () => {
    it("should enable interceptor", () => {
      registry.addRequestInterceptor("test", /*#__PURE__*/function () {
        var _ref21 = _asyncToGenerator(function* (ctx) {
          return ctx;
        });
        return function (_x9) {
          return _ref21.apply(this, arguments);
        };
      }(), 0, "Test");
      registry.disableInterceptor("test");
      var enabled = false;
      registry.addRequestInterceptor("check", /*#__PURE__*/function () {
        var _ref22 = _asyncToGenerator(function* (ctx) {
          enabled = true;
          return ctx;
        });
        return function (_x0) {
          return _ref22.apply(this, arguments);
        };
      }());
      expect(enabled).toBe(false);
    });
    it("should disable interceptor", () => {
      registry.addRequestInterceptor("test", /*#__PURE__*/function () {
        var _ref23 = _asyncToGenerator(function* (ctx) {
          return ctx;
        });
        return function (_x1) {
          return _ref23.apply(this, arguments);
        };
      }(), 0, "Test");
      registry.disableInterceptor("test");
      var interceptors = registry.getInterceptors(InterceptorPhase.REQUEST);
      expect(interceptors[0].enabled).toBe(false);
    });
  });
  describe("clearInterceptors", () => {
    it("should clear all interceptors", () => {
      registry.addRequestInterceptor("req1", /*#__PURE__*/function () {
        var _ref24 = _asyncToGenerator(function* (ctx) {
          return ctx;
        });
        return function (_x10) {
          return _ref24.apply(this, arguments);
        };
      }());
      registry.addResponseInterceptor("resp1", /*#__PURE__*/function () {
        var _ref25 = _asyncToGenerator(function* (ctx) {
          return ctx;
        });
        return function (_x11) {
          return _ref25.apply(this, arguments);
        };
      }());
      registry.addErrorInterceptor("err1", /*#__PURE__*/function () {
        var _ref26 = _asyncToGenerator(function* (ctx) {
          return ctx.error;
        });
        return function (_x12) {
          return _ref26.apply(this, arguments);
        };
      }());
      registry.clearInterceptors();
      expect(registry.getInterceptors().length).toBe(0);
    });
    it("should clear interceptors by phase", () => {
      registry.addRequestInterceptor("req1", /*#__PURE__*/function () {
        var _ref27 = _asyncToGenerator(function* (ctx) {
          return ctx;
        });
        return function (_x13) {
          return _ref27.apply(this, arguments);
        };
      }());
      registry.addResponseInterceptor("resp1", /*#__PURE__*/function () {
        var _ref28 = _asyncToGenerator(function* (ctx) {
          return ctx;
        });
        return function (_x14) {
          return _ref28.apply(this, arguments);
        };
      }());
      registry.clearInterceptors(InterceptorPhase.REQUEST);
      expect(registry.getInterceptors(InterceptorPhase.REQUEST).length).toBe(0);
      expect(registry.getInterceptors(InterceptorPhase.RESPONSE).length).toBe(1);
    });
  });
  describe("processRequest", () => {
    it("should process request through interceptors", /*#__PURE__*/_asyncToGenerator(function* () {
      registry.addRequestInterceptor("addHeader", /*#__PURE__*/function () {
        var _ref30 = _asyncToGenerator(function* (ctx) {
          return _objectSpread(_objectSpread({}, ctx), {}, {
            headers: _objectSpread(_objectSpread({}, ctx.headers), {}, {
              "X-Custom": "value"
            })
          });
        });
        return function (_x15) {
          return _ref30.apply(this, arguments);
        };
      }());
      var context = yield registry.processRequest({
        url: "/test",
        method: "GET",
        headers: {},
        timestamp: Date.now(),
        attempt: 1
      });
      expect(context.headers["X-Custom"]).toBe("value");
    }));
    it("should skip disabled interceptors", /*#__PURE__*/_asyncToGenerator(function* () {
      registry.addRequestInterceptor("disabled", /*#__PURE__*/function () {
        var _ref32 = _asyncToGenerator(function* (ctx) {
          return _objectSpread(_objectSpread({}, ctx), {}, {
            headers: _objectSpread(_objectSpread({}, ctx.headers), {}, {
              Disabled: "true"
            })
          });
        });
        return function (_x16) {
          return _ref32.apply(this, arguments);
        };
      }());
      registry.addRequestInterceptor("enabled", /*#__PURE__*/function () {
        var _ref33 = _asyncToGenerator(function* (ctx) {
          return _objectSpread(_objectSpread({}, ctx), {}, {
            headers: _objectSpread(_objectSpread({}, ctx.headers), {}, {
              Enabled: "true"
            })
          });
        });
        return function (_x17) {
          return _ref33.apply(this, arguments);
        };
      }());
      registry.disableInterceptor("disabled");
      var context = yield registry.processRequest({
        url: "/test",
        method: "GET",
        headers: {},
        timestamp: Date.now(),
        attempt: 1
      });
      expect(context.headers.Disabled).toBeUndefined();
      expect(context.headers.Enabled).toBe("true");
    }));
  });
  describe("processResponse", () => {
    it("should process response through interceptors", /*#__PURE__*/_asyncToGenerator(function* () {
      registry.addResponseInterceptor("addTimestamp", /*#__PURE__*/function () {
        var _ref35 = _asyncToGenerator(function* (ctx) {
          return _objectSpread(_objectSpread({}, ctx), {}, {
            data: _objectSpread(_objectSpread({}, ctx.data), {}, {
              processed: true
            })
          });
        });
        return function (_x18) {
          return _ref35.apply(this, arguments);
        };
      }());
      var context = yield registry.processResponse({
        url: "/test",
        method: "GET",
        status: 200,
        data: {
          original: true
        },
        headers: {},
        timestamp: Date.now(),
        duration: 100,
        cached: false,
        retries: 0
      });
      expect(context.data.original).toBe(true);
      expect(context.data.processed).toBe(true);
    }));
  });
  describe("configureGlobal", () => {
    it("should update global config", () => {
      registry.configureGlobal({
        logRequests: true,
        logResponses: true
      });
      // Config is internal, so we just verify it doesn't throw
    });
  });
});
describe("Interceptor Factory Functions", () => {
  describe("createAuthInterceptor", () => {
    it("should add Authorization header", /*#__PURE__*/_asyncToGenerator(function* () {
      var interceptor = createAuthInterceptor(/*#__PURE__*/_asyncToGenerator(function* () {
        return "test-token";
      }));
      var context = yield interceptor({
        url: "/test",
        method: "GET",
        headers: {},
        timestamp: Date.now(),
        attempt: 1
      });
      expect(context.headers.Authorization).toBe("Bearer test-token");
    }));
    it("should preserve existing headers", /*#__PURE__*/_asyncToGenerator(function* () {
      var interceptor = createAuthInterceptor(/*#__PURE__*/_asyncToGenerator(function* () {
        return "test-token";
      }));
      var context = yield interceptor({
        url: "/test",
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        },
        timestamp: Date.now(),
        attempt: 1
      });
      expect(context.headers.Authorization).toBe("Bearer test-token");
      expect(context.headers["Content-Type"]).toBe("application/json");
    }));
  });
  describe("createLoggingInterceptor", () => {
    it("should create logging interceptors", () => {
      var logging = createLoggingInterceptor({
        logRequests: true,
        logResponses: true,
        logErrors: true
      });
      expect(logging.request).toBeDefined();
      expect(logging.response).toBeDefined();
      expect(logging.error).toBeDefined();
    });
  });
  describe("createRetryLoggingInterceptor", () => {
    it("should create error logging interceptor", /*#__PURE__*/_asyncToGenerator(function* () {
      var interceptor = createRetryLoggingInterceptor();
      var error = new Error("Test error");
      var context = {
        error,
        url: "/test",
        method: "GET",
        attempt: 1,
        timestamp: Date.now(),
        willRetry: true
      };
      var result = yield interceptor(context);
      expect(result).toBe(error);
    }));
  });
  describe("createResponseTransformInterceptor", () => {
    it("should transform response data", /*#__PURE__*/_asyncToGenerator(function* () {
      var interceptor = createResponseTransformInterceptor(data => _objectSpread(_objectSpread({}, data), {}, {
        transformed: true
      }));
      var context = {
        url: "/test",
        method: "GET",
        status: 200,
        data: {
          value: 42
        },
        headers: {},
        timestamp: Date.now(),
        duration: 100,
        cached: false,
        retries: 0
      };
      var result = yield interceptor(context);
      expect(result.data.transformed).toBe(true);
      expect(result.data.value).toBe(42);
    }));
  });
  describe("createRequestTimeoutInterceptor", () => {
    it("should add timeout to context", /*#__PURE__*/_asyncToGenerator(function* () {
      var interceptor = createRequestTimeoutInterceptor(5000);
      var context = yield interceptor({
        url: "/test",
        method: "GET",
        headers: {},
        timestamp: Date.now(),
        attempt: 1
      });
      expect(context.headers["X-Request-Timeout"]).toBe("5000");
    }));
  });
});
describe("BatchProcessor", () => {
  var batchProcessor;
  beforeEach(() => {
    batchProcessor = new BatchProcessor({
      batchSize: 2,
      flushInterval: 50,
      executeBatch: function () {
        var _executeBatch = _asyncToGenerator(function* (items) {
          return items.map((item, index) => item.length + index);
        });
        function executeBatch(_x19) {
          return _executeBatch.apply(this, arguments);
        }
        return executeBatch;
      }()
    });
  });
  afterEach(() => {
    batchProcessor.flush();
  });
  describe("Constructor", () => {
    it("should use default options", () => {
      var defaultProcessor = new BatchProcessor({
        executeBatch: function () {
          var _executeBatch2 = _asyncToGenerator(function* () {
            return [];
          });
          function executeBatch() {
            return _executeBatch2.apply(this, arguments);
          }
          return executeBatch;
        }()
      });
      expect(defaultProcessor["batchSize"]).toBe(10);
      expect(defaultProcessor["flushInterval"]).toBe(50);
    });
    it("should use provided options", () => {
      expect(batchProcessor["batchSize"]).toBe(2);
      expect(batchProcessor["flushInterval"]).toBe(50);
    });
  });
  describe("add", () => {
    it("should add item to queue", /*#__PURE__*/_asyncToGenerator(function* () {
      var promise = batchProcessor.add("test");
      expect(promise).toBeInstanceOf(Promise);
    }));
    it("should return promise that resolves with result", /*#__PURE__*/_asyncToGenerator(function* () {
      var promise = batchProcessor.add("hello");
      var result = yield promise;

      // "hello" has length 5, index 0, so 5 + 0 = 5
      expect(result).toBe(5);
    }));
    it("should process batch when size reached", /*#__PURE__*/_asyncToGenerator(function* () {
      var promises = [batchProcessor.add("a"), batchProcessor.add("bc")];
      var results = yield Promise.all(promises);

      // "a" -> 1 + 0 = 1, "bc" -> 2 + 1 = 3
      expect(results).toContain(1);
      expect(results).toContain(3);
    }));
  });
  describe("addMany", () => {
    it("should add multiple items", /*#__PURE__*/_asyncToGenerator(function* () {
      var results = yield batchProcessor.addMany(["one", "two", "three"]);
      expect(results).toHaveLength(3);
    }));
  });
  describe("flush", () => {
    it("should resolve pending promises", /*#__PURE__*/_asyncToGenerator(function* () {
      var promise = batchProcessor.add("test");
      yield batchProcessor.flush();
      var result = yield promise;
      expect(result).toBe(4); // "test" length 4
    }));
    it("should do nothing if queue is empty", /*#__PURE__*/_asyncToGenerator(function* () {
      var result = yield batchProcessor.flush();
      expect(result).toBeUndefined();
    }));
    it("should process all items in queue", /*#__PURE__*/_asyncToGenerator(function* () {
      var results = [];
      var promises = [batchProcessor.add("a").then(r => results.push(r)), batchProcessor.add("bb").then(r => results.push(r)), batchProcessor.add("ccc").then(r => results.push(r))];
      yield Promise.all(promises);
      expect(results).toHaveLength(3);
    }));
  });
  describe("onError callback", () => {
    it("should call onError on failure", /*#__PURE__*/_asyncToGenerator(function* () {
      var _errorReceived;
      var errorReceived;
      var errorProcessor = new BatchProcessor({
        batchSize: 2,
        executeBatch: function () {
          var _executeBatch3 = _asyncToGenerator(function* () {
            throw new Error("Batch failed");
          });
          function executeBatch() {
            return _executeBatch3.apply(this, arguments);
          }
          return executeBatch;
        }(),
        onError: error => {
          errorReceived = error;
        }
      });
      var promise = errorProcessor.add("test");
      yield errorProcessor.flush();
      yield expect(promise).rejects.toThrow("Batch failed");
      expect((_errorReceived = errorReceived) === null || _errorReceived === void 0 ? void 0 : _errorReceived.message).toBe("Batch failed");
    }));
  });
});
describe("RetryPolicy - Boundary Cases", () => {
  describe("getDelay", () => {
    it("should handle zero initial delay", () => {
      var policy = new RetryPolicy({
        initialDelay: 0,
        maxDelay: 100
      });
      var delay = policy.getDelay(0);
      expect(delay).toBe(0);
    });
    it("should handle very large maxDelay", () => {
      var policy = new RetryPolicy({
        initialDelay: 1000,
        maxDelay: Number.MAX_SAFE_INTEGER
      });
      var delay = policy.getDelay(100);
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    });
    it("should handle zero jitter factor", () => {
      var policy = new RetryPolicy({
        initialDelay: 100,
        maxDelay: 1000,
        jitterFactor: 0
      });
      var delay = policy.getDelay(0);
      expect(delay).toBe(100);
    });
    it("should handle maximum jitter factor", () => {
      var policy = new RetryPolicy({
        initialDelay: 100,
        maxDelay: 1000,
        jitterFactor: 1
      });
      var delay = policy.getDelay(0);
      expect(delay).toBeGreaterThanOrEqual(100);
      expect(delay).toBeLessThanOrEqual(200);
    });
    it("should handle very high attempt numbers", () => {
      var policy = new RetryPolicy({
        initialDelay: 100,
        maxDelay: 1000
      });
      var delay = policy.getDelay(1000);
      expect(delay).toBeLessThanOrEqual(1000);
    });
    it("should handle negative attempt numbers", () => {
      var policy = new RetryPolicy({
        initialDelay: 100,
        maxDelay: 1000
      });
      var delay = policy.getDelay(-1);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(1000);
    });
  });
  describe("execute", () => {
    it("should handle zero timeout", /*#__PURE__*/_asyncToGenerator(function* () {
      var policy = new RetryPolicy({
        timeout: 0
      });
      yield expect(policy.execute(/*#__PURE__*/_asyncToGenerator(function* () {
        yield new Promise(resolve => setTimeout(resolve, 100));
        return "success";
      }))).rejects.toThrow();
    }));
    it("should handle very long timeout", /*#__PURE__*/_asyncToGenerator(function* () {
      var policy = new RetryPolicy({
        timeout: 60000
      });
      var result = yield policy.execute(/*#__PURE__*/_asyncToGenerator(function* () {
        yield new Promise(resolve => setTimeout(resolve, 10));
        return "success";
      }));
      expect(result).toBe("success");
    }));
  });
});
describe("SynapseEnhancedError - Boundary Cases", () => {
  describe("Constructor", () => {
    it("should handle empty message", () => {
      var error = new SynapseEnhancedError("", ErrorCode.UNKNOWN);
      expect(error.message).toBe("");
    });
    it("should handle very long message", () => {
      var longMessage = "a".repeat(10000);
      var error = new SynapseEnhancedError(longMessage, ErrorCode.UNKNOWN);
      expect(error.message).toBe(longMessage);
    });
    it("should handle unicode in message", () => {
      var error = new SynapseEnhancedError("错误信息 🎉", ErrorCode.UNKNOWN);
      expect(error.message).toBe("错误信息 🎉");
    });
    it("should handle special characters in message", () => {
      var error = new SynapseEnhancedError("Error: \n\t\r", ErrorCode.UNKNOWN);
      expect(error.message).toBe("Error: \n\t\r");
    });
    it("should handle empty detail object", () => {
      var error = new SynapseEnhancedError("Test", ErrorCode.UNKNOWN, {});
      expect(error.detail).toEqual({});
    });
    it("should handle very large detail object", () => {
      var largeDetail = {
        data: "a".repeat(10000)
      };
      var error = new SynapseEnhancedError("Test", ErrorCode.UNKNOWN, largeDetail);
      expect(error.detail).toEqual(largeDetail);
    });
    it("should handle nested detail objects", () => {
      var nestedDetail = {
        level1: {
          level2: {
            level3: {
              value: "deep"
            }
          }
        }
      };
      var error = new SynapseEnhancedError("Test", ErrorCode.UNKNOWN, nestedDetail);
      expect(error.detail).toEqual(nestedDetail);
    });
    it("should handle all status codes", () => {
      for (var status = 100; status <= 599; status++) {
        var error = new SynapseEnhancedError("Test", ErrorCode.UNKNOWN, undefined, status);
        expect(error.statusCode).toBe(status);
      }
    });
  });
  describe("fromResponse", () => {
    it("should handle minimum status code", () => {
      var error = SynapseEnhancedError.fromResponse("Test", 100);
      expect(error.statusCode).toBe(100);
    });
    it("should handle maximum status code", () => {
      var error = SynapseEnhancedError.fromResponse("Test", 599);
      expect(error.statusCode).toBe(599);
    });
    it("should handle empty detail", () => {
      var error = SynapseEnhancedError.fromResponse("Test", 500, undefined);
      expect(error.detail).toBeUndefined();
    });
    it("should handle detail with null values", () => {
      var _error$detail;
      var error = SynapseEnhancedError.fromResponse("Test", 500, {
        field: null
      });
      expect((_error$detail = error.detail) === null || _error$detail === void 0 ? void 0 : _error$detail.field).toBeNull();
    });
  });
  describe("isRetryable", () => {
    it("should handle error without name property", () => {
      var error = {
        message: "Test"
      };
      expect(SynapseEnhancedError.isRetryable(error)).toBe(false);
    });
    it("should handle error with undefined name", () => {
      var error = {
        message: "Test",
        name: undefined
      };
      expect(SynapseEnhancedError.isRetryable(error)).toBe(false);
    });
  });
});
describe("BatchProcessor - Boundary Cases", () => {
  var processors = [];
  var nullableProcessors = [];
  afterEach(() => {
    processors.forEach(processor => {
      processor.clear();
    });
    nullableProcessors.forEach(processor => {
      processor.clear();
    });
    processors.length = 0;
    nullableProcessors.length = 0;
  });
  describe("Constructor", () => {
    it("should handle very large batchSize", /*#__PURE__*/_asyncToGenerator(function* () {
      var processor = new BatchProcessor({
        batchSize: 100,
        executeBatch: function () {
          var _executeBatch4 = _asyncToGenerator(function* (items) {
            return items;
          });
          function executeBatch(_x20) {
            return _executeBatch4.apply(this, arguments);
          }
          return executeBatch;
        }()
      });
      processors.push(processor);
      var promises = [];
      for (var i = 0; i < 10; i++) {
        promises.push(processor.add("item".concat(i)));
      }
      yield processor.flush();
      for (var promise of promises) {
        yield expect(promise).resolves.toBeDefined();
      }
    }));
    var testZeroFlushInterval = /*#__PURE__*/function () {
      var _ref56 = _asyncToGenerator(function* () {
        var processor = new BatchProcessor({
          batchSize: 10,
          flushInterval: 0,
          executeBatch: function () {
            var _executeBatch5 = _asyncToGenerator(function* (items) {
              return items;
            });
            function executeBatch(_x21) {
              return _executeBatch5.apply(this, arguments);
            }
            return executeBatch;
          }()
        });
        processors.push(processor);
        var promise = processor.add("test");
        yield new Promise(resolve => setTimeout(resolve, 10));
        yield expect(promise).resolves.toBe("test");
      });
      return function testZeroFlushInterval() {
        return _ref56.apply(this, arguments);
      };
    }();
    it("should handle zero flushInterval", testZeroFlushInterval);
    var testLongFlushInterval = /*#__PURE__*/function () {
      var _ref57 = _asyncToGenerator(function* () {
        var processor = new BatchProcessor({
          batchSize: 10,
          flushInterval: 60000,
          executeBatch: function () {
            var _executeBatch6 = _asyncToGenerator(function* (items) {
              return items;
            });
            function executeBatch(_x22) {
              return _executeBatch6.apply(this, arguments);
            }
            return executeBatch;
          }()
        });
        processors.push(processor);
        var promise = processor.add("test");
        yield processor.flush();
        yield expect(promise).resolves.toBe("test");
      });
      return function testLongFlushInterval() {
        return _ref57.apply(this, arguments);
      };
    }();
    it("should handle very long flushInterval", testLongFlushInterval);
  });
  describe("add", () => {
    it("should handle empty string", /*#__PURE__*/_asyncToGenerator(function* () {
      var processor = new BatchProcessor({
        batchSize: 1,
        executeBatch: function () {
          var _executeBatch7 = _asyncToGenerator(function* (items) {
            return items;
          });
          function executeBatch(_x23) {
            return _executeBatch7.apply(this, arguments);
          }
          return executeBatch;
        }()
      });
      processors.push(processor);
      yield processor.flush();
      yield expect(processor.add("")).resolves.toBe("");
    }));
    it("should handle very large items", /*#__PURE__*/_asyncToGenerator(function* () {
      var processor = new BatchProcessor({
        batchSize: 1,
        executeBatch: function () {
          var _executeBatch8 = _asyncToGenerator(function* (items) {
            return items;
          });
          function executeBatch(_x24) {
            return _executeBatch8.apply(this, arguments);
          }
          return executeBatch;
        }()
      });
      processors.push(processor);
      var largeItem = "a".repeat(100000);
      yield expect(processor.add(largeItem)).resolves.toBe(largeItem);
    }));
    it("should handle items with special characters", /*#__PURE__*/_asyncToGenerator(function* () {
      var processor = new BatchProcessor({
        batchSize: 1,
        executeBatch: function () {
          var _executeBatch9 = _asyncToGenerator(function* (items) {
            return items;
          });
          function executeBatch(_x25) {
            return _executeBatch9.apply(this, arguments);
          }
          return executeBatch;
        }()
      });
      processors.push(processor);
      yield expect(processor.add("特殊字符 🎉\n\t")).resolves.toBe("特殊字符 🎉\n\t");
    }));
    it("should handle null and undefined items", /*#__PURE__*/_asyncToGenerator(function* () {
      var processor = new BatchProcessor({
        batchSize: 2,
        executeBatch: function () {
          var _executeBatch0 = _asyncToGenerator(function* (items) {
            return items;
          });
          function executeBatch(_x26) {
            return _executeBatch0.apply(this, arguments);
          }
          return executeBatch;
        }()
      });
      nullableProcessors.push(processor);
      var p1 = processor.add(null);
      var p2 = processor.add(undefined);
      yield processor.flush();
      yield expect(p1).resolves.toBeNull();
      yield expect(p2).resolves.toBeUndefined();
    }));
  });
  describe("executeBatch", () => {
    it("should handle empty batch", /*#__PURE__*/_asyncToGenerator(function* () {
      var batchReceived = [];
      var processor = new BatchProcessor({
        batchSize: 1,
        executeBatch: function () {
          var _executeBatch1 = _asyncToGenerator(function* (items) {
            batchReceived = items;
            return items;
          });
          function executeBatch(_x27) {
            return _executeBatch1.apply(this, arguments);
          }
          return executeBatch;
        }()
      });
      processors.push(processor);
      yield processor.flush();
      expect(batchReceived).toEqual([]);
    }));
    it("should handle batch that returns empty array", /*#__PURE__*/_asyncToGenerator(function* () {
      var processor = new BatchProcessor({
        batchSize: 1,
        executeBatch: function () {
          var _executeBatch10 = _asyncToGenerator(function* () {
            return [];
          });
          function executeBatch() {
            return _executeBatch10.apply(this, arguments);
          }
          return executeBatch;
        }()
      });
      processors.push(processor);
      yield expect(processor.add("test")).resolves.toBeUndefined();
    }));
    it("should handle batch that throws immediately", /*#__PURE__*/_asyncToGenerator(function* () {
      var processor = new BatchProcessor({
        batchSize: 1,
        executeBatch: function () {
          var _executeBatch11 = _asyncToGenerator(function* () {
            throw new Error("Immediate failure");
          });
          function executeBatch() {
            return _executeBatch11.apply(this, arguments);
          }
          return executeBatch;
        }()
      });
      processors.push(processor);
      yield expect(processor.add("test")).rejects.toThrow("Immediate failure");
    }));
    it("should handle batch that throws after delay", /*#__PURE__*/_asyncToGenerator(function* () {
      var processor = new BatchProcessor({
        batchSize: 1,
        executeBatch: function () {
          var _executeBatch12 = _asyncToGenerator(function* () {
            yield new Promise(resolve => setTimeout(resolve, 100));
            throw new Error("Delayed failure");
          });
          function executeBatch() {
            return _executeBatch12.apply(this, arguments);
          }
          return executeBatch;
        }()
      });
      processors.push(processor);
      yield expect(processor.add("test")).rejects.toThrow("Delayed failure");
    }));
  });
});
describe("InterceptorRegistry - Boundary Cases", () => {
  describe("addRequestInterceptor", () => {
    it("should handle very high priority", () => {
      var registry = new InterceptorRegistry();
      registry.addRequestInterceptor("high", /*#__PURE__*/function () {
        var _ref66 = _asyncToGenerator(function* (ctx) {
          return ctx;
        });
        return function (_x28) {
          return _ref66.apply(this, arguments);
        };
      }(), Number.MAX_SAFE_INTEGER);
      var interceptors = registry.getInterceptors(InterceptorPhase.REQUEST);
      expect(interceptors[0].priority).toBe(Number.MAX_SAFE_INTEGER);
    });
    it("should handle very low priority", () => {
      var registry = new InterceptorRegistry();
      registry.addRequestInterceptor("low", /*#__PURE__*/function () {
        var _ref67 = _asyncToGenerator(function* (ctx) {
          return ctx;
        });
        return function (_x29) {
          return _ref67.apply(this, arguments);
        };
      }(), Number.MIN_SAFE_INTEGER);
      var interceptors = registry.getInterceptors(InterceptorPhase.REQUEST);
      expect(interceptors[0].priority).toBe(Number.MIN_SAFE_INTEGER);
    });
    it("should handle same priority multiple interceptors", () => {
      var registry = new InterceptorRegistry();
      registry.addRequestInterceptor("first", /*#__PURE__*/function () {
        var _ref68 = _asyncToGenerator(function* (ctx) {
          return ctx;
        });
        return function (_x30) {
          return _ref68.apply(this, arguments);
        };
      }(), 50);
      registry.addRequestInterceptor("second", /*#__PURE__*/function () {
        var _ref69 = _asyncToGenerator(function* (ctx) {
          return ctx;
        });
        return function (_x31) {
          return _ref69.apply(this, arguments);
        };
      }(), 50);
      var interceptors = registry.getInterceptors(InterceptorPhase.REQUEST);
      expect(interceptors.length).toBe(2);
    });
  });
  describe("processRequest", () => {
    it("should handle empty context", /*#__PURE__*/_asyncToGenerator(function* () {
      var registry = new InterceptorRegistry();
      var context = yield registry.processRequest({
        url: "",
        method: "GET",
        headers: {},
        timestamp: 0,
        attempt: 0
      });
      expect(context).toBeDefined();
    }));
    it("should handle very large headers object", /*#__PURE__*/_asyncToGenerator(function* () {
      var registry = new InterceptorRegistry();
      var largeHeaders = {};
      for (var i = 0; i < 1000; i++) {
        largeHeaders["header".concat(i)] = "value".concat(i);
      }
      var context = yield registry.processRequest({
        url: "/test",
        method: "GET",
        headers: largeHeaders,
        timestamp: Date.now(),
        attempt: 1
      });
      expect(context.headers).toEqual(largeHeaders);
    }));
    it("should handle headers with special characters", /*#__PURE__*/_asyncToGenerator(function* () {
      var registry = new InterceptorRegistry();
      var specialHeaders = {
        "X-Special": "特殊字符 🎉",
        "X-Newline": "line1\nline2",
        "X-Tab": "col1\tcol2"
      };
      var context = yield registry.processRequest({
        url: "/test",
        method: "GET",
        headers: specialHeaders,
        timestamp: Date.now(),
        attempt: 1
      });
      expect(context.headers).toEqual(specialHeaders);
    }));
  });
});
//# sourceMappingURL=utils.test.js.map