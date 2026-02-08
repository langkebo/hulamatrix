import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import { logger } from "../logger.js";
export class RequestQueue {
  constructor() {
    var _options$maxConcurren, _options$maxRetries, _options$retryDelay;
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    _defineProperty(this, "queue", new Map());
    _defineProperty(this, "activeRequests", new Set());
    _defineProperty(this, "maxConcurrent", void 0);
    _defineProperty(this, "maxRetries", void 0);
    _defineProperty(this, "retryDelay", void 0);
    this.maxConcurrent = (_options$maxConcurren = options.maxConcurrent) !== null && _options$maxConcurren !== void 0 ? _options$maxConcurren : 5;
    this.maxRetries = (_options$maxRetries = options.maxRetries) !== null && _options$maxRetries !== void 0 ? _options$maxRetries : 3;
    this.retryDelay = (_options$retryDelay = options.retryDelay) !== null && _options$retryDelay !== void 0 ? _options$retryDelay : 1000;
  }
  enqueue(key, request) {
    var _this = this;
    return _asyncToGenerator(function* () {
      var existing = _this.queue.get(key);
      if (existing) {
        var typedExisting = existing;
        return new Promise((resolve, reject) => {
          typedExisting.resolve = resolve;
          typedExisting.reject = reject;
        });
      }
      var queuedRequest = {
        key,
        request,
        resolve: () => {},
        reject: () => {},
        retries: 0,
        timestamp: Date.now()
      };
      _this.queue.set(key, queuedRequest);
      _this.processQueue();
      return new Promise((resolve, reject) => {
        queuedRequest.resolve = resolve;
        queuedRequest.reject = reject;
      });
    })();
  }
  enqueueBatch(requests) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      return Promise.all(requests.map(r => _this2.enqueue(r.key, r.request)));
    })();
  }
  clear(key) {
    if (key) {
      var queued = this.queue.get(key);
      if (queued) {
        queued.reject(new Error("Request cancelled"));
        this.queue.delete(key);
      }
    } else {
      this.queue.forEach(queued => {
        queued.reject(new Error("Request cancelled"));
      });
      this.queue.clear();
    }
  }
  getQueueSize() {
    return this.queue.size;
  }
  getActiveRequestsCount() {
    return this.activeRequests.size;
  }
  processQueue() {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      if (_this3.activeRequests.size >= _this3.maxConcurrent) {
        return;
      }
      var availableSlots = _this3.maxConcurrent - _this3.activeRequests.size;
      var entries = Array.from(_this3.queue.entries()).slice(0, availableSlots);
      for (var [key, queued] of entries) {
        if (_this3.activeRequests.has(key)) {
          continue;
        }
        _this3.activeRequests.add(key);
        _this3.executeRequest(queued);
      }
    })();
  }
  executeRequest(queued) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var {
        key,
        request,
        resolve,
        reject,
        retries
      } = queued;
      try {
        var result = yield request();
        _this4.queue.delete(key);
        _this4.activeRequests.delete(key);
        resolve(result);
        _this4.processQueue();
      } catch (error) {
        var errorObj = error;
        if (retries < _this4.maxRetries && _this4.isRetryableError(errorObj)) {
          queued.retries++;
          var backoffTime = _this4.retryDelay * Math.pow(2, retries);
          logger.warn("Request ".concat(key, " failed, retry ").concat(queued.retries, "/").concat(_this4.maxRetries, " in ").concat(backoffTime, "ms"));
          setTimeout(() => {
            _this4.activeRequests.delete(key);
            _this4.executeRequest(queued);
          }, backoffTime);
        } else {
          _this4.queue.delete(key);
          _this4.activeRequests.delete(key);
          reject(errorObj);
          _this4.processQueue();
        }
      }
    })();
  }
  isRetryableError(error) {
    return error.name === "FetchError" || error.name === "TimeoutError" || error.name === "AbortError";
  }
}
//# sourceMappingURL=RequestQueue.js.map