import { SynapseEnhancedError } from "./http.ts";
export interface RetryPolicyOptions {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    jitterFactor?: number;
    timeout?: number;
}
export declare class RetryPolicy {
    private readonly maxAttempts;
    private readonly initialDelay;
    private readonly maxDelay;
    private readonly backoffMultiplier;
    private readonly jitterFactor;
    private readonly timeout;
    constructor(options?: RetryPolicyOptions);
    constructor(maxAttempts?: number, initialDelay?: number, maxDelay?: number, timeout?: number);
    shouldRetry(error: SynapseEnhancedError): boolean;
    getDelay(attempt: number): number;
    execute<T>(operation: () => Promise<T>, isRetryable?: (error: SynapseEnhancedError) => boolean): Promise<T>;
    /**
     * Wraps a promise with a timeout mechanism
     * @param promise - The promise to wrap
     * @returns Promise that rejects if timeout is exceeded
     */
    private withTimeout;
    /**
     * Calculates delay for a specific retry attempt using exponential backoff with jitter
     * @param attempt - Current attempt number (0-indexed)
     * @returns Delay in milliseconds before next retry
     */
    private delay;
}
export declare function isRetryableError(error: unknown): boolean;
export interface RetryResult<T> {
    success: boolean;
    data?: T;
    attempts: number;
    error?: SynapseEnhancedError;
}
export declare function withRetry<T>(operation: () => Promise<T>, policy?: RetryPolicy, signal?: AbortSignal): Promise<RetryResult<T>>;
//# sourceMappingURL=retry.d.ts.map