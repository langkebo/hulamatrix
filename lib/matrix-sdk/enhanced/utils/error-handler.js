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

import { SynapseEnhancedError } from "./http.js";
import { ErrorCode } from "./error-codes.js";
export var ErrorAction = /*#__PURE__*/function (ErrorAction) {
  ErrorAction["RETRY"] = "retry";
  ErrorAction["REFRESH_TOKEN"] = "refresh_token";
  ErrorAction["WAIT_RETRY"] = "wait_retry";
  ErrorAction["REJECT"] = "reject";
  ErrorAction["NOTIFY"] = "notify";
  return ErrorAction;
}({});
export class ErrorHandler {
  static handleError(error, context, config) {
    var _this$ERROR_COUNT$get;
    var key = "".concat(context.method, ":").concat(context.endpoint);
    var currentCount = (_this$ERROR_COUNT$get = this.ERROR_COUNT.get(key)) !== null && _this$ERROR_COUNT$get !== void 0 ? _this$ERROR_COUNT$get : 0;
    var strategy = this.getStrategy(error.code);
    if (error.statusCode >= 400 && error.statusCode < 500) {
      if (error.statusCode === 401) {
        this.ERROR_COUNT.set(key, currentCount + 1);
        this.LAST_ERROR_TIME.set(key, Date.now());
        return {
          action: ErrorAction.REFRESH_TOKEN,
          message: "Authentication required"
        };
      }
      if (error.statusCode === 403) {
        return {
          action: ErrorAction.REJECT,
          message: "Access denied"
        };
      }
      if (error.statusCode === 429) {
        var _config$defaultWaitTi;
        var waitTime = this.calculateBackoff(currentCount, (_config$defaultWaitTi = config === null || config === void 0 ? void 0 : config.defaultWaitTime) !== null && _config$defaultWaitTi !== void 0 ? _config$defaultWaitTi : 1000);
        this.ERROR_COUNT.set(key, currentCount + 1);
        return {
          action: ErrorAction.WAIT_RETRY,
          retryAfter: waitTime,
          message: "Rate limit exceeded"
        };
      }
      return {
        action: ErrorAction.REJECT,
        message: error.message
      };
    }
    if (error.statusCode >= 500) {
      var _config$maxRetries, _strategy$retryAfter;
      this.ERROR_COUNT.set(key, currentCount + 1);
      this.LAST_ERROR_TIME.set(key, Date.now());
      if (context.attemptNumber >= ((_config$maxRetries = config === null || config === void 0 ? void 0 : config.maxRetries) !== null && _config$maxRetries !== void 0 ? _config$maxRetries : 3)) {
        return {
          action: ErrorAction.REJECT,
          message: "Max retries exceeded for ".concat(context.endpoint)
        };
      }
      return _objectSpread(_objectSpread({}, strategy), {}, {
        retryAfter: (_strategy$retryAfter = strategy.retryAfter) !== null && _strategy$retryAfter !== void 0 ? _strategy$retryAfter : this.calculateBackoff(context.attemptNumber)
      });
    }
    return strategy;
  }
  static getStrategy(errorCode) {
    var _this$ERROR_STRATEGIE;
    return (_this$ERROR_STRATEGIE = this.ERROR_STRATEGIES.get(errorCode)) !== null && _this$ERROR_STRATEGIE !== void 0 ? _this$ERROR_STRATEGIE : {
      action: ErrorAction.RETRY
    };
  }
  static registerStrategy(errorCode, strategy) {
    this.ERROR_STRATEGIES.set(errorCode, strategy);
  }
  static shouldRetry(error) {
    return error.retryable || error.statusCode >= 500;
  }
  static executeWithRetry(fn, context, config) {
    var _this = this;
    return _asyncToGenerator(function* () {
      var attempt = 0;
      var lastError = null;
      while (attempt <= ((_config$maxRetries2 = config === null || config === void 0 ? void 0 : config.maxRetries) !== null && _config$maxRetries2 !== void 0 ? _config$maxRetries2 : 3)) {
        var _config$maxRetries2;
        try {
          return yield fn();
        } catch (error) {
          if (error instanceof SynapseEnhancedError) {
            lastError = error;
            var handling = _this.handleError(error, _objectSpread(_objectSpread({}, context), {}, {
              attemptNumber: attempt,
              timestamp: Date.now()
            }), config);
            if (handling.action === ErrorAction.REJECT) {
              throw error;
            }
            if (handling.action === ErrorAction.REFRESH_TOKEN) {
              throw error;
            }
            if (handling.action === ErrorAction.WAIT_RETRY && handling.retryAfter) {
              yield _this.sleep(handling.retryAfter);
            }
          } else {
            throw error;
          }
        }
        attempt++;
      }
      throw lastError;
    })();
  }
  static resetErrorCount(endpoint, method) {
    var key = "".concat(method, ":").concat(endpoint);
    this.ERROR_COUNT.delete(key);
    this.LAST_ERROR_TIME.delete(key);
  }
  static resetAllErrorCounts() {
    this.ERROR_COUNT.clear();
    this.LAST_ERROR_TIME.clear();
  }
  static getErrorStats() {
    var stats = new Map();
    for (var [key, count] of this.ERROR_COUNT.entries()) {
      stats.set(key, {
        count,
        lastError: this.LAST_ERROR_TIME.get(key)
      });
    }
    return stats;
  }
  static calculateBackoff(attemptNumber) {
    var baseDelay = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1000;
    var exponentialDelay = baseDelay * Math.pow(2, attemptNumber);
    var jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, 30000);
  }
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  static createUserError(message) {
    var code = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ErrorCode.UNKNOWN;
    return new SynapseEnhancedError(message, code, undefined, 400, false);
  }
  static createServerError(message) {
    return new SynapseEnhancedError(message, ErrorCode.INTERNAL_ERROR, undefined, 500, true);
  }
  static createNetworkError(originalError) {
    var _originalError$messag;
    return new SynapseEnhancedError((_originalError$messag = originalError === null || originalError === void 0 ? void 0 : originalError.message) !== null && _originalError$messag !== void 0 ? _originalError$messag : "Network error occurred", ErrorCode.NET_ERROR, {
      originalError: String(originalError)
    }, 0, true);
  }
  static wrapError(error, context) {
    if (error instanceof SynapseEnhancedError) {
      return error;
    }
    if (error instanceof Error) {
      return new SynapseEnhancedError(context ? "".concat(context, ": ").concat(error.message) : error.message, ErrorCode.UNKNOWN, {
        stack: error.stack
      }, 0, false);
    }
    return new SynapseEnhancedError(context !== null && context !== void 0 ? context : "Unknown error", ErrorCode.UNKNOWN, {
      error: String(error)
    }, 0, false);
  }
}
_defineProperty(ErrorHandler, "ERROR_STRATEGIES", new Map([[ErrorCode.UNKNOWN_TOKEN, {
  action: ErrorAction.REFRESH_TOKEN,
  message: "Token expired or invalid"
}], [ErrorCode.INVALID_PARAM, {
  action: ErrorAction.REJECT,
  message: "Invalid request parameters"
}], [ErrorCode.FORBIDDEN, {
  action: ErrorAction.REJECT,
  message: "Access forbidden"
}], [ErrorCode.NOT_FOUND, {
  action: ErrorAction.REJECT,
  message: "Resource not found"
}], [ErrorCode.RATE_LIMITED, {
  action: ErrorAction.WAIT_RETRY,
  retryAfter: 1000,
  message: "Rate limited"
}], [ErrorCode.LIMIT_EXCEEDED, {
  action: ErrorAction.WAIT_RETRY,
  retryAfter: 2000,
  message: "Limit exceeded"
}], [ErrorCode.THROTTLED, {
  action: ErrorAction.WAIT_RETRY,
  retryAfter: 1500,
  message: "Throttled"
}], [ErrorCode.TIMEOUT, {
  action: ErrorAction.RETRY,
  message: "Request timed out"
}], [ErrorCode.NET_ERROR, {
  action: ErrorAction.RETRY,
  message: "Network error"
}], [ErrorCode.UNAVAILABLE, {
  action: ErrorAction.WAIT_RETRY,
  retryAfter: 3000,
  message: "Service unavailable"
}], [ErrorCode.SERVICE_UNAVAILABLE, {
  action: ErrorAction.WAIT_RETRY,
  retryAfter: 3000,
  message: "Service unavailable"
}], [ErrorCode.INTERNAL_ERROR, {
  action: ErrorAction.RETRY,
  message: "Internal server error"
}]]));
_defineProperty(ErrorHandler, "ERROR_COUNT", new Map());
_defineProperty(ErrorHandler, "LAST_ERROR_TIME", new Map());
//# sourceMappingURL=error-handler.js.map