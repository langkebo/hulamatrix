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

export class TokenManager {
  constructor(info, refreshCallback, config) {
    var _config$refreshInterv, _config$earlyRefreshT, _config$enableAutoRef;
    _defineProperty(this, "_accessToken", void 0);
    _defineProperty(this, "_refreshToken", void 0);
    _defineProperty(this, "_expiresAt", void 0);
    _defineProperty(this, "_tokenType", void 0);
    _defineProperty(this, "_refreshCallback", void 0);
    _defineProperty(this, "_config", void 0);
    _defineProperty(this, "_isRefreshing", false);
    _defineProperty(this, "_refreshPromise", void 0);
    this._accessToken = info.accessToken;
    this._refreshToken = info.refreshToken;
    this._expiresAt = info.expiresAt;
    this._tokenType = info.tokenType || "Bearer";
    this._refreshCallback = refreshCallback;
    this._config = {
      refreshIntervalMs: (_config$refreshInterv = config === null || config === void 0 ? void 0 : config.refreshIntervalMs) !== null && _config$refreshInterv !== void 0 ? _config$refreshInterv : 5 * 60 * 1000,
      earlyRefreshThresholdMs: (_config$earlyRefreshT = config === null || config === void 0 ? void 0 : config.earlyRefreshThresholdMs) !== null && _config$earlyRefreshT !== void 0 ? _config$earlyRefreshT : 60 * 1000,
      enableAutoRefresh: (_config$enableAutoRef = config === null || config === void 0 ? void 0 : config.enableAutoRefresh) !== null && _config$enableAutoRef !== void 0 ? _config$enableAutoRef : true
    };
  }
  get accessToken() {
    return this._accessToken;
  }
  get refreshToken() {
    return this._refreshToken;
  }
  get tokenType() {
    return this._tokenType || "Bearer";
  }
  get expiresAt() {
    return this._expiresAt;
  }
  get isExpired() {
    if (!this._expiresAt) {
      return false;
    }
    var bufferTime = this._config.earlyRefreshThresholdMs;
    return Date.now() >= this._expiresAt - bufferTime;
  }
  get needsRefresh() {
    if (!this._refreshToken) {
      return false;
    }
    return this.isExpired && this._config.enableAutoRefresh;
  }
  get canRefresh() {
    return !!this._refreshToken;
  }
  get isRefreshing() {
    return this._isRefreshing;
  }
  get authorizationHeader() {
    return "".concat(this.tokenType, " ").concat(this._accessToken);
  }
  refreshIfNeeded() {
    var _this = this;
    return _asyncToGenerator(function* () {
      if (!_this.needsRefresh || !_this.canRefresh || _this._isRefreshing) {
        return;
      }
      if (_this._refreshPromise) {
        return _this._refreshPromise;
      }
      _this._isRefreshing = true;
      _this._refreshPromise = _this.executeRefresh();
      try {
        yield _this._refreshPromise;
      } finally {
        _this._isRefreshing = false;
        _this._refreshPromise = undefined;
      }
    })();
  }
  executeRefresh() {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      if (!_this2._refreshCallback || !_this2._refreshToken) {
        return;
      }
      try {
        yield _this2._refreshCallback(_this2._refreshToken);
      } catch (error) {
        throw new Error("Token refresh failed: ".concat(error));
      }
    })();
  }
  static isTokenExpired(expiresAt, thresholdMs) {
    if (!expiresAt) {
      return false;
    }
    var threshold = thresholdMs !== null && thresholdMs !== void 0 ? thresholdMs : 60 * 1000;
    return Date.now() >= expiresAt - threshold;
  }
  static parseTokenExpiration(expiresIn) {
    return Date.now() + expiresIn * 1000;
  }
  getTokenInfo() {
    return {
      expiresAt: this._expiresAt,
      tokenType: this._tokenType
    };
  }
  clone(refreshCallback) {
    return new TokenManager({
      accessToken: this._accessToken,
      refreshToken: this._refreshToken,
      expiresAt: this._expiresAt,
      tokenType: this._tokenType
    }, refreshCallback !== null && refreshCallback !== void 0 ? refreshCallback : this._refreshCallback, this._config);
  }
}
export function createAuthHeaders(tokenManager) {
  var headers = new Headers();
  headers.set("Authorization", tokenManager.authorizationHeader);
  return headers;
}
export function parseTokenFromResponse(response) {
  return {
    accessToken: response.access_token || "",
    expiresAt: response.expires_in ? TokenManager.parseTokenExpiration(response.expires_in) : undefined,
    tokenType: response.token_type
  };
}
//# sourceMappingURL=token-manager.js.map