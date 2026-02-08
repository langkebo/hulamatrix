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

import { logger } from "../logger.js";
var log = logger.getChild("enhanced:test-config");
export var defaultConfig = {
  baseUrl: process.env.TEST_BASE_URL || "http://localhost:8008",
  accessToken: process.env.TEST_ACCESS_TOKEN || "test_token",
  apiPrefix: "/_synapse/client",
  timeout: 30000
};
export function getTestConfig() {
  return {
    baseUrl: process.env.TEST_BASE_URL || defaultConfig.baseUrl,
    accessToken: process.env.TEST_ACCESS_TOKEN || defaultConfig.accessToken,
    apiPrefix: process.env.TEST_API_PREFIX || defaultConfig.apiPrefix,
    timeout: parseInt(process.env.TEST_TIMEOUT || String(defaultConfig.timeout), 10)
  };
}
export function skipIfMissingEnv() {
  for (var _len = arguments.length, vars = new Array(_len), _key = 0; _key < _len; _key++) {
    vars[_key] = arguments[_key];
  }
  var missing = vars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    log.warn("Skipping test: Missing environment variables: ".concat(missing.join(", ")));
  }
}
//# sourceMappingURL=test-config.js.map