import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import { logger } from "../logger.js";
export class DeviceVerification {
  constructor(store) {
    var _options$autoVerifyTr, _options$verification;
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    this.store = store;
    _defineProperty(this, "devices", new Map());
    _defineProperty(this, "verificationRequests", new Map());
    _defineProperty(this, "autoVerifyTrusted", void 0);
    _defineProperty(this, "verificationTimeout", void 0);
    this.autoVerifyTrusted = (_options$autoVerifyTr = options.autoVerifyTrusted) !== null && _options$autoVerifyTr !== void 0 ? _options$autoVerifyTr : false;
    this.verificationTimeout = (_options$verification = options.verificationTimeout) !== null && _options$verification !== void 0 ? _options$verification : 300000;
    this.loadDevices();
  }
  getDevice(userId, deviceId) {
    var _this = this;
    return _asyncToGenerator(function* () {
      var _this$devices$get;
      var key = _this.getDeviceKey(userId, deviceId);
      return (_this$devices$get = _this.devices.get(key)) !== null && _this$devices$get !== void 0 ? _this$devices$get : null;
    })();
  }
  getDevices(userId) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var userDevices = [];
      for (var [key, device] of _this2.devices.entries()) {
        if (key.startsWith("".concat(userId, ":"))) {
          userDevices.push(device);
        }
      }
      return userDevices;
    })();
  }
  verifyDevice(userId, deviceId) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var device = yield _this3.getDevice(userId, deviceId);
      if (!device) {
        throw new Error("Device not found: ".concat(deviceId));
      }
      device.trustLevel = "verified";
      _this3.devices.set(_this3.getDeviceKey(userId, deviceId), device);
      yield _this3.saveDevice(device);
      logger.info("Device verified: ".concat(userId, ":").concat(deviceId));
    })();
  }
  blockDevice(userId, deviceId) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var device = yield _this4.getDevice(userId, deviceId);
      if (!device) {
        throw new Error("Device not found: ".concat(deviceId));
      }
      device.trustLevel = "blocked";
      _this4.devices.set(_this4.getDeviceKey(userId, deviceId), device);
      yield _this4.saveDevice(device);
      logger.info("Device blocked: ".concat(userId, ":").concat(deviceId));
    })();
  }
  unverifyDevice(userId, deviceId) {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      var device = yield _this5.getDevice(userId, deviceId);
      if (!device) {
        throw new Error("Device not found: ".concat(deviceId));
      }
      device.trustLevel = "unverified";
      _this5.devices.set(_this5.getDeviceKey(userId, deviceId), device);
      yield _this5.saveDevice(device);
      logger.info("Device unverified: ".concat(userId, ":").concat(deviceId));
    })();
  }
  startVerification(userId, deviceId, methods) {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      var requestId = _this6.generateRequestId();
      var request = {
        requestId,
        deviceId,
        userId,
        status: "verifying",
        timestamp: Date.now(),
        methods
      };
      _this6.verificationRequests.set(requestId, request);
      yield _this6.saveVerificationRequest(request);
      logger.info("Verification started: ".concat(requestId, " for ").concat(userId, ":").concat(deviceId));
      return requestId;
    })();
  }
  confirmVerification(requestId, verified) {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      var request = _this7.verificationRequests.get(requestId);
      if (!request) {
        throw new Error("Verification request not found: ".concat(requestId));
      }
      if (verified) {
        yield _this7.verifyDevice(request.userId, request.deviceId);
      } else {
        yield _this7.unverifyDevice(request.userId, request.deviceId);
      }
      request.status = verified ? "verified" : "unverified";
      _this7.verificationRequests.set(requestId, request);
      yield _this7.saveVerificationRequest(request);
      logger.info("Verification confirmed: ".concat(requestId, " - ").concat(verified ? "verified" : "unverified"));
    })();
  }
  cancelVerification(requestId) {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      var request = _this8.verificationRequests.get(requestId);
      if (!request) {
        throw new Error("Verification request not found: ".concat(requestId));
      }
      request.status = "unverified";
      _this8.verificationRequests.set(requestId, request);
      yield _this8.saveVerificationRequest(request);
      logger.info("Verification cancelled: ".concat(requestId));
    })();
  }
  getVerificationRequest(requestId) {
    var _this$verificationReq;
    return (_this$verificationReq = this.verificationRequests.get(requestId)) !== null && _this$verificationReq !== void 0 ? _this$verificationReq : null;
  }
  getVerificationRequests(userId) {
    var requests = Array.from(this.verificationRequests.values());
    if (userId) {
      requests = requests.filter(r => r.userId === userId);
    }
    return requests.sort((a, b) => b.timestamp - a.timestamp);
  }
  updateDeviceKeys(userId, deviceId, keys) {
    var _this9 = this;
    return _asyncToGenerator(function* () {
      var key = _this9.getDeviceKey(userId, deviceId);
      var device = _this9.devices.get(key);
      if (!device) {
        device = {
          deviceId,
          userId,
          keys,
          trustLevel: "unverified"
        };
      } else {
        device.keys = keys;
      }
      _this9.devices.set(key, device);
      yield _this9.saveDevice(device);
      if (_this9.autoVerifyTrusted) {
        yield _this9.autoVerifyDevice(device);
      }
    })();
  }
  deleteDevice(userId, deviceId) {
    var _this0 = this;
    return _asyncToGenerator(function* () {
      var key = _this0.getDeviceKey(userId, deviceId);
      _this0.devices.delete(key);
      yield _this0.store.deleteItem("device_".concat(key));
      logger.info("Device deleted: ".concat(userId, ":").concat(deviceId));
    })();
  }
  cleanupExpiredRequests() {
    var _this1 = this;
    return _asyncToGenerator(function* () {
      var now = Date.now();
      var expiredRequests = [];
      for (var [requestId, request] of _this1.verificationRequests.entries()) {
        if (now - request.timestamp > _this1.verificationTimeout) {
          expiredRequests.push(requestId);
        }
      }
      for (var _requestId of expiredRequests) {
        yield _this1.cancelVerification(_requestId);
        _this1.verificationRequests.delete(_requestId);
        yield _this1.store.deleteItem("verification_request_".concat(_requestId));
      }
      if (expiredRequests.length > 0) {
        logger.info("Cleaned up ".concat(expiredRequests.length, " expired verification requests"));
      }
      return expiredRequests.length;
    })();
  }
  getDeviceCount(userId) {
    if (userId) {
      var count = 0;
      for (var key of this.devices.keys()) {
        if (key.startsWith("".concat(userId, ":"))) {
          count++;
        }
      }
      return count;
    }
    return this.devices.size;
  }
  getVerifiedDeviceCount(userId) {
    var count = 0;
    for (var device of this.devices.values()) {
      if (device.trustLevel === "verified") {
        if (!userId || device.userId === userId) {
          count++;
        }
      }
    }
    return count;
  }
  autoVerifyDevice(device) {
    var _this10 = this;
    return _asyncToGenerator(function* () {
      if (device.trustLevel !== "unverified") {
        return;
      }
      var isTrusted = _this10.isDeviceTrusted(device);
      if (isTrusted) {
        yield _this10.verifyDevice(device.userId, device.deviceId);
      }
    })();
  }
  isDeviceTrusted(device) {
    return device.keys.algorithms.includes("m.olm.v1.curve25519-aes-sha2");
  }
  getDeviceKey(userId, deviceId) {
    return "".concat(userId, ":").concat(deviceId);
  }
  generateRequestId() {
    return "verify_".concat(Date.now(), "_").concat(Math.random().toString(36).substring(2));
  }
  saveDevice(device) {
    var _this11 = this;
    return _asyncToGenerator(function* () {
      var key = _this11.getDeviceKey(device.userId, device.deviceId);
      yield _this11.store.setItem("device_".concat(key), device);
    })();
  }
  saveVerificationRequest(request) {
    var _this12 = this;
    return _asyncToGenerator(function* () {
      yield _this12.store.setItem("verification_request_".concat(request.requestId), request);
    })();
  }
  loadDevices() {
    var _this13 = this;
    return _asyncToGenerator(function* () {
      try {
        var keys = yield _this13.listStoredDeviceKeys();
        for (var key of keys) {
          var device = yield _this13.store.getItem("device_".concat(key));
          if (device) {
            _this13.devices.set(key, device);
          }
        }
        logger.info("Loaded ".concat(_this13.devices.size, " devices"));
      } catch (error) {
        logger.warn("Failed to load devices:", error);
      }
    })();
  }
  listStoredDeviceKeys() {
    var _this14 = this;
    return _asyncToGenerator(function* () {
      var keys = [];
      try {
        var storedKeys = yield _this14.store.getItem("device_keys_list");
        if (storedKeys) {
          return storedKeys;
        }
      } catch (_unused) {}
      return keys;
    })();
  }
}
//# sourceMappingURL=DeviceVerification.js.map