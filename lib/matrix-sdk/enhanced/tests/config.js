import _defineProperty from "@babel/runtime/helpers/defineProperty";
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
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

export var DEFAULT_TEST_CONFIG = {
  server: {
    baseUrl: process.env.SYNAPSE_SERVER_URL || "http://10.168.3.50:8008",
    accessToken: process.env.SYNAPSE_ACCESS_TOKEN || "syt_dGVzdHVzZXIx_JwHFHogqHeLtEuPfEGDU_4YyTR4",
    apiPrefix: ""
  },
  test: {
    timeout: 60000,
    retries: 3,
    concurrent: 5,
    iterations: 10
  },
  logging: {
    level: "info"
  }
};
export function loadTestConfig(overrides) {
  return _objectSpread(_objectSpread(_objectSpread({}, DEFAULT_TEST_CONFIG), overrides), {}, {
    server: _objectSpread(_objectSpread({}, DEFAULT_TEST_CONFIG.server), (overrides === null || overrides === void 0 ? void 0 : overrides.server) || {}),
    test: _objectSpread(_objectSpread({}, DEFAULT_TEST_CONFIG.test), (overrides === null || overrides === void 0 ? void 0 : overrides.test) || {}),
    logging: _objectSpread(_objectSpread({}, DEFAULT_TEST_CONFIG.logging), (overrides === null || overrides === void 0 ? void 0 : overrides.logging) || {})
  });
}
export function validateConfig(config) {
  var errors = [];
  if (!config.server.baseUrl) {
    errors.push("Server base URL is required");
  }
  if (!config.server.accessToken) {
    errors.push("Server access token is required");
  }
  if (config.test.timeout <= 0) {
    errors.push("Test timeout must be greater than 0");
  }
  if (config.test.retries < 0) {
    errors.push("Test retries must be non-negative");
  }
  if (config.test.concurrent <= 0) {
    errors.push("Test concurrent must be greater than 0");
  }
  if (config.test.iterations <= 0) {
    errors.push("Test iterations must be greater than 0");
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
//# sourceMappingURL=config.js.map