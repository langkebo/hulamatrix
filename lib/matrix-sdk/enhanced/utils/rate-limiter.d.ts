interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}
export declare class RateLimiter {
    private cache;
    private config;
    constructor(config?: Partial<RateLimitConfig>);
    checkLimit(key: string): {
        allowed: boolean;
        remaining: number;
        resetAt: number;
    };
    getResetTime(key: string): number;
    reset(key: string): void;
    clear(): void;
}
export declare function createRateLimiter(config?: Partial<RateLimitConfig>): RateLimiter;
export declare const GLOBAL_RATE_LIMITER: RateLimiter;
export {};
//# sourceMappingURL=rate-limiter.d.ts.map