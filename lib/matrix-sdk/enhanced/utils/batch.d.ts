export interface IBatchItem<T, R> {
    item: T;
    resolve: (value: R) => void;
    reject: (error: Error) => void;
}
export interface IBatchProcessorOptions<T, R> {
    batchSize?: number;
    flushInterval?: number;
    executeBatch: (items: T[]) => Promise<R[]>;
    onError?: (error: Error, item: T) => void;
}
export declare class BatchProcessor<T, R> {
    private queue;
    private timer;
    private readonly batchSize;
    private readonly flushInterval;
    private readonly executeBatch;
    private readonly onError?;
    private processing;
    constructor(options: IBatchProcessorOptions<T, R>);
    add(item: T): Promise<R>;
    addMany(items: T[]): Promise<R[]>;
    flush(): Promise<void>;
    getQueueSize(): number;
    clear(): void;
    private scheduleFlush;
}
export interface IBatchResult<T> {
    success: boolean;
    item: T;
    error?: Error;
}
export declare function processInBatches<T>(items: T[], processor: (item: T) => Promise<void>, batchSize?: number): Promise<IBatchResult<T>[]>;
export declare function createBatchedExecutor<T, R>(executeBatch: (items: T[]) => Promise<R[]>, options?: {
    batchSize?: number;
    flushInterval?: number;
}): (item: T) => Promise<R>;
export declare enum BatchProfile {
    IO_INTENSIVE = "io-intensive",
    CPU_INTENSIVE = "cpu-intensive",
    LOW_LATENCY = "low-latency",
    HIGH_THROUGHPUT = "high-throughput"
}
export interface BatchProcessorPresetConfig {
    batchSize: number;
    flushInterval: number;
    description: string;
}
export declare const BATCH_PRESETS: Record<BatchProfile, BatchProcessorPresetConfig>;
export declare function createPresetBatchProcessor<T, R>(executeBatch: (items: T[]) => Promise<R[]>, profile?: BatchProfile, onError?: (error: Error, item: T) => void): BatchProcessor<T, R>;
export declare function getPresetConfig(profile: BatchProfile): BatchProcessorPresetConfig;
//# sourceMappingURL=batch.d.ts.map