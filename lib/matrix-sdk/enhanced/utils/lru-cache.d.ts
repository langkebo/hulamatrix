export interface LRUCacheOptions {
    max?: number;
    maxSize?: number;
    maxMemoryMB?: number;
    defaultTTL?: number;
    sizeCalculation?: <V>(value: V, key: string) => number;
}
export interface CacheStats {
    size: number;
    itemCount: number;
    hitCount: number;
    missCount: number;
    hitRate: number;
    memoryUsageMB: number;
    evictions: number;
}
export declare class LRUCache<K extends string = string, V = unknown> {
    private readonly _maxEntries;
    private readonly _maxMemoryMB;
    private readonly _defaultTTL;
    private readonly _sizeCalculation;
    private readonly _map;
    private readonly _orderList;
    private _memoryUsageMB;
    private _hitCount;
    private _missCount;
    private _evictions;
    constructor(options?: LRUCacheOptions);
    private defaultSizeCalculation;
    get(key: K): V | undefined;
    set(key: K, value: V, ttl?: number, size?: number): void;
    has(key: K): boolean;
    delete(key: K): boolean;
    clear(): void;
    getStats(): CacheStats;
    keys(): IterableIterator<K>;
    values(): IterableIterator<V>;
    entries(): IterableIterator<[K, V]>;
    get size(): number;
    get memoryUsage(): number;
    peek(key: K): V | undefined;
    invalidateIf(predicate: (key: K, value: V) => boolean): number;
    invalidateByPrefix(prefix: string): number;
    invalidateByTTL(maxAge: number): number;
    private promote;
    private evict;
    private evictOldest;
    dump(): Map<string, {
        value: V;
        timestamp: number;
        ttl: number;
    }>;
    load(data: Map<string, {
        value: V;
        timestamp: number;
        ttl: number;
    }>): void;
}
export declare function createMemoryCache<K extends string = string, V = unknown>(options?: LRUCacheOptions): LRUCache<K, V>;
//# sourceMappingURL=lru-cache.d.ts.map