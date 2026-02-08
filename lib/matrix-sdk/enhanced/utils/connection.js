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

export class Semaphore {
  constructor(concurrencyOrOptions) {
    _defineProperty(this, "concurrency", void 0);
    _defineProperty(this, "queue", void 0);
    _defineProperty(this, "permits", void 0);
    if (typeof concurrencyOrOptions === "number") {
      this.concurrency = concurrencyOrOptions;
    } else {
      this.concurrency = concurrencyOrOptions.concurrency;
    }
    this.queue = [];
    this.permits = {
      used: 0,
      waiting: 0
    };
  }
  acquire() {
    var _arguments = arguments,
      _this = this;
    return _asyncToGenerator(function* () {
      var priority = _arguments.length > 0 && _arguments[0] !== undefined ? _arguments[0] : 0;
      if (_this.permits.used < _this.concurrency) {
        _this.permits.used++;
        return;
      }
      return new Promise(resolve => {
        _this.permits.waiting++;
        _this.queue.push({
          priority,
          resolve
        });
        _this.queue.sort((a, b) => b.priority - a.priority);
      });
    })();
  }
  release() {
    if (this.permits.used > 0) {
      this.permits.used--;
    }
    if (this.permits.waiting > 0 && this.permits.used < this.concurrency) {
      this.permits.waiting--;
      this.permits.used++;
      var next = this.queue.shift();
      if (next) {
        next.resolve();
      }
    }
  }
  get used() {
    return this.permits.used;
  }
  get waiting() {
    return this.permits.waiting;
  }
  get available() {
    return this.concurrency - this.permits.used;
  }
}
export class RateLimiter {
  constructor(rateLimit, rateLimitBurst) {
    _defineProperty(this, "rateLimit", void 0);
    _defineProperty(this, "rateLimitBurst", void 0);
    _defineProperty(this, "tokens", void 0);
    _defineProperty(this, "lastRefill", void 0);
    _defineProperty(this, "refillInterval", void 0);
    this.rateLimit = rateLimit;
    this.rateLimitBurst = rateLimitBurst;
    this.tokens = rateLimitBurst;
    this.lastRefill = Date.now();
    this.refillInterval = 1000 / this.rateLimit;
  }
  acquire() {
    var _arguments2 = arguments,
      _this2 = this;
    return _asyncToGenerator(function* () {
      var weight = _arguments2.length > 0 && _arguments2[0] !== undefined ? _arguments2[0] : 1;
      _this2.refill();
      if (_this2.tokens >= weight) {
        _this2.tokens -= weight;
        return true;
      }
      return false;
    })();
  }
  tryAcquire() {
    var weight = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
    this.refill();
    if (this.tokens >= weight) {
      this.tokens -= weight;
      return true;
    }
    return false;
  }
  refill() {
    var now = Date.now();
    var elapsed = now - this.lastRefill;
    if (elapsed >= this.refillInterval) {
      var refills = Math.floor(elapsed / this.refillInterval);
      this.tokens = Math.min(this.tokens + refills, this.rateLimitBurst);
      this.lastRefill = now;
    }
  }
  get availableTokens() {
    this.refill();
    return this.tokens;
  }
}
export class ConnectionPool {
  constructor(options) {
    var _options$maxConnectio, _options$warmupEndpoi, _options$keepAlive;
    _defineProperty(this, "baseUrl", void 0);
    _defineProperty(this, "maxConnections", void 0);
    _defineProperty(this, "warmupEndpoints", void 0);
    _defineProperty(this, "keepAlive", void 0);
    _defineProperty(this, "connections", void 0);
    _defineProperty(this, "initialized", void 0);
    this.baseUrl = options.baseUrl;
    this.maxConnections = (_options$maxConnectio = options.maxConnections) !== null && _options$maxConnectio !== void 0 ? _options$maxConnectio : 10;
    this.warmupEndpoints = (_options$warmupEndpoi = options.warmupEndpoints) !== null && _options$warmupEndpoi !== void 0 ? _options$warmupEndpoi : [];
    this.keepAlive = (_options$keepAlive = options.keepAlive) !== null && _options$keepAlive !== void 0 ? _options$keepAlive : true;
    this.connections = new Map();
    this.initialized = false;
  }
  initialize() {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      if (_this3.initialized) {
        return;
      }
      _this3.initialized = true;
    })();
  }
  warmup() {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      if (_this4.warmupEndpoints.length === 0) {
        return;
      }
      var endpointsToWarmup = _this4.warmupEndpoints.slice(0, _this4.maxConnections);
      for (var endpoint of endpointsToWarmup) {
        try {
          var key = _this4.getConnectionKey(endpoint);
          _this4.connections.set(key, {});
        } catch (_unused) {}
      }
    })();
  }
  checkHealth() {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      return _this5.initialized;
    })();
  }
  destroy() {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      _this6.connections.clear();
      _this6.initialized = false;
    })();
  }
  getConnection(endpoint) {
    var key = this.getConnectionKey(endpoint);
    return this.connections.get(key) || null;
  }
  releaseConnection(endpoint) {
    if (!this.keepAlive) {
      var key = this.getConnectionKey(endpoint);
      this.connections.delete(key);
    }
  }
  clear() {
    this.connections.clear();
  }
  get size() {
    return this.connections.size;
  }
  getConnectionKey(endpoint) {
    return "".concat(this.baseUrl).concat(endpoint);
  }
}
//# sourceMappingURL=connection.js.map