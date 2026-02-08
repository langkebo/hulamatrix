/**
 * Cache configuration for API endpoints.
 * @property ttl - Time-to-live in milliseconds
 * @property enabled - Whether caching is enabled for this endpoint
 */
export interface CacheConfig {
    /** Time-to-live in milliseconds */
    ttl: number;
    /** Whether caching is enabled for this endpoint */
    enabled: boolean;
}
/**
 * Default cache configuration for various API endpoints.
 * Endpoints not listed here will use the default TTL of 5 minutes.
 */
export declare const DEFAULT_CACHE_CONFIG: Record<string, CacheConfig>;
/**
 * Default cache TTL (5 minutes in milliseconds).
 */
export declare const DEFAULT_CACHE_TTL: number;
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
export declare function getCacheConfig(endpoint: string): CacheConfig;
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
export declare function shouldCacheEndpoint(endpoint: string): boolean;
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
export declare function getEndpointCacheTTL(endpoint: string): number;
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
export declare function isCacheableMethod(method: string): boolean;
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
export declare function isCacheableStatus(status: number): boolean;
//# sourceMappingURL=cache-config.d.ts.map