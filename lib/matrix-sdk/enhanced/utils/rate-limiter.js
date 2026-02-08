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

var DEFAULT_CONFIG = {
  maxRequests: 100,
  windowMs: 60000
};
export class RateLimiter {
  constructor() {
    var config = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    _defineProperty(this, "cache", new Map());
    _defineProperty(this, "config", void 0);
    this.config = _objectSpread(_objectSpread({}, DEFAULT_CONFIG), config);
  }
  checkLimit(key) {
    var now = Date.now();
    var entry = this.cache.get(key);
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs
      };
      this.cache.set(key, entry);
    }
    entry.count++;
    var remaining = Math.max(0, this.config.maxRequests - entry.count);
    var resetAt = entry.resetTime;
    if (entry.count > this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt
      };
    }
    return {
      allowed: true,
      remaining,
      resetAt
    };
  }
  getResetTime(key) {
    var entry = this.cache.get(key);
    return (entry === null || entry === void 0 ? void 0 : entry.resetTime) || Date.now() + this.config.windowMs;
  }
  reset(key) {
    this.cache.delete(key);
  }
  clear() {
    this.cache.clear();
  }
}
export function createRateLimiter(config) {
  return new RateLimiter(config);
}
export var GLOBAL_RATE_LIMITER = createRateLimiter();
//# sourceMappingURL=rate-limiter.js.map