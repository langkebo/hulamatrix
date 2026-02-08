import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import { Method } from "../../http-api/index.js";
import { logger } from "../../logger.js";
export class SyncManager {
  constructor(http, store) {
    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    this.http = http;
    this.store = store;
    this.options = options;
    _defineProperty(this, "syncToken", null);
    _defineProperty(this, "isSyncing", false);
    _defineProperty(this, "syncTimeout", 30000);
    _defineProperty(this, "syncInterval", null);
    this.loadSyncToken();
  }
  start() {
    var _this = this;
    return _asyncToGenerator(function* () {
      if (_this.isSyncing) {
        logger.warn("SyncManager is already running");
        return;
      }
      _this.isSyncing = true;
      yield _this.sync();
      _this.syncInterval = setInterval(() => _this.sync(), _this.syncTimeout);
      logger.info("SyncManager started");
    })();
  }
  stop() {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      if (!_this2.isSyncing) {
        return;
      }
      _this2.isSyncing = false;
      if (_this2.syncInterval !== null) {
        clearInterval(_this2.syncInterval);
        _this2.syncInterval = null;
      }
      logger.info("SyncManager stopped");
    })();
  }
  sync() {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      if (!_this3.isSyncing) {
        return;
      }
      try {
        var _this3$syncToken;
        var params = {
          since: (_this3$syncToken = _this3.syncToken) !== null && _this3$syncToken !== void 0 ? _this3$syncToken : undefined,
          timeout: _this3.syncTimeout
        };
        if (typeof _this3.options.filter === "string") {
          params.filter = _this3.options.filter;
        }
        var response = yield _this3.http.authedRequest(Method.Get, "/sync", params);
        _this3.syncToken = response.next_batch;
        yield _this3.saveSyncToken();
      } catch (error) {
        logger.error("Sync failed:", error);
        throw error;
      }
    })();
  }
  getSyncToken() {
    return this.syncToken;
  }
  isRunning() {
    return this.isSyncing;
  }
  setSyncToken(token) {
    this.syncToken = token;
    this.saveSyncToken();
  }
  setSyncTimeout(timeout) {
    this.syncTimeout = timeout;
  }
  setFilter(filter) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      _this4.options.filter = filter;
      if (typeof filter === "object") {
        var response = yield _this4.http.authedRequest(Method.Post, "/user/filter", undefined, filter);
        _this4.options.filter = response.filter_id;
      }
    })();
  }
  loadSyncToken() {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      _this5.syncToken = yield _this5.store.getItem("sync_token");
    })();
  }
  saveSyncToken() {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      if (_this6.syncToken) {
        yield _this6.store.setItem("sync_token", _this6.syncToken);
      }
    })();
  }
}
//# sourceMappingURL=SyncManager.js.map