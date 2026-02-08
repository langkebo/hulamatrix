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

import { ErrorCode, getErrorCodeFromStatus } from "./error-codes.js";
import { TokenManager, createAuthHeaders } from "./token-manager.js";
import { createMemoryCache } from "./lru-cache.js";
import { mapPath } from "./api-mapping.js";
export { ErrorCode };
export class SynapseEnhancedError extends Error {
  constructor(message) {
    var code = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ErrorCode.UNKNOWN;
    var detail = arguments.length > 2 ? arguments[2] : undefined;
    var statusCode = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 500;
    var retryable = arguments.length > 4 ? arguments[4] : undefined;
    super(message);
    _defineProperty(this, "code", void 0);
    _defineProperty(this, "detail", void 0);
    _defineProperty(this, "statusCode", void 0);
    _defineProperty(this, "retryable", void 0);
    this.name = "SynapseEnhancedError";
    this.code = code;
    this.detail = detail;
    this.statusCode = statusCode;
    this.retryable = retryable !== null && retryable !== void 0 ? retryable : SynapseEnhancedError.RETRYABLE_CODES.has(code);
  }
  static fromResponse(message, statusCode, detail) {
    var code = getErrorCodeFromStatus(statusCode);
    var retryable = statusCode >= 500 || statusCode === 429;
    return new SynapseEnhancedError(message, code, detail, statusCode, retryable);
  }
  static isRetryable(error) {
    if (error instanceof SynapseEnhancedError) {
      return error.retryable;
    }
    return error.name === "AbortError" || error.name === "TimeoutError";
  }
}
_defineProperty(SynapseEnhancedError, "RETRYABLE_CODES", new Set([ErrorCode.TIMEOUT, ErrorCode.SERVICE_UNAVAILABLE, ErrorCode.RATE_LIMITED, ErrorCode.INTERNAL_ERROR, ErrorCode.NET_ERROR, ErrorCode.UNAVAILABLE, ErrorCode.LIMIT_EXCEEDED, ErrorCode.THROTTLED]));
export class SynapseEnhancedHttpClient {
  constructor(options) {
    var _options$timeout, _options$maxRetries, _options$retryDelay, _options$cacheSize, _options$cacheMemoryM, _options$cacheTTL;
    _defineProperty(this, "baseUrl", void 0);
    _defineProperty(this, "tokenManager", void 0);
    _defineProperty(this, "apiPrefix", void 0);
    _defineProperty(this, "timeout", void 0);
    _defineProperty(this, "maxRetries", void 0);
    _defineProperty(this, "retryDelay", void 0);
    _defineProperty(this, "cache", void 0);
    _defineProperty(this, "pendingRequests", void 0);
    _defineProperty(this, "stats", {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retries: 0,
      totalResponseTime: 0
    });
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.tokenManager = new TokenManager({
      accessToken: options.accessToken,
      refreshToken: options.refreshToken,
      expiresAt: options.tokenExpiresAt
    });
    this.apiPrefix = options.apiPrefix || "/_synapse/client";
    this.timeout = (_options$timeout = options.timeout) !== null && _options$timeout !== void 0 ? _options$timeout : 30000;
    this.maxRetries = (_options$maxRetries = options.maxRetries) !== null && _options$maxRetries !== void 0 ? _options$maxRetries : 3;
    this.retryDelay = (_options$retryDelay = options.retryDelay) !== null && _options$retryDelay !== void 0 ? _options$retryDelay : 1000;
    this.cache = createMemoryCache({
      max: (_options$cacheSize = options.cacheSize) !== null && _options$cacheSize !== void 0 ? _options$cacheSize : 500,
      maxMemoryMB: (_options$cacheMemoryM = options.cacheMemoryMB) !== null && _options$cacheMemoryM !== void 0 ? _options$cacheMemoryM : 50,
      defaultTTL: (_options$cacheTTL = options.cacheTTL) !== null && _options$cacheTTL !== void 0 ? _options$cacheTTL : 5 * 60 * 1000
    });
    this.pendingRequests = new Map();
  }
  updateToken(accessToken, refreshToken, expiresAt) {
    this.tokenManager = new TokenManager({
      accessToken,
      refreshToken: refreshToken !== null && refreshToken !== void 0 ? refreshToken : this.tokenManager.refreshToken,
      expiresAt: expiresAt !== null && expiresAt !== void 0 ? expiresAt : this.tokenManager.expiresAt
    });
  }
  setTokenRefreshCallback(callback) {
    this.tokenManager = this.tokenManager.clone(callback);
  }
  buildUrl(endpoint, queryParams) {
    // Apply path mapping based on backend profile
    var mappedEndpoint = mapPath(endpoint);
    var url;
    // If endpoint starts with /_matrix or /_synapse, it's a full path
    if (mappedEndpoint.startsWith("/_matrix") || mappedEndpoint.startsWith("/_synapse")) {
      url = "".concat(this.baseUrl).concat(mappedEndpoint);
    } else {
      url = "".concat(this.baseUrl).concat(this.apiPrefix).concat(mappedEndpoint);
    }
    if (queryParams) {
      var params = new URLSearchParams();
      for (var [_key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== null) {
          var stringValue = this.valueToString(value);
          params.append(_key, stringValue);
        }
      }
      var queryString = params.toString();
      if (queryString) {
        url += "?".concat(queryString);
      }
    }
    return url;
  }
  valueToString(value) {
    if (value == null) {
      return "";
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(value);
  }
  getHeaders(extraHeaders) {
    var headers = createAuthHeaders(this.tokenManager);
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");
    if (extraHeaders) {
      for (var [_key2, value] of Object.entries(extraHeaders)) {
        headers.set(_key2, value);
      }
    }
    return headers;
  }
  request(endpoint) {
    var _arguments = arguments,
      _this = this;
    return _asyncToGenerator(function* () {
      var options = _arguments.length > 1 && _arguments[1] !== undefined ? _arguments[1] : {};
      var {
        method = "GET"
      } = options;
      var cacheKey = _this.getCacheKey(endpoint, options);

      // Check cache for GET requests
      if (method === "GET") {
        var cached = _this.cache.get(cacheKey);
        if (cached !== undefined) {
          _this.stats.cacheHits++;
          return {
            data: cached,
            status: 200
          };
        }
        _this.stats.cacheMisses++;
      }

      // Request deduplication with proper cleanup
      var existingRequest = _this.pendingRequests.get(cacheKey);
      if (existingRequest) {
        return existingRequest;
      }
      var requestPromise = _this.executeRequest(endpoint, options, cacheKey);
      var cleanupPromise = requestPromise.finally(() => {
        _this.pendingRequests.delete(cacheKey);
      });
      _this.pendingRequests.set(cacheKey, cleanupPromise);
      return requestPromise;
    })();
  }
  executeRequest(endpoint, options, cacheKey) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var {
        method = "GET"
      } = options;
      var lastError = null;
      var _loop = function* _loop() {
          try {
            var result = yield _this2.fetchRequest(endpoint, options);

            // Cache successful GET requests
            if (method === "GET" && result.status < 300) {
              _this2.cache.set(cacheKey, result.data);
            }
            return {
              v: result
            };
          } catch (error) {
            lastError = error instanceof SynapseEnhancedError ? error : new SynapseEnhancedError(String(error) || "Unknown error", ErrorCode.UNKNOWN, undefined, 0);

            // Don't retry on client errors (4xx) or last attempt
            if (lastError.statusCode >= 400 && lastError.statusCode < 500) {
              throw lastError;
            }
            if (attempt < _this2.maxRetries) {
              _this2.stats.retries++;
              var delay = _this2.retryDelay * Math.pow(2, attempt);
              yield new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        },
        _ret;
      for (var attempt = 0; attempt <= _this2.maxRetries; attempt++) {
        _ret = yield* _loop();
        if (_ret) return _ret.v;
      }
      throw lastError;
    })();
  }
  fetchRequest(endpoint, options) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var {
        method = "GET",
        body,
        queryParams,
        headers,
        responseType = "json",
        timeout
      } = options;
      var url = _this3.buildUrl(endpoint, queryParams);
      var requestHeaders = _this3.getHeaders(headers);
      var controller = new AbortController();
      var timeoutMs = timeout !== null && timeout !== void 0 ? timeout : _this3.timeout;
      var timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      var startTime = Date.now();
      _this3.stats.totalRequests++;
      try {
        var fetchOptions = {
          method,
          headers: requestHeaders,
          signal: controller.signal
        };
        if (body && method !== "GET") {
          if (body instanceof FormData) {
            fetchOptions.body = body;
            requestHeaders.delete("Content-Type");
          } else {
            fetchOptions.body = JSON.stringify(body);
          }
        }
        var response = yield fetch(url, fetchOptions);
        var duration = Date.now() - startTime;
        _this3.stats.totalResponseTime += duration;
        var contentType = response.headers.get("content-type") || "";
        var data;
        if (responseType === "blob") {
          data = yield response.blob();
        } else if (contentType.includes("application/json")) {
          data = yield response.json();
        } else {
          data = yield response.text();
        }
        if (!response.ok) {
          _this3.stats.failedRequests++;
          var errorData = {};
          if (contentType.includes("application/json") && typeof data === "object" && data !== null) {
            errorData = data;
          }

          // Map Matrix error codes to our error codes
          var errorCode = errorData.error || _this3.getErrorCode(response.status);
          var message = errorData.message || errorData.error || "Unknown error";
          throw new SynapseEnhancedError(message, errorCode, errorData.detail, response.status);
        }
        _this3.stats.successfulRequests++;
        return {
          data,
          status: response.status
        };
      } catch (error) {
        _this3.stats.failedRequests++;
        if (error instanceof SynapseEnhancedError) {
          throw error;
        }
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new SynapseEnhancedError("Request timeout after ".concat(timeoutMs, "ms"), ErrorCode.TIMEOUT, {
            timeout: timeoutMs
          }, 504);
        }
        if (error instanceof TypeError) {
          throw new SynapseEnhancedError("Network error", ErrorCode.NET_ERROR, {
            originalError: String(error)
          }, 0);
        }
        throw new SynapseEnhancedError(String(error) || "Unknown error", ErrorCode.UNKNOWN, undefined, 0);
      } finally {
        // Always clear the timeout to prevent memory leaks
        clearTimeout(timeoutId);
      }
    })();
  }
  getErrorCode(status) {
    var errorCodeMap = {
      400: ErrorCode.INVALID_PARAM,
      401: ErrorCode.UNKNOWN_TOKEN,
      403: ErrorCode.FORBIDDEN,
      404: ErrorCode.NOT_FOUND,
      429: ErrorCode.LIMIT_EXCEEDED,
      500: ErrorCode.INTERNAL_ERROR,
      503: ErrorCode.UNAVAILABLE
    };
    return errorCodeMap[status] || ErrorCode.UNKNOWN;
  }
  get(endpoint, queryParams) {
    return this.request(endpoint, {
      method: "GET",
      queryParams: queryParams
    });
  }
  post(endpoint, body, queryParams) {
    return this.request(endpoint, {
      method: "POST",
      body,
      queryParams
    });
  }
  put(endpoint, body, queryParams) {
    return this.request(endpoint, {
      method: "PUT",
      body,
      queryParams
    });
  }
  delete(endpoint, queryParams) {
    return this.request(endpoint, {
      method: "DELETE",
      queryParams
    });
  }
  upload(endpoint, body) {
    return this.request(endpoint, {
      method: "POST",
      body,
      headers: {},
      responseType: "json"
    });
  }
  getStats() {
    var cacheStats = this.cache.getStats();
    return {
      requests: this.stats.totalRequests,
      errors: this.stats.failedRequests,
      totalRequests: this.stats.totalRequests,
      cacheHits: cacheStats.hitCount,
      cacheMisses: cacheStats.missCount,
      cacheHitRate: cacheStats.hitRate,
      successfulRequests: this.stats.successfulRequests,
      failedRequests: this.stats.failedRequests,
      retries: this.stats.retries,
      averageResponseTime: this.stats.successfulRequests > 0 ? this.stats.totalResponseTime / this.stats.successfulRequests : 0
    };
  }
  clearCache() {
    this.cache.clear();
    this.stats.cacheHits = 0;
    this.stats.cacheMisses = 0;
  }
  setDefaultCacheTTL(ttl) {
    if (ttl <= 0) {
      throw new SynapseEnhancedError("Cache TTL must be a positive number", ErrorCode.INVALID_PARAM);
    }
  }
  invalidateCache(endpoint) {
    var method = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "GET";
    return this.cache.invalidateByPrefix("".concat(method, ":").concat(endpoint));
  }
  getCacheSize() {
    return this.cache.size;
  }

  /**
   * Generate a simple hash from a string for cache keys
   * Uses a simple DJB2-style hash algorithm to avoid cache key collisions
   * @param str - The string to hash
   * @returns A hexadecimal hash string
   */
  simpleHash(str) {
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
      var char = str.charCodeAt(i);
      hash = hash * 33 ^ char;
    }
    // Convert to hex string
    return (hash >>> 0).toString(16);
  }

  /**
   * Generate a cache key from endpoint and options
   * Uses a hash function for the query parameters to prevent cache poisoning
   * @param endpoint - The API endpoint
   * @param options - Request options including method and query parameters
   * @returns A cache key string
   */
  getCacheKey(endpoint, options) {
    var {
      method = "GET",
      queryParams
    } = options;
    // Hash the query parameters to prevent injection and keep key length reasonable
    var paramsHash = queryParams ? this.simpleHash(JSON.stringify(queryParams)) : "";
    return "".concat(method, ":").concat(endpoint, ":").concat(paramsHash);
  }
  destroy() {
    this.clearCache();
    this.pendingRequests.clear();
  }
}
//# sourceMappingURL=http.js.map