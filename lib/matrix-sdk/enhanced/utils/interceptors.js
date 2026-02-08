import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
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

import { logger } from "../../logger.js";
var log = logger.getChild("enhanced:interceptors");
export var InterceptorPhase = /*#__PURE__*/function (InterceptorPhase) {
  InterceptorPhase["REQUEST"] = "request";
  InterceptorPhase["RESPONSE"] = "response";
  InterceptorPhase["ERROR"] = "error";
  return InterceptorPhase;
}({});
/**
 * Generate a secure identifier with sufficient entropy
 * Uses 16 bytes (128 bits) of cryptographically secure random data
 * @param prefix - A prefix for the identifier (e.g., 'req', 'res', 'err')
 * @returns A secure identifier string
 */
function generateSecureId(prefix) {
  var timestamp = Date.now().toString(36);
  // Increase from 4 bytes (32 bits) to 16 bytes (128 bits) for better security
  var array = new Uint8Array(16);
  crypto.getRandomValues(array);
  var randomPart = Array.from(array, b => b.toString(16).padStart(2, "0")).join("");
  return "".concat(prefix, "_").concat(timestamp, "_").concat(randomPart);
}
export class InterceptorRegistry {
  constructor() {
    _defineProperty(this, "requestInterceptors", void 0);
    _defineProperty(this, "responseInterceptors", void 0);
    _defineProperty(this, "errorInterceptors", void 0);
    _defineProperty(this, "globalConfig", void 0);
    _defineProperty(this, "sortedRequestChain", void 0);
    _defineProperty(this, "sortedResponseChain", void 0);
    _defineProperty(this, "sortedErrorChain", void 0);
    this.requestInterceptors = new Map();
    this.responseInterceptors = new Map();
    this.errorInterceptors = new Map();
    this.globalConfig = {
      logRequests: false,
      logResponses: false,
      logErrors: true,
      transformErrors: true
    };
  }
  addRequestInterceptor(id, handler) {
    var priority = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
    var name = arguments.length > 3 ? arguments[3] : undefined;
    var interceptorId = id || generateSecureId("req");
    this.requestInterceptors.set(interceptorId, {
      id: interceptorId,
      name: name || interceptorId,
      phase: InterceptorPhase.REQUEST,
      priority,
      enabled: true,
      handler
    });
    this.rebuildRequestChain();
    return interceptorId;
  }
  addResponseInterceptor(id, handler) {
    var priority = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
    var name = arguments.length > 3 ? arguments[3] : undefined;
    var interceptorId = id || generateSecureId("resp");
    this.responseInterceptors.set(interceptorId, {
      id: interceptorId,
      name: name || interceptorId,
      phase: InterceptorPhase.RESPONSE,
      priority,
      enabled: true,
      handler
    });
    this.rebuildResponseChain();
    return interceptorId;
  }
  addErrorInterceptor(id, handler) {
    var priority = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
    var name = arguments.length > 3 ? arguments[3] : undefined;
    var interceptorId = id || generateSecureId("err");
    this.errorInterceptors.set(interceptorId, {
      id: interceptorId,
      name: name || interceptorId,
      phase: InterceptorPhase.ERROR,
      priority,
      enabled: true,
      handler
    });
    this.rebuildErrorChain();
    return interceptorId;
  }
  removeInterceptor(id) {
    return this.requestInterceptors.delete(id) || this.responseInterceptors.delete(id) || this.errorInterceptors.delete(id);
  }
  enableInterceptor(id) {
    var interceptor = this.requestInterceptors.get(id) || this.responseInterceptors.get(id) || this.errorInterceptors.get(id);
    if (interceptor) {
      interceptor.enabled = true;
      this.rebuildRequestChain();
      this.rebuildResponseChain();
      this.rebuildErrorChain();
      return true;
    }
    return false;
  }
  disableInterceptor(id) {
    var interceptor = this.requestInterceptors.get(id) || this.responseInterceptors.get(id) || this.errorInterceptors.get(id);
    if (interceptor) {
      interceptor.enabled = false;
      this.rebuildRequestChain();
      this.rebuildResponseChain();
      this.rebuildErrorChain();
      return true;
    }
    return false;
  }
  getInterceptors(phase) {
    var result = [];
    if (!phase || phase === InterceptorPhase.REQUEST) {
      for (var interceptor of Array.from(this.requestInterceptors.values())) {
        result.push(interceptor);
      }
    }
    if (!phase || phase === InterceptorPhase.RESPONSE) {
      for (var _interceptor of Array.from(this.responseInterceptors.values())) {
        result.push(_interceptor);
      }
    }
    if (!phase || phase === InterceptorPhase.ERROR) {
      for (var _interceptor2 of Array.from(this.errorInterceptors.values())) {
        result.push(_interceptor2);
      }
    }
    return result.sort((a, b) => b.priority - a.priority);
  }
  clearInterceptors(phase) {
    if (!phase || phase === InterceptorPhase.REQUEST) {
      this.requestInterceptors.clear();
    }
    if (!phase || phase === InterceptorPhase.RESPONSE) {
      this.responseInterceptors.clear();
    }
    if (!phase || phase === InterceptorPhase.ERROR) {
      this.errorInterceptors.clear();
    }
  }
  configureGlobal(config) {
    this.globalConfig = _objectSpread(_objectSpread({}, this.globalConfig), config);
  }
  rebuildRequestChain() {
    var sorted = Array.from(this.requestInterceptors.values()).filter(i => i.enabled).sort((a, b) => b.priority - a.priority);
    this["sortedRequestChain"] = sorted;
  }
  rebuildResponseChain() {
    var sorted = Array.from(this.responseInterceptors.values()).filter(i => i.enabled).sort((a, b) => b.priority - a.priority);
    this["sortedResponseChain"] = sorted;
  }
  rebuildErrorChain() {
    var sorted = Array.from(this.errorInterceptors.values()).filter(i => i.enabled).sort((a, b) => b.priority - a.priority);
    this["sortedErrorChain"] = sorted;
  }
  processRequest(context) {
    var _this = this;
    return _asyncToGenerator(function* () {
      var currentContext = _objectSpread({}, context);
      var chain = _this.sortedRequestChain || Array.from(_this.requestInterceptors.values()).filter(i => i.enabled).sort((a, b) => b.priority - a.priority);
      for (var interceptor of chain) {
        try {
          var result = yield interceptor.handler(currentContext);
          if (result !== undefined && result !== null) {
            currentContext = result;
          }
        } catch (error) {
          if (_this.globalConfig.logErrors) {
            log.error("Request interceptor \"".concat(interceptor.name, "\" failed:"), error);
          }
        }
      }
      if (_this.globalConfig.logRequests) {
        log.debug("[Interceptor] Request:", {
          url: currentContext.url,
          method: currentContext.method,
          attempt: currentContext.attempt
        });
      }
      return currentContext;
    })();
  }
  processResponse(context) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var currentContext = _objectSpread({}, context);
      var chain = _this2.sortedResponseChain || Array.from(_this2.responseInterceptors.values()).filter(i => i.enabled).sort((a, b) => b.priority - a.priority);
      for (var interceptor of chain) {
        try {
          var result = yield interceptor.handler(currentContext);
          if (result !== undefined && result !== null) {
            currentContext = result;
          }
        } catch (error) {
          if (_this2.globalConfig.logErrors) {
            log.error("Response interceptor \"".concat(interceptor.name, "\" failed:"), error);
          }
        }
      }
      if (_this2.globalConfig.logResponses) {
        log.debug("[Interceptor] Response:", {
          url: currentContext.url,
          status: currentContext.status,
          duration: currentContext.duration,
          cached: currentContext.cached
        });
      }
      return currentContext;
    })();
  }
  processError(context) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var currentError = context.error;
      var chain = _this3.sortedErrorChain || Array.from(_this3.errorInterceptors.values()).filter(i => i.enabled).sort((a, b) => b.priority - a.priority);
      for (var interceptor of chain) {
        try {
          var result = yield interceptor.handler(context);
          if (result !== undefined && result !== null) {
            currentError = result;
            context.error = result;
          }
        } catch (error) {
          if (_this3.globalConfig.logErrors) {
            log.error("Error interceptor \"".concat(interceptor.name, "\" failed:"), error);
          }
        }
      }
      if (_this3.globalConfig.logErrors) {
        log.debug("[Interceptor] Error:", {
          error: currentError.message,
          url: context.url,
          method: context.method,
          attempt: context.attempt,
          willRetry: context.willRetry
        });
      }
      return currentError;
    })();
  }
}
export function createAuthInterceptor(accessTokenProvider) {
  return /*#__PURE__*/function () {
    var _ref = _asyncToGenerator(function* (context) {
      var token = yield accessTokenProvider();
      return _objectSpread(_objectSpread({}, context), {}, {
        headers: _objectSpread(_objectSpread({}, context.headers), {}, {
          Authorization: "Bearer ".concat(token)
        })
      });
    });
    return function (_x) {
      return _ref.apply(this, arguments);
    };
  }();
}
export function createLoggingInterceptor(options) {
  var sanitizeHeaders = (options === null || options === void 0 ? void 0 : options.sanitizeHeaders) || ["Authorization", "Cookie"];
  var request = /*#__PURE__*/function () {
    var _ref2 = _asyncToGenerator(function* (context) {
      var sanitizedHeaders = _objectSpread({}, context.headers);
      for (var header of sanitizeHeaders) {
        if (sanitizedHeaders[header]) {
          sanitizedHeaders[header] = "[REDACTED]";
        }
      }
      log.debug("[Request]", {
        url: context.url,
        method: context.method,
        headers: sanitizedHeaders,
        body: context.body,
        attempt: context.attempt
      });
      return context;
    });
    return function request(_x2) {
      return _ref2.apply(this, arguments);
    };
  }();
  var response = /*#__PURE__*/function () {
    var _ref3 = _asyncToGenerator(function* (context) {
      log.debug("[Response]", {
        url: context.url,
        status: context.status,
        duration: "".concat(context.duration, "ms"),
        cached: context.cached
      });
      return context;
    });
    return function response(_x3) {
      return _ref3.apply(this, arguments);
    };
  }();
  var error = /*#__PURE__*/function () {
    var _ref4 = _asyncToGenerator(function* (context) {
      log.error("[Error]", {
        error: context.error.message,
        url: context.url,
        method: context.method,
        attempt: context.attempt,
        willRetry: context.willRetry
      });
      return context.error;
    });
    return function error(_x4) {
      return _ref4.apply(this, arguments);
    };
  }();
  return {
    request,
    response,
    error
  };
}
export function createRetryLoggingInterceptor() {
  return /*#__PURE__*/function () {
    var _ref5 = _asyncToGenerator(function* (context) {
      if (context.attempt > 1) {
        log.warn("[Retry] Attempt ".concat(context.attempt, " for ").concat(context.method, " ").concat(context.url));
      }
      return context.error;
    });
    return function (_x5) {
      return _ref5.apply(this, arguments);
    };
  }();
}
export function createResponseTransformInterceptor(transform) {
  return /*#__PURE__*/function () {
    var _ref6 = _asyncToGenerator(function* (context) {
      if (context.data && typeof context.data === "object") {
        var transformed = transform(context.data, context);
        return _objectSpread(_objectSpread({}, context), {}, {
          data: transformed
        });
      }
      return context;
    });
    return function (_x6) {
      return _ref6.apply(this, arguments);
    };
  }();
}
export function createRequestTimeoutInterceptor(maxTimeout) {
  return /*#__PURE__*/function () {
    var _ref7 = _asyncToGenerator(function* (context) {
      return _objectSpread(_objectSpread({}, context), {}, {
        headers: _objectSpread(_objectSpread({}, context.headers), {}, {
          "X-Request-Timeout": maxTimeout.toString()
        }),
        timestamp: Date.now()
      });
    });
    return function (_x7) {
      return _ref7.apply(this, arguments);
    };
  }();
}
export var defaultInterceptors = {
  createAuthInterceptor,
  createLoggingInterceptor,
  createRetryLoggingInterceptor,
  createResponseTransformInterceptor,
  createRequestTimeoutInterceptor
};
//# sourceMappingURL=interceptors.js.map