export interface RequestQueueOptions {
    maxConcurrent?: number;
    maxRetries?: number;
    retryDelay?: number;
}
export interface QueuedRequest<T> {
    key: string;
    request: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
    retries: number;
    timestamp: number;
}
export declare class RequestQueue {
    private queue;
    private activeRequests;
    private maxConcurrent;
    private maxRetries;
    private retryDelay;
    constructor(options?: RequestQueueOptions);
    enqueue<T>(key: string, request: () => Promise<T>): Promise<T>;
    enqueueBatch<T>(requests: Array<{
        key: string;
        request: () => Promise<T>;
    }>): Promise<T[]>;
    clear(key?: string): void;
    getQueueSize(): number;
    getActiveRequestsCount(): number;
    private processQueue;
    private executeRequest;
    private isRetryableError;
}
//# sourceMappingURL=RequestQueue.d.ts.map