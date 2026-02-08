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

export * from "./http.js";
export { TokenManager, createAuthHeaders, parseTokenFromResponse } from "./token-manager.js";
export { InputValidator, assertValidUserId, assertValidRoomId, assertValidEventId, assertValidIpAddress, validateIpAddress } from "./validator.js";
export { LRUCache, createMemoryCache } from "./lru-cache.js";
export { ErrorHandler, ErrorAction } from "./error-handler.js";
export { RetryPolicy, withRetry, isRetryableError } from "./retry.js";
export { ConnectionPool, Semaphore, RateLimiter } from "./connection.js";
export { InterceptorRegistry, createAuthInterceptor, createLoggingInterceptor } from "./interceptors.js";
export { ErrorCode } from "./error-codes.js";
export { DEFAULT_API_MAPPING, mapParams, mapPath, sanitizeLimit, formatPagination, parseCursor } from "./api-mapping.js";
export { formatApiResponse, formatPaginatedResponse, isSuccessStatus, getErrorMessage, extractDataFromResponse, convertBooleanValue, convertNumberValue, convertDateValue, normalizePaginationParams, parsePaginationFromResponse } from "./response-formatter.js";
//# sourceMappingURL=index.js.map