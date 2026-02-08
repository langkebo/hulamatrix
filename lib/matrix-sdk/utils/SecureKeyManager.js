import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import { logger } from "../logger.js";
export class SecureKeyManager {
  constructor(store) {
    var _options$encryptionKe, _options$keyLifetime;
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    this.store = store;
    _defineProperty(this, "keys", new Map());
    _defineProperty(this, "encryptionKey", void 0);
    _defineProperty(this, "keyLifetime", void 0);
    this.encryptionKey = (_options$encryptionKe = options.encryptionKey) !== null && _options$encryptionKe !== void 0 ? _options$encryptionKe : this.generateEncryptionKey();
    this.keyLifetime = (_options$keyLifetime = options.keyLifetime) !== null && _options$keyLifetime !== void 0 ? _options$keyLifetime : 86400000;
    this.loadKeys();
  }
  storeKey(keyId, keyData, algorithm, ttl) {
    var _this = this;
    return _asyncToGenerator(function* () {
      var effectiveTtl = ttl !== null && ttl !== void 0 ? ttl : _this.keyLifetime;
      var entry = {
        keyId,
        keyData: _this.encrypt(keyData),
        algorithm,
        createdAt: Date.now(),
        expiresAt: effectiveTtl ? Date.now() + effectiveTtl : undefined
      };
      _this.keys.set(keyId, entry);
      yield _this.saveKey(keyId, entry);
      logger.info("Secure key stored: ".concat(keyId));
    })();
  }
  getKey(keyId) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var entry = _this2.keys.get(keyId);
      if (!entry) {
        return null;
      }
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        yield _this2.deleteKey(keyId);
        return null;
      }
      return _this2.decrypt(entry.keyData);
    })();
  }
  deleteKey(keyId) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      _this3.keys.delete(keyId);
      yield _this3.store.deleteItem("secure_key_".concat(keyId));
      logger.info("Secure key deleted: ".concat(keyId));
    })();
  }
  listKeys(algorithm) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var entries = Array.from(_this4.keys.values());
      if (algorithm) {
        return entries.filter(e => e.algorithm === algorithm);
      }
      return entries;
    })();
  }
  rotateKey(keyId, newKeyData) {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      var entry = _this5.keys.get(keyId);
      if (!entry) {
        throw new Error("Key not found: ".concat(keyId));
      }
      entry.keyData = _this5.encrypt(newKeyData);
      entry.createdAt = Date.now();
      _this5.keys.set(keyId, entry);
      yield _this5.saveKey(keyId, entry);
      logger.info("Secure key rotated: ".concat(keyId));
    })();
  }
  cleanupExpiredKeys() {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      var now = Date.now();
      var expiredKeys = [];
      for (var [keyId, entry] of _this6.keys.entries()) {
        if (entry.expiresAt && now > entry.expiresAt) {
          expiredKeys.push(keyId);
        }
      }
      for (var _keyId of expiredKeys) {
        yield _this6.deleteKey(_keyId);
      }
      if (expiredKeys.length > 0) {
        logger.info("Cleaned up ".concat(expiredKeys.length, " expired keys"));
      }
      return expiredKeys.length;
    })();
  }
  clearAllKeys() {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      var keyIds = Array.from(_this7.keys.keys());
      for (var keyId of keyIds) {
        yield _this7.deleteKey(keyId);
      }
      logger.info("All secure keys cleared");
    })();
  }
  getKeyCount() {
    return this.keys.size;
  }
  hasKey(keyId) {
    var entry = this.keys.get(keyId);
    if (!entry) {
      return false;
    }
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      return false;
    }
    return true;
  }
  encrypt(data) {
    var combined = this.encryptionKey + data;
    var hash = 0;
    for (var i = 0; i < combined.length; i++) {
      var char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return btoa(hash.toString(16) + ":" + data);
  }
  decrypt(encrypted) {
    try {
      var decoded = atob(encrypted);
      var separatorIndex = decoded.indexOf(":");
      if (separatorIndex === -1) {
        return decoded;
      }
      return decoded.substring(separatorIndex + 1);
    } catch (_unused) {
      return encrypted;
    }
  }
  generateEncryptionKey() {
    var timestamp = Date.now().toString(36);
    var random = Math.random().toString(36).substring(2);
    return timestamp + random;
  }
  saveKey(keyId, entry) {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      yield _this8.store.setItem("secure_key_".concat(keyId), entry);
    })();
  }
  loadKeys() {
    var _this9 = this;
    return _asyncToGenerator(function* () {
      try {
        var allKeys = yield _this9.listStoredKeys();
        for (var keyId of allKeys) {
          var entry = yield _this9.store.getItem("secure_key_".concat(keyId));
          if (entry) {
            if (entry.expiresAt && Date.now() > entry.expiresAt) {
              yield _this9.deleteKey(keyId);
            } else {
              _this9.keys.set(keyId, entry);
            }
          }
        }
        logger.info("Loaded ".concat(_this9.keys.size, " secure keys"));
      } catch (error) {
        logger.warn("Failed to load secure keys:", error);
      }
    })();
  }
  listStoredKeys() {
    var _this0 = this;
    return _asyncToGenerator(function* () {
      var prefix = "secure_key_";
      try {
        var storeKeys = yield _this0.store.getItem("".concat(prefix, "list"));
        if (storeKeys) {
          return storeKeys;
        }
      } catch (_unused2) {}
      return [];
    })();
  }
}
//# sourceMappingURL=SecureKeyManager.js.map