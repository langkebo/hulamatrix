import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
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
function getSecureRandom() {
  var array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] / (0xffffffff + 1);
}
export class RetryPolicy {
  /**
   * Creates a new retry policy instance
   */
  constructor(maxAttemptsOrOptions, initialDelay, maxDelay, timeout) {
    _defineProperty(this, "maxAttempts", void 0);
    _defineProperty(this, "initialDelay", void 0);
    _defineProperty(this, "maxDelay", void 0);
    _defineProperty(this, "backoffMultiplier", void 0);
    _defineProperty(this, "jitterFactor", void 0);
    _defineProperty(this, "timeout", void 0);
    if (typeof maxAttemptsOrOptions === "number") {
      this.maxAttempts = maxAttemptsOrOptions !== null && maxAttemptsOrOptions !== void 0 ? maxAttemptsOrOptions : 3;
      this.initialDelay = initialDelay !== null && initialDelay !== void 0 ? initialDelay : 1000;
      this.maxDelay = maxDelay !== null && maxDelay !== void 0 ? maxDelay : 30000;
      this.backoffMultiplier = 2;
      this.jitterFactor = 0.1;
      this.timeout = timeout !== null && timeout !== void 0 ? timeout : 30000;
    } else {
      var _options$maxAttempts, _options$initialDelay, _options$maxDelay, _options$backoffMulti, _options$jitterFactor, _options$timeout;
      var _options = maxAttemptsOrOptions !== null && maxAttemptsOrOptions !== void 0 ? maxAttemptsOrOptions : {};
      this.maxAttempts = (_options$maxAttempts = _options.maxAttempts) !== null && _options$maxAttempts !== void 0 ? _options$maxAttempts : 3;
      this.initialDelay = (_options$initialDelay = _options.initialDelay) !== null && _options$initialDelay !== void 0 ? _options$initialDelay : 1000;
      this.maxDelay = (_options$maxDelay = _options.maxDelay) !== null && _options$maxDelay !== void 0 ? _options$maxDelay : 30000;
      this.backoffMultiplier = (_options$backoffMulti = _options.backoffMultiplier) !== null && _options$backoffMulti !== void 0 ? _options$backoffMulti : 2;
      this.jitterFactor = (_options$jitterFactor = _options.jitterFactor) !== null && _options$jitterFactor !== void 0 ? _options$jitterFactor : 0.1;
      this.timeout = (_options$timeout = _options.timeout) !== null && _options$timeout !== void 0 ? _options$timeout : 30000;
    }
  }
  shouldRetry(error) {
    return error.retryable;
  }
  getDelay(attempt) {
    var delay = Math.min(this.initialDelay * Math.pow(this.backoffMultiplier, attempt), this.maxDelay);
    var jitter = delay * this.jitterFactor * getSecureRandom();
    return Math.min(delay + jitter, this.maxDelay);
  }
  execute(operation, isRetryable) {
    var _this = this;
    return _asyncToGenerator(function* () {
      var lastError = null;
      for (var attempt = 0; attempt < _this.maxAttempts; attempt++) {
        try {
          return yield _this.withTimeout(operation());
        } catch (error) {
          if (!(error instanceof SynapseEnhancedError)) {
            throw error;
          }
          var retryable = isRetryable ? isRetryable(error) : _this.shouldRetry(error);
          if (!retryable || attempt === _this.maxAttempts - 1) {
            throw error;
          }
          lastError = error;
          yield _this.delay(attempt);
        }
      }
      throw lastError;
    })();
  }

  /**
   * Wraps a promise with a timeout mechanism
   * @param promise - The promise to wrap
   * @returns Promise that rejects if timeout is exceeded
   */
  withTimeout(promise) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      return new Promise((resolve, reject) => {
        var timer = setTimeout(() => {
          reject(new SynapseEnhancedError("Request timed out", ErrorCode.TIMEOUT));
        }, _this2.timeout);
        promise.then(resolve, reject).finally(() => {
          clearTimeout(timer);
        });
      });
    })();
  }

  /**
   * Calculates delay for a specific retry attempt using exponential backoff with jitter
   * @param attempt - Current attempt number (0-indexed)
   * @returns Delay in milliseconds before next retry
   */
  delay(attempt) {
    return new Promise(resolve => setTimeout(resolve, this.getDelay(attempt)));
  }
}
export function isRetryableError(error) {
  if (error instanceof SynapseEnhancedError) {
    return error.retryable;
  }
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      return true;
    }
  }
  return false;
}
export function withRetry(_x, _x2, _x3) {
  return _withRetry.apply(this, arguments);
}
function _withRetry() {
  _withRetry = _asyncToGenerator(function* (operation, policy, signal) {
    var actualPolicy = policy !== null && policy !== void 0 ? policy : new RetryPolicy();
    var attempts = 0;
    var lastError;
    var _loop = function* _loop(attempt) {
        attempts++;
        if (signal !== null && signal !== void 0 && signal.aborted) {
          return {
            v: {
              success: false,
              attempts,
              error: new SynapseEnhancedError("Request cancelled", ErrorCode.CANCELLED)
            }
          };
        }
        try {
          var data = yield operation();
          return {
            v: {
              success: true,
              data,
              attempts
            }
          };
        } catch (error) {
          if (error instanceof SynapseEnhancedError) {
            lastError = error;
            if (!actualPolicy.shouldRetry(error) || attempt === actualPolicy["maxAttempts"] - 1) {
              return {
                v: {
                  success: false,
                  attempts,
                  error
                }
              };
            }
            yield new Promise(resolve => setTimeout(resolve, actualPolicy.getDelay(attempt)));
          } else {
            return {
              v: {
                success: false,
                attempts,
                error: new SynapseEnhancedError(error instanceof Error ? error.message : "Unknown error", ErrorCode.UNKNOWN)
              }
            };
          }
        }
      },
      _ret;
    for (var attempt = 0; attempt < actualPolicy["maxAttempts"]; attempt++) {
      _ret = yield* _loop(attempt);
      if (_ret) return _ret.v;
    }
    return {
      success: false,
      attempts,
      error: lastError !== null && lastError !== void 0 ? lastError : new SynapseEnhancedError("Max retries exceeded", ErrorCode.TIMEOUT)
    };
  });
  return _withRetry.apply(this, arguments);
}
//# sourceMappingURL=retry.js.map