export interface RateLimiterOptions {
    maxRequests?: number;
    windowMs?: number;
}
export declare class RateLimiter {
    private tokens;
    private lastRefill;
    private maxTokens;
    private refillRate;
    private readonly windowMs;
    constructor(options?: RateLimiterOptions);
    wait(): Promise<void>;
    getTokens(): number;
    getRemainingRequests(): number;
    getResetTime(): number;
    reset(): void;
    private refill;
    private sleep;
}
//# sourceMappingURL=RateLimiter.d.ts.map