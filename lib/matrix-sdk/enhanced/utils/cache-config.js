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

/**
 * Cache configuration for API endpoints.
 * @property ttl - Time-to-live in milliseconds
 * @property enabled - Whether caching is enabled for this endpoint
 */

/**
 * Default cache configuration for various API endpoints.
 * Endpoints not listed here will use the default TTL of 5 minutes.
 */
export var DEFAULT_CACHE_CONFIG = {
  "/api/v1/friends": {
    ttl: 300000,
    enabled: true
  },
  "/api/v1/friend-categories": {
    ttl: 600000,
    enabled: true
  },
  "/api/v1/friends/statistics": {
    ttl: 60000,
    enabled: true
  },
  "/api/v1/friends/recommendations": {
    ttl: 300000,
    enabled: true
  },
  "/api/v1/chatrooms": {
    ttl: 10000,
    enabled: false
  },
  "/api/v1/chatrooms/list": {
    ttl: 10000,
    enabled: false
  },
  "/api/v1/admin/users": {
    ttl: 60000,
    enabled: true
  },
  "/api/v1/admin/rooms": {
    ttl: 60000,
    enabled: true
  },
  "/api/v1/admin/statistics": {
    ttl: 30000,
    enabled: true
  },
  "/enhanced/security/policies": {
    ttl: 300000,
    enabled: true
  },
  "/enhanced/security/events": {
    ttl: 60000,
    enabled: true
  },
  "/enhanced/voice/config": {
    ttl: 3600000,
    enabled: true
  },
  "/enhanced/user/config": {
    ttl: 3600000,
    enabled: true
  },
  "/enhanced/presence/status": {
    ttl: 5000,
    enabled: true
  }
};

/**
 * Default cache TTL (5 minutes in milliseconds).
 */
export var DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/**
 * Gets the cache configuration for a specific endpoint.
 * @param endpoint - The API endpoint path
 * @returns The cache configuration for the endpoint, or default config if not found
 * @example
 * ```typescript
 * const config = getCacheConfig("/enhanced/friends/list");
 * if (config.enabled) {
 *     // Use cache with TTL of config.ttl
 * }
 * ```
 */
export function getCacheConfig(endpoint) {
  return DEFAULT_CACHE_CONFIG[endpoint] || {
    ttl: DEFAULT_CACHE_TTL,
    enabled: true
  };
}

/**
 * Checks if an endpoint should be cached.
 * @param endpoint - The API endpoint path
 * @returns True if caching is enabled for the endpoint
 * @example
 * ```typescript
 * if (shouldCacheEndpoint("/api/data")) {
 *     // Cache the response
 * }
 * ```
 */
export function shouldCacheEndpoint(endpoint) {
  var config = getCacheConfig(endpoint);
  return config.enabled;
}

/**
 * Gets the cache TTL for a specific endpoint.
 * @param endpoint - The API endpoint path
 * @returns The cache TTL in milliseconds, or default TTL if not configured
 * @example
 * ```typescript
 * const ttl = getEndpointCacheTTL("/enhanced/friends/list");
 * cache.set(key, data, ttl);
 * ```
 */
export function getEndpointCacheTTL(endpoint) {
  var config = getCacheConfig(endpoint);
  return config.ttl;
}

/**
 * Checks if an HTTP method is cacheable.
 * Only GET requests are typically cacheable.
 * @param method - The HTTP method (GET, POST, PUT, DELETE, etc.)
 * @returns True if the method is cacheable (GET)
 * @example
 * ```typescript
 * if (isCacheableMethod(method)) {
 *     // Consider caching this response
 * }
 * ```
 */
export function isCacheableMethod(method) {
  return method === "GET";
}

/**
 * Checks if an HTTP status code indicates a successful, cacheable response.
 * Only 2xx status codes are considered cacheable.
 * @param status - The HTTP status code
 * @returns True if the status is in the 2xx range
 * @example
 * ```typescript
 * if (isCacheableStatus(response.status)) {
 *     // Cache the successful response
 * }
 * ```
 */
export function isCacheableStatus(status) {
  return status >= 200 && status < 300;
}
//# sourceMappingURL=cache-config.js.map