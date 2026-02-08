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

import { logger } from "../../logger.js";
var reportedDeprecations = new Set();
export function registerDeprecation(options) {
  var messageId = options.messageId || options.method || "unknown";
  if (reportedDeprecations.has(messageId)) {
    return;
  }
  reportedDeprecations.add(messageId);
  var message = "[Deprecation] ".concat(messageId);
  if (options.removalDate || options.removedIn) {
    message += " - Will be removed in ".concat(options.removalDate || options.removedIn);
  }
  if (options.replacedBy || options.alternative) {
    message += " - Use ".concat(options.replacedBy || options.alternative, " instead");
  }
  if (options.migrationGuide) {
    message += "\n  Migration: ".concat(options.migrationGuide);
  }
  var severity = options.severity || "low";
  if (severity === "high") {
    logger.error(message);
  } else if (severity === "medium") {
    logger.warn(message);
  } else {
    logger.log(message);
  }
}
//# sourceMappingURL=deprecation.js.map