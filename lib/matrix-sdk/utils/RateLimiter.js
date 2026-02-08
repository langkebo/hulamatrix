import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
export class RateLimiter {
  constructor() {
    var _options$maxRequests, _options$windowMs;
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    _defineProperty(this, "tokens", void 0);
    _defineProperty(this, "lastRefill", void 0);
    _defineProperty(this, "maxTokens", void 0);
    _defineProperty(this, "refillRate", void 0);
    _defineProperty(this, "windowMs", void 0);
    this.maxTokens = (_options$maxRequests = options.maxRequests) !== null && _options$maxRequests !== void 0 ? _options$maxRequests : 100;
    this.windowMs = (_options$windowMs = options.windowMs) !== null && _options$windowMs !== void 0 ? _options$windowMs : 60000;
    this.refillRate = this.maxTokens / this.windowMs;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
  wait() {
    var _this = this;
    return _asyncToGenerator(function* () {
      while (_this.tokens < 1) {
        _this.refill();
        if (_this.tokens < 1) {
          var waitTime = (1 - _this.tokens) / _this.refillRate;
          yield _this.sleep(waitTime);
        }
      }
      _this.tokens -= 1;
    })();
  }
  getTokens() {
    this.refill();
    return this.tokens;
  }
  getRemainingRequests() {
    this.refill();
    return Math.floor(this.tokens);
  }
  getResetTime() {
    return this.lastRefill + this.windowMs;
  }
  reset() {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
  refill() {
    var now = Date.now();
    var elapsed = now - this.lastRefill;
    if (elapsed >= this.windowMs) {
      this.tokens = this.maxTokens;
      this.lastRefill = now;
    } else if (elapsed > 0) {
      var tokensToAdd = elapsed * this.refillRate;
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
//# sourceMappingURL=RateLimiter.js.map