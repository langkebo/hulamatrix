export interface SemaphoreOptions {
    concurrency: number;
}
export declare class Semaphore {
    private readonly concurrency;
    private readonly queue;
    private readonly permits;
    constructor(concurrency: number);
    constructor(options: SemaphoreOptions);
    acquire(priority?: number): Promise<void>;
    release(): void;
    get used(): number;
    get waiting(): number;
    get available(): number;
}
export interface RateLimiterOptions {
    rateLimit: number;
    rateLimitBurst: number;
}
export declare class RateLimiter {
    private readonly rateLimit;
    private readonly rateLimitBurst;
    private tokens;
    private lastRefill;
    private readonly refillInterval;
    constructor(rateLimit: number, rateLimitBurst: number);
    acquire(weight?: number): Promise<boolean>;
    tryAcquire(weight?: number): boolean;
    private refill;
    get availableTokens(): number;
}
export interface ConnectionPoolOptions {
    baseUrl: string;
    maxConnections?: number;
    enableWarmup?: boolean;
    warmupEndpoints?: string[];
    keepAlive?: boolean;
}
export declare class ConnectionPool {
    private readonly baseUrl;
    private readonly maxConnections;
    private readonly warmupEndpoints;
    private readonly keepAlive;
    private connections;
    private initialized;
    constructor(options: ConnectionPoolOptions);
    initialize(): Promise<void>;
    warmup(): Promise<void>;
    checkHealth(): Promise<boolean>;
    destroy(): Promise<void>;
    getConnection(endpoint: string): unknown;
    releaseConnection(endpoint: string): void;
    clear(): void;
    get size(): number;
    private getConnectionKey;
}
//# sourceMappingURL=connection.d.ts.map