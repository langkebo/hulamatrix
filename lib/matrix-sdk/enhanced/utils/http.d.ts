import { ErrorCode } from "./error-codes.ts";
export { ErrorCode };
export declare class SynapseEnhancedError extends Error {
    readonly code: ErrorCode;
    readonly detail?: Record<string, unknown>;
    readonly statusCode: number;
    readonly retryable: boolean;
    private static readonly RETRYABLE_CODES;
    constructor(message: string, code?: ErrorCode, detail?: Record<string, unknown>, statusCode?: number, retryable?: boolean);
    static fromResponse(message: string, statusCode: number, detail?: Record<string, unknown>): SynapseEnhancedError;
    static isRetryable(error: Error): boolean;
}
export interface JsonBody {
    [key: string]: unknown;
}
export type RequestBody = JsonBody | FormData | Blob | ArrayBuffer | Uint8Array | string;
export interface RequestOptions {
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    body?: RequestBody;
    queryParams?: Record<string, string | number | boolean | undefined | null>;
    headers?: Record<string, string>;
    timeout?: number;
    responseType?: "json" | "text" | "blob";
}
export interface RequestResult<T = unknown> {
    data: T;
    status: number;
}
export interface HttpClientConfig {
    baseUrl: string;
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt?: number;
    apiPrefix?: string;
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
    cacheSize?: number;
    cacheMemoryMB?: number;
    cacheTTL?: number;
}
export declare class SynapseEnhancedHttpClient {
    private readonly baseUrl;
    private tokenManager;
    private readonly apiPrefix;
    private readonly timeout;
    private readonly maxRetries;
    private readonly retryDelay;
    private readonly cache;
    private readonly pendingRequests;
    private stats;
    constructor(options: HttpClientConfig);
    updateToken(accessToken: string, refreshToken?: string, expiresAt?: number): void;
    setTokenRefreshCallback(callback: (refreshToken: string) => Promise<void>): void;
    private buildUrl;
    private valueToString;
    private getHeaders;
    request<T = unknown>(endpoint: string, options?: RequestOptions): Promise<RequestResult<T>>;
    private executeRequest;
    private fetchRequest;
    private getErrorCode;
    get<T = unknown>(endpoint: string, queryParams?: Record<string, string | number | boolean | undefined | null | unknown>): Promise<RequestResult<T>>;
    post<T = unknown>(endpoint: string, body?: Record<string, unknown> | FormData, queryParams?: Record<string, string | number | boolean | undefined | null>): Promise<RequestResult<T>>;
    put<T = unknown>(endpoint: string, body?: Record<string, unknown>, queryParams?: Record<string, string | number | boolean | undefined | null>): Promise<RequestResult<T>>;
    delete<T = unknown>(endpoint: string, queryParams?: Record<string, string | number | boolean | undefined | null>): Promise<RequestResult<T>>;
    upload<T = unknown>(endpoint: string, body: FormData): Promise<RequestResult<T>>;
    getStats(): {
        requests: number;
        errors: number;
        totalRequests: number;
        cacheHits: number;
        cacheMisses: number;
        cacheHitRate: number;
        successfulRequests: number;
        failedRequests: number;
        retries: number;
        averageResponseTime: number;
    };
    clearCache(): void;
    setDefaultCacheTTL(ttl: number): void;
    invalidateCache(endpoint: string, method?: string): number;
    getCacheSize(): number;
    /**
     * Generate a simple hash from a string for cache keys
     * Uses a simple DJB2-style hash algorithm to avoid cache key collisions
     * @param str - The string to hash
     * @returns A hexadecimal hash string
     */
    private simpleHash;
    /**
     * Generate a cache key from endpoint and options
     * Uses a hash function for the query parameters to prevent cache poisoning
     * @param endpoint - The API endpoint
     * @param options - Request options including method and query parameters
     * @returns A cache key string
     */
    private getCacheKey;
    destroy(): void;
}
//# sourceMappingURL=http.d.ts.map