import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import { Method, ClientPrefix } from "../../http-api/index.js";
export class AuthManager {
  constructor(http, store) {
    this.http = http;
    this.store = store;
    _defineProperty(this, "accessToken", null);
    _defineProperty(this, "refreshToken", null);
    _defineProperty(this, "userId", null);
    _defineProperty(this, "expiresAt", 0);
    this.loadCredentials();
  }
  loginFlows() {
    var _this = this;
    return _asyncToGenerator(function* () {
      return _this.http.request(Method.Get, "/login");
    })();
  }
  loginRequest(data) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this2.http.authedRequest(Method.Post, "/login", undefined, data);
      if (response.access_token && response.user_id) {
        _this2.accessToken = response.access_token;
        _this2.refreshToken = response.refresh_token || null;
        _this2.userId = response.user_id;
        _this2.expiresAt = response.expires_in_ms ? Date.now() + response.expires_in_ms : 0;
        _this2.http.opts.accessToken = response.access_token;
        yield _this2.saveCredentials();
      }
      return response;
    })();
  }
  loginWithPassword(user, password) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      return _this3.loginRequest({
        type: "m.login.password",
        user,
        password
      });
    })();
  }
  loginWithToken(token) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      return _this4.loginRequest({
        type: "m.login.token",
        token
      });
    })();
  }
  logout() {
    var _arguments = arguments,
      _this5 = this;
    return _asyncToGenerator(function* () {
      var stopClient = _arguments.length > 0 && _arguments[0] !== undefined ? _arguments[0] : false;
      if (stopClient) {
        _this5.http.abort();
      }
      yield _this5.http.authedRequest(Method.Post, "/logout");
      _this5.clearCredentials();
    })();
  }
  logoutAll() {
    var _arguments2 = arguments,
      _this6 = this;
    return _asyncToGenerator(function* () {
      var stopClient = _arguments2.length > 0 && _arguments2[0] !== undefined ? _arguments2[0] : false;
      if (stopClient) {
        _this6.http.abort();
      }
      yield _this6.http.authedRequest(Method.Post, "/logout/all");
      _this6.clearCredentials();
    })();
  }
  deactivateAccount(auth, erase) {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      var body = {};
      if (auth) {
        body.auth = auth;
      }
      if (erase !== undefined) {
        body.erase = erase;
      }
      return _this7.http.authedRequest(Method.Post, "/account/deactivate", undefined, body);
    })();
  }
  requestLoginToken(auth) {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      var body = {
        auth
      };
      return _this8.http.authedRequest(Method.Post, "/login/get_token", undefined, body, {
        prefix: ClientPrefix.V1
      });
    })();
  }
  getFallbackAuthUrl(loginType, authSessionId) {
    return this.http.getUrl("/auth/$loginType/fallback/web", {
      $loginType: loginType,
      session: authSessionId
    }).href;
  }
  getSsoLoginUrl(redirectUrl) {
    var loginType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "sso";
    var idpId = arguments.length > 2 ? arguments[2] : undefined;
    var action = arguments.length > 3 ? arguments[3] : undefined;
    var url = "/login/" + loginType + "/redirect";
    if (idpId) {
      url += "/" + idpId;
    }
    var params = {
      redirectUrl,
      "org.matrix.msc3824.action": action
    };
    return this.http.getUrl(url, params).href;
  }
  getCasLoginUrl(redirectUrl) {
    return this.getSsoLoginUrl(redirectUrl, "cas");
  }
  setPassword(authDict, newPassword, logoutDevices) {
    var _this9 = this;
    return _asyncToGenerator(function* () {
      var path = "/account/password";
      return _this9.http.authedRequest(Method.Post, path, undefined, {
        auth: authDict,
        new_password: newPassword,
        logout_devices: logoutDevices
      });
    })();
  }
  get3PIDs() {
    var _this0 = this;
    return _asyncToGenerator(function* () {
      return _this0.http.authedRequest(Method.Get, "/account/3pid");
    })();
  }
  add3PID(clientSecret, sid, auth, idServer, bind) {
    var _this1 = this;
    return _asyncToGenerator(function* () {
      var path = bind ? "/account/3pid/bind" : "/account/3pid/add";
      var body = {
        client_secret: clientSecret,
        sid
      };
      if (auth) {
        body.auth = auth;
      }
      if (idServer) {
        body.id_server = idServer;
      }
      return _this1.http.authedRequest(Method.Post, path, undefined, body);
    })();
  }
  delete3PID(medium, address, idServer) {
    var _this10 = this;
    return _asyncToGenerator(function* () {
      var path = "/account/3pid/delete";
      var body = {
        medium,
        address
      };
      if (idServer) {
        body.id_server = idServer;
      }
      return _this10.http.authedRequest(Method.Post, path, undefined, body);
    })();
  }
  unbind3PID(medium, address, idServer) {
    var _this11 = this;
    return _asyncToGenerator(function* () {
      var path = "/account/3pid/unbind";
      var body = {
        medium,
        address
      };
      if (idServer) {
        body.id_server = idServer;
      }
      return _this11.http.authedRequest(Method.Post, path, undefined, body);
    })();
  }
  whoami() {
    var _this12 = this;
    return _asyncToGenerator(function* () {
      return _this12.http.authedRequest(Method.Get, "/account/whoami");
    })();
  }
  getAccessToken() {
    return this.accessToken;
  }
  getUserId() {
    return this.userId;
  }
  isLoggedIn() {
    return this.accessToken !== null && (this.expiresAt === 0 || Date.now() < this.expiresAt);
  }
  refreshAccessToken() {
    var _this13 = this;
    return _asyncToGenerator(function* () {
      if (!_this13.refreshToken) {
        throw new Error("No refresh token available");
      }
      var response = yield _this13.http.authedRequest(Method.Post, "/tokenrefresh", undefined, {
        refresh_token: _this13.refreshToken
      });
      _this13.accessToken = response.access_token;
      _this13.expiresAt = Date.now() + response.expires_in * 1000;
      _this13.http.opts.accessToken = response.access_token;
      yield _this13.saveCredentials();
    })();
  }
  saveCredentials() {
    var _this14 = this;
    return _asyncToGenerator(function* () {
      yield _this14.store.setItem("auth_credentials", {
        accessToken: _this14.accessToken,
        refreshToken: _this14.refreshToken,
        userId: _this14.userId,
        expiresAt: _this14.expiresAt
      });
    })();
  }
  loadCredentials() {
    var _this15 = this;
    return _asyncToGenerator(function* () {
      var credentials = yield _this15.store.getItem("auth_credentials");
      if (credentials) {
        var _credentials$accessTo, _credentials$refreshT, _credentials$userId, _credentials$expiresA;
        _this15.accessToken = (_credentials$accessTo = credentials.accessToken) !== null && _credentials$accessTo !== void 0 ? _credentials$accessTo : null;
        _this15.refreshToken = (_credentials$refreshT = credentials.refreshToken) !== null && _credentials$refreshT !== void 0 ? _credentials$refreshT : null;
        _this15.userId = (_credentials$userId = credentials.userId) !== null && _credentials$userId !== void 0 ? _credentials$userId : null;
        _this15.expiresAt = (_credentials$expiresA = credentials.expiresAt) !== null && _credentials$expiresA !== void 0 ? _credentials$expiresA : 0;
        if (_this15.accessToken) {
          _this15.http.opts.accessToken = _this15.accessToken;
        }
      }
    })();
  }
  clearCredentials() {
    this.accessToken = null;
    this.refreshToken = null;
    this.userId = null;
    this.expiresAt = 0;
    this.http.opts.accessToken = undefined;
    this.store.deleteItem("auth_credentials");
  }
}
//# sourceMappingURL=AuthManager.js.map