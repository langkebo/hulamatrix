import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import { Method } from "../http-api/index.js";
import { logger } from "../logger.js";
export class Compatibility {
  constructor(http) {
    this.http = http;
    _defineProperty(this, "serverVersion", null);
    _defineProperty(this, "capabilities", null);
    _defineProperty(this, "checked", false);
  }
  check() {
    var _this = this;
    return _asyncToGenerator(function* () {
      var result = {
        isCompatible: true,
        serverVersion: null,
        capabilities: null,
        features: null,
        issues: [],
        warnings: []
      };
      try {
        var [version, caps] = yield Promise.all([_this.fetchServerVersion(), _this.fetchCapabilities()]);
        result.serverVersion = version;
        result.capabilities = caps;
        result.features = yield _this.detectFeatures(version, caps);
        result.isCompatible = _this.validateCompatibility(result.features, result);
        logger.info("Compatibility check completed for ".concat(version.name, " ").concat(version.version));
      } catch (error) {
        var errorObj = error;
        logger.error("Compatibility check failed:", errorObj);
        result.issues.push("Failed to check compatibility: ".concat(errorObj.message));
        result.isCompatible = false;
      }
      _this.checked = true;
      return result;
    })();
  }
  getServerVersion() {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      if (!_this2.serverVersion) {
        try {
          _this2.serverVersion = yield _this2.fetchServerVersion();
        } catch (_unused) {
          return null;
        }
      }
      return _this2.serverVersion;
    })();
  }
  getCapabilities() {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      if (!_this3.capabilities) {
        try {
          _this3.capabilities = yield _this3.fetchCapabilities();
        } catch (_unused2) {
          return null;
        }
      }
      return _this3.capabilities;
    })();
  }
  isChecked() {
    return this.checked;
  }
  isFeatureSupported(feature) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var _this4$capabilities$u, _this4$capabilities$u2;
      if (!_this4.checked) {
        yield _this4.check();
      }
      if (!_this4.capabilities || !_this4.serverVersion) {
        return false;
      }
      var versionNum = _this4.parseVersion(_this4.serverVersion.version);
      switch (feature) {
        case "encryption":
          return true;
        case "groups":
          return versionNum >= [1, 6, 0];
        case "threadSupport":
          return (_this4$capabilities$u = _this4.capabilities.unstableFeatures["org.matrix.msc3440_threads"]) !== null && _this4$capabilities$u !== void 0 ? _this4$capabilities$u : false;
        case "relatedTypes":
          return (_this4$capabilities$u2 = _this4.capabilities.unstableFeatures["org.matrix.msc2675"]) !== null && _this4$capabilities$u2 !== void 0 ? _this4$capabilities$u2 : false;
        case "externalIds":
          return versionNum >= [1, 1, 0];
        default:
          return false;
      }
    })();
  }
  getRequiredRoomVersion() {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      var caps = yield _this5.getCapabilities();
      if (!caps) {
        return 1;
      }
      return caps.unstableFeatures["require_tfa_for_user_management"] ? 6 : 1;
    })();
  }
  validateRoomVersion(roomVersion) {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      var caps = yield _this6.getCapabilities();
      if (!caps) {
        return false;
      }
      var supportedVersions = caps.versions.filter(v => v.startsWith("v"));
      var maxVersion = supportedVersions.reduce((max, v) => {
        var num = _this6.parseVersion(v);
        return num > max ? num : max;
      }, [1, 0, 0]);
      var requestedVersion = Array.isArray(roomVersion) ? roomVersion : [roomVersion, 0, 0];
      return requestedVersion <= maxVersion;
    })();
  }
  fetchServerVersion() {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      var _response$server;
      var response = yield _this7.http.authedRequest(Method.Get, "/_matrix/client/versions");
      if ((_response$server = response.server) !== null && _response$server !== void 0 && _response$server.version) {
        var [name, version] = response.server.version.split(" ");
        return {
          name: name !== null && name !== void 0 ? name : "unknown",
          version: version !== null && version !== void 0 ? version : "0.0.0"
        };
      }
      if (response.versions && response.versions.length > 0) {
        return {
          name: "matrix",
          version: response.versions[0]
        };
      }
      return {
        name: "unknown",
        version: "0.0.0"
      };
    })();
  }
  fetchCapabilities() {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      try {
        var _response$capabilitie, _response$capabilitie2, _mUploadSize$limit;
        var response = yield _this8.http.authedRequest(Method.Get, "/_matrix/client/r0/capabilities");
        var roomVersions = (_response$capabilitie = (_response$capabilitie2 = response.capabilities) === null || _response$capabilitie2 === void 0 || (_response$capabilitie2 = _response$capabilitie2["m.room_versions"]) === null || _response$capabilitie2 === void 0 ? void 0 : _response$capabilitie2.available) !== null && _response$capabilitie !== void 0 ? _response$capabilitie : {};
        var versions = Object.keys(roomVersions).filter(v => v.startsWith("v"));
        var uploadSizeCap = response.capabilities;
        var mUploadSize = uploadSizeCap === null || uploadSizeCap === void 0 ? void 0 : uploadSizeCap["m.upload_size"];
        return {
          versions,
          unstableFeatures: {},
          maxUploadSize: (_mUploadSize$limit = mUploadSize === null || mUploadSize === void 0 ? void 0 : mUploadSize.limit) !== null && _mUploadSize$limit !== void 0 ? _mUploadSize$limit : 50000000,
          defaultHomeserverUrl: ""
        };
      } catch (_unused3) {
        return {
          versions: ["v1", "v2", "v3", "v4", "v5", "v6"],
          unstableFeatures: {},
          maxUploadSize: 50000000,
          defaultHomeserverUrl: ""
        };
      }
    })();
  }
  detectFeatures(version, capabilities) {
    var _this9 = this;
    return _asyncToGenerator(function* () {
      var _capabilities$unstabl, _capabilities$unstabl2;
      var versionNum = _this9.parseVersion(version.version);
      return {
        encryption: versionNum >= [1, 0, 0],
        groups: versionNum >= [1, 6, 0],
        roomVersion: versionNum[0],
        threadSupport: (_capabilities$unstabl = capabilities.unstableFeatures["org.matrix.msc3440_threads"]) !== null && _capabilities$unstabl !== void 0 ? _capabilities$unstabl : false,
        relatedTypes: (_capabilities$unstabl2 = capabilities.unstableFeatures["org.matrix.msc2675"]) !== null && _capabilities$unstabl2 !== void 0 ? _capabilities$unstabl2 : false,
        externalIds: versionNum >= [1, 1, 0]
      };
    })();
  }
  validateCompatibility(features, result) {
    if (!features.encryption) {
      result.issues.push("Server does not support end-to-end encryption");
      return false;
    }
    if (features.roomVersion < 1) {
      result.warnings.push("Unknown room version support");
    }
    return true;
  }
  parseVersion(version) {
    var parts = version.split(/[-+]/)[0].split(".").map(Number);
    while (parts.length < 3) {
      parts.push(0);
    }
    return parts.slice(0, 3);
  }
}
//# sourceMappingURL=Compatibility.js.map