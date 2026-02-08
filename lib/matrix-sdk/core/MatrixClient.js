import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import { MatrixHttpApi } from "../http-api/index.js";
import { AuthManager } from "./auth/AuthManager.js";
import { SyncManager } from "./sync/SyncManager.js";
import { CryptoManager } from "./crypto/CryptoManager.js";
import { MessageProcessor } from "./messaging/MessageProcessor.js";
import { RoomManager } from "./rooms/RoomManager.js";
import { logger } from "../logger.js";
import { TypedEventEmitter } from "../models/typed-event-emitter.js";
export class MatrixClient {
  constructor(options) {
    _defineProperty(this, "auth", void 0);
    _defineProperty(this, "sync", void 0);
    _defineProperty(this, "crypto", void 0);
    _defineProperty(this, "messaging", void 0);
    _defineProperty(this, "rooms", void 0);
    _defineProperty(this, "http", void 0);
    _defineProperty(this, "store", void 0);
    var eventEmitter = new TypedEventEmitter();
    this.http = new MatrixHttpApi(eventEmitter, options);
    this.store = options.store;
    this.auth = new AuthManager(this.http, this.store);
    this.sync = new SyncManager(this.http, this.store, options.syncOptions);
    this.crypto = new CryptoManager(this.http, this.store);
    this.messaging = new MessageProcessor(this.http);
    this.rooms = new RoomManager(this.http, this.store);
    logger.info("MatrixClient initialized");
  }
  start() {
    var _this = this;
    return _asyncToGenerator(function* () {
      if (!_this.auth.isLoggedIn()) {
        throw new Error("Client is not logged in");
      }
      yield _this.sync.start();
      logger.info("MatrixClient started");
    })();
  }
  stop() {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      yield _this2.sync.stop();
      logger.info("MatrixClient stopped");
    })();
  }
  login(username, password) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      yield _this3.auth.loginWithPassword(username, password);
      logger.info("Logged in as ".concat(username));
    })();
  }
  logout() {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      yield _this4.auth.logout();
      yield _this4.stop();
      logger.info("Logged out");
    })();
  }
  logoutAll() {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      yield _this5.auth.logoutAll();
      yield _this5.stop();
      logger.info("Logged out from all sessions");
    })();
  }
  getAccessToken() {
    return this.auth.getAccessToken();
  }
  getUserId() {
    return this.auth.getUserId();
  }
  isLoggedIn() {
    return this.auth.isLoggedIn();
  }
  isSyncing() {
    return this.sync.isRunning();
  }
  getSyncToken() {
    return this.sync.getSyncToken();
  }
}
//# sourceMappingURL=MatrixClient.js.map