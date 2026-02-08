import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import { Method } from "../../http-api/index.js";
import { logger } from "../../logger.js";
export class CryptoManager {
  constructor(http, store) {
    this.http = http;
    this.store = store;
    _defineProperty(this, "deviceKeys", new Map());
    _defineProperty(this, "oneTimeKeys", new Map());
    _defineProperty(this, "keyBackupVersion", null);
    this.loadKeys();
  }
  uploadKeys(options) {
    var _this = this;
    return _asyncToGenerator(function* () {
      var body = {};
      if (options.deviceKeys) {
        body.device_keys = options.deviceKeys;
        _this.deviceKeys.set(options.deviceKeys.device_id, options.deviceKeys);
      }
      if (options.oneTimeKeys) {
        body.one_time_keys = options.oneTimeKeys;
        Object.entries(options.oneTimeKeys).forEach(_ref => {
          var [keyId, key] = _ref;
          _this.oneTimeKeys.set(keyId, key);
        });
      }
      if (options.fallbackKeys) {
        body.fallback_keys = options.fallbackKeys;
      }
      var response = yield _this.http.authedRequest(Method.Post, "/keys/upload", undefined, body);
      yield _this.saveKeys();
      return response;
    })();
  }
  queryKeys(request) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      return _this2.http.authedRequest(Method.Post, "/keys/query", undefined, request);
    })();
  }
  claimKeys(request) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this3.http.authedRequest(Method.Post, "/keys/claim", undefined, request);
      Object.entries(response.one_time_keys).forEach(entry => {
        var [userId, keys] = entry;
        Object.entries(keys).forEach(keyEntry => {
          var [deviceId, key] = keyEntry;
          _this3.oneTimeKeys.set("".concat(userId, ":").concat(deviceId), key);
        });
      });
      yield _this3.saveKeys();
      return response;
    })();
  }
  getKeyChanges(fromToken, toToken) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      return _this4.http.authedRequest(Method.Post, "/keys/changes", undefined, {
        from: fromToken,
        to: toToken
      });
    })();
  }
  uploadKeySignatures(body) {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      yield _this5.http.authedRequest(Method.Post, "/keys/signatures/upload", undefined, body);
    })();
  }
  getDeviceKey(userId, deviceId) {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      var _response$device_keys;
      var response = yield _this6.queryKeys({
        device_keys: {
          [userId]: [deviceId]
        }
      });
      return (_response$device_keys = response.device_keys[userId]) === null || _response$device_keys === void 0 ? void 0 : _response$device_keys[deviceId];
    })();
  }
  getUserKeys(userIds) {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      var deviceKeys = {};
      userIds.forEach(userId => {
        deviceKeys[userId] = [];
      });
      var response = yield _this7.queryKeys({
        device_keys: deviceKeys
      });
      Object.entries(response.device_keys).forEach(_ref2 => {
        var [userId, keys] = _ref2;
        Object.entries(keys).forEach(_ref3 => {
          var [deviceId, key] = _ref3;
          _this7.deviceKeys.set("".concat(userId, ":").concat(deviceId), key);
        });
      });
      yield _this7.saveKeys();
      return response.device_keys;
    })();
  }
  getStoredDeviceKey(userId, deviceId) {
    return this.deviceKeys.get("".concat(userId, ":").concat(deviceId));
  }
  getStoredOneTimeKey(keyId) {
    return this.oneTimeKeys.get(keyId);
  }
  clearDeviceKey(userId, deviceId) {
    this.deviceKeys.delete("".concat(userId, ":").concat(deviceId));
    this.saveKeys();
  }
  clearOneTimeKey(keyId) {
    this.oneTimeKeys.delete(keyId);
    this.saveKeys();
  }
  createKeyBackup(_version, algorithm, authData) {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this8.http.authedRequest(Method.Post, "/room_keys/version", undefined, {
        algorithm,
        auth_data: authData
      });
      _this8.keyBackupVersion = response.version;
      yield _this8.store.setItem("key_backup_version", response.version);
      return response;
    })();
  }
  getKeyBackup(version) {
    var _this9 = this;
    return _asyncToGenerator(function* () {
      var path = version ? "/room_keys/version/".concat(version) : "/room_keys/version";
      try {
        var _response$version, _response$version2;
        var response = yield _this9.http.authedRequest(Method.Get, path);
        _this9.keyBackupVersion = (_response$version = response.version) !== null && _response$version !== void 0 ? _response$version : null;
        yield _this9.store.setItem("key_backup_version", (_response$version2 = response.version) !== null && _response$version2 !== void 0 ? _response$version2 : null);
        return response;
      } catch (error) {
        if (error.httpStatus === 404) {
          return null;
        }
        throw error;
      }
    })();
  }
  updateKeyBackup(version, versionData) {
    var _this0 = this;
    return _asyncToGenerator(function* () {
      var _response$version3, _response$version4;
      var response = yield _this0.http.authedRequest(Method.Put, "/room_keys/version/".concat(version), undefined, versionData);
      _this0.keyBackupVersion = (_response$version3 = response.version) !== null && _response$version3 !== void 0 ? _response$version3 : null;
      yield _this0.store.setItem("key_backup_version", (_response$version4 = response.version) !== null && _response$version4 !== void 0 ? _response$version4 : null);
      return response;
    })();
  }
  deleteKeyBackup(version) {
    var _this1 = this;
    return _asyncToGenerator(function* () {
      var path = version ? "/room_keys/version/".concat(version) : "/room_keys/version";
      yield _this1.http.authedRequest(Method.Delete, path);
      _this1.keyBackupVersion = null;
      yield _this1.store.deleteItem("key_backup_version");
    })();
  }
  uploadRoomKeyBackup(version, roomId, sessionId, data) {
    var _this10 = this;
    return _asyncToGenerator(function* () {
      yield _this10.http.authedRequest(Method.Put, "/room_keys/backup/".concat(version, "/rooms/").concat(roomId, "/sessions/").concat(sessionId), undefined, data);
    })();
  }
  uploadRoomKeysBackup(version, rooms) {
    var _this11 = this;
    return _asyncToGenerator(function* () {
      yield _this11.http.authedRequest(Method.Put, "/room_keys/backup/".concat(version, "/keys"), undefined, {
        rooms
      });
    })();
  }
  getRoomKeyBackup(version, roomId, sessionId) {
    var _this12 = this;
    return _asyncToGenerator(function* () {
      return _this12.http.authedRequest(Method.Get, "/room_keys/backup/".concat(version, "/rooms/").concat(roomId, "/sessions/").concat(sessionId));
    })();
  }
  getRoomKeysBackup(version) {
    var _this13 = this;
    return _asyncToGenerator(function* () {
      return _this13.http.authedRequest(Method.Get, "/room_keys/backup/".concat(version, "/keys"));
    })();
  }
  deleteRoomKeyBackup(version, roomId, sessionId) {
    var _this14 = this;
    return _asyncToGenerator(function* () {
      var path = "/room_keys/backup/".concat(version);
      if (roomId) {
        path += "/rooms/".concat(roomId);
        if (sessionId) {
          path += "/sessions/".concat(sessionId);
        }
      }
      yield _this14.http.authedRequest(Method.Delete, path);
    })();
  }
  getKeyBackupVersion() {
    return this.keyBackupVersion;
  }
  saveKeys() {
    var _this15 = this;
    return _asyncToGenerator(function* () {
      var deviceKeys = Array.from(_this15.deviceKeys.entries());
      var oneTimeKeys = Array.from(_this15.oneTimeKeys.entries());
      yield _this15.store.setItem("crypto_device_keys", deviceKeys);
      yield _this15.store.setItem("crypto_one_time_keys", oneTimeKeys);
    })();
  }
  loadKeys() {
    var _this16 = this;
    return _asyncToGenerator(function* () {
      try {
        var deviceKeys = yield _this16.store.getItem("crypto_device_keys");
        if (deviceKeys) {
          _this16.deviceKeys = new Map(deviceKeys);
        }
        var oneTimeKeys = yield _this16.store.getItem("crypto_one_time_keys");
        if (oneTimeKeys) {
          _this16.oneTimeKeys = new Map(oneTimeKeys);
        }
        _this16.keyBackupVersion = yield _this16.store.getItem("key_backup_version");
      } catch (error) {
        logger.warn("Failed to load crypto keys:", error);
      }
    })();
  }
}
//# sourceMappingURL=CryptoManager.js.map